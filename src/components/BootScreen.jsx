import { useEffect, useRef } from 'react'
import bootImg from '../assets/sprites/boot/boot.webp'
import fondoUrl from '../assets/sprites/boot/fondo.webp'

// Tamaño nativo de fondo.webp
const FONDO_W = 1920
const FONDO_H = 1080
// Velocidad de scroll en píxeles de imagen escalada por segundo
const SCROLL_SPEED = 80
// Tiempo mínimo visible del boot (ms) una vez que la imagen cargó
const MIN_BOOT_MS = 900

export default function BootScreen({ onDone }) {
  const canvasRef = useRef(null)
  const spriteRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let raf
    let offsetY = 0
    let fondoReady = false
    let startTs = null
    let lastTs = null
    let doneCalled = false

    function callDone() {
      if (!doneCalled) {
        doneCalled = true
        onDone?.()
      }
    }

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Precargar imagen de fondo; el boot no termina hasta que esté lista
    const fondo = new Image()
    fondo.src = fondoUrl

    // Fallback por si la imagen tarda demasiado
    const maxTimer = setTimeout(callDone, MIN_BOOT_MS + 5000)

    fondo.onload = () => {
      fondoReady = true
      setTimeout(callDone, MIN_BOOT_MS)
    }
    fondo.onerror = () => {
      setTimeout(callDone, MIN_BOOT_MS)
    }

    function loop(ts) {
      const delta = lastTs == null ? 0 : (ts - lastTs) / 1000
      lastTs = ts
      if (!startTs) startTs = ts
      const elapsed = (ts - startTs) / 1000

      const vw = canvas.width
      const vh = canvas.height
      ctx.clearRect(0, 0, vw, vh)

      // ── Fondo scrolleante (cover, arriba→abajo en loop infinito) ──
      if (fondoReady) {
        const scale = Math.max(vw / FONDO_W, vh / FONDO_H)
        const drawW = FONDO_W * scale
        const drawH = FONDO_H * scale
        const ox = (vw - drawW) / 2

        offsetY = (offsetY + SCROLL_SPEED * delta) % drawH

        // Dos copias consecutivas para el loop sin corte visible
        ctx.drawImage(fondo, ox, offsetY, drawW, drawH)
        ctx.drawImage(fondo, ox, offsetY - drawH, drawW, drawH)
      } else {
        ctx.fillStyle = '#05070f'
        ctx.fillRect(0, 0, vw, vh)
      }

      // ── Sprite animado (pulso + deriva vertical) ─────────────────
      const sprite = spriteRef.current
      if (sprite) {
        const sc = 0.90 + 0.15 * Math.abs(Math.sin(elapsed * 1.4))
        const dy = -6 * Math.sin(elapsed * 1.1)
        sprite.style.transform = `translateY(${dy}px) scale(${sc})`
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(maxTimer)
      window.removeEventListener('resize', resize)
    }
  }, [onDone])

  return (
    <div className="boot-screen">
      <canvas ref={canvasRef} className="boot-canvas" />
      <img ref={spriteRef} src={bootImg} alt="Cargando..." className="boot-sprite" />
    </div>
  )
}
