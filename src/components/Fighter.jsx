import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const FACE_BONE_PRIORITY = ['headfront', 'head', 'head_end', 'neck']
const FACE_ORIENTATION_BONE_PRIORITY = ['head', 'headfront', 'neck']
const DEFAULT_FACE_SPRITE_OFFSET = [0, 0.008, 0.05]
const DEFAULT_FACE_IMAGE_SCALE = [0.19, 0.235]
const DEFAULT_FACE_ROTATION_OFFSET = [-Math.PI / 2, 0, 0]
const FACE_SURFACE_NUDGE = 0.003

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
  faceSpriteOffset = DEFAULT_FACE_SPRITE_OFFSET,
  faceLocalPosition = null,
  faceImageScale = DEFAULT_FACE_IMAGE_SCALE,
  faceRotationOffset = DEFAULT_FACE_ROTATION_OFFSET,
  debugFaceBoneName = null,
  showDebugHelpers = false,
  onFaceDebugData,
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
  const faceOrientationBoneRef = useRef(null)
  const faceBoneNamesRef = useRef([])
  const boneWorldPosRef = useRef(new THREE.Vector3())
  const boneWorldQuatRef = useRef(new THREE.Quaternion())
  const parentWorldQuatRef = useRef(new THREE.Quaternion())
  const localFaceQuatRef = useRef(new THREE.Quaternion())
  const faceOffsetWorldRef = useRef(new THREE.Vector3())
  const faceLocalPosRef = useRef(new THREE.Vector3())
  const boneLocalPosRef = useRef(new THREE.Vector3())
  const faceOffsetRef = useRef(new THREE.Vector3(...faceSpriteOffset))
  const faceLocalPositionRef = useRef(faceLocalPosition ? new THREE.Vector3(...faceLocalPosition) : null)
  const faceBoneMarkerRef = useRef()
  const faceAnchorWorldPosRef = useRef(new THREE.Vector3())
  const debugEmitElapsedRef = useRef(0)

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
    faceOffsetRef.current.set(...faceSpriteOffset)
  }, [faceSpriteOffset])

  useEffect(() => {
    faceLocalPositionRef.current = faceLocalPosition
      ? new THREE.Vector3(...faceLocalPosition)
      : null
  }, [faceLocalPosition])

  useEffect(() => {
    let bestFaceBone = null
    let bestPriority = FACE_BONE_PRIORITY.length
    let bestOrientationBone = null
    let bestOrientationPriority = FACE_ORIENTATION_BONE_PRIORITY.length
    const availableBones = []

    clonedScene.traverse((node) => {
      if (!node.isBone) return
      const lowered = node.name.toLowerCase()
      availableBones.push(node.name)
      const priority = FACE_BONE_PRIORITY.findIndex(
        (boneName) => lowered === boneName || lowered.includes(boneName),
      )

      if (priority !== -1 && priority < bestPriority) {
        bestPriority = priority
        bestFaceBone = node
      }

      const orientationPriority = FACE_ORIENTATION_BONE_PRIORITY.findIndex(
        (boneName) => lowered === boneName || lowered.includes(boneName),
      )

      if (orientationPriority !== -1 && orientationPriority < bestOrientationPriority) {
        bestOrientationPriority = orientationPriority
        bestOrientationBone = node
      }
    })

    faceBoneNamesRef.current = availableBones.sort((a, b) => a.localeCompare(b))

    if (debugFaceBoneName) {
      let selectedBone = null
      clonedScene.traverse((node) => {
        if (selectedBone || !node.isBone) return
        if (node.name === debugFaceBoneName) {
          selectedBone = node
        }
      })
      faceBoneRef.current = selectedBone ?? bestFaceBone
    } else {
      faceBoneRef.current = bestFaceBone
    }
    faceOrientationBoneRef.current = bestOrientationBone ?? faceBoneRef.current

    if (onFaceDebugData) {
      onFaceDebugData({
        availableBones: faceBoneNamesRef.current,
        selectedBoneName: faceBoneRef.current?.name ?? null,
        selectedOrientationBoneName: faceOrientationBoneRef.current?.name ?? null,
      })
    }
  }, [clonedScene, debugFaceBoneName, onFaceDebugData])

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
    const orientationBone = faceOrientationBoneRef.current ?? bone
    const bonePos = boneWorldPosRef.current
    const boneQuat = boneWorldQuatRef.current
    const parentQuat = parentWorldQuatRef.current
    const localFaceQuat = localFaceQuatRef.current

    if (!bone || !orientationBone || !showPortraitSprite) {
      faceAnchor.visible = false
      if (faceBoneMarkerRef.current) {
        faceBoneMarkerRef.current.visible = false
      }
      return
    }

    bone.getWorldPosition(bonePos)
    orientationBone.getWorldQuaternion(boneQuat)

    const localFacePos = faceLocalPosRef.current

    if (faceLocalPositionRef.current) {
      localFacePos.copy(faceLocalPositionRef.current)
    } else {
      const faceOffset = faceOffsetWorldRef.current
        .copy(faceOffsetRef.current)
        .applyQuaternion(boneQuat)

      localFacePos.copy(bonePos).add(faceOffset)
      animRef.current.worldToLocal(localFacePos)
    }

    faceAnchor.visible = true
    faceAnchor.position.copy(localFacePos)
    animRef.current.getWorldQuaternion(parentQuat)
    localFaceQuat.copy(parentQuat).invert().multiply(boneQuat)
    faceAnchor.quaternion.copy(localFaceQuat)
    faceAnchor.translateZ(FACE_SURFACE_NUDGE)

    if (faceBoneMarkerRef.current) {
      const boneLocalPos = boneLocalPosRef.current.copy(bonePos)
      animRef.current.worldToLocal(boneLocalPos)
      faceBoneMarkerRef.current.visible = showDebugHelpers
      faceBoneMarkerRef.current.position.copy(boneLocalPos)
    }
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

    if (faceAnchorRef.current && showPortraitSprite) {
      faceAnchorRef.current.getWorldPosition(faceAnchorWorldPosRef.current)
    }

    if (onFaceDebugData) {
      debugEmitElapsedRef.current += delta
      if (debugEmitElapsedRef.current >= 0.1) {
        debugEmitElapsedRef.current = 0
        onFaceDebugData({
          availableBones: faceBoneNamesRef.current,
          selectedBoneName: faceBoneRef.current?.name ?? null,
          selectedOrientationBoneName: faceOrientationBoneRef.current?.name ?? null,
          spriteVisible: Boolean(showPortraitSprite && faceBoneRef.current),
          boneWorldPosition: faceBoneRef.current
            ? {
                x: Number(boneWorldPosRef.current.x.toFixed(4)),
                y: Number(boneWorldPosRef.current.y.toFixed(4)),
                z: Number(boneWorldPosRef.current.z.toFixed(4)),
              }
            : null,
          anchorLocalPosition: showPortraitSprite
            ? {
                x: Number(faceAnchorRef.current.position.x.toFixed(4)),
                y: Number(faceAnchorRef.current.position.y.toFixed(4)),
                z: Number(faceAnchorRef.current.position.z.toFixed(4)),
              }
            : null,
          anchorWorldPosition: showPortraitSprite
            ? {
                x: Number(faceAnchorWorldPosRef.current.x.toFixed(4)),
                y: Number(faceAnchorWorldPosRef.current.y.toFixed(4)),
                z: Number(faceAnchorWorldPosRef.current.z.toFixed(4)),
              }
            : null,
        })
      }
    }
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
            <mesh rotation={faceRotationOffset} renderOrder={11}>
              <planeGeometry args={[faceImageScale[0], faceImageScale[1]]} />
              <meshBasicMaterial
                map={portraitTexture}
                transparent
                opacity={0.92}
                alphaTest={0.05}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-2}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {showDebugHelpers && (
              <mesh renderOrder={12}>
                <sphereGeometry args={[0.012, 16, 16]} />
                <meshBasicMaterial color="#22d3ee" toneMapped={false} />
              </mesh>
            )}
          </group>
        )}
        {showDebugHelpers && (
          <mesh ref={faceBoneMarkerRef} renderOrder={12}>
            <sphereGeometry args={[0.015, 16, 16]} />
            <meshBasicMaterial color="#facc15" toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  )
}
