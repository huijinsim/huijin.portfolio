// ─────────────────────────────────────────────────────────────
// PageOverlay — about/works HTML 페이지를 앱 위에 표시
// ─────────────────────────────────────────────────────────────

export class PageOverlay {
  constructor() {
    this._onClose = null
    this._buildDom()
  }

  _buildDom() {
    this.root = document.createElement('div')
    this.root.id = 'page-overlay'
    this.root.innerHTML = /* html */ `
      <style>
        #page-overlay {
          position: fixed; inset: 0; z-index: 55;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity 0.45s ease, visibility 0.45s ease;
          background: #f5f3ee;
        }
        #page-overlay.is-open {
          opacity: 1; visibility: visible; pointer-events: auto;
        }
        #page-overlay iframe {
          width: 100%; height: 100%;
          border: none;
          display: block;
          background: #f5f3ee;
        }
        #page-overlay .close-page {
          position: fixed; top: 20px; right: 20px; z-index: 56;
          font-family: 'Noto Sans KR', system-ui, sans-serif;
          font-size: 0.62rem; font-weight: 500;
          letter-spacing: 0.18em; text-transform: uppercase;
          padding: 10px 18px; border-radius: 999px;
          border: 1px solid rgba(26, 26, 26, 0.14);
          background: rgba(245, 243, 238, 0.92);
          color: #1a1a1a; cursor: pointer;
          backdrop-filter: blur(8px);
          transition: background 0.2s;
        }
        #page-overlay .close-page:hover { background: #fff; }
      </style>
      <button type="button" class="close-page" aria-label="숲으로 돌아가기">← Forest</button>
      <iframe title="Detail page" loading="lazy"></iframe>
    `

    document.body.appendChild(this.root)
    this.frame = this.root.querySelector('iframe')
    this.root.querySelector('.close-page').addEventListener('click', () => this.close())
  }

  /** @param {string} url @param {() => void} [onClose] */
  open(url, onClose) {
    this._onClose = onClose ?? null
    this.frame.src = url
    this.root.classList.add('is-open')
    document.body.style.overflow = 'hidden'
  }

  close(silent = false) {
    if (!this.root.classList.contains('is-open')) return
    this.root.classList.remove('is-open')
    document.body.style.overflow = ''
    this.frame.src = 'about:blank'
    const cb = this._onClose
    this._onClose = null
    if (!silent) cb?.()
  }

  get isOpen() {
    return this.root.classList.contains('is-open')
  }

  dispose() {
    this.close(true)
    this.root.remove()
  }
}
