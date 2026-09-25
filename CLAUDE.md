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
- Katman bileşenleri `src/components/layers/`: `LayerNode` türe göre seçer; ortak kayıt `useLayerNode` (dönüşüm + opaklık + tıklayınca seçim). Türler: text, phone/tablet/laptop (`DeviceLayer`), image, shape (cube/rect/rounded/circle), svg (`SVGLoader`, isteğe bağlı kalınlık), video.
- Video katmanı: önizlemede `<video>` timeline'a eşlenir; dışa aktarmada `prepareFrameHooks` ile Mediabunny `CanvasSink` o anın karesini tam çözer (oynatıcı kare-doğru değildir). Videonun sesi kullanılmaz.
- Önizlemede düzenleme (`Stage.tsx` → `LayerGizmo`): tıklayınca seçim, drei `TransformControls` ile taşı/döndür/ölçekle (W/E/R). Bırakınca `manualTransformPatch` (`src/engine/manualTransform.ts`) animasyon etkisini koruyarak katmanın temel değerlerini günceller. Sürükleme sürerken `manualDrag.layerId` o katmanın motor tarafından ezilmesini engeller. Yardımcılar (`editor-helpers` grubu) video çıktısında kaldırılır, küçük resimde o kare için gizlenir; asla sürükleme sırasında React ile kaldırma.
- Seçili katman `useProjectStore.selectedTrackId`'de (önizleme, timeline, panel paylaşır); önizleme araçlarının durumu `src/store/editorStore.ts`.
- `src/components/LayerPanel.tsx` — katman ekleme/düzenleme; yüklenen görseller 2048 px'e küçültülüp data URL olarak projede saklanır (ileride Supabase Storage).
- `src/export/` — MP4 çıktısı (Mediabunny + WebCodecs). `bridge.ts` Canvas içindeki sahneyle bağlantı; kareler `advance()` ile tek tek çizilir. Metin (troika) worker'da hazırlandığı için kare yakalamadan önce `pendingTextSyncs` beklenir.
- `src/components/TimelinePanel.tsx` — `@xzdarcy/react-timeline-editor`. Blok = timeline aksiyonu; çakışan bloklar şeritlere bölünür. Ctrl+tekerlek ile zoom, genişliğe sığdır. Blok sağ tık menüsü (çoğalt, böl, katmana taşı, sil).
- `src/components/TrackList.tsx` — sol sütun: `dnd-kit` ile sürükleyerek sıralama (listede üstteki katman aynı derinlikte önde, `renderOrder`), göz (gizle) / kilit, çift tıkla yeniden adlandırma, sağ tık menüsü. Kütüphane blokları satırlar arası sürüklemeyi desteklemediği için taşıma menüden yapılır.
- `hidden` katman önizlemede ve videoda çizilmez; `locked` katman timeline'da ve önizlemede sürüklenemez, önizlemeden seçilmez.
- `src/project/templates.ts` — kendi şablonlarımız (sadece metin/şekil/telefon, dış asset yok). Her `build()` yeni id'ler üretir.
- `src/persistence/repository.ts` — proje kaydı (şimdilik IndexedDB, `idb-keyval`). Supabase'e geçişte aynı arayüz korunacak. `parseProjectFile` içe aktarılan JSON'u doğrular.
- `src/layout/` — `AppShell` (sol menü + üst çubuk: arama, dil seçici). Editör hariç tüm sayfalar bunun içinde.
- `src/screens/` — `Home` (sohbet kutusu + tanıtım bandı + şablonlar), `Videos` (projelerim), `Templates`, `ComingSoon`, `Editor` (800 ms gecikmeli otomatik kayıt). Yönlendirme `src/router.ts`: `#/`, `#/videos`, `#/templates`, `#/soon/<özellik>`, `#/p/<id>`.
- `src/components/ChatBox.tsx` — metinden video sohbeti; yapay zekâ henüz bağlı değil, cevap sabit bir bilgi mesajı.
- `public/templates/<id>.jpg` — şablon kartı önizlemeleri, uygulamadan render edilip kaydedildi. Şablon değişirse yeniden üretilmeli.
- Geri alma: zundo `handleSet` 600 ms içindeki ardışık değişiklikleri tek adımda birleştirir; `loadProject` geçmişi sıfırlar.

## Kısayollar
Boşluk oynat/durdur · Ctrl+Z / Ctrl+Y · Ctrl+C / Ctrl+V (oynatma kafasına) · Ctrl+D çoğalt · Delete sil · ←/→ seçili blokları 0,1 sn kaydır (Shift: 1 sn) · W/E/R taşı/döndür/ölçekle · S oynatma kafasından böl · ←/→ seçim yokken 1 kare (Shift: 1 sn) · Esc seçimi bırak · Home başa sar · Shift+tık çoklu seçim

## Proje formatı sürümleri
- `Project.version` ve `PROJECT_VERSION` (`src/engine/types.ts`). Formatı değiştirirken sürümü artır ve `src/engine/migrate.ts`'e bir adım ekle; eski adımları değiştirme. Kayıttan yükleme ve dosyadan içe aktarma `migrateProject`'ten geçer.
- Blok ayarları preset'te tanımlı (`params: ParamSpec[]`); motor `resolveParams` ile varsayılanları doldurur, panel hepsini gösterir.

## Yazı tipleri
- `src/assets/fonts/*.woff`, `python scripts/build-fonts.py` ile Fontsource (devDependency) paketlerinden üretilir: latin + latin-ext + Noto Sans Symbols 2 tek dosyada, çünkü troika tek font dosyası kabul ediyor ve `.woff2` açamıyor. Lisanslar (OFL) aynı klasörde.
- Metin çizimi dış sunucuya istek atmamalı; yeni font eklerken betiğe ekle ve Türkçe harfleri kontrol et.

## Diller (i18n)
- `i18next` + `react-i18next`. Ana dil **İngilizce** (`src/i18n/locales/en.ts`), Türkçe `tr.ts`. Seçim localStorage'da tutulur, tarayıcı diline bakılmaz.
- Kullanıcıya görünen **her** metin `t('...')` ile gelir; bileşenlerde düz metin yazma.
- Motor dilden bağımsız: animasyon/eğri/kategori adları `presets.<id>`, `easings.<id>`, `categories.<id>` anahtarlarında (`src/i18n/labels.ts`).
- Yeni dil: `locales/<kod>.ts` dosyasını `Translation` tipinde yaz (eksik anahtar derleme hatası verir), `src/i18n/index.ts` içinde `LANGUAGES` ve `resources`'a ekle. `i18n.test.ts` anahtar ve değişken eşitliğini kontrol eder.
- Şablon içeriği ve yeni katman adları oluşturulduğu andaki dilde üretilir; sonradan dil değişince proje içeriği değişmez. Videodaki sayı biçimi projede (`numberLocale`).

## İleri seviye bloklar
- `move` (özel hareket): katmanı hedefe götürür ve orada bırakır; art arda bloklar anahtar kare gibi yol çizer.
- Geçişler (`fade-black`, `fade-white`, `flash`) kamera satırında; `Stage.tsx`'teki tam ekran örtüyü sürer. Örtü en yüksek `renderOrder`'lı bir grupta: three.js önce grup sırasına bakar.
- Özel hız eğrisi: `easing: 'custom'` + `bezier`; `easingFor` (easing.ts). Panelde `CurveEditor` tutamaçları.

## Dosyalar ve ses
- `src/persistence/assets.ts` — dosya deposu (IndexedDB): proje `asset:<id>` referansı tutar, `resolveAssetUrl` blob URL'ye çevirir. Eski projelerdeki data URL'ler de çalışır.
- "Dosyaya kaydet" (`projectFile.ts`) kullanılan dosyaları `embeddedAssets` olarak gömer; "Dosyadan aç" geri yükler.
- Ses: `Project.audio` (AudioClip: start, offset=kaynakta başlangıç, duration, fade). `src/audio/schedule.ts` saf zamanlama (test edilir); `engine.ts` önizleme (Web Audio, timeline oynarken) ve dışa aktarma karışımı (OfflineAudioContext) — ikisi aynı planı kullanır.
- Timeline motoru `editorData` referansı her değiştiğinde oynatmayı durdurur: satır dizilerini mutlaka `useMemo` ile ver.

## Test
- Geliştirme modunda `window.__stores` (project, playback) tarayıcı otomasyon testleri için açık.

## Kurallar
- GSAP kullanma (lisansı kodsuz animasyon araçlarını yasaklıyor).
- Raylight'tan kod, şablon veya asset kopyalama.
- Yeni blok ya da eğri eklerken `evaluate.test.ts`'e test ekle.
