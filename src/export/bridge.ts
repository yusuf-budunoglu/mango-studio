/** Canvas'ın içindeki sahne ile dışarıdaki video çıktısı kodu arasındaki bağlantı. */
export interface ExportBridge {
  canvas: HTMLCanvasElement
  /** Çizimi elle kontrole alır ve çözünürlüğü ayarlar; eski hale döndüren fonksiyonu verir. */
  begin: (width: number, height: number) => () => void
  /** Mevcut oynatma zamanına göre bir kare çizer. */
  renderFrame: () => void
}

export const exportBridge: { current: ExportBridge | null } = { current: null }

/** Henüz hazırlanmamış metinler; kare yakalanmadan önce beklenir. */
export const pendingTextSyncs = new Set<Promise<void>>()
