// ─────────────────────────────────────────────────────────────
// loadFonts — EB Garamond + Noto Sans KR (about/works 페이지와 동일)
// ─────────────────────────────────────────────────────────────

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Sans+KR:wght@300;400;500&display=swap'

let loaded = false

export function loadFonts() {
  if (loaded || typeof document === 'undefined') return
  loaded = true

  if (!document.querySelector('link[data-forest-fonts="preconnect"]')) {
    const pre = document.createElement('link')
    pre.rel = 'preconnect'
    pre.href = 'https://fonts.googleapis.com'
    pre.dataset.forestFonts = 'preconnect'
    document.head.appendChild(pre)
  }

  if (!document.querySelector('link[data-forest-fonts="stylesheet"]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    link.dataset.forestFonts = 'stylesheet'
    document.head.appendChild(link)
  }
}

export const FONTS = {
  serif: "'EB Garamond', Georgia, 'Times New Roman', serif",
  sans: "'Noto Sans KR', system-ui, sans-serif",
}
