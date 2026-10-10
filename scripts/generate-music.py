"""Original procedural score. Authoring requires Python, NumPy, SciPy, and FFmpeg.

Brief: dark cyberpunk synthwave; Japanese-inspired pentatonic plucked strings,
deep taiko-like drums, warm detuned pads, restrained city rain atmosphere.
Two seamless instrumental loops, no samples or external recordings.
"""
from pathlib import Path
import json
import subprocess
import tempfile
import wave
import numpy as np
from scipy.signal import butter, sosfilt

RATE = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/assets/audio'
OUT.mkdir(parents=True, exist_ok=True)


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def score(name, bpm, battle=False):
    rng = np.random.default_rng(401 if battle else 2026)
    beat = 60 / bpm
    duration = 16 * 4 * beat
    count = round(duration * RATE)
    dry = np.zeros((count, 2), dtype=np.float32)
    wet = np.zeros_like(dry)

    def add(signal, at, level=1, pan=0, echo=False):
        # Wrap note releases into the beginning so the entire arrangement loops.
        indices = (round(at * RATE) + np.arange(len(signal))) % count
        target = wet if echo else dry
        target[indices, 0] += signal * level * np.sqrt((1 - pan) / 2)
        target[indices, 1] += signal * level * np.sqrt((1 + pan) / 2)

    def times(length):
        return np.arange(round(length * RATE)) / RATE

    def pluck(note, length=1.4, bright=False):
        t = times(length)
        f = hz(note)
        result = np.zeros_like(t)
        for harmonic in range(1, 13):
            result += np.sin(2 * np.pi * f * harmonic * t + .07 * harmonic) / harmonic ** (1 if bright else 1.45) * np.exp(-t * (3 + harmonic * .6))
        result += rng.normal(0, .12, len(t)) * np.exp(-t * 90)
        return np.tanh(result * .8) * np.minimum(t / .002, 1)

    def pad(notes, length):
        t = times(length)
        result = np.zeros_like(t)
        for note in notes:
            for detune in [-.09, .07]:
                f = hz(note + detune)
                for harmonic in range(1, 5):
                    result += np.sin(2 * np.pi * f * harmonic * t + .8 * harmonic) / harmonic ** 2
        envelope = np.minimum(t / .5, 1) * np.minimum((length - t) / .8, 1)
        return result * envelope / len(notes)

    def bass(note, length):
        t = times(length)
        phase = 2 * np.pi * hz(note) * t
        result = np.sin(phase) + .2 * np.sin(2 * phase) + .07 * np.sin(3 * phase)
        return result * np.minimum(t / .008, 1) * np.exp(-t * 4) * np.minimum((length - t) / .03, 1)

    def taiko(accent=1):
        t = times(.95)
        phase = 2 * np.pi * (48 * t + 45 * .045 * (1 - np.exp(-t / .045)))
        body = np.sin(phase) * np.exp(-t * 5)
        body += .28 * np.sin(2 * np.pi * 128 * t) * np.exp(-t * 11)
        body += .15 * np.sin(2 * np.pi * 183 * t) * np.exp(-t * 16)
        knock = sosfilt(butter(2, [600, 2700], btype='bandpass', fs=RATE, output='sos'), rng.normal(size=len(t)))
        return (body + knock * .22 * np.exp(-t * 35)) * np.minimum(t / .002, 1) * accent

    def kick():
        t = times(.5)
        phase = 2 * np.pi * (43 * t + 125 * .025 * (1 - np.exp(-t / .025)))
        return np.sin(phase) * np.exp(-t * 12) * np.minimum(t / .001, 1)

    def snare():
        t = times(.28)
        noise = sosfilt(butter(2, 1800, btype='highpass', fs=RATE, output='sos'), rng.normal(size=len(t)))
        return noise * np.exp(-t * 26) * .35 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 35) * .3

    def hat(open_hat=False):
        t = times(.19 if open_hat else .065)
        noise = sosfilt(butter(2, 7000, btype='highpass', fs=RATE, output='sos'), rng.normal(size=len(t)))
        return noise * np.exp(-t * (24 if open_hat else 70)) * np.minimum(t / .001, 1)

    roots = [38, 34, 43, 36]  # D minor / B-flat / G minor / C suspended.
    chords = [[62, 65, 69, 76], [58, 62, 65, 72], [55, 58, 62, 69], [60, 62, 67, 70]]
    # D / E-flat / G / A / C; an original, sparse Japanese-inspired motif.
    motifs = [[(0, 74), (1.5, 81), (2.5, 79)], [(1, 75), (2, 74), (3.25, 72)],
              [(.5, 79), (2, 81), (3, 84)], [(0, 81), (1.5, 79), (3, 74)]]
    for bar in range(16):
        at = bar * 4 * beat
        chord = (bar // 2) % 4
        add(pad(chords[chord], 4 * beat + .6), at, .12 if battle else .19, -.15, True)
        # Sixteen-bar variations keep both loops moving without a constant lead.
        groove = battle or bar % 8 >= 2
        for position in ([0, .75, 1.5, 2, 2.75, 3.5] if battle else [0, 1.5, 2.5, 3.25]):
            note = roots[chord] - 12 + (12 if position in [1.5, 3.5] else 0)
            add(bass(note, beat * .65), at + position * beat, .3 if battle else .23)
        for position in ([0, 1.5, 2, 3.5] if battle else [0, 2.5]):
            add(taiko(1 if position == 0 else .6), at + position * beat, .31 if battle else .17, -.15 if position == 0 else .25, True)
        if groove:
            for position in ([0, 1.75, 2, 2.75] if battle else [0, 2]):
                add(kick(), at + position * beat, .34 if battle else .23)
            for position in [1, 3]:
                add(snare(), at + position * beat, .20 if battle else .12, .1, True)
            for step in range(8):
                add(hat(step == 7), at + step * .5 * beat, (.045 if step % 2 else .025) * (1.3 if battle else 1), .35 if step % 2 else -.35)
        if battle or bar % 8 >= 4:
            for step in range(8 if battle else 4):
                note = chords[chord][step % 4] + (12 if step % 3 == 2 else 0)
                add(pluck(note, .6), at + step * (beat / 2 if battle else beat), .065 if battle else .04, np.sin(step * 1.2) * .6, True)
        if bar % 8 in [0, 1, 4, 5, 6]:
            for position, note in motifs[bar % 4]:
                add(pluck(note - (12 if battle else 0), 1.5, True), at + position * beat, .17 if battle else .14, -.2, True)
        if battle and bar % 4 == 3:
            for step in range(4):
                add(taiko(.25 + step * .07), at + (3 + step * .25) * beat, .2, (step % 2 - .5) * .5, True)

    # Stereo, tempo-locked circular delays and a restrained diffuse room tail.
    mixed = dry + wet
    for delay, gain in [(beat * .75, .24), (beat * 1.5, .12), (beat * 2.25, .06)]:
        mixed += np.roll(wet[:, ::-1], round(delay * RATE), axis=0) * gain
    for delay, gain in [(.071, .06), (.113, .045), (.173, .035), (.239, .025)]:
        mixed += np.roll(wet, round(delay * RATE), axis=0) * gain
    mixed -= mixed.mean(axis=0)
    mixed = np.tanh(mixed * 1.2)
    mixed *= min(.89 / np.abs(mixed).max(), .14 / np.sqrt(np.mean(mixed ** 2)))
    pcm = np.int16(np.clip(mixed, -1, 1) * 32767)
    with tempfile.TemporaryDirectory() as temporary:
        wav = Path(temporary) / 'score.wav'
        with wave.open(str(wav), 'wb') as output:
            output.setnchannels(2); output.setsampwidth(2); output.setframerate(RATE); output.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                        '-codec:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', str(OUT / f'{name}.mp3')], check=True)
    return {'file': f'{name}.mp3', 'bpm': bpm, 'bars': 16, 'loop_seconds': duration,
            'peak_dbfs': round(float(20 * np.log10(np.abs(mixed).max())), 2),
            'rms_dbfs': round(float(20 * np.log10(np.sqrt(np.mean(mixed ** 2)))), 2)}


if __name__ == '__main__':
    tracks = [score('rainline-after-hours', 96), score('six-gates-of-steel', 120, True)]
    metadata = {'title': 'Neon Ronin original score', 'method': 'Original procedural synthesis; no external samples or recordings.',
                'style': 'Dark cyberpunk synthwave with taiko-like percussion, pentatonic plucked strings, analog bass and detuned pads.',
                'sample_rate': RATE, 'tracks': tracks}
    (OUT / 'score.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata, indent=2))
