"""Uygulamayla gelen yazı tiplerini üretir: src/assets/fonts/<font>-<kalınlık>.woff

Neden: troika (3D metin motoru) tek bir font dosyası kabul ediyor. Fontsource paketleri ise
her fontu latin / latin-ext diye böler; Türkçe harfler (ğ ş İ) latin-ext'te. Bu betik iki
parçayı ve Noto Sans Symbols 2'den gerekli sembolleri (◆ ★ ✓ → …) tek dosyada birleştirir.
Böylece metin çizimi internete ihtiyaç duymaz.

Kullanım (npm install sonrası, Python + fonttools + brotli gerekir; brotli kaynak .woff2 dosyalarını okumak için):
    python scripts/build-fonts.py
Fontlar SIL Open Font License 1.1 ile lisanslıdır; lisans metinleri çıktı klasörüne kopyalanır.
"""
import shutil
from pathlib import Path

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules' / '@fontsource'
OUT = ROOT / 'src' / 'assets' / 'fonts'
TMP = OUT / '.tmp'

FAMILIES = ['inter', 'poppins', 'montserrat', 'playfair-display', 'space-grotesk', 'jetbrains-mono']
WEIGHTS = [400, 700]
# Ürün videolarında sık kullanılan sembol blokları: oklar, şekiller, çeşitli semboller, dingbat'lar.
SYMBOL_RANGES = [(0x2190, 0x21FF), (0x25A0, 0x25FF), (0x2600, 0x27BF), (0x2B00, 0x2BFF)]
# Birleştirmede çakışan ve metin çizimi için gereksiz tablolar: ipucu (hinting) tabloları ve
# sadece sembol fontunda olan dikey yazı tabloları (birleştirici her parçada aynı tabloları ister).
DROP = ['fpgm', 'prep', 'cvt ', 'gasp', 'hdmx', 'VDMX', 'LTSH', 'DSIG', 'STAT', 'vhea', 'vmtx', 'VORG']


def load_ttf(path: Path, upem: int, name: str, unicodes=None) -> Path:
    font = TTFont(str(path))
    font.flavor = None
    if unicodes is not None:
        opts = Options()
        opts.layout_features = ['*']
        opts.hinting = False
        sub = Subsetter(opts)
        sub.populate(unicodes=unicodes)
        sub.subset(font)
    for tag in DROP:
        if tag in font:
            del font[tag]
    if font['head'].unitsPerEm != upem:
        scale_upem(font, upem)
    out = TMP / f'{name}.ttf'
    font.save(str(out))
    return out


def build(family: str, weight: int):
    files = SRC / family / 'files'
    latin = files / f'{family}-latin-{weight}-normal.woff2'
    ext = files / f'{family}-latin-ext-{weight}-normal.woff2'
    symbols = SRC / 'noto-sans-symbols-2' / 'files' / 'noto-sans-symbols-2-symbols-400-normal.woff2'
    upem = TTFont(str(latin))['head'].unitsPerEm

    wanted = [cp for lo, hi in SYMBOL_RANGES for cp in range(lo, hi + 1)]
    parts = [
        load_ttf(latin, upem, f'{family}-{weight}-latin'),
        load_ttf(ext, upem, f'{family}-{weight}-ext'),
        load_ttf(symbols, upem, f'{family}-{weight}-symbols', wanted),
    ]
    merged = Merger().merge([str(p) for p in parts])
    # troika .woff2 açamıyor (sadece .ttf/.otf/.woff); .woff zlib ile sıkıştırılmış halidir.
    merged.flavor = 'woff'
    target = OUT / f'{family}-{weight}.woff'
    merged.save(str(target))
    return target


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    try:
        for family in FAMILIES:
            for weight in WEIGHTS:
                path = build(family, weight)
                print(f'{path.name:32} {path.stat().st_size // 1024} KB')
            shutil.copy(SRC / family / 'LICENSE', OUT / f'LICENSE-{family}.txt')
        shutil.copy(SRC / 'noto-sans-symbols-2' / 'LICENSE', OUT / 'LICENSE-noto-sans-symbols-2.txt')
    finally:
        shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    main()
