"""
gen_trailer_sfx.py — efeitos sonoros procedurais do TRAILER (WAV 16-bit).

Reaproveita os utilitários de DSP de tools/gen_sfx.py (numpy, seeds fixas:
rodar de novo produz exatamente os mesmos arquivos). Saída em
assets/audio/trailer/.

Uso:
    python tools/gen_trailer_sfx.py            # gera todos
    python tools/gen_trailer_sfx.py boom roar  # só alguns grupos (ver GROUPS)

Camadas de game feel em cada som: transiente imediato (sem silêncio no
início) + corpo + cauda; variações numeradas para o sorteio em tempo real;
pico em -1 dBFS (one-shots) e -6 dBFS (loops periódicos, sem emenda).
"""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_sfx as G  # noqa: E402
from gen_sfx import (SR, n_of, time_axis, env_exp, place, fft_band, svf, onepole_lp,  # noqa: E402
                     sweep_sine, partials, click, add_reverb, softclip, finish, write_wav)

G.OUT_DIR = os.path.join(G.ROOT, "assets", "audio", "trailer")


def saw_wave(f, n, sr=SR):
    """Dente-de-serra com frequência (escalar ou array) — áspero, para rugidos/raio."""
    f = np.broadcast_to(np.asarray(f, dtype=float), (n,))
    ph = np.cumsum(f) / sr
    return 2.0 * (ph % 1.0) - 1.0


def noise(n, rng):
    return rng.standard_normal(n)


def swell(n, attack_frac=0.5, power=1.5):
    """Envelope que sobe e desce (0 -> 1 -> 0), pico em attack_frac."""
    u = np.linspace(0.0, 1.0, n)
    a = np.clip(u / attack_frac, 0, 1)
    d = np.clip((1 - u) / (1 - attack_frac), 0, 1)
    return (np.minimum(a, d)) ** power


# --------------------------------------------------------------------------
def gen_whoosh() -> None:
    """Passagem de ar (cortes, câmera chicoteando): banda sobe e desce, assobio leve."""
    for i, (dur, f0, f1, seed) in enumerate([(0.38, 500, 4200, 1), (0.55, 350, 3200, 2), (0.8, 250, 2600, 3)], 1):
        rng = np.random.default_rng(1000 + seed)
        n = n_of(dur)
        u = np.linspace(0, 1, n)
        fc = f0 * (f1 / f0) ** np.sin(np.pi * u)          # sobe e volta
        x = svf(noise(n, rng), fc, q=1.4)
        x += 0.35 * svf(noise(n, rng), fc * 1.9, q=6.0)   # assobio
        x *= swell(n, 0.45, 1.6)
        x = add_reverb(x, 0.2, 0.6, rng)
        write_wav(f"whoosh-0{i}.wav", finish(x, 0.05), rng=rng)


def impact_layer(rng, dur=1.6, sub_f=(95, 32), body=(70, 2600), crack_gain=0.8, rt=1.4, wet=0.35):
    n = n_of(dur)
    out = np.zeros(n)
    nt = n_of(0.6)
    place(out, sweep_sine(nt, sub_f[0], sub_f[1]) * env_exp(nt, 0.28, attack_s=0.001), 0.0, gain=1.0)
    nb = n_of(0.5)
    place(out, fft_band(noise(nb, rng), *body) * env_exp(nb, 0.11, attack_s=0.0008), 0.0, gain=0.9)
    place(out, click(4.0, 2500.0, 12000.0, rng), 0.0, gain=crack_gain)
    out = softclip(out * 1.5, 2.2)
    return add_reverb(out, wet, rt, rng, hi=4500.0)


def gen_impact() -> None:
    """Pancada cinematográfica (corte seco, entrada do boss, close): sub + corpo + estalo + cauda."""
    for i, (sub, seed) in enumerate([((95, 32), 11), ((80, 28), 12), ((110, 36), 13)], 1):
        rng = np.random.default_rng(1100 + seed)
        write_wav(f"impact-0{i}.wav", finish(impact_layer(rng, sub_f=sub), 0.3), rng=rng)


def gen_boom() -> None:
    """Explosão: baque grave + rajada de ruído abafando + estalos de brasa na cauda."""
    for i, (seed, lo_cut) in enumerate([(21, 2600), (22, 2000), (23, 3200)], 1):
        rng = np.random.default_rng(1200 + seed)
        n = n_of(2.4)
        out = np.zeros(n)
        nt = n_of(0.9)
        place(out, sweep_sine(nt, 75, 26) * env_exp(nt, 0.45, attack_s=0.002), 0.0, gain=1.0)
        nb = n_of(1.8)
        t = time_axis(nb)
        burst = fft_band(noise(nb, rng), 30.0, lo_cut) * np.exp(-t / 0.42)
        burst *= np.minimum(1.0, t / 0.004)
        place(out, burst, 0.0, gain=1.1)
        for _ in range(26):
            place(out, click(rng.uniform(1.5, 5.0), 1500.0, 9000.0, rng),
                  rng.uniform(0.05, 1.9) ** 1.3, gain=rng.uniform(0.08, 0.35))
        out = softclip(out * 1.6, 2.5)
        out = add_reverb(out, 0.42, 1.9, rng, hi=3500.0)
        write_wav(f"boom-0{i}.wav", finish(out, 0.4), rng=rng)


def gen_rumble_loop() -> None:
    """Tremor grave em loop (periódico: emenda sem clique). Tensão, terremoto, presença do boss."""
    rng = np.random.default_rng(1300)
    n = n_of(4.0)
    t = time_axis(n)
    x = fft_band(noise(n, rng), 22.0, 160.0)               # circular = periódico
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * 1.0 * t)          # 4 ciclos em 4 s
    x += 0.25 * fft_band(noise(n, rng), 200.0, 700.0) * (0.5 + 0.5 * np.sin(2 * np.pi * 2.0 * t + 1.0))
    x = x - np.mean(x)
    write_wav("rumble-loop.wav", G.normalize(x, -6.0), rng=rng)


def gen_riser() -> None:
    """Subida antes dos grandes momentos (título, mergulho, carga): ruído e tom subindo, tremolo acelerando."""
    rng = np.random.default_rng(1400)
    n = n_of(1.5)
    u = np.linspace(0, 1, n)
    fc = 300.0 * (7000.0 / 300.0) ** (u ** 1.6)
    x = svf(noise(n, rng), fc, q=2.0)
    tone = np.sin(2 * np.pi * np.cumsum(80.0 * (5.0 ** (u ** 1.4))) / SR)
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(4.0 + 26.0 * u ** 2) / SR)
    x = (x * 0.8 + tone * 0.45) * trem * (u ** 2.2)
    x = add_reverb(x, 0.3, 1.0, rng)
    write_wav("riser.wav", finish(x, 0.015), rng=rng)


def gen_sting() -> None:
    """Golpe do TÍTULO: pancada pesada + anel metálico (serra/corrente) + cauda longa."""
    rng = np.random.default_rng(1500)
    n = n_of(3.8)
    out = np.zeros(n)
    place(out, impact_layer(rng, dur=2.0, sub_f=(70, 24), wet=0.25, rt=1.0), 0.0, gain=1.0)
    nr = n_of(3.4)
    ring = partials(nr, 220.0, [1.0, 2.76, 5.4, 8.93, 13.3], [0.6, 0.45, 0.3, 0.18, 0.1],
                    [1.6, 1.1, 0.7, 0.45, 0.3], rng=rng)
    ring += partials(nr, 331.0, [1.0, 2.41, 4.1], [0.35, 0.22, 0.12], [1.3, 0.8, 0.5], rng=rng)
    place(out, ring, 0.003, gain=0.35)
    out = add_reverb(out, 0.5, 3.0, rng, hi=6000.0)
    write_wav("sting.wav", finish(out, 0.6), rng=rng)


def gen_splat() -> None:
    """Sangue / pedaços: estalo úmido + "squelch" descendo + respingos."""
    for i, (lo, hi, seed) in enumerate([(250, 2800, 31), (200, 2200, 32), (320, 3400, 33), (180, 2000, 34)], 1):
        rng = np.random.default_rng(1600 + seed)
        n = n_of(0.42)
        out = np.zeros(n)
        nw = n_of(0.16)
        place(out, fft_band(noise(nw, rng), lo, hi) * env_exp(nw, 0.04, attack_s=0.0008), 0.0, gain=1.0)
        nq = n_of(0.14)
        tq = time_axis(nq)
        sq = np.sin(2 * np.pi * np.cumsum(420.0 * (110.0 / 420.0) ** (tq / 0.14)) / SR)
        place(out, sq * env_exp(nq, 0.05), 0.006, gain=0.5)
        nt = n_of(0.12)
        place(out, sweep_sine(nt, 140, 55) * env_exp(nt, 0.04), 0.0, gain=0.7)
        for _ in range(6):
            place(out, click(rng.uniform(2, 5), 900.0, 5000.0, rng), rng.uniform(0.04, 0.3), gain=rng.uniform(0.15, 0.4))
        out = add_reverb(softclip(out * 1.3, 1.8), 0.18, 0.5, rng)
        write_wav(f"splat-0{i}.wav", finish(out, 0.05), rng=rng)


def gen_flame() -> None:
    """Fogo acendendo (cuspe do boss, sumiço em chamas, minions surgindo): banda subindo + rugido grave + brasas."""
    for i, (dur, seed) in enumerate([(0.9, 41), (1.3, 42)], 1):
        rng = np.random.default_rng(1700 + seed)
        n = n_of(dur)
        out = np.zeros(n)
        t = time_axis(n)
        fc = 250.0 * (3200.0 / 250.0) ** np.minimum(1.0, t / (dur * 0.4))
        env = np.minimum(1.0, t / 0.03) * np.exp(-t / (dur * 0.38))
        place(out, svf(noise(n, rng), fc, q=0.9) * env, 0.0, gain=0.9)
        place(out, fft_band(noise(n, rng), 50.0, 450.0) * env, 0.0, gain=0.7)
        for _ in range(14):
            place(out, click(rng.uniform(1.5, 4.0), 2000.0, 9000.0, rng), rng.uniform(0.03, dur * 0.85), gain=rng.uniform(0.12, 0.35))
        nt = n_of(0.22)
        place(out, sweep_sine(nt, 120, 45) * env_exp(nt, 0.07, attack_s=0.002), 0.0, gain=0.7)
        out = add_reverb(out, 0.3, 1.0, rng, hi=4000.0)
        write_wav(f"flame-0{i}.wav", finish(out, 0.1), rng=rng)


def gen_beam() -> None:
    """Raio do boss: CARGA (zumbido subindo + estalos cada vez mais densos) e DISPARO (rajada + zumbido áspero)."""
    rng = np.random.default_rng(1800)
    # Carga (0.85 s): dura a carga + aviso do roteiro.
    n = n_of(0.9)
    u = np.linspace(0, 1, n)
    f = 55.0 * (4.5 ** (u ** 1.3))
    x = softclip(saw_wave(f, n) + 0.6 * saw_wave(f * 1.505, n), 2.5)
    x = onepole_lp(x, 1800.0) * (0.15 + 0.85 * u ** 1.5)
    x += svf(noise(n, rng), 500.0 * (12.0 ** u), q=3.0) * 0.5 * u ** 2
    for k in range(40):
        tk = (rng.random() ** 0.45) * 0.88
        place(x, click(rng.uniform(1.0, 3.0), 2500.0, 10000.0, rng), tk, gain=0.2 + 0.4 * tk)
    write_wav("beam-charge.wav", finish(add_reverb(x, 0.2, 0.7, rng), 0.02), rng=rng)

    # Disparo (1.7 s): rajada inicial + zumbido distorcido com tremolo rápido + cauda.
    rng = np.random.default_rng(1801)
    n = n_of(1.7)
    t = time_axis(n)
    out = np.zeros(n)
    place(out, impact_layer(rng, dur=1.0, sub_f=(120, 40), body=(150, 5000), wet=0.15, rt=0.8), 0.0, gain=0.8)
    buzz = saw_wave(58.0, n) + 0.7 * saw_wave(87.3, n) + 0.5 * saw_wave(116.5, n)
    buzz = softclip(buzz * 1.4, 3.0)
    buzz *= 0.7 + 0.3 * np.sin(2 * np.pi * 31.0 * t)
    hiss = fft_band(noise(n, rng), 600.0, 5500.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 23.0 * t + 1))
    body = onepole_lp(buzz, 2600.0) * 0.6 + hiss * 0.35
    env = np.minimum(1.0, t / 0.02) * np.where(t < 1.0, 1.0, np.exp(-(t - 1.0) / 0.22))
    place(out, body * env, 0.0, gain=0.9)
    out = add_reverb(out, 0.3, 1.2, rng, hi=5000.0)
    write_wav("beam-fire.wav", finish(out, 0.2), rng=rng)


def gen_roar() -> None:
    """Rugido do boss: dentes-de-serra graves desafinados + formante que abre/fecha + respiração + sub."""
    rng = np.random.default_rng(1900)
    n = n_of(2.0)
    t = time_axis(n)
    u = t / t[-1]
    pitch = 46.0 * (1.0 + 0.25 * np.sin(np.pi * u)) * (1.0 + 0.02 * np.sin(2 * np.pi * 7.0 * t))
    src = saw_wave(pitch, n) + saw_wave(pitch * 1.012, n) + 0.6 * saw_wave(pitch * 1.5, n)
    src *= 0.75 + 0.25 * np.sin(2 * np.pi * 9.0 * t)
    form = 280.0 + 520.0 * np.sin(np.pi * np.clip(u * 1.15, 0, 1)) ** 1.2
    voice = svf(src, form, q=2.2) * 1.4 + svf(src, form * 2.3, q=3.0) * 0.6
    voice = softclip(voice * 1.8, 3.0)
    breath = fft_band(noise(n, rng), 300.0, 3500.0) * 0.35
    env = swell(n, 0.25, 0.9)
    out = (voice + breath) * env
    nt = n_of(0.7)
    place(out, sweep_sine(nt, 60, 30) * env_exp(nt, 0.4, attack_s=0.01), 0.0, gain=0.8)
    out = add_reverb(out, 0.45, 2.2, rng, hi=3500.0)
    write_wav("roar.wav", finish(out, 0.3), rng=rng)


def gen_pop() -> None:
    """Sala nascendo no mapa: 'bloop' tonal curto + baque (três tons para escalar)."""
    for i, (f0, f1, seed) in enumerate([(220, 520, 51), (262, 620, 52), (196, 466, 53)], 1):
        rng = np.random.default_rng(2000 + seed)
        n = n_of(0.3)
        out = np.zeros(n)
        nb = n_of(0.16)
        place(out, sweep_sine(nb, f0, f1) * env_exp(nb, 0.06, attack_s=0.001), 0.0, gain=0.7)
        nt = n_of(0.12)
        place(out, sweep_sine(nt, 130, 60) * env_exp(nt, 0.04), 0.0, gain=0.6)
        place(out, click(2.5, 1500.0, 7000.0, rng), 0.0, gain=0.3)
        write_wav(f"pop-0{i}.wav", finish(add_reverb(out, 0.2, 0.6, rng), 0.04), rng=rng)


def gen_blip() -> None:
    """Letra do balão (máquina de escrever 8-bit): pulso quadrado curtíssimo."""
    for i, f in enumerate([620.0, 780.0], 1):
        rng = np.random.default_rng(2100 + i)
        n = n_of(0.045)
        t = time_axis(n)
        x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + 0.5 * np.sin(2 * np.pi * f * 2 * t)
        x *= env_exp(n, 0.012, attack_s=0.0005)
        write_wav(f"blip-0{i}.wav", finish(onepole_lp(x, 5000.0), 0.005, peak_db=-6.0), rng=rng)


def gen_stone() -> None:
    """Botão de pedra afundando (click) e porta de pedra arrastando (grind)."""
    rng = np.random.default_rng(2200)
    n = n_of(0.3)
    out = np.zeros(n)
    place(out, click(5.0, 600.0, 4000.0, rng), 0.0, gain=1.0)
    nt = n_of(0.18)
    place(out, sweep_sine(nt, 160, 70) * env_exp(nt, 0.05), 0.0, gain=0.8)
    place(out, fft_band(noise(n_of(0.1), rng), 300, 1800) * env_exp(n_of(0.1), 0.03), 0.02, gain=0.4)
    write_wav("stone-click.wav", finish(add_reverb(out, 0.25, 0.7, rng), 0.04), rng=rng)

    rng = np.random.default_rng(2201)
    n = n_of(1.4)
    t = time_axis(n)
    grit = fft_band(noise(n, rng), 70.0, 1100.0)
    am = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 5.5 * t + 3 * np.sin(2 * np.pi * 1.3 * t)))
    tone = np.sin(2 * np.pi * np.cumsum(48.0 + 6 * np.sin(2 * np.pi * 0.8 * t)) / SR) * 0.4
    x = (grit * am + tone) * swell(n, 0.15, 0.7)
    write_wav("stone-grind.wav", finish(add_reverb(x, 0.3, 1.1, rng), 0.15), rng=rng)


def gen_thunk() -> None:
    """Flecha cravando (madeira/pedra) e baque de corpo na parede."""
    for i, (f, seed) in enumerate([(190.0, 61), (230.0, 62)], 1):
        rng = np.random.default_rng(2300 + seed)
        n = n_of(0.2)
        out = np.zeros(n)
        place(out, click(3.0, 1500.0, 8000.0, rng), 0.0, gain=0.9)
        place(out, partials(n, f, [1.0, 2.7, 5.1], [0.6, 0.3, 0.15], [0.05, 0.03, 0.015], rng=rng), 0.0, gain=0.6)
        write_wav(f"thunk-0{i}.wav", finish(out, 0.03), rng=rng)

    rng = np.random.default_rng(2310)
    n = n_of(0.5)
    out = np.zeros(n)
    nt = n_of(0.3)
    place(out, sweep_sine(nt, 120, 42) * env_exp(nt, 0.09, attack_s=0.001), 0.0, gain=1.0)
    place(out, fft_band(noise(n_of(0.2), rng), 150, 2400) * env_exp(n_of(0.2), 0.05), 0.0, gain=0.8)
    place(out, click(3.0, 2000.0, 9000.0, rng), 0.0, gain=0.5)
    write_wav("thud.wav", finish(add_reverb(softclip(out * 1.4, 2.0), 0.25, 0.8, rng), 0.05), rng=rng)


def gen_crack() -> None:
    """Rachaduras de luz na caveira: estalos ficando densos + lascas tonais agudas."""
    rng = np.random.default_rng(2400)
    n = n_of(1.2)
    out = np.zeros(n)
    for k in range(70):
        tk = (rng.random() ** 0.6) * 1.1
        place(out, click(rng.uniform(1.0, 3.5), 1800.0, 11000.0, rng), tk, gain=rng.uniform(0.2, 0.6))
        if rng.random() < 0.25:
            nn = n_of(0.08)
            place(out, partials(nn, rng.uniform(2200, 5200), [1.0, 1.41], [0.4, 0.2], [0.03, 0.02], rng=rng), tk, gain=0.3)
    nt = n_of(0.5)
    place(out, sweep_sine(nt, 90, 40) * env_exp(nt, 0.2), 0.0, gain=0.6)
    write_wav("crack.wav", finish(add_reverb(out, 0.3, 1.2, rng), 0.1), rng=rng)


def gen_zap() -> None:
    """Estroboscópio do título: zap elétrico curto (ruído agudo + zumbido de 120 Hz)."""
    for i, seed in enumerate([71, 72], 1):
        rng = np.random.default_rng(2500 + seed)
        n = n_of(0.14)
        t = time_axis(n)
        x = fft_band(noise(n, rng), 1800.0, 9000.0) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 120.0 * t)))
        x += 0.4 * np.sign(np.sin(2 * np.pi * 60.0 * t))
        x *= env_exp(n, 0.04, attack_s=0.0005)
        write_wav(f"zap-0{i}.wav", finish(onepole_lp(x, 7000.0), 0.01, peak_db=-3.0), rng=rng)


def gen_slowmo() -> None:
    """Entrada em câmera lenta: ar descendo + tom caindo (o tempo 'arrasta')."""
    rng = np.random.default_rng(2600)
    n = n_of(1.3)
    u = np.linspace(0, 1, n)
    fc = 4500.0 * (250.0 / 4500.0) ** (u ** 0.7)
    x = svf(noise(n, rng), fc, q=1.8)
    x += 0.5 * np.sin(2 * np.pi * np.cumsum(320.0 * (55.0 / 320.0) ** u) / SR)
    x *= swell(n, 0.12, 1.2)
    write_wav("slowmo.wav", finish(add_reverb(x, 0.45, 1.6, rng), 0.2), rng=rng)


def gen_rope() -> None:
    """Tranco da corda / tensão: rangido curto de fibra + estalo."""
    for i, (f, seed) in enumerate([(900.0, 81), (1200.0, 82)], 1):
        rng = np.random.default_rng(2700 + seed)
        n = n_of(0.3)
        t = time_axis(n)
        x = svf(noise(n, rng), f * (1 + 0.4 * np.sin(2 * np.pi * 9 * t)), q=5.0)
        x *= (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t))) * env_exp(n, 0.09, attack_s=0.003)
        place(x, click(3.0, 2000.0, 8000.0, rng), 0.0, gain=0.6)
        write_wav(f"rope-0{i}.wav", finish(x, 0.03), rng=rng)


def gen_heartbeat() -> None:
    """Batida de coração (plano final em câmera lenta): tum-tum grave."""
    rng = np.random.default_rng(2800)
    n = n_of(0.9)
    out = np.zeros(n)
    for t0, g, f in [(0.0, 1.0, 62.0), (0.17, 0.7, 54.0)]:
        nt = n_of(0.22)
        place(out, sweep_sine(nt, f * 1.7, f) * env_exp(nt, 0.07, attack_s=0.003), t0, gain=g)
    write_wav("heartbeat.wav", finish(add_reverb(out, 0.3, 1.2, rng, hi=1500.0), 0.1), rng=rng)


GROUPS = {
    "whoosh": gen_whoosh, "impact": gen_impact, "boom": gen_boom, "rumble": gen_rumble_loop,
    "riser": gen_riser, "sting": gen_sting, "splat": gen_splat, "flame": gen_flame,
    "beam": gen_beam, "roar": gen_roar, "pop": gen_pop, "blip": gen_blip, "stone": gen_stone,
    "thunk": gen_thunk, "crack": gen_crack, "zap": gen_zap, "slowmo": gen_slowmo,
    "rope": gen_rope, "heartbeat": gen_heartbeat,
}


def main(argv) -> None:
    os.makedirs(G.OUT_DIR, exist_ok=True)
    names = argv[1:] or list(GROUPS)
    for name in names:
        if name not in GROUPS:
            sys.exit(f"grupo desconhecido: {name} (opções: {', '.join(GROUPS)})")
        print(f"[{name}]")
        GROUPS[name]()


if __name__ == "__main__":
    main(sys.argv)
