import * as THREE from 'three'
import { CONFIG } from '../config.js'
import { SkyBackground } from './SkyBackground.js'

// ─────────────────────────────────────────────────────────────
// DayCycle — 아침 ↔ 점심 순환 (밤·핑크 없음, t=0≡t=1 매끈한 루프)
// ─────────────────────────────────────────────────────────────

const _a = new THREE.Color()
const _b = new THREE.Color()
const _out = new THREE.Color()

function lerpHex(hexA, hexB, t) {
  return _out.copy(_a.set(hexA)).lerp(_b.set(hexB), t).getHexString()
}

/** t∈[0,1] — 0·1=아침, 0.5=점심, 코사인으로 끊김 없이 순환 */
function cyclePhase(t) {
  return (1 - Math.cos(t * Math.PI * 2)) * 0.5
}

const SKY_MORNING = {
  top: '#72c8f4',
  bottom: '#89d8fa',
  horizon: '#a0e4fc',
  sunset: '#68c0ec',
}
const SKY_NOON = {
  top: '#74c8f2',
  bottom: '#98d8f8',
  horizon: '#b8e8fc',
  sunset: '#78c4ea',
}

const LIGHT_MORNING = { color: '#e8f4ff', ambient: 0.62, sun: 0.78 }
const LIGHT_NOON = { color: '#fff8e8', ambient: 1.1, sun: 1.52 }

/** 배경 하늘 — 은은한 파스텔 */
function pastelizeSkyHex(hex) {
  _a.set(hex.startsWith('#') ? hex : `#${hex}`)
  const hsl = { h: 0, s: 0, l: 0 }
  _a.getHSL(hsl)
  hsl.s = Math.min(hsl.s * 0.82, 0.5)
  hsl.l = THREE.MathUtils.clamp(hsl.l * 0.98 + 0.02, 0.52, 0.86)
  return _a.setHSL(hsl.h, hsl.s, hsl.l).getHexString()
}

function sampleSky(t) {
  const p = cyclePhase(t)
  const raw = {}
  for (const key of Object.keys(SKY_MORNING)) {
    raw[key] = lerpHex(SKY_MORNING[key], SKY_NOON[key], p)
  }
  const sky = {}
  for (const key of Object.keys(raw)) {
    sky[key] = pastelizeSkyHex(raw[key])
  }
  return sky
}

/** 하늘 색 → 숲 조명·그림자·포스트 무드 */
function computeForestMood(sky, celestial, t) {
  const p = cyclePhase(t)
  const golden = Math.exp(-Math.pow((p - 1) / 0.16, 2)) * 0.72

  const trackLight = `#${lerpHex(LIGHT_MORNING.color, LIGHT_NOON.color, p)}`
  const sunMix = THREE.MathUtils.clamp(0.32 + p * 0.38 + golden * 0.12, 0.28, 0.72)
  const lightColor = `#${lerpHex(trackLight.slice(1), lerpHex(sky.horizon, sky.sunset, sunMix), 0.34)}`
  const ambientColor = `#${lerpHex(sky.horizon, sky.bottom, 0.44)}`
  const bounceColor = `#${lerpHex(lerpHex('#6ea14a', sky.bottom, 0.22), '#283018', 0)}`

  const ambient = THREE.MathUtils.lerp(LIGHT_MORNING.ambient, LIGHT_NOON.ambient, p)
  const sunIntensity = THREE.MathUtils.lerp(LIGHT_MORNING.sun, LIGHT_NOON.sun, p)

  const shadowTint = `#${lerpHex(lerpHex('#3a5848', sky.sunset, 0.14 + golden * 0.14), '#2a3040', 0)}`
  const highlightTint = `#${lerpHex(lerpHex('#f8fcff', sky.horizon, 0.18 + golden * 0.14), '#b8c8d8', 0)}`
  const washColor = `#${lerpHex(sky.horizon, sky.top, 0.36 + golden * 0.08)}`

  return {
    lightColor,
    ambientColor,
    bounceColor,
    ambient,
    sunIntensity,
    nightT: 0,
    dayT: 1,
    golden,
    shadowTint,
    highlightTint,
    washColor,
    saturation: 0.82 + golden * 0.06,
    lift: 0.02 + golden * 0.01,
    wash: 0.018 + golden * 0.014,
    vignette: 0.016,
    inkStrength: CONFIG.painterly.inkStrength * 0.78,
    aoScale: CONFIG.quality.aoScale * 1.42,
    bloomStrength: CONFIG.quality.bloomStrength + golden * 0.07,
    bloomThreshold: CONFIG.quality.bloomThreshold,
    exposure: 0.92 + p * 0.18 + golden * 0.06,
  }
}

export class DayCycle {
  constructor() {
    this.t = CONFIG.dayCycle.default
    this.renderer = null
    this.skyBackground = new SkyBackground()
    this._atmosphere = this.sample(this.t)
    this.skyBackground.update(this._atmosphere.sky, this._atmosphere.celestial)
  }

  sample(t) {
    const sky = sampleSky(t)
    const angle = t * Math.PI * 2
    const p = cyclePhase(t)
    const celestialX = Math.sin(angle) * 0.82
    const celestialY = p * 0.52 + 0.22
    const celestial = { x: celestialX, y: celestialY, isMoon: false, t }
    const mood = computeForestMood(sky, celestial, t)

    return {
      t,
      sky,
      celestial,
      mood,
      label: this._label(t),
    }
  }

  _label(t) {
    const p = cyclePhase(t)
    if (p > 0.38 && p < 0.62) return '점심'
    return '아침'
  }

  setTime(t) {
    this.t = THREE.MathUtils.clamp(t, 0, 1)
    this._atmosphere = this.sample(this.t)
    return this._atmosphere
  }

  get atmosphere() {
    return this._atmosphere
  }

  bindRenderer(renderer) {
    this.renderer = renderer
  }

  apply(forest, camera = null, postfx = null) {
    const a = this._atmosphere
    const m = a.mood

    this.skyBackground.update(a.sky, a.celestial, camera)

    if (this.renderer) {
      this.renderer.setClearColor(_a.set(`#${a.sky.bottom}`), 1)
      this.renderer.toneMappingExposure = m.exposure
    }

    if (forest?.scene) {
      forest.scene.background = this.skyBackground.texture
      if (!forest.scene.fog) forest.scene.fog = new THREE.Fog('#a0e4fc', 320, 1200)
      forest.scene.fog.color.set(`#${a.sky.horizon}`)
      forest.scene.fog.near = 300
      forest.scene.fog.far = 1420
    }

    if (forest?.sun) {
      forest.sun.color.set(m.lightColor)
      forest.sun.intensity = m.sunIntensity
      const dist = 170
      const p = cyclePhase(a.t)
      forest.sun.position.set(
        a.celestial.x * dist,
        Math.max(14, (a.celestial.y + 0.1) * dist),
        70,
      )
      forest.sun.target.position.set(0, 0, -30)
      forest.sun.target.updateMatrixWorld()
      forest.sun.shadow.radius = THREE.MathUtils.lerp(5.5, 9.0, p)
    }

    if (forest?.hemi) {
      forest.hemi.color.set(`#${a.sky.top}`)
      forest.hemi.groundColor.set(m.bounceColor)
      forest.hemi.intensity = 0.82 + m.golden * 0.1
    }

    if (forest?.ambient) {
      forest.ambient.color.set(m.ambientColor)
      forest.ambient.intensity = m.ambient * 0.78
    }

    postfx?.applyAtmosphere(m)
  }

  dispose() {
    this.skyBackground.dispose()
  }
}
