/** Canvas'ın içindeki sahne ile dışarıdaki video çıktısı kodu arasındaki bağlantı. */
export interface ExportBridge {
  canvas: HTMLCanvasElement
  /** Çizimi elle kontrole alır ve çözünürlüğü ayarlar; eski hale döndüren fonksiyonu verir. */
  begin: (width: number, height: number) => () => void
  /** Mevcut oynatma zamanına göre bir kare çizer. */
  renderFrame: () => void
  /**
   * Tutamaç ve kılavuz gibi düzenleme yardımcılarını anında gizler/gösterir (React çizimi
   * beklemeden). Küçük resim gibi tek karelik yakalamalar kullanıcının sürüklemesini kesmesin diye.
   */
  setHelpersVisible: (visible: boolean) => void
}

export const exportBridge: { current: ExportBridge | null } = { current: null }

/**
 * Doluysa sahne oynatma zamanı yerine bu anı çizer. Küçük resim gibi arka plan çizimleri
 * kullanıcının oynatma kafasını oynatmadan bunu kullanır.
 */
export const renderTimeOverride: { current: number | null } = { current: null }

/** Henüz hazırlanmamış metinler; kare yakalanmadan önce beklenir. */
export const pendingTextSyncs = new Set<Promise<void>>()

/** Yüklenmekte olan 3D cihaz modelleri; video çıktısı ve küçük resim bunları bekler. */
export const pendingModelLoads = new Set<Promise<void>>()

/**
 * Dışa aktarmada her kare çizilmeden önce beklenen hazırlıklar (ör. video katmanının o
 * anki karesini çözmesi). Katmanlar kendini ekler ve çıkarır.
 */
export const prepareFrameHooks = new Set<(time: number) => Promise<void>>()
