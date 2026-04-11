import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const FACE_BONE_PRIORITY = ['headfront', 'head', 'head_end', 'neck']
const FACE_SPRITE_OFFSET = new THREE.Vector3(0, 0.008, 0.05)

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

export default function Fighter({
  modelPath,
  position,
  opponentPosition,
  side,
  portraitUrl,
  hp,
  isAttacking,
  alive,
  showPortraitSprite = true,
}) {
  // Inner group ref — only used for animation OFFSETS (relative to [0,0,0])
  const animRef = useRef()
  const { scene } = useGLTF(modelPath)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const deathRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const faceAnchorRef = useRef()
  const faceBoneRef = useRef(null)
  const boneWorldPosRef = useRef(new THREE.Vector3())
  const boneWorldQuatRef = useRef(new THREE.Quaternion())
  const faceOffsetWorldRef = useRef(new THREE.Vector3())
  const faceLocalPosRef = useRef(new THREE.Vector3())

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
    let bestFaceBone = null
    let bestPriority = FACE_BONE_PRIORITY.length

    clonedScene.traverse((node) => {
      if (!node.isBone) return
      const lowered = node.name.toLowerCase()
      const priority = FACE_BONE_PRIORITY.findIndex(
        (boneName) => lowered === boneName || lowered.includes(boneName),
      )

      if (priority !== -1 && priority < bestPriority) {
        bestPriority = priority
        bestFaceBone = node
      }
    })

    faceBoneRef.current = bestFaceBone
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

  function updateFaceSprite() {
    if (!animRef.current || !faceAnchorRef.current) return

    const faceAnchor = faceAnchorRef.current
    const bone = faceBoneRef.current
    const bonePos = boneWorldPosRef.current
    const boneQuat = boneWorldQuatRef.current

    if (!bone || !showPortraitSprite) {
      faceAnchor.visible = false
      return
    }

    bone.getWorldPosition(bonePos)
    bone.getWorldQuaternion(boneQuat)

    const faceOffset = faceOffsetWorldRef.current
      .copy(FACE_SPRITE_OFFSET)
      .applyQuaternion(boneQuat)

    const localFacePos = faceLocalPosRef.current.copy(bonePos).add(faceOffset)
    animRef.current.worldToLocal(localFacePos)

    faceAnchor.visible = true
    faceAnchor.position.copy(localFacePos)
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
      updateFaceSprite()
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
    updateFaceSprite()
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
        {showPortraitSprite && (
          <group ref={faceAnchorRef}>
            <sprite scale={[0.22, 0.27, 1]} renderOrder={10}>
              <spriteMaterial
                color="#0c111c"
                opacity={0.92}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
            <sprite scale={[0.19, 0.235, 1]} renderOrder={11}>
              <spriteMaterial
                map={portraitTexture}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          </group>
        )}
      </group>
    </group>
  )
}
