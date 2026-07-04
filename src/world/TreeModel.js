import * as THREE from 'three'
import { createGLTFLoader } from '../core/gltfLoader.js'
import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// TreeModel — Meshy GLB 로드 + InstancedMesh 배치
// ─────────────────────────────────────────────────────────────

function normalizeTreeGeometry(geometry, targetH) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const minY = box.min.y
  const maxY = box.max.y
  const span = Math.max(maxY - minY, 0.001)
  const pos = geometry.attributes.position

  // 캐노피 bbox가 아니라 맨 아래 기둥 발 기준으로 XZ 중심
  let cx = (box.min.x + box.max.x) * 0.5
  let cz = (box.min.z + box.max.z) * 0.5
  const probeTop = minY + span * 0.06
  let n = 0
  let sx = 0
  let sz = 0
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) <= probeTop) {
      sx += pos.getX(i)
      sz += pos.getZ(i)
      n++
    }
  }
  if (n > 6) {
    cx = sx / n
    cz = sz / n
  }

  geometry.translate(-cx, -minY, -cz)

  const norm = targetH / span
  geometry.scale(norm, norm, norm)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  return geometry
}

function paletteColors(hexList, fallback) {
  const list = hexList?.length ? hexList : [fallback]
  return list.map((h) => new THREE.Color(h))
}

/** 맨 아래 실린더 구간만 샘플 — 잎 tier가 기둥 반경에 끼어들지 않게 */
function estimateTrunkRadius(pos, minY, span, trunkRadiusRatio) {
  const probeTop = minY + span * 0.045
  const radii = []
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) <= probeTop) {
      radii.push(Math.hypot(pos.getX(i), pos.getZ(i)))
    }
  }
  if (!radii.length) return span * trunkRadiusRatio

  radii.sort((a, b) => a - b)
  const idx = Math.min(radii.length - 1, Math.floor(radii.length * 0.95))
  const cap = span * trunkRadiusRatio
  return THREE.MathUtils.clamp(radii[idx] * 1.1, span * 0.02, cap)
}

/** splitMode: tree | stem | foliage(전부 잎) | flower(줄기·잎·꽃) */
function bakePlantPartMask(geometry, { trunkRatio, trunkRadiusRatio, splitMode, flowerTopRatio }) {
  const pos = geometry.attributes.position
  const count = pos.count
  const minY = geometry.boundingBox.min.y
  const maxY = geometry.boundingBox.max.y
  const span = Math.max(maxY - minY, 0.001)

  const mask = new Float32Array(count)

  if (splitMode === 'foliage') {
    mask.fill(1)
    geometry.setAttribute('aPlantPart', new THREE.BufferAttribute(mask, 1))
    return { trunkTop: minY, trunkR: 0 }
  }

  if (splitMode === 'flower') {
    return {}
  }

  const trunkTop =
    minY + span * (splitMode === 'stem' ? trunkRatio : Math.min(trunkRatio, 0.1))
  const trunkR =
    splitMode === 'tree' ? estimateTrunkRadius(pos, minY, span, trunkRadiusRatio) : 0

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i)
    if (splitMode === 'stem') {
      mask[i] = y <= trunkTop ? 0 : 1
      continue
    }
    const r = Math.hypot(pos.getX(i), pos.getZ(i))
    mask[i] = y <= trunkTop && r <= trunkR ? 0 : 1
  }

  geometry.setAttribute('aPlantPart', new THREE.BufferAttribute(mask, 1))
  return { trunkTop, trunkR }
}

/** GLB 베이스컬러 텍스처 — 노란 꽃 / 초록 잎 UV 구분 */
function getTexturePixelData(texture) {
  const image = texture?.image
  if (!image?.width || !image?.height) return null

  const w = image.width
  const h = image.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
}

/** 텍스처 색 — 노란·크림 꽃 패치 (초록 잎 제외) */
function isFlowerTexel(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  if (max - min < 0.06) return false
  if (gn > 0.28 && gn > rn * 1.12 && gn > bn * 1.12) return false
  if (rn > 0.38 && gn > 0.32 && bn < 0.52 && rn + gn > bn * 2.2) return true
  return false
}

function buildFlowerTexGrid(pixelData, gridSize = 512) {
  const { data, width, height } = pixelData
  const grid = new Uint8Array(gridSize * gridSize)
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const px = Math.floor((gx / gridSize) * (width - 1))
      const py = Math.floor((1 - gy / gridSize) * (height - 1))
      const i = (py * width + px) * 4
      grid[gy * gridSize + gx] = isFlowerTexel(data[i], data[i + 1], data[i + 2]) ? 1 : 0
    }
  }
  return grid
}

function sampleFlowerGrid(grid, gridSize, u, v) {
  const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(u * gridSize)))
  const gy = Math.min(gridSize - 1, Math.max(0, Math.floor((1 - v) * gridSize)))
  return grid[gy * gridSize + gx] === 1
}

/** 꽃=텍스처 UV 노란 패치, 잎=초록 — 정수리 높이 슬라이스 사용 안 함 */
function bakeFlowerMaskFromTexture(geometry, texture, { trunkRatio }) {
  const uv = geometry.attributes.uv
  const pixelData = getTexturePixelData(texture)
  if (!uv || !pixelData) return false

  const pos = geometry.attributes.position
  const count = pos.count
  const minY = geometry.boundingBox.min.y
  const span = Math.max(geometry.boundingBox.max.y - minY, 0.001)
  const trunkTop = minY + span * trunkRatio
  const grid = buildFlowerTexGrid(pixelData)
  const gridSize = 512
  const mask = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i)
    if (y <= trunkTop) {
      mask[i] = 0
      continue
    }
    mask[i] = sampleFlowerGrid(grid, gridSize, uv.getX(i), uv.getY(i)) ? 1 : 0.25
  }

  geometry.setAttribute('aPlantPart', new THREE.BufferAttribute(mask, 1))
  return true
}

/** 꽃=로컬 돔 꼭짓점, 잎=그 아래 — 텍스처 없을 때 폴백 */
function bakeFlowerClusterMask(geometry, { trunkRatio, flowerBumpRatio, cellScale }) {
  const pos = geometry.attributes.position
  const count = pos.count
  const minY = geometry.boundingBox.min.y
  const maxY = geometry.boundingBox.max.y
  const span = Math.max(maxY - minY, 0.001)
  const trunkTop = minY + span * trunkRatio
  const cell = Math.max(span * cellScale, 0.04)

  const grid = new Map()
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`
    let bucket = grid.get(key)
    if (!bucket) {
      bucket = { minY: y, maxY: y, idx: [] }
      grid.set(key, bucket)
    }
    bucket.minY = Math.min(bucket.minY, y)
    bucket.maxY = Math.max(bucket.maxY, y)
    bucket.idx.push(i)
  }

  const mask = new Float32Array(count)
  const cellKey = (cx, cz) => `${cx},${cz}`

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (y <= trunkTop) {
      mask[i] = 0
      continue
    }

    const cx = Math.floor(x / cell)
    const cz = Math.floor(z / cell)
    let nhMin = Infinity
    let nhMax = -Infinity
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(cellKey(cx + dx, cz + dz))
        if (!bucket) continue
        nhMin = Math.min(nhMin, bucket.minY)
        nhMax = Math.max(nhMax, bucket.maxY)
      }
    }
    if (!Number.isFinite(nhMin)) {
      mask[i] = 0.25
      continue
    }

    const t = (y - nhMin) / Math.max(nhMax - nhMin, 0.001)
    mask[i] = t >= flowerBumpRatio ? 1 : 0.25
  }

  geometry.setAttribute('aPlantPart', new THREE.BufferAttribute(mask, 1))
}

/** 정점 컬러 — flower 모드: 0 기둥 / 0.25 잎 / 1 꽃 */
function bakeVertexColors(geometry, foliageColor, trunkColor, flowerColor = null) {
  const part = geometry.attributes.aPlantPart.array
  const colors = new Float32Array(part.length * 3)
  const flowerBase = flowerColor ?? new THREE.Color(1, 1, 1)
  for (let i = 0; i < part.length; i++) {
    let c = foliageColor
    if (flowerColor != null) {
      if (part[i] < 0.12) c = trunkColor
      else if (part[i] < 0.88) c = foliageColor
      else c = flowerBase
    } else {
      c = part[i] > 0.5 ? foliageColor : trunkColor
    }
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {(pct:number)=>void} [onProgress]
 */
export function loadTreeTemplate(url, options = {}, onProgress) {
  const loader = createGLTFLoader()
  const height = options.height ?? CONFIG.forest.treeModelHeight
  const baseMat = CONFIG.forest.plantMaterial ?? {}
  const materialCfg = { ...baseMat, ...options.material }

  const foliageColor = new THREE.Color(materialCfg.foliage ?? '#a1b15f')
  const trunkColor = new THREE.Color(
    materialCfg.trunk ?? materialCfg.trunkPalette?.[0] ?? CONFIG.forest.trunkPalette?.[0] ?? '#88826d',
  )
  const trunkPalette = paletteColors(
    materialCfg.trunkPalette ?? CONFIG.forest.trunkPalette,
    trunkColor.getStyle(),
  )

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        let src = null
        gltf.scene.traverse((o) => {
          if (o.isMesh && !src) src = o
        })
        if (!src) {
          reject(new Error(`GLB에 Mesh가 없습니다: ${url}`))
          return
        }

        const geometry = normalizeTreeGeometry(src.geometry.clone(), height)

        const radius =
          Math.max(
            geometry.boundingBox.max.x - geometry.boundingBox.min.x,
            geometry.boundingBox.max.z - geometry.boundingBox.min.z,
          ) * 0.5

        const trunkRatio = materialCfg.trunkRatio ?? 0.1
        const trunkRadiusRatio = materialCfg.trunkRadiusRatio ?? 0.052
        const splitMode = materialCfg.splitMode ?? 'tree'
        const flowerTexture = splitMode === 'flower' ? src.material?.map : null
        bakePlantPartMask(geometry, {
          trunkRatio,
          trunkRadiusRatio,
          splitMode,
          flowerTopRatio: materialCfg.flowerTopRatio,
        })
        if (splitMode === 'flower') {
          const ok = flowerTexture && bakeFlowerMaskFromTexture(geometry, flowerTexture, { trunkRatio })
          if (!ok) {
            bakeFlowerClusterMask(geometry, {
              trunkRatio,
              flowerBumpRatio: materialCfg.flowerTopRatio ?? 0.72,
              cellScale: 0.11,
            })
          }
        }

        const flowerPalette = (
          materialCfg.flowerPalette?.length
            ? materialCfg.flowerPalette
            : CONFIG.forest.flowerPalette
        )?.length
          ? paletteColors(
              materialCfg.flowerPalette?.length
                ? materialCfg.flowerPalette
                : CONFIG.forest.flowerPalette,
              foliageColor.getStyle(),
            )
          : null
        const foliagePalette = materialCfg.foliagePalette?.length
          ? paletteColors(materialCfg.foliagePalette, foliageColor.getStyle())
          : null
        const randomFlowers = !!(
          splitMode === 'flower' &&
          (materialCfg.randomFlowers ?? materialCfg.randomFoliage) &&
          (flowerPalette?.length || foliagePalette?.length)
        )
        const randomFoliage = !!(
          splitMode !== 'flower' &&
          materialCfg.randomFoliage &&
          foliagePalette?.length
        )
        const instancePalette = randomFlowers
          ? flowerPalette ?? foliagePalette
          : foliagePalette

        if (randomFlowers) {
          bakeVertexColors(geometry, foliageColor, trunkColor, new THREE.Color(1, 1, 1))
        } else {
          bakeVertexColors(
            geometry,
            randomFoliage ? new THREE.Color(1, 1, 1) : foliageColor,
            trunkColor,
          )
        }

        const useFlowerTint = splitMode === 'flower'

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: materialCfg.roughness ?? 0.9,
          metalness: 0.0,
          flatShading: false,
          vertexColors: true,
        })

        material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying float vPlantPart;\nattribute float aPlantPart;',
            )
            .replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\n  vPlantPart = aPlantPart;',
            )

          if (useFlowerTint) {
            shader.vertexShader = shader.vertexShader.replace(
              '#include <color_vertex>',
              `#include <color_vertex>
#if defined USE_INSTANCING_COLOR && defined USE_COLOR
  if (aPlantPart < 0.88) {
    vColor.rgb = color.rgb;
  }
#endif`,
            )
          }

          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying float vPlantPart;',
            )
            .replace(
              '#include <emissivemap_fragment>',
              useFlowerTint
                ? `#include <emissivemap_fragment>
  float trunkW = vPlantPart < 0.12 ? 1.0 : 0.0;
  totalEmissiveRadiance += diffuseColor.rgb * trunkW * 0.05;`
                : `#include <emissivemap_fragment>
  float trunkW = 1.0 - vPlantPart;
  totalEmissiveRadiance += diffuseColor.rgb * trunkW * 0.92;`,
            )
        }
        material.customProgramCacheKey = () => {
          const fp = materialCfg.flowerPalette ?? CONFIG.forest.flowerPalette ?? []
          return `plant-v14-${useFlowerTint ? 'flower' : 'tree'}-${splitMode}-${fp.join('')}-${materialCfg.foliage}-${trunkColor.getHexString()}-${randomFoliage || randomFlowers ? 'rand' : 'fix'}`
        }

        resolve({
          geometry,
          material,
          height,
          radius,
          id: options.id ?? url,
          trunkPalette,
          trunkColor,
          foliagePalette: instancePalette,
          randomFoliage,
          randomFlowers,
        })
      },
      (ev) => {
        if (onProgress && ev.total) onProgress(ev.loaded / ev.total)
      },
      reject,
    )
  })
}

export async function loadAllTreeTemplates(models, onProgress) {
  const templates = []
  for (let i = 0; i < models.length; i++) {
    const m = models[i]
    const t = await loadTreeTemplate(m.url, m, (p) => {
      if (onProgress) onProgress((i + p) / models.length)
    })
    templates.push(t)
    if (onProgress) onProgress((i + 1) / models.length)
  }
  return templates
}

/** InstancedMesh — 나무는 템플릿 기둥색, 덩굴 등은 foliagePalette 랜덤 */
export function createTreeInstances(template, placements, options = {}) {
  const pickable = options.pickable ?? 'tree'
  const mesh = new THREE.InstancedMesh(template.geometry, template.material, placements.length)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()

  const rand = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  for (let i = 0; i < placements.length; i++) {
    const t = placements[i]
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotY)
    s.setScalar(t.scale)
    p.set(t.x, t.y ?? 0, t.z)
    m.compose(p, q, s)
    mesh.setMatrixAt(i, m)
  }

  if ((template.randomFoliage || template.randomFlowers) && template.foliagePalette?.length) {
    const palette = template.foliagePalette
    const colors = new Float32Array(placements.length * 3)
    for (let i = 0; i < placements.length; i++) {
      const seed = (placements[i].seed ?? i) + (template.id?.length ?? 0) * 0.31
      const idx = Math.floor(rand(seed + 7.3) * palette.length) % palette.length
      const c = palette[idx]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
  }

  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.frustumCulled = false
  mesh.userData.interactive = pickable
  mesh.userData.isInstancedTrees = pickable === 'tree'
  return mesh
}

export function treeFocusRoot(placement) {
  return {
    userData: { focusY: placement.focusY },
    getWorldPosition(target) {
      return target.set(placement.x, placement.y ?? 0, placement.z)
    },
  }
}
