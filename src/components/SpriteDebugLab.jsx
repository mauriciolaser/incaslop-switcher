import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import FighterSprite from './FighterSprite'
import spriteMeta from '../assets/sprites/fighter_base.json'

// Importar todos los retratos locales en tiempo de compilación
const allPortraits = import.meta.glob(
  '../assets/images/candidates/*.webp',
  { eager: true, query: '?url', import: 'default' },
)

const PORTRAIT_LIST = Object.entries(allPortraits)
  .map(([path, url]) => {
    const filename = path.split('/').pop()
    return { filename, url }
  })
  .sort((a, b) => a.filename.localeCompare(b.filename))

const FRAME_NAMES = spriteMeta.frames.map(f => f.name)

const DEBUG_POS      = [0, -0.2, 0]
const OPPONENT_POS   = [0, -0.2, 4]

function DebugLights() {
  return (
    <>
      <ambientLight intensity={0.5} color="#9fb3d1" />
      <directionalLight position={[3, 8, 6]} intensity={2} color="#fff2d9" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-far={20}
        shadow-camera-left={-4} shadow-camera-right={4}
        shadow-camera-top={4} shadow-camera-bottom={-4} />
      <pointLight position={[-3, 4, 4]} intensity={1.5} color="#44c8ff" distance={16} />
      <pointLight position={[3, 4, -2]} intensity={1.5} color="#ff7a59" distance={16} />
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
      <gridHelper args={[8, 16, '#4f6a96', '#1a2438']} position={[0, 0.01, 0]} />
    </group>
  )
}

export default function SpriteDebugLab({ onExit }) {
  const [portraitIndex, setPortraitIndex] = useState(0)
  const [frameOverride, setFrameOverride] = useState('auto')
  const [showFace, setShowFace] = useState(true)
  const [side, setSide] = useState('left')

  const portrait = PORTRAIT_LIST[portraitIndex]

  // Para el override de frame usamos props ficticias que fuerzan el estado
  const isAttacking = frameOverride === 'attack_a' || frameOverride === 'attack_b' ? side : null
  const alive       = frameOverride !== 'death'
  const hp          = frameOverride === 'hit' ? 50 : 100

  // Cuando frameOverride es 'auto', dejamos que FighterSprite decida
  const debugPortraitUrl = showFace ? portrait.url : null

  return (
    <div className="debug-lab-shell">
      <div className="debug-lab-stage">
        <Canvas
          shadows
          camera={{ position: [0, 1.8, 5.5], fov: 38 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#05070d']} />
          <fog attach="fog" args={['#05070d', 8, 18]} />
          <DebugLights />
          <DebugArena />

          <FighterSprite
            position={DEBUG_POS}
            opponentPosition={OPPONENT_POS}
            side={side}
            portraitUrl={debugPortraitUrl}
            hp={hp}
            isAttacking={isAttacking}
            alive={alive}
            _forceFrame={frameOverride !== 'auto' ? frameOverride : undefined}
          />

          <ContactShadows position={[0, -0.18, 0]} opacity={0.5} scale={8} blur={2} far={4} />
          <Environment preset="studio" />
        </Canvas>
      </div>

      <aside className="debug-lab-panel">
        <div className="debug-lab-header">
          <div>
            <div className="setup-kicker">Dev Only</div>
            <h1 className="debug-lab-title">Sprite Debug</h1>
            <p className="debug-lab-subtitle">
              Prueba el spritesheet con diferentes candidatos y estados.
            </p>
          </div>
          <button className="session-exit-btn" onClick={onExit}>Volver</button>
        </div>

        <div className="debug-lab-actions">
          <label className="debug-toggle">
            <input type="checkbox" checked={showFace}
              onChange={e => setShowFace(e.target.checked)} />
            <span>Mostrar cara</span>
          </label>
          <label className="debug-toggle">
            <input type="checkbox" checked={side === 'right'}
              onChange={e => setSide(e.target.checked ? 'right' : 'left')} />
            <span>Lado derecho (espejear)</span>
          </label>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">Frame</div>
          <select className="debug-select" value={frameOverride}
            onChange={e => setFrameOverride(e.target.value)}>
            <option value="auto">Auto (animación)</option>
            {FRAME_NAMES.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">
            Candidato ({portraitIndex + 1} / {PORTRAIT_LIST.length})
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button className="session-exit-btn debug-secondary-btn"
              onClick={() => setPortraitIndex(i => Math.max(0, i - 1))}>
              ← Anterior
            </button>
            <button className="session-exit-btn debug-secondary-btn"
              onClick={() => setPortraitIndex(i => Math.min(PORTRAIT_LIST.length - 1, i + 1))}>
              Siguiente →
            </button>
          </div>
          <select className="debug-select" value={portraitIndex}
            onChange={e => setPortraitIndex(Number(e.target.value))}>
            {PORTRAIT_LIST.map(({ filename }, i) => (
              <option key={filename} value={i}>{filename}</option>
            ))}
          </select>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">Lecturas</div>
          <div className="debug-readout-grid">
            <div className="debug-readout-card">
              <span className="debug-readout-label">Frame activo</span>
              <span className="debug-readout-value">{frameOverride}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Lado</span>
              <span className="debug-readout-value">{side}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Cara</span>
              <span className="debug-readout-value">{showFace ? 'visible' : 'oculta'}</span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">Imagen</span>
              <span className="debug-readout-value" style={{ fontSize: 9, wordBreak: 'break-all' }}>
                {portrait.filename}
              </span>
            </div>
            <div className="debug-readout-card">
              <span className="debug-readout-label">faceRegion</span>
              <span className="debug-readout-value">
                {spriteMeta.faceRegion.x},{spriteMeta.faceRegion.y} {spriteMeta.faceRegion.w}×{spriteMeta.faceRegion.h}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
