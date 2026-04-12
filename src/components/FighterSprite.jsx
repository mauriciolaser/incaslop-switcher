import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import spriteMeta from '../assets/sprites/fighter_base.json'
import baseSheetUrl from '../assets/sprites/fighter_base.png?url'
import { getKoProgress } from '../utils/koTimeline'

const { frameWidth: FW, frameHeight: FH, faceRegion: FACE } = spriteMeta

const PX_SCALE_BASE = 2.0 / FH
const W_UNITS_BASE = FW * PX_SCALE_BASE
const H_UNITS_BASE = FH * PX_SCALE_BASE

const FRAME_INDEX = spriteMeta.frames.reduce((acc, frame) => {
  acc[frame.name] = frame.index
  return acc
}, {})

function makePixelTexture(texture) {
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

export default function FighterSprite({
  position,
  opponentPosition,
  side,
  portraitUrl,
  spriteSheetUrl,
  hp,
  isAttacking,
  alive,
  scale = 1.0,
  facingCamera = false,
  animationState = 'idle',
  koState = null,
  _forceFrame = undefined,
}) {
  const meshRef = useRef(null)
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const portraitImgRef = useRef(null)
  const currentFrameRef = useRef(-1)
  const drawResourcesRef = useRef(null)

  const W_UNITS = W_UNITS_BASE * scale
  const H_UNITS = H_UNITS_BASE * scale
  const resolvedSheetUrl = spriteSheetUrl ?? baseSheetUrl
  const baseSheet = useLoader(THREE.TextureLoader, resolvedSheetUrl)

  if (drawResourcesRef.current == null) {
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = FW
    frameCanvas.height = FH
    const frameCtx = frameCanvas.getContext('2d')

    const frameTex = new THREE.CanvasTexture(frameCanvas)
    makePixelTexture(frameTex)

    const baseCanvas = document.createElement('canvas')
    baseCanvas.width = spriteMeta.sheetWidth
    baseCanvas.height = spriteMeta.sheetHeight
    const baseCtx = baseCanvas.getContext('2d')

    drawResourcesRef.current = { frameCtx, frameTex, baseCtx }
  }

  const drawResources = drawResourcesRef.current
  const { frameCtx, frameTex, baseCtx } = drawResources

  const material = useMemo(() => (
    new THREE.MeshBasicMaterial({
      map: drawResources.frameTex,
      transparent: true,
      opacity: 1,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    })
  ), [drawResources.frameTex])

  useEffect(() => {
    makePixelTexture(baseSheet)
  }, [baseSheet])

  useEffect(() => {
    return () => {
      material.dispose()
      drawResourcesRef.current?.frameTex.dispose()
    }
  }, [material])

  useEffect(() => {
    if (!portraitUrl) {
      portraitImgRef.current = null
      currentFrameRef.current = -1
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      portraitImgRef.current = img
      currentFrameRef.current = -1
    }
    img.onerror = () => {
      portraitImgRef.current = null
    }
    img.src = portraitUrl
  }, [portraitUrl])

  useEffect(() => {
    if (!baseSheet.image) return
    baseCtx.clearRect(0, 0, spriteMeta.sheetWidth, spriteMeta.sheetHeight)
    baseCtx.drawImage(baseSheet.image, 0, 0)
    currentFrameRef.current = -1
    // `baseCtx` is created once per sprite instance and intentionally stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSheet])

  useEffect(() => {
    if (animationState !== 'ko' && hp < prevHpRef.current) {
      hitFlashRef.current = 1
    }
    prevHpRef.current = hp
  }, [animationState, hp])

  useFrame(({ camera }, delta) => {
    if (!meshRef.current) return

    timeRef.current += delta
    const flipX = !facingCamera
    const koProgress = animationState === 'ko' ? getKoProgress(koState) : 0

    let frameName = 'idle_a'
    if (_forceFrame !== undefined && FRAME_INDEX[_forceFrame] !== undefined) {
      frameName = _forceFrame
    } else if (animationState === 'ko') {
      if (koProgress < 0.18) {
        frameName = 'hit'
      } else if (koProgress < 0.45) {
        frameName = 'ko_start'
      } else if (koProgress < 0.82) {
        frameName = 'ko_spin'
      } else {
        frameName = 'death'
      }
    } else if (!alive) {
      frameName = 'death'
    } else if (isAttacking === side) {
      frameName = Math.floor(timeRef.current * 8) % 2 === 0 ? 'attack_a' : 'attack_b'
    } else if (hitFlashRef.current > 0) {
      frameName = 'hit'
    } else {
      frameName = Math.floor(timeRef.current * 4) % 2 === 0 ? 'idle_a' : 'idle_b'
    }

    const frameIndex = FRAME_INDEX[frameName] ?? 0
    if (frameIndex !== currentFrameRef.current) {
      currentFrameRef.current = frameIndex
      frameCtx.clearRect(0, 0, FW, FH)

      if (baseSheet.image) {
        if (flipX) {
          frameCtx.save()
          frameCtx.translate(FW, 0)
          frameCtx.scale(-1, 1)
          frameCtx.drawImage(baseSheet.image, frameIndex * FW, 0, FW, FH, 0, 0, FW, FH)
          frameCtx.restore()
        } else {
          frameCtx.drawImage(baseSheet.image, frameIndex * FW, 0, FW, FH, 0, 0, FW, FH)
        }
      }

      if (portraitImgRef.current && frameName !== 'death') {
        const img = portraitImgRef.current
        const faceX = flipX ? (FW - FACE.x - FACE.w) : FACE.x

        frameCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, faceX, FACE.y, FACE.w, FACE.h)
      }

      frameTex.needsUpdate = true
    }

    const mesh = meshRef.current
    mesh.quaternion.copy(camera.quaternion)

    let ox = 0
    let oy = Math.sin(timeRef.current * 3) * 0.04 * scale
    let rotationZ = 0
    let liveScale = scale
    let opacity = 1

    if (animationState === 'ko') {
      const holdProgress = clamp01(koProgress / 0.18)
      const spinProgress = clamp01((koProgress - 0.18) / 0.82)
      const dirX = Math.sign(position[0] - opponentPosition[0]) || (side === 'left' ? -1 : 1)
      oy = (-H_UNITS * 0.8 * spinProgress) - (Math.sin(holdProgress * Math.PI) * 0.08 * scale)
      ox = dirX * (0.3 * spinProgress)
      rotationZ = spinProgress * Math.PI * 4.25 * (side === 'left' ? -1 : 1)
      liveScale = scale * (1 - 0.35 * spinProgress)
      opacity = koProgress < 0.55 ? 1 : 1 - clamp01((koProgress - 0.55) / 0.45)
      hitFlashRef.current = 0
      shakeRef.current = 0
    } else {
      if (isAttacking === side) {
        shakeRef.current += delta * 4
        if (shakeRef.current < 1) {
          const dx = opponentPosition[0] - position[0]
          const dz = opponentPosition[2] - position[2]
          const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz))
          const lunge = Math.sin(shakeRef.current * Math.PI) * 0.5
          ox = (dx / len) * lunge
        }
      } else {
        shakeRef.current = 0
      }

      if (hitFlashRef.current > 0) {
        hitFlashRef.current = Math.max(0, hitFlashRef.current - delta * 4)
        const dx = opponentPosition[0] - position[0]
        const dz = opponentPosition[2] - position[2]
        const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz))
        const recoil = Math.sin(hitFlashRef.current * 20) * 0.08 * hitFlashRef.current
        ox -= (dx / len) * recoil
      }
    }

    mesh.position.set(position[0] + ox, position[1] + H_UNITS / 2 + oy, position[2])
    mesh.scale.set(liveScale, liveScale, liveScale)
    mesh.rotateZ(rotationZ)

    if (mesh.material) {
      mesh.material.opacity = opacity
    }
  })

  return (
    <mesh ref={meshRef} renderOrder={10} material={material}>
      <planeGeometry args={[W_UNITS_BASE, H_UNITS_BASE]} />
    </mesh>
  )
}
