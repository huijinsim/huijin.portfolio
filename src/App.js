import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CONFIG } from './config.js'
import { Renderer } from './core/Renderer.js'
import { PostFX } from './post/PostFX.js'
import { Forest } from './world/Forest.js'
import { loadAllTreeTemplates, loadTreeTemplate } from './world/TreeModel.js'
import { loadCloudTemplates } from './world/CloudModel.js'
import { buildHillDiorama } from './world/Diorama.js'
import { PageOverlay } from './ui/PageOverlay.js'
import { ButterflyCursor } from './ui/ButterflyCursor.js'
import { TreeShinyCards } from './ui/TreeShinyCards.js'
import { loadFonts } from './ui/loadFonts.js'
import { TimeSlider } from './ui/TimeSlider.js'
import { DayCycle } from './systems/DayCycle.js'

const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

// ─────────────────────────────────────────────────────────────
// App — 3D 숲 (방향키 이동 · 나무 클릭 → 3D 카드)
// ─────────────────────────────────────────────────────────────
export class App {
  constructor({ container, loaderEl }) {
    this.container = container
    this.loaderEl = loaderEl
    this.clock = new THREE.Clock()

    this.mainActive = false
    this._forestLoading = null

    this._raycaster = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._down = { x: 0, y: 0, t: 0 }
    this._keyState = new Set()
    this._panRight = new THREE.Vector3()
    this._panForward = new THREE.Vector3()
    this._panMove = new THREE.Vector3()
    this._posHome = new THREE.Vector3(...CONFIG.camera.home.position)
    this._posCl = new THREE.Vector3(...CONFIG.camera.close.position)
    this._tgtHome = new THREE.Vector3(...CONFIG.camera.home.target)
    this._tgtCl = new THREE.Vector3(...CONFIG.camera.close.target)
    this._explorePos = new THREE.Vector3()
    this._exploreTarget = new THREE.Vector3()
    this.zoomSmooth = CONFIG.camera.zoom.default
    this.panSmooth = CONFIG.camera.pan.default

    this.pageOverlay = new PageOverlay()
    const bc = CONFIG.interaction.butterflyCursor ?? {}
    this.butterflyCursor = new ButterflyCursor(bc.urls, { size: bc.size ?? 150 })
    this.shinyCards = new TreeShinyCards(container)
    this._focusedTree = null
    this._cameraTween = null
    this._camAnim = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 }

    this.renderer = new Renderer(container)
    this.postfx = new PostFX(this.renderer.instance, this.renderer.camera)
    this.dayCycle = new DayCycle()
    this._autoTimePaused = false
    this.timeSlider = new TimeSlider(
      (t) => this._onManualTimeChange(t),
      {
        onManualStart: () => { this._autoTimePaused = true },
        onManualEnd: () => { this._autoTimePaused = false },
      },
    )
    this.shinyCards.onActiveChange = (active) => {
      if (active) this.timeSlider.hide()
      else if (this.mainActive) this.timeSlider.show(this.dayCycle.t)
    }

    this._initControls()
    this._bindEvents()
    this._resizeObserver = new ResizeObserver(() => this.resize())
    this._resizeObserver.observe(this.container)
  }

  _onManualTimeChange(t) {
    this.dayCycle.setTime(t)
    this.timeSlider.setLabel(this.dayCycle.atmosphere.label)
    this.dayCycle.apply(this.forest, this.renderer.camera, this.postfx)
  }

  _advanceAutoTime(delta) {
    if (this._autoTimePaused || this.shinyCards?.isActive()) return

    const duration = CONFIG.dayCycle.autoDuration ?? 120
    let t = this.dayCycle.t + delta / duration
    if (t >= 1) t -= Math.floor(t)

    this.dayCycle.setTime(t)
    if (this.timeSlider.root.classList.contains('is-visible')) {
      this.timeSlider.setValue(t, false)
      this.timeSlider.setLabel(this.dayCycle.atmosphere.label)
    }
  }

  _initControls() {
    const cam = this.renderer.camera

    this.controls = new OrbitControls(cam, this.renderer.instance.domElement)
    CONFIG.camera.zoom.value = CONFIG.camera.zoom.default
    CONFIG.camera.pan.value = CONFIG.camera.pan.default
    this.zoomSmooth = CONFIG.camera.zoom.default
    this.panSmooth = CONFIG.camera.pan.default
    this._snapToHome()
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableRotate = false
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.minDistance = 6
    this.controls.maxDistance = 160
    this.controls.maxPolarAngle = Math.PI * 0.46
    this.controls.enabled = false
  }

  _exploreViewAt(zoomT, panX, outPos, outTarget) {
    outPos.lerpVectors(this._posHome, this._posCl, zoomT)
    outTarget.lerpVectors(this._tgtHome, this._tgtCl, zoomT)
    outPos.x += panX
    outTarget.x += panX
    return outPos
  }

  _exploreFovAt(zoomT) {
    return THREE.MathUtils.lerp(CONFIG.camera.home.fov, CONFIG.camera.close.fov, zoomT)
  }

  _snapToHome() {
    const cam = this.renderer.camera
    const home = CONFIG.camera.home

    cam.position.set(...home.position)
    this.controls.target.set(...home.target)
    cam.fov = home.fov
    if (cam.aspect < 1.05) cam.fov += (1.05 - cam.aspect) * 12
    cam.updateProjectionMatrix()

    CONFIG.camera.zoom.value = CONFIG.camera.zoom.min
    CONFIG.camera.pan.value = CONFIG.camera.pan.default
    this.zoomSmooth = CONFIG.camera.zoom.min
    this.panSmooth = CONFIG.camera.pan.default
    this.controls.update()
  }

  _normalizeWheelDelta(e) {
    let dy = e.deltaY
    if (e.deltaMode === 1) dy *= 16
    else if (e.deltaMode === 2) dy *= 800
    return dy
  }

  _applyExploreInputImmediate() {
    const zoomCfg = CONFIG.camera.zoom
    const panCfg = CONFIG.camera.pan
    this.zoomSmooth = THREE.MathUtils.lerp(this.zoomSmooth, zoomCfg.value, 0.42)
    this.panSmooth = THREE.MathUtils.lerp(this.panSmooth, panCfg.value, 0.42)
    this._applyExploreCamera()
  }

  _handleWheelZoomPan(e) {
    if (!this.mainActive || this.pageOverlay?.isOpen || this._focusedTree || this._cameraTween) return

    e.preventDefault()
    e.stopPropagation()

    const panCfg = CONFIG.camera.pan
    const zoomCfg = CONFIG.camera.zoom
    const deltaY = this._normalizeWheelDelta(e)
    const deltaX = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX
    const wantsZoom = e.ctrlKey || Math.abs(deltaY) >= Math.abs(deltaX) * 0.65

    if (wantsZoom && Math.abs(deltaY) > 0.01) {
      zoomCfg.value = THREE.MathUtils.clamp(
        zoomCfg.value - deltaY * zoomCfg.speed,
        zoomCfg.min,
        zoomCfg.max,
      )
    } else if (Math.abs(deltaX) > 0.01) {
      panCfg.value = THREE.MathUtils.clamp(
        panCfg.value - deltaX * panCfg.wheelSpeed,
        panCfg.min,
        panCfg.max,
      )
    } else {
      return
    }

    this._applyExploreInputImmediate()
  }

  _applyExploreCamera() {
    const cam = this.renderer.camera
    const zoomCfg = CONFIG.camera.zoom
    const panCfg = CONFIG.camera.pan
    const t = THREE.MathUtils.clamp(this.zoomSmooth, zoomCfg.min, zoomCfg.max)
    const panX = THREE.MathUtils.clamp(this.panSmooth, panCfg.min, panCfg.max)
    this.zoomSmooth = t
    this.panSmooth = panX

    if (t <= zoomCfg.min + 0.0001 && Math.abs(panX) < 0.0001) {
      cam.position.copy(this._posHome)
      this.controls.target.copy(this._tgtHome)
      cam.fov = CONFIG.camera.home.fov
    } else {
      this._exploreViewAt(t, panX, this._explorePos, this._exploreTarget)
      cam.position.copy(this._explorePos)
      this.controls.target.copy(this._exploreTarget)
      cam.fov = this._exploreFovAt(t)
    }

    if (cam.aspect < 1.05) cam.fov += (1.05 - cam.aspect) * 12
    if (t > 0.5) cam.fov += (t - 0.5) * 6
    cam.updateProjectionMatrix()
    this.controls.update()
  }

  /** config.camera.home 시점 적용 */
  _applyDefaultView() {
    this._snapToHome()
  }

  /** 새로고침·페이지 복귀 시 항상 같은 시점으로 */
  resetCamera() {
    if (!this.controls) return
    this._killCameraTween()
    this._focusedTree = null
    this.shinyCards?.clear(false)
    this._snapToHome()
  }

  _killCameraTween() {
    this._cameraTween?.kill()
    this._cameraTween = null
  }

  _isSameTreeFocus(mesh, instanceId) {
    return (
      this._focusedTree?.mesh === mesh &&
      this._focusedTree?.instanceId === instanceId
    )
  }

  _treeFocusTarget(placement) {
    const y = placement.y ?? 0
    return new THREE.Vector3(placement.x, y + placement.focusY * 0.42, placement.z)
  }

  _treeFocusPosition(target) {
    const [ox, oy, oz] = CONFIG.interaction.treeCameraOffset
    return new THREE.Vector3(target.x + ox, target.y + oy, target.z + oz)
  }

  _animateCamera(toPos, toTarget, duration, onComplete) {
    const cam = this.renderer.camera
    this._killCameraTween()

    this._camAnim.px = cam.position.x
    this._camAnim.py = cam.position.y
    this._camAnim.pz = cam.position.z
    this._camAnim.tx = this.controls.target.x
    this._camAnim.ty = this.controls.target.y
    this._camAnim.tz = this.controls.target.z

    const wasEnabled = this.controls.enabled
    this.controls.enabled = false

    this._cameraTween = gsap.to(this._camAnim, {
      px: toPos.x,
      py: toPos.y,
      pz: toPos.z,
      tx: toTarget.x,
      ty: toTarget.y,
      tz: toTarget.z,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        cam.position.set(this._camAnim.px, this._camAnim.py, this._camAnim.pz)
        this.controls.target.set(this._camAnim.tx, this._camAnim.ty, this._camAnim.tz)
        this.controls.update()
      },
      onComplete: () => {
        this._cameraTween = null
        this.controls.enabled = wasEnabled
        onComplete?.()
      },
    })
  }

  _updateKeyboardCamera(delta) {
    if (this._cameraTween || this._focusedTree || !this.mainActive) return

    const panCfg = CONFIG.camera.pan
    const zoomCfg = CONFIG.camera.zoom
    const panSpeed = CONFIG.camera.keyboard?.panSpeed ?? panCfg.keySpeed
    const zoomSpeed = zoomCfg.keySpeed ?? 0.85

    if (this.controls?.enabled && this._keyState.size) {
      if (this._keyState.has('ArrowLeft')) {
        panCfg.value = THREE.MathUtils.clamp(panCfg.value - panSpeed * delta, panCfg.min, panCfg.max)
      }
      if (this._keyState.has('ArrowRight')) {
        panCfg.value = THREE.MathUtils.clamp(panCfg.value + panSpeed * delta, panCfg.min, panCfg.max)
      }
      if (this._keyState.has('ArrowUp')) {
        zoomCfg.value = THREE.MathUtils.clamp(zoomCfg.value + zoomSpeed * delta, zoomCfg.min, zoomCfg.max)
      }
      if (this._keyState.has('ArrowDown')) {
        zoomCfg.value = THREE.MathUtils.clamp(zoomCfg.value - zoomSpeed * delta, zoomCfg.min, zoomCfg.max)
      }

      if (this._keyState.has('ArrowLeft')) this.butterflyCursor.setFacing(-1)
      else if (this._keyState.has('ArrowRight')) this.butterflyCursor.setFacing(1)
    }

    const za = 1 - Math.pow(1 - zoomCfg.damping, delta * 60)
    this.zoomSmooth += (zoomCfg.value - this.zoomSmooth) * za
    const pa = 1 - Math.pow(1 - panCfg.damping, delta * 60)
    this.panSmooth += (panCfg.value - this.panSmooth) * pa

    this._applyExploreCamera()
  }

  _focusTree(mesh, instanceId, placement) {
    this._focusedTree = { mesh, instanceId }

    const target = this._treeFocusTarget(placement)
    const pos = this._treeFocusPosition(target)
    this.shinyCards.show()
    this._animateCamera(pos, target, CONFIG.interaction.focusDuration)
  }

  _returnToOverview() {
    if (!this._focusedTree) return

    this._focusedTree = null
    this.shinyCards.clear()

    const home = CONFIG.camera.home
    const toPos = new THREE.Vector3(...home.position)
    const toTarget = new THREE.Vector3(...home.target)
    this._animateCamera(toPos, toTarget, CONFIG.interaction.returnDuration, () => {
      this._snapToHome()
    })
  }

  _goBack() {
    if (this.pageOverlay?.isOpen) {
      this.pageOverlay.close()
      return true
    }
    if (this.shinyCards.isExpanded()) {
      this.shinyCards.closeExpanded()
      return true
    }
    if (this._focusedTree) {
      this._returnToOverview()
      return true
    }
    return false
  }

  _openWorksDetail() {
    this.butterflyCursor.setEnabled(false)
    this.pageOverlay.open('/works.html', () => {
      this.resetCamera()
      this.butterflyCursor.setEnabled(true)
    })
  }

  bootstrap() {
    this.dayCycle.bindRenderer(this.renderer.instance)
    this.dayCycle.apply(null, this.renderer.camera, this.postfx)
    this.resize()
    this.clock.start()
    this._loop()
    return this.enterMain()
  }

  async _loadForest() {
    if (this.forest) return
    if (this._forestLoading) return this._forestLoading

    const pctEl = this.loaderEl.querySelector('.pct')
    this._forestLoading = (async () => {
      try {
        const templates = await loadAllTreeTemplates(CONFIG.forest.treeModels, (p) => {
          if (pctEl) pctEl.textContent = `${Math.round(p * 48)}%`
        })
        const bushTemplate = CONFIG.forest.bushModel
          ? await loadTreeTemplate(CONFIG.forest.bushModel.url, CONFIG.forest.bushModel, (p) => {
              if (pctEl) pctEl.textContent = `${Math.round(48 + p * 8)}%`
            })
          : null
        const flowerTemplates = CONFIG.forest.flowerModels?.length
          ? await loadAllTreeTemplates(CONFIG.forest.flowerModels, (p) => {
              if (pctEl) pctEl.textContent = `${Math.round(56 + p * 8)}%`
            })
          : []
        const cloudTemplates = await loadCloudTemplates(CONFIG.clouds.models, (p) => {
          if (pctEl) pctEl.textContent = `${Math.round(64 + p * 14)}%`
        })

        let diorama = null
        if (CONFIG.diorama.terrainUrl) {
          try {
            diorama = await buildHillDiorama(CONFIG.diorama.terrainUrl, Math.random, (p) => {
              if (pctEl) pctEl.textContent = `${Math.round(80 + p * 20)}%`
            })
          } catch (e) {
            console.warn('[forest] GLB 지형 로드 실패, 절차적 지형 사용:', e)
          }
        }

        this.forest = new Forest(templates, cloudTemplates, diorama, bushTemplate, flowerTemplates)
      } finally {
        this._forestLoading = null
      }
    })()

    return this._forestLoading
  }

  async enterMain() {
    if (this.mainActive) return

    loadFonts()

    const pctEl = this.loaderEl.querySelector('.pct')
    this.loaderEl.classList.remove('is-hidden')
    if (pctEl) pctEl.textContent = '0%'

    try {
      await this._loadForest()
      this.dayCycle.setTime(CONFIG.dayCycle.default)
      this.dayCycle.apply(this.forest, this.renderer.camera, this.postfx)
      this.timeSlider.setValue(this.dayCycle.t, false)
      this.timeSlider.setLabel(this.dayCycle.atmosphere.label)
      this.timeSlider.show(this.dayCycle.t)
      this.resetCamera()
      this.mainActive = true
      this.controls.enabled = true
      this.butterflyCursor.setEnabled(true)
    } catch (err) {
      console.error('[forest] 숲 로드 실패:', err)
      if (pctEl) pctEl.textContent = '로드 실패'
      throw err
    } finally {
      this.loaderEl.classList.add('is-hidden')
    }
  }

  _bindEvents() {
    this._onResize = () => this.resize()
    window.addEventListener('resize', this._onResize)

    this._onPointerDown = (e) => {
      this._down.x = e.clientX
      this._down.y = e.clientY
      this._down.t = performance.now()
    }
    this._onPointerUp = (e) => this._handleClickAt(e.clientX, e.clientY, e)
    this.container.addEventListener('pointerdown', this._onPointerDown)
    this.container.addEventListener('pointerup', this._onPointerUp)

    this._onWheel = (e) => this._handleWheelZoomPan(e)
    const wheelOpts = { passive: false, capture: true }
    window.addEventListener('wheel', this._onWheel, wheelOpts)
    this.renderer.instance.domElement.addEventListener('wheel', this._onWheel, wheelOpts)

    this._onKeyDown = (e) => {
      if (!this.mainActive || this.pageOverlay?.isOpen) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (ARROW_KEYS.includes(e.key)) {
        e.preventDefault()
        this._keyState.add(e.key)
        if (e.key === 'ArrowLeft') this.butterflyCursor.setFacing(-1)
        if (e.key === 'ArrowRight') this.butterflyCursor.setFacing(1)
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        // 세부 카드: 뒤집기 / 메인·4장 그리드: 나비 커서 순환
        if (this.shinyCards.isExpanded()) {
          this.shinyCards.toggleFlip()
        } else {
          this.butterflyCursor.cycle()
        }
      }
      if (e.code === 'Enter' && !e.repeat) {
        e.preventDefault()
        if (this._focusedTree) {
          if (this.shinyCards.isExpanded()) return
          const { x, y } = this.butterflyCursor.getPosition()
          if (this.shinyCards.selectAt(x, y)) return
          this._returnToOverview()
          return
        }
        const { x, y } = this.butterflyCursor.getPosition()
        this._handleClickAt(x, y)
      }
      if (e.code === 'Backspace' && !e.repeat) {
        e.preventDefault()
        this._goBack()
      }
    }
    this._onKeyUp = (e) => {
      if (ARROW_KEYS.includes(e.key)) this._keyState.delete(e.key)
    }
    this._onBlur = () => this._keyState.clear()
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onBlur)
  }

  _handleClickAt(clientX, clientY, pointerEvent = null) {
    if (!this.mainActive || !this.forest) return

    if (pointerEvent) {
      const dx = clientX - this._down.x
      const dy = clientY - this._down.y
      const moved = Math.hypot(dx, dy)
      const dt = performance.now() - this._down.t
      if (moved > 6 || dt > 350) return
    }

    const rect = this.container.getBoundingClientRect()
    this._ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this._raycaster.setFromCamera(this._ndc, this.renderer.camera)
    const hits = this._raycaster.intersectObjects(this.forest.getPickables(), false)

    if (!hits.length) {
      if (this._focusedTree) this._returnToOverview()
      return
    }

    const hit = hits[0]
    const obj = hit.object
    const type = obj.userData.interactive

    if (type === 'tree' || obj.userData.isInstancedTrees) {
      const instanceId = hit.instanceId
      const placement = this.forest.getTreePlacement(obj, instanceId)
      if (!placement) return

      if (this._isSameTreeFocus(obj, instanceId)) return

      this._focusTree(obj, instanceId, placement)
      return
    }

    if (type === 'butterfly') {
      this._openWorksDetail()
      return
    }

    if (this._focusedTree) this._returnToOverview()
  }

  resize() {
    this.renderer.resize()
    const rect = this.container.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio)
    this.postfx?.resize(rect.width, rect.height, dpr)
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop())

    const delta = this.clock.getDelta()
    this._updateKeyboardCamera(delta)
    this.controls?.update()

    const elapsed = this.clock.getElapsedTime()
    const cam = this.renderer.camera
    if (this.forest) {
      if (this.mainActive) this._advanceAutoTime(delta)
      this.dayCycle.apply(this.forest, cam, this.postfx)
      this.forest.update(elapsed)
      const pos = this.butterflyCursor.getPosition()
      this.shinyCards?.updatePointer(pos.x, pos.y)
      this.postfx.render(this.forest.scene, cam, elapsed, this.dayCycle.atmosphere)
    } else {
      this.renderer.render(new THREE.Scene(), cam)
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onBlur)
    this.container.removeEventListener('pointerdown', this._onPointerDown)
    this.container.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('wheel', this._onWheel, true)
    this.renderer.instance.domElement.removeEventListener('wheel', this._onWheel, true)
    this._resizeObserver?.disconnect()
    this.controls?.dispose()
    this.pageOverlay?.dispose()
    this.butterflyCursor?.dispose()
    this.shinyCards?.dispose()
    this.timeSlider?.dispose()
    this.forest?.dispose()
    this.dayCycle?.dispose()
    this.postfx?.dispose()
    this.renderer.dispose()
  }
}
