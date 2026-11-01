# Mango Studio — marka kimliği

## Ad
**Mango Studio**. Wordmark düz yazı: "Mango Studio", Figtree 500, normal harf, tek renk (yazı rengi), solunda mango işareti. 2026-11-01: degrade "STUDIO" ve büyük harf kaldırıldı (kullanıcı onayı; unslop: degrade wordmark yapay zekâ işi gibi görünür).

## Yazı tipleri
- Tüm sitede tek yazı tipi: **Figtree** (`Mango UI`, `--font-ui`; `--font-display` de aynı aile). 2026-10-06: kullanıcı ana sayfadaki fontun her yerde kullanılmasını istedi; Inter ve Space Grotesk arayüzden kalktı. Sayılar ve kodlar için `--font-mono` (sistem monosu).
- Referans hyperframes.dev'in fontu TT Norms Pro (ücretli); Figtree ona en yakın açık font. Lisans alınırsa `src/index.css` başındaki iki `@font-face` değişir.
- Ağırlıklar 400 / 500, nadiren 600 (birincil düğme, ana sayfa büyük başlığı; ikinci satırı 300). 700+ yok. Sıralama boyut ve renkle.
- Boyutlar tam piksel (11, 12, 13, 14, 15, 16, 18…); 16 px altında harf aralığı 0, büyük harfli aralıklı etiket yok.
- OFL, değişken (wght 300–900) woff2 olarak `src/assets/fonts/ui/` içinde; dışarıdan yüklenmez.
- Videodaki yazı tipleri ayrı (`src/render/fonts.ts`); bu değişiklik onları etkilemez.

## Logo
Dalgalı bantlı mango + yaprak (`public/brand/`):
- `mango-logo-2048.png` — asıl dosya (saydam)
- `mango-mark.png` (512), `mango-mark-96.png` — arayüzde
- `../favicon.png` (64), `apple-touch-icon.png` (180, siyah zemin)

Logo her zaman koyu zemin üzerinde kullanılır; etrafında en az logo genişliğinin %25'i boşluk.

## Renkler
Arayüzün çoğu siyah; vurgular logodaki mango renklerinden. Değerler `src/index.css` `:root` içinde.

| Rol | Token | Değer | Kullanım |
|---|---|---|---|
| Zemin | `--bg` | `#0B0A09` | sayfa: sıcak simsiyah (2026-11-01; önce `#000`) |
| Panel | `--panel` / `--panel-2` / `--panel-3` | `#121110` / `#1A1917` / `#242220` | yan paneller, kartlar / kart içi, giriş / kalkık yüzey (aktif satır, hover) |
| Çizgi | `--line` / `--line-2` | `#211F1D` / `#332F2B` | ince ayraç / belirgin kenar |
| Yazı | `--ink` / `--ink-2` / `--muted` | `#F1ECE3` / `#C9C2B6` / `#9A9389` | birincil / ikincil / silik |
| Mango turuncusu | `--accent` | `#ff7a00` | ana vurgu: birincil düğme, seçili sekme, başlıklar |
| Turuncu üstü yazı | `--accent-ink` | `#160900` | birincil düğme yazısı |
| Mango sarısı | `--gold` | `#ffb21e` | ikincil vurgu |
| Yaprak yeşili | `--leaf` | `#46a83f` | olumlu: kaydedildi, başarı, canlı noktası |
| Mandalina / kırmızı | `--tangerine` / `--mango-red` | `#ff5a1f` / `#e2361b` | grafik, tanıtım, "Popüler" rozeti |
| Hata | `--danger` | `#f04e37` | hata, silme |
| Claude | `--claude` | `#d97757` | yalnızca Claude adı ve simgesinin yanında |
| Marka degradesi | `--brand-gradient` | kırmızı → mandalina → turuncu → sarı → limon | arayüzde kullanılmaz; video şablonlarında serbest |

2026-10-01: turuncu, Claude'un mercan turuncusundan (`#d97757`) ayrışsın diye doygun ve sarıya yakın `#ff7a00` oldu (kullanıcı: "Claude turuncusu olmasın, daha ayırt edici"). Pastel değil, doygun: eski "çok açık" uyarısı pastel tonlar içindi. Claude rengi yalnızca Claude'a ait öğelerde kullanılır, böylece iki turuncu yan yana karışmaz.

## Temalar
Koyu (varsayılan, sıcak simsiyah) ve açık (sıcak krem `#f7f4ee`, yazı `#1f1b16`; 2026-11-01'e kadar daha sarı `#f7f0de`). Vurgu renkleri iki temada aynı; editör her zaman koyu. Değerler `src/index.css`.

## Yön (2026-11-01, unslop yöntemi)
- **Karakter:** sıcak, kesin, telaşsız.
- **Dünya:** karanlık bir kurgu odası: siyah duvarlar, monitör ışığı, tek sıcak lamba (mango). Zenginlik ekrandaki videolarda; arayüz susar.
- **Anlar:** ana sayfa videosu ve şablon döngüleri; editörde sahne ve timeline küçük resimleri.
- **İmza:** "mango çizgisi": seçili şeyin solunda 2 px turuncu çizgi (`inset 2px 0 0 var(--accent)`): sol menü, editör kütüphane sekmesi, seçili katman (timeline ve tasarım katmanları). Başka yerde kullanılmaz.

## Kurallar
- Turuncu ana vurgudur; bir ekranda birden çok birincil turuncu düğme olmasın (Studio boş durumu ikincil düğme kullanır).
- Turuncu yüzey yıkaması (`accent-soft` zemin, turuncu degrade kart) yok; öne çıkan kart belirgin kenar + bir adım açık yüzeyle ayrılır.
- Hover turuncu kenar değil: yüzey adımı (`--panel-2` → `--panel-3`) ya da `--line-2` kenar. Odak halkası turuncu kalır.
- Simgeler yazı rengini alır (`--muted` / `--ink`); turuncu ya da altın simge yok.
- Rozet ve hap az: "PRO" rozeti kaldırıldı (kart altında "Premium" yazıyor); "Most popular" ve indirim satırı sessiz metin. Yalnızca kullanıcının istediği MCP "New" rozeti kalır.
- Köşe yarıçapı boyuta göre: küçük düğme/etiket 4–6, satır/düğme/giriş 8–10, kart 12–16, panel/pencere 16–20. 999 px hap kullanma.
- Hareket: tek eğri `--ease`; hover 150 ms renk/yüzey, basınca `scale(0.98)`. Döngü animasyonu, hover'da yukarı kalkma, açılışta kayarak gelen üst çubuk yok.
- Degrade idareli: tanıtım videoları ve logo dışında kullanılmaz (wordmark'ta da yok).
- Yeşil yalnızca olumlu durum içindir, dekoratif kullanılmaz.
- Üst menüde öne çıkan öğe (MCP) altın degradeli yazı; sürekli süzülen ışık (`.shimmer-text`) yalnızca MCP yazısında (2026-10-06: kullanıcı diğer menü yazılarında istemedi; 2026-11-01 parlatmada da kullanıcı "dokunma" dedi), hareket azaltma tercihinde kapalı.
- Ana sayfanın aurora zemini (`AuroraBackground`) kalır (2026-11-01 kullanıcı kararı).
- Yeni renk eklerken önce buradaki tokenlardan birini kullan.
