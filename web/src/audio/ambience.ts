// Bridge ambience: the original Star Trek audio was removed from the repo
// (only 4 KB SoundCue stubs remain), so synthesize a warp-core style hum:
// filtered brown noise + a low sine drone.
export class Ambience {
  private ctx: AudioContext | null = null;

  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // gentle fade-in
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);

    // brown noise loop
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 140;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.18;
    noise.connect(lowpass).connect(noiseGain).connect(master);
    noise.start();

    // low engine drone with a slow beat between two detuned sines
    for (const [freq, gain] of [
      [48, 0.025],
      [48.4, 0.02],
      [96, 0.008],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(master);
      osc.start();
    }
  }
}
