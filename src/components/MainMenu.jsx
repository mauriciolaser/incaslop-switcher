import { useEffect, useRef } from 'react'
import fondoUrl from '../assets/sprites/boot/fondo.webp'

const FONDO_W = 1920
const FONDO_H = 1080
const SCROLL_SPEED = 28

function useFondoCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let offsetY = 0
    let lastTs = null

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const fondo = new Image()
    fondo.src = fondoUrl
    let fondoReady = false
    fondo.onload = () => { fondoReady = true }

    function loop(ts) {
      const delta = lastTs == null ? 0 : (ts - lastTs) / 1000
      lastTs = ts

      const vw = canvas.width
      const vh = canvas.height
      ctx.clearRect(0, 0, vw, vh)

      if (fondoReady) {
        const scale = Math.max(vw / FONDO_W, vh / FONDO_H)
        const drawW = FONDO_W * scale
        const drawH = FONDO_H * scale
        const ox = (vw - drawW) / 2

        offsetY = (offsetY + SCROLL_SPEED * delta) % drawH

        ctx.globalAlpha = 0.22
        ctx.drawImage(fondo, ox, offsetY, drawW, drawH)
        ctx.drawImage(fondo, ox, offsetY - drawH, drawW, drawH)
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])
}

export default function MainMenu({ onSelect, isDev = false }) {
  const canvasRef = useRef(null)
  useFondoCanvas(canvasRef)

  return (
    <div className="home-shell">
      <canvas ref={canvasRef} className="home-fondo-canvas" />
      <div className="home-panel">
        <div className="home-kicker">Mechas IncaSlop</div>
        <h1 className="home-title">Selecciona el Modo</h1>

        <div className="home-grid">
          <button className="mode-card online" onClick={() => onSelect('endless')}>
            <span className="mode-card-title">
              ENDLESS
              <span className="mode-card-live-badge">EN VIVO</span>
            </span>
            <span className="mode-card-desc">
              Candidatos al Congreso Perú 2026 peleando por su vida. Mira las peleas, apuesta en vivo y trollea a tus rivales.
            </span>
          </button>

          <button className="mode-card local" onClick={() => onSelect('tournament')}>
            <span className="mode-card-title">TORNEO</span>
            <span className="mode-card-desc">
              Elige tu caballo, entra al torneo y descubre si tiene lo que se necesita para sobrevivir en el Congreso inca.
            </span>
          </button>

          {isDev && (
            <button className="mode-card debug" onClick={() => onSelect('debug-sprite')}>
              <span className="mode-card-title">SPRITE DEBUG</span>
              <span className="mode-card-desc">
                Laboratorio local para el spritesheet: cambia el candidato, el frame y el tamaño en tiempo real.
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
