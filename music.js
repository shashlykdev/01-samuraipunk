export const MUSIC_TRACKS = {
  city: './assets/audio/rainline-after-hours.mp3',
  boss: './assets/audio/six-gates-of-steel.mp3'
};

// Both buffers loop in Web Audio, avoiding HTML audio gaps on phones.
export class Soundtrack {
  constructor(context, destination = context.destination) {
    this.context = context; this.destination = destination;
    this.mood = 'city'; this.channels = null; this.loading = null;
  }
  async start() {
    if (this.channels) return;
    if (!this.loading) {
      this.loading = Promise.all(Object.entries(MUSIC_TRACKS).map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${name} music.`);
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        return [name, buffer];
      })).then(tracks => {
        const start = this.context.currentTime + .05;
        this.channels = Object.fromEntries(tracks.map(([name, buffer]) => {
          const source = this.context.createBufferSource(), gain = this.context.createGain();
          source.buffer = buffer; source.loop = true; gain.gain.value = 0;
          source.connect(gain); gain.connect(this.destination); source.start(start);
          return [name, { source, gain }];
        }));
        this.fadeToMood();
      }).catch(error => { this.loading = null; throw error; });
    }
    await this.loading;
  }
  setMood(mood) {
    if (!Object.hasOwn(MUSIC_TRACKS, mood) || mood === this.mood) return;
    this.mood = mood; this.fadeToMood();
  }
  fadeToMood() {
    if (!this.channels) return;
    const now = this.context.currentTime;
    for (const [name, { gain }] of Object.entries(this.channels)) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(name === this.mood ? .55 : 0, now, .4);
    }
  }
}
