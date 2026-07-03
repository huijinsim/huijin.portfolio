import { App } from './App.js'

// ─────────────────────────────────────────────────────────────
// main.js — 풀스크린 3D 숲 장소 진입
// ─────────────────────────────────────────────────────────────
const app = new App({
  container: document.getElementById('app'),
  loaderEl: document.getElementById('loader'),
})

app.bootstrap().catch((err) => {
  console.error('[forest] bootstrap 실패:', err)
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.dispose()
  })
}
