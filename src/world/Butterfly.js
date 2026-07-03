import * as THREE from 'three'
import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// Butterfly — 보라·핑크 나비 (나무 사이, 자연 크기)
// ─────────────────────────────────────────────────────────────

function buildWing() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.12, 0.06, 0.26, 0.18, 0.1, 0.32)
  shape.bezierCurveTo(0.04, 0.24, 0, 0.1, 0, 0)
  const g = new THREE.ShapeGeometry(shape)
  g.translate(-0.05, -0.14, 0)
  return g
}

function addMesh(parent, geo, mat, x, y, z, sx = 1) {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.scale.x = sx
  parent.add(mesh)
  return mesh
}

function buildButterflyMesh(color) {
  const wingGeo = buildWing()
  const bodyGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.22, 5)
  bodyGeo.rotateZ(Math.PI / 2)

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.18,
  })
  const g = new THREE.Group()

  const lw = addMesh(g, wingGeo, mat, -0.04, 0.02, 0)
  const rw = addMesh(g, wingGeo, mat, 0.04, 0.02, 0, -1)
  addMesh(g, bodyGeo, mat, 0, 0, 0)

  return { group: g, leftWing: lw, rightWing: rw, mat }
}

export class Butterflies {
  constructor(scene, rng, treeSlots) {
    this.scene = scene
    this.entries = []
    this.pickables = []
    this.materials = []

    const cfg = CONFIG.butterflies
    const colors = [cfg.purple, cfg.pink]
    const zone = cfg.zone

    for (let i = 0; i < cfg.count; i++) {
      const color = colors[i % colors.length]
      const { group, leftWing, rightWing, mat } = buildButterflyMesh(color)
      this.materials.push(mat)

      let x
      let z
      if (rng() < cfg.nearRatio) {
        z = zone.zNearMin + rng() * (zone.zNearMax - zone.zNearMin)
        x = (rng() * 2 - 1) * zone.x * 0.5
      } else {
        const anchor = treeSlots[Math.floor(rng() * Math.max(1, treeSlots.length))] ?? { x: 0, z: -20 }
        x = THREE.MathUtils.clamp(anchor.x + (rng() - 0.5) * zone.x * 0.5, -zone.x, zone.x)
        z = THREE.MathUtils.clamp(anchor.z + (rng() - 0.5) * 14, zone.zFarMin, zone.zFarMax)
      }

      const y = zone.yMin + rng() * (zone.yMax - zone.yMin)
      const scale = cfg.scaleMin + rng() * (cfg.scaleMax - cfg.scaleMin)

      group.position.set(x, y, z)
      group.scale.setScalar(scale)
      group.rotation.y = rng() * Math.PI * 2

      group.traverse((o) => {
        if (o.isMesh) {
          o.userData.interactive = 'butterfly'
          o.userData.root = group
          this.pickables.push(o)
        }
      })

      group.userData.interactive = 'butterfly'
      group.userData.root = group

      this.scene.add(group)
      this.entries.push({
        group,
        leftWing,
        rightWing,
        phase: rng() * Math.PI * 2,
        speed: 0.32 + rng() * 0.4,
        wingSpeed: 8 + rng() * 6,
        path: {
          ax: x,
          az: z,
          bx: x + (rng() - 0.5) * 8,
          bz: z + (rng() - 0.5) * 6,
          cx: x + (rng() - 0.5) * 6,
          cz: z + (rng() - 0.5) * 8,
          yBase: y,
          yAmp: 0.25 + rng() * 0.45,
        },
      })
    }
  }

  update(elapsed) {
    for (const b of this.entries) {
      const t = elapsed * b.speed + b.phase
      const p = b.path
      const u = (Math.sin(t * 0.55) + 1) * 0.5
      const v = (Math.sin(t * 0.38 + 1.2) + 1) * 0.5

      b.group.position.x =
        THREE.MathUtils.lerp(p.ax, p.bx, u) * 0.6 + THREE.MathUtils.lerp(p.bx, p.cx, v) * 0.4
      b.group.position.z =
        THREE.MathUtils.lerp(p.az, p.bz, u) * 0.6 + THREE.MathUtils.lerp(p.bz, p.cz, v) * 0.4
      b.group.position.y = p.yBase + Math.sin(t * 1.4) * p.yAmp

      const dx = Math.cos(t * 0.9) * 0.8
      const dz = Math.sin(t * 0.9) * 0.8
      b.group.rotation.y = Math.atan2(dx, dz)

      const flap = Math.abs(Math.sin(elapsed * b.wingSpeed)) * 0.55
      b.leftWing.rotation.z = flap
      b.rightWing.rotation.z = -flap
    }
  }
}
