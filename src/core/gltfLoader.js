import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

let _loader = null

export function createGLTFLoader() {
  if (_loader) return _loader
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/')
  _loader = new GLTFLoader()
  _loader.setDRACOLoader(draco)
  return _loader
}
