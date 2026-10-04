# Mango Studio — marka kimliği

## Ad
**Mango Studio**. Wordmark büyük harf: `MANGO` sıcak beyaz (kalın), `STUDIO` marka degradesi (orta kalınlık).

## Yazı tipleri
- `--font-display` = **Space Grotesk** (`Mango Display`): wordmark ve büyük başlıklar; büyük harf, 700, sıkı aralık (-0.02em).
- `--font-ui` = **Inter** (`Mango UI`): arayüzün geri kalanı.
- İkisi de OFL, değişken (wght) woff2 olarak `src/assets/fonts/ui/` içinde; dışarıdan yüklenmez.

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
| Zemin | `--bg` | `#000000` | sayfa: simsiyah (2026-10-01) |
| Panel | `--panel` / `--panel-2` | `#0D0D0F` / `#16161A` | yan paneller, kartlar |
| Çizgi | `--line` | `#232327` | ayraçlar, kenarlar |
| Yazı | `--ink` / `--muted` | `#F5F2EC` / `#98948C` | sıcak beyaz / ikincil |
| Mango turuncusu | `--accent` | `#ff7a00` | ana vurgu: birincil düğme, seçili sekme, başlıklar |
| Turuncu üstü yazı | `--accent-ink` | `#160900` | birincil düğme yazısı |
| Mango sarısı | `--gold` | `#ffb21e` | ikincil vurgu |
| Yaprak yeşili | `--leaf` | `#46a83f` | olumlu: kaydedildi, başarı, canlı noktası |
| Mandalina / kırmızı | `--tangerine` / `--mango-red` | `#ff5a1f` / `#e2361b` | grafik, tanıtım, "Popüler" rozeti |
| Hata | `--danger` | `#f04e37` | hata, silme |
| Claude | `--claude` | `#d97757` | yalnızca Claude adı ve simgesinin yanında |
| Marka degradesi | `--brand-gradient` | kırmızı → mandalina → turuncu → sarı → limon | yalnızca wordmark ve tanıtım bandı |

2026-10-01: turuncu, Claude'un mercan turuncusundan (`#d97757`) ayrışsın diye doygun ve sarıya yakın `#ff7a00` oldu (kullanıcı: "Claude turuncusu olmasın, daha ayırt edici"). Pastel değil, doygun: eski "çok açık" uyarısı pastel tonlar içindi. Claude rengi yalnızca Claude'a ait öğelerde kullanılır, böylece iki turuncu yan yana karışmaz.

## Kurallar
- Turuncu ana vurgudur; bir ekranda birden çok birincil turuncu düğme olmasın.
- Degrade idareli: wordmark ve tanıtım bandı dışında kullanılmaz.
- Yeşil yalnızca olumlu durum içindir, dekoratif kullanılmaz.
- Üst menüde öne çıkan öğe (MCP) altın degradeli yazı; menü yazılarında sürekli süzülen ışık (`.shimmer-text`), hareket azaltma tercihinde kapalı.
- Yeni renk eklerken önce buradaki tokenlardan birini kullan.
