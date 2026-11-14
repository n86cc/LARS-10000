class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  getMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playRoll() {
    // Crisp multi-tap ivory dice rattle
    const taps = [0, 0.055, 0.11, 0.17, 0.24];
    taps.forEach((delay, idx) => {
      const baseFreq = 260 + idx * 45 + Math.random() * 60;
      this.tone(baseFreq, 0.05, 'triangle', 0.06, delay, baseFreq * 0.65);
    });
  }

  playSelect(selected: boolean) {
    this.tone(selected ? 560 : 420, 0.065, 'sine', 0.055, 0, selected ? 680 : 350);
  }

  playLock(isDoubling = false) {
    if (isDoubling) {
      this.tone(523.25, 0.11, 'triangle', 0.08, 0);
      this.tone(659.25, 0.13, 'triangle', 0.08, 0.06);
      this.tone(783.99, 0.18, 'triangle', 0.09, 0.12);
    } else {
      this.tone(440, 0.09, 'triangle', 0.07, 0, 587);
    }
  }

  playBank() {
    this.tone(523.25, 0.14, 'sine', 0.08, 0);
    this.tone(659.25, 0.16, 'sine', 0.08, 0.07);
    this.tone(783.99, 0.24, 'sine', 0.09, 0.14);
  }

  playFarkle() {
    this.tone(240, 0.16, 'sawtooth', 0.05, 0, 175);
    this.tone(165, 0.25, 'sawtooth', 0.05, 0.12, 110);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.tone(n, 0.24, 'triangle', 0.09, i * 0.09);
    });
  }
}

export const soundEngine = new SoundEngine();
