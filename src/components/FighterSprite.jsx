import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import spriteMeta from '../assets/sprites/fighter_base.json'
import spriteSheetUrl from '../assets/sprites/fighter_base.png?url'

// ── Constantes del spritesheet ────────────────────────────────────────────────
const { frameWidth: FW, frameHeight: FH, sheetWidth: SW, sheetHeight: SH, faceRegion: FACE } = spriteMeta

// Escala base world-units por pixel. 192px de alto ≈ 2 unidades de altura.
const PX_SCALE_BASE = 2.0 / FH
const W_UNITS_BASE = FW * PX_SCALE_BASE
const H_UNITS_BASE = FH * PX_SCALE_BASE

// Índices de frame por estado
const FRAME = { idle_a: 0, idle_b: 1, attack_a: 2, attack_b: 3, hit: 4, death: 5 }

// ── UV de cada frame ──────────────────────────────────────────────────────────
function frameUV(index) {
  const u0 = (index * FW) / SW
  const u1 = u0 + FW / SW
  const v0 = 0
  const v1 = 1
  return { u0, u1, v0, v1 }
}

// ── Helpers de textura ────────────────────────────────────────────────────────
function makePixelTexture(src) {
  src.magFilter = THREE.NearestFilter
  src.minFilter = THREE.NearestFilter
  src.generateMipmaps = false
  src.colorSpace = THREE.SRGBColorSpace
  return src
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FighterSprite({
  position,
  opponentPosition,
  side,
  portraitUrl,
  hp,
  maxHp = 100,
  isAttacking,
  alive,
  scale = 1.0,          // multiplicador de tamaño (player 1 = 1.7, rival = 1.0)
  facingCamera = false, // true = de espaldas a la cámara (player 1), false = de frente (rival)
  _forceFrame = undefined,
}) {
  const meshRef = useRef()
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const deathRef = useRef(0)

  // Dimensiones del quad según escala
  const W_UNITS = W_UNITS_BASE * scale
  const H_UNITS = H_UNITS_BASE * scale

  // Cargar el spritesheet base
  const baseSheet = useLoader(THREE.TextureLoader, spriteSheetUrl)
  useMemo(() => makePixelTexture(baseSheet), [baseSheet])

  // Canvas de un solo frame para la textura composite (base + cara)
  const { frameCtx, frameTex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = FW
    canvas.height = FH
    const ctx = canvas.getContext('2d')
    const tex = new THREE.CanvasTexture(canvas)
    makePixelTexture(tex)
    return { frameCanvas: canvas, frameCtx: ctx, frameTex: tex }
  }, [])

  // Canvas auxiliar con el spritesheet base completo
  const { baseCtx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = SW
    canvas.height = SH
    const ctx = canvas.getContext('2d')
    return { baseCanvas: canvas, baseCtx: ctx }
  }, [])

  const portraitImgRef = useRef(null)
  const portraitReadyRef = useRef(false)
  const currentFrameRef = useRef(-1)

  useEffect(() => {
    if (!portraitUrl) {
      portraitImgRef.current = null
      portraitReadyRef.current = false
      currentFrameRef.current = -1
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      portraitImgRef.current = img
      portraitReadyRef.current = true
      currentFrameRef.current = -1
    }
    img.onerror = () => {
      portraitImgRef.current = null
      portraitReadyRef.current = false
    }
    img.src = portraitUrl
  }, [portraitUrl])

  useEffect(() => {
    if (!baseSheet.image) return
    baseCtx.drawImage(baseSheet.image, 0, 0)
  }, [baseSheet, baseCtx])

  // Orientación horizontal del sprite:
  // - facingCamera (player 1, de espaldas): miramos el sprite tal cual está en el sheet
  //   pero flipeado para que parezca de espaldas mirando al rival a la derecha.
  // - !facingCamera (rival, de frente): flipX para que mire hacia la cámara (izquierda).
  const flipX = !facingCamera  // rival flipea, player 1 no

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    map: frameTex,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  }), [frameTex])

  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => frameTex.dispose(), [frameTex])

  useEffect(() => {
    if (hp < prevHpRef.current) hitFlashRef.current = 1
    prevHpRef.current = hp
  }, [hp])

  useFrame(({ camera }, delta) => {
    if (!meshRef.current) return
    timeRef.current += delta

    // ── Determinar frame del spritesheet ─────────────────────────────────────
    let frameIndex = FRAME.idle_a

    if (_forceFrame !== undefined && FRAME[_forceFrame] !== undefined) {
      frameIndex = FRAME[_forceFrame]
    } else if (!alive) {
      frameIndex = FRAME.death
    } else if (isAttacking === side) {
      frameIndex = Math.floor(timeRef.current * 8) % 2 === 0 ? FRAME.attack_a : FRAME.attack_b
    } else if (hitFlashRef.current > 0) {
      frameIndex = FRAME.hit
    } else {
      frameIndex = Math.floor(timeRef.current * 4) % 2 === 0 ? FRAME.idle_a : FRAME.idle_b
    }

    // ── Redibujar canvas solo si cambió el frame ──────────────────────────────
    if (frameIndex !== currentFrameRef.current) {
      currentFrameRef.current = frameIndex

      frameCtx.clearRect(0, 0, FW, FH)

      if (baseSheet.image) {
        if (flipX) {
          // Espejear el frame base completo horizontalmente
          frameCtx.save()
          frameCtx.translate(FW, 0)
          frameCtx.scale(-1, 1)
          frameCtx.drawImage(baseSheet.image, frameIndex * FW, 0, FW, FH, 0, 0, FW, FH)
          frameCtx.restore()
        } else {
          frameCtx.drawImage(baseSheet.image, frameIndex * FW, 0, FW, FH, 0, 0, FW, FH)
        }
      }

      // Compositar cara del candidato encima
      if (portraitImgRef.current) {
        const img = portraitImgRef.current
        const srcW = img.naturalWidth
        const srcH = img.naturalHeight
        const cropW = srcW * 0.80
        const cropH = srcH * 0.65
        const cropX = (srcW - cropW) / 2

        // Calcular la zona de la cara en el canvas ya flipeado
        const faceX = flipX ? (FW - FACE.x - FACE.w) : FACE.x

        frameCtx.save()
        frameCtx.beginPath()
        if (frameCtx.roundRect) {
          frameCtx.roundRect(faceX, FACE.y, FACE.w, FACE.h, 4)
        } else {
          frameCtx.rect(faceX, FACE.y, FACE.w, FACE.h)
        }
        frameCtx.clip()
        frameCtx.drawImage(img, cropX, 0, cropW, cropH, faceX, FACE.y, FACE.w, FACE.h)
        frameCtx.restore()
      }

      frameTex.needsUpdate = true
    }

    // ── Billboard: el quad siempre mira a la cámara (eje Y) ──────────────────
    const mesh = meshRef.current
    mesh.quaternion.copy(camera.quaternion)

    // ── Animaciones de posición ───────────────────────────────────────────────
    let ox = 0
    let oy = 0

    if (!alive) {
      deathRef.current = Math.min(deathRef.current + delta * 1.5, 1)
      oy = -deathRef.current * H_UNITS * 0.5
    } else {
      deathRef.current = 0

      // Idle bounce — player 1 rebota un poco más por ser más grande
      oy = Math.sin(timeRef.current * 3) * 0.04 * scale

      // Ataque: lunge hacia el oponente
      if (isAttacking === side) {
        shakeRef.current += delta * 4
        if (shakeRef.current < 1) {
          const dx = opponentPosition[0] - position[0]
          const dz = opponentPosition[2] - position[2]
          const len = Math.sqrt(dx * dx + dz * dz)
          const lunge = Math.sin(shakeRef.current * Math.PI) * 0.5
          ox = (dx / len) * lunge
        }
      } else {
        if (isAttacking !== side) shakeRef.current = 0
      }

      // Hit: retroceso
      if (hitFlashRef.current > 0) {
        hitFlashRef.current = Math.max(0, hitFlashRef.current - delta * 4)
        const dx = opponentPosition[0] - position[0]
        const dz = opponentPosition[2] - position[2]
        const len = Math.sqrt(dx * dx + dz * dz)
        const recoil = Math.sin(hitFlashRef.current * 20) * 0.08 * hitFlashRef.current
        ox -= (dx / len) * recoil
      }
    }

    mesh.position.set(
      position[0] + ox,
      position[1] + H_UNITS / 2 + oy,
      position[2],
    )

    // Escalar el quad según la prop scale
    mesh.scale.setScalar(scale)
  })

  return (
    <mesh ref={meshRef} renderOrder={10} material={material}>
      <planeGeometry args={[W_UNITS_BASE, H_UNITS_BASE]} />
    </mesh>
  )
}
