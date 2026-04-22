import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'
import { AudioLoopManager } from './audio-loop-manager.js'

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
  #runtime = null
  #audioLoop = null
  #config = {}
  #overlay = {
    visible: false,
    text: '',
    expiresAt: null,
  }

  constructor(config) {
    this.#config = config
    this.#audioLoop = new AudioLoopManager()
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

  getAudioStatus() {
    return this.#audioLoop.getStatus({ isStreaming: this.#status === 'streaming' })
  }

  async rescanAudio() {
    this.#audioLoop.rescan()
    if (this.#status === 'streaming') {
      await this.#restartFfmpeg()
    }
    return this.getAudioStatus()
  }

  async start() {
    if (this.#status !== 'stopped' && this.#status !== 'error') {
      throw new Error('Stream is already running')
    }

    this.#status = 'starting'
    const { DISPLAY_NUM, STREAM_WIDTH, STREAM_HEIGHT, CHROMIUM_EXECUTABLE_PATH,
      KICK_RTMP_URL, KICK_STREAM_KEY, STREAM_FPS } = this.#config

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
    this.#runtime = { display, w, h, fps, rtmpTarget, env }

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
      await this.#syncOverlayToPage()

      // 6. Start FFmpeg (video + optional audio playlist)
      this.#audioLoop.rescan()
      await this.#startFfmpeg()

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

    await this.#stopFfmpeg()

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
    this.#runtime = null

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

  async #syncOverlayToPage() {
    if (!this.#page) return

    const now = Date.now()
    const stillVisible = this.#overlay.visible
      && this.#overlay.expiresAt
      && this.#overlay.expiresAt > now

    if (!stillVisible) {
      this.#overlay.visible = false
      this.#overlay.text = ''
      this.#overlay.expiresAt = null
    }

    await this.#page.evaluate(({ visible, text }) => {
      const STYLE_ID = 'incaslop-overlay-style'
      const ROOT_ID = 'incaslop-overlay-root'
      const TEXT_ID = 'incaslop-overlay-text'

      let style = document.getElementById(STYLE_ID)
      if (!style) {
        style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = `
          #${ROOT_ID} {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
            pointer-events: none;
            padding: 40px;
          }
          #${TEXT_ID} {
            max-width: min(1200px, 90vw);
            background: rgba(8, 10, 20, 0.82);
            color: #f8fafc;
            border: 2px solid rgba(255, 255, 255, 0.18);
            border-radius: 16px;
            padding: 26px 34px;
            text-align: center;
            font: 700 56px/1.18 "Arial", "Helvetica Neue", Helvetica, sans-serif;
            letter-spacing: 0.01em;
            text-shadow: 0 2px 14px rgba(0, 0, 0, 0.65);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }
          @media (max-width: 1400px) {
            #${TEXT_ID} {
              font-size: 44px;
            }
          }
        `
        document.head.appendChild(style)
      }

      let root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID
        const textEl = document.createElement('div')
        textEl.id = TEXT_ID
        root.appendChild(textEl)
        document.body.appendChild(root)
      }

      const textEl = document.getElementById(TEXT_ID)
      if (textEl) textEl.textContent = visible ? (text || '') : ''
      root.style.display = visible ? 'flex' : 'none'
    }, { visible: stillVisible, text: this.#overlay.text || '' })
  }

  async showOverlayMessage({ text, expiresAt }) {
    if (!this.#page) throw new Error('Stream is not running')

    this.#overlay.visible = true
    this.#overlay.text = text
    this.#overlay.expiresAt = expiresAt
    await this.#syncOverlayToPage()
  }

  async clearOverlayMessage() {
    this.#overlay.visible = false
    this.#overlay.text = ''
    this.#overlay.expiresAt = null
    await this.#syncOverlayToPage()
  }

  async switchUrl(url) {
    if (!this.#page) throw new Error('Stream is not running')

    await this.#page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await this.#hideChromiumUI()
    await this.#syncOverlayToPage()
    this.#currentUrl = url
    this.#saveState()
    console.log('[stream] Switched to:', url)
  }

  async #restartFfmpeg() {
    if (!this.#runtime) return
    await this.#stopFfmpeg()
    await this.#startFfmpeg()
    console.log('[audio] FFmpeg reiniciado para aplicar cambios de playlist')
  }

  async #stopFfmpeg() {
    const proc = this.#ffmpegProc
    if (!proc) return

    proc.__intentionalStop = true
    this.#ffmpegProc = null
    this.#audioLoop.clearLoopStart()

    await new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      proc.once('close', finish)
      killProc(proc)
      setTimeout(finish, 4000)
    })
  }

  async #startFfmpeg() {
    if (!this.#runtime) throw new Error('Runtime de stream no inicializado')

    const audio = this.#audioLoop.getStatus({ isStreaming: false })
    const { display, w, h, fps, rtmpTarget, env } = this.#runtime
    const { VIDEO_BITRATE, MAXRATE, BUFSIZE, GOP, PRESET, AUDIO_BITRATE } = this.#config

    const ffmpegArgs = [
      '-f', 'x11grab',
      '-framerate', fps,
      '-video_size', `${w}x${h}`,
      '-i', `${display}.0`,
    ]

    if (audio.enabled) {
      ffmpegArgs.push(
        '-stream_loop', '-1',
        '-f', 'concat',
        '-safe', '0',
        '-i', this.#audioLoop.getPlaylistFile(),
      )
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', PRESET || 'veryfast',
      '-b:v', VIDEO_BITRATE || '4500k',
      '-maxrate', MAXRATE || '4500k',
      '-bufsize', BUFSIZE || '9000k',
      '-pix_fmt', 'yuv420p',
      '-g', GOP || '60',
    )

    if (audio.enabled) {
      ffmpegArgs.push(
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:a', 'aac',
        '-b:a', AUDIO_BITRATE || '192k',
        '-ar', '44100',
        '-ac', '2',
      )
      this.#audioLoop.markLoopStart()
      console.log(`[audio] Loop activo con ${audio.trackCount} pista(s)`)
    } else {
      ffmpegArgs.push('-an')
      this.#audioLoop.clearLoopStart()
      for (const warning of audio.warnings) {
        console.warn('[audio]', warning)
      }
    }

    ffmpegArgs.push('-f', 'flv', rtmpTarget)

    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'], env })
    this.#ffmpegProc = proc

    proc.stderr.on('data', (d) => process.stdout.write(`[ffmpeg] ${d}`))
    proc.on('error', (e) => console.error('[ffmpeg] error:', e.message))
    proc.on('close', (code) => {
      if (proc.__intentionalStop) return
      if (this.#status === 'streaming') {
        console.error('[ffmpeg] exited unexpectedly, code:', code)
        this.#status = 'error'
      }
    })
  }
}
