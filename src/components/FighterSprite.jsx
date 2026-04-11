import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import spriteMeta from '../assets/sprites/fighter_base.json'
import spriteSheetUrl from '../assets/sprites/fighter_base.png?url'

// ── Constantes del spritesheet ────────────────────────────────────────────────
const { frameWidth: FW, frameHeight: FH, sheetWidth: SW, sheetHeight: SH, faceRegion: FACE } = spriteMeta

// Escala world-units por pixel. 192px de alto ≈ 2 unidades de altura.
const PX_SCALE = 2.0 / FH
const W_UNITS = FW * PX_SCALE   // ancho del quad en world units
const H_UNITS = FH * PX_SCALE   // alto del quad en world units

// Índices de frame por estado
const FRAME = { idle_a: 0, idle_b: 1, attack_a: 2, attack_b: 3, hit: 4, death: 5 }

// ── UV de cada frame ──────────────────────────────────────────────────────────
function frameUV(index) {
  const u0 = (index * FW) / SW
  const u1 = u0 + FW / SW
  const v0 = 0        // Three.js: v=0 es abajo en UV, pero la textura es top-down.
  const v1 = 1        // Usamos flipY=false y coordenadas directas.
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

// ── Recorta la imagen del candidato y la pone sobre el frame base en un canvas ─
function buildCompositeTexture(baseCtx, portraitImg, frameIndex, flipX) {
  const canvas = baseCtx.canvas
  const ctx = canvas.getContext('2d')

  // Limpiar
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Frame del spritesheet base
  ctx.drawImage(
    baseCtx.canvas,               // fuente = canvas del spritesheet completo
    frameIndex * FW, 0, FW, FH,  // recorte del frame
    0, 0, FW, FH,                 // destino
  )

  if (portraitImg) {
    // Recorte de la cara: usamos la parte superior centrada de la foto carnet
    const srcW = portraitImg.naturalWidth
    const srcH = portraitImg.naturalHeight
    const cropW = srcW * 0.80
    const cropH = srcH * 0.65
    const cropX = (srcW - cropW) / 2

    ctx.save()
    // Clip redondeado sobre la faceRegion
    ctx.beginPath()
    ctx.roundRect(FACE.x, FACE.y, FACE.w, FACE.h, 4)
    ctx.clip()

    if (flipX) {
      // Espejear horizontalmente dentro de la faceRegion
      ctx.translate(FACE.x + FACE.w, FACE.y)
      ctx.scale(-1, 1)
      ctx.drawImage(portraitImg, cropX, 0, cropW, cropH, 0, 0, FACE.w, FACE.h)
    } else {
      ctx.drawImage(portraitImg, cropX, 0, cropW, cropH, FACE.x, FACE.y, FACE.w, FACE.h)
    }
    ctx.restore()
  }
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
  _forceFrame = undefined,  // dev-only: pin a specific frame name
}) {
  const meshRef = useRef()
  const timeRef = useRef(0)
  const shakeRef = useRef(0)
  const hitFlashRef = useRef(0)
  const prevHpRef = useRef(hp)
  const deathRef = useRef(0)

  // Cargar el spritesheet base
  const baseSheet = useLoader(THREE.TextureLoader, spriteSheetUrl)
  useMemo(() => makePixelTexture(baseSheet), [baseSheet])

  // Canvas de un solo frame para la textura composite (base + cara)
  const { frameCanvas, frameCtx, frameTex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = FW
    canvas.height = FH
    const ctx = canvas.getContext('2d')
    const tex = new THREE.CanvasTexture(canvas)
    makePixelTexture(tex)
    return { frameCanvas: canvas, frameCtx: ctx, frameTex: tex }
  }, [])

  // Canvas auxiliar con el spritesheet base completo para poder recortar frames
  const { baseCanvas, baseCtx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = SW
    canvas.height = SH
    const ctx = canvas.getContext('2d')
    return { baseCanvas: canvas, baseCtx: ctx }
  }, [])

  // Estado de la imagen del candidato
  const portraitImgRef = useRef(null)
  const portraitReadyRef = useRef(false)
  const currentFrameRef = useRef(-1)  // fuerza redibujado en el primer frame

  // Cargar imagen del candidato cuando cambia la URL
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
      currentFrameRef.current = -1  // fuerza redibujado
    }
    img.onerror = () => {
      portraitImgRef.current = null
      portraitReadyRef.current = false
    }
    img.src = portraitUrl
  }, [portraitUrl])

  // Cuando el baseSheet carga, dibujarlo en el canvas auxiliar
  useEffect(() => {
    if (!baseSheet.image) return
    baseCtx.drawImage(baseSheet.image, 0, 0)
  }, [baseSheet, baseCtx])

  // Orientación: el sprite mira hacia el oponente
  const flipX = side === 'right'  // fighter derecho mira a la izquierda

  // Material del quad — usa la textura canvas
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

    // ── Redibujar canvas solo si cambió el frame o la imagen ─────────────────
    if (frameIndex !== currentFrameRef.current) {
      currentFrameRef.current = frameIndex

      // Limpiar frame canvas
      frameCtx.clearRect(0, 0, FW, FH)

      // Dibujar el frame base del spritesheet
      if (baseSheet.image) {
        frameCtx.drawImage(baseSheet.image, frameIndex * FW, 0, FW, FH, 0, 0, FW, FH)
      }

      // Compositar cara del candidato encima
      if (portraitImgRef.current) {
        const img = portraitImgRef.current
        const srcW = img.naturalWidth
        const srcH = img.naturalHeight
        const cropW = srcW * 0.80
        const cropH = srcH * 0.65
        const cropX = (srcW - cropW) / 2

        frameCtx.save()
        frameCtx.beginPath()
        // Clip redondeado para la zona de la cara
        if (frameCtx.roundRect) {
          frameCtx.roundRect(FACE.x, FACE.y, FACE.w, FACE.h, 4)
        } else {
          frameCtx.rect(FACE.x, FACE.y, FACE.w, FACE.h)
        }
        frameCtx.clip()

        if (flipX) {
          frameCtx.translate(FACE.x + FACE.w, FACE.y)
          frameCtx.scale(-1, 1)
          frameCtx.drawImage(img, cropX, 0, cropW, cropH, 0, 0, FACE.w, FACE.h)
        } else {
          frameCtx.drawImage(img, cropX, 0, cropW, cropH, FACE.x, FACE.y, FACE.w, FACE.h)
        }
        frameCtx.restore()
      }

      frameTex.needsUpdate = true
    }

    // ── Billboard: el quad siempre mira a la cámara (solo eje Y) ─────────────
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

      // Idle bounce
      oy = Math.sin(timeRef.current * 3) * 0.04

      // Ataque: lunge hacia el oponente
      if (isAttacking === side) {
        shakeRef.current += delta * 4
        if (shakeRef.current < 1) {
          const dx = opponentPosition[0] - position[0]
          const dz = opponentPosition[2] - position[2]
          const len = Math.sqrt(dx * dx + dz * dz)
          const lunge = Math.sin(shakeRef.current * Math.PI) * 0.6
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
      position[1] + H_UNITS / 2 + oy,   // centrar verticalmente sobre el suelo
      position[2],
    )
  })

  return (
    <mesh ref={meshRef} renderOrder={10} material={material}>
      <planeGeometry args={[W_UNITS, H_UNITS]} />
    </mesh>
  )
}
