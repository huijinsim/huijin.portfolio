import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// Cloud — 일러스트 뭉게구름 (구 스택 X → 회전 실루엣·리본)
// Lathe / Extrude 한 덩어리 + 가장자리 스캘럽
// ─────────────────────────────────────────────────────────────

const TMP = new THREE.Vector2()

/** 가로 단면 스캘럽 — 구 분절감을 없애고 덩어리처럼 */
function applyCloudScallop(g, phase, rng) {
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.sqrt(x * x + z * z)
    if (r < 0.02) continue
    const theta = Math.atan2(z, x)
    const s =
      1 +
      0.16 * Math.sin(theta * 5 + phase) +
      0.09 * Math.sin(theta * 8 + phase * 1.25) +
      0.04 * Math.sin(theta * 12 + phase * 0.7)
    const bottom = y < 0.12 ? 0.65 + y * 2.8 : 1.0
    pos.setXYZ(i, x * s, y * bottom, z * s * (0.86 + rng() * 0.04))
  }
  g.computeVertexNormals()
  return g
}

/** 회전 실루엣 뭉게구름 */
function latheCloud(rng, width = 1, height = 1) {
  const phase = rng() * Math.PI * 2
  const steps = 24
  const pts = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const y = (t * 1.45 - 0.12) * height
    const env = Math.pow(Math.sin(t * Math.PI), 0.72)
    const lump =
      1 +
      0.22 * Math.sin(t * 9 + phase) +
      0.12 * Math.sin(t * 14 + phase * 0.85) +
      0.06 * Math.sin(t * 5 + phase * 1.4)
    const r = env * width * (0.82 + rng() * 0.14) * lump
    pts.push(TMP.set(Math.max(0.05, r), y).clone())
  }

  const g = new THREE.LatheGeometry(pts, 18 + Math.floor(rng() * 6))
  return applyCloudScallop(g, phase, rng)
}

/** 가로 리본형 구름 (Extrude) */
function ribbonCloud(rng, width = 5.8, peak = 0.72) {
  const phase = rng() * Math.PI * 2
  const segs = 28
  const shape = new THREE.Shape()
  shape.moveTo(-width * 0.5, 0)

  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const x = -width * 0.5 + width * t
    const env = Math.sin(t * Math.PI)
    const y =
      env * peak * (0.82 + 0.18 * Math.sin(t * 6 + phase)) +
      0.06 * Math.sin(t * 16 + phase * 1.1) +
      0.04 * Math.sin(t * 23 + phase * 0.6)
    shape.lineTo(x, Math.max(0, y))
  }

  shape.lineTo(width * 0.5, 0)
  shape.lineTo(-width * 0.5, 0)

  const depth = 0.42 + rng() * 0.18
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
  g.translate(0, 0, -depth * 0.5)
  return applyCloudScallop(g, phase, rng)
}

/** 둥근 뭉게구름 */
export function buildCloud(rng) {
  return latheCloud(rng, 0.95 + rng() * 0.2, 0.9 + rng() * 0.15)
}

/** 가로로 긴 구름 띠 */
export function buildCloudBand(rng) {
  return ribbonCloud(rng, 4.8 + rng() * 1.4, 0.58 + rng() * 0.22)
}

/** 큰 덩어리 구름 */
export function buildCloudLarge(rng) {
  return latheCloud(rng, 1.15 + rng() * 0.25, 1.05 + rng() * 0.2)
}

const BUILDERS = [buildCloud, buildCloudBand, buildCloudLarge]

/** variant 0|1|2 */
export function buildCloudByVariant(rng, variant = 0) {
  return BUILDERS[variant % BUILDERS.length](rng)
}
