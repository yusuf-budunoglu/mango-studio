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
- Katman bileşenleri `src/components/layers/`: `LayerNode` türe göre seçer; ortak kayıt `useLayerNode` (dönüşüm + opaklık + tıklayınca seçim). Türler: text, phone/tablet/laptop (`DeviceLayer`: hazır 3D modeller, yedek olarak kodla çizilen maketler — aşağıda "3D cihaz modelleri"; gövde rengi `deviceFinish`, laptop `lidAngle`; marka adı/logosu kullanılmaz), image, shape (cube/rect/rounded/circle), svg (`SVGLoader`, isteğe bağlı kalınlık), video.
- Video katmanı: önizlemede `<video>` timeline'a eşlenir; dışa aktarmada `prepareFrameHooks` ile Mediabunny `CanvasSink` o anın karesini tam çözer (oynatıcı kare-doğru değildir). Videonun sesi kullanılmaz.
- Önizlemede düzenleme (`Stage.tsx` → `LayerGizmo`): tıklayınca seçim, drei `TransformControls` ile taşı/döndür/ölçekle (W/E/R). Bırakınca `manualTransformPatch` (`src/engine/manualTransform.ts`) animasyon etkisini koruyarak katmanın temel değerlerini günceller. Sürükleme sürerken `manualDrag.layerId` o katmanın motor tarafından ezilmesini engeller. Yardımcılar (`editor-helpers` grubu) video çıktısında kaldırılır, küçük resimde o kare için gizlenir; asla sürükleme sırasında React ile kaldırma.
- Önizlemede kadraj dışı (taşma, `src/editor/previewFrame.ts`): kanvas (`stage-view`) kadraj + çevresinde ince bir şerit kadardır (her kenarda kadrajın kısa kenarının %14'ü; dikeyde ince kalır), kadraj `stage-frame` ile işaretlenir, şerit karartılır; kamera açısı `overscanFov` ile genişler (kadraj içi aynı). `cleanRenders` > 0 iken (video çıktısı) genişleme yok; küçük resim `previewView.frame` bölgesinden kırpılır. Araç çubuğunda aç/kapa (`editorStore.showOverscan`, localStorage).
- Seçili katman `useProjectStore.selectedTrackId`'de (önizleme, timeline, panel paylaşır); önizleme araçlarının durumu `src/store/editorStore.ts`.
- Editör düzeni (CapCut gibi): sol `LibraryPanel` (sekmeler: metin, cihaz, medya, şekil, ses, efekt, geçiş, kamera; tıklanan öğe oynatma kafasına eklenir, yeni katman en üste), orta önizleme, sağ `PropertiesPanel` (seçime göre: blok ayarları / ses parçası / klip → Temel + Animasyon sekmeleri / hiçbiri → Proje + Efektler), altta timeline. Timeline yüksekliği sürüklenerek değişir (`editorStore.timelineHeight`, localStorage).
- `src/components/LayerPanel.tsx` — `LayerFields`: seçili klibin içerik ve konum ayarları; yüklenen görseller 2048 px'e küçültülüp data URL olarak projede saklanır (ileride Supabase Storage). Cihaz ekran görüntüsü `setScreenImage` ile değişir: aynı görseli paylaşan aynı türdeki cihazlar (şablonda her çekim ayrı telefon katmanı) birlikte güncellenir.
- `src/components/AnimationPanel.tsx` — klibin Animasyon sekmesi: giriş/çıkış tek seçimli (klibin kenarına yapışık, süre kaydırıcısı), vurgu/hareket/metin oynatma kafasına eklenir; altta klipteki tüm bloklar (tıklayınca blok ayarları).
- `src/editor/commands.ts` — böl / sil / çoğalt: seçili blok varsa bloklara, yoksa seçili klibe. Araç çubuğu, sağ tık menüsü ve kısayollar bunu kullanır.
- `src/export/` — MP4 çıktısı (Mediabunny + WebCodecs). `bridge.ts` Canvas içindeki sahneyle bağlantı; kareler `advance()` ile tek tek çizilir. Metin (troika) worker'da hazırlandığı için kare yakalamadan önce `pendingTextSyncs` beklenir.
- `src/components/TimelinePanel.tsx` — `@xzdarcy/react-timeline-editor`. Her katman bir klip satırı (`ClipBar`: giriş/çıkış kenarda gölge, diğer bloklar altta ince işaret). Klip açılınca (liste oku ya da çift tık, `editorStore.expandedLayers`) altında blok şeritleri; çakışan bloklar ayrı şeritte. Kamera ve ses satırları blok/parça gösterir. Timeline mutlak zamanla çalışır; `applyChanges` yalnızca değişen aksiyonları store'a verir (önce bloklar, sonra klipler). Satır başına yükseklik `rowHeight`. Araç çubuğu: geri al/yinele, böl, çoğalt, sil, zoom.
- `src/components/TrackList.tsx` — sol sütun: `dnd-kit` ile sürükleyerek sıralama (listede üstteki katman aynı derinlikte önde, `renderOrder`), animasyon şeridini aç/kapa, göz (gizle) / kilit, çift tıkla yeniden adlandırma, sağ tık menüsü. Kütüphane blokları satırlar arası sürüklemeyi desteklemediği için taşıma menüden yapılır.
- `hidden` katman önizlemede ve videoda çizilmez; `locked` katman timeline'da ve önizlemede sürüklenemez, önizlemeden seçilmez.
- `src/project/templates.ts` — kendi şablonlarımız (sadece metin/şekil/telefon, dış asset yok). Her `build()` yeni id'ler üretir.
- `src/persistence/repository.ts` — proje kaydı (şimdilik IndexedDB, `idb-keyval`). Supabase'e geçişte aynı arayüz korunacak. `parseProjectFile` içe aktarılan JSON'u doğrular.
- `src/layout/` — `AppShell` (sol menü + üst çubuk: arama, dil seçici). Editör hariç tüm sayfalar bunun içinde.
- `src/screens/` — `Home` (sohbet kutusu + tanıtım bandı + şablonlar), `Videos` (projelerim), `Templates`, `ComingSoon`, `Editor` (800 ms gecikmeli otomatik kayıt). Yönlendirme `src/router.ts`: `#/`, `#/videos`, `#/templates`, `#/soon/<özellik>`, `#/p/<id>`.
- `src/components/ChatBox.tsx` — metinden video sohbeti; yapay zekâ henüz bağlı değil, cevap sabit bir bilgi mesajı.
- `public/templates/<id>.jpg` — şablon kartı önizlemeleri, uygulamadan render edilip kaydedildi. Şablon değişirse yeniden üretilmeli.
- Geri alma: zundo `handleSet` 600 ms içindeki ardışık değişiklikleri tek adımda birleştirir; `loadProject` geçmişi sıfırlar.

## Kısayollar
Boşluk oynat/durdur · Ctrl+Z / Ctrl+Y · Ctrl+C / Ctrl+V (oynatma kafasına) · Ctrl+D çoğalt · Delete sil · S oynatma kafasından böl (son üçü blok seçili değilse klibe) · ←/→ seçili blokları 0,1 sn kaydır (Shift: 1 sn) · W/E/R taşı/döndür/ölçekle · ←/→ seçim yokken 1 kare (Shift: 1 sn) · Esc seçimi bırak · Home başa sar · Shift+tık çoklu seçim

## Klipler (format sürüm 2)
- Her katman bir klip: `Layer.start` + `Layer.duration` (sn). Klibin dışında katman çizilmez (`inClip`; başı dahil, sonu hariç: art arda iki klip kesmede aynı karede görünmez).
- Katman bloklarının `start`'ı klibin başına göre; kamera blokları ve ses parçaları videoya göre. Store dışarıya mutlak zaman alır/verir (`trackOffset`); dönüşüm store'da.
- `setClipTimes`: süre aynıysa taşıma (bloklar klible gider); kırpmada bloklar mutlak yerinde kalır, kenardaki giriş (sol) / çıkış (sağ) animasyonu kenarla gider; video soldan kırpılınca `mediaOffset` artar. `splitClip`: ikinci parça üstte yeni katman, bitmiş giriş animasyonları ona geçmez.
- Proje süresi değişince videonun sonuna kadar süren klipler yeni sona uyar. Yeni katman oynatma kafasında 5 sn.
- Fintech şablonu 60 kare/sn'lik bir referans videodan kare kare ölçüldü: kesmeler `f(kare)` ile (181, 473, 658, 838, 977; süre 1157 kare), giriş/çıkış eğrileri ölçülen konumlara uydurulmuş bezier'ler. Değiştirirken kesme karelerini koru; `fitClip` blok başlangıçlarını mikro saniyeye yuvarlar.
- Görsel katmanı saydamlığı destekler (saydam PNG kenarlarıyla karışır). `wallet-promo` etiketleri tasarımı hazır saydam PNG'ler (`public/templates/wallet/badge-<id>-<dil>.png`, EN/TR); üretimleri HTML + başsız Chrome ile.
- `wallet-promo` şablonu dikey (1080×1920, 60 kare/sn), 60 fps referanstan kare kare ölçüldü; kesme yok, çekimler telefon kadrajdan çıkınca beyaz fonda değişir. Fon ışığı `public/templates/glow/oval.jpg` (referansın radyal renk profilinden üretildi, kenarı beyaz), ekran `public/templates/screens/wallet.png` (bizim tasarımımız). Şablon kodunda proje boyutu `width/height` ile ezilir.
- Şablonlar bloklarıyla videoya göre yazılır; `fitClip` klibi katmanın göründüğü aralığa oturtur ve kenardaki 0 sn belirme/kaybolma bloklarını atar. Test (`buildUnfitted`) her şablonun eski haliyle aynı göründüğünü kontrol eder.
- Video katmanında eski `mediaStart` yok; video klibin başında başlar.

## Proje formatı sürümleri
- `Project.version` ve `PROJECT_VERSION` (`src/engine/types.ts`). Formatı değiştirirken sürümü artır ve `src/engine/migrate.ts`'e bir adım ekle; eski adımları değiştirme. Kayıttan yükleme ve dosyadan içe aktarma `migrateProject`'ten geçer.
- Blok ayarları preset'te tanımlı (`params: ParamSpec[]`); motor `resolveParams` ile varsayılanları doldurur, panel hepsini gösterir.

## Yazı tipleri
- `src/assets/fonts/*.woff`, `python scripts/build-fonts.py` ile Fontsource (devDependency) paketlerinden üretilir: latin + latin-ext + Noto Sans Symbols 2 tek dosyada, çünkü troika tek font dosyası kabul ediyor ve `.woff2` açamıyor. Lisanslar (OFL) aynı klasörde.
- Metin çizimi dış sunucuya istek atmamalı; yeni font eklerken betiğe ekle ve Türkçe harfleri kontrol et.
- Font listesi `src/render/fonts.ts` (`FONTS`, kategori: sans/display/serif/mono). Tek kalınlıklı fontta (Bebas Neue, DM Serif Display, Instrument Serif) kalın için normal dosya kullanılır. Lato Türkçe harfleri içermediği için eklenmedi.
- Kullanıcı fontu yükleyebilir (.ttf/.otf/.woff; troika .woff2 açamıyor): dosya deposunda `font` türü, katmanda `fontFamily: 'asset:<id>'`. `useTextFontUrl` (`src/render/fontFaces.ts`) blob adresini çözer; çözülene kadar metin çizilmez ve çıktı `pendingTextSyncs` ile bekler. Yüklenen fontta kalınlık seçilemez.
- `FontPicker`: her font kendi yazı tipiyle (`loadFontFace` → tarayıcı `FontFace`), arama, yükleme, yıldız = yeni metinlerin fontu (`preferredFont`, localStorage; proje formatına girmez, yeni katmana yazılır). Varsayılan Inter.
- SF Pro (Apple) lisansı uygulamayla dağıtımı yasaklıyor: pakete ekleme, kullanıcı kendisi yükleyebilir.

## Diller (i18n)
- `i18next` + `react-i18next`. Ana dil **İngilizce** (`src/i18n/locales/en.ts`), Türkçe `tr.ts`. Seçim localStorage'da tutulur, tarayıcı diline bakılmaz.
- Kullanıcıya görünen **her** metin `t('...')` ile gelir; bileşenlerde düz metin yazma.
- Motor dilden bağımsız: animasyon/eğri/kategori adları `presets.<id>`, `easings.<id>`, `categories.<id>` anahtarlarında (`src/i18n/labels.ts`).
- Yeni dil: `locales/<kod>.ts` dosyasını `Translation` tipinde yaz (eksik anahtar derleme hatası verir), `src/i18n/index.ts` içinde `LANGUAGES` ve `resources`'a ekle. `i18n.test.ts` anahtar ve değişken eşitliğini kontrol eder.
- Şablon içeriği ve yeni katman adları oluşturulduğu andaki dilde üretilir; sonradan dil değişince proje içeriği değişmez. Videodaki sayı biçimi projede (`numberLocale`).

## İleri seviye bloklar
- `move` (özel hareket): katmanı hedefe götürür ve orada bırakır; art arda bloklar anahtar kare gibi yol çizer.
- Geçişler (`fade-black`, `fade-white`, `flash`) kamera satırında; `Stage.tsx`'teki tam ekran örtüyü sürer. Örtü en yüksek `renderOrder`'lı bir grupta: three.js önce grup sırasına bakar.
- Özel hız eğrisi: `easing: 'custom'` + `bezier`; `easingFor` (easing.ts) kendi hassas çözücümüzü (`preciseCubicBezier`, 1e-10) kullanır — motion'ın `cubicBezier`'i ~1e-3 hata yapıyordu. Panelde `CurveEditor` tutamaçları.
- `move` X/Y/Z dönüşü de alır (`rotX`, `rotY`, `rotate`). Sinematik çekimlerde tek uzun `move` + yavaşlayan özel eğri kullan; kısa giriş + ayrı süzülme bloğu hızda kırılma yapar.
- `soft-reveal`: harfler soldan sağa yumuşak kenarla belirir. `TextLayer`'daki temel malzemenin `onBeforeCompile`'ı (troika bunu kendi shader'ından önce çalıştırır) harfin yerel x'ine göre opaklık verir.
- `focus-pull` netliği yalnızca başladıktan sonra değiştirir; başlamamış bloklar önceki odağı ezmez (hiç blok başlamadıysa ilki başlangıç değerini tutar). Eskiden son odak bloğunun `from`'u tüm videoyu tek düzleme odaklıyor, ekranlar tamamen bulanık çıkıyordu.
- `focus-pull` `blur` ayarı: o bloktan sonra alan derinliği bulanıklığının çarpanı (0 = net). Troika metni derinlik yazmadığı için alan derinliği metni de bulanıklaştırır; metinli geniş planlarda `blur: 0`.
- Alan derinliği açılıp kapanınca `EffectComposer` `key` ile yeniden kurulur (yoksa çizim donuyor).
- `Project.accentLight`: sol alttaki vurgu ışığının rengi (boşsa mor).

## Lens efektleri
- Proje ayarı (`effects`): `lensFlare` (sabit parlama, ekran konumu x/y -1..1), `lightLeak`, `chromatic`, `distortion`. Kamera satırı blokları (`lens` kategorisi): `lens-punch` (renk kayması + kısa yakınlaşma), `flare-sweep` (ekranı geçen parlama), `light-leak` (sızma patlaması); `camera-shake` (`camera` kategorisi, `wobble` ile rastgelelik olmadan sallanır).
- Shader'lar `src/render/lensEffects.ts`; değerleri `lensFrame` (effects.ts) ile her karede Stage yazar. postprocessing'in `time` sayacı ve lib'in `LensFlare`'i (zaman ve fare/raycast'e bağlı) kullanılmaz: aynı an hep aynı kareyi vermeli.
- Lens bükülmesi/renk kayması kendi `EffectPass`'inde (`LensPass`): aynı geçişte postprocessing efektleri özelliklerine göre sıralıyor, lens alan derinliğinin önüne geçip siliniyordu.
- Zincirde hangi efektlerin olduğu `EffectComposer` `key`'ine girer: alan derinliği açıkken geçiş eklenip çıkınca çizim donuyor.
- Preset `apply`'ın 5. argümanı blok süresi (zamana bağlı bloklar için).

## 3D cihaz modelleri
- `public/models/{phone,tablet,laptop}.glb`, `node scripts/process-models.mjs` ile `models-src/*.glb`'den (git'e girmez, Sketchfab indirmeleri) üretilir: logo/marka yazıları, klavye kılıfı/kalem ve duvar kağıtları çıkarılır; parça adları genelleştirilir; ekran +z'ye döndürülür, ölçü procedural maketlerle aynı; meshopt sıkıştırma.
- Dosyadaki sözleşme: ekran düğümü `screen` (0..1 UV, üst kenar v=1), gövde malzemeleri `finish:frame` / `finish:back`, laptop kapağı `lid` düğümü (menteşede, `extras.baseAngle`).
- `DeviceLayer` → `useDeviceModel` (`deviceModels.ts`, yerel meshopt çözücü, CDN yok). Yüklenene kadar/yüklenemezse kodla çizilen maket. Seçim görünmez kutu ile (model üçgenleri raycast edilmez). Yükleme sürerken `pendingModelLoads` dolu: video çıktısı bekler, küçük resim atlanır.
- Arayüzde marka/model adı kullanma. Atıflar `src/project/credits.ts` → `#/credits` sayfası; model değişirse güncelle. Laptop modeli Sketchfab Standard lisanslı (CC BY değil).
- Model inceleme aracı: `tools/model-viewer.html` (sadece geliştirme).

## Işık
- Metal/cam yüzeyler için `StudioEnvironment` (three.js `RoomEnvironment`, PMREM). drei'nin hazır ortamları CDN'den HDR indirdiği için kullanılmaz.
- `Project.lighting: 'studio'` → `ProductStudio`: drei `Lightformer` softbox/şerit/halka ışıklarından kodla kurulan ortam (CDN yok) + arkadan iki kenar ışığı. Varsayılan `soft` eski oda ışığı.
- `applyOpacity` malzemeyi yalnızca opaklık < 1 iken saydam yapar; hepsini saydam yapmak derinlik sıralamasını bozuyordu. Saydamlık durumu değişince `material.needsUpdate` şart: aksi halde bir kez opak çizilen malzeme saydamlaşmıyor, sönmeler (fade-out) sonda birden kayboluyordu.

## Video çıktısı kalitesi
- Sahne çıktının 2 katında çizilip 2D kanvasta küçültülür (`supersampleFactor`, çizim tarafı ≤ 4096): efekt zinciri açıkken tarayıcının kenar yumuşatması çalışmıyor.
- Hareket bulanıklığı `effects.motionBlur` (yalnızca çıktıda): kare anından ileriye deklanşör süresince alt kareler çizilip ortalanır (`subframeTimes`); kesme anlarında iki çekim karışmaz.
- Alt kareler `renderTimeOverride` ile çizilir; oynatma zamanını (store) her alt karede değiştirmek arayüzü yeniden çizdirip çıktıyı kat kat yavaşlatıyordu.
- Proje 60 kare/sn ise dışa aktarma penceresi varsayılan olarak 60'ı seçer.

## Dosyalar ve ses
- `src/persistence/assets.ts` — dosya deposu (IndexedDB): proje `asset:<id>` referansı tutar, `resolveAssetUrl` blob URL'ye çevirir. Eski projelerdeki data URL'ler de çalışır.
- "Dosyaya kaydet" (`projectFile.ts`) kullanılan dosyaları `embeddedAssets` olarak gömer; "Dosyadan aç" geri yükler.
- Ses: `Project.audio` (AudioClip: start, offset=kaynakta başlangıç, duration, fade). `src/audio/schedule.ts` saf zamanlama (test edilir); `engine.ts` önizleme (Web Audio, timeline oynarken) ve dışa aktarma karışımı (OfflineAudioContext) — ikisi aynı planı kullanır.
- Timeline motoru `editorData` referansı her değiştiğinde oynatmayı durdurur: satır dizilerini mutlaka `useMemo` ile ver.

## Test
- Geliştirme modunda `window.__stores` (project, playback, editor) ve `window.__templates` (main.tsx), `window.__bridge` (Stage.tsx: sahnenin kullandığı `export/bridge` örneği; HMR sonrası dinamik import başka kopya verebiliyor) tarayıcı otomasyonu için açık. Tek kare: `__bridge.exportBridge.current.begin(1920, 1080)` + `renderTimeOverride.current = t` + `renderFrame()`.
- Gizli/arka plandaki sekmede R3F kanvası boyut ölçmediği için sahne kurulmaz; `window.dispatchEvent(new Event('resize'))` ya da görünür/başsız (headless) tarayıcı kullan.

## Kurallar
- GSAP kullanma (lisansı kodsuz animasyon araçlarını yasaklıyor).
- Raylight'tan kod, şablon veya asset kopyalama.
- Yeni blok ya da eğri eklerken `evaluate.test.ts`'e test ekle.
