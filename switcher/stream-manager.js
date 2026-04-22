import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(__dirname, 'data', 'state.json')
const REMOTE_DEBUG_PORT = 9222

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function killProc(proc) {
  if (!proc) return
  try {
    proc.kill('SIGTERM')
    setTimeout(() => {
      try { proc.kill('SIGKILL') } catch {}
    }, 3000)
  } catch {}
}


export class StreamManager {
  #currentUrl = null
  #status = 'stopped'
  #xvfbProc = null
  #wmProc = null
  #chromiumProc = null
  #ffmpegProc = null
  #browser = null
  #page = null
  #startedAt = null
  #config = {}

  constructor(config) {
    this.#config = config
    this.#loadState()
  }

  #loadState() {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8')
      const { currentUrl } = JSON.parse(raw)
      if (currentUrl) this.#currentUrl = currentUrl
    } catch {}
  }

  #saveState() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
      fs.writeFileSync(STATE_FILE, JSON.stringify({ currentUrl: this.#currentUrl }))
    } catch (e) {
      console.error('[state] Error saving state:', e.message)
    }
  }

  #findBin(...candidates) {
    const paths = (process.env.PATH || '/usr/bin:/usr/local/bin').split(':')
    for (const bin of candidates) {
      for (const p of paths) {
        const full = path.join(p, bin)
        try { fs.accessSync(full, fs.constants.X_OK); return full } catch {}
      }
    }
    return null
  }

  getStatus() {
    return {
      status: this.#status,
      currentUrl: this.#currentUrl,
      uptimeSeconds: this.#startedAt ? Math.floor((Date.now() - this.#startedAt) / 1000) : 0,
    }
  }

  async start() {
    if (this.#status !== 'stopped' && this.#status !== 'error') {
      throw new Error('Stream is already running')
    }

    this.#status = 'starting'
    const { DISPLAY_NUM, STREAM_WIDTH, STREAM_HEIGHT, CHROMIUM_EXECUTABLE_PATH,
      KICK_RTMP_URL, KICK_STREAM_KEY, STREAM_FPS, VIDEO_BITRATE, MAXRATE,
      BUFSIZE, GOP, PRESET } = this.#config

    const display = DISPLAY_NUM || ':99'
    const w = STREAM_WIDTH || '1920'
    const h = STREAM_HEIGHT || '1080'
    const fps = STREAM_FPS || '30'
    const rtmpTarget = `${KICK_RTMP_URL}/${KICK_STREAM_KEY}`
    const url = this.#currentUrl || 'about:blank'

    const chromiumBin = CHROMIUM_EXECUTABLE_PATH
      || this.#findBin('chromium-browser', 'chromium', 'google-chrome')
    if (!chromiumBin) throw new Error('Chromium executable not found')

    const env = {
      ...process.env,
      DISPLAY: display,
    }

    try {
      // 1. Kill stale processes
      try { spawn('pkill', ['-f', `Xvfb ${display}`], { stdio: 'ignore' }) } catch {}
      await sleep(500)

      // 2. Start Xvfb
      this.#xvfbProc = spawn('Xvfb', [
        display, '-screen', '0', `${w}x${h}x24`, '-nolisten', 'tcp'
      ], { stdio: 'ignore', env })

      this.#xvfbProc.on('error', (e) => console.error('[xvfb] error:', e.message))
      this.#xvfbProc.on('close', (code) => {
        if (this.#status === 'streaming') {
          console.error('[xvfb] exited unexpectedly, code:', code)
          this.#status = 'error'
        }
      })
      await sleep(1500)

      // 3. Start window manager (needed for Chromium to render JS properly)
      const wmBin = this.#findBin('fluxbox', 'openbox', 'twm', 'icewm')
      if (wmBin) {
        this.#wmProc = spawn(wmBin, [], { stdio: 'ignore', env })
        this.#wmProc.on('error', (e) => console.error('[wm] error:', e.message))
        await sleep(1000)
        console.log(`[wm] Started: ${wmBin}`)
      } else {
        console.warn('[wm] No window manager found — JS rendering may be degraded')
      }

      // 4. Start Chromium directly (not via Puppeteer) for proper rendering
      this.#chromiumProc = spawn(chromiumBin, [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--disable-infobars',
        '--disable-session-crashed-bubble',
        '--disable-features=Translate,AutomationControlled,TranslateUI',
        '--ignore-gpu-blocklist',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--use-gl=swiftshader',
        '--autoplay-policy=no-user-gesture-required',
        '--force-device-scale-factor=1',
        '--start-maximized',
        `--window-size=${w},${h}`,
        '--window-position=0,0',
        `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--kiosk',
        url,
      ], { stdio: ['ignore', 'pipe', 'pipe'], env })

      this.#chromiumProc.stderr.on('data', (d) => {
        const msg = d.toString()
        if (!msg.includes('DevTools') && !msg.includes('Xlib')) {
          process.stdout.write(`[chromium] ${msg}`)
        }
      })
      this.#chromiumProc.on('error', (e) => console.error('[chromium] error:', e.message))
      this.#chromiumProc.on('close', (code) => {
        if (this.#status === 'streaming') {
          console.error('[chromium] exited unexpectedly, code:', code)
          this.#status = 'error'
        }
      })

      await sleep(3000)

      // 5. Connect Puppeteer to the running Chromium via remote debugging
      this.#browser = await puppeteer.connect({
        browserURL: `http://localhost:${REMOTE_DEBUG_PORT}`,
        defaultViewport: null,
      })

      const pages = await this.#browser.pages()
      this.#page = pages[0] || await this.#browser.newPage()
      await this.#hideChromiumUI()

      // 6. Start FFmpeg (video only)
      this.#ffmpegProc = spawn('ffmpeg', [
        // Video: x11grab
        '-f', 'x11grab',
        '-framerate', fps,
        '-video_size', `${w}x${h}`,
        '-i', `${display}.0`,
        // Video encoding
        '-c:v', 'libx264',
        '-preset', PRESET || 'veryfast',
        '-b:v', VIDEO_BITRATE || '4500k',
        '-maxrate', MAXRATE || '4500k',
        '-bufsize', BUFSIZE || '9000k',
        '-pix_fmt', 'yuv420p',
        '-g', GOP || '60',
        '-an',
        '-f', 'flv',
        rtmpTarget,
      ], { stdio: ['ignore', 'pipe', 'pipe'], env })

      this.#ffmpegProc.stderr.on('data', (d) => process.stdout.write(`[ffmpeg] ${d}`))
      this.#ffmpegProc.on('error', (e) => console.error('[ffmpeg] error:', e.message))
      this.#ffmpegProc.on('close', (code) => {
        if (this.#status === 'streaming') {
          console.error('[ffmpeg] exited unexpectedly, code:', code)
          this.#status = 'error'
        }
      })

      this.#status = 'streaming'
      this.#startedAt = Date.now()
      console.log('[stream] Started, broadcasting:', url)

    } catch (e) {
      this.#status = 'error'
      console.error('[stream] Failed to start:', e.message)
      throw e
    }
  }

  async stop() {
    if (this.#status === 'stopped') return

    this.#status = 'stopped'
    this.#startedAt = null

    killProc(this.#ffmpegProc)
    this.#ffmpegProc = null

    try {
      if (this.#browser) await this.#browser.disconnect()
    } catch {}
    this.#browser = null
    this.#page = null

    killProc(this.#chromiumProc)
    this.#chromiumProc = null

    killProc(this.#wmProc)
    this.#wmProc = null

    killProc(this.#xvfbProc)
    this.#xvfbProc = null

    console.log('[stream] Stopped')
  }

  async #hideChromiumUI() {
    try {
      await this.#page.addStyleTag({
        content: `
          #g-bar, .translate-popup, [id*="translate"], [class*="translate"],
          .language-options, .infobars-container { display: none !important; }
        `
      })
    } catch {}
  }

  async switchUrl(url) {
    if (!this.#page) throw new Error('Stream is not running')

    await this.#page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await this.#hideChromiumUI()
    this.#currentUrl = url
    this.#saveState()
    console.log('[stream] Switched to:', url)
  }
}
