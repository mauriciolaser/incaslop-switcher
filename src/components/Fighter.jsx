import { useRef, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

export default function Fighter({ modelPath, position, opponentPosition, side, hp, maxHp, isAttacking, alive }) {
  // Inner group ref — only used for animation OFFSETS (relative to [0,0,0])
  const animRef = useRef()
  const { scene } = useGLTF(modelPath)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const deathRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)

  // Deep clone with SkeletonUtils (properly re-binds bones for SkinnedMesh)
  const clonedScene = useMemo(() => {
    const clone = skeletonClone(scene)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material = child.material.clone()
        }
      }
    })
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
  })

  const fighterScale = side === 'left' ? 1.0 : 0.95

  return (
    // Outer group: base position — never touched by useFrame
    <group position={position}>
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
