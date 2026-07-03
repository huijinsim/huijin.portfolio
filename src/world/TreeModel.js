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

/** splitMode: tree | stem | foliage(전부 잎) */
function bakePlantPartMask(geometry, { trunkRatio, trunkRadiusRatio, splitMode }) {
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

/** 정점 컬러로 기둥/잎색 고정 — InstancedMesh에서도 확실히 보임 */
function bakeVertexColors(geometry, foliageColor, trunkColor) {
  const part = geometry.attributes.aPlantPart.array
  const colors = new Float32Array(part.length * 3)
  for (let i = 0; i < part.length; i++) {
    const c = part[i] > 0.5 ? foliageColor : trunkColor
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

        if (materialCfg.preserveOriginal) {
          const srcMat = Array.isArray(src.material) ? src.material[0] : src.material
          const material = srcMat?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
          material.roughness = materialCfg.roughness ?? material.roughness ?? 0.9
          material.metalness = 0

          resolve({
            geometry,
            material,
            height,
            radius,
            id: options.id ?? url,
            trunkPalette,
            trunkColor,
            foliagePalette: null,
            randomFoliage: false,
          })
          return
        }

        const trunkRatio = materialCfg.trunkRatio ?? 0.1
        const trunkRadiusRatio = materialCfg.trunkRadiusRatio ?? 0.052
        const splitMode = materialCfg.splitMode ?? 'tree'
        bakePlantPartMask(geometry, {
          trunkRatio,
          trunkRadiusRatio,
          splitMode,
        })

        const foliagePalette = materialCfg.foliagePalette?.length
          ? paletteColors(materialCfg.foliagePalette, foliageColor.getStyle())
          : null
        const randomFoliage = !!(materialCfg.randomFoliage && foliagePalette?.length)
        bakeVertexColors(
          geometry,
          randomFoliage ? new THREE.Color(1, 1, 1) : foliageColor,
          trunkColor,
        )

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
            .replace(
              '#include <color_vertex>',
              `#include <color_vertex>
#if defined USE_INSTANCING_COLOR && defined USE_COLOR
  if (aPlantPart < 0.5) {
    vColor.rgb = color.rgb;
  }
#endif`,
            )

          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying float vPlantPart;',
            )
            .replace(
              '#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
  float trunkW = 1.0 - vPlantPart;
  totalEmissiveRadiance += diffuseColor.rgb * trunkW * 0.14;`,
            )
        }
        material.customProgramCacheKey = () =>
          `plant-v9-trunk-${splitMode}-${materialCfg.foliage}-${trunkColor.getHexString()}-${randomFoliage ? 'rand' : 'fix'}`

        resolve({
          geometry,
          material,
          height,
          radius,
          id: options.id ?? url,
          trunkPalette,
          trunkColor,
          foliagePalette,
          randomFoliage,
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

  if (template.randomFoliage && template.foliagePalette?.length) {
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
