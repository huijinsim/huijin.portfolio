import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CONFIG, PALETTE } from '../config.js'

// ─────────────────────────────────────────────────────────────
// Terrain — Meshy 지형 GLB → 높이맵 메시 (경량·정확)
// ─────────────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function barycentric2D(px, pz, x0, z0, x1, z1, x2, z2) {
  const det = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2)
  if (Math.abs(det) < 1e-10) return null
  const w0 = ((z1 - z2) * (px - x2) + (x2 - x1) * (pz - z2)) / det
  const w1 = ((z2 - z0) * (px - x2) + (x0 - x2) * (pz - z2)) / det
  const w2 = 1 - w0 - w1
  if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) return null
  return [w0, w1, w2]
}

/** GLB 삼각형 표면 → XZ 그리드 높이 (모델 실루엣 유지) */
export function buildHeightField(geometry, gridSize) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const minX = box.min.x
  const maxX = box.max.x
  const minZ = box.min.z
  const maxZ = box.max.z
  const spanX = Math.max(maxX - minX, 0.001)
  const spanZ = Math.max(maxZ - minZ, 0.001)

  const heights = new Float32Array(gridSize * gridSize)
  const direct = new Uint8Array(gridSize * gridSize)
  heights.fill(-Infinity)

  const pos = geometry.attributes.position
  const index = geometry.index

  const stampTri = (i0, i1, i2) => {
    const x0 = pos.getX(i0)
    const y0 = pos.getY(i0)
    const z0 = pos.getZ(i0)
    const x1 = pos.getX(i1)
    const y1 = pos.getY(i1)
    const z1 = pos.getZ(i1)
    const x2 = pos.getX(i2)
    const y2 = pos.getY(i2)
    const z2 = pos.getZ(i2)

    const triMinX = Math.min(x0, x1, x2)
    const triMaxX = Math.max(x0, x1, x2)
    const triMinZ = Math.min(z0, z1, z2)
    const triMaxZ = Math.max(z0, z1, z2)

    const minIx = clamp(Math.floor(((triMinX - minX) / spanX) * (gridSize - 1)) - 1, 0, gridSize - 1)
    const maxIx = clamp(Math.ceil(((triMaxX - minX) / spanX) * (gridSize - 1)) + 1, 0, gridSize - 1)
    const minIz = clamp(Math.floor(((triMinZ - minZ) / spanZ) * (gridSize - 1)) - 1, 0, gridSize - 1)
    const maxIz = clamp(Math.ceil(((triMaxZ - minZ) / spanZ) * (gridSize - 1)) + 1, 0, gridSize - 1)

    for (let iz = minIz; iz <= maxIz; iz++) {
      const pz = minZ + (iz / (gridSize - 1)) * spanZ
      for (let ix = minIx; ix <= maxIx; ix++) {
        const px = minX + (ix / (gridSize - 1)) * spanX
        const w = barycentric2D(px, pz, x0, z0, x1, z1, x2, z2)
        if (!w) continue
        const y = w[0] * y0 + w[1] * y1 + w[2] * y2
        const idx = iz * gridSize + ix
        if (y > heights[idx]) {
          heights[idx] = y
          direct[idx] = 1
        }
      }
    }
  }

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      stampTri(index.getX(i), index.getX(i + 1), index.getX(i + 2))
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      stampTri(i, i + 1, i + 2)
    }
  }

  let fallback = 0
  let hasAny = false
  for (let i = 0; i < heights.length; i++) {
    if (Number.isFinite(heights[i]) && heights[i] > -1e8) {
      fallback = heights[i]
      hasAny = true
    }
  }
  if (!hasAny) {
    throw new Error('지형 높이맵 생성 실패')
  }

  for (let pass = 0; pass < 5; pass++) {
    const next = heights.slice()
    for (let iz = 0; iz < gridSize; iz++) {
      for (let ix = 0; ix < gridSize; ix++) {
        const idx = iz * gridSize + ix
        if (Number.isFinite(heights[idx]) && heights[idx] > -1e8) continue
        let sum = 0
        let n = 0
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = ix + dx
            const nz = iz + dz
            if (nx < 0 || nz < 0 || nx >= gridSize || nz >= gridSize) continue
            const v = heights[nz * gridSize + nx]
            if (Number.isFinite(v) && v > -1e8) {
              sum += v
              n++
            }
          }
        }
        next[idx] = n ? sum / n : fallback
      }
    }
    for (let i = 0; i < heights.length; i++) heights[i] = next[i]
  }

  let maxHeight = 0
  let minHeight = Infinity
  for (let i = 0; i < heights.length; i++) {
    maxHeight = Math.max(maxHeight, heights[i])
    minHeight = Math.min(minHeight, heights[i])
  }

  return { heights, direct, minX, minZ, spanX, spanZ, gridSize, maxHeight, minHeight }
}

/** 바닥(y=0)에 맞춤 */
export function normalizeHeightField(field) {
  const shift = field.minHeight ?? 0
  if (Math.abs(shift) < 1e-6) return field.maxHeight

  for (let i = 0; i < field.heights.length; i++) {
    field.heights[i] -= shift
  }
  field.maxHeight -= shift
  field.minHeight = 0
  return field.maxHeight
}

export function heightFieldToGeometry(field) {
  const { heights, direct, minX, minZ, spanX, spanZ, gridSize } = field
  const positions = []
  const uvs = []
  const indices = []
  const indexMap = new Int32Array(gridSize * gridSize)
  indexMap.fill(-1)

  for (let iz = 0; iz < gridSize; iz++) {
    for (let ix = 0; ix < gridSize; ix++) {
      const idx = iz * gridSize + ix
      if (!direct[idx]) continue

      indexMap[idx] = positions.length / 3
      positions.push(
        minX + (ix / (gridSize - 1)) * spanX,
        heights[idx],
        minZ + (iz / (gridSize - 1)) * spanZ,
      )
      uvs.push(ix / (gridSize - 1), iz / (gridSize - 1))
    }
  }

  for (let iz = 0; iz < gridSize - 1; iz++) {
    for (let ix = 0; ix < gridSize - 1; ix++) {
      const a = indexMap[iz * gridSize + ix]
      const b = indexMap[iz * gridSize + ix + 1]
      const c = indexMap[(iz + 1) * gridSize + ix]
      const d = indexMap[(iz + 1) * gridSize + ix + 1]
      if (a < 0 || b < 0 || c < 0 || d < 0) continue

      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/** O(1) 높이 조회 */
export function createHeightFieldSampler(field) {
  const { heights, minX, minZ, spanX, spanZ, gridSize } = field

  return (x, z, fallback = 0) => {
    const fx = clamp(((x - minX) / spanX) * (gridSize - 1), 0, gridSize - 1)
    const fz = clamp(((z - minZ) / spanZ) * (gridSize - 1), 0, gridSize - 1)
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    const tx = fx - ix
    const tz = fz - iz
    const x1 = clamp(ix + 1, 0, gridSize - 1)
    const z1 = clamp(iz + 1, 0, gridSize - 1)

    const h00 = heights[iz * gridSize + ix]
    const h10 = heights[iz * gridSize + x1]
    const h01 = heights[z1 * gridSize + ix]
    const h11 = heights[z1 * gridSize + x1]

    const top = h00 * (1 - tx) + h10 * tx
    const bot = h01 * (1 - tx) + h11 * tx
    return top * (1 - tz) + bot * tz || fallback
  }
}

const _rayOrigin = new THREE.Vector3()
const _rayDown = new THREE.Vector3(0, -1, 0)

/** 실제 지형 메시 표면 — 나무·풀 배치용 */
export function createMeshHeightSampler(mesh) {
  const ray = new THREE.Raycaster()
  mesh.updateMatrixWorld(true)

  return (x, z, fallback = 0) => {
    _rayOrigin.set(x, 500, z)
    ray.set(_rayOrigin, _rayDown)
    const hits = ray.intersectObject(mesh, false)
    return hits.length ? hits[0].point.y : fallback
  }
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {(pct:number)=>void} [onProgress]
 */
export function loadTerrain(url, options = {}, onProgress) {
  const cfg = { ...CONFIG.forest.terrain, ...options }
  const loader = new GLTFLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        try {
          let src = null
          gltf.scene.traverse((o) => {
            if (o.isMesh && !src) src = o
          })
          if (!src) {
            reject(new Error(`지형 GLB에 Mesh가 없습니다: ${url}`))
            return
          }

          const source = src.geometry.clone()
          source.computeBoundingBox()
          const box = source.boundingBox
          const cx = (box.min.x + box.max.x) * 0.5
          const cz = (box.min.z + box.max.z) * 0.5
          source.translate(-cx, -box.min.y, -cz)

          source.computeBoundingBox()
          const size = new THREE.Vector3()
          source.boundingBox.getSize(size)

          const span = Math.max(size.x, size.z, 0.001)
          const scaleXZ = cfg.width / span
          const scaleY = cfg.height / Math.max(size.y, 0.001)
          source.scale(scaleXZ, scaleY, scaleXZ)
          source.computeBoundingBox()

          const field = buildHeightField(source, cfg.gridSize ?? 96)
          const maxHeight = normalizeHeightField(field)
          const geometry = heightFieldToGeometry(field)
          source.dispose()

          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(PALETTE.ground),
            roughness: 1.0,
            metalness: 0.0,
            side: THREE.DoubleSide,
          })
          resolve({ geometry, material, heightField: field, maxHeight })
        } catch (err) {
          reject(err)
        }
      },
      (ev) => {
        if (onProgress && ev.total) onProgress(ev.loaded / ev.total)
      },
      reject,
    )
  })
}
