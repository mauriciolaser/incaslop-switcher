import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import Fighter from './Fighter'
import { useGame } from '../context/GameContext'
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

export default function BattleScene() {
  const { fighter1, fighter2, currentTurn } = useGame()

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

        <Fighter
          key="fighter-left"
          modelPath={model1Url}
          position={POS_LEFT}
          opponentPosition={POS_RIGHT}
          side="left"
          hp={fighter1.hp}
          maxHp={fighter1.maxHp}
          isAttacking={currentTurn}
          alive={fighter1.alive}
        />
        <Fighter
          key="fighter-right"
          modelPath={model2Url}
          position={POS_RIGHT}
          opponentPosition={POS_LEFT}
          side="right"
          hp={fighter2.hp}
          maxHp={fighter2.maxHp}
          isAttacking={currentTurn}
          alive={fighter2.alive}
        />

        <ContactShadows
          position={[0, -0.19, 0]}
          opacity={0.5}
          scale={14}
          blur={2}
          far={6}
        />

        <OrbitControls
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
    </div>
  )
}
