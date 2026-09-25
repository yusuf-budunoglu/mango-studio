# motion-studio

Tarayıcıda çalışan, timeline ile düzenlenebilen hareketli ürün videosu editörü.

## Komutlar
- `npm run dev` — geliştirme sunucusu
- `npm test` — motor testleri (Vitest)
- `npx tsc -b` — tip kontrolü
- `npx oxlint src` — lint

## Mimari
- `src/engine/types.ts` — proje formatı (Project → Layer → Block). Editör, motor, şablonlar ve ileride MCP bu formatı paylaşır. **Formatı değiştirmeden önce sor.**
- `src/engine/evaluate.ts` — `evaluate(project, t)`: saf fonksiyon, aynı `t` için hep aynı sonucu vermeli. Önizleme ve video çıktısı bunu kullanır.
- `src/engine/presets.ts` — animasyon blokları. Yeni blok = buraya bir kayıt + test.
- `src/engine/easing.ts` — hız eğrileri (`motion` paketinden).
- `src/store/projectStore.ts` — Zustand + zundo. Proje değişiklikleri sadece store aksiyonlarıyla yapılır (geri alma buna bağlı). Oynatma zamanı ayrı store'da, geri almaya girmez.
- `src/components/Stage.tsx` — React Three Fiber önizleme. Her karede `evaluate` çalışır, React yeniden çizilmez.
- `src/components/LayerPanel.tsx` — katman ekleme/düzenleme; yüklenen görseller 2048 px'e küçültülüp data URL olarak projede saklanır (ileride Supabase Storage).
- `src/export/` — MP4 çıktısı (Mediabunny + WebCodecs). `bridge.ts` Canvas içindeki sahneyle bağlantı; kareler `advance()` ile tek tek çizilir. Metin (troika) worker'da hazırlandığı için kare yakalamadan önce `pendingTextSyncs` beklenir.
- `src/components/TimelinePanel.tsx` — `@xzdarcy/react-timeline-editor`. Blok = timeline aksiyonu; çakışan bloklar şeritlere bölünür. Ctrl+tekerlek ile zoom.
- `src/project/templates.ts` — kendi şablonlarımız (sadece metin/şekil/telefon, dış asset yok). Her `build()` yeni id'ler üretir.
- `src/persistence/repository.ts` — proje kaydı (şimdilik IndexedDB, `idb-keyval`). Supabase'e geçişte aynı arayüz korunacak. `parseProjectFile` içe aktarılan JSON'u doğrular.
- `src/screens/` — `Home` (şablonlar + projelerim) ve `Editor` (800 ms gecikmeli otomatik kayıt). Yönlendirme `src/router.ts`, `#/p/<id>`.
- Geri alma: zundo `handleSet` 600 ms içindeki ardışık değişiklikleri tek adımda birleştirir; `loadProject` geçmişi sıfırlar.

## Kısayollar
Boşluk oynat/durdur · Ctrl+Z / Ctrl+Y · Ctrl+C / Ctrl+V (oynatma kafasına) · Ctrl+D çoğalt · Delete sil · ←/→ 0,1 sn kaydır (Shift: 1 sn) · Esc seçimi bırak · Home başa sar · Shift+tık çoklu seçim

## Diller (i18n)
- `i18next` + `react-i18next`. Ana dil **İngilizce** (`src/i18n/locales/en.ts`), Türkçe `tr.ts`. Seçim localStorage'da tutulur, tarayıcı diline bakılmaz.
- Kullanıcıya görünen **her** metin `t('...')` ile gelir; bileşenlerde düz metin yazma.
- Motor dilden bağımsız: animasyon/eğri/kategori adları `presets.<id>`, `easings.<id>`, `categories.<id>` anahtarlarında (`src/i18n/labels.ts`).
- Yeni dil: `locales/<kod>.ts` dosyasını `Translation` tipinde yaz (eksik anahtar derleme hatası verir), `src/i18n/index.ts` içinde `LANGUAGES` ve `resources`'a ekle. `i18n.test.ts` anahtar ve değişken eşitliğini kontrol eder.
- Şablon içeriği ve yeni katman adları oluşturulduğu andaki dilde üretilir; sonradan dil değişince proje içeriği değişmez. Videodaki sayı biçimi projede (`numberLocale`).

## Test
- Geliştirme modunda `window.__stores` (project, playback) tarayıcı otomasyon testleri için açık.

## Kurallar
- GSAP kullanma (lisansı kodsuz animasyon araçlarını yasaklıyor).
- Raylight'tan kod, şablon veya asset kopyalama.
- Yeni blok ya da eğri eklerken `evaluate.test.ts`'e test ekle.
