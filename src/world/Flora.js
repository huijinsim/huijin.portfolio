import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────
// Flora — 관목·갈대·양치 등 지면 식물
// ─────────────────────────────────────────────────────────────

function scallop(theta, phaseOff, lobes = 9) {
  return (
    1 +
    0.14 * Math.sin(theta * lobes + phaseOff) +
    0.07 * Math.sin(theta * (lobes + 4) + phaseOff * 1.3)
  )
}

function applyScallop(g, phaseOff) {
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.sqrt(x * x + z * z)
    if (r < 0.02) continue
    const s = scallop(Math.atan2(z, x), phaseOff)
    pos.setXYZ(i, x * s, y, z * s)
  }
  g.computeVertexNormals()
  return g
}

/** 갈대 줄기 */
export function buildCattailStalk(height) {
  const g = new THREE.CylinderGeometry(0.025, 0.035, height, 5)
  g.translate(0, height / 2, 0)
  return g
}

/** 갈대 끝 */
export function buildCattailTip(rng) {
  const tipH = 0.2 + rng() * 0.12
  const g = new THREE.CylinderGeometry(0.075, 0.05, tipH, 6)
  g.translate(0, tipH / 2, 0)
  return g
}

/** 작은 양치·잡초 */
export function buildSmallFern(rng) {
  const parts = []
  const n = 3 + Math.floor(rng() * 2)
  for (let i = 0; i < n; i++) {
    const h = 0.32 + rng() * 0.42
    const g = new THREE.PlaneGeometry(0.2, h, 1, 1)
    g.translate(0, h / 2, 0)
    g.rotateY(rng() * Math.PI * 2)
    g.rotateZ((rng() - 0.5) * 0.55)
    g.translate((rng() - 0.5) * 0.28, 0, (rng() - 0.5) * 0.22)
    parts.push(g)
  }
  return mergeGeometries(parts)
}

/** 지면 관목 */
export function buildBush(rng) {
  const phase = rng() * Math.PI * 2
  const n = 2 + Math.floor(rng() * 2)
  const parts = []
  for (let i = 0; i < n; i++) {
    const steps = 10
    const pts = []
    const r = 0.42 + rng() * 0.28
    const h = 0.48 + rng() * 0.22
    const y0 = 0.08 + i * 0.12
    for (let j = 0; j <= steps; j++) {
      const t = j / steps
      const y = y0 + h * t
      const bulge = Math.sin(t * Math.PI)
      pts.push(new THREE.Vector2(r * (0.35 + 0.65 * bulge), y))
    }
    parts.push(applyScallop(new THREE.LatheGeometry(pts, 12), phase + i))
  }
  return {
    foliage: parts.length === 1 ? parts[0] : mergeGeometries(parts),
    height: 1.0,
    kind: 'bush',
    foliageOutline: true,
  }
}
