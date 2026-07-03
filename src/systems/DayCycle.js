import * as THREE from 'three'
import { CONFIG } from '../config.js'
import { SkyBackground } from './SkyBackground.js'

// ─────────────────────────────────────────────────────────────
// DayCycle — 슬라이더 색 → 배경 + 숲 조명·그림자·포스트 무드
// ─────────────────────────────────────────────────────────────

const _a = new THREE.Color()
const _b = new THREE.Color()
const _out = new THREE.Color()

function lerpHex(hexA, hexB, t) {
  return _out.copy(_a.set(hexA)).lerp(_b.set(hexB), t).getHexString()
}

function sampleTrack(keyframes, t, fields) {
  let i = 0
  while (i < keyframes.length - 2 && keyframes[i + 1].t <= t) i += 1
  const left = keyframes[i]
  const right = keyframes[i + 1]
  const local = THREE.MathUtils.clamp((t - left.t) / (right.t - left.t || 1), 0, 1)
  const result = {}
  for (const f of fields) {
    result[f] = lerpHex(left[f], right[f], local)
  }
  return result
}

function sampleNumberTrack(keyframes, t, field) {
  let i = 0
  while (i < keyframes.length - 2 && keyframes[i + 1].t <= t) i += 1
  const left = keyframes[i]
  const right = keyframes[i + 1]
  const local = THREE.MathUtils.clamp((t - left.t) / (right.t - left.t || 1), 0, 1)
  return THREE.MathUtils.lerp(left[field], right[field], local)
}

/** 배경 하늘 — 은은한 파스텔, 시간대별로 살짝만 변화 */
function pastelizeSkyHex(hex, t) {
  _a.set(hex.startsWith('#') ? hex : `#${hex}`)
  const hsl = { h: 0, s: 0, l: 0 }
  _a.getHSL(hsl)
  const nightT = THREE.MathUtils.smoothstep(0.55, 1, t)

  if (nightT > 0.35) {
    hsl.s = Math.min(hsl.s * 0.78, 0.38)
    hsl.l = THREE.MathUtils.clamp(hsl.l, 0.14, 0.36)
    return _a.setHSL(hsl.h, hsl.s, hsl.l).getHexString()
  }

  if (hsl.h > 0.48 && hsl.h < 0.68) {
    hsl.s = Math.min(hsl.s * 1.02, 0.68)
    hsl.l = THREE.MathUtils.clamp(hsl.l, 0.56, 0.8)
    return _a.setHSL(hsl.h, hsl.s, hsl.l).getHexString()
  }

  hsl.s = Math.min(hsl.s * 0.8, 0.46)
  hsl.l = THREE.MathUtils.clamp(hsl.l * 0.98 + 0.02, 0.5, 0.86)
  return _a.setHSL(hsl.h, hsl.s, hsl.l).getHexString()
}

const SKY_TRACK = [
  { t: 0.0, top: '#72c8f4', bottom: '#89d8fa', horizon: '#a0e4fc', sunset: '#68c0ec' },
  { t: 0.25, top: '#74c8f2', bottom: '#98d8f8', horizon: '#b8e8fc', sunset: '#78c4ea' },
  { t: 0.5, top: '#6ec4f0', bottom: '#a4dcf6', horizon: '#c8ecfa', sunset: '#70c0e8' },
  { t: 0.75, top: '#a8b0c8', bottom: '#c8b8b0', horizon: '#dcc8c0', sunset: '#c0a8a0' },
  { t: 1.0, top: '#3d4540', bottom: '#4a5048', horizon: '#5a6058', sunset: '#484e48' },
]

const LIGHT_TRACK = [
  { t: 0.0, color: '#e8f4ff', ambient: 0.62, sun: 0.78 },
  { t: 0.25, color: '#fff8e8', ambient: 1.02, sun: 1.42 },
  { t: 0.5, color: '#ffffff', ambient: 1.1, sun: 1.52 },
  { t: 0.75, color: '#ffe8d8', ambient: 0.72, sun: 1.02 },
  { t: 1.0, color: '#7888a0', ambient: 0.22, sun: 0.18 },
]

/** 하늘 색 → 숲 조명·그림자·포스트 무드 */
function computeForestMood(sky, celestial, t) {
  const nightT = THREE.MathUtils.smoothstep(0.52, 1, t)
  const dayT = 1 - nightT
  const sunArc = Math.sin(t * Math.PI)
  const golden =
    Math.exp(-Math.pow((t - 0.28) / 0.11, 2)) * 0.85 +
    Math.exp(-Math.pow((t - 0.72) / 0.1, 2)) * 0.75

  const trackLight = sampleTrack(LIGHT_TRACK, t, ['color']).color
  const sunMix = celestial.isMoon
    ? 0.16
    : THREE.MathUtils.clamp(0.28 + sunArc * 0.52 + golden * 0.16, 0.22, 0.78)
  const lightColor = `#${lerpHex(trackLight, lerpHex(sky.horizon, sky.sunset, sunMix), 0.34)}`
  const ambientColor = `#${lerpHex(sky.horizon, sky.bottom, 0.44 + nightT * 0.16)}`
  const bounceColor = `#${lerpHex(
    lerpHex('#6ea14a', sky.bottom, 0.22),
    '#283018',
    nightT * 0.62,
  )}`

  const ambient = sampleNumberTrack(LIGHT_TRACK, t, 'ambient')
  const sunIntensity = sampleNumberTrack(LIGHT_TRACK, t, 'sun')

  const shadowTint = `#${lerpHex(
    lerpHex('#3a5848', sky.sunset, 0.14 + golden * 0.14),
    '#2a3040',
    nightT * 0.72,
  )}`
  const highlightTint = `#${lerpHex(
    lerpHex('#f8fcff', sky.horizon, 0.18 + golden * 0.14),
    '#b8c8d8',
    nightT * 0.5,
  )}`
  const washColor = `#${lerpHex(sky.horizon, sky.top, 0.36 + golden * 0.08)}`

  return {
    lightColor,
    ambientColor,
    bounceColor,
    ambient,
    sunIntensity,
    nightT,
    dayT,
    golden,
    shadowTint,
    highlightTint,
    washColor,
    saturation: THREE.MathUtils.lerp(0.7, 0.88, dayT) + golden * 0.06,
    lift: THREE.MathUtils.lerp(0.012, 0.026, dayT) + golden * 0.01,
    wash: THREE.MathUtils.lerp(0.026, 0.01, dayT) + golden * 0.014,
    vignette: THREE.MathUtils.lerp(0.016, 0.11, nightT),
    inkStrength: THREE.MathUtils.lerp(CONFIG.painterly.inkStrength * 0.78, CONFIG.painterly.inkStrength * 1.22, nightT),
    aoScale: THREE.MathUtils.lerp(CONFIG.quality.aoScale * 1.42, CONFIG.quality.aoScale * 0.64, dayT),
    bloomStrength: THREE.MathUtils.lerp(0.032, CONFIG.quality.bloomStrength, dayT) + golden * 0.07,
    bloomThreshold: THREE.MathUtils.lerp(0.72, CONFIG.quality.bloomThreshold, dayT),
    exposure: THREE.MathUtils.lerp(0.84, 1.1, dayT) + golden * 0.06,
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
    const raw = sampleTrack(SKY_TRACK, t, ['top', 'bottom', 'horizon', 'sunset'])
    const sky = {}
    for (const key of Object.keys(raw)) {
      sky[key] = pastelizeSkyHex(raw[key], t)
    }

    const celestialX = THREE.MathUtils.lerp(-0.92, 0.92, t)
    const celestialY = Math.sin(t * Math.PI) * 0.58 + 0.22
    const isMoon = t >= 0.5
    const celestial = { x: celestialX, y: celestialY, isMoon, t }
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
    if (t < 0.18) return '아침'
    if (t < 0.38) return '오전'
    if (t < 0.58) return '점심'
    if (t < 0.78) return '저녁'
    return '밤'
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
      forest.scene.fog.near = THREE.MathUtils.lerp(300, 58, m.nightT)
      forest.scene.fog.far = THREE.MathUtils.lerp(1420, 360, m.nightT)
    }

    if (forest?.sun) {
      forest.sun.color.set(m.lightColor)
      forest.sun.intensity = m.sunIntensity
      const dist = 170
      forest.sun.position.set(
        a.celestial.x * dist,
        Math.max(14, (a.celestial.y + 0.1) * dist),
        70,
      )
      forest.sun.target.position.set(0, 0, -30)
      forest.sun.target.updateMatrixWorld()
      forest.sun.shadow.radius = THREE.MathUtils.lerp(3.8, 9.0, m.dayT)
    }

    if (forest?.hemi) {
      forest.hemi.color.set(`#${a.sky.top}`)
      forest.hemi.groundColor.set(m.bounceColor)
      forest.hemi.intensity = THREE.MathUtils.lerp(0.52, 1.02, m.dayT) + m.golden * 0.1
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
