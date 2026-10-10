"""Synthesize original combat Foley; requires NumPy, SciPy, and FFmpeg."""
from pathlib import Path
import json
import subprocess
import tempfile
import wave
import numpy as np
from scipy.signal import butter, sosfilt

RATE = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/assets/audio/sfx'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(81026)


def noise(t, low, high):
    return sosfilt(butter(2, [low, high], btype='bandpass', fs=RATE, output='sos'), rng.normal(size=len(t)))


def thud(t, strength=1):
    phase = 2 * np.pi * (48 * t + 70 * .035 * (1 - np.exp(-t / .035)))
    return strength * (np.sin(phase) * np.exp(-t * 13) + noise(t, 80, 1200) * np.exp(-t * 35) * .18)


def metal(t, length=.2):
    signal = np.zeros_like(t)
    for i, freq in enumerate([880, 1417, 2139, 3171]):
        signal += np.sin(2 * np.pi * freq * t + i) * np.exp(-t * (1 / length + i * 12)) / (i + 1)
    return signal * .23 + noise(t, 1800, 5000) * np.exp(-t * 100) * .025


def swish(t, weight=1):
    position = t / max(t[-1], .001)
    envelope = np.sin(np.pi * position) ** 2
    # A brief low-mid air movement replaces the harsh, sustained high-frequency scrape.
    air = noise(t, 300, 1700) * .13 + noise(t, 1700, 4000) * .025
    phase = 2 * np.pi * (130 * t + 240 * .018 * (1 - np.exp(-t / .018)))
    body = np.sin(phase) * .22 * weight
    return (air + body) * envelope


def effect(name, duration):
    t = np.arange(round(duration * RATE)) / RATE
    if name.startswith('katana'):
        signal = swish(t, 1.1 if name.endswith('finisher') else .7)
        if name.endswith('draw'): signal += metal(t, .045) * .12
    elif name == 'blade-hit': signal = metal(t, .10) * .6 + thud(t) * .5
    elif name == 'armor-hit': signal = metal(t, .25) + thud(t) * .35
    elif name == 'heavy-impact': signal = thud(t, 1.3) + metal(t, .16) * .8
    elif name == 'hurt': signal = thud(t) + noise(t, 100, 900) * np.exp(-t * 12) * .15
    elif name == 'dodge': signal = swish(t, 1.5) * .7
    elif name == 'land': signal = thud(t) * .7 + noise(t, 1500, 5000) * np.exp(-t * 50) * .05
    elif name == 'enemy-fall': signal = thud(t) + noise(t, 200, 2000) * np.exp(-t * 18) * .04
    elif name == 'boss-slam': signal = thud(t, 1.4) + metal(t, .08) * .2 + noise(t, 100, 1900) * np.exp(-t * 8) * .08
    elif name == 'boss-enter':
        signal = thud(t, 1.3) + .3 * np.sin(2 * np.pi * 73.42 * t) * np.exp(-t * 3)
        signal += .09 * np.sin(2 * np.pi * 311.13 * t) * np.exp(-t * 2)
    else:  # Original three-note victory chime above a low drum.
        signal = thud(t) * .6
        for at, freq in [(0, 587.33), (.17, 880), (.34, 1174.66)]:
            shifted = np.maximum(t - at, 0)
            signal += (t >= at) * np.sin(2 * np.pi * freq * shifted) * np.exp(-shifted * 4) * .2
    signal *= np.minimum(t / .0015, 1) * np.minimum((duration - t) / .025, 1)
    signal -= signal.mean()
    signal = np.tanh(signal * 1.15)
    peak = .30 if name.startswith('katana') else .24 if name == 'dodge' else .60 if name in ['blade-hit', 'armor-hit'] else .78
    signal *= peak / max(np.max(np.abs(signal)), .001)
    # A short stereo room tail keeps metal distinct from the dry sword swishes.
    stereo = np.column_stack([signal, signal]).astype(np.float32)
    if 'hit' in name or name in ['heavy-impact', 'boss-slam', 'boss-defeat']:
        for delay, gain in [(.023, .08), (.041, .05)]:
            samples = round(delay * RATE)
            stereo[samples:, 1] += signal[:-samples] * gain
    stereo *= min(1, .87 / np.max(np.abs(stereo)))
    with tempfile.TemporaryDirectory() as directory:
        wav = Path(directory) / 'effect.wav'
        with wave.open(str(wav), 'wb') as output:
            output.setnchannels(2); output.setsampwidth(2); output.setframerate(RATE)
            output.writeframes(np.int16(stereo * 32767).tobytes())
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                        '-codec:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '-1', str(OUT / f'{name}.mp3')], check=True)
    return {'file': f'{name}.mp3', 'seconds': duration}


if __name__ == '__main__':
    specs = [('katana-draw', .20), ('katana-return', .18), ('katana-finisher', .26),
             ('blade-hit', .26), ('armor-hit', .42), ('heavy-impact', .48),
             ('hurt', .38), ('dodge', .28), ('land', .22), ('enemy-fall', .42),
             ('boss-enter', 1.15), ('boss-slam', .65), ('boss-defeat', 1.6)]
    result = {'method': 'Original procedural synthesis; no external samples or recordings.',
              'sample_rate': RATE, 'effects': [effect(name, duration) for name, duration in specs]}
    (OUT / 'effects.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'Generated {len(specs)} original combat sound effects.')
