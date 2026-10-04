# "Meadow phone" şablonunun doğa görselleri: bulutlar, uzak çayır, çimen öbekleri ve çiçekler.
#   python scripts/build-meadow-assets.py
# Tamamen kodla çizilir (numpy + Pillow + OpenCV), dış görsel kullanılmaz. Çıktı public/templates/meadow.
# Sallanan öğelerde (çiçek, çimen öbeği) sapın dibi görselin tam ortasındadır: görsel katmanı merkezinden
# döndüğü için `sway` bloğu çiçeği dibinden sallar. Yakındaki öğelerin alan derinliği bulanıklığı görsele
# işlenir (sahnede DOF kullanılmaz: saydam düzlemler derinliğe yazdığı için arkadaki telefonu da bulandırıyordu).
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = 'public/templates/meadow'
os.makedirs(OUT, exist_ok=True)


def fbm(h, w, rng, octaves=5, base=6):
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        small = rng.standard_normal((max(2, int(n * h / w)), n)).astype(np.float32)
        out += amp * cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
        total += amp
        amp *= 0.5
    return out / total


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def premul_blur(rgba, sigma):
    """Saydam kenarda koyu hale oluşmasın diye önceden çarpılmış alfayla bulanıklaştırır."""
    if sigma <= 0:
        return rgba
    a = rgba[..., 3:4].astype(np.float32) / 255
    rgb = rgba[..., :3].astype(np.float32) * a
    k = int(sigma * 3) * 2 + 1
    rgb = cv2.GaussianBlur(rgb, (k, k), sigma)
    a2 = cv2.GaussianBlur(a[..., 0], (k, k), sigma)[..., None]
    rgb = np.where(a2 > 1e-4, rgb / np.maximum(a2, 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 255), a2 * 255], -1).astype(np.uint8)


def save(name, rgba):
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)
    print(name, rgba.shape[1], 'x', rgba.shape[0])


# ---------------------------------------------------------------- bulutlar
def cloud(seed, w=1600, h=900, width=0.8, height=0.55):
    """Kümülüs: düz tabana oturan küre yığını (büyükler altta, küçükler kenarlarda) → yükseklik haritası,
    normalden güneş ışığı (sol üst), küreler arası girintilerde gölge, fbm ile kabarık doku."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    acc = np.zeros((h, w), np.float64)
    K = 40.0  # yumuşak birleşim (smooth max): küreler arasında dikiş çizgisi kalmasın
    base_y = h * 0.8
    spheres = []

    def add(cx, cy, r):
        nonlocal acc
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        z = (np.sqrt(np.maximum(r * r - d2, 0)) - np.where(d2 > r * r, np.sqrt(d2) - r, 0) * 3) / w * 4
        acc += np.exp(K * np.clip(z, -1, 1))
        spheres.append((cx, cy, r))

    half = w * width / 2
    # alt sıra: tabana oturan orta boy küreler
    x = w / 2 - half
    while x < w / 2 + half:
        u = (x - w / 2) / half
        r = w * rng.uniform(0.07, 0.1) * (1.1 - 0.5 * u * u)
        add(x, base_y - r * 0.55, r)
        x += r * rng.uniform(0.9, 1.3)
    # üst katlar: ortada yükselen kubbe
    for layer in range(1, 4):
        n = int(7 - layer * 1.5)
        for i in range(n):
            u = rng.uniform(-1, 1) * (1 - layer * 0.22)
            r = w * rng.uniform(0.07, 0.11) * (1.1 - 0.25 * layer)
            add(w / 2 + u * half * 0.85, base_y - r * 0.55 - min(h * height * layer / 3 * (1 - 0.6 * u * u), r * 1.1 * layer), r)
    # kenarlara küçük kabarcıklar
    for _ in range(40):
        cx, cy, r = spheres[rng.integers(len(spheres))]
        a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        rr = r * rng.uniform(0.25, 0.45)
        px, py = cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r * 0.9
        if py < base_y - rr * 0.3:
            add(px, py, rr)
    H = (np.log(acc + 1e-30) / K).astype(np.float32)
    H += 0.03 * fbm(h, w, rng, 6, 10)
    H[yy > base_y] -= (yy[yy > base_y] - base_y) / h * 2  # düz taban
    n_lab, lab, stats, _ = cv2.connectedComponentsWithStats((H > 0).astype(np.uint8))
    keep = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    H = np.where(lab == keep, H, np.minimum(H, -0.01))
    alpha = smoothstep(-0.005, 0.03, H) * (0.9 + 0.1 * smoothstep(0.03, 0.12, H))
    Hs = cv2.GaussianBlur(np.maximum(H, 0), (0, 0), 2)
    gy, gx = np.gradient(Hs * w / 4)
    n = np.dstack([-gx, -gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array([-0.45, -0.7, 0.55], np.float32)
    L /= np.linalg.norm(L)
    diffuse = np.clip((n * L).sum(2), 0, 1)
    # girinti gölgesi: çevresinden alçakta kalan yerler koyu
    cav = np.clip((cv2.GaussianBlur(Hs, (0, 0), 25) - Hs) * 18, 0, 1)
    under = smoothstep(base_y - h * 0.3, base_y, yy)
    light = np.clip(0.35 + 0.75 * diffuse - 0.35 * cav - 0.25 * under, 0, 1)
    shadow = np.array([150, 170, 200], np.float32)
    white = np.array([255, 255, 255], np.float32)
    rgb = shadow + (white - shadow) * light[..., None] ** 0.8
    rgba = np.concatenate([rgb, alpha[..., None] * 255], -1).astype(np.uint8)
    rgba = premul_blur(rgba, 1.2)
    ys, xs = np.nonzero(rgba[..., 3] > 3)
    pad = 12
    return rgba[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]


# ---------------------------------------------------------------- çimen
GREENS_DARK = np.array([[34, 92, 22], [46, 110, 28], [28, 80, 30], [56, 118, 24]], np.float32)
GREENS_TIP = np.array([[150, 205, 70], [120, 190, 60], [175, 214, 88], [104, 178, 58]], np.float32)


def blade(draw, rng, x0, y0, height, width, lean, shade=1.0, haze=0.0, seg=10):
    """Kıvrık, uca doğru incelen tek çimen yaprağı; dipte koyu, uçta açık yeşil."""
    dark = GREENS_DARK[rng.integers(len(GREENS_DARK))] * shade
    tip = GREENS_TIP[rng.integers(len(GREENS_TIP))] * (0.85 + 0.25 * rng.random()) * shade
    sky = np.array([190, 215, 235], np.float32)
    pts = []
    for i in range(seg + 1):
        t = i / seg
        x = x0 + lean * height * t * t
        y = y0 - height * t + abs(lean) * height * 0.35 * t ** 3
        pts.append((x, y, width * (1 - t) ** 0.9 + 0.4))
    for i in range(seg):
        (xa, ya, wa), (xb, yb, wb) = pts[i], pts[i + 1]
        dx, dy = xb - xa, yb - ya
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        t = (i + 0.5) / seg
        c = dark + (tip - dark) * t ** 0.8
        c = c + (sky - c) * haze
        draw.polygon([(xa + nx * wa, ya + ny * wa), (xb + nx * wb, yb + ny * wb), (xb - nx * wb, yb - ny * wb), (xa - nx * wa, ya - ny * wa)], fill=tuple(int(v) for v in np.clip(c, 0, 255)) + (255,))


def meadow_far(seed, w=2400, h=1500):
    """Uzak çayır: ufuk çizgisinden aşağı sık, puslu kısa çimen ve küçük çiçek noktaları. Ufuk üst kenardan 60 px aşağıda."""
    rng = np.random.default_rng(seed)
    ss = 2
    img = Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top = 60 * ss
    # zemin: aşağı doğru koyulaşan yeşil
    for y in range(top + 30 * ss, h * ss):
        t = (y - top) / (h * ss - top)
        c = np.array([96, 150, 70]) * (1 - t) + np.array([40, 100, 30]) * t
        d.line([(0, y), (w * ss, y)], fill=tuple(int(v) for v in c) + (255,))
    rows = 70
    for r in range(rows):
        t = r / (rows - 1)
        y = top + (t ** 1.6) * (h * ss - top) * 1.05
        scale = 0.25 + 1.6 * t ** 1.4
        haze = 0.45 * (1 - t) ** 2
        for _ in range(int(900 * (1 - 0.5 * t))):
            x = rng.uniform(-40, w * ss + 40)
            blade(d, rng, x, y + rng.uniform(-6, 6) * scale, rng.uniform(14, 34) * scale * ss, rng.uniform(1.2, 2.2) * scale * ss, rng.uniform(-0.35, 0.35), 0.9 + 0.2 * t, haze, seg=5)
        # küçük çiçek noktaları (papatya, karahindiba)
        for _ in range(int(30 * t + 4)):
            x = rng.uniform(0, w * ss)
            cy = y - rng.uniform(8, 30) * scale * ss
            rr = rng.uniform(1.6, 3.2) * scale * ss
            col = (255, 255, 250) if rng.random() < 0.6 else (250, 206, 40)
            col = tuple(int(c + (v - c) * haze) for c, v in zip(col, (190, 215, 235)))
            d.ellipse([x - rr, cy - rr * 0.6, x + rr, cy + rr * 0.6], fill=col + (255,))
    img = img.resize((w, h), Image.LANCZOS)
    a = np.array(img).astype(np.float32)
    # sıra sıra desen görünmesin: geniş açık/koyu çayır lekeleri (bulut gölgesi, farklı otlar)
    patches = fbm(h, w, rng, 4, 3)
    a[..., :3] *= (1 + 0.16 * patches)[..., None]
    return premul_blur(np.clip(a, 0, 255).astype(np.uint8), 1.6)


def grass_clump(seed, w=1400, height=900, blades=700, shade=1.0, blur=0.0, flowers=0):
    """Çimen öbeği: dipler görselin dikey ortasında (sway pivotu), yapraklar yukarı yelpaze gibi açılır."""
    rng = np.random.default_rng(seed)
    ss = 2
    H = height * 2 + 40
    img = Image.new('RGBA', (w * ss, H * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = H * ss / 2
    for i in range(blades):
        u = rng.normal(0, 0.24)
        x = (w * ss) * (0.5 + u)
        if x < 30 or x > w * ss - 30:
            continue
        center = 1 - min(1, abs(u) * 2.6)
        hgt = height * ss * rng.uniform(0.3, 1.0) * (0.45 + 0.55 * center)
        lean = rng.normal(u * 0.9, 0.22)
        blade(d, rng, x, base + rng.uniform(0, 30) * ss, hgt, rng.uniform(4, 9) * ss, lean, shade * rng.uniform(0.8, 1.1))
    for _ in range(flowers):
        x = w * ss * (0.5 + rng.normal(0, 0.16))
        y = base - height * ss * rng.uniform(0.25, 0.6)
        stem_top = y
        d.line([(x, base), (x + rng.normal(0, 10), stem_top)], fill=(58, 120, 34, 255), width=int(5 * ss))
        daisy_head(d, x, stem_top, rng.uniform(22, 34) * ss, rng)
    img = img.resize((w, H), Image.LANCZOS)
    return premul_blur(np.array(img), blur)


def grass_band(seed, w=2600, h=900, blur=0.0):
    """Ön plan tabanı: alt kenarı tamamen dolu, üstü düzensiz çimen uçları (klibin altını kapatır)."""
    rng = np.random.default_rng(seed)
    ss = 2
    img = Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * ss * 0.72, w * ss, h * ss], fill=(30, 82, 22, 255))
    for r in range(18):
        t = r / 17
        y = h * ss * (0.55 + 0.5 * t)
        for _ in range(260):
            x = rng.uniform(-40, w * ss + 40)
            blade(d, rng, x, y, h * ss * rng.uniform(0.2, 0.55) * (1 - 0.3 * t), rng.uniform(6, 13) * ss, rng.uniform(-0.5, 0.5), 0.75 + 0.35 * t)
    img = img.resize((w, h), Image.LANCZOS)
    return premul_blur(np.array(img), blur)


# ---------------------------------------------------------------- çiçekler
def daisy_head(d, cx, cy, r, rng, tilt=0.62, petals=22):
    for layer in range(2):
        for i in range(petals):
            a = 2 * math.pi * (i + layer * 0.5) / petals + rng.normal(0, 0.05)
            L = r * rng.uniform(0.85, 1.05)
            wd = r * 0.17
            pts = []
            for s in range(13):
                t = s / 12
                along = L * (0.18 + 0.82 * t)
                side = wd * math.sin(math.pi * min(1, t * 1.05)) ** 0.7
                for sign in (1,):
                    pts.append((along, side))
            poly = pts + [(p[0], -p[1]) for p in reversed(pts)]
            ca, sa = math.cos(a), math.sin(a)
            shade = 238 + int(17 * rng.random()) - layer * 12
            # güneşten uzak (alt) yapraklar hafif gri-mavi
            if math.sin(a) > 0.3:
                shade -= 18
            col = (shade, shade, min(255, shade + 4), 255)
            d.polygon([(cx + x * ca - y * sa, cy + (x * sa + y * ca) * tilt) for x, y in poly], fill=col)
    # göbek: turuncu-sarı disk, üstte parlak
    rr = r * 0.3
    for k in range(10, 0, -1):
        t = k / 10
        c = (int(232 - 40 * t), int(170 - 60 * t), int(20 + 10 * t), 255)
        d.ellipse([cx - rr * t, cy - rr * t * tilt - (1 - t) * rr * 0.15, cx + rr * t, cy + rr * t * tilt - (1 - t) * rr * 0.15], fill=c)
    for _ in range(int(r)):
        a, q = rng.uniform(0, 2 * math.pi), rng.uniform(0, 0.9) ** 0.5
        x, y = cx + math.cos(a) * rr * q, cy + math.sin(a) * rr * q * tilt
        d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(255, 214, 64, 255))


def dandelion_head(d, cx, cy, r, rng, tilt=0.7):
    for ring in range(5, 0, -1):
        k = ring / 5
        n = int(26 + 20 * k)
        for i in range(n):
            a = 2 * math.pi * i / n + rng.normal(0, 0.08) + ring
            L = r * k * rng.uniform(0.85, 1.0)
            wd = r * 0.06 * (0.6 + k)
            ca, sa = math.cos(a), math.sin(a)
            poly = [(0, 0), (L * 0.5, wd), (L, wd * 0.6), (L * 1.02, 0), (L, -wd * 0.6), (L * 0.5, -wd)]
            g = 196 + int(40 * k) - (20 if sa > 0.3 else 0)
            col = (255, g, int(10 + 30 * (1 - k)), 255) if ring > 1 else (238, 160, 8, 255)
            d.polygon([(cx + x * ca - y * sa, cy + (x * sa + y * ca) * tilt) for x, y in poly], fill=col)


def pink_head(d, cx, cy, r, rng, tilt=0.65, petals=8):
    for i in range(petals):
        a = 2 * math.pi * i / petals + rng.normal(0, 0.06)
        ca, sa = math.cos(a), math.sin(a)
        L, wd = r, r * 0.34
        poly = [(L * t, wd * math.sin(math.pi * t) ** 0.6) for t in np.linspace(0.1, 1, 12)]
        poly = poly + [(x, -y) for x, y in reversed(poly)]
        col = (236, 120, 178, 255) if sa < 0.3 else (214, 98, 160, 255)
        d.polygon([(cx + x * ca - y * sa, cy + (x * sa + y * ca) * tilt) for x, y in poly], fill=col)
    rr = r * 0.2
    d.ellipse([cx - rr, cy - rr * tilt, cx + rr, cy + rr * tilt], fill=(250, 208, 60, 255))


def flower(kind, seed, stem=520, head=150, blur=0.0, bend=0.12):
    """Saplı tek çiçek; sapın dibi görselin tam ortasında."""
    rng = np.random.default_rng(seed)
    ss = 2
    w = int(head * 2.6)
    H = int((stem + head) * 2)
    img = Image.new('RGBA', (w * ss, H * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bx, by = w * ss / 2, H * ss / 2
    tx, ty = bx + bend * stem * ss, by - stem * ss
    # sap: hafif kavisli, dipte kalın
    pts = [(bx + (tx - bx) * t * t, by + (ty - by) * t) for t in np.linspace(0, 1, 30)]
    for i in range(len(pts) - 1):
        wd = int((7 - 3 * i / len(pts)) * ss * head / 150)
        d.line([pts[i], pts[i + 1]], fill=(60, 128, 38, 255), width=max(2, wd))
    r = head * ss / 2
    if kind == 'daisy':
        daisy_head(d, tx, ty, r, rng)
    elif kind == 'dandelion':
        dandelion_head(d, tx, ty, r * 0.8, rng)
    else:
        pink_head(d, tx, ty, r * 0.75, rng)
    img = img.resize((w, H), Image.LANCZOS)
    return premul_blur(np.array(img), blur)


if __name__ == '__main__':
    import sys
    only = sys.argv[1:]
    for i, (seed, width, height) in enumerate([(3, 0.8, 0.55), (11, 0.6, 0.45), (21, 0.85, 0.7), (5, 0.5, 0.3)], 1):
        save(f'cloud-{i}', cloud(seed, width=width, height=height))
    save('meadow-far', meadow_far(7))
    save('grass-back', grass_clump(31, w=1200, height=520, blades=600, shade=0.9))
    save('grass-front-1', grass_clump(41, w=1300, height=760, blades=520, blur=1.5, flowers=2))
    save('grass-front-2', grass_clump(43, w=1100, height=880, blades=420, blur=1.5, flowers=1))
    save('grass-band', grass_band(51, blur=3))
    save('daisy', flower('daisy', 61))
    save('daisy-2', flower('daisy', 62, stem=440, head=140, bend=-0.1))
    save('daisy-near', flower('daisy', 63, stem=600, head=220, blur=9, bend=-0.08))
    save('dandelion', flower('dandelion', 71, stem=480, head=130))
    save('dandelion-near', flower('dandelion', 72, stem=560, head=190, blur=7, bend=0.1))
    save('pink', flower('pink', 81, stem=380, head=110, bend=0.06))
