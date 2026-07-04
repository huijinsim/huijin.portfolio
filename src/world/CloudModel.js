import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// CloudModel — GLB 구름 로드 (중심 정렬 + 목표 크기로 정규화)
// ─────────────────────────────────────────────────────────────

export function loadCloudTemplate(url, options = {}, onProgress) {
  const loader = new GLTFLoader()
  const target = options.size ?? 16

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene
        const box = new THREE.Box3().setFromObject(root)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)

        // 원점 중심으로 이동 후, 목표 가로폭에 맞춰 스케일
        root.position.set(-center.x, -center.y, -center.z)
        const wrap = new THREE.Group()
        wrap.add(root)
        const s = target / Math.max(size.x, size.z, 0.001)
        wrap.scale.setScalar(s)

        root.traverse((o) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              roughness: 0.92,
              metalness: 0,
              transparent: true,
              opacity: CONFIG.clouds.opacity ?? 0.9,
              depthWrite: false,
            })
            o.castShadow = false
            o.receiveShadow = false
            o.frustumCulled = false
            o.userData.interactive = null
          }
        })

        resolve({ id: options.id ?? url, object: wrap })
      },
      (ev) => {
        if (onProgress && ev.total) onProgress(ev.loaded / ev.total)
      },
      reject,
    )
  })
}

export async function loadCloudTemplates(models, onProgress) {
  const templates = []
  for (let i = 0; i < models.length; i++) {
    const m = models[i]
    const t = await loadCloudTemplate(m.url, m, (p) => {
      if (onProgress) onProgress((i + p) / models.length)
    })
    templates.push(t)
    if (onProgress) onProgress((i + 1) / models.length)
  }
  return templates
}
