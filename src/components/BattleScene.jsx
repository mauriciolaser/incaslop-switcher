import { useState, useEffect, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import Fighter from './Fighter'
import { useGame } from '../context/GameContext'
import { getCachedModelUrl } from '../utils/modelCache'
import model1Url from '../assets/models/model1.glb?url'
import model2Url from '../assets/models/model2.glb?url'

const RING_SIZE = 5
const CORNER = 3

// Diagonal opposite corners — fighter1 front-left, fighter2 back-right
const POS_LEFT = [-CORNER, -0.2, CORNER]
const POS_RIGHT = [CORNER, -0.2, -CORNER]

function RingBase() {
  return (
    <group position={[0, -0.5, 0]}>
      {/* Main platform */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[RING_SIZE * 2, 0.3, RING_SIZE * 2]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Platform edge trim */}
      <mesh position={[0, 0.01, 0]} receiveShadow castShadow>
        <boxGeometry args={[RING_SIZE * 2 + 0.3, 0.3, RING_SIZE * 2 + 0.3]} />
        <meshStandardMaterial color="#0d1b2a" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Corner accent - red */}
      <mesh position={[-CORNER, 0.31, CORNER]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff2200" emissiveIntensity={0.5} />
      </mesh>
      {/* Corner accent - blue */}
      <mesh position={[CORNER, 0.31, -CORNER]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#2244ff" emissive="#0022ff" emissiveIntensity={0.5} />
      </mesh>
      {/* Ground below */}
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
      <ambientLight intensity={0.2} color="#8899bb" />

      {/* Key light */}
      <directionalLight
        position={[2, 12, 6]}
        intensity={1.5}
        color="#ffeedd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />

      {/* Red corner spotlight */}
      <spotLight
        position={[-CORNER, 8, CORNER]}
        angle={0.6}
        penumbra={0.7}
        intensity={4}
        color="#ff4422"
        castShadow
        distance={20}
        decay={1.5}
      />

      {/* Blue corner spotlight */}
      <spotLight
        position={[CORNER, 8, -CORNER]}
        angle={0.6}
        penumbra={0.7}
        intensity={4}
        color="#2244ff"
        castShadow
        distance={20}
        decay={1.5}
      />

      {/* Center top */}
      <pointLight position={[0, 8, 0]} intensity={2.5} color="#ffffff" distance={20} decay={1.5} />

      {/* Rim lights for depth */}
      <pointLight position={[-6, 4, -6]} intensity={1} color="#6644aa" distance={18} decay={2} />
      <pointLight position={[6, 4, 6]} intensity={1} color="#aa4466" distance={18} decay={2} />

      {/* Front fill */}
      <pointLight position={[0, 2, 10]} intensity={0.6} color="#445566" distance={18} decay={2} />
    </>
  )
}

/* ── Over-the-shoulder camera parameters ── */
const CAM_BACK = 1.6      // distance behind fighter
const CAM_SHOULDER = 0.5   // right-shoulder offset
const CAM_HEIGHT = 1.6     // camera Y
const CAM_LOOK_HEIGHT = 0.8 // look-at Y on opponent
const CAM_LERP_SPEED = 4

function CameraController({ mode, orbitRef }) {
  const { camera } = useThree()
  const lerpPos = useRef(new THREE.Vector3())
  const lerpLookAt = useRef(new THREE.Vector3())
  const needsInit = useRef(true)

  // When switching TO a fighter cam, snapshot current camera state for smooth transition
  useEffect(() => {
    if (mode !== 'libre') {
      lerpPos.current.copy(camera.position)
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      lerpLookAt.current.copy(camera.position).add(dir.multiplyScalar(5))
      needsInit.current = false
    } else {
      // Switching back to libre — re-enable orbit
      needsInit.current = true
      if (orbitRef.current) {
        orbitRef.current.target.set(0, 0.5, 0)
        orbitRef.current.enabled = true
        orbitRef.current.update()
      }
    }
  }, [camera, mode, orbitRef])

  useFrame((_, delta) => {
    if (mode === 'libre') return

    // Disable orbit while in fixed cam
    if (orbitRef.current) orbitRef.current.enabled = false

    const fighterPos = mode === 'peleador1' ? POS_LEFT : POS_RIGHT
    const opponentPos = mode === 'peleador1' ? POS_RIGHT : POS_LEFT

    // Forward direction (fighter → opponent)
    const dx = opponentPos[0] - fighterPos[0]
    const dz = opponentPos[2] - fighterPos[2]
    const len = Math.sqrt(dx * dx + dz * dz)
    const fwdX = dx / len
    const fwdZ = dz / len

    // Right = cross(up, forward) → [fwdZ, 0, -fwdX]
    const rightX = fwdZ
    const rightZ = -fwdX

    const targetX = fighterPos[0] - fwdX * CAM_BACK + rightX * CAM_SHOULDER
    const targetY = CAM_HEIGHT
    const targetZ = fighterPos[2] - fwdZ * CAM_BACK + rightZ * CAM_SHOULDER

    const lookX = opponentPos[0]
    const lookY = CAM_LOOK_HEIGHT
    const lookZ = opponentPos[2]

    const t = 1 - Math.exp(-CAM_LERP_SPEED * delta)
    lerpPos.current.lerp(new THREE.Vector3(targetX, targetY, targetZ), t)
    lerpLookAt.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), t)

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
  const options = [
    { key: 'libre', label: 'Libre' },
    { key: 'peleador1', label: 'Peleador 1' },
    { key: 'peleador2', label: 'Peleador 2' },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 6, zIndex: 20, userSelect: 'none',
    }}>
      {options.map(o => (
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
  const { fighter1, fighter2, currentTurn } = useGame()
  const [cachedUrls, setCachedUrls] = useState(null)
  const [camMode, setCamMode] = useState('libre')
  const orbitRef = useRef()

  useEffect(() => {
    let revoke = []
    Promise.all([getCachedModelUrl(model1Url), getCachedModelUrl(model2Url)])
      .then(([url1, url2]) => {
        revoke = [url1, url2].filter(u => u.startsWith('blob:'))
        setCachedUrls({ model1: url1, model2: url2 })
      })
    return () => revoke.forEach(u => URL.revokeObjectURL(u))
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas
        shadows
        camera={{ position: [0, 5, 11], fov: 45 }}
        gl={{ antialias: true, toneMapping: 3 }}
      >
        <color attach="background" args={['#050508']} />
        <Lights />
        <RingBase />

        <CameraController mode={camMode} orbitRef={orbitRef} />

        {cachedUrls && (
          <>
            <Fighter
              key="fighter-left"
              modelPath={cachedUrls.model1}
              position={POS_LEFT}
              opponentPosition={POS_RIGHT}
              side="left"
              portraitUrl={fighter1.portraitUrl}
              hp={fighter1.hp}
              maxHp={fighter1.maxHp}
              isAttacking={currentTurn}
              alive={fighter1.alive}
            />
            <Fighter
              key="fighter-right"
              modelPath={cachedUrls.model2}
              position={POS_RIGHT}
              opponentPosition={POS_LEFT}
              side="right"
              portraitUrl={fighter2.portraitUrl}
              hp={fighter2.hp}
              maxHp={fighter2.maxHp}
              isAttacking={currentTurn}
              alive={fighter2.alive}
            />
          </>
        )}

        <ContactShadows
          position={[0, -0.19, 0]}
          opacity={0.5}
          scale={14}
          blur={2}
          far={6}
        />

        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          enableZoom={true}
          minDistance={6}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 8}
          target={[0, 0.5, 0]}
        />
        <Environment preset="night" />
        <fog attach="fog" args={['#050508', 16, 32]} />
      </Canvas>

      <CameraSelector mode={camMode} setMode={setCamMode} />
    </div>
  )
}
