// ─────────────────────────────────────────────────────────────
// post.frag — 스케치/해칭 일러스트 무드 (makemepulse 2019 기법 참고)
// 연필 해칭 음영(선) + 얇고 부드러운 외곽선 + 밝고 가벼운 파스텔 톤 + 종이 질감
// ─────────────────────────────────────────────────────────────
precision highp float;

uniform sampler2D tDiffuse;
uniform vec2  uResolution;
uniform float uTime;

uniform float uEdgeThreshold;
uniform float uEdgeSoftness;
uniform vec3  uInkColor;
uniform float uInkStrength;

uniform float uHatchScale;
uniform float uHatchStrength;
uniform vec3  uHatchInk;

uniform float uCelLevels;
uniform float uCelMix;

uniform float uPaper;
uniform float uPaperScale;

uniform float uWash;
uniform vec3  uWashColor;

uniform float uSaturation;
uniform float uLift;
uniform vec3  uShadowTint;
uniform vec3  uHighlightTint;
uniform float uVignette;

varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 화면공간 연필 해칭: 어두울수록 선이 겹쳐 들어간다
float pencilHatch(vec2 uv, float shade) {
  vec2 p = uv * uResolution / uHatchScale;
  float jitter = valueNoise(p * 0.12) * 2.2; // 손그림 흔들림
  float dark = 0.0;

  float l1 = abs(sin((p.x + p.y) * 0.7 + jitter));
  dark += (1.0 - smoothstep(0.0, 0.45, l1)) * (1.0 - smoothstep(0.55, 0.85, shade));

  float l2 = abs(sin((p.x - p.y) * 0.7 + jitter + 1.7));
  dark += (1.0 - smoothstep(0.0, 0.45, l2)) * (1.0 - smoothstep(0.30, 0.55, shade));

  float l3 = abs(sin((p.x * 0.5 + p.y * 1.3) * 0.7 + 3.1));
  dark += (1.0 - smoothstep(0.0, 0.45, l3)) * (1.0 - smoothstep(0.12, 0.30, shade));

  return clamp(dark, 0.0, 1.0);
}

// 종이결 (격자 없는 부드러운 그레인)
float canvasTexture(vec2 uv) {
  vec2 p = uv * uResolution / uPaperScale;
  return valueNoise(p) * 0.6 + valueNoise(p * 2.3 + 7.0) * 0.4;
}

// 부드러운 소벨 외곽선
float edgeStrength(vec2 uv, vec2 px) {
  float tl = luma(texture2D(tDiffuse, uv + vec2(-px.x, px.y)).rgb);
  float t  = luma(texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb);
  float tr = luma(texture2D(tDiffuse, uv + vec2(px.x, px.y)).rgb);
  float l  = luma(texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb);
  float r  = luma(texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb);
  float bl = luma(texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb);
  float b  = luma(texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb);
  float br = luma(texture2D(tDiffuse, uv + vec2(px.x, -px.y)).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  return length(vec2(gx, gy));
}

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(tDiffuse, uv).rgb;
  float lum = luma(col);

  // ── 가벼운 셀 단계 (밴딩 약하게) ──
  vec3 q = floor(col * uCelLevels + 0.5) / uCelLevels;
  col = mix(col, q, uCelMix);

  // ── 연필 해칭 음영 (선적인 그림자) ──
  float hatch = pencilHatch(uv, lum);
  col = mix(col, col * uHatchInk, hatch * uHatchStrength);

  // ── 얇고 부드러운 외곽선 ──
  vec2 px = 1.0 / uResolution;
  float e = edgeStrength(uv, px);
  float ink = smoothstep(uEdgeThreshold, uEdgeThreshold + uEdgeSoftness, e);
  float wob = mix(0.7, 1.2, valueNoise(uv * uResolution * 0.06 + uTime * 0.04));
  col = mix(col, uInkColor, ink * uInkStrength * wob);

  // ── 종이 질감 ──
  float paper = canvasTexture(uv);
  col *= mix(1.0 - uPaper, 1.0 + uPaper, paper);

  // ── 밝고 가벼운(high-key) 워시: 화면을 종이색 쪽으로 살짝 띄움 ──
  col = mix(col, uWashColor, uWash * (0.4 + 0.6 * lum));

  // ── 스플릿톤 (밝기 보존, 색조만) ──
  float lum2 = luma(col);
  vec3 tint = mix(uShadowTint, uHighlightTint, smoothstep(0.18, 0.82, lum2));
  tint /= max(luma(tint), 0.001);
  col *= mix(vec3(1.0), tint, 0.45);
  col = mix(vec3(lum2), col, uSaturation);
  col = col * (1.0 + uLift) + uLift;

  // ── 부드러운 비네팅(종이 프레임 느낌) ──
  float d = distance(uv, vec2(0.5));
  col *= mix(1.0, smoothstep(0.9, 0.5, d), uVignette);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
