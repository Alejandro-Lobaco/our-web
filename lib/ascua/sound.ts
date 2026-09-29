/**
 * Sonido sintetizado con Web Audio: nada se descarga.
 * Solo suena tras un gesto del usuario (activar sonido o mantener para encender).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private flameGain: GainNode | null = null;
  enabled = false;

  unlock() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.out = ctx.createGain();
      this.out.gain.value = this.enabled ? 0.9 : 0;
      this.out.connect(comp).connect(ctx.destination);

      const len = ctx.sampleRate;
      this.white = ctx.createBuffer(1, len, ctx.sampleRate);
      const w = this.white.getChannelData(0);
      for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;

      // Rumor continuo de la llama: ruido marrón en bucle, filtrado.
      const brown = ctx.createBuffer(1, len * 2, ctx.sampleRate);
      const b = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < b.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        b[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = brown;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 520;
      this.flameGain = ctx.createGain();
      this.flameGain.gain.value = 0;
      src.connect(lp).connect(this.flameGain).connect(this.out);
      src.start();
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.unlock();
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.04);
  }

  private ready() {
    return this.enabled && this.ctx && this.out && this.white && this.ctx.state === "running";
  }

  private noise(t0: number, dur: number, type: BiquadFilterType, freq: number, q: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
    return { f, g };
  }

  private ping(t0: number, freq: number, gain: number, decay: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.01);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g).connect(this.out!);
    o.start(t0);
    o.stop(t0 + decay + 0.05);
  }

  /** El "clinc" de la tapa al abrirse: parciales inarmónicos de metal fino. */
  clink() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime + 0.01;
    this.noise(t, 0.03, "bandpass", 5200, 1.2, 0.35);
    [
      [2710, 0.14, 0.6],
      [4230, 0.09, 0.42],
      [5620, 0.06, 0.3],
      [7480, 0.035, 0.2],
    ].forEach(([f, g, d]) => this.ping(t, f, g, d));
  }

  /** Cierre: golpe seco más grave. */
  clack() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime + 0.01;
    this.noise(t, 0.05, "lowpass", 2400, 0.7, 0.5);
    this.ping(t, 1180, 0.1, 0.12);
    this.ping(t, 1960, 0.05, 0.08);
  }

  /** Rueda contra piedra: ráfaga granulada. */
  rasp() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.01;
    const { g } = this.noise(t, 0.22, "bandpass", 3100, 0.9, 0.5);
    const curve = new Float32Array(48);
    for (let i = 0; i < curve.length; i++) curve[i] = (0.25 + Math.random() * 0.75) * (1 - i / curve.length);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueCurveAtTime(curve, t, 0.2);
  }

  /** Ignición: soplo grave que se abre. */
  whoomp() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const { f, g } = this.noise(t, 0.5, "lowpass", 180, 0.6, 0.5);
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(1300, t + 0.22);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  }

  setFlame(level: number) {
    if (!this.ctx || !this.flameGain) return;
    this.flameGain.gain.setTargetAtTime(this.enabled ? level * 0.07 : 0, this.ctx.currentTime, 0.08);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
