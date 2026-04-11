import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Fighter from './Fighter'
import model1Url from '../assets/models/model1.glb?url'
import debugPortraitUrl from '../assets/images/candidates/cand_1257_00052615_diputado.webp'

const DEBUG_POSITION = [0, -0.2, 0]
const DEBUG_OPPONENT_POSITION = [0, -0.2, 3]
const INITIAL_DECAL_SIZE = { x: 0.22, y: 0.27, z: 0.15 }

function DebugLights() {
  return (
    <>
      <ambientLight intensity={0.5} color="#9fb3d1" />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.8}
        color="#fff2d9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[-4, 4, 6]} intensity={1.2} color="#44c8ff" distance={20} />
      <pointLight position={[4, 4, -4]} intensity={1.2} color="#ff7a59" distance={20} />
    </>
  )
}

function DebugArena() {
  return (
    <group position={[0, -0.55, 0]}>
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[2.6, 2.8, 0.3, 32]} />
        <meshStandardMaterial color="#172033" roughness={0.65} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#06070d" roughness={1} />
      </mesh>
      <gridHelper args={[10, 20, '#4f6a96', '#1a2438']} position={[0, 0.01, 0]} />
      <axesHelper args={[2]} position={[0, 0.02, 0]} />
    </group>
  )
}

function ControlRow({ label, value, min, max, step, onChange }) {
  return (
    <label className="debug-control">
      <span className="debug-control-label">{label}</span>
      <input
        className="debug-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        className="debug-number"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function formatVector(vector) {
  if (!vector) return 'n/a'
  return `${vector.x}, ${vector.y}, ${vector.z}`
}

export default function FaceDebugLab({ onExit }) {
  const [decalSize, setDecalSize] = useState(INITIAL_DECAL_SIZE)
  const [selectedBone, setSelectedBone] = useState('')
  const [showSprite, setShowSprite] = useState(true)
  const [showHelpers, setShowHelpers] = useState(true)
  const [debugData, setDebugData] = useState({
    availableBones: [],
    selectedBoneName: null,
    selectedOrientationBoneName: null,
    spriteVisible: true,
    boneWorldPosition: null,
    anchorLocalPosition: null,
    anchorWorldPosition: null,
  })

  const decalSizeProp = useMemo(
    () => [decalSize.x, decalSize.y, decalSize.z],
    [decalSize.x, decalSize.y, decalSize.z],
  )

  function resetControls() {
    setDecalSize(INITIAL_DECAL_SIZE)
    setSelectedBone('')
    setShowSprite(true)
    setShowHelpers(true)
  }

  return (
    <div className="debug-lab-shell">
      <div className="debug-lab-stage">
        <Canvas
          shadows
          camera={{ position: [0, 1.8, 4.6], fov: 35 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#05070d']} />
          <fog attach="fog" args={['#05070d', 8, 18]} />
          <DebugLights />
          <DebugArena />
          <Fighter
            modelPath={model1Url}
            position={DEBUG_POSITION}
            opponentPosition={DEBUG_OPPONENT_POSITION}
            side="left"
            portraitUrl={debugPortraitUrl}
            hp={100}
            isAttacking={null}
            alive
            showPortraitSprite={showSprite}
            decalSize={decalSizeProp}
            debugFaceBoneName={selectedBone || null}
            showDebugHelpers={showHelpers}
            onFaceDebugData={setDebugData}
          />
          <ContactShadows position={[0, -0.18, 0]} opacity={0.45} scale={10} blur={2.4} far={4} />
          <OrbitControls makeDefault enablePan={false} minDistance={2.2} maxDistance={8} target={[0, 1.05, 0]} />
          <Environment preset="studio" />
        </Canvas>
      </div>

      <aside className="debug-lab-panel">
        <div className="debug-lab-header">
          <div>
            <div className="setup-kicker">Dev Only</div>
            <h1 className="debug-lab-title">Face Decal Debug</h1>
            <p className="debug-lab-subtitle">
              model1.glb con imagen fija para ajustar el decal del rostro proyectado sobre el hueso HEAD.
            </p>
          </div>
          <button className="session-exit-btn" onClick={onExit}>
            Volver
          </button>
        </div>

        <div className="debug-lab-actions">
          <button className="session-exit-btn debug-secondary-btn" onClick={resetControls}>
            Reset
          </button>
          <label className="debug-toggle">
            <input type="checkbox" checked={showSprite} onChange={(event) => setShowSprite(event.target.checked)} />
            <span>Mostrar decal</span>
          </label>
          <label className="debug-toggle">
            <input type="checkbox" checked={showHelpers} onChange={(event) => setShowHelpers(event.target.checked)} />
            <span>Mostrar helpers</span>
          </label>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">Hueso</div>
          <select
            className="debug-select"
            value={selectedBone}
            onChange={(event) => setSelectedBone(event.target.value)}
          >
            <option value="">Auto ({debugData.selectedBoneName ?? 'sin detectar'})</option>
            {debugData.availableBones.map((boneName) => (
              <option key={boneName} value={boneName}>
                {boneName}
              </option>
            ))}
          </select>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">Tamaño del Decal</div>
          <ControlRow label="Ancho (X)" value={decalSize.x} min={0.05} max={0.6} step={0.005} onChange={(value) => setDecalSize((s) => ({ ...s, x: value }))} />
          <ControlRow label="Alto (Y)" value={decalSize.y} min={0.05} max={0.6} step={0.005} onChange={(value) => setDecalSize((s) => ({ ...s, y: value }))} />
          <ControlRow label="Prof. (Z)" value={decalSize.z} min={0.01} max={0.4} step={0.005} onChange={(value) => setDecalSize((s) => ({ ...s, z: value }))} />
        </div>

        <div className="debug-section">
          <div className="debug-section-title">Lecturas</div>
          <div className="debug-readout-grid">
            <div className="debug-readout-card">
              <span className="debug-readout-label">Decal visible</span>
              <span className="debug-readout-value">{debugData.spriteVisible ? 'si' : 'no'}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Hueso activo</span>
              <span className="debug-readout-value">{debugData.selectedBoneName ?? 'n/a'}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Hueso orientacion</span>
              <span className="debug-readout-value">{debugData.selectedOrientationBoneName ?? 'n/a'}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Decal local pos</span>
              <span className="debug-readout-value">{formatVector(debugData.anchorLocalPosition)}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Bone world</span>
              <span className="debug-readout-value">{formatVector(debugData.boneWorldPosition)}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Imagen</span>
              <span className="debug-readout-value">cand_1257_00052615_diputado.webp</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
