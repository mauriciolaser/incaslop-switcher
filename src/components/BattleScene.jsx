import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import FighterSprite from './FighterSprite'
import { useGame } from '../context/GameContext'

const RING_SIZE = 5
const CORNER = 2.4

// Los sprites son billboards planos — los ponemos frente a frente en el eje X,
// al mismo Z, para que la cámara lateral los vea a ambos de frente.
const POS_LEFT  = [-CORNER, -0.2, 0]
const POS_RIGHT = [ CORNER, -0.2, 0]

// Cámara lateral fija: mira desde Z+ hacia el centro del ring
// fov amplio para ver todo el escenario con perspectiva
const CAM_POS    = new THREE.Vector3(0, 1.6, 9)
const CAM_LOOKAT = new THREE.Vector3(0, 1.0, 0)
const CAM_LERP   = 5

function RingBase() {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[RING_SIZE * 2, 0.3, RING_SIZE * 2]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow castShadow>
        <boxGeometry args={[RING_SIZE * 2 + 0.3, 0.3, RING_SIZE * 2 + 0.3]} />
        <meshStandardMaterial color="#0d1b2a" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[-CORNER, 0.31, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff2200" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[CORNER, 0.31, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#2244ff" emissive="#0022ff" emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
    </group>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#8899bb" />
      <directionalLight
        position={[0, 12, 8]}
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
      <spotLight position={[-CORNER, 8, 2]}  angle={0.6} penumbra={0.7} intensity={4} color="#ff4422" castShadow distance={20} decay={1.5} />
      <spotLight position={[ CORNER, 8, 2]}  angle={0.6} penumbra={0.7} intensity={4} color="#2244ff" castShadow distance={20} decay={1.5} />
      <pointLight position={[0, 8, 0]}  intensity={2.5} color="#ffffff" distance={20} decay={1.5} />
      <pointLight position={[0, 3, 6]}  intensity={1.2} color="#445566" distance={16} decay={2} />
    </>
  )
}

// Cámara fija que puede cambiar de lado (peleador 1 o peleador 2)
// pero siempre es lateral — nunca libre.
const CAM_LERP_SPEED = 4

function CameraController({ mode }) {
  const lerpPos    = useRef(CAM_POS.clone())
  const lerpLookAt = useRef(CAM_LOOKAT.clone())

  useFrame(({ camera }, delta) => {
    // Peleador 1 (izquierdo) → cámara desde la derecha mirando a la izquierda
    // Peleador 2 (derecho)   → cámara desde la izquierda mirando a la derecha
    const camZ    = mode === 'peleador1' ?  9 : -9
    const lookX   = mode === 'peleador1' ? -0.5 : 0.5  // leve sesgo hacia el fighter activo

    const t = 1 - Math.exp(-CAM_LERP_SPEED * delta)
    lerpPos.current.lerp(new THREE.Vector3(0, 1.6, camZ), t)
    lerpLookAt.current.lerp(new THREE.Vector3(lookX, 1.0, 0), t)

    camera.position.copy(lerpPos.current)
    camera.lookAt(lerpLookAt.current)
  })

  return null
}

/* ── Camera selector UI ── */
const camBtnBase = {
  padding: '6px 14px',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  background: 'rgba(10,10,20,0.7)',
  color: '#aab',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  backdropFilter: 'blur(8px)',
  transition: 'all 0.2s',
}
const camBtnActive = {
  ...camBtnBase,
  background: 'rgba(80,120,255,0.35)',
  color: '#fff',
  borderColor: 'rgba(100,140,255,0.6)',
  boxShadow: '0 0 10px rgba(80,120,255,0.3)',
}

function CameraSelector({ mode, setMode }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 6, zIndex: 20, userSelect: 'none',
    }}>
      {[{ key: 'peleador1', label: 'Peleador 1' }, { key: 'peleador2', label: 'Peleador 2' }].map(o => (
        <button
          key={o.key}
          onClick={() => setMode(o.key)}
          style={mode === o.key ? camBtnActive : camBtnBase}
          onMouseEnter={e => { if (mode !== o.key) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
          onMouseLeave={e => { if (mode !== o.key) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function BattleScene() {
  const { fighter1, fighter2, currentTurn, phase } = useGame()
  const [camMode, setCamMode] = useState('peleador1')
  const isCombatMode = phase === 'fighting'

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 9], fov: 50 }}
        gl={{ antialias: true, toneMapping: 3 }}
      >
        <color attach="background" args={['#050508']} />
        <Lights />
        <RingBase />
        <CameraController mode={camMode} />

        <FighterSprite
          key="fighter-left"
          position={POS_LEFT}
          opponentPosition={POS_RIGHT}
          side="left"
          portraitUrl={isCombatMode ? fighter1.portraitUrl : null}
          hp={fighter1.hp}
          maxHp={fighter1.maxHp}
          isAttacking={currentTurn}
          alive={fighter1.alive}
        />
        <FighterSprite
          key="fighter-right"
          position={POS_RIGHT}
          opponentPosition={POS_LEFT}
          side="right"
          portraitUrl={isCombatMode ? fighter2.portraitUrl : null}
          hp={fighter2.hp}
          maxHp={fighter2.maxHp}
          isAttacking={currentTurn}
          alive={fighter2.alive}
        />

        <ContactShadows position={[0, -0.19, 0]} opacity={0.6} scale={12} blur={2} far={5} />
        <Environment preset="night" />
        <fog attach="fog" args={['#050508', 14, 28]} />
      </Canvas>

      <CameraSelector mode={camMode} setMode={setCamMode} />
    </div>
  )
}
