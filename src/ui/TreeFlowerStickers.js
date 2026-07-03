import * as THREE from 'three'
import gsap from 'gsap'
import { CONFIG } from '../config.js'

const _base = new THREE.Vector3()
const _top = new THREE.Vector3()

const DEFAULT_CLUSTERS = [
  { cx: -0.98, cy: -0.45, radius: 0.26 },
  { cx: -0.98, cy: 0.16, radius: 0.28 },
  { cx: 0.98, cy: -0.45, radius: 0.26 },
  { cx: 0.98, cy: 0.16, radius: 0.28 },
]

// ─────────────────────────────────────────────────────────────
// TreeFlowerStickers — 좌·우 4구역 원형 클러스터로 꽃이 피어남
// ─────────────────────────────────────────────────────────────
export class TreeFlowerStickers {
  constructor(container) {
    this.container = container
    this.cfg = CONFIG.interaction.flowerStickers ?? {}
    this.urls = this.cfg.urls ?? [
      '/flower/flower_14.PNG',
      '/flower/flower_15.PNG',
      '/flower/flower_16.PNG',
      '/flower/flower_17.PNG',
    ]
    this.primaryUrls = this.cfg.primaryUrls ?? [
      '/flower/flower_15.PNG',
      '/flower/flower_16.PNG',
    ]
    this.secondaryUrls = this.cfg.secondaryUrls ?? [
      '/flower/flower_14.PNG',
      '/flower/flower_17.PNG',
    ]

    this.root = document.createElement('div')
    this.root.id = 'tree-flower-stickers'
    this.root.innerHTML = /* html */ `
      <style>
        #tree-flower-stickers {
          position: absolute; inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 13;
        }
        #tree-flower-stickers .flower {
          position: absolute;
          left: 0; top: 0;
          transform-origin: center center;
          will-change: transform, opacity;
          filter: drop-shadow(0 2px 6px rgba(40, 55, 30, 0.18));
          user-select: none;
          -webkit-user-drag: none;
        }
        #tree-flower-stickers .flower img {
          display: block;
          width: 100%;
          height: auto;
        }
      </style>
    `
    container.appendChild(this.root)

    this.stickers = []
    this.placement = null
    this.active = false
    this._baseX = 0
    this._baseY = 0
    this._treeH = 220
    this._viewW = 0
    this._viewH = 0
  }

  _rand(seed, i) {
    const x = Math.sin((seed + i) * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  _pickUrl(rand, i) {
    const weight = this.cfg.primaryWeight ?? 0.78
    if (rand(i + 3.3) < weight) {
      const list = this.primaryUrls
      return list[Math.floor(rand(i + 5.1) * list.length)]
    }
    const list = this.secondaryUrls
    return list[Math.floor(rand(i + 7.4) * list.length)]
  }

  _buildClusterSlots(seed) {
    const rand = (i) => this._rand(seed, i)
    const clusters = this.cfg.clusters ?? DEFAULT_CLUSTERS
    const perCluster = this.cfg.perCluster ?? 10
    const scaleMin = this.cfg.scaleMin ?? 0.84
    const scaleMax = this.cfg.scaleMax ?? 1.22
    const slots = []
    let idx = 0

    for (let c = 0; c < clusters.length; c++) {
      const { cx, cy, radius } = clusters[c]
      for (let j = 0; j < perCluster; j++) {
        const angle = rand(idx + 0.4) * Math.PI * 2
        const dist = Math.sqrt(rand(idx + 1.8)) * radius
        const rx = cx + Math.cos(angle) * dist
        const ry = cy + Math.sin(angle) * dist * 0.82
        const scale = scaleMin + rand(idx + 2.5) * (scaleMax - scaleMin)
        const url = this._pickUrl(rand, idx + c * 17 + j * 3)
        const clusterDist = Math.hypot(rx - cx, (ry - cy) / 0.82)

        slots.push({ rx, ry, scale, url, cluster: c, clusterDist, idx })
        idx++
      }
    }

    slots.sort((a, b) => {
      if (a.cluster !== b.cluster) return a.cluster - b.cluster
      return a.clusterDist - b.clusterDist
    })

    return slots
  }

  burst(placement, camera) {
    this.clear(false)
    this.active = true
    this.placement = placement

    const stagger = this.cfg.stagger ?? 0.038
    const clusterGap = this.cfg.clusterGap ?? 0.16
    const radialStagger = this.cfg.radialStagger ?? 0.055
    const popDuration = this.cfg.popDuration ?? 0.5
    const seed = placement.x * 19.7 + placement.z * 11.3 + (placement.rotY ?? 0)
    const rand = (i) => this._rand(seed, i)

    const slots = this._buildClusterSlots(seed)

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const delay =
        slot.cluster * clusterGap +
        slot.clusterDist * radialStagger +
        slot.idx * stagger * 0.15 +
        rand(i) * 0.025
      const rot = (rand(i + 6) - 0.5) * 48

      const el = document.createElement('div')
      el.className = 'flower'
      const img = document.createElement('img')
      img.src = slot.url
      img.alt = ''
      img.draggable = false
      el.appendChild(img)
      this.root.appendChild(el)

      const entry = { el, rx: slot.rx, ry: slot.ry, scale: slot.scale, rot, tweens: [] }
      this.stickers.push(entry)

      gsap.set(el, { xPercent: -50, yPercent: -50, scale: 0, rotation: rot - 42, opacity: 0 })

      entry.tweens.push(
        gsap.to(el, {
          scale: slot.scale,
          rotation: rot,
          opacity: 1,
          duration: popDuration,
          delay,
          ease: 'back.out(2.6)',
        }),
      )
      entry.tweens.push(
        gsap.to(el, {
          rotation: rot + (rand(i + 9) > 0.5 ? 8 : -8),
          duration: 2.1 + rand(i + 3) * 1.3,
          delay: delay + 0.35,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        }),
      )
      entry.tweens.push(
        gsap.to(el, {
          y: (rand(i + 7) - 0.5) * 12,
          duration: 1.6 + rand(i + 5) * 0.9,
          delay: delay + 0.4,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        }),
      )
    }

    this.update(camera)
  }

  _measureTreeScreen(camera) {
    const p = this.placement
    if (!p) return false

    const rect = this.container.getBoundingClientRect()
    if (!rect.width || !rect.height) return false

    const y = p.y ?? 0
    _base.set(p.x, y, p.z)
    _top.set(p.x, y + (p.focusY ?? 8), p.z)

    _base.project(camera)
    _top.project(camera)

    if (_base.z > 1) {
      this.root.style.opacity = '0'
      return false
    }
    this.root.style.opacity = '1'

    this._baseX = (_base.x * 0.5 + 0.5) * rect.width
    this._baseY = (-_base.y * 0.5 + 0.5) * rect.height
    this._viewW = rect.width
    this._viewH = rect.height
    this._treeH = Math.max(
      Math.abs(((-_top.y * 0.5 + 0.5) * rect.height) - this._baseY),
      120,
    )
    return true
  }

  _clampToView(x, y, half) {
    const pad = this.cfg.edgePadding ?? 16
    const bottomPad = this.cfg.bottomPadding ?? 132
    const minX = half + pad
    const maxX = this._viewW - half - pad
    const minY = half + pad
    const maxY = this._viewH - half - bottomPad

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    }
  }

  update(camera) {
    if (!this.active || !this.stickers.length) return
    if (!this._measureTreeScreen(camera)) return

    const sizeBase = this._treeH * (this.cfg.sizeRatio ?? 0.32)

    for (const s of this.stickers) {
      const w = sizeBase * s.scale
      const half = w * 0.52
      s.el.style.width = `${w}px`

      const rawX = this._baseX + s.rx * this._treeH
      const rawY = this._baseY + s.ry * this._treeH
      const { x, y } = this._clampToView(rawX, rawY, half)

      s.el.style.left = `${x}px`
      s.el.style.top = `${y}px`
    }
  }

  clear(animate = true) {
    this.active = false
    this.placement = null
    if (!this.stickers.length) return

    const list = this.stickers
    this.stickers = []

    if (!animate) {
      for (const s of list) {
        s.tweens.forEach((t) => t.kill())
        s.el.remove()
      }
      return
    }

    gsap.to(list.map((s) => s.el), {
      scale: 0,
      opacity: 0,
      duration: 0.26,
      stagger: 0.018,
      ease: 'power2.in',
      onComplete: () => {
        for (const s of list) {
          s.tweens.forEach((t) => t.kill())
          s.el.remove()
        }
      },
    })
  }

  dispose() {
    this.clear(false)
    this.root.remove()
  }
}
