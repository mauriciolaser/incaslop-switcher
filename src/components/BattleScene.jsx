import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import ringTextureUrl from '../assets/textures/ring.png'
import FighterSprite from './FighterSprite'
import { useGame } from '../context/GameContext'
import { getKoProgress } from '../utils/koTimeline'
import { getEffectVisual, getLogEntryVisual } from '../utils/battleVisuals'

const POS_LEFT = [-1.2, -0.2, 1.5]
const POS_RIGHT = [1.8, -0.2, -2.5]

const CAM_POS = new THREE.Vector3(-0.8, 2.2, 5.5)
const CAM_LOOKAT = new THREE.Vector3(1.0, 0.8, -2.0)

// RingBase world-space surface:
//   RingBase group Y = -0.5
//   top box local position [0, 0.15, -0.5], height 0.3
//   → surface top world Y = -0.5 + 0.15 + 0.15 = -0.20
//   → X edges: ±5  → [-5, +5]
//   → Z edges: (-0.5 + -0.5) ± 5 = -1.0 ± 5 → [-6, +4]
const PY  = -0.20   // platform surface world Y
const PXL = -5.0    // platform left edge X
const PXR =  5.0    // platform right edge X
const PZB = -6.0    // platform back edge Z
const PZF =  4.0    // platform front edge Z (closest to camera — no ropes)


// Minimalist crowd spectator: a small box body + smaller box head, animated
function SpectatorFigure({ position, color, phaseOffset }) {
  const groupRef = useRef(null)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const bounce = Math.abs(Math.sin((t + phaseOffset) * 3.2)) * 0.18
    groupRef.current.position.y = position[1] + bounce
  })
  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.18, 0.28, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.14, 0.14, 0.1]} />
        <meshStandardMaterial color="#e8c89a" roughness={0.9} />
      </mesh>
    </group>
  )
}

const CROWD_COLORS = ['#cc3322', '#2255bb', '#33aa55', '#aa8800', '#8833aa', '#dd6600', '#1199aa']

function Crowd() {
  const xL = PXL
  const xR = PXR
  const zB = PZB
  const zF = PZF

  const figures = []
  const rows = 3
  const gap = 0.7
  const spacing = 0.55

  // Back rows (z < zB)
  for (let row = 0; row < rows; row++) {
    const z = zB - gap - row * spacing
    const count = 18
    for (let i = 0; i < count; i++) {
      const x = xL + (i / (count - 1)) * (xR - xL) + (Math.random() - 0.5) * 0.25
      figures.push({ x, y: row * 0.18, z, phase: Math.random() * Math.PI * 2 })
    }
  }

  // Left rows (x < xL)
  for (let row = 0; row < rows; row++) {
    const x = xL - gap - row * spacing
    const count = 12
    for (let i = 0; i < count; i++) {
      const z = zB + (i / (count - 1)) * (zF - zB) + (Math.random() - 0.5) * 0.25
      figures.push({ x, y: row * 0.18, z, phase: Math.random() * Math.PI * 2 })
    }
  }

  // Right rows (x > xR)
  for (let row = 0; row < rows; row++) {
    const x = xR + gap + row * spacing
    const count = 12
    for (let i = 0; i < count; i++) {
      const z = zB + (i / (count - 1)) * (zF - zB) + (Math.random() - 0.5) * 0.25
      figures.push({ x, y: row * 0.18, z, phase: Math.random() * Math.PI * 2 })
    }
  }

  return (
    <group position={[0, PY, 0]}>
      {figures.map((f, i) => (
        <SpectatorFigure
          key={i}
          position={[f.x, f.y, f.z]}
          color={CROWD_COLORS[i % CROWD_COLORS.length]}
          phaseOffset={f.phase}
        />
      ))}
    </group>
  )
}

function RingBase() {
  const ringTexture = useTexture(ringTextureUrl)

  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0.15, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[10, 0.3, 10]} />
        <meshStandardMaterial map={ringTexture} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[10.4, 0.3, 10.4]} />
        <meshStandardMaterial color="#0d1b2a" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[POS_LEFT[0], 0.31, POS_LEFT[2]]}>
        <cylinderGeometry args={[0.45, 0.45, 0.02, 16]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff2200" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[POS_RIGHT[0], 0.31, POS_RIGHT[2]]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#2244ff" emissive="#0022ff" emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, -0.5]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
    </group>
  )
}

function Lights({ koState }) {
  const ambientRef = useRef(null)
  const directionalRef = useRef(null)
  const leftSpotRef = useRef(null)
  const rightSpotRef = useRef(null)
  const mainPointRef = useRef(null)
  const accentPointRef = useRef(null)

  useFrame(() => {
    const winnerSide = koState?.winnerSide
    const koProgress = koState ? getKoProgress(koState) : 0
    const impactFlash = koState ? Math.max(0, 1 - koProgress * 5.5) : 0
    const dramaticPulse = koState ? Math.max(0, Math.sin(koProgress * Math.PI) * 0.85) : 0

    if (ambientRef.current) {
      ambientRef.current.intensity = 0.35 + impactFlash * 0.2
      ambientRef.current.color.set(winnerSide === 'left' ? '#ffccbc' : winnerSide === 'right' ? '#c6d7ff' : '#8899bb')
    }
    if (directionalRef.current) {
      directionalRef.current.intensity = 1.8 + impactFlash * 1.4
    }
    if (leftSpotRef.current) {
      leftSpotRef.current.intensity = winnerSide === 'left' ? 7 + dramaticPulse * 4 : 5
    }
    if (rightSpotRef.current) {
      rightSpotRef.current.intensity = winnerSide === 'right' ? 7 + dramaticPulse * 4 : 5
    }
    if (mainPointRef.current) {
      mainPointRef.current.intensity = 2.5 + impactFlash * 2.2
    }
    if (accentPointRef.current) {
      accentPointRef.current.intensity = 1.2 + dramaticPulse
      accentPointRef.current.color.set(winnerSide === 'left' ? '#ff8f70' : winnerSide === 'right' ? '#7cb4ff' : '#445566')
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.35} color="#8899bb" />
      <directionalLight
        ref={directionalRef}
        position={[0, 12, 4]}
        intensity={1.8}
        color="#ffeedd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      <spotLight ref={leftSpotRef} position={[POS_LEFT[0], 8, POS_LEFT[2] + 2]} angle={0.5} penumbra={0.7} intensity={5} color="#ff4422" castShadow distance={20} decay={1.5} />
      <spotLight ref={rightSpotRef} position={[POS_RIGHT[0], 8, POS_RIGHT[2] - 1]} angle={0.5} penumbra={0.7} intensity={5} color="#2244ff" castShadow distance={20} decay={1.5} />
      <pointLight ref={mainPointRef} position={[0, 6, 0]} intensity={2.5} color="#ffffff" distance={20} decay={1.5} />
      <pointLight ref={accentPointRef} position={[0, 3, 4]} intensity={1.2} color="#445566" distance={16} decay={2} />
    </>
  )
}

function CameraController({ koState }) {
  const lerpPos = useRef(CAM_POS.clone())
  const lerpLookAt = useRef(CAM_LOOKAT.clone())

  useFrame(({ camera }, delta) => {
    const t = 1 - Math.exp(-5 * delta)
    lerpPos.current.lerp(CAM_POS, t)
    lerpLookAt.current.lerp(CAM_LOOKAT, t)

    const koProgress = koState ? getKoProgress(koState) : 0
    const shake = koState ? Math.max(0, 1 - koProgress * 3.5) * 0.12 : 0
    const shakeX = shake > 0 ? Math.sin(koProgress * 52) * shake : 0
    const shakeY = shake > 0 ? Math.cos(koProgress * 43) * shake * 0.55 : 0

    camera.position.set(
      lerpPos.current.x + shakeX,
      lerpPos.current.y + shakeY,
      lerpPos.current.z,
    )
    camera.lookAt(
      lerpLookAt.current.x - shakeX * 0.35,
      lerpLookAt.current.y,
      lerpLookAt.current.z,
    )
  })

  return null
}

// ── Whimsical Stars (ThreeJS, shown on result phase) ─────────────────────────
const STAR_COUNT = 120
const STAR_COLORS = [0xffd700, 0xffffff, 0xff88cc, 0x88ccff, 0xffaa44, 0xaaffcc]

function buildStarData() {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: (Math.random() - 0.5) * 22,
    y: 4 + Math.random() * 8,
    z: (Math.random() - 0.5) * 12,
    vy: -(0.015 + Math.random() * 0.025),
    spin: Math.random() * Math.PI * 2,
    spinV: (Math.random() - 0.5) * 0.12,
    orbitR: 0.4 + Math.random() * 3.5,
    orbitSpeed: (Math.random() - 0.5) * 1.2,
    orbitPhase: Math.random() * Math.PI * 2,
    scale: 0.04 + Math.random() * 0.12,
    colorIdx: Math.floor(Math.random() * STAR_COLORS.length),
  }))
}

function WhimsicalStars({ active }) {
  const groupRef = useRef(null)
  const starsRef = useRef(buildStarData())

  useFrame((_, delta) => {
    if (!groupRef.current || !active) return
    const children = groupRef.current.children
    starsRef.current.forEach((s, i) => {
      s.y += s.vy
      s.spin += s.spinV
      s.orbitPhase += s.orbitSpeed * delta
      if (s.y < -3) {
        s.y = 6 + Math.random() * 4
        s.x = (Math.random() - 0.5) * 22
        s.z = (Math.random() - 0.5) * 12
      }
      const mesh = children[i]
      if (!mesh) return
      mesh.position.set(
        s.x + Math.cos(s.orbitPhase) * s.orbitR * 0.4,
        s.y,
        s.z + Math.sin(s.orbitPhase) * s.orbitR * 0.3,
      )
      mesh.rotation.z = s.spin
      mesh.rotation.y = s.orbitPhase * 0.5
    })
  })

  if (!active) return null

  return (
    <group ref={groupRef}>
      {starsRef.current.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} scale={s.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={STAR_COLORS[s.colorIdx]}
            emissive={STAR_COLORS[s.colorIdx]}
            emissiveIntensity={1.6}
            roughness={0.1}
            metalness={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#ffcc00', '#ff4422', '#44aaff', '#44ee66', '#ff88cc', '#ffffff', '#ff9900']
const CONFETTI_COUNT = 110

function useConfetti(active) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)

  const spawn = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.width
    particlesRef.current = Array.from({ length: CONFETTI_COUNT }, () => ({
      x: Math.random() * w,
      y: -10 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 1.8 + Math.random() * 2.8,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.18,
      w: 7 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      opacity: 0.85 + Math.random() * 0.15,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      const canvas = canvasRef.current
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current = []
      return
    }

    spawn()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current = particlesRef.current.filter(p => p.y < canvas.height + 20)
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.rot += p.rotV
        p.vy += 0.04
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, spawn])

  return canvasRef
}

// ── Camera flashes ─────────────────────────────────────────────────────────────
const FLASH_DURATION_MS = 2200   // duración total del efecto
const FLASH_BURST_INTERVAL = 90  // ms entre ráfagas
const FLASH_PER_BURST = 4        // flashes simultáneos por ráfaga
const FLASH_VISIBLE_MS = 160     // cuánto tiempo es visible cada flash

function useCameraFlashes(active) {
  const [flashes, setFlashes] = useState([])
  const timersRef = useRef([])
  const idRef = useRef(0)

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setFlashes([])
      return
    }

    const timers = []
    const bursts = Math.floor(FLASH_DURATION_MS / FLASH_BURST_INTERVAL)

    for (let b = 0; b < bursts; b++) {
      const burstDelay = b * FLASH_BURST_INTERVAL
      const t = setTimeout(() => {
        const batch = Array.from({ length: FLASH_PER_BURST }, () => {
          const id = ++idRef.current
          return {
            id,
            x: 3 + Math.random() * 94,   // todo el ancho
            y: 5 + Math.random() * 88,    // todo el alto (fondo completo)
            size: 6 + Math.random() * 10,
          }
        })
        setFlashes(prev => [...prev, ...batch])
        const cleanup = setTimeout(() => {
          const ids = new Set(batch.map(f => f.id))
          setFlashes(prev => prev.filter(f => !ids.has(f.id)))
        }, FLASH_VISIBLE_MS)
        timers.push(cleanup)
      }, burstDelay)
      timers.push(t)
    }

    timersRef.current = timers
    return () => timers.forEach(clearTimeout)
  }, [active])

  return flashes
}

export default function BattleScene() {
  const { fighter1, fighter2, currentTurn, phase, koState, battleLog } = useGame()
  const fighter1BattlePortrait = fighter1.transparentUrl ?? fighter1.portraitUrl
  const fighter2BattlePortrait = fighter2.transparentUrl ?? fighter2.portraitUrl
  const showFighters = phase === 'fighting' || phase === 'ko' || phase === 'result'
  const leftAnimationState = koState?.loserSide === 'left' ? 'ko' : 'idle'
  const rightAnimationState = koState?.loserSide === 'right' ? 'ko' : 'idle'
  const previousLogLengthRef = useRef(battleLog.length)
  const previousEffectsRef = useRef({
    left: new Set((fighter1.efectos ?? []).map((efecto) => efecto.id)),
    right: new Set((fighter2.efectos ?? []).map((efecto) => efecto.id)),
  })
  const flashSequenceRef = useRef(0)
  const [flashEvent, setFlashEvent] = useState(null)
  const isKoOrResult = phase === 'ko' || phase === 'result'
  const confettiCanvasRef = useConfetti(isKoOrResult)
  const cameraFlashes = useCameraFlashes(isKoOrResult)

  useEffect(() => {
    if (battleLog.length < previousLogLengthRef.current) {
      previousLogLengthRef.current = battleLog.length
      return
    }

    if (battleLog.length === previousLogLengthRef.current) {
      return
    }

    const newEntries = battleLog.slice(previousLogLengthRef.current)
    previousLogLengthRef.current = battleLog.length

    const flashFromLog = [...newEntries]
      .reverse()
      .map((entry) => getLogEntryVisual(entry))
      .find(Boolean)

    if (flashFromLog) {
      flashSequenceRef.current += 1
      setFlashEvent({
        ...flashFromLog,
        id: `flash-${flashSequenceRef.current}`,
      })
    }
  }, [battleLog])

  useEffect(() => {
    const nextEffects = {
      left: new Set((fighter1.efectos ?? []).map((efecto) => efecto.id)),
      right: new Set((fighter2.efectos ?? []).map((efecto) => efecto.id)),
    }
    const previousEffects = previousEffectsRef.current

    const addedLeft = [...nextEffects.left].find((effectId) => !previousEffects.left.has(effectId))
    const addedRight = [...nextEffects.right].find((effectId) => !previousEffects.right.has(effectId))
    const addedEffect = addedLeft || addedRight

    previousEffectsRef.current = nextEffects

    if (!addedEffect) return

    const effectVisual = getEffectVisual(addedEffect)
    if (effectVisual) {
      flashSequenceRef.current += 1
      setFlashEvent({
        ...effectVisual,
        id: `flash-${flashSequenceRef.current}`,
      })
    }
  }, [fighter1.efectos, fighter2.efectos])

  useEffect(() => {
    if (!flashEvent) return undefined

    const timeoutId = window.setTimeout(() => {
      setFlashEvent((current) => (current?.id === flashEvent.id ? null : current))
    }, 760)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [flashEvent])

  return (
    <div className="battle-scene-shell">
      <Canvas
        shadows
        camera={{ position: CAM_POS.toArray(), fov: 55 }}
        gl={{ antialias: true, toneMapping: 3 }}
      >
        <color attach="background" args={['#050508']} />
        <Lights koState={phase === 'ko' ? koState : null} />
        <RingBase />
        <Crowd />
        <CameraController koState={phase === 'ko' ? koState : null} />
        <WhimsicalStars active={phase === 'result'} />

        {showFighters && (
          <>
            <FighterSprite
              key="fighter-left"
              position={POS_LEFT}
              opponentPosition={POS_RIGHT}
              side="left"
              portraitUrl={fighter1BattlePortrait}
              spriteSheetUrl={fighter1.partyLabel ? `/sprites/parties/${fighter1.partyLabel}.png` : undefined}
              hp={fighter1.hp}
              isAttacking={currentTurn}
              alive={fighter1.alive}
              scale={1.7}
              facingCamera={true}
              animationState={leftAnimationState}
              koState={phase === 'ko' || phase === 'result' ? koState : null}
            />

            <FighterSprite
              key="fighter-right"
              position={POS_RIGHT}
              opponentPosition={POS_LEFT}
              side="right"
              portraitUrl={fighter2BattlePortrait}
              spriteSheetUrl={fighter2.partyLabel ? `/sprites/parties/${fighter2.partyLabel}.png` : undefined}
              hp={fighter2.hp}
              isAttacking={currentTurn}
              alive={fighter2.alive}
              scale={1.0}
              facingCamera={false}
              animationState={rightAnimationState}
              koState={phase === 'ko' || phase === 'result' ? koState : null}
            />
          </>
        )}

        <ContactShadows position={[0, -0.19, 0]} opacity={0.6} scale={14} blur={2} far={6} />
        <Environment preset="night" />
        <fog attach="fog" args={['#050508', 16, 32]} />
      </Canvas>

      <div
        className={`battle-ko-overlay ${phase === 'ko' ? 'active' : ''}`}
      />
      {flashEvent && (
        <div
          key={flashEvent.id}
          className="battle-status-flash active"
          style={{ '--flash-color': flashEvent.color }}
        >
          <div className="battle-status-flash-tag">{flashEvent.label}</div>
        </div>
      )}

      {/* Confetti canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="battle-confetti-canvas"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 20,
        }}
      />

      {/* Camera flashes */}
      {cameraFlashes.map(f => (
        <div
          key={f.id}
          className="crowd-camera-flash"
          style={{ left: `${f.x}%`, top: `${f.y}%`, '--flash-size': `${f.size}px` }}
        />
      ))}
    </div>
  )
}
