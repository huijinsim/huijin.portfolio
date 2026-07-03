import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

let loader

/** Draco 압축 GLB를 포함해 공통 GLTF 로더 반환 */
export function createGLTFLoader() {
  if (!loader) {
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
  }
  return loader
}
