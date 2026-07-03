// ─────────────────────────────────────────────────────────────
// ButterflyCursor — 나비 PNG 커서 (스페이스로 이미지 순환)
// ─────────────────────────────────────────────────────────────

const DEFAULT_URLS = [
  '/butterfly/butterfly4.PNG',
  '/butterfly/butterfly5.PNG',
  '/butterfly/butterfly6.PNG',
]

export class ButterflyCursor {
  /** @param {string[]} [urls] @param {{ size?: number }} [opts] */
  constructor(urls = DEFAULT_URLS, opts = {}) {
    this.urls = urls.length ? urls : DEFAULT_URLS
    this.size = opts.size ?? 150
    this.index = 0
    this.enabled = false
    this._facing = 1
    this._mx = -9999
    this._my = -9999
    this._buildDom()
    this._onMove = (e) => this._move(e.clientX, e.clientY)
    window.addEventListener('pointermove', this._onMove, { passive: true })
  }

  _buildDom() {
    this.root = document.createElement('div')
    this.root.id = 'butterfly-cursor'
    this.root.innerHTML = /* html */ `
      <style>
        #butterfly-cursor {
          position: fixed; left: 0; top: 0;
          z-index: 100; pointer-events: none;
          visibility: hidden;
          transform: translate3d(-9999px, -9999px, 0);
          will-change: transform;
        }
        #butterfly-cursor img {
          display: block;
          width: var(--bf-size, 150px);
          height: auto;
          transform: translate(-42%, -38%) scaleX(1);
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12));
          user-select: none;
          -webkit-user-drag: none;
        }
      </style>
    `
    this.root.style.setProperty('--bf-size', `${this.size}px`)
    this.img = document.createElement('img')
    this.img.src = this.urls[0]
    this.img.alt = ''
    this.img.draggable = false
    this.root.appendChild(this.img)
    document.body.appendChild(this.root)
    this._applyFlip()
  }

  _applyFlip() {
    const sx = this._facing < 0 ? -1 : 1
    this.img.style.transform = `translate(-42%, -38%) scaleX(${sx})`
  }

  _move(x, y) {
    this._mx = x
    this._my = y
    if (!this.enabled) return
    this.root.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  /** @param {1 | -1} dir */
  setFacing(dir) {
    const next = dir < 0 ? -1 : 1
    if (this._facing === next) return
    this._facing = next
    this._applyFlip()
  }

  getPosition() {
    return { x: this._mx, y: this._my }
  }

  cycle() {
    if (!this.enabled) return
    this.index = (this.index + 1) % this.urls.length
    this.img.src = this.urls[this.index]
    this._applyFlip()
  }

  setEnabled(on) {
    this.enabled = on
    document.body.style.cursor = on ? 'none' : ''
    this.root.style.visibility = on ? 'visible' : 'hidden'
    if (on) this._move(this._mx, this._my)
  }

  dispose() {
    window.removeEventListener('pointermove', this._onMove)
    document.body.style.cursor = ''
    this.root.remove()
  }
}
