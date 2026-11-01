# gift-ideas ses efektleri: dört grup (hava, arayüz, vuruş, ton), stereo 44.1 kHz WAV.
# Olay zamanları referans karesi (30 kare/sn) → saniye; şablonun F(n) zamanlamasıyla aynı.
#   python make_gift_sfx.py <çıktı klasörü>
import sys, wave, os
import numpy as np

SR = 44100
END = 214 / 30
N = int(END * SR) + 1
rng = np.random.default_rng(7)
F = lambda n: n / 30


def stem():
    return np.zeros((2, N), np.float32)


def place(buf, sig, t, gain=1.0, pan=0.0):
    """mono sinyali t saniyesine yerleştirir (pan -1 sol, +1 sağ; eşit güç)"""
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    a = (pan + 1) * np.pi / 4
    buf[0, i:i + len(sig)] += sig * gain * np.cos(a)
    buf[1, i:i + len(sig)] += sig * gain * np.sin(a)


def env_ad(n, attack, decay_tau):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(0, t - attack) / decay_tau)


def shaped_noise(dur, center, bw, amp):
    """zamanla değişen bant geçiren gürültü: center/bw/amp ilerleme (0–1) → değer işlevleri"""
    n = int(dur * SR)
    blk, hop = 2048, 512
    out = np.zeros(n + blk)
    win = np.hanning(blk)
    freqs = np.fft.rfftfreq(blk, 1 / SR)
    for s in range(0, n, hop):
        p = s / n
        spec = np.fft.rfft(rng.standard_normal(blk) * win)
        c, w = center(p), bw(p)
        spec *= np.exp(-0.5 * ((np.log2(np.maximum(freqs, 1)) - np.log2(c)) / w) ** 2)
        out[s:s + blk] += np.fft.irfft(spec) * win * amp(p)
    out = out[:n]
    return out / (np.abs(out).max() + 1e-9)


def reverb(x, seconds=1.2, mix=0.3):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (seconds / 5))
    ir[0] = 0
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, 2 * L) * np.fft.rfft(ir, 2 * L))[: len(x)]
    return x * (1 - mix) + wet * mix * 3


def bell(freq, dur, decay=0.5, bright=0.25):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * freq * t) + bright * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t / (decay * 0.4)) + 0.12 * np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t / (decay * 0.2))
    return s * env_ad(len(t), 0.004, decay)


# ---------------- hava (whoosh, rüzgâr)
air = stem()
# tuşlar telefonun arkasından çıkarken kısa, yumuşak savrulmalar (15–23)
for i in range(18):
    at = 15 + (i * 5) % 9
    d = 0.32
    w = shaped_noise(d, lambda p: 900 + 2600 * p, lambda p: 0.7, lambda p: np.sin(np.pi * p) ** 2)
    place(air, w, F(at) + rng.uniform(0, 0.03), 0.10, rng.uniform(-0.8, 0.8))
# dalış: 58–74 yükselen hava, 74'te en üstte (beyaz parlama)
d = F(75) - F(56)
w = shaped_noise(d, lambda p: 300 * (20 ** p), lambda p: 1.1 - 0.5 * p, lambda p: p ** 2.2)
place(air, w, F(56), 0.55, -0.15)
# tünel: geçişten sonra hızla geçen rüzgâr (77–105), sonra hafif uğultu
d = F(150) - F(76)
w = shaped_noise(d, lambda p: 2200 * (0.25 ** min(1, p * 2.5)) + 250, lambda p: 1.4, lambda p: (1 - p) ** 1.5 * 0.85 + 0.15)
place(air, w, F(76), 0.45)
# kartlar kenarlardan geçerken kısa geçişler (sol/sağ)
for k, f in enumerate([80, 84, 89, 95, 102, 110, 119, 129, 140]):
    w = shaped_noise(0.22, lambda p: 3000 - 1800 * p, lambda p: 0.6, lambda p: np.sin(np.pi * p) ** 3)
    place(air, w, F(f), 0.09, -0.85 if k % 2 else 0.85)
# kapanış: 140–151 yükselen hava → logoya
d = F(152) - F(138)
w = shaped_noise(d, lambda p: 500 * (10 ** p), lambda p: 0.9, lambda p: p ** 2.5)
place(air, w, F(138), 0.4)

# ---------------- arayüz (tık, pop)
ui = stem()


def tick(freq):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    click = rng.standard_normal(n) * np.exp(-t / 0.003)
    tone = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.012)
    return 0.35 * click + tone


def pop(freq):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.8 * np.exp(-t / 0.01))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.002, 0.035)


# "hey Mango...": her harf yumuşak bir tuş sesi
for j, f in enumerate([18, 22, 25, 27, 31, 34, 37, 39, 42, 43, 44]):
    place(ui, tick(2300 + 140 * (j % 4)), F(f), 0.32, (j / 10 - 0.5) * 0.6)
# tuşlar yerine oturunca hafif poplar
for i in range(18):
    at = 15 + (i * 5) % 9 + 7
    place(ui, pop(rng.uniform(600, 1100)), F(at) + rng.uniform(0, 0.02), 0.10, rng.uniform(-0.7, 0.7))
# giriş hapı: kelime kelime (99, 105, 110), mikrofon kaybolurken küçük pop (95)
place(ui, pop(1400), F(95), 0.22)
for f in (99, 105, 110):
    place(ui, pop(900), F(f), 0.21)
    place(ui, tick(2600), F(f), 0.17)
# kapanış yazıları: "Mango Studio" (157–170) ve alan adı (173–192) daktilo tıkları
for f in np.linspace(157, 169, 11):
    place(ui, tick(2800), F(f), 0.2, 0.1)
for f in np.linspace(173, 184, 11):
    place(ui, tick(3100), F(f), 0.14)
for f in np.linspace(185, 191, 7):
    place(ui, tick(3300), F(f), 0.14)

# ---------------- vuruş (bas, darbe)
hit = stem()


def boom(f0, f1, dur, click=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.08)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.003, dur / 3.5)
    s += click * rng.standard_normal(n) * np.exp(-t / 0.004)
    return s


# 15: ışık yanarken alt bas girişi
place(hit, boom(90, 44, 1.1), F(15), 0.9)
# 77: tünele giriş darbesi (beyazdan çıkış)
place(hit, boom(110, 48, 0.9, 0.5), F(77), 0.85)
w = shaped_noise(0.6, lambda p: 4000, lambda p: 1.6, lambda p: np.exp(-p * 6))
place(hit, w, F(77), 0.25)
# 100: sahne yuvarlanmaya başlarken yumuşak vuruş
place(hit, boom(75, 45, 0.7, 0.1), F(100), 0.45)
# 153: logo
place(hit, boom(100, 46, 1.2, 0.35), F(153), 0.8)

# ---------------- ton (çan, ped, parıltı)
tone = stem()
# 15: asistan açılış sesi gibi yükselen iki nota (G5 → D6)
for k, (f, dt) in enumerate([(784, 0.0), (1175, 0.09)]):
    place(tone, reverb(np.concatenate([bell(f, 1.2, 0.45), np.zeros(SR)]), 1.4, 0.35), F(15) + dt, 0.28, (-0.3, 0.3)[k])
# ped: sahne 1'de G majör (G3 D4 B4), tünelde C add9 (C4 G4 D5 E5); yavaş açılıp kapanır


def pad(freqs, dur, fade_in, fade_out):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (1 + 0.3 * np.sin(2 * np.pi * 0.7 * t + i)) for i, f in enumerate(freqs))
    e = np.minimum(1, t / fade_in) * np.minimum(1, (dur - t) / fade_out)
    return s / len(freqs) * np.clip(e, 0, 1)


place(tone, pad([196, 293.7, 392, 493.9], F(76) - F(15), 0.6, 0.25), F(15), 0.34)
place(tone, pad([261.6, 392, 587.3, 659.3], F(150) - F(77), 0.15, 0.4), F(77), 0.3)
# tünelde parıltılar: rastgele yüksek çan sesleri, solda sağda
for _ in range(26):
    t0 = rng.uniform(F(78), F(146))
    f = rng.choice([1568, 1760, 2093, 2349, 2637, 3136])
    place(tone, bell(f, 0.5, 0.18, 0.1), t0, rng.uniform(0.03, 0.07), rng.uniform(-0.9, 0.9))
# "ideas..." tamamlanınca küçük çan (112)
place(tone, reverb(np.concatenate([bell(1318.5, 1.0, 0.4), np.zeros(SR // 2)]), 1.0, 0.3), F(112), 0.16)
# logo: C majör çan akoru (C5 E5 G5 C6), hafif arpej
for k, f in enumerate([523.3, 659.3, 784, 1046.5]):
    place(tone, reverb(np.concatenate([bell(f, 2.0, 0.9), np.zeros(SR)]), 1.8, 0.35), F(153) + k * 0.035, 0.2, (k - 1.5) * 0.3)

# ---------------- yaz: her grup -1 dBFS tepe altında, gruplar arası denge yukarıdaki kazançlarla
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
mix = sum([air, ui, hit, tone])
peak = np.abs(mix).max()
scale = 0.89 / peak  # karışım -1 dBFS
for name, buf in (('air', air), ('ui', ui), ('hit', hit), ('tone', tone)):
    b = buf * scale
    # yumuşak bitiş
    b[:, -int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    data = (np.clip(b.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(out, f'{name}.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print(name, f'peak {20*np.log10(np.abs(b).max()+1e-9):.1f} dBFS')
data = (np.clip((mix * scale).T, -1, 1) * 32767).astype(np.int16)
with wave.open(os.path.join(out, 'mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('süre', N / SR)
