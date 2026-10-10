export const EFFECT_NAMES = ['katana-draw', 'katana-return', 'katana-finisher', 'blade-hit', 'armor-hit',
  'heavy-impact', 'hurt', 'dodge', 'land', 'enemy-fall', 'boss-enter', 'boss-slam', 'boss-defeat'];

export class CombatSounds {
  constructor(context, destination = context.destination) {
    this.context = context; this.destination = destination;
    this.buffers = null; this.loading = null; this.voices = new Set();
  }
  async load() {
    if (this.buffers) return;
    if (!this.loading) this.loading = Promise.all(EFFECT_NAMES.map(async name => {
      const response = await fetch(`./assets/audio/sfx/${name}.mp3`);
      if (!response.ok) throw new Error(`Could not load ${name}.`);
      return [name, await this.context.decodeAudioData(await response.arrayBuffer())];
    })).then(entries => { this.buffers = Object.fromEntries(entries); })
      .catch(error => { this.loading = null; throw error; });
    await this.loading;
  }
  play(name, volume = 1) {
    if (!this.buffers?.[name] || this.context.state !== 'running') return;
    if (this.voices.size >= 8) { const oldest = this.voices.values().next().value; oldest.stop(); this.voices.delete(oldest); }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers[name]; source.playbackRate.value = .97 + Math.random() * .06;
    gain.gain.value = .52 * volume; source.connect(gain); gain.connect(this.destination);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }
}
