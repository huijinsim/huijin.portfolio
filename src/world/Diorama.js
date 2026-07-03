import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CONFIG } from '../config.js'
import {
  createHeightFieldSampler,
  buildHeightField,
  normalizeHeightField,
} from './Terrain.js'

// ─────────────────────────────────────────────────────────────
// Diorama — 받침대(슬랩) 위의 정사각 숲 섬: 언덕 + 길
// 높이 소스는 절차적(hills) 또는 GLB 지형 둘 다 지원하며,
// 정점 컬러(잔디/흙길)·받침대·샘플러 조립은 공유한다.
// ─────────────────────────────────────────────────────────────

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uz,
  )
}

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a || 1), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 높이필드 박스 블러 — 거친 표면을 부드럽게 */
function blurField(field, passes = 4) {
  const { heights, gridSize: N } = field
  for (let pass = 0; pass < passes; pass++) {
    const next = heights.slice()
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        let sum = 0
        let n = 0
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = ix + dx
            const nz = iz + dz
            if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue
            sum += heights[nz * N + nx]
            n++
          }
        }
        next[iz * N + ix] = sum / n
      }
    }
    heights.set(next)
  }
}

/**
 * 높이 소스(rawHeightAt)를 받아 디오라마 섬을 조립한다.
 * @param {() => number} rng
 * @param {(x:number, z:number) => number} rawHeightAt  가장자리 falloff 적용 전의 높이
 */
function assembleDiorama(rng, rawHeightAt) {
  const d = CONFIG.diorama
  const size = d.size
  const half = size * 0.5
  const N = d.grid
  const margin = d.edgeMargin

  // ── 길 곡선 (앞 +z → 뒤 -z, 구불구불) ───────────────────────
  const pathCtrl = d.path.map((p) => new THREE.Vector3(p[0], 0, p[1]))
  const curve = new THREE.CatmullRomCurve3(pathCtrl, false, 'catmullrom', 0.5)
  const pathPts = curve.getPoints(220)

  const nearestPathDist = (x, z) => {
    let best = Infinity
    for (const p of pathPts) {
      const dx = x - p.x
      const dz = z - p.z
      const dd = dx * dx + dz * dz
      if (dd < best) best = dd
    }
    return Math.sqrt(best)
  }

  const pathHalf = d.pathWidth * 0.5

  const heights = new Float32Array(N * N)
  const colors = new Float32Array(N * N * 3)

  const cGrassLow = new THREE.Color(d.grassLow)
  const cGrassHigh = new THREE.Color(d.grassHigh)
  const cPath = new THREE.Color(d.pathColor)
  const cTmp = new THREE.Color()

  const heightAt = (x, z) => {
    let h = rawHeightAt(x, z)
    const edge = Math.min(half - Math.abs(x), half - Math.abs(z))
    h *= smoothstep(0, margin, edge)
    return Math.max(0, h)
  }

  let maxHeight = 0
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const x = -half + (ix / (N - 1)) * size
      const z = -half + (iz / (N - 1)) * size
      let h = heightAt(x, z)

      // 길: 깎아내고 평탄화 + 흙색
      const pd = nearestPathDist(x, z)
      const onPath = smoothstep(pathHalf, pathHalf - 2.4, pd)
      if (onPath > 0) {
        h = THREE.MathUtils.lerp(h, h - d.pathCarve, onPath)
        h = Math.max(0, h)
      }

      const idx = iz * N + ix
      heights[idx] = h

      // 정점 색: 높이 기반 + 패치 노이즈로 초록 톤 다양화
      const hb = THREE.MathUtils.clamp(h / (d.colorHeight || 14), 0, 1)
      const patch = valueNoise(x * 0.08 + 3.7, z * 0.08 + 8.1)
      cTmp.copy(cGrassLow).lerp(cGrassHigh, THREE.MathUtils.clamp(hb * 0.75 + patch * 0.4, 0, 1))
      const fine = (valueNoise(x * 0.28, z * 0.28) - 0.5) * 0.045
      cTmp.r = THREE.MathUtils.clamp(cTmp.r + fine * 0.6, 0, 1)
      cTmp.g = THREE.MathUtils.clamp(cTmp.g + fine, 0, 1)
      cTmp.b = THREE.MathUtils.clamp(cTmp.b + fine * 0.4, 0, 1)
      cTmp.lerp(cPath, onPath)
      colors[idx * 3] = cTmp.r
      colors[idx * 3 + 1] = cTmp.g
      colors[idx * 3 + 2] = cTmp.b

      if (h > maxHeight) maxHeight = h
    }
  }

  // ── 지오메트리 ─────────────────────────────────────────────
  const positions = new Float32Array(N * N * 3)
  const uvs = new Float32Array(N * N * 2)
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const idx = iz * N + ix
      positions[idx * 3] = -half + (ix / (N - 1)) * size
      positions[idx * 3 + 1] = heights[idx]
      positions[idx * 3 + 2] = -half + (iz / (N - 1)) * size
      uvs[idx * 2] = ix / (N - 1)
      uvs[idx * 2 + 1] = iz / (N - 1)
    }
  }

  const indices = new Uint32Array((N - 1) * (N - 1) * 6)
  let ti = 0
  for (let iz = 0; iz < N - 1; iz++) {
    for (let ix = 0; ix < N - 1; ix++) {
      const a = iz * N + ix
      const b = a + 1
      const c = a + N
      const e = c + 1
      indices[ti++] = a
      indices[ti++] = c
      indices[ti++] = b
      indices[ti++] = b
      indices[ti++] = c
      indices[ti++] = e
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: false,
  })

  // ── 받침대 슬랩 (측면 흙 + 위 잔디 테두리) ──────────────────
  const baseGroup = new THREE.Group()
  const baseDepth = d.base
  const rimH = d.rimHeight

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(size, rimH, size),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(d.rimColor), roughness: 1 }),
  )
  rim.position.y = -rimH * 0.5
  rim.receiveShadow = true
  baseGroup.add(rim)

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(size, baseDepth - rimH, size),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(d.soilColor), roughness: 1 }),
  )
  soil.position.y = -rimH - (baseDepth - rimH) * 0.5
  baseGroup.add(soil)

  // ── 빠른 높이 조회 (정점 격자 보간) ────────────────────────
  const field = {
    heights,
    minX: -half,
    minZ: -half,
    spanX: size,
    spanZ: size,
    gridSize: N,
  }
  const sampleHeight = createHeightFieldSampler(field)

  const isOnPath = (x, z, pad = 0) => nearestPathDist(x, z) < pathHalf + pad

  return {
    geometry,
    material,
    baseGroup,
    sampleHeight,
    isOnPath,
    size,
    half,
    margin,
    maxHeight,
  }
}

/** 절차적 언덕 디오라마 */
export function buildDiorama(rng) {
  const d = CONFIG.diorama
  const rawHeightAt = (x, z) => {
    let h = 0
    for (const hill of d.hills) {
      const dx = x - hill.x
      const dz = z - hill.z
      const r2 = (dx * dx + dz * dz) / (hill.r * hill.r)
      h += hill.amp * Math.exp(-r2)
    }
    h += (valueNoise(x * 0.06 + 11.3, z * 0.06 + 4.7) - 0.5) * d.surfaceNoise
    h += (valueNoise(x * 0.15 + 2.1, z * 0.15 + 9.9) - 0.5) * d.surfaceNoise * 0.4
    return h
  }
  return assembleDiorama(rng, rawHeightAt)
}

/** GLB 지형으로 디오라마 조립 (비동기) */
export function buildHillDiorama(url, rng, onProgress) {
  const d = CONFIG.diorama
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

          // 중심 정렬 + 바닥 0 + 디오라마 footprint에 맞춰 스케일
          const geo = src.geometry.clone()
          geo.computeBoundingBox()
          const box = geo.boundingBox
          const cx = (box.min.x + box.max.x) * 0.5
          const cz = (box.min.z + box.max.z) * 0.5
          geo.translate(-cx, -box.min.y, -cz)
          geo.computeBoundingBox()

          const sz = new THREE.Vector3()
          geo.boundingBox.getSize(sz)
          const span = Math.max(sz.x, sz.z, 0.001)
          // 가장자리 falloff가 잘 보이도록 footprint보다 살짝 크게 채운다
          const scaleXZ = (d.size * (d.glbFill ?? 1.08)) / span
          const targetH = d.glbHeight ?? 14
          const scaleY = targetH / Math.max(sz.y, 0.001)
          geo.scale(scaleXZ, scaleY, scaleXZ)
          geo.computeBoundingBox()

          // 높이필드 샘플러 생성 + 표면 스무딩(거친 디테일 완화)
          const field = buildHeightField(geo, d.glbGrid ?? 200)
          normalizeHeightField(field)
          blurField(field, d.glbSmooth ?? 4)
          const sampleGlb = createHeightFieldSampler(field)
          geo.dispose()

          const rawHeightAt = (x, z) => sampleGlb(x, z, 0)
          resolve(assembleDiorama(rng, rawHeightAt))
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
