import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { CONFIG } from '../config.js'
import vertexShader from '../shaders/post.vert'
import fragmentShader from '../shaders/post.frag'

// ─────────────────────────────────────────────────────────────
// PostFX — WebGI 스타일 품질 파이프라인 + 스케치 일러스트 무드
// RenderPass → GTAO(SSAO 음영) → Bloom → OutputPass(톤매핑)
//            → 스케치 무드 ShaderPass → SMAA(프로그레시브 AA)
// ─────────────────────────────────────────────────────────────
export class PostFX {
  constructor(renderer, camera) {
    this.renderer = renderer
    this.placeholderScene = new THREE.Scene()

    this.composer = new EffectComposer(renderer)

    this.renderPass = new RenderPass(this.placeholderScene, camera)
    this.composer.addPass(this.renderPass)

    // ── GTAO: 틈·접지 부분의 부드러운 음영 ──
    this.gtao = new GTAOPass(this.placeholderScene, camera, 1, 1)
    this.gtao.output = GTAOPass.OUTPUT.Default
    this.gtao.updateGtaoMaterial({
      radius: CONFIG.quality.aoRadius,
      distanceExponent: 1.0,
      thickness: 1.0,
      scale: CONFIG.quality.aoScale,
      samples: 16,
      distanceFallOff: 1.0,
      screenSpaceRadius: false,
    })
    this.gtao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 4,
      radiusExponent: 1,
      rings: 2,
      samples: 16,
    })
    this.composer.addPass(this.gtao)

    // ── 부드러운 블룸 (밝은 하늘·하이라이트 발광) ──
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      CONFIG.quality.bloomStrength,
      CONFIG.quality.bloomRadius,
      CONFIG.quality.bloomThreshold,
    )
    this.composer.addPass(this.bloom)

    // 톤매핑 + sRGB → 이후 스케치 패스는 디스플레이 색상에서 동작
    this.output = new OutputPass()
    this.composer.addPass(this.output)

    // ── 스케치/일러스트 무드 ──
    const p = CONFIG.painterly
    this.sketch = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uEdgeThreshold: { value: p.edgeThreshold },
        uEdgeSoftness: { value: p.edgeSoftness },
        uInkColor: { value: new THREE.Color(p.inkColor) },
        uInkStrength: { value: p.inkStrength },
        uHatchScale: { value: p.hatchScale },
        uHatchStrength: { value: p.hatchStrength },
        uHatchInk: { value: new THREE.Color(p.hatchInk) },
        uCelLevels: { value: p.celLevels },
        uCelMix: { value: p.celMix },
        uPaper: { value: p.paper },
        uPaperScale: { value: p.paperScale },
        uWash: { value: p.wash },
        uWashColor: { value: new THREE.Color(p.washColor) },
        uSaturation: { value: p.saturation },
        uLift: { value: p.lift },
        uShadowTint: { value: new THREE.Color(p.shadowTint) },
        uHighlightTint: { value: new THREE.Color(p.highlightTint) },
        uVignette: { value: p.vignette },
      },
      vertexShader,
      fragmentShader,
    })
    this.composer.addPass(this.sketch)

    // ── 안티앨리어싱 (가장자리 정리) ──
    this.smaa = new SMAAPass(1, 1)
    this.composer.addPass(this.smaa)
  }

  resize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    const w = Math.max(1, Math.floor(width * pixelRatio))
    const h = Math.max(1, Math.floor(height * pixelRatio))
    this.sketch.uniforms.uResolution.value.set(w, h)
  }

  render(scene, camera, elapsed, atmosphere = null) {
    this.renderPass.scene = scene
    this.renderPass.camera = camera
    this.gtao.scene = scene
    this.gtao.camera = camera

    const u = this.sketch.uniforms
    const p = CONFIG.painterly
    u.uTime.value = elapsed

    if (!atmosphere?.mood) {
      u.uEdgeThreshold.value = p.edgeThreshold
      u.uEdgeSoftness.value = p.edgeSoftness
      u.uInkColor.value.set(p.inkColor)
      u.uInkStrength.value = p.inkStrength
      u.uHatchScale.value = p.hatchScale
      u.uHatchStrength.value = p.hatchStrength
      u.uHatchInk.value.set(p.hatchInk)
      u.uCelLevels.value = p.celLevels
      u.uCelMix.value = p.celMix
      u.uPaper.value = p.paper
      u.uPaperScale.value = p.paperScale
      u.uWash.value = p.wash
      u.uWashColor.value.set(p.washColor)
      u.uSaturation.value = p.saturation
      u.uLift.value = p.lift
      u.uShadowTint.value.set(p.shadowTint)
      u.uHighlightTint.value.set(p.highlightTint)
      u.uVignette.value = p.vignette
    }

    this.composer.render()
  }

  applyAtmosphere(mood) {
    const p = CONFIG.painterly
    const u = this.sketch.uniforms

    u.uInkColor.value.set(p.inkColor)
    u.uInkStrength.value = mood.inkStrength
    u.uHatchScale.value = p.hatchScale
    u.uHatchStrength.value = p.hatchStrength
    u.uHatchInk.value.set(p.hatchInk)
    u.uCelLevels.value = p.celLevels
    u.uCelMix.value = p.celMix
    u.uPaper.value = p.paper
    u.uPaperScale.value = p.paperScale
    u.uWash.value = mood.wash
    u.uWashColor.value.set(mood.washColor)
    u.uSaturation.value = mood.saturation
    u.uLift.value = mood.lift
    u.uShadowTint.value.set(mood.shadowTint)
    u.uHighlightTint.value.set(mood.highlightTint)
    u.uVignette.value = mood.vignette
    u.uEdgeThreshold.value = p.edgeThreshold
    u.uEdgeSoftness.value = p.edgeSoftness

    this.gtao.updateGtaoMaterial({ scale: mood.aoScale })
    this.bloom.strength = mood.bloomStrength
    this.bloom.threshold = mood.bloomThreshold
  }

  dispose() {
    this.composer.dispose()
  }
}
