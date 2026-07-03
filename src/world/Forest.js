import * as THREE from 'three'
import { CONFIG, PALETTE } from '../config.js'
import { buildCattailStalk, buildCattailTip, buildSmallFern } from './Flora.js'
import { createTreeInstances, treeFocusRoot } from './TreeModel.js'
import { buildDiorama } from './Diorama.js'
import { createMeshHeightSampler } from './Terrain.js'

function standardMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.88,
    metalness: 0.0,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  })
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Forest {
  /** @param {Awaited<ReturnType<import('./TreeModel.js').loadAllTreeTemplates>>} treeTemplates */
  /** @param {Awaited<ReturnType<import('./Terrain.js').loadTerrain>>} [terrain] */
  /** @param {Awaited<ReturnType<import('./TreeModel.js').loadTreeTemplate>>} [bushTemplate] */
  /** @param {Awaited<ReturnType<import('./TreeModel.js').loadAllTreeTemplates>>} [flowerTemplates] */
  constructor(
    treeTemplates,
    cloudTemplates = [],
    prebuiltDiorama = null,
    bushTemplate = null,
    flowerTemplates = [],
  ) {
    this.scene = new THREE.Scene()
    this.rng = mulberry32(CONFIG.forest.seed)
    this.cloudTemplates = cloudTemplates
    this._prebuiltDiorama = prebuiltDiorama
    this.bushTemplate = bushTemplate
    this.flowerLayers = (CONFIG.forest.flowerModels ?? []).map((cfg, i) => ({
      config: cfg,
      template: flowerTemplates[i] ?? null,
    }))
    this.materials = []
    this.pickables = []
    this.treeLayers = CONFIG.forest.treeModels.map((cfg, i) => ({
      config: cfg,
      template: treeTemplates[i],
      placements: [],
      instancedMesh: null,
    }))
    this.treeSlots = []
    this.terrainMesh = null
    this._sampleTerrainY = null

    this._initLights()
    this._initMaterials()
    this._buildGround()
    this._buildClouds()
    this._buildTrees()
    this._buildTreeInstances()
    this._buildUnderstory()
    this._buildFlowers()
    this._buildForeground()
    this._buildRocks()
    this.butterflies = null
  }

  _track(mat) {
    this.materials.push(mat)
    return mat
  }

  _initLights() {
    this.ambient = new THREE.AmbientLight('#ffffff', 0.4)
    this.scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight('#b8e4fc', '#6ea14a', 0.9)
    this.scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight('#fffef8', 1.05)
    this.sun.position.set(60, 90, 40)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 320
    const s = 130
    this.sun.shadow.camera.left = -s
    this.sun.shadow.camera.right = s
    this.sun.shadow.camera.top = s
    this.sun.shadow.camera.bottom = -s
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.6
    this.sun.shadow.radius = 6
    this.sun.shadow.blurSamples = 16
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
  }

  _initMaterials() {
    this.fernMat = standardMat(PALETTE.fern, { roughness: 0.88, side: THREE.DoubleSide })
    this.cattailStalkMat = standardMat(PALETTE.cattailStalk, { roughness: 0.88 })
    this.cattailTipMat = standardMat(PALETTE.cattailTipBright, { roughness: 0.82 })
    this.cloudEntries = []
  }

  _buildClouds() {
    const rng = this.rng
    const cfg = CONFIG.clouds
    if (!this.cloudTemplates.length) return

    const half = CONFIG.diorama.size * 0.5
    const count = cfg.count ?? 9

    for (let i = 0; i < count; i++) {
      const tpl = this.cloudTemplates[i % this.cloudTemplates.length]
      const a = (i / count) * Math.PI * 2 + rng() * 0.6
      const rad = half * (cfg.radiusMin + rng() * (cfg.radiusMax - cfg.radiusMin))
      const x = Math.cos(a) * rad
      const z = Math.sin(a) * rad
      const y = cfg.yMin + rng() * (cfg.yMax - cfg.yMin)
      const scale = cfg.minScale + rng() * (cfg.maxScale - cfg.minScale)

      const g = tpl.object.clone(true)
      g.position.set(x, y, z)
      g.scale.multiplyScalar(scale)
      g.rotation.y = rng() * Math.PI * 2
      g.renderOrder = 1
      this.scene.add(g)

      this.cloudEntries.push({
        group: g,
        baseX: x,
        baseY: y,
        phase: rng() * Math.PI * 2,
        speed: 0.05 + rng() * 0.06,
        amp: 1.5 + rng() * 3.0,
        bob: 0.6 + rng() * 1.2,
      })
    }
  }

  _buildGround() {
    this.diorama = this._prebuiltDiorama ?? buildDiorama(this.rng)

    const mesh = new THREE.Mesh(this.diorama.geometry, this._track(this.diorama.material))
    mesh.name = 'terrain'
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    mesh.castShadow = true
    this.scene.add(mesh)
    this.terrainMesh = mesh

    this.scene.add(this.diorama.baseGroup)

    mesh.updateMatrixWorld(true)
    this._sampleTerrainY = createMeshHeightSampler(mesh)
    this._half = this.diorama.half
    this._margin = this.diorama.margin
    this._isOnPath = this.diorama.isOnPath
  }

  /** 디오라마 내 무작위 좌표 (테두리·길 회피) */
  _pickGroundSpot(rng, pathPad = 1.5) {
    const lim = this._half - this._margin - 2
    for (let t = 0; t < 16; t++) {
      const x = (rng() * 2 - 1) * lim
      const z = (rng() * 2 - 1) * lim
      if (this._isOnPath(x, z, pathPad)) continue
      return [x, z]
    }
    return null
  }

  /** 지면 높이 — footprint>0 이면 주변 최고점(소품용), 나무는 _treeGroundY 사용 */
  _groundY(x, z, offset = 0, footprint = 0) {
    if (!this._sampleTerrainY) return offset

    let h = this._sampleTerrainY(x, z, 0)

    if (footprint > 0) {
      const steps = 8
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2
        const px = x + Math.cos(a) * footprint
        const pz = z + Math.sin(a) * footprint
        h = Math.max(h, this._sampleTerrainY(px, pz, 0))
      }
    }

    const lift = CONFIG.forest.groundLift ?? 0
    return h + offset + lift
  }

  /** 나무 — 해당 위치 지면에 정확히 접지 (주변 max·lift 없음) */
  _treeGroundY(x, z, sink = 0) {
    if (!this._sampleTerrainY) return sink
    return this._sampleTerrainY(x, z, 0) + sink
  }

  _canPlaceTree(x, z, radius) {
    const pad = CONFIG.forest.canopyPadding
    for (const slot of this.treeSlots) {
      const dx = x - slot.x
      const dz = z - slot.z
      const minD = (radius + slot.r) * pad
      if (dx * dx + dz * dz < minD * minD) return false
    }
    return true
  }

  _registerTree(x, z, radius) {
    this.treeSlots.push({ x, z, r: radius })
  }

  /** GLB 나무 배치 — layerIdx: treeModels 순서 */
  _tryAddTree(layerIdx, x, z, scale, rotY) {
    const layer = this.treeLayers[layerIdx]
    const f = CONFIG.forest
    const radiusScale = layer.config.canopyRadiusScale ?? f.canopyRadiusScale
    const r = layer.template.radius * scale * radiusScale
    if (!this._canPlaceTree(x, z, r)) return false
    layer.placements.push({
      x,
      z,
      scale,
      rotY,
      focusY: layer.template.height * scale * 0.55,
    })
    this._registerTree(x, z, r)
    return true
  }

  _buildTreeInstances() {
    for (const layer of this.treeLayers) {
      if (!layer.placements.length) continue
      for (const t of layer.placements) {
        const sink = layer.config.groundSink ?? CONFIG.forest.treeGroundSink ?? 0
        t.y = this._treeGroundY(t.x, t.z, sink)
      }
      layer.instancedMesh = createTreeInstances(layer.template, layer.placements)
      this._track(layer.instancedMesh.material)
      this.scene.add(layer.instancedMesh)
      this.pickables.push(layer.instancedMesh)
    }
  }

  getTreePlacement(mesh, instanceId) {
    const layer = this.treeLayers.find((l) => l.instancedMesh === mesh)
    return layer?.placements[instanceId] ?? null
  }

  getTreeFocusRoot(mesh, instanceId) {
    const layer = this.treeLayers.find((l) => l.instancedMesh === mesh)
    if (!layer) return null
    return treeFocusRoot(layer.placements[instanceId])
  }

  _buildTrees() {
    const f = CONFIG.forest
    const rng = this.rng
    this.treeSlots = []

    // 종류를 섞어 라운드로빈 → 한 종이 한 구역에 몰리지 않음
    const queue = []
    for (let li = 0; li < this.treeLayers.length; li++) {
      const total = this.treeLayers[li].config.count
      for (let i = 0; i < total; i++) queue.push(li)
    }
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[queue[i], queue[j]] = [queue[j], queue[i]]
    }

    let guard = 0
    const guardMax = queue.length * 240
    let qi = 0

    while (qi < queue.length && guard < guardMax) {
      guard++
      const li = queue[qi]
      const cfg = this.treeLayers[li].config

      const spot = this._pickGroundSpot(rng, 2.4)
      if (!spot) {
        qi++
        continue
      }
      const [x, z] = spot

      // 언덕(높은 곳)일수록 더 크게, 길가는 작게
      const groundH = this._sampleTerrainY(x, z, 0)
      const hillT = THREE.MathUtils.clamp(groundH / (CONFIG.diorama.colorHeight || 14), 0, 1)
      const raw = (0.66 + rng() * 0.5) * (0.7 + hillT * 0.5)
      const minS = cfg.minScale ?? f.minTreeScale
      const maxS = cfg.maxScale ?? f.maxTreeScale
      const s = THREE.MathUtils.clamp(raw, minS, maxS) * (f.treeScaleMul ?? 1)

      if (!this._tryAddTree(li, x, z, s, rng() * Math.PI * 2)) continue
      qi++
    }
  }

  /** 저폴리 바위 무리 — 언덕 발치·길가 */
  _buildRocks() {
    const count = CONFIG.diorama.rockCount ?? 0
    if (!count) return

    const rng = this.rng
    const rockMat = this._track(standardMat('#c4b5a0', { roughness: 1 }))
    const rockMatDark = this._track(standardMat('#6a5e52', { roughness: 1 }))

    for (let i = 0; i < count; i++) {
      const spot = this._pickGroundSpot(rng, 0.4)
      if (!spot) continue
      const [x, z] = spot

      const r = 0.5 + rng() * 1.6
      const geo = new THREE.IcosahedronGeometry(r, 0)
      const pos = geo.attributes.position
      for (let v = 0; v < pos.count; v++) {
        pos.setXYZ(
          v,
          pos.getX(v) * (0.7 + rng() * 0.6),
          pos.getY(v) * (0.5 + rng() * 0.5),
          pos.getZ(v) * (0.7 + rng() * 0.6),
        )
      }
      geo.computeVertexNormals()

      const rock = new THREE.Mesh(geo, rng() > 0.5 ? rockMat : rockMatDark)
      rock.castShadow = true
      rock.receiveShadow = true
      rock.position.set(x, this._groundY(x, z, -r * 0.35), z)
      rock.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4)
      this.scene.add(rock)
    }
  }

  _buildUnderstory() {
    const cfg = CONFIG.forest.bushModel
    if (!this.bushTemplate || !cfg) return

    const rng = this.rng
    const placements = []

    for (let i = 0; i < cfg.count; i++) {
      const spot = this._pickGroundSpot(rng, 0.9)
      if (!spot) continue
      const [x, z] = spot
      placements.push({
        x,
        z,
        scale: cfg.minScale + rng() * (cfg.maxScale - cfg.minScale),
        rotY: rng() * Math.PI * 2,
        y: this._groundY(x, z, cfg.groundSink ?? -0.04),
      })
    }

    if (!placements.length) return

    const mesh = createTreeInstances(this.bushTemplate, placements, { pickable: null })
    this._track(mesh.material)
    this.scene.add(mesh)
  }

  _buildFlowers() {
    if (!this.flowerLayers?.length) return

    const rng = this.rng

    for (const layer of this.flowerLayers) {
      const cfg = layer.config
      if (!layer.template || !cfg.count) continue

      const placements = []
      for (let i = 0; i < cfg.count; i++) {
        const spot = this._pickGroundSpot(rng, 1.1)
        if (!spot) continue
        const [x, z] = spot
        placements.push({
          x,
          z,
          scale: cfg.minScale + rng() * (cfg.maxScale - cfg.minScale),
          rotY: rng() * Math.PI * 2,
          y: this._groundY(x, z, cfg.groundSink ?? -0.02),
        })
      }

      if (!placements.length) continue

      const mesh = createTreeInstances(layer.template, placements)
      mesh.userData.interactive = null
      mesh.userData.isInstancedTrees = false
      this._track(mesh.material)
      this.scene.add(mesh)
    }
  }

  _buildForeground() {
    const f = CONFIG.forest
    if (!f.cattails && !f.ferns) return

    const rng = this.rng

    const pickSpot = () => this._pickGroundSpot(rng, 0.8)

    for (let i = 0; i < f.cattails; i++) {
      const spot = pickSpot()
      if (!spot) continue
      const [x, z] = spot
      const h = 1.0 + rng() * 1.6
      const g = new THREE.Group()
      g.position.set(x, this._groundY(x, z), z)
      g.rotation.y = rng() * Math.PI * 2

      const stalkGeo = buildCattailStalk(h)
      const tipGeo = buildCattailTip(rng)
      const tip = new THREE.Mesh(tipGeo, this.cattailTipMat)
      tip.position.y = h + 0.08
      tip.castShadow = true

      const stalk = new THREE.Mesh(stalkGeo, this.cattailStalkMat)
      stalk.castShadow = true
      g.add(stalk)
      g.add(tip)
      this.scene.add(g)
    }

    for (let i = 0; i < f.ferns; i++) {
      const spot = pickSpot()
      if (!spot) continue
      const [x, z] = spot
      const geo = buildSmallFern(rng)
      const g = new THREE.Group()
      g.position.set(x, this._groundY(x, z), z)
      g.rotation.y = rng() * Math.PI * 2
      g.scale.setScalar(0.85 + rng() * 0.55)
      const fern = new THREE.Mesh(geo, this.fernMat)
      fern.castShadow = true
      g.add(fern)
      this.scene.add(g)
    }
  }

  update(elapsed) {
    this.butterflies?.update(elapsed)
    for (const c of this.cloudEntries) {
      c.group.position.x = c.baseX + Math.sin(elapsed * c.speed + c.phase) * c.amp
      c.group.position.y = c.baseY + Math.sin(elapsed * c.speed * 0.7 + c.phase) * c.bob
    }
  }

  getPickables() {
    return [...this.pickables, ...(this.butterflies?.pickables ?? [])]
  }

  dispose() {
    const shared = new Set()
    for (const layer of this.treeLayers) {
      layer.template?.geometry?.dispose()
      layer.template?.material?.dispose()
      if (layer.template?.geometry) shared.add(layer.template.geometry)
      if (layer.template?.material) shared.add(layer.template.material)
    }
    this.bushTemplate?.geometry?.dispose()
    this.bushTemplate?.material?.dispose()
    for (const layer of this.flowerLayers ?? []) {
      layer.template?.geometry?.dispose()
      layer.template?.material?.dispose()
      if (layer.template?.geometry) shared.add(layer.template.geometry)
      if (layer.template?.material) shared.add(layer.template.material)
    }
    this.scene.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose()
      if (o.material && !shared.has(o.material)) o.material.dispose()
    })
  }
}
