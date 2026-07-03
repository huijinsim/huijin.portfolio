// ─────────────────────────────────────────────────────────────
// config.js — Ethereal Forest 설정
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  renderer: {
    maxPixelRatio: 1.5,
    clearColor: '#89d8fa',
    toneMappingExposure: 1.08,
  },

  dayCycle: {
    default: 0,
    /** 아침(0) → 밤(1) 자동 진행 주기(초) */
    autoDuration: 120,
  },

  // Summer Afternoon 무드 — 따뜻한 오후 빛 + 부드러운 발광
  quality: {
    aoRadius: 2.0,
    aoScale: 0.28,
    bloomStrength: 0.05,
    bloomRadius: 0.6,
    bloomThreshold: 0.82,
  },

  painterly: {
    edgeThreshold: 0.22,
    edgeSoftness: 0.38,
    inkColor: '#3a5040',
    inkStrength: 0.12,
    hatchScale: 4.0,
    hatchStrength: 0.0,
    hatchInk: '#4a6848',
    celLevels: 6,
    celMix: 0.04,
    paper: 0.004,
    paperScale: 2.8,
    wash: 0.02,
    washColor: '#d8f0fc',
    saturation: 0.88,
    lift: 0.014,
    shadowTint: '#3a6848',
    highlightTint: '#f8fcff',
    vignette: 0.02,
  },

  // 숲 전경 — home(기본·최대 후退) · close(최대 줌인)
  camera: {
    home: {
      position: [-4, 20, 88],
      target: [0, 5, 42],
      fov: 38,
    },
    close: {
      position: [-5, 17, 58],
      target: [3, 5, 16],
      fov: 32,
    },
    zoom: {
      value: 0,
      default: 0,
      min: 0,
      max: 1,
      speed: 0.006,
      keySpeed: 0.85,
      damping: 0.18,
    },
    pan: {
      value: 0,
      default: 0,
      min: -28,
      max: 28,
      wheelSpeed: 0.035,
      keySpeed: 22,
      damping: 0.1,
    },
    keyboard: {
      panSpeed: 22,
    },
    near: 0.1,
    far: 800,
  },

  intro: {
    title: 'Ethereal Forest',
    subtitle: '숲 속으로 들어가기',
    enterLabel: 'Enter the Forest',
  },

  interaction: {
    focusDuration: 1.35,
    returnDuration: 1.1,
    treeCameraOffset: [0, 1.0, 10.8],
    butterflyCameraOffset: [0, 0.45, 5.2],
    butterflyEnterLabel: '나비의 속삭임 ↗',
    backLabel: '돌아가기',
    butterflyCursor: {
      urls: [
        '/butterfly/butterfly4.PNG',
        '/butterfly/butterfly5.PNG',
        '/butterfly/butterfly6.PNG',
      ],
      size: 150,
    },
    shinyCards: {
      urls: [
        '/card/card01.jpg',
        '/card/card02.jpg',
        '/card/card03.jpg',
        '/card/card04.jpg',
      ],
      titleUrl: '/title/menifesto.PNG',
      titleWidth: 300,
      width: 200,
      expandedWidth: 560,
      backUrl: '/card/postcard.jpg',
      dampen: 40,
      stagger: 0.12,
      enterDuration: 0.72,
    },
    flowerStickers: {
      urls: [
        '/flower/flower_14.PNG',
        '/flower/flower_15.PNG',
        '/flower/flower_16.PNG',
        '/flower/flower_17.PNG',
      ],
      primaryUrls: ['/flower/flower_15.PNG', '/flower/flower_16.PNG'],
      secondaryUrls: ['/flower/flower_14.PNG', '/flower/flower_17.PNG'],
      primaryWeight: 0.78,
      perCluster: 10,
      clusters: [
        { cx: -0.98, cy: -0.45, radius: 0.26 },
        { cx: -0.98, cy: 0.16, radius: 0.28 },
        { cx: 0.98, cy: -0.45, radius: 0.26 },
        { cx: 0.98, cy: 0.16, radius: 0.28 },
      ],
      edgePadding: 16,
      bottomPadding: 132,
      sizeRatio: 0.32,
      scaleMin: 0.84,
      scaleMax: 1.22,
      clusterGap: 0.16,
      radialStagger: 0.055,
      stagger: 0.038,
      popDuration: 0.5,
    },
  },

  butterflies: {
    count: 18,
    purple: '#a878e8',
    pink: '#f088b0',
    scaleMin: 0.72,
    scaleMax: 1.05,
    nearRatio: 0.45,
    zone: { x: 38, yMin: 2.0, yMax: 7.5, zNearMin: 4, zNearMax: 18, zFarMin: -42, zFarMax: -2 },
  },

  popups: {
    green: {
      bg: '#4a7a48',
      title: 'About Me',
      body: '공간과 감각, 기술이 만나는 접점을 탐구하는 디자이너 심희진의 이야기.',
    },
    pink: {
      bg: '#c96a8a',
      title: 'Works',
      body: '자연의 언어를 디지털로 번역한 프로젝트들을 소개합니다.',
    },
  },

  parallax: {
    strength: 1.0,
    damping: 0.05,
    look: 0.45,
    breathe: 0.12,
    breatheSpeed: 0.16,
  },

  wind: {
    speed: 0.95,
    frequency: 0.22,
    amplitude: 0.16,
    swayBase: 1.5,
    swayTop: 9.0,
  },

  light: {
    direction: [-0.22, 0.52, 0.48],
    color: '#f4f2ec',
    ambientColor: '#c8dcd8',
    bounceColor: '#a898a8',
    ambient: 0.94,
    highlight: 0.14,
    skyFill: 0.26,
    lightMix: 0.12,
    bounceStrength: 0.1,
    moodColor: '#c0d0c8',
    moodStrength: 0.32,
    groundMoodStrength: 0.4,
  },

  outline: {
    width: 0.008,
    color: '#484840',
  },

  /** 3D 스케치 선 — 해칭·외곽선·포스트 엣지 */
  sketch: {
    hatchStrength: 0.2,
    ink: '#484840',
    edgeStrength: 0.28,
    edgeThreshold: 0.055,
    inkNoise: 0.36,
    outlineWobble: 0.0045,
  },

  /** 2.5D — 3D 메시 Y축 눌림 + 플랫 일러스트 */
  flat25d: {
    squashY: 0.36,
    normalFlatten: 0.98,
    shadeBands: 2,
    layerStrength: 0.92,
    layerFog: 0.42,
    colorLevels: 10,
    fogWash: '#dce8d8',
    paperStage: 0.04,
  },

  sky: {
    top: '#5a98d8',
    bottom: '#8ec8f0',
    horizon: '#6eb0e4',
    sunset: '#78b8e8',
    radius: 420,
    celestialX: -0.92,
    celestialY: 0.22,
    isMoon: 0,
  },

  // 몽환적 포스트 FX
  dream: {
    bloomThreshold: 0.64,
    bloomStrength: 0.045,
    bloomRadius: 2.0,
    warmTint: 0.012,
    warmColor: '#f0ece4',
    lift: 0.02,
    haze: 0.012,
    saturation: 0.78,
  },

  // 구름
  clouds: {
    driftAmp: 0.1,
    opacity: 0.88,
    skyBlend: 0.94,
    // GLB 구름 모델 (디오라마 주변에 떠 있음)
    models: [
      { id: 'cloud', url: '/models/cloud.glb', size: 20 },
    ],
    count: 9,
    minScale: 0.7,
    maxScale: 1.5,
    yMin: 22,
    yMax: 42,
    radiusMin: 0.55,
    radiusMax: 1.25,
    items: [
      [-58, 34, -118, 6.2, 2, 0],
      [12, 38, -125, 7.0, 2, 0],
      [68, 32, -112, 5.4, 2, 1],
      [-92, 44, -142, 7.5, 2, 0],
      [98, 40, -135, 6.5, 1, 0],
      [-8, 48, -148, 8.0, 2, 0],
      [42, 26, -102, 4.8, 0, 1],
      [-38, 28, -105, 5.0, 0, 1],
      [115, 34, -128, 5.6, 1, 1],
      [-130, 36, -138, 5.2, 1, 1],
    ],
    scatter: 8,
  },

  /** 디오라마 섬 — 받침대 위 정사각 숲 + 언덕 + 길 */
  diorama: {
    // GLB 지형 사용 (없으면 절차적 언덕)
    terrainUrl: '/models/hill-terrain2.glb',
    glbHeight: 13,
    glbFill: 1.1,
    glbGrid: 220,
    glbSmooth: 5,
    size: 150,
    grid: 320,
    edgeMargin: 14,
    base: 11,
    rimHeight: 1.8,
    rimColor: '#5ea048',
    grassLow: '#8c9749',
    grassHigh: '#bfcb78',
    soilColor: '#b89568',
    colorHeight: 11,
    surfaceNoise: 2.0,
    hills: [
      { x: 0, z: -14, amp: 9, r: 62 },
      { x: -34, z: 18, amp: 4.5, r: 44 },
      { x: 36, z: 4, amp: 5, r: 46 },
      { x: 12, z: -40, amp: 5.5, r: 50 },
    ],
    path: [
      [-8, 70],
      [-2, 46],
      [14, 26],
      [4, 4],
      [-16, -16],
      [-6, -38],
      [10, -58],
    ],
    pathWidth: 8,
    pathCarve: 0.7,
    pathColor: '#e8c878',
    rockCount: 0,
  },

  forest: {
    seed: 5829,
    treeModelHeight: 5.8,
    groundSamplePad: 1.4,
    groundLift: 0.02,
    treeGroundSink: -0.06,

    /** 잎·기둥 4색 — 나무 디자인별로 한 쌍씩 지정 */
    foliagePalette: ['#a1b15f', '#8c9749', '#bfcb78', '#aebb62'],
    trunkPalette: ['#88826d', '#b5ae9f', '#7d7458', '#92896e'],

    plantMaterial: {
      roughness: 0.9,
      trunkRatio: 0.1,
      trunkBlend: 0.02,
      trunkRadiusRatio: 0.052,
      trunkPalette: ['#88826d', '#b5ae9f', '#7d7458', '#92896e'],
    },

    /** GLB 나무 3종 — 잎·기둥색 종류별 지정 */
    treeModels: [
      {
        id: 'cypress-asymmetric-a',
        url: '/models/tree1_1-optimized.glb',
        height: 6.2,
        count: 65,
        minScale: 0.7,
        maxScale: 1.22,
        material: {
          foliage: '#b1ba5a',
          trunk: '#88826d',
          trunkRatio: 0.105,
          trunkRadiusRatio: 0.055,
        },
      },
      {
        id: 'cypress-asymmetric-b',
        url: '/models/tree1_2-optimized.glb',
        height: 6.2,
        count: 65,
        minScale: 0.68,
        maxScale: 1.2,
        material: {
          foliage: '#8c9749',
          trunk: '#b5ae9f',
        },
      },
      {
        id: 'christmas-tree-1',
        url: '/models/christmas-tree-1-optimized.glb',
        height: 6.4,
        count: 60,
        minScale: 0.68,
        maxScale: 1.2,
        material: {
          foliage: '#bfcb78',
          trunk: '#7d7458',
          trunkRatio: 0.105,
          trunkRadiusRatio: 0.055,
          randomFoliage: true,
          foliagePalette: ['#b1ba5a', '#aebb62', '#bfcb78', '#a1b15f'],
        },
      },
    ],
    areaX: 88,
    zNear: 14,
    zFar: -175,
    clearingCenter: [0, -4],
    clearingRadius: 2.6,
    bushModel: {
      url: '/models/leafy-bush.glb',
      height: 1.05,
      count: 0,
      minScale: 0.55,
      maxScale: 1.15,
      groundSink: -0.04,
      spacing: 1.42,
      radiusScale: 0.78,
      material: {
        splitMode: 'foliage',
        randomFoliage: true,
        foliagePalette: ['#aebb62', '#b1ba5a', '#bfcb78', '#a8b868'],
      },
    },
    /** 길가·풀숲 덩굴 — 관목 대신 두 종 교차 배치 */
    flowerModels: [
      {
        id: 'flower-vine1',
        url: '/models/flower-vine1-optimized.glb',
        height: 0.85,
        count: 240,
        minScale: 0.82,
        maxScale: 1.05,
        groundSink: -0.04,
        pathPad: 0.55,
        spacing: 1.18,
        radiusScale: 0.52,
        alternate: true,
        material: {
          preserveOriginal: true,
        },
      },
      {
        id: 'vine',
        url: '/models/vine-optimized.glb',
        height: 0.85,
        material: {
          preserveOriginal: true,
        },
      },
    ],
    cattails: 0,
    ferns: 0,
    rows: 10,
    treeScaleMul: 1.32,
    minTreeScale: 0.72,
    maxTreeScale: 1.22,
    canopyPadding: 1.42,
    canopyRadiusScale: 0.78,
  },

  /** 2D 배경 — 산 없음, 흰 하늘 */
  skyMountains: {
    horizonFallback: 0.52,
    tint: '#ffffff',
    tintMid: '#ffffff',
    tintNear: '#ffffff',
    nightTint: '#3d4540',
    farSkyMix: 0.28,
    midSkyMix: 0.22,
    nearSkyMix: 0.16,
    layers: [],
  },

  paper: {
    grain: 0.022,
    vignette: 0.08,
    vignetteSoftness: 0.72,
  },
}

export const PALETTE = {
  ground: '#bfcb78',
  groundWarm: '#d8f0fc',
  groundPatchLight: '#aebb62',
  groundPatchDark: '#8c9749',
  groundDirt: '#e8c878',
  bush: '#a1b15f',
  cloud: '#ffffff',
  cloudShade: '#e8f4fc',
  fern: '#aebb62',
  cattailStalk: '#88826d',
  cattailTipBright: '#f0d050',
}
