import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

// ─────────────────────────────────────────────────────────────
// Vite 설정 (vanilla JS, 프레임워크 없음)
// - vite-plugin-glsl: .glsl / .vert / .frag 파일을 문자열로 import.
//   #include 지원으로 셰이더 청크를 재사용할 수 있다.
// ─────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      warnDuplicatedImports: true,
      compress: false, // 개발 중 가독성 위해 압축 비활성화
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
})
