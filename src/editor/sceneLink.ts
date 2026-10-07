import { Box3, Vector3, type Camera, type Scene } from 'three'
import type { Extent } from './stacking'

/** Kanvasın içindeki sahne ve kamera; kanvasın dışındaki arayüz (seçim kutusu, katman listesi) buradan okur. */
export const sceneLink: { camera: Camera | null; scene: Scene | null } = { camera: null, scene: null }

const box = new Box3()
const corner = new Vector3()
const forward = new Vector3()
const eye = new Vector3()

/** Katmanın o an kameraya göre kapladığı yer; sahne hazır değilse ya da katman çizilmiyorsa null. */
export function layerExtent(layerId: string): Extent | null {
  const { camera, scene } = sceneLink
  const object = scene?.getObjectByName(`layer:${layerId}`)
  if (!camera || !object?.visible) return null
  box.setFromObject(object)
  if (box.isEmpty()) return null
  camera.getWorldPosition(eye)
  camera.getWorldDirection(forward)
  const extent: Extent = { near: Infinity, far: -Infinity, rect: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } }
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
    const depth = corner.clone().sub(eye).dot(forward)
    extent.near = Math.min(extent.near, depth)
    extent.far = Math.max(extent.far, depth)
    corner.project(camera)
    extent.rect.x0 = Math.min(extent.rect.x0, corner.x)
    extent.rect.x1 = Math.max(extent.rect.x1, corner.x)
    extent.rect.y0 = Math.min(extent.rect.y0, corner.y)
    extent.rect.y1 = Math.max(extent.rect.y1, corner.y)
  }
  return extent.near > 0.01 ? extent : null
}

/** Kameranın sahnedeki yeri (katmanı bakış ışını boyunca kaydırmak için). */
export function cameraPosition(): [number, number, number] | null {
  return sceneLink.camera ? (sceneLink.camera.getWorldPosition(eye).toArray() as [number, number, number]) : null
}
