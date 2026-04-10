import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

function configurePixelTexture(texture) {
  if (!texture) return
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

function createFallbackFaceTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#1a1f2d'
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = '#2a3348'
    for (let y = 0; y < 32; y += 4) {
      ctx.fillRect(0, y, 32, 2)
    }
    ctx.fillStyle = '#8ea5cf'
    ctx.fillRect(8, 11, 5, 3)
    ctx.fillRect(19, 11, 5, 3)
    ctx.fillRect(12, 20, 8, 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  configurePixelTexture(texture)
  return texture
}

export default function Fighter({ modelPath, position, opponentPosition, side, portraitUrl, hp, isAttacking, alive }) {
  // Inner group ref — only used for animation OFFSETS (relative to [0,0,0])
  const animRef = useRef()
  const { scene } = useGLTF(modelPath)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const deathRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const facePlateRef = useRef()
  const faceBoneRef = useRef(null)
  const boneWorldPosRef = useRef(new THREE.Vector3())
  const boneWorldQuatRef = useRef(new THREE.Quaternion())
  const parentWorldQuatRef = useRef(new THREE.Quaternion())
  const localFaceQuatRef = useRef(new THREE.Quaternion())

  const fallbackTexture = useMemo(() => createFallbackFaceTexture(), [])
  const [portraitTexture, setPortraitTexture] = useState(fallbackTexture)
  const portraitTextureRef = useRef(portraitTexture)

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
  }, [scene])

  useEffect(() => {
    let headFront = null
    let head = null

    clonedScene.traverse((node) => {
      if (!node.isBone) return
      const lowered = node.name.toLowerCase()
      if (lowered === 'headfront') {
        headFront = node
      } else if (lowered === 'head') {
        head = node
      }
    })

    faceBoneRef.current = headFront ?? head ?? null
  }, [clonedScene])

  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()

    if (!portraitUrl) {
      queueMicrotask(() => {
        if (cancelled) return
        setPortraitTexture((current) => {
          if (current && current !== fallbackTexture) current.dispose()
          return fallbackTexture
        })
      })
      return () => {
        cancelled = true
      }
    }

    loader.load(
      portraitUrl,
      (texture) => {
        configurePixelTexture(texture)
        if (cancelled) {
          texture.dispose()
          return
        }
        setPortraitTexture((current) => {
          if (current && current !== fallbackTexture) current.dispose()
          return texture
        })
      },
      undefined,
      () => {
        if (cancelled) return
        setPortraitTexture((current) => {
          if (current && current !== fallbackTexture) current.dispose()
          return fallbackTexture
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [portraitUrl, fallbackTexture])

  useEffect(() => {
    portraitTextureRef.current = portraitTexture
  }, [portraitTexture])

  useEffect(() => () => {
    const currentPortrait = portraitTextureRef.current
    if (currentPortrait && currentPortrait !== fallbackTexture) {
      currentPortrait.dispose()
    }
    fallbackTexture.dispose()
  }, [fallbackTexture])

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

  function updateFacePlate() {
    if (!animRef.current || !facePlateRef.current || !faceBoneRef.current) return

    const facePlate = facePlateRef.current
    const bone = faceBoneRef.current
    const bonePos = boneWorldPosRef.current
    const boneQuat = boneWorldQuatRef.current
    const parentQuat = parentWorldQuatRef.current
    const localFaceQuat = localFaceQuatRef.current

    bone.getWorldPosition(bonePos)
    animRef.current.worldToLocal(bonePos)
    facePlate.position.copy(bonePos)

    bone.getWorldQuaternion(boneQuat)
    animRef.current.getWorldQuaternion(parentQuat)
    localFaceQuat.copy(parentQuat).invert().multiply(boneQuat)
    facePlate.quaternion.copy(localFaceQuat)
    facePlate.translateZ(0.015)
  }

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
      updateFacePlate()
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
    updateFacePlate()
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
        <group ref={facePlateRef}>
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[0.145, 0.178]} />
            <meshBasicMaterial color="#0c111c" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.128, 0.16]} />
            <meshBasicMaterial map={portraitTexture} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
