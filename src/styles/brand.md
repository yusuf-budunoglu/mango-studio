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
| Zemin | `--bg` | `#0A0A0B` | sayfa, önizleme dışı |
| Panel | `--panel` / `--panel-2` | `#111113` / `#18181B` | yan paneller, kartlar |
| Çizgi | `--line` | `#28262A` | ayraçlar, kenarlar |
| Yazı | `--ink` / `--muted` | `#F4EFE7` / `#9C968C` | sıcak beyaz / ikincil |
| Mango turuncusu | `--accent` | `#d9711c` | ana vurgu: birincil düğme, seçili sekme, oynatma kafası |
| Turuncu üstü yazı | `--accent-ink` | `#140b03` | birincil düğme yazısı |
| Altın sarısı | `--gold` | `#c99324` | ikincil vurgu: odak, varsayılan yıldızı, bekleyen durum |
| Yaprak yeşili | `--leaf` | `#3f8c3c` | olumlu: kaydedildi, başarı |
| Mandalina / kırmızı | `--tangerine` / `--mango-red` | `#c4501e` / `#a3301b` | grafik, tanıtım |
| Hata | `--danger` | `#d84f3a` | hata, silme |
| Marka degradesi | `--brand-gradient` | kırmızı → mandalina → turuncu → sarı → limon | yalnızca wordmark ve tanıtım bandı |

Palet logodaki bantların koyulaştırılmış hali (2026-09-27: ilk açık tonlar fazla parlak bulundu). Degrade durakları: kırmızı `#a3301b`, mandalina `#c4501e`, turuncu `#d27a1e`, sarı `#c2a02c`, limon `#6d8a2c`. Yazı olarak kullanılan vurgular siyah zeminde en az 4.5:1 kontrast verir (turuncu 6.0, altın 7.2, yeşil 4.7, hata 4.8).

## Kurallar
- Turuncu ana vurgudur; bir ekranda birden çok birincil turuncu düğme olmasın.
- Degrade idareli: wordmark ve tanıtım bandı dışında kullanılmaz.
- Yeşil yalnızca olumlu durum içindir, dekoratif kullanılmaz.
- Üst menüde öne çıkan öğe (MCP) altın degradeli yazı; menü yazılarında sürekli süzülen ışık (`.shimmer-text`), hareket azaltma tercihinde kapalı.
- Yeni renk eklerken önce buradaki tokenlardan birini kullan.
