import { useProjectStore, usePlaybackStore } from '../store/projectStore'

// Timeline araç çubuğu, sağ tık menüsü ve klavye kısayollarının ortak komutları. Seçili blok varsa
// bloklara, yoksa seçili klibe (katmana) uygulanır.

const selectedLayerId = () => {
  const { project, selectedTrackId } = useProjectStore.getState()
  return project.layers.some((l) => l.id === selectedTrackId) ? selectedTrackId : null
}

/** Oynatma kafasından böl: seçili blokları, blok seçili değilse seçili klibi. */
export function splitSelection() {
  const store = useProjectStore.getState()
  const time = usePlaybackStore.getState().time
  if (store.selectedBlockIds.length) return store.splitBlocks(store.selectedBlockIds, time)
  const layerId = selectedLayerId()
  if (layerId) store.splitClip(layerId, time)
}

export function deleteSelection() {
  const store = useProjectStore.getState()
  if (store.selectedBlockIds.length) return store.removeBlocks(store.selectedBlockIds)
  const layerId = selectedLayerId()
  if (layerId) store.removeLayer(layerId)
}

export function duplicateSelection() {
  const store = useProjectStore.getState()
  if (store.selectedBlockIds.length) return store.duplicateBlocks(store.selectedBlockIds)
  const layerId = selectedLayerId()
  if (layerId) store.duplicateLayer(layerId)
}

/** Araç çubuğunda düğmeler seçime göre açılıp kapanır. */
export function canSplit() {
  const { project, selectedBlockIds, selectedTrackId } = useProjectStore.getState()
  const time = usePlaybackStore.getState().time
  if (selectedBlockIds.length) return true
  const layer = project.layers.find((l) => l.id === selectedTrackId)
  return !!layer && time > layer.start + 0.05 && time < layer.start + layer.duration - 0.05
}
