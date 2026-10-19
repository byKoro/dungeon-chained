"""
gen_sfx.py — gera os efeitos sonoros procedurais do jogo (WAV 16-bit).

Tudo é sintetizado aqui (numpy), exceto o golpe da serra, que RETRABALHA o
`assets/audio/hit_sound.mp3` já existente (decodificado com `miniaudio`).
Seeds fixas: rodar de novo produz exatamente os mesmos arquivos.

Uso:
    python tools/gen_sfx.py            # gera todos em assets/audio/
    python tools/gen_sfx.py saw_hit    # gera só um grupo (ver GROUPS no fim)

Dependências (só para esta ferramenta, não para o jogo):
    numpy, miniaudio==1.61 (decodificar o MP3 do golpe)

Boas práticas de game feel aplicadas na síntese:
  - ataque IMEDIATO: nenhum one-shot começa com silêncio (o som tem que sair
    no mesmo quadro do impacto, senão o golpe parece "atrasado");
  - camadas: transiente (clique) + corpo (tom/ruído) + cauda (reverb), cada
    uma com sua função;
  - variações (01, 02, 03...) para o AudioManager sortear e não soar robótico;
  - headroom: pico normalizado em -1 dBFS (one-shots) e -6 dBFS (ambiente);
  - fade-out curto no fim para não estalar;
  - ambiente PERIÓDICO (filtros e reverb circulares): o loop não tem emenda.
"""
from __future__ import annotations

import os
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "audio")
HIT_SOURCE = os.path.join(OUT_DIR, "hit_sound.mp3")

SR = 44100          # one-shots
SR_AMB = 22050      # ambiente (conteúdo grave/médio; arquivo menor)


# --------------------------------------------------------------------------
# Utilitários de DSP
# --------------------------------------------------------------------------
def n_of(dur: float, sr: int = SR) -> int:
    return max(1, int(round(dur * sr)))


def time_axis(n: int, sr: int = SR) -> np.ndarray:
    return np.arange(n) / sr


def db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def env_exp(n: int, decay_s: float, sr: int = SR, attack_s: float = 0.0005) -> np.ndarray:
    """Envelope percussivo: ataque linear curtíssimo + decaimento exponencial."""
    t = time_axis(n, sr)
    env = np.exp(-t / max(decay_s, 1e-5))
    a = max(1, int(attack_s * sr))
    env[:a] *= np.linspace(0.0, 1.0, a)
    return env


def place(dst: np.ndarray, src: np.ndarray, start_s: float, sr: int = SR, gain: float = 1.0) -> None:
    """Soma `src` em `dst` a partir de `start_s` (corta o que passar do fim)."""
    i = int(round(start_s * sr))
    if i >= len(dst):
        return
    m = min(len(src), len(dst) - i)
    dst[i:i + m] += src[:m] * gain


def fft_band(x: np.ndarray, lo: float, hi: float, sr: int = SR, soft: float = 0.25) -> np.ndarray:
    """Passa-faixa no domínio da frequência com bordas suaves (circular)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    mask = np.ones_like(f)
    if lo > 0:
        w = max(lo * soft, 1.0)
        mask *= np.clip((f - (lo - w)) / w, 0.0, 1.0)
    if hi < sr / 2:
        w = max(hi * soft, 1.0)
        mask *= np.clip(((hi + w) - f) / w, 0.0, 1.0)
    return np.fft.irfft(spec * mask, n=len(x))


def svf(x: np.ndarray, fc, q: float = 0.7, sr: int = SR, mode: str = "bp") -> np.ndarray:
    """Filtro de estado variável TPT (Zavalishin), com cutoff variável no tempo."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 10.0, sr * 0.45) / sr)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    out = np.empty_like(x)
    ic1 = ic2 = 0.0
    for i in range(len(x)):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + a2[i] * v3
        v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == "lp":
            out[i] = v2
        elif mode == "hp":
            out[i] = x[i] - k * v1 - v2
        else:
            out[i] = v1
    return out


def onepole_lp(x: np.ndarray, fc: float, sr: int = SR) -> np.ndarray:
    a = np.exp(-2.0 * np.pi * fc / sr)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1.0 - a) * x[i] + a * s
        y[i] = s
    return y


def sweep_sine(n: int, f0: float, f1: float, sr: int = SR, curve: str = "exp") -> np.ndarray:
    """Seno com frequência varrendo f0 -> f1 (exponencial soa mais natural)."""
    u = np.linspace(0.0, 1.0, n)
    f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
    return np.sin(2.0 * np.pi * np.cumsum(f) / sr)


def partials(n: int, base: float, ratios, amps, decays, sr: int = SR, rng=None) -> np.ndarray:
    """Soma de parciais inarmônicas (metal/sino) com decaimentos próprios."""
    t = time_axis(n, sr)
    out = np.zeros(n)
    for r, a, d in zip(ratios, amps, decays):
        ph = rng.uniform(0, 2 * np.pi) if rng is not None else 0.0
        out += a * np.sin(2 * np.pi * base * r * t + ph) * np.exp(-t / d)
    return out


def click(n_ms: float, lo: float, hi: float, rng, sr: int = SR) -> np.ndarray:
    """Transiente curto de ruído filtrado (elo de corrente, estalo)."""
    n = n_of(n_ms / 1000.0, sr)
    x = rng.standard_normal(n * 4)
    x = fft_band(x, lo, hi, sr)[:n]
    return x * env_exp(n, n_ms / 1000.0 / 3.0, sr, attack_s=0.0002)


def reverb_ir(dur: float, rt60: float, sr: int, rng, lo: float = 150.0, hi: float = 5000.0) -> np.ndarray:
    """IR sintético: ruído com decaimento exponencial (RT60) e banda limitada."""
    n = n_of(dur, sr)
    t = time_axis(n, sr)
    ir = rng.standard_normal(n) * np.exp(-6.91 * t / rt60)
    ir = fft_band(ir, lo, hi, sr)
    ir[: n_of(0.004, sr)] *= np.linspace(0, 1, n_of(0.004, sr))  # pré-atraso suave
    return ir / (np.sqrt(np.sum(ir ** 2)) + 1e-9)


def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]
    return y


def add_reverb(x: np.ndarray, wet: float, rt60: float, rng, sr: int = SR, hi: float = 5000.0) -> np.ndarray:
    ir = reverb_ir(min(rt60 * 1.2, 2.5), rt60, sr, rng, hi=hi)
    w = convolve(x, ir)[: len(x)]
    # Iguala a energia do molhado à do seco antes de aplicar o mix.
    w *= np.sqrt(np.sum(x ** 2) / (np.sum(w ** 2) + 1e-12))
    return x * (1.0 - wet * 0.5) + w * wet


def softclip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive)


def fade_out(x: np.ndarray, dur: float, sr: int = SR) -> np.ndarray:
    n = min(len(x), n_of(dur, sr))
    x = x.copy()
    x[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return x


def normalize(x: np.ndarray, peak_db: float = -1.0) -> np.ndarray:
    peak = np.max(np.abs(x)) + 1e-12
    return x * (db_to_lin(peak_db) / peak)


def trim_to_onset(x: np.ndarray, threshold: float = 0.03, pre_ms: float = 1.0, sr: int = SR) -> np.ndarray:
    """Remove o silêncio inicial: o som tem que começar NO quadro do evento."""
    peak = np.max(np.abs(x)) + 1e-12
    idx = int(np.argmax(np.abs(x) > peak * threshold))
    start = max(0, idx - int(pre_ms / 1000.0 * sr))
    return x[start:]


def resample(x: np.ndarray, ratio: float) -> np.ndarray:
    """Muda velocidade+tom (ratio > 1 = mais agudo e curto)."""
    n = int(len(x) / ratio)
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)


def write_wav(name: str, x: np.ndarray, sr: int = SR, rng=None) -> str:
    """Grava WAV 16-bit (mono ou estéreo [n, 2]) com dither TPDF."""
    rng = rng or np.random.default_rng(0)
    data = np.asarray(x, dtype=float)
    if data.ndim == 1:
        data = data[:, None]
    dither = (rng.random(data.shape) - rng.random(data.shape)) / 32768.0
    pcm = np.clip(data + dither, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(data.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    dur = len(data) / sr
    print(f"  {name:28s} {dur:5.2f}s  {data.shape[1]}ch  {os.path.getsize(path) / 1024:7.1f} KB")
    return path


def finish(x: np.ndarray, tail_fade: float = 0.03, peak_db: float = -1.0, sr: int = SR) -> np.ndarray:
    x = x - np.mean(x)
    # Micro fade-in (0.4 ms): tira o degrau de DC da 1ª amostra sem amaciar
    # o transiente (continua "imediato" para o ouvido).
    k = max(2, n_of(0.0004, sr))
    x[:k] *= np.linspace(0.0, 1.0, k)
    return normalize(fade_out(x, tail_fade, sr), peak_db)


# --------------------------------------------------------------------------
# Golpe da serra (retrabalho do hit_sound.mp3)
# --------------------------------------------------------------------------
def load_hit_source() -> np.ndarray:
    import miniaudio  # só a ferramenta precisa; o jogo toca o WAV gerado

    d = miniaudio.decode_file(HIT_SOURCE, output_format=miniaudio.SampleFormat.FLOAT32,
                              nchannels=1, sample_rate=SR)
    return np.frombuffer(d.samples, dtype=np.float32).astype(float)


def gen_saw_hit() -> None:
    """
    O MP3 original tem ~150 ms de silêncio antes do impacto e uma cauda longa
    (1.1 s). Para o golpe da serra: corta o silêncio (resposta imediata),
    encurta a cauda e soma camadas que vendem "lâmina dentada rasgando":
      - sub-thump (peso no corpo do inimigo),
      - "rip" de dentes: ruído agudo modulado na frequência dos dentes,
      - clique de transiente (borda nítida do corte).
    Três variações de tom/semente para o sorteio do AudioManager.
    """
    src = trim_to_onset(load_hit_source())
    variants = [(1.00, 180.0, 11), (0.90, 150.0, 12), (1.12, 210.0, 13)]
    for i, (ratio, tooth_hz, seed) in enumerate(variants, 1):
        rng = np.random.default_rng(seed)
        base = resample(src, ratio)
        n = n_of(0.42)
        out = np.zeros(n)
        place(out, base, 0.0, gain=0.85)

        # Sub-thump: seno descendo 120 -> 45 Hz, ~80 ms.
        nt = n_of(0.16)
        thump = sweep_sine(nt, 120.0 * ratio, 45.0) * env_exp(nt, 0.055, attack_s=0.001)
        place(out, thump, 0.0, gain=0.75)

        # "Rip" dos dentes: ruído 2-7 kHz com AM na frequência dos dentes.
        nr = n_of(0.12)
        t = time_axis(nr)
        rip = fft_band(rng.standard_normal(nr), 2000.0, 7000.0)
        teeth = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * tooth_hz * t))
        rip *= teeth * env_exp(nr, 0.035, attack_s=0.002)
        place(out, rip, 0.004, gain=0.35)

        # Transiente.
        place(out, click(3.0, 3000.0, 12000.0, rng), 0.0, gain=0.6)

        # Encurta a cauda do original: decai a partir de ~180 ms.
        tail = np.ones(n)
        k0 = n_of(0.18)
        tail[k0:] = np.exp(-time_axis(n - k0) / 0.07)
        out *= tail

        out = softclip(out * 1.2, 1.6)  # compressão "de graça": mais punch
        write_wav(f"saw-hit-0{i}.wav", finish(out, 0.02), rng=rng)


# --------------------------------------------------------------------------
# Coração de cura (pickup)
# --------------------------------------------------------------------------
def bell(n: int, f: float, rng, decay: float = 0.35) -> np.ndarray:
    return partials(n, f, [1.0, 2.0, 3.01, 4.17], [1.0, 0.32, 0.12, 0.05],
                    [decay, decay * 0.6, decay * 0.35, decay * 0.2], rng=rng) \
        * env_exp(n, 10.0, attack_s=0.002)


def gen_heart_pickup() -> None:
    """
    "Tum-tum" grave de batimento (tema coração) + arpejo maior ascendente
    curto (subida = recompensa) + brilho agudo. Duas variações de tonalidade.
    O AudioManager ainda sobe o tom em coletas seguidas (streak).
    """
    arps = [
        [659.26, 830.61, 987.77, 1318.51],   # Mi maior
        [587.33, 739.99, 880.00, 1174.66],   # Ré maior
    ]
    for i, notes in enumerate(arps, 1):
        rng = np.random.default_rng(100 + i)
        n = n_of(0.85)
        out = np.zeros(n)

        # Batimento "tum-tum" (lub-dub): dois thumps graves.
        for k, (t0, g, f) in enumerate([(0.0, 0.9, 78.0), (0.11, 0.6, 66.0)]):
            nt = n_of(0.14)
            th = sweep_sine(nt, f * 1.6, f) * env_exp(nt, 0.04, attack_s=0.002)
            place(out, th, t0, gain=g)

        # Arpejo: notas a cada 45 ms, a última sustenta mais.
        for k, f in enumerate(notes):
            nb = n_of(0.6)
            decay = 0.18 if k < len(notes) - 1 else 0.42
            place(out, bell(nb, f, rng, decay), 0.02 + k * 0.045, gain=0.32)

        # Brilho: ruído bem agudo em grãos, junto da última nota.
        ns = n_of(0.3)
        sparkle = fft_band(rng.standard_normal(ns), 6000.0, 11000.0)
        grains = (rng.random(ns) > 0.985).astype(float)
        grains = np.convolve(grains, np.hanning(64), mode="same")
        place(out, sparkle * grains * env_exp(ns, 0.12), 0.15, gain=0.25)

        out = add_reverb(out, 0.25, 0.8, rng)
        write_wav(f"heart-pickup-0{i}.wav", finish(out, 0.08), rng=rng)


# --------------------------------------------------------------------------
# Serra: corrente arrebentando, lâmina aterrissando, lâmina recolhida
# --------------------------------------------------------------------------
def chain_rattle(n: int, count: int, first_gap: float, growth: float, rng,
                 amp_decay: float = 0.82, start: float = 0.0) -> np.ndarray:
    """Sequência de cliques de elos com intervalo crescente (corrente solta)."""
    out = np.zeros(n)
    t, gap, amp = start, first_gap, 1.0
    for _ in range(count):
        c = click(rng.uniform(4, 8), 2500.0, 9000.0, rng)
        ring = partials(n_of(0.05), rng.uniform(3000, 4800), [1.0, 1.53], [0.5, 0.3],
                        [0.015, 0.01], rng=rng)
        place(out, c, t, gain=amp)
        place(out, ring, t, gain=amp * 0.5)
        t += gap * rng.uniform(0.85, 1.15)
        gap *= growth
        amp *= amp_decay
    return out


def gen_saw_snap() -> None:
    """
    Ruptura da corrente (evento GRANDE): estalo seco + "ping" metálico
    inarmônico + twang do cabo descendo + elos chacoalhando + whoosh.
    Acompanha o shake forte e a explosão de faíscas do onSnap.
    """
    rng = np.random.default_rng(200)
    n = n_of(0.95)
    out = np.zeros(n)

    place(out, click(4.0, 3000.0, 14000.0, rng), 0.0, gain=1.0)
    ping = partials(n_of(0.6), 1650.0, [1.0, 1.47, 2.09, 2.76, 3.9],
                    [0.8, 0.55, 0.4, 0.3, 0.15], [0.3, 0.22, 0.16, 0.1, 0.06], rng=rng)
    place(out, ping, 0.0, gain=0.45)

    # Twang do cabo: seno 420 -> 140 Hz com vibrato, ~250 ms.
    ntw = n_of(0.3)
    t = time_axis(ntw)
    vib = 1.0 + 0.03 * np.sin(2 * np.pi * 24 * t)
    f = 420.0 * (140.0 / 420.0) ** (t / t[-1]) * vib
    twang = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(ntw, 0.09, attack_s=0.003)
    place(out, softclip(twang, 2.0), 0.005, gain=0.3)

    out += chain_rattle(n, 9, 0.018, 1.2, rng, start=0.03) * 0.55

    # Whoosh: banda descendo 2.5k -> 400 Hz.
    nw = n_of(0.35)
    fc = 2500.0 * (400.0 / 2500.0) ** np.linspace(0, 1, nw)
    wh = svf(rng.standard_normal(nw), fc, q=1.2) * np.hanning(nw)
    place(out, wh, 0.0, gain=0.25)

    out = add_reverb(out, 0.3, 0.9, rng)
    write_wav("saw-snap.wav", finish(out, 0.1), rng=rng)


def gen_saw_land() -> None:
    """
    Lâmina pousando na pedra: baque grave + clang metálico + "moeda girando"
    (batidinhas cada vez mais rápidas e fracas, como o giro residual que o
    sprite mostra morrendo no chão). Duas variações.
    """
    for i, (base, seed) in enumerate([(520.0, 301), (470.0, 302)], 1):
        rng = np.random.default_rng(seed)
        n = n_of(1.1)
        out = np.zeros(n)

        nth = n_of(0.12)
        thud = fft_band(rng.standard_normal(nth), 40.0, 260.0) * env_exp(nth, 0.03)
        thud += sweep_sine(nth, 140.0, 70.0) * env_exp(nth, 0.04)
        place(out, thud, 0.0, gain=0.8)

        clang = partials(n_of(0.9), base, [1.0, 1.59, 2.14, 2.3, 3.5, 4.1],
                         [0.7, 0.5, 0.45, 0.3, 0.2, 0.12],
                         [0.55, 0.4, 0.3, 0.25, 0.15, 0.1], rng=rng)
        place(out, clang, 0.0, gain=0.38)
        place(out, click(3.0, 2000.0, 10000.0, rng), 0.0, gain=0.5)

        # "Moeda girando": batidas com intervalo encolhendo 90 -> 14 ms.
        t, gap, amp = 0.12, 0.09, 0.5
        while t < 0.85 and gap > 0.012:
            tap = partials(n_of(0.06), base * 2.14, [1.0, 1.6], [0.6, 0.3], [0.02, 0.012], rng=rng)
            place(tap, click(2.0, 2500.0, 8000.0, rng), 0.0, gain=0.5)
            place(out, tap, t, gain=amp)
            t += gap
            gap *= 0.84
            amp *= 0.9

        out = add_reverb(out, 0.3, 1.0, rng)
        write_wav(f"saw-land-0{i}.wav", finish(out, 0.12), rng=rng)


def gen_saw_pickup() -> None:
    """
    Reconexão (recompensa, poder de volta): trava grave ("clunk"), elos
    se juntando (intervalo DIMINUINDO, sensação de "puxar"), "shing" de
    lâmina subindo e um motor curto acelerando 70 -> 150 Hz.
    """
    rng = np.random.default_rng(400)
    n = n_of(0.8)
    out = np.zeros(n)

    # Elos chegando: intervalo encolhe (puxando) e volume cresce.
    t, gap, amp = 0.0, 0.03, 0.4
    for _ in range(5):
        place(out, click(rng.uniform(4, 7), 2500.0, 9000.0, rng), t, gain=amp)
        t += gap
        gap *= 0.75
        amp *= 1.2
    lock_t = t

    # Clunk da trava no fim do puxão.
    nc = n_of(0.1)
    clunk = sweep_sine(nc, 180.0, 95.0) * env_exp(nc, 0.03)
    place(out, clunk, lock_t, gain=0.7)
    place(out, click(3.0, 1500.0, 8000.0, rng), lock_t, gain=0.6)

    # Shing: banda estreita subindo 1.5k -> 7k + parciais tocando.
    ns = n_of(0.22)
    fc = 1500.0 * (7000.0 / 1500.0) ** np.linspace(0, 1, ns)
    shing = svf(rng.standard_normal(ns), fc, q=6.0) * np.hanning(ns) ** 0.7
    place(out, shing, lock_t - 0.02, gain=0.5)
    ring = partials(n_of(0.5), 3200.0, [1.0, 1.5, 2.2], [0.5, 0.3, 0.15], [0.3, 0.2, 0.1], rng=rng)
    place(out, ring, lock_t + 0.12, gain=0.18)

    # Motor: dente-de-serra acelerando, filtrado e saturado.
    nm = n_of(0.45)
    tm = time_axis(nm)
    f = 70.0 + 80.0 * (1 - np.exp(-tm / 0.12))
    phase = np.cumsum(f) / SR
    saw = 2.0 * (phase % 1.0) - 1.0
    motor = onepole_lp(softclip(saw, 1.5), 900.0)
    menv = np.minimum(1.0, tm / 0.03) * np.exp(-np.maximum(0, tm - 0.15) / 0.12)
    place(out, motor * menv, lock_t, gain=0.35)

    out = add_reverb(out, 0.2, 0.7, rng)
    write_wav("saw-pickup.wav", finish(out, 0.08), rng=rng)


# --------------------------------------------------------------------------
# Jogador caindo no abismo
# --------------------------------------------------------------------------
def gen_player_fall() -> None:
    """
    Queda no buraco: vento descendo (banda 1.8k -> 250 Hz) + assobio
    descendente afastando, com eco de poço; um baque distante e abafado no
    fim fecha o evento (~depois da animação de 0.57 s).
    """
    rng = np.random.default_rng(500)
    n = n_of(1.4)
    out = np.zeros(n)

    nw = n_of(0.85)
    tw = time_axis(nw)
    fc = 1800.0 * (250.0 / 1800.0) ** (tw / tw[-1])
    wind = svf(rng.standard_normal(nw), fc, q=1.5)
    wenv = np.minimum(1.0, tw / 0.06) * np.exp(-tw / 0.35)
    place(out, wind * wenv, 0.0, gain=0.6)

    whistle = sweep_sine(nw, 1100.0, 180.0) * (1.0 + 0.02 * np.sin(2 * np.pi * 7 * tw))
    place(out, whistle * np.minimum(1.0, tw / 0.02) * np.exp(-tw / 0.25), 0.0, gain=0.22)

    nth = n_of(0.3)
    far = onepole_lp(rng.standard_normal(nth) * env_exp(nth, 0.06), 220.0)
    far += sweep_sine(nth, 90.0, 50.0) * env_exp(nth, 0.07) * 0.3
    place(out, far, 0.82, gain=0.5)

    out = add_reverb(out, 0.45, 1.4, rng, hi=3000.0)
    write_wav("player-fall.wav", finish(out, 0.15), rng=rng)


# --------------------------------------------------------------------------
# Portas destravando (sala limpa)
# --------------------------------------------------------------------------
def gen_door_open() -> None:
    """
    Sala limpa: clunk do trinco + pedra arrastando (ruído marrom granulado)
    + baque final. Diegético e grave — recompensa sem "jingle" de interface.
    """
    rng = np.random.default_rng(600)
    n = n_of(1.45)
    out = np.zeros(n)

    nc = n_of(0.15)
    clunk = sweep_sine(nc, 110.0, 60.0) * env_exp(nc, 0.05)
    clunk += fft_band(rng.standard_normal(nc), 80.0, 900.0) * env_exp(nc, 0.025) * 0.6
    place(out, clunk, 0.0, gain=0.9)
    place(out, click(4.0, 1500.0, 6000.0, rng), 0.0, gain=0.4)

    ng = n_of(0.85)
    tg = time_axis(ng)
    brown = np.cumsum(rng.standard_normal(ng))
    brown = fft_band(brown - np.linspace(brown[0], brown[-1], ng), 60.0, 900.0)
    grain = np.abs(fft_band(rng.standard_normal(ng), 8.0, 35.0))
    grain = grain / (grain.max() + 1e-9)
    genv = np.sin(np.pi * tg / tg[-1]) ** 0.6
    place(out, brown * (0.35 + 0.65 * grain) * genv, 0.08, gain=0.55)

    nf = n_of(0.2)
    place(out, sweep_sine(nf, 95.0, 55.0) * env_exp(nf, 0.06), 0.95, gain=0.55)

    out = add_reverb(out, 0.35, 1.2, rng, hi=3500.0)
    write_wav("door-open.wav", finish(out, 0.12), rng=rng)


# --------------------------------------------------------------------------
# Ambiente da dungeon (loop sem emenda)
# --------------------------------------------------------------------------
def gen_ambience() -> None:
    """
    Loop estéreo de 20 s. Tudo é gerado num buffer CIRCULAR: filtros por FFT e
    reverb por convolução circular tornam o sinal periódico, e eventos (gotas,
    rangidos) que passam do fim continuam no começo. Resultado: o fim emenda
    no início sem clique nem "respiro".
      - drone grave (ruído marrom + senos em múltiplos de 1/L Hz),
      - vento distante com rajadas lentas,
      - gotas d'água esparsas com eco,
      - rangidos/elos distantes bem baixos.
    """
    sr = SR_AMB
    L = 20.0
    n = n_of(L, sr)
    rng = np.random.default_rng(700)
    t = time_axis(n, sr)
    base_f = 1.0 / L  # toda periodicidade usa múltiplos desta frequência

    def circ_noise(lo, hi, tilt=0.0):
        """Ruído colorido periódico (filtrado por FFT circular)."""
        spec = np.fft.rfft(rng.standard_normal(n))
        f = np.fft.rfftfreq(n, 1.0 / sr)
        mask = ((f >= lo) & (f <= hi)).astype(float)
        if tilt:
            mask *= 1.0 / np.maximum(f, lo) ** tilt
        y = np.fft.irfft(spec * mask, n=n)
        return y / (np.std(y) + 1e-12)

    def lfo(k, phase=0.0):
        return np.sin(2 * np.pi * k * base_f * t + phase)

    chans = []
    for ch in range(2):
        drone = circ_noise(25.0, 220.0, tilt=1.0) * (0.75 + 0.25 * lfo(1, ch * 1.3))
        tones = (0.5 * np.sin(2 * np.pi * 55.0 * t + ch)
                 + 0.35 * np.sin(2 * np.pi * 55.4 * t)
                 + 0.2 * np.sin(2 * np.pi * 82.5 * t + 2 * ch)) * (0.6 + 0.4 * lfo(2, ch))
        gust = 0.5 + 0.3 * lfo(2, 0.7 + ch) + 0.2 * lfo(5, 2.1 * ch)
        wind = circ_noise(280.0, 950.0, tilt=0.5) * np.clip(gust, 0.05, None) ** 1.5
        chans.append(drone * 0.5 + tones * 0.12 + wind * 0.16)
    amb = np.stack(chans, axis=1)

    def put_circ(sig, start, pan):
        idx = (np.arange(len(sig)) + int(start * sr)) % n
        amb[idx, 0] += sig * np.cos(pan * np.pi / 2)
        amb[idx, 1] += sig * np.sin(pan * np.pi / 2)

    # Gotas d'água: "plink" com chirp para cima + eco curto.
    for _ in range(11):
        f0 = rng.uniform(1100.0, 2300.0)
        nd = n_of(0.12, sr)
        td = time_axis(nd, sr)
        f = f0 * (1.0 + 0.6 * (1 - np.exp(-td / 0.012)))
        drop = np.sin(2 * np.pi * np.cumsum(f) / sr) * env_exp(nd, 0.025, sr, attack_s=0.0008)
        start = rng.uniform(0, L)
        pan = rng.uniform(0.1, 0.9)
        g = rng.uniform(0.25, 0.5)
        put_circ(drop * g, start, pan)
        put_circ(drop * g * 0.3, start + rng.uniform(0.09, 0.16), 1 - pan)

    # Rangidos / elos distantes: bem baixos e abafados.
    for _ in range(3):
        nk = n_of(0.9, sr)
        tk = time_axis(nk, sr)
        creak = sweep_sine(nk, rng.uniform(180, 260), rng.uniform(120, 170), sr)
        creak *= 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * rng.uniform(18, 30) * tk))
        creak = fft_band(creak, 100.0, 1400.0, sr) * np.sin(np.pi * tk / tk[-1]) ** 2
        put_circ(creak * 0.06, rng.uniform(0, L), rng.uniform(0.2, 0.8))

    # Reverb circular estéreo (cauda que "dá a volta" mantém o loop contínuo).
    for ch in range(2):
        ir = reverb_ir(1.8, 1.6, sr, rng, hi=3500.0)
        ir_full = np.zeros(n)
        ir_full[: len(ir)] = ir
        wet = np.fft.irfft(np.fft.rfft(amb[:, ch]) * np.fft.rfft(ir_full), n=n)
        wet *= np.std(amb[:, ch]) / (np.std(wet) + 1e-12)
        amb[:, ch] = amb[:, ch] * 0.75 + wet * 0.45

    amb -= amb.mean(axis=0)
    amb = amb * (db_to_lin(-6.0) / (np.max(np.abs(amb)) + 1e-12))
    write_wav("ambience-dungeon.wav", amb, sr=sr, rng=rng)


# --------------------------------------------------------------------------
# Motor da serra (loop extraído de circular-saw.mp3)
# --------------------------------------------------------------------------
SAW_SOURCE = os.path.join(OUT_DIR, "circular-saw.mp3")


def gen_saw_motor() -> None:
    """
    O `circular-saw.mp3` tem 30 s: ~0.6–5.9 s de motor em regime (estável),
    depois desaceleração e vários arranques/paradas. Só o regime vira loop —
    a aceleração/desaceleração é feita EM JOGO (playbackRate + filtro + ganho
    seguindo o giro da serra), então o loop precisa ser neutro e constante.

    Passos:
      1. recorta o trecho estável;
      2. high-pass leve (tira ronco/DC que soma "embolado" em pitch baixo);
      3. NIVELA a loudness: envelope RMS lento (~250 ms) e ganho que corrige
         80% do desvio da média — some o "sobe-desce" do corte original sem
         esmagar a textura do motor;
      4. LOOP SEM SOLUÇO: crossfade de potência constante (sinal tipo ruído,
         não correlacionado) entre o fim e o começo; o ponto de emenda é
         escolhido por correlação para alinhar a fase do zumbido;
      5. normaliza o pico em -3 dBFS (o jogo controla o volume por cima).
    """
    import miniaudio

    d = miniaudio.decode_file(SAW_SOURCE, output_format=miniaudio.SampleFormat.FLOAT32,
                              nchannels=1, sample_rate=SR)
    src = np.frombuffer(d.samples, dtype=np.float32).astype(float)

    seg = src[n_of(0.9):n_of(5.8)]
    seg = fft_band(seg - seg.mean(), 70.0, SR / 2)

    # Nivelamento lento de loudness.
    win = n_of(0.25)
    kern = np.hanning(win)
    kern /= kern.sum()
    rms = np.sqrt(np.convolve(seg ** 2, kern, mode="same") + 1e-12)
    target = np.sqrt(np.mean(seg ** 2))
    seg = seg * (target / rms) ** 0.8

    # Ponto de emenda: busca o comprimento L (perto de 4.3 s) cujo trecho de
    # crossfade mais se parece com o início (correlação normalizada).
    xf = n_of(0.35)
    head = seg[:xf]
    best_L, best_c = None, -2.0
    for L in range(n_of(4.1), min(n_of(4.5), len(seg) - xf), 16):
        tail = seg[L:L + xf]
        c = np.dot(head, tail) / (np.linalg.norm(head) * np.linalg.norm(tail) + 1e-12)
        if c > best_c:
            best_L, best_c = L, c
    L = best_L

    # Crossfade: out[i] = seg[i]*fade_in + seg[L+i]*fade_out (i < xf).
    # Como out[L-1] = seg[L-1] e out[0] ≈ seg[L], a volta é contínua.
    u = np.linspace(0.0, 1.0, xf)
    fin, fout = np.sin(u * np.pi / 2), np.cos(u * np.pi / 2)
    loop = seg[:L].copy()
    loop[:xf] = seg[:xf] * fin + seg[L:L + xf] * fout

    loop = normalize(loop - loop.mean(), -3.0)
    print(f"  (emenda em {L / SR:.3f}s, correlação {best_c:+.3f})")
    write_wav("saw-motor-loop.wav", loop, rng=np.random.default_rng(800))


GROUPS = {
    "saw_motor": gen_saw_motor,
    "saw_hit": gen_saw_hit,
    "heart_pickup": gen_heart_pickup,
    "saw_snap": gen_saw_snap,
    "saw_land": gen_saw_land,
    "saw_pickup": gen_saw_pickup,
    "player_fall": gen_player_fall,
    "door_open": gen_door_open,
    "ambience": gen_ambience,
}


def main(argv) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    names = argv[1:] or list(GROUPS)
    for name in names:
        if name not in GROUPS:
            sys.exit(f"grupo desconhecido: {name} (opções: {', '.join(GROUPS)})")
        print(f"[{name}]")
        GROUPS[name]()


if __name__ == "__main__":
    main(sys.argv)
