import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import FighterSprite from './FighterSprite'
import { useGame } from '../context/GameContext'

// Perspectiva estilo Pokémon:
// - Player 1 (izquierda): cerca de la cámara, grande, visto DE ESPALDAS
// - Player 2 (rival): lejos de la cámara, más pequeño, de frente
//
// La cámara está detrás y encima del player 1, mirando hacia el rival.
// Usamos el eje Z para profundidad: player 1 en Z cercano, rival en Z lejano.

const POS_LEFT  = [-1.2, -0.2,  1.5]   // player 1: cerca de cámara, ligeramente izquierda
const POS_RIGHT = [ 1.8, -0.2, -2.5]   // rival: lejos, ligeramente derecha

// Cámara detrás del player 1, ligeramente elevada — perspectiva Pokémon clásica
const CAM_POS    = new THREE.Vector3(-0.8, 2.2, 5.5)
const CAM_LOOKAT = new THREE.Vector3(1.0, 0.8, -2.0)

function RingBase() {
  return (
    <group position={[0, -0.5, 0]}>
      {/* Plataforma principal */}
      <mesh position={[0, 0.15, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[10, 0.3, 10]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Borde exterior */}
      <mesh position={[0, 0.01, -0.5]} receiveShadow castShadow>
        <boxGeometry args={[10.4, 0.3, 10.4]} />
        <meshStandardMaterial color="#0d1b2a" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Marca de posición player 1 */}
      <mesh position={[POS_LEFT[0], 0.31, POS_LEFT[2]]}>
        <cylinderGeometry args={[0.45, 0.45, 0.02, 16]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff2200" emissiveIntensity={0.6} />
      </mesh>
      {/* Marca de posición rival */}
      <mesh position={[POS_RIGHT[0], 0.31, POS_RIGHT[2]]}>
        <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#2244ff" emissive="#0022ff" emissiveIntensity={0.6} />
      </mesh>
      {/* Suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, -0.5]}>
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
      {/* Spotlight sobre player 1 (cerca) */}
      <spotLight position={[POS_LEFT[0], 8, POS_LEFT[2] + 2]}  angle={0.5} penumbra={0.7} intensity={5} color="#ff4422" castShadow distance={20} decay={1.5} />
      {/* Spotlight sobre rival (lejos) */}
      <spotLight position={[POS_RIGHT[0], 8, POS_RIGHT[2] - 1]} angle={0.5} penumbra={0.7} intensity={5} color="#2244ff" castShadow distance={20} decay={1.5} />
      <pointLight position={[0, 6, 0]}  intensity={2.5} color="#ffffff" distance={20} decay={1.5} />
      <pointLight position={[0, 3, 4]}  intensity={1.2} color="#445566" distance={16} decay={2} />
    </>
  )
}

// Cámara fija estilo Pokémon — detrás del player 1
function CameraController() {
  const lerpPos    = useRef(CAM_POS.clone())
  const lerpLookAt = useRef(CAM_LOOKAT.clone())

  useFrame(({ camera }, delta) => {
    const t = 1 - Math.exp(-5 * delta)
    lerpPos.current.lerp(CAM_POS, t)
    lerpLookAt.current.lerp(CAM_LOOKAT, t)

    camera.position.copy(lerpPos.current)
    camera.lookAt(lerpLookAt.current)
  })

  return null
}

export default function BattleScene() {
  const { fighter1, fighter2, currentTurn, phase } = useGame()
  const showFighters = phase === 'fighting'

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas
        shadows
        camera={{ position: CAM_POS.toArray(), fov: 55 }}
        gl={{ antialias: true, toneMapping: 3 }}
      >
        <color attach="background" args={['#050508']} />
        <Lights />
        <RingBase />
        <CameraController />

        {showFighters && (
          <>
            {/* Player 1: cerca de cámara, GRANDE, de ESPALDAS */}
            <FighterSprite
              key="fighter-left"
              position={POS_LEFT}
              opponentPosition={POS_RIGHT}
              side="left"
              portraitUrl={fighter1.portraitUrl}
              hp={fighter1.hp}
              maxHp={fighter1.maxHp}
              isAttacking={currentTurn}
              alive={fighter1.alive}
              scale={1.7}
              facingCamera={true}
            />

            {/* Rival: lejos de cámara, PEQUEÑO, de FRENTE */}
            <FighterSprite
              key="fighter-right"
              position={POS_RIGHT}
              opponentPosition={POS_LEFT}
              side="right"
              portraitUrl={fighter2.portraitUrl}
              hp={fighter2.hp}
              maxHp={fighter2.maxHp}
              isAttacking={currentTurn}
              alive={fighter2.alive}
              scale={1.0}
              facingCamera={false}
            />
          </>
        )}

        <ContactShadows position={[0, -0.19, 0]} opacity={0.6} scale={14} blur={2} far={6} />
        <Environment preset="night" />
        <fog attach="fog" args={['#050508', 16, 32]} />
      </Canvas>
    </div>
  )
}
