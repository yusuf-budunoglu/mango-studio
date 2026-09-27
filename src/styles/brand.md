# Mango Studio — marka kimliği

## Ad
**Mango Studio**. Wordmark büyük harf ve geniş aralıklı: `MANGO` sıcak beyaz (kalın), `STUDIO` marka degradesi (ince). Yazı tipi Sora (`Mango Display`, src/assets/fonts/sora-*.woff).

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
| Mango turuncusu | `--accent` | `#F0922B` | ana vurgu: birincil düğme, seçili sekme, oynatma kafası |
| Turuncu üstü yazı | `--accent-ink` | `#1C1206` | birincil düğme yazısı |
| Altın sarısı | `--gold` | `#E8B63C` | ikincil vurgu: odak, varsayılan yıldızı, bekleyen durum |
| Yaprak yeşili | `--leaf` | `#5AA151` | olumlu: kaydedildi, başarı |
| Mandalina / kırmızı | `--tangerine` / `--mango-red` / `--danger` | `#E9642E` / `#CD3D24` / `#E0513A` | hata, silme |
| Marka degradesi | `--brand-gradient` | kırmızı → mandalina → turuncu → sarı → limon | yalnızca wordmark ve tanıtım bandı |

Logodan ölçülen kaynak renkler: kırmızı `#CD3D24`, mandalina `#E9642E`, turuncu `#EC9A31`, sarı `#D6C444`, limon `#99AA3D`, yaprak `#56964A`.

## Kurallar
- Turuncu ana vurgudur; bir ekranda birden çok birincil turuncu düğme olmasın.
- Degrade idareli: wordmark ve tanıtım bandı dışında kullanılmaz.
- Yeşil yalnızca olumlu durum içindir, dekoratif kullanılmaz.
- Yeni renk eklerken önce buradaki tokenlardan birini kullan.
