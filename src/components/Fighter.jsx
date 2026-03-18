import { useRef, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Box3, Vector3 } from 'three'

export default function Fighter({ modelPath, position, opponentPosition, side, hp, maxHp, isAttacking, alive, onDebug }) {
  const outerRef = useRef()
  // Inner group ref — only used for animation OFFSETS (relative to [0,0,0])
  const animRef = useRef()
  const { scene } = useGLTF(modelPath)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const deathRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const debugFrameRef = useRef(0)

  // Log full scene hierarchy on first load
  useEffect(() => {
    const logHierarchy = (obj, indent = '') => {
      const pos = `pos(${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`
      const scl = `scl(${obj.scale.x.toFixed(2)}, ${obj.scale.y.toFixed(2)}, ${obj.scale.z.toFixed(2)})`
      const type = obj.isMesh ? 'Mesh' : obj.isGroup ? 'Group' : obj.type
      console.log(`${indent}[${type}] "${obj.name || '(no name)'}" ${pos} ${scl}`)
      obj.children.forEach(c => logHierarchy(c, indent + '  '))
    }
    console.log(`%c=== GLB HIERARCHY: ${side} ===`, 'color: yellow; font-weight: bold')
    logHierarchy(scene)
  }, [scene, side])

  // Deep clone with independent materials, centered at origin
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material = child.material.clone()
        }
      }
    })
    // Center the model geometry so it sits at the group's origin
    const box = new Box3().setFromObject(clone)
    const center = new Vector3()
    box.getCenter(center)
    clone.position.set(-center.x, -box.min.y, -center.z)

    console.log(`%c[${side}] clone center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})  min.y: ${box.min.y.toFixed(2)}  final offset: (${clone.position.x.toFixed(2)}, ${clone.position.y.toFixed(2)}, ${clone.position.z.toFixed(2)})`, 'color: cyan')

    return clone
  }, [scene, side])

  // Direction toward opponent (normalized)
  const dir = useMemo(() => {
    const dx = opponentPosition[0] - position[0]
    const dz = opponentPosition[2] - position[2]
    const len = Math.sqrt(dx * dx + dz * dz)
    return { x: dx / len, z: dz / len, angle: Math.atan2(dx, dz) }
  }, [position, opponentPosition])

  useEffect(() => {
    if (hp < prevHpRef.current) {
      hitFlashRef.current = 1
    }
    prevHpRef.current = hp
  }, [hp])

  useEffect(() => {
    if (isAttacking === side) {
      shakeRef.current = 0
    }
  }, [isAttacking, side])

  // Animation loop — only sets OFFSETS on the inner group (relative to 0,0,0)
  useFrame((_, delta) => {
    if (!animRef.current) return
    timeRef.current += delta

    // Death animation
    if (!alive) {
      deathRef.current = Math.min(deathRef.current + delta * 2, 1)
      animRef.current.rotation.z = side === 'left'
        ? -deathRef.current * Math.PI * 0.5
        : deathRef.current * Math.PI * 0.5
      animRef.current.position.set(0, -deathRef.current * 0.5, 0)
      return
    }

    deathRef.current = 0
    animRef.current.rotation.z = 0

    // Idle bounce
    const bobY = Math.sin(timeRef.current * 3) * 0.04

    // Lateral sway perpendicular to facing direction
    const sway = Math.sin(timeRef.current * 1.5) * 0.03
    let ox = -dir.z * sway
    let oz = dir.x * sway

    // Attack lunge toward opponent
    if (isAttacking === side) {
      shakeRef.current += delta * 4
      if (shakeRef.current < 1) {
        const lunge = Math.sin(shakeRef.current * Math.PI) * 1.2
        ox += dir.x * lunge
        oz += dir.z * lunge
      }
    } else if (isAttacking && isAttacking !== side) {
      // Recoil away from opponent
      if (hitFlashRef.current > 0) {
        hitFlashRef.current = Math.max(0, hitFlashRef.current - delta * 4)
        const recoil = Math.sin(hitFlashRef.current * 20) * 0.12 * hitFlashRef.current
        ox -= dir.x * recoil
        oz -= dir.z * recoil
      }
    }

    animRef.current.position.set(ox, bobY, oz)

    // Debug reporting (every ~30 frames to avoid spam)
    if (onDebug && outerRef.current) {
      debugFrameRef.current++
      if (debugFrameRef.current % 30 === 0) {
        const worldPos = new Vector3()
        outerRef.current.getWorldPosition(worldPos)

        const box = new Box3().setFromObject(outerRef.current)
        const bboxCenter = new Vector3()
        const bboxSize = new Vector3()
        box.getCenter(bboxCenter)
        box.getSize(bboxSize)

        onDebug({
          side,
          expectedPos: position,
          worldPos: [+worldPos.x.toFixed(2), +worldPos.y.toFixed(2), +worldPos.z.toFixed(2)],
          bboxCenter: [+bboxCenter.x.toFixed(2), +bboxCenter.y.toFixed(2), +bboxCenter.z.toFixed(2)],
          bboxSize: [+bboxSize.x.toFixed(2), +bboxSize.y.toFixed(2), +bboxSize.z.toFixed(2)],
          cloneInternalPos: clonedScene.position.toArray().map(v => +v.toFixed(2)),
          scale: fighterScale,
        })
      }
    }
  })

  const fighterScale = side === 'left' ? 1.0 : 0.95

  const debugColor = side === 'left' ? '#ff0000' : '#0000ff'

  return (
    // Outer group: base position — never touched by useFrame
    <group ref={outerRef} position={position}>
      {/* DEBUG: visible cube at group origin to confirm position */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshBasicMaterial color={debugColor} wireframe={false} transparent opacity={0.7} />
      </mesh>
      {/* DEBUG: tall pole from group origin */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2, 6]} />
        <meshBasicMaterial color={debugColor} />
      </mesh>
      {/* Inner group: animation offsets only */}
      <group ref={animRef}>
        <primitive
          object={clonedScene}
          scale={fighterScale}
          rotation={[0, dir.angle, 0]}
        />
      </group>
    </group>
  )
}
