import { useEffect, useRef } from 'react'
import bootImg from '../assets/sprites/boot/boot.png'

export default function BootScreen() {
  const imgRef = useRef(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    let start = null
    let raf

    // Pulse: scale 0.85 → 1.05 → 0.85, drift up/down slightly
    function animate(ts) {
      if (!start) start = ts
      const t = (ts - start) / 1000 // seconds

      const scale = 0.90 + 0.15 * Math.abs(Math.sin(t * 1.4))
      const dy = -6 * Math.sin(t * 1.1)

      img.style.transform = `translateY(${dy}px) scale(${scale})`
      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="boot-screen">
      <img ref={imgRef} src={bootImg} alt="Cargando..." className="boot-sprite" />
    </div>
  )
}
