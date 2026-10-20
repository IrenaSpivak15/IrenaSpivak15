# Synthesizes the 15s soundtrack (no external assets): dark drone, swipes, hits, ticks, uplifting pad.
import wave
import numpy as np

SR, DUR = 44100, 15.0
t = np.arange(int(SR * DUR)) / SR
mix = np.zeros_like(t)
rng = np.random.default_rng(7)

def env(start, attack, decay):
    e = np.zeros_like(t)
    m = t >= start
    x = t[m] - start
    e[m] = np.minimum(1, x / max(attack, 1e-4)) * np.exp(-x / decay)
    return e

def window(a, b, fade=0.4):
    return np.clip((t - a) / fade, 0, 1) * np.clip((b - t) / fade, 0, 1)

def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode='same')

noise = rng.standard_normal(len(t))

# dark drone + pulse for the "bad" part (0-8s)
drone = 0.25 * np.sin(2*np.pi*55*t) + 0.12 * np.sin(2*np.pi*82.4*t + np.sin(2*np.pi*0.3*t))
pulse = 0.5 + 0.5 * np.sin(2*np.pi*2*t) ** 8
mix += drone * pulse * window(0, 8.1, 0.3)
mix += 0.05 * lowpass(noise, 200) * window(0, 8, 0.3)

# swipes (0-3s)
for k in range(6):
    s = k * 0.55
    sweep = np.sin(2*np.pi*(800 + 3000*np.clip(t - s, 0, .2))*t)
    mix += 0.10 * lowpass(noise, 6) * env(s, 0.04, 0.08) + 0.02 * sweep * env(s, .03, .06)

# impact hits on each hard cut
def hit(s, gain=1.0):
    global mix
    f = 40 + 120 * np.exp(-np.clip(t - s, 0, None) * 25)
    ph = 2*np.pi*np.cumsum(f) / SR
    mix += gain * (0.8 * np.sin(ph) * env(s, .003, .35) + 0.35 * noise * env(s, .001, .05))

for s in (3.0, 4.6, 6.3):
    hit(s)
hit(5.0, 0.7)  # grade stamp

# clock ticks (3.0-4.6s)
for k in range(7):
    s = 3.05 + k * 0.25
    mix += 0.35 * np.sin(2*np.pi*2400*t) * env(s, .001, .012)

# heartbeat in the friends shot
for s in (6.6, 6.85, 7.3, 7.55):
    mix += 0.6 * np.sin(2*np.pi*50*t) * env(s, .005, .09)

# 8s: phone set down (soft thud) + reverse swell into pad
mix += 0.5 * np.sin(2*np.pi*90*t) * env(8.6, .005, .08)
swell = np.clip((t - 7.6) / 0.5, 0, 1) * (t < 8.1)
mix += 0.15 * lowpass(noise, 30) * swell

# warm major pad (8.4-15s): C - G - Am - F, then C on the final card
chords = [(8.4, [261.6, 329.6, 392.0]), (9.4, [246.9, 293.7, 392.0]), (10.4, [220.0, 261.6, 329.6]),
          (11.2, [174.6, 220.0, 261.6]), (12.0, [261.6, 329.6, 392.0, 523.3])]
for i, (s, freqs) in enumerate(chords):
    e = (t >= s) * (t < (chords[i+1][0] if i + 1 < len(chords) else DUR))
    e = lowpass(e.astype(float), 2000)
    for f in freqs:
        mix += 0.07 * e * (np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*2*f*t) + 0.5*np.sin(2*np.pi*f/2*t))
mix *= np.where(t > 8.4, 1, 1)

# bright plucks on the beat from 9s
for k, s in enumerate(np.arange(9.0, 15.0, 0.5)):
    f = [523.3, 659.3, 784.0, 659.3][k % 4]
    mix += 0.12 * np.sin(2*np.pi*f*t) * env(s, .002, .18)

# pen scribbles (10-11.9s)
scr = lowpass(noise, 3) * (0.5 + 0.5*np.sign(np.sin(2*np.pi*7*t))) * window(10, 11.9, .05)
mix += 0.05 * scr

# final card hits
hit(12.0, 0.9)
hit(12.6, 1.0)
mix += 0.08 * lowpass(noise, 2) * env(12.0, .001, .4)

# fade out + normalize
mix *= np.clip((DUR - t) / 0.8, 0, 1)
mix /= np.max(np.abs(mix)) / 0.9
stereo = np.stack([mix, np.roll(mix, 300)], axis=1)
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
