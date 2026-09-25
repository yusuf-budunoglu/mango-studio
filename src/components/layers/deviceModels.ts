import { useEffect, useState } from 'react'
import type { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { pendingModelLoads } from '../../export/bridge'

// Hazır 3D cihaz modelleri (public/models, scripts/process-models.mjs ile üretilir).
// Yüklenemezse katman kodla çizilen maketi kullanır.

export type DeviceKind = 'phone' | 'tablet' | 'laptop'

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const promises = new Map<DeviceKind, Promise<Group | null>>()
const loaded = new Map<DeviceKind, Group | null>()

export function loadDeviceModel(kind: DeviceKind): Promise<Group | null> {
  let p = promises.get(kind)
  if (!p) {
    p = loader
      .loadAsync(`${import.meta.env.BASE_URL}models/${kind}.glb`)
      .then((gltf) => gltf.scene)
      .catch((error: unknown) => {
        console.warn(`device model ${kind} could not be loaded`, error)
        return null
      })
      .then((scene) => {
        loaded.set(kind, scene)
        return scene
      })
    promises.set(kind, p)
  }
  return p
}

/**
 * Modelin şablonunu verir; yüklenene kadar (ya da yüklenemezse) null. Yükleme sürerken video
 * çıktısı ve küçük resim bekleyebilsin diye `pendingModelLoads`'a kaydolur.
 */
export function useDeviceModel(kind: DeviceKind): Group | null {
  const [model, setModel] = useState<Group | null>(() => loaded.get(kind) ?? null)
  useEffect(() => {
    if (loaded.has(kind)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tür değişince önbellekteki modele geç
      setModel(loaded.get(kind) ?? null)
      return
    }
    let alive = true
    const done = loadDeviceModel(kind)
      .then((scene) => {
        if (alive) setModel(scene)
      })
      // React'in yeni sahneyi eklemesi için kısa bir süre
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))
    pendingModelLoads.add(done)
    void done.finally(() => pendingModelLoads.delete(done))
    return () => {
      alive = false
    }
  }, [kind])
  return model
}
