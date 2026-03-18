import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'

const V = (arr) => `[${arr.join(', ')}]`

/* Small colored sphere to mark a world-space position */
function Marker({ position, color, label }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <span style={{
          color, fontSize: 10, fontFamily: 'monospace', background: 'rgba(0,0,0,0.7)',
          padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap',
        }}>{label}</span>
      </Html>
    </group>
  )
}

/* Axes helper at origin to visualize world-space orientation */
function OriginAxes() {
  return <axesHelper args={[2]} />
}

function formatFighter(label, f) {
  return [
    label,
    `  expectedPos: ${V(f.expectedPos)}`,
    `  worldPos:    ${V(f.worldPos)}`,
    `  bboxCenter:  ${V(f.bboxCenter)}`,
    `  bboxSize:    ${V(f.bboxSize)}`,
    `  cloneOffset: ${V(f.cloneInternalPos)}`,
    `  scale:       ${f.scale}`,
  ].join('\n')
}

function copyDebug(debugData) {
  const f1 = debugData.current?.left
  const f2 = debugData.current?.right
  const lines = ['=== SCENE DEBUG ===']
  if (f1) lines.push(formatFighter('Fighter LEFT (model1)', f1))
  if (f2) lines.push(formatFighter('Fighter RIGHT (model2)', f2))
  const text = lines.join('\n\n')
  navigator.clipboard.writeText(text)
}

/* On-screen debug overlay (rendered inside Canvas via Html) */
function DebugPanel({ debugData }) {
  const f1 = debugData.current?.left
  const f2 = debugData.current?.right

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        onClick={() => copyDebug(debugData)}
        style={{
          position: 'fixed', top: 8, left: 8, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace',
          fontSize: 11, padding: '8px 12px', borderRadius: 6, lineHeight: 1.6,
          border: '1px solid #0f03', maxWidth: 420, pointerEvents: 'auto', cursor: 'pointer',
          userSelect: 'none',
        }}
        title="Click to copy debug data"
      >
        <div style={{ color: '#ff0', fontWeight: 'bold', marginBottom: 4 }}>SCENE DEBUG <span style={{ color: '#888', fontWeight: 'normal' }}>(click to copy)</span></div>
        {f1 && (
          <div>
            <div style={{ color: '#f44' }}>--- Fighter LEFT (model1) ---</div>
            <div>expectedPos: {V(f1.expectedPos)}</div>
            <div>worldPos:    {V(f1.worldPos)}</div>
            <div>bboxCenter:  {V(f1.bboxCenter)}</div>
            <div>bboxSize:    {V(f1.bboxSize)}</div>
            <div>cloneOffset: {V(f1.cloneInternalPos)}</div>
            <div>scale:       {f1.scale}</div>
          </div>
        )}
        {f2 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ color: '#48f' }}>--- Fighter RIGHT (model2) ---</div>
            <div>expectedPos: {V(f2.expectedPos)}</div>
            <div>worldPos:    {V(f2.worldPos)}</div>
            <div>bboxCenter:  {V(f2.bboxCenter)}</div>
            <div>bboxSize:    {V(f2.bboxSize)}</div>
            <div>cloneOffset: {V(f2.cloneInternalPos)}</div>
            <div>scale:       {f2.scale}</div>
          </div>
        )}
        {!f1 && !f2 && <div>Waiting for data...</div>}
      </div>
    </Html>
  )
}

/* Refreshes the debug panel ~2x/sec */
function DebugUpdater({ debugData, panelRef }) {
  useFrame(() => {
    // Force re-render of Html by touching the ref — Html auto-updates
  })
  return null
}

const POS_LEFT = [-3, -0.2, 3]
const POS_RIGHT = [3, -0.2, -3]

export default function SceneDebug({ debugData }) {
  return (
    <>
      <OriginAxes />

      {/* Markers at expected fighter positions */}
      <Marker position={POS_LEFT} color="#ff4444" label="expected LEFT" />
      <Marker position={POS_RIGHT} color="#4488ff" label="expected RIGHT" />

      {/* Marker at world origin */}
      <Marker position={[0, 0, 0]} color="#ffff00" label="ORIGIN" />

      {/* Platform corners for reference */}
      <Marker position={[-5, 0, 5]} color="#444" label="corner" />
      <Marker position={[5, 0, 5]} color="#444" label="corner" />
      <Marker position={[-5, 0, -5]} color="#444" label="corner" />
      <Marker position={[5, 0, -5]} color="#444" label="corner" />

      {/* On-screen data panel */}
      <DebugPanel debugData={debugData} />
      <DebugUpdater debugData={debugData} />
    </>
  )
}
