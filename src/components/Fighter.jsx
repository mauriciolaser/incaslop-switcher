import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildDecalMesh, findSkinnedMeshForBone } from '../utils/decalFace.js'

// headfront = bone at the actual face surface; use for both position and orientation
const FACE_BONE_PRIORITY = ['headfront', 'head_end', 'head', 'neck']
const FACE_ORIENTATION_BONE_PRIORITY = ['headfront', 'head', 'neck', 'head_end']
// depth=0.4 confirmed working: covers the face without leaking to the back
const DEFAULT_DECAL_SIZE = new THREE.Vector3(0.22, 0.27, 0.4)

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
    for (let y = 0; y < 32; y += 4) ctx.fillRect(0, y, 32, 2)
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
  decalSize = null,
  debugFaceBoneName = null,
  showDebugHelpers = false,
  onFaceDebugData,
}) {
  const animRef = useRef()
  const { scene } = useGLTF(modelPath)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const deathRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const faceBoneRef = useRef(null)
  const faceOrientationBoneRef = useRef(null)
  const faceBoneNamesRef = useRef([])
  const faceBoneMarkerRef = useRef()
  const debugEmitElapsedRef = useRef(0)

  // Decal — managed imperatively outside React reconciler
  const decalRef = useRef(null)         // { mesh, dispose }
  const decalOwnerRef = useRef(null)    // THREE.Scene that holds the decal mesh
  const needsDecalRebuildRef = useRef(false)
  const framesAliveRef = useRef(0)

  // Scratch
  const tmpPosRef = useRef(new THREE.Vector3())
  const tmpQuatRef = useRef(new THREE.Quaternion())
  const tmpEulerRef = useRef(new THREE.Euler())
  const decalSizeRef = useRef(
    decalSize ? new THREE.Vector3(...decalSize) : DEFAULT_DECAL_SIZE.clone()
  )

  const fallbackTexture = useMemo(() => createFallbackFaceTexture(), [])
  // portraitTextureRef is the single source of truth for the current texture.
  // State is only used to trigger React re-renders (which we don't need here,
  // but keep for potential future consumers).
  const portraitTextureRef = useRef(fallbackTexture)
  const [, forceRender] = useState(0)

  const clonedScene = useMemo(() => {
    const clone = skeletonClone(scene)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) child.material = child.material.clone()
      }
    })
    return clone
  }, [scene])

  useEffect(() => {
    decalSizeRef.current = decalSize
      ? new THREE.Vector3(...decalSize)
      : DEFAULT_DECAL_SIZE.clone()
    needsDecalRebuildRef.current = true
  }, [decalSize])

  // Bone detection
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

      const p = FACE_BONE_PRIORITY.findIndex(
        (n) => lowered === n || lowered.includes(n)
      )
      if (p !== -1 && p < bestPriority) { bestPriority = p; bestFaceBone = node }

      const op = FACE_ORIENTATION_BONE_PRIORITY.findIndex(
        (n) => lowered === n || lowered.includes(n)
      )
      if (op !== -1 && op < bestOrientationPriority) { bestOrientationPriority = op; bestOrientationBone = node }
    })

    faceBoneNamesRef.current = availableBones.sort((a, b) => a.localeCompare(b))

    if (debugFaceBoneName) {
      let sel = null
      clonedScene.traverse((node) => {
        if (sel || !node.isBone) return
        if (node.name === debugFaceBoneName) sel = node
      })
      faceBoneRef.current = sel ?? bestFaceBone
    } else {
      faceBoneRef.current = bestFaceBone
    }
    faceOrientationBoneRef.current = bestOrientationBone ?? faceBoneRef.current
    needsDecalRebuildRef.current = true

    if (onFaceDebugData) {
      onFaceDebugData({
        availableBones: faceBoneNamesRef.current,
        selectedBoneName: faceBoneRef.current?.name ?? null,
        selectedOrientationBoneName: faceOrientationBoneRef.current?.name ?? null,
      })
    }
  }, [clonedScene, debugFaceBoneName, onFaceDebugData])

  // Portrait texture loading — update ref directly, then flag rebuild
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()

    function applyTexture(tex) {
      if (cancelled) { if (tex !== fallbackTexture) tex.dispose(); return }
      const prev = portraitTextureRef.current
      if (prev && prev !== fallbackTexture) prev.dispose()
      portraitTextureRef.current = tex
      needsDecalRebuildRef.current = true
    }

    if (!portraitUrl) {
      applyTexture(fallbackTexture)
      return () => { cancelled = true }
    }

    loader.load(
      portraitUrl,
      (tex) => { configurePixelTexture(tex); applyTexture(tex) },
      undefined,
      () => applyTexture(fallbackTexture),
    )

    return () => { cancelled = true }
  }, [portraitUrl, fallbackTexture])

  // Cleanup on unmount
  useEffect(() => () => {
    const tex = portraitTextureRef.current
    if (tex && tex !== fallbackTexture) tex.dispose()
    fallbackTexture.dispose()
    removeCurrentDecal()
  }, [fallbackTexture]) // eslint-disable-line react-hooks/exhaustive-deps

  const dir = useMemo(() => {
    const dx = opponentPosition[0] - position[0]
    const dz = opponentPosition[2] - position[2]
    const len = Math.sqrt(dx * dx + dz * dz)
    return { x: dx / len, z: dz / len, angle: Math.atan2(dx, dz) }
  }, [position, opponentPosition])

  useEffect(() => {
    if (hp < prevHpRef.current) hitFlashRef.current = 1
    prevHpRef.current = hp
  }, [hp])

  useEffect(() => {
    if (isAttacking === side) shakeRef.current = 0
  }, [isAttacking, side])

  function removeCurrentDecal() {
    if (decalRef.current) {
      if (decalOwnerRef.current) decalOwnerRef.current.remove(decalRef.current.mesh)
      decalRef.current.dispose()
      decalRef.current = null
      decalOwnerRef.current = null
    }
  }

  function rebuildDecal(threeScene) {
    removeCurrentDecal()

    const bone = faceBoneRef.current
    const orientationBone = faceOrientationBoneRef.current ?? bone
    if (!bone || !orientationBone || !showPortraitSprite) return

    const targetMesh =
      findSkinnedMeshForBone(clonedScene, orientationBone) ??
      findSkinnedMeshForBone(clonedScene, bone)
    if (!targetMesh) return

    clonedScene.updateWorldMatrix(true, true)
    bone.getWorldPosition(tmpPosRef.current)
    orientationBone.getWorldQuaternion(tmpQuatRef.current)
    tmpEulerRef.current.setFromQuaternion(tmpQuatRef.current)

    const built = buildDecalMesh(
      targetMesh,
      tmpPosRef.current.clone(),
      tmpEulerRef.current.clone(),
      decalSizeRef.current,
      portraitTextureRef.current,
    )

    // Add to the THREE.js Scene root so world-space geometry renders correctly.
    // The baked vertices are in world space; the mesh has identity matrix.
    threeScene.add(built.mesh)
    decalRef.current = built
    decalOwnerRef.current = threeScene
  }

  useFrame(({ scene: threeScene }, delta) => {
    if (!animRef.current) return
    timeRef.current += delta
    framesAliveRef.current += 1

    // Defer first build until frame 3 so world matrices are populated.
    // Only rebuild on explicit flag — not periodically (idle bounce is ±0.04u, acceptable).
    if (needsDecalRebuildRef.current && framesAliveRef.current >= 3) {
      needsDecalRebuildRef.current = false
      rebuildDecal(threeScene)
    }

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

    const bobY = Math.sin(timeRef.current * 3) * 0.04
    const sway = Math.sin(timeRef.current * 1.5) * 0.03
    let ox = -dir.z * sway
    let oz = dir.x * sway

    if (isAttacking === side) {
      shakeRef.current += delta * 4
      if (shakeRef.current < 1) {
        const lunge = Math.sin(shakeRef.current * Math.PI) * 1.2
        ox += dir.x * lunge
        oz += dir.z * lunge
      }
    } else if (isAttacking && isAttacking !== side) {
      if (hitFlashRef.current > 0) {
        hitFlashRef.current = Math.max(0, hitFlashRef.current - delta * 4)
        const recoil = Math.sin(hitFlashRef.current * 20) * 0.12 * hitFlashRef.current
        ox -= dir.x * recoil
        oz -= dir.z * recoil
      }
    }

    animRef.current.position.set(ox, bobY, oz)

    if (onFaceDebugData) {
      debugEmitElapsedRef.current += delta
      if (debugEmitElapsedRef.current >= 0.1) {
        debugEmitElapsedRef.current = 0
        const bone = faceBoneRef.current
        if (bone) bone.getWorldPosition(tmpPosRef.current)
        onFaceDebugData({
          availableBones: faceBoneNamesRef.current,
          selectedBoneName: bone?.name ?? null,
          selectedOrientationBoneName: faceOrientationBoneRef.current?.name ?? null,
          spriteVisible: Boolean(showPortraitSprite && bone),
          boneWorldPosition: bone
            ? { x: +tmpPosRef.current.x.toFixed(4), y: +tmpPosRef.current.y.toFixed(4), z: +tmpPosRef.current.z.toFixed(4) }
            : null,
          anchorLocalPosition: decalRef.current
            ? { x: +decalRef.current.mesh.position.x.toFixed(4), y: +decalRef.current.mesh.position.y.toFixed(4), z: +decalRef.current.mesh.position.z.toFixed(4) }
            : null,
          anchorWorldPosition: null,
        })
      }
    }
  })

  const fighterScale = side === 'left' ? 1.0 : 0.95

  return (
    <group position={position}>
      <group ref={animRef}>
        <primitive
          object={clonedScene}
          scale={fighterScale}
          rotation={[0, dir.angle, 0]}
        />
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
