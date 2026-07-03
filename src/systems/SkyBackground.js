import * as THREE from 'three'
import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// SkyBackground — scene.background: 하늘 그라데이션 + 2D 산 실루엣
// ─────────────────────────────────────────────────────────────

const _fwd = new THREE.Vector3()

function cssHex(c) {
  return c.startsWith('#') ? c : `#${c}`
}

function mixHex(hexA, hexB, t) {
  const a = new THREE.Color(cssHex(hexA))
  const b = new THREE.Color(cssHex(hexB))
  return `#${a.lerp(b, t).getHexString()}`
}

/** 카메라 피치 → 캔버스 지평선 Y (위에서부터 0…h) */
export function computeHorizonCanvasY(camera, canvasH) {
  const fallback = canvasH * (CONFIG.skyMountains.horizonFallback ?? 0.32)
  if (!camera) return fallback

  camera.getWorldDirection(_fwd)
  const pitch = Math.atan2(-_fwd.y, Math.hypot(_fwd.x, _fwd.z))
  if (pitch <= 0.01) return fallback

  const vFovRad = (camera.fov * Math.PI) / 180
  const ndcY = Math.tan(pitch) / Math.tan(vFovRad * 0.5)
  const fromTop = THREE.MathUtils.clamp(0.5 - ndcY * 0.5, 0.22, 0.58)
  return fromTop * canvasH
}

/** 각진 봉우리 실루엣 — x: 0…width */
function sampleRidge(x, w, peaks) {
  let ridge = 0
  for (const p of peaks) {
    const cx = p.x * w
    const half = p.spread * w * 0.5
    const dist = Math.abs(x - cx)
    if (dist < half) {
      const t = 1 - dist / half
      ridge = Math.max(ridge, p.h * w * t)
    }
  }
  return ridge
}

function drawMountainLayer(ctx, w, h, horizonY, peaks, color, depth = 1) {
  ctx.beginPath()
  ctx.moveTo(0, h)
  const step = Math.max(2, Math.floor(w / 160))
  for (let x = 0; x <= w; x += step) {
    const ridge = sampleRidge(x, w, peaks) * depth
    ctx.lineTo(x, horizonY - ridge)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function mountainColors(sky, nightT) {
  const cfg = CONFIG.skyMountains
  const far = mixHex(cfg.tint, sky.horizon, cfg.farSkyMix ?? 0.28)
  const mid = mixHex(cfg.tintMid ?? cfg.tint, sky.sunset, cfg.midSkyMix ?? 0.22)
  const near = mixHex(cfg.tintNear ?? cfg.tint, sky.bottom, cfg.nearSkyMix ?? 0.18)

  if (nightT <= 0) return { far, mid, near }

  const night = cfg.nightTint
  return {
    far: mixHex(far, night, nightT * 0.55),
    mid: mixHex(mid, night, nightT * 0.68),
    near: mixHex(near, night, nightT * 0.78),
  }
}

export class SkyBackground {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 512
    this.ctx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
  }

  _drawMountains(sky, nightT, horizonY) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const layers = CONFIG.skyMountains.layers
    const colors = mountainColors(sky, nightT)
    const layerColors = [colors.far, colors.mid, colors.near]

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const baseY = horizonY + h * (layer.yOffset ?? 0)
      drawMountainLayer(
        ctx,
        w,
        h,
        baseY,
        layer.peaks,
        layerColors[i] ?? colors.near,
        layer.depth ?? 1,
      )
    }
  }

  /** @param {object} sky — top/bottom/horizon/sunset */
  /** @param {{ x: number, y: number, isMoon: boolean, t?: number }} celestial */
  /** @param {THREE.Camera} [camera] */
  update(sky, celestial, camera = null) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    const grad = ctx.createLinearGradient(0, h, 0, 0)
    grad.addColorStop(0, cssHex(sky.bottom))
    grad.addColorStop(0.32, cssHex(sky.horizon))
    grad.addColorStop(0.52, cssHex(sky.sunset))
    grad.addColorStop(1, cssHex(sky.top))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    const nightT = celestial.t != null ? THREE.MathUtils.smoothstep(0.62, 1, celestial.t) : 0
    const dayT = 1 - nightT

    if (dayT > 0.02) {
      const cx = w * 0.5
      const cy = h * 0.22
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55)
      glow.addColorStop(0, mixHex(sky.top, '#ffffff', 0.35 * dayT))
      glow.addColorStop(0.5, mixHex(sky.horizon, '#d8f4ff', 0.2 * dayT))
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalAlpha = 0.28 * dayT
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }

    if (CONFIG.skyMountains.layers.length > 0) {
      const horizonY = computeHorizonCanvasY(camera, h)
      this._drawMountains(sky, nightT, horizonY)
    }

    if (nightT > 0.02) {
      const sx = (celestial.x * 0.5 + 0.5) * w
      const sy = (0.74 - celestial.y * 0.38) * h
      const isMoon = celestial.isMoon

      ctx.beginPath()
      ctx.arc(sx, sy, w * 0.022, 0, Math.PI * 2)
      ctx.fillStyle = isMoon ? '#d8e0ec' : '#f0e8b0'
      ctx.fill()
    }

    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}
