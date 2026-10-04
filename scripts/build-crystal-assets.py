# "Crystal" şablonunun ekran görselleri: yanardöner opal kristal ve kaya mağara (hepsi kodla çizilir).
#   python scripts/build-crystal-assets.py
# Çıktı: scripts/assets/crystal/{gem,cave}.png (ekran betiği bunları birleştirir: node scripts/build-crystal-screens.mjs)
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'scripts/assets/crystal'
rng = np.random.default_rng(7)


def noise(w, h, cell, seed):
    """Değer gürültüsü: rastgele ızgara bikübik büyütülür (0..1)."""
    r = np.random.default_rng(seed)
    gw, gh = max(2, w // cell + 3), max(2, h // cell + 3)
    small = Image.fromarray((r.random((gh, gw)) * 255).astype(np.uint8))
    big = small.resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(big, dtype=np.float32)[cell:cell + h, cell:cell + w] / 255


def fbm(w, h, base, octaves, seed, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        cell = max(2, int(base / 2 ** o))
        total += amp * noise(w, h, cell, seed + o * 31)
        norm += amp
        amp *= gain
    return total / norm


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- kristal
def gem(size=1100):
    W, H = size, int(size * 1.2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # yuvarlatılmış damla: altı geniş, üstü hafif sivri; kenar gürültüyle bozulur (çakıl taşı)
    cx, cy = W / 2, H * 0.54
    nx, ny = (xx - cx) / (W * 0.40), (yy - cy) / (H * 0.42)
    ang = np.arctan2(ny, nx)
    taper = 1 - 0.28 * np.clip(-ny, 0, 1) ** 1.6  # üst taraf daralır
    rad = np.sqrt((nx / taper) ** 2 + ny ** 2)
    wobble = 1 + 0.05 * np.sin(3 * ang + 0.7) + 0.03 * np.sin(5 * ang + 2.1)
    d = rad / wobble
    inside = smooth(1.0 - d, -0.004, 0.006)

    # yüzeyin normali (kubbe) → aydınlatma
    z = np.sqrt(np.clip(1 - np.clip(d, 0, 1) ** 2, 0, 1))
    # faset: Voronoi hücreleri, her biri biraz farklı eğim
    pts = rng.random((26, 2)) * [W, H]
    dist = np.stack([np.hypot(xx - px, yy - py) for px, py in pts])
    order = np.sort(dist, axis=0)
    cell = np.argmin(dist, axis=0)
    edge = smooth(order[1] - order[0], 0, 10)  # 0 = faset kenarı
    tilt = rng.normal(0, 0.07, (len(pts), 2))

    # yanardöner renk: iki gürültü alanından ton (camgöbeği → nane → mavi → altın → mor parçalar)
    n1 = fbm(W, H, 260, 4, 11)
    n2 = fbm(W, H, 90, 3, 23)
    hue = (n1 * 2.6 + n2 * 0.9 + tilt[cell, 0] * 0.8) % 1.0
    stops = np.array([
        [0.00, 0.35, 0.95, 0.85],
        [0.18, 0.55, 1.00, 0.70],
        [0.32, 0.20, 0.60, 1.00],
        [0.48, 0.80, 0.95, 1.00],
        [0.60, 1.00, 0.82, 0.38],
        [0.72, 0.40, 0.95, 0.55],
        [0.86, 0.75, 0.55, 1.00],
        [1.00, 0.35, 0.95, 0.85],
    ])
    col = np.stack([np.interp(hue, stops[:, 0], stops[:, i]) for i in (1, 2, 3)], -1)
    # opal pırıltısı: küçük, parlak renk lekeleri
    fleck = smooth(fbm(W, H, 60, 2, 41), 0.66, 0.80)
    fl_hue = (fbm(W, H, 120, 2, 43) * 2.5) % 1.0
    fl_col = np.stack([np.interp(fl_hue, stops[:, 0], stops[:, i]) for i in (1, 2, 3)], -1)
    col = col * (0.6 + 0.4 * n2[..., None]) * (1 - fleck[..., None] * 0.6) + fl_col * fleck[..., None] * 0.6
    # süt beyazı gövde: kenara doğru renk doygunlaşır, ortası sütlü
    milk = smooth(1 - d, 0.1, 0.9) * 0.35
    col = col * (1 - milk[..., None]) + milk[..., None] * np.array([0.85, 0.97, 0.95])

    nxl = -nx * 0.9 + tilt[cell, 0]
    nyl = -ny * 0.9 + tilt[cell, 1]
    light = np.clip(0.35 + 0.55 * (nxl * -0.45 + nyl * 0.65) + 0.35 * z, 0.12, 1.3)
    col = col * light[..., None]
    # faset kenarları ince parlak çizgi
    col = col + (1 - edge)[..., None] * 0.04 * z[..., None]
    # sol üstte yumuşak ve sert parlama
    hl = np.exp(-(((xx - W * 0.38) / (W * 0.13)) ** 2 + ((yy - H * 0.34) / (H * 0.06)) ** 2)) * 0.7 + np.exp(-(((xx - W * 0.35) / (W * 0.04)) ** 2 + ((yy - H * 0.32) / (H * 0.025)) ** 2))
    hl2 = np.exp(-(((xx - W * 0.62) / (W * 0.05)) ** 2 + ((yy - H * 0.72) / (H * 0.03)) ** 2))
    col = col + (hl * 0.9 + hl2 * 0.5)[..., None]
    # kenar ışığı (nane)
    rim = smooth(d, 0.80, 0.99) * inside
    col = col + rim[..., None] * np.array([0.10, 0.22, 0.18])

    rgb = np.clip(col, 0, 1)
    alpha = inside
    # dış hale (nane, yumuşak) ayrı katman olarak altta
    glow = Image.fromarray((np.clip(inside * 255, 0, 255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(W * 0.07))
    g = np.asarray(glow, np.float32) / 255 * 0.3
    out_a = alpha + g * (1 - alpha)
    halo_col = np.array([0.45, 1.0, 0.8])
    out_rgb = (rgb * alpha[..., None] + halo_col * (g * (1 - alpha))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
    img = np.dstack([out_rgb, out_a])
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')


# ---------------------------------------------------------------- mağara
def cave(W=2160, H=2300):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # kaya dokusu: kırışık (ridged) gürültü + ince tanecik; sol üstten ışık
    big = fbm(W, H, 700, 3, 2)
    ridge = 1 - np.abs(fbm(W, H, 260, 5, 3) * 2 - 1)
    grain = fbm(W, H, 10, 2, 5)
    height = big * 0.5 + ridge ** 2 * 0.42 + grain * 0.08
    gy, gx = np.gradient(np.asarray(Image.fromarray((height * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255)
    shade = np.clip(0.5 - (gx * -0.6 + gy * -0.8) * 90, 0, 1.5)
    base = np.array([0.24, 0.27, 0.24])
    # oyuklar koyu (ortam kapanması): kabartmanın alçak yerleri gölgede
    ao = smooth(ridge, 0.15, 0.85) * 0.7 + 0.3
    rock = base * (0.25 + 0.85 * shade[..., None]) * ao[..., None] * (0.55 + 0.6 * big[..., None])

    # şekiller: sol duvar (yukarıdan aşağı, sağ kenarı girintili), sağ duvar, kristalin oturduğu kaya basamağı
    def edge_noise(seed, amp, cell=120):
        return (fbm(W, H, cell, 4, seed) - 0.5) * amp

    left = xx < (W * 0.40 + 160 * np.sin(yy / H * 3.2 + 0.4) + edge_noise(61, 260)) * (1 - 0.15 * (yy / H))
    right = xx > W * 0.80 + 120 * np.sin(yy / H * 4 + 1.5) + edge_noise(62, 220) - 260 * smooth(yy / H, 0.55, 1.0)
    ledge_top = H * 0.72 + edge_noise(63, 120, 200) - 60 * np.cos((xx / W - 0.55) * 3)
    ledge = yy > ledge_top
    mask = (left | right | ledge).astype(np.float32)
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255

    # boşluk: siyaha yakın gece, ortada kristalden yayılan nane ışığı ve yıldızlar
    sky = np.zeros((H, W, 3), np.float32) + np.array([0.012, 0.016, 0.016])
    gem_cx, gem_cy = W * 0.56, H * 0.52
    halo = np.exp(-(((xx - gem_cx) / (W * 0.35)) ** 2 + ((yy - gem_cy) / (H * 0.30)) ** 2))
    sky += halo[..., None] * np.array([0.05, 0.16, 0.12])
    stars = rng.random((H, W)) > 0.99988
    star_img = Image.fromarray((stars * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    sky += (np.asarray(star_img, np.float32) / 255 * 0.8)[..., None]

    # kayalar kristale yakın yerde nane ışığı alır, uzakta kararır
    rock = rock * (0.18 + 1.0 * halo[..., None]) + halo[..., None] * np.array([0.02, 0.07, 0.05])
    # basamağın üst kenarı ışık yakalar
    lip = np.exp(-((yy - ledge_top) / 18) ** 2) * ledge.astype(np.float32)
    rock = rock + lip[..., None] * np.array([0.10, 0.14, 0.12])
    img = sky * (1 - mask[..., None]) + rock * mask[..., None]
    # alt kenar ekran zeminine (#06090a) karışır
    fade = smooth(yy / H, 0.86, 1.0)[..., None]
    img = img * (1 - fade) + np.array([0.024, 0.035, 0.035]) * fade
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGB')


os.makedirs(OUT, exist_ok=True)
gem().save(f'{OUT}/gem.png')
print('gem')
cave().save(f'{OUT}/cave.png')
print('cave')


# ---------------------------------------------------------------- şablon görselleri (beyaz: katman rengiyle boyanır)
def soft_glow(w=512, h=512):
    """Beyaz, kenarı saydam yumuşak ışık (Gauss); fon ışığı, yazı halesi ve duvar spotu. w≠h ise oval."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx - w / 2 + 0.5) / (w / 2), (yy - h / 2 + 0.5) / (h / 2))
    a = np.exp(-(r / 0.5) ** 2 * 2.2) * smooth(1 - r, 0, 0.12)
    img = np.dstack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def phone_shadow(w=340, h=700, pad=160):
    """Telefonun duvara düşen gölgesi: yuvarlak köşeli dikdörtgen, bulanık kenar (beyaz; koyu renge boyanır)."""
    W, H = w + 2 * pad, h + 2 * pad
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle((pad, pad, pad + w, pad + h), radius=int(w * 0.16), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(pad * 0.35))
    white = Image.new('L', (W, H), 255)
    return Image.merge('RGBA', (white, white, white, m))


PUB = 'public/templates/crystal'
os.makedirs(PUB, exist_ok=True)
soft_glow().save(f'{PUB}/glow.png')
# kapanış fonu: referansın radyal profili (yatay yarıçap 1390 px, dikey 2320 px)
soft_glow(600, 1000).save(f'{PUB}/glow-oval.png')
# yazı halesi: yazı boyunca yatay yumuşak bant (referansta ~1500×450 px)
soft_glow(1000, 300).save(f'{PUB}/glow-wide.png')
phone_shadow().save(f'{PUB}/shadow.png')
print('glow, shadow')
