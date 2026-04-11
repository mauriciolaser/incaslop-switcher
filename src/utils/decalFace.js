import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'

// ─── Scratch objects ──────────────────────────────────────────────────────────
const _tmpMatrix = new THREE.Matrix4()
const _v0 = new THREE.Vector3()
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _edge1 = new THREE.Vector3()
const _edge2 = new THREE.Vector3()
const _faceNormal = new THREE.Vector3()

// ─── Bake skinned mesh to world space ────────────────────────────────────────

function _getBoneMatrix(skeleton, index) {
  _tmpMatrix.fromArray(skeleton.boneMatrices, index * 16)
  return _tmpMatrix
}

/**
 * Bake a SkinnedMesh's vertex positions AND normals into world space.
 * Returns a static proxy Mesh with identity matrix that DecalGeometry can use.
 * DecalGeometry needs normals to correctly generate UV projection.
 *
 * @param {THREE.SkinnedMesh} skinnedMesh
 * @returns {{ mesh: THREE.Mesh, dispose: () => void }}
 */
function bakeSkinToWorldMesh(skinnedMesh) {
  const srcGeo = skinnedMesh.geometry
  const posAttr = srcGeo.attributes.position
  const normalAttr = srcGeo.attributes.normal
  const skinIndexAttr = srcGeo.attributes.skinIndex
  const skinWeightAttr = srcGeo.attributes.skinWeight
  const skeleton = skinnedMesh.skeleton
  const bindMatrix = skinnedMesh.bindMatrix
  const bindMatrixInverse = skinnedMesh.bindMatrixInverse
  const meshWorldMatrix = skinnedMesh.matrixWorld
  // Normal matrix = inverse-transpose of the model matrix (no non-uniform scale assumed)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshWorldMatrix)

  skeleton.update()

  const count = posAttr.count
  const positions = new Float32Array(count * 3)
  const normals = normalAttr ? new Float32Array(count * 3) : null

  const vertex = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const skinned = new THREE.Vector3()
  const skinnedNormal = new THREE.Vector3()
  const boneMatrix = new THREE.Matrix4()
  const tmp = new THREE.Vector3()
  const tmpN = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    // ── Position ──
    vertex.fromBufferAttribute(posAttr, i).applyMatrix4(bindMatrix)
    skinned.set(0, 0, 0)

    if (normalAttr) {
      normal.fromBufferAttribute(normalAttr, i)
      skinnedNormal.set(0, 0, 0)
    }

    for (let j = 0; j < 4; j++) {
      const weight = skinWeightAttr.getComponent(i, j)
      if (weight === 0) continue
      const boneIndex = skinIndexAttr.getComponent(i, j)
      if (!skeleton.bones[boneIndex]) continue

      boneMatrix.copy(_getBoneMatrix(skeleton, boneIndex)).multiply(bindMatrixInverse)
      skinned.addScaledVector(tmp.copy(vertex).applyMatrix4(boneMatrix), weight)

      if (normalAttr) {
        // Normals use the upper-left 3x3 of the bone matrix (no translation)
        skinnedNormal.addScaledVector(tmpN.copy(normal).applyNormalMatrix(
          new THREE.Matrix3().setFromMatrix4(boneMatrix)
        ), weight)
      }
    }

    // World space position
    skinned.applyMatrix4(meshWorldMatrix)
    positions[i * 3] = skinned.x
    positions[i * 3 + 1] = skinned.y
    positions[i * 3 + 2] = skinned.z

    // World space normal
    if (normalAttr && normals) {
      skinnedNormal.normalize().applyMatrix3(normalMatrix).normalize()
      normals[i * 3] = skinnedNormal.x
      normals[i * 3 + 1] = skinnedNormal.y
      normals[i * 3 + 2] = skinnedNormal.z
    }
  }

  const bakedGeo = new THREE.BufferGeometry()
  bakedGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  if (normals) {
    bakedGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  }
  if (srcGeo.index) bakedGeo.setIndex(srcGeo.index.clone())

  const proxyMesh = new THREE.Mesh(bakedGeo)
  proxyMesh.matrixAutoUpdate = false
  proxyMesh.matrix.identity()
  proxyMesh.matrixWorld.identity()

  return { mesh: proxyMesh, dispose: () => bakedGeo.dispose() }
}

// ─── Front-face filter ────────────────────────────────────────────────────────

/**
 * Remove triangles from a DecalGeometry whose face normal points away from
 * `frontDirection` (dot product < minDot).  Prevents decal bleeding to the back.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Vector3}        frontDir  — world-space direction the face points toward
 * @param {number}               [minDot=0.1]
 */
function filterFrontFacingTriangles(geo, frontDir, minDot = 0.1) {
  const pos = geo.attributes.position
  const index = geo.index

  if (index) {
    const keepIndices = []
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i)
      const b = index.getX(i + 1)
      const c = index.getX(i + 2)
      _v0.fromBufferAttribute(pos, a)
      _v1.fromBufferAttribute(pos, b)
      _v2.fromBufferAttribute(pos, c)
      _edge1.subVectors(_v1, _v0)
      _edge2.subVectors(_v2, _v0)
      _faceNormal.crossVectors(_edge1, _edge2).normalize()
      if (_faceNormal.dot(frontDir) >= minDot) {
        keepIndices.push(a, b, c)
      }
    }
    geo.setIndex(keepIndices)
  } else {
    const srcArray = pos.array
    const count = pos.count
    // Also carry uvs and normals through the filter
    const uvAttr = geo.attributes.uv
    const normAttr = geo.attributes.normal
    const keptPos = []
    const keptUv = uvAttr ? [] : null
    const keptNorm = normAttr ? [] : null

    for (let i = 0; i < count; i += 3) {
      _v0.set(srcArray[i * 3], srcArray[i * 3 + 1], srcArray[i * 3 + 2])
      _v1.set(srcArray[(i + 1) * 3], srcArray[(i + 1) * 3 + 1], srcArray[(i + 1) * 3 + 2])
      _v2.set(srcArray[(i + 2) * 3], srcArray[(i + 2) * 3 + 1], srcArray[(i + 2) * 3 + 2])
      _edge1.subVectors(_v1, _v0)
      _edge2.subVectors(_v2, _v0)
      _faceNormal.crossVectors(_edge1, _edge2).normalize()

      if (_faceNormal.dot(frontDir) >= minDot) {
        for (let k = 0; k < 3; k++) {
          const vi = (i + k) * 3
          keptPos.push(srcArray[vi], srcArray[vi + 1], srcArray[vi + 2])
          if (keptUv && uvAttr) {
            keptUv.push(uvAttr.getX(i + k), uvAttr.getY(i + k))
          }
          if (keptNorm && normAttr) {
            keptNorm.push(normAttr.getX(i + k), normAttr.getY(i + k), normAttr.getZ(i + k))
          }
        }
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keptPos), 3))
    if (keptUv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(keptUv), 2))
    if (keptNorm) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(keptNorm), 3))
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a decal mesh projecting `texture` onto `skinnedMesh`.
 * Only front-facing triangles (relative to `orientation`) are kept.
 *
 * @param {THREE.SkinnedMesh} skinnedMesh
 * @param {THREE.Vector3}     position     — world-space projection center
 * @param {THREE.Euler}       orientation  — world-space projection orientation
 * @param {THREE.Vector3}     size         — projection box [width, height, depth]
 * @param {THREE.Texture}     texture
 * @returns {{ mesh: THREE.Mesh, dispose: () => void }}
 */
export function buildDecalMesh(skinnedMesh, position, orientation, size, texture) {
  const baked = bakeSkinToWorldMesh(skinnedMesh)

  const geometry = new DecalGeometry(baked.mesh, position, orientation, size)
  baked.dispose()

  // Front direction = local +Z of decal rotated into world space
  const frontDir = new THREE.Vector3(0, 0, 1).applyEuler(orientation)
  filterFrontFacingTriangles(geometry, frontDir, 0.1)

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    alphaTest: 0.05,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    toneMapped: false,
    side: THREE.FrontSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.matrixAutoUpdate = false
  mesh.matrix.identity()
  mesh.matrixWorld.identity()
  mesh.renderOrder = 11

  return {
    mesh,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * Find the SkinnedMesh whose skeleton contains `bone`.
 * Among all matches, prefer the one with the highest total skin weight for `bone`.
 *
 * @param {THREE.Object3D} scene
 * @param {THREE.Bone}     bone
 * @returns {THREE.SkinnedMesh | null}
 */
export function findSkinnedMeshForBone(scene, bone) {
  let bestMesh = null
  let bestWeight = -1

  scene.traverse((node) => {
    if (!node.isSkinnedMesh) return
    const skeleton = node.skeleton
    if (!skeleton) return

    const boneIndex = skeleton.bones.indexOf(bone)
    if (boneIndex === -1) return

    // Sum skin weights for this bone to find the mesh most influenced by it
    const skinWeightAttr = node.geometry.attributes.skinWeight
    const skinIndexAttr = node.geometry.attributes.skinIndex
    if (!skinWeightAttr || !skinIndexAttr) {
      // No weight data — accept if no better candidate yet
      if (bestMesh === null) bestMesh = node
      return
    }

    let totalWeight = 0
    for (let i = 0; i < skinWeightAttr.count; i++) {
      for (let j = 0; j < 4; j++) {
        if (skinIndexAttr.getComponent(i, j) === boneIndex) {
          totalWeight += skinWeightAttr.getComponent(i, j)
        }
      }
    }

    if (totalWeight > bestWeight) {
      bestWeight = totalWeight
      bestMesh = node
    }
  })

  return bestMesh
}
