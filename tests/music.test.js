import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundtrack } from '../music.js';
import { CombatSounds, EFFECT_NAMES } from '../sound-effects.js';

function context() {
  const gains = [], sources = [];
  return { currentTime: 12, state: 'running', destination: {}, gains, sources,
    async decodeAudioData() { return { duration: 40 }; },
    createGain() {
      const targets = [];
      const node = { gain: { value: 1, cancelScheduledValues() {}, setTargetAtTime(value) { targets.push(value); } }, connect() {}, disconnect() {}, targets };
      gains.push(node); return node;
    },
    createBufferSource() {
      const node = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, stop() { this.stopped = true; }, start(time) { this.started = time; } };
      sources.push(node); return node;
    }
  };
}
test('music waits for explicit start, loads once, loops and crossfades between city and boss', async () => {
  const original = globalThis.fetch, requests = [];
  globalThis.fetch = async url => { requests.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  try {
    const ctx = context(), music = new Soundtrack(ctx);
    music.setMood('boss'); assert.equal(requests.length, 0);
    await Promise.all([music.start(), music.start()]);
    assert.equal(requests.length, 2); assert.equal(ctx.sources.length, 2);
    assert.ok(ctx.sources.every(source => source.loop && source.started === 12.05));
    assert.equal(music.channels.city.gain.targets.at(-1), 0);
    assert.equal(music.channels.boss.gain.targets.at(-1), .55);
    music.setMood('city');
    assert.equal(music.channels.city.gain.targets.at(-1), .55);
    assert.equal(music.channels.boss.gain.targets.at(-1), 0);
    await music.start(); assert.equal(requests.length, 2);
  } finally { globalThis.fetch = original; }
});
test('a failed music request can retry without leaving duplicate playing sources', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const ctx = context(), music = new Soundtrack(ctx);
    await assert.rejects(music.start()); assert.equal(ctx.sources.length, 0);
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await music.start(); assert.equal(ctx.sources.length, 2);
  } finally { globalThis.fetch = original; }
});
test('combat clips load on demand, respect suspension, limit overlapping voices and release nodes', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  try {
    const ctx = context(), sounds = new CombatSounds(ctx);
    sounds.play('blade-hit'); assert.equal(requests, 0); assert.equal(ctx.sources.length, 0);
    await Promise.all([sounds.load(), sounds.load()]); assert.equal(requests, EFFECT_NAMES.length);
    ctx.state = 'suspended'; sounds.play('blade-hit'); assert.equal(ctx.sources.length, 0);
    ctx.state = 'running';
    for (let i = 0; i < 12; i++) sounds.play('armor-hit');
    assert.equal(sounds.voices.size, 8); assert.equal(ctx.sources.filter(source => source.stopped).length, 4);
    assert.ok(ctx.sources.every(source => source.playbackRate.value >= .97 && source.playbackRate.value <= 1.03));
    ctx.sources.at(-1).onended(); assert.equal(sounds.voices.size, 7);
    sounds.play('missing'); assert.equal(ctx.sources.length, 12);
  } finally { globalThis.fetch = original; }
});
