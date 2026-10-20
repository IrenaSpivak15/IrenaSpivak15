# Meme-style soundtrack for scene_funny.html: 140bpm trap beat, vine booms, record scratch, pops, sad violin.
import wave
import numpy as np

SR, DUR = 44100, 15.0
t = np.arange(int(SR * DUR)) / SR
mix = np.zeros_like(t)
noise = np.random.default_rng(3).standard_normal(len(t))
BEAT = 60 / 140

def env(s, a, d):
    e = np.zeros_like(t); m = t >= s; x = t[m] - s
    e[m] = np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / d)
    return e

def gate(a, b):
    return ((t >= a) & (t < b)).astype(float)

def sweep_sine(s, f0, f1, rate, d, gain):
    global mix
    f = f1 + (f0 - f1) * np.exp(-np.clip(t - s, 0, None) * rate)
    mix += gain * np.sin(2*np.pi*np.cumsum(f) / SR) * env(s, .002, d)

def kick(s, g=1.0): sweep_sine(s, 160, 45, 30, .18, .9 * g)
def hat(s, g=1.0):
    global mix; mix += .12 * g * np.diff(noise, prepend=0) * env(s, .001, .025)
def snare(s):
    global mix; mix += .35 * noise * env(s, .001, .09); sweep_sine(s, 260, 180, 40, .08, .3)
def boom(s, g=1.0):  # "vine boom": deep pitch-dropping hit, saturated
    global mix
    f = 50 + 70 * np.exp(-np.clip(t - s, 0, None) * 8)
    x = np.sin(2*np.pi*np.cumsum(f) / SR) * env(s, .004, .7)
    mix += g * np.tanh(3 * x) * .8
def pop(s, f=900):
    sweep_sine(s, f * 1.8, f, 60, .05, .35)

# trap beat: 0–8.6 and 11.55–15
for a, b in ((0.0, 8.6), (11.55, 15.0)):
    n = 0
    while a + n * BEAT / 2 < b:
        s = a + n * BEAT / 2
        if n % 8 in (0, 3, 6): kick(s, .8)
        if n % 8 == 4: snare(s)
        hat(s); hat(s + BEAT / 4, .6)
        n += 1
# 808 bass line
for a, b in ((0.0, 8.6), (11.55, 15.0)):
    notes = [55.0, 55.0, 65.4, 49.0]
    for k, s in enumerate(np.arange(a, b, BEAT * 2)):
        f = notes[k % 4]
        mix += .35 * np.tanh(2*np.sin(2*np.pi*f*t)) * env(s, .005, .5) * gate(s, min(b, s + BEAT * 2))

# chat bubbles / pops
for s, f in ((0.05, 600), (0.7, 1000), (8.05, 1000), (9.6, 1000), (10.4, 1300), (13.6, 1200)):
    pop(s, f)
# counter: rising ticks
for k, s in enumerate(np.arange(2.25, 4.9, 0.11)):
    sweep_sine(s, 1200 + k * 60, 1200 + k * 60, 1, .02, .15)
# flashes
boom(2.2, .5)
for s in (5.0, 6.0, 7.0): boom(s)
# record scratch + beat stops at the twist
sc = gate(8.55, 8.8)
mod = np.sin(2*np.pi*14*t)
mix += .5 * sc * np.diff(noise, prepend=0) * (0.5 + 0.5*mod) * np.exp(-np.clip(t - 8.55, 0, None) * 6)
boom(8.7, 1.1)
# sad violin for the cat (9.6–10.4): vibrato, descending
for f0, s in ((659.3, 9.65), (622.3, 9.9), (587.3, 10.15)):
    vib = 6 * np.sin(2*np.pi*6*t)
    ph = 2*np.pi*np.cumsum(f0 + vib) / SR
    tone = np.sin(ph) + .5*np.sin(2*ph) + .3*np.sin(3*ph)
    mix += .12 * tone * gate(s, s + .28) * np.clip((t - s) / .05, 0, 1)
# phone faints: slide whistle down + bonk
sweep_sine(10.5, 1400, 200, 4, .5, .25)
sweep_sine(10.9, 400, 300, 20, .12, .6)
# final slams + ding
boom(11.55, 1.0); boom(12.05, 1.0)
mix += .2 * np.sin(2*np.pi*1760*t) * env(13.6, .002, .5)

mix *= np.clip((DUR - t) / .5, 0, 1)
mix /= np.max(np.abs(mix)) / .9
st = np.stack([mix, np.roll(mix, 250)], axis=1)
with wave.open('soundtrack_funny.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
