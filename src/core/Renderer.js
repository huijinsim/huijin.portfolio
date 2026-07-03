import * as THREE from 'three'
import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// Renderer — WebGLRenderer + 카메라 래퍼
// ─────────────────────────────────────────────────────────────
export class Renderer {
  constructor(container) {
    this.container = container

    this.instance = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.instance.setClearColor(new THREE.Color(CONFIG.renderer.clearColor), 1)
    this.instance.outputColorSpace = THREE.SRGBColorSpace
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = CONFIG.renderer.toneMappingExposure ?? 1.0
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.instance.domElement)

    const ov = CONFIG.camera.home
    this.camera = new THREE.PerspectiveCamera(
      ov.fov,
      1,
      CONFIG.camera.near,
      CONFIG.camera.far,
    )
    this.camera.position.set(...ov.position)
    this.camera.lookAt(new THREE.Vector3(...ov.target))

    this.resize()
  }

  resize() {
    const rect = this.container.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    this.aspect = w / h

    const dpr = Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio)
    this.instance.setPixelRatio(dpr)
    // CSS(100%)로 표시 크기를 맞추고, 버퍼만 실제 픽셀에 맞춘다
    this.instance.setSize(w, h, false)

    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  render(scene, camera = this.camera) {
    this.instance.render(scene, camera)
  }

  dispose() {
    this.instance.dispose()
    this.instance.domElement.remove()
  }
}
