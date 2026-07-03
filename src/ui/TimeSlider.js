import { CONFIG } from '../config.js'

// ─────────────────────────────────────────────────────────────
// TimeSlider — 하루 시간(해→달) 조절 스크롤바
// ─────────────────────────────────────────────────────────────
export class TimeSlider {
  /** @param {(t:number)=>void} onChange */
  constructor(onChange, { onManualStart, onManualEnd } = {}) {
    this.onChange = onChange
    this.onManualStart = onManualStart
    this.onManualEnd = onManualEnd
    this._buildDom()
  }

  _buildDom() {
    this.root = document.createElement('div')
    this.root.id = 'time-slider'
    this.root.innerHTML = /* html */ `
      <style>
        #time-slider {
          position: fixed; left: 50%; bottom: 24px; top: auto;
          transform: translateX(-50%);
          z-index: 45; display: none;
          pointer-events: auto;
          width: min(420px, calc(100vw - 48px));
          padding: 10px 16px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(12px);
          color: #2a3028;
          font: 10px/1.3 ui-sans-serif, system-ui, sans-serif;
          user-select: none;
        }
        #time-slider.is-visible { display: block; }
        #time-slider .head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px; letter-spacing: 0.12em; text-transform: uppercase;
        }
        #time-slider .head span { opacity: 0.55; font-size: 9px; }
        #time-slider .label { font-size: 11px; letter-spacing: 0.08em; }
        #time-slider input[type=range] {
          width: 100%; height: 16px; margin: 0;
          -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer;
        }
        #time-slider input[type=range]::-webkit-slider-runnable-track {
          height: 4px; border-radius: 4px;
          background: linear-gradient(90deg, #b8d4e8 0%, #ede4a8 25%, #e4b0c0 50%, #b4a4c8 75%, #586078 100%);
        }
        #time-slider input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px;
          border-radius: 50%; background: #faf8f0; border: 1px solid rgba(0,0,0,0.2);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        #time-slider .ticks {
          display: flex; justify-content: space-between;
          margin-top: 6px; font-size: 8px; opacity: 0.5; letter-spacing: 0.06em;
        }
        #time-slider .ticks span:nth-child(1)::after { content: ' · 하늘'; }
        #time-slider .ticks span:nth-child(2)::after { content: ' · 노랑'; }
        #time-slider .ticks span:nth-child(3)::after { content: ' · 핑크'; }
        #time-slider .ticks span:nth-child(4)::after { content: ' · 남색'; }
      </style>
      <div class="head">
        <span>시간</span>
        <div class="label">아침</div>
      </div>
      <input type="range" min="0" max="1000" value="0" step="1" aria-label="하루 시간">
      <div class="ticks">
        <span>아침</span><span>점심</span><span>저녁</span><span>밤</span>
      </div>
    `

    document.body.appendChild(this.root)
    this.input = this.root.querySelector('input')
    this.labelEl = this.root.querySelector('.label')

    this.input.addEventListener('input', () => {
      const t = Number(this.input.value) / 1000
      this.onChange?.(t)
    })

    this.input.addEventListener('pointerdown', () => {
      this.onManualStart?.()
    })
    this._onManualEnd = () => this.onManualEnd?.()
    this.input.addEventListener('pointerup', this._onManualEnd)
    this.input.addEventListener('pointercancel', this._onManualEnd)

    this.root.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.root.addEventListener('click', (e) => e.stopPropagation())
  }

  show(initialT = CONFIG.dayCycle.default) {
    this.root.classList.add('is-visible')
    this.setValue(initialT, true)
  }

  hide() {
    this.root.classList.remove('is-visible')
  }

  setValue(t, notify = true) {
    const clamped = Math.max(0, Math.min(1, t))
    this.input.value = String(Math.round(clamped * 1000))
    if (notify) this.onChange?.(clamped)
  }

  setLabel(text) {
    if (this.labelEl) this.labelEl.textContent = text
  }

  dispose() {
    this.input.removeEventListener('pointerup', this._onManualEnd)
    this.input.removeEventListener('pointercancel', this._onManualEnd)
    this.root.remove()
  }
}
