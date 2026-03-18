// ═══════════════════════════════════════
// LAYER 1 — VoiceSignalAnalyzer
// Perception module: Web Speech API + Web Audio API analysis
// Sends voice.signal intents via IntentLayer. Never imports Action Layer.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';

// ─── Public contract ─────────────────────────────────────────────────────────
export interface VoiceFeatures {
  pitch:       number;   // normalized 0–1 (fundamental frequency estimate)
  volume:      number;   // RMS amplitude 0–1
  variance:    number;   // pitch variance across utterance 0–1
  roughness:   number;   // spectral irregularity 0–1
  brightness:  number;   // high-frequency energy ratio 0–1
  speechRate:  number;   // syllables per second estimate 0–1
  pauseRatio:  number;   // silence fraction 0–1
  confidence:  number;   // browser recognition confidence 0–1
  transcript:  string;   // raw transcript
  duration:    number;   // ms
}

export interface VoiceSignalPayload {
  features:   VoiceFeatures;
  baselineDelta: {
    pitch:    number;   // deviation from personal baseline
    volume:   number;
    variance: number;
  };
  timestamp:  number;
}

// ─── Baseline calibration (per-session) ───────────────────────────────────────
interface Baseline {
  pitch:   number;
  volume:  number;
  variance: number;
  samples: number;
}

export class VoiceSignalAnalyzer {
  private intent:      IntentLayer;
  private audioCtx:    AudioContext | null = null;
  private analyser:    AnalyserNode  | null = null;
  private mediaStream: MediaStream   | null = null;
  private recognition: SpeechRecognition | null = null;

  private baseline: Baseline = { pitch: 0.5, volume: 0.4, variance: 0.3, samples: 0 };
  private isRecording = false;
  private sessionPitches:  number[] = [];
  private sessionVolumes:  number[] = [];
  private recordingStart = 0;

  // Audio analysis buffers
  private freqBuffer:  Uint8Array  | null = null;
  private timeBuffer:  Float32Array | null = null;
  private animFrameId: number | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;
  }

  // ─── Initialize audio context + speech recognition ─────────────────────────
  async initialize(): Promise<void> {
    // AudioContext — deferred until first user gesture
    try {
      this.audioCtx  = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser  = this.audioCtx.createAnalyser();
      this.analyser.fftSize        = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.freqBuffer  = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeBuffer  = new Float32Array(this.analyser.fftSize);
    } catch (e) {
      console.warn('[VoiceSignalAnalyzer] AudioContext unavailable:', e);
    }

    // SpeechRecognition
    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) {
      console.warn('[VoiceSignalAnalyzer] SpeechRecognition API not available');
      return;
    }

    this.recognition = new SR();
    this.recognition.continuous   = false;
    this.recognition.interimResults = false;
    this.recognition.lang         = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  // ─── Start recording session ──────────────────────────────────────────────
  async startRecording(): Promise<void> {
    if (this.isRecording) return;
    if (!this.recognition) await this.initialize();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.audioCtx && this.analyser && this.mediaStream) {
        const src = this.audioCtx.createMediaStreamSource(this.mediaStream);
        src.connect(this.analyser);
        this.isRecording = true;
        this.recordingStart = Date.now();
        this.sessionPitches = [];
        this.sessionVolumes = [];
        this.startAudioSampling();
      }
    } catch (e) {
      console.warn('[VoiceSignalAnalyzer] Microphone access denied:', e);
    }
  }

  // ─── Analyze live audio + transcript and emit intent ─────────────────────
  async analyze(transcript: string, confidence: number): Promise<void> {
    const duration = Date.now() - this.recordingStart;
    this.stopAudioSampling();

    const features = this.extractFeatures(transcript, confidence, duration);
    const baselineDelta = this.computeBaselineDelta(features);

    // Update running baseline (exponential moving average, min 3 samples)
    this.updateBaseline(features);

    const payload: VoiceSignalPayload = {
      features,
      baselineDelta,
      timestamp: Date.now()
    };

    await this.intent.send('voice.signal', payload);
  }

  // ─── Stop recording, run analysis ─────────────────────────────────────────
  stopRecording(): void {
    this.isRecording = false;
    this.stopAudioSampling();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }

  // ─── Internal: continuous audio frame sampling ───────────────────────────
  private startAudioSampling(): void {
    const sample = () => {
      if (!this.isRecording || !this.analyser || !this.freqBuffer || !this.timeBuffer) return;

      this.analyser.getByteFrequencyData(this.freqBuffer);
      this.analyser.getFloatTimeDomainData(this.timeBuffer);

      const rms = this.computeRMS(this.timeBuffer);
      const pitch = this.estimatePitch(this.timeBuffer, this.audioCtx?.sampleRate ?? 44100);

      this.sessionVolumes.push(rms);
      if (pitch > 0) this.sessionPitches.push(pitch);

      this.animFrameId = requestAnimationFrame(sample);
    };
    this.animFrameId = requestAnimationFrame(sample);
  }

  private stopAudioSampling(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // ─── Feature extraction from collected samples ───────────────────────────
  private extractFeatures(transcript: string, confidence: number, duration: number): VoiceFeatures {
    const pitches = this.sessionPitches;
    const volumes = this.sessionVolumes;

    const avgPitch  = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0.5;
    const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0.4;

    // Normalize pitch 85–300 Hz → 0–1
    const normPitch = Math.max(0, Math.min(1, (avgPitch - 85) / 215));

    // Pitch variance (standard deviation normalized)
    const pitchVariance = pitches.length > 1
      ? Math.sqrt(pitches.reduce((acc, p) => acc + Math.pow(p - avgPitch, 2), 0) / pitches.length) / 100
      : 0.2;

    // Roughness: zero-crossing rate approximation
    const roughness = this.freqBuffer
      ? this.computeSpectralRoughness(this.freqBuffer)
      : 0.2;

    // Brightness: energy above 2kHz
    const brightness = this.freqBuffer
      ? this.computeBrightness(this.freqBuffer, this.audioCtx?.sampleRate ?? 44100)
      : 0.3;

    // Speech rate: rough syllable count / duration
    const syllables = this.estimateSyllables(transcript);
    const speechRate = duration > 0 ? Math.min(1, (syllables / (duration / 1000)) / 5) : 0.5;

    // Pause ratio: silence frames where RMS < threshold
    const silenceThresh = 0.01;
    const pauseRatio = volumes.length > 0
      ? volumes.filter(v => v < silenceThresh).length / volumes.length
      : 0.2;

    return {
      pitch:      Math.max(0, Math.min(1, normPitch)),
      volume:     Math.max(0, Math.min(1, avgVolume)),
      variance:   Math.max(0, Math.min(1, pitchVariance)),
      roughness:  Math.max(0, Math.min(1, roughness)),
      brightness: Math.max(0, Math.min(1, brightness)),
      speechRate: Math.max(0, Math.min(1, speechRate)),
      pauseRatio: Math.max(0, Math.min(1, pauseRatio)),
      confidence: Math.max(0, Math.min(1, confidence)),
      transcript,
      duration
    };
  }

  private computeBaselineDelta(f: VoiceFeatures) {
    return {
      pitch:    f.pitch    - this.baseline.pitch,
      volume:   f.volume   - this.baseline.volume,
      variance: f.variance - this.baseline.variance
    };
  }

  private updateBaseline(f: VoiceFeatures): void {
    const n = this.baseline.samples;
    const alpha = n < 5 ? 0.5 : 0.1; // fast early learning
    this.baseline.pitch    = this.baseline.pitch    * (1 - alpha) + f.pitch    * alpha;
    this.baseline.volume   = this.baseline.volume   * (1 - alpha) + f.volume   * alpha;
    this.baseline.variance = this.baseline.variance * (1 - alpha) + f.variance * alpha;
    this.baseline.samples++;
  }

  // ─── DSP helpers ─────────────────────────────────────────────────────────
  private computeRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
  }

  /** Very lightweight pitch estimator using autocorrelation */
  private estimatePitch(buffer: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 300);
    const maxPeriod = Math.floor(sampleRate / 85);
    let bestPeriod = -1;
    let bestCorr = -Infinity;

    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      let corr = 0;
      for (let i = 0; i < buffer.length - lag; i++) {
        corr += buffer[i] * buffer[i + lag];
      }
      if (corr > bestCorr) { bestCorr = corr; bestPeriod = lag; }
    }

    if (bestPeriod <= 0 || bestCorr < 0.01) return 0;
    return sampleRate / bestPeriod; // Hz
  }

  private computeSpectralRoughness(freq: Uint8Array): number {
    // Sum of inter-bin differences normalized to 0–1
    let diff = 0;
    for (let i = 1; i < freq.length; i++) diff += Math.abs(freq[i] - freq[i - 1]);
    return Math.min(1, diff / (freq.length * 128));
  }

  private computeBrightness(freq: Uint8Array, sampleRate: number): number {
    const binHz    = sampleRate / (2 * freq.length);
    const threshold = Math.floor(2000 / binHz);
    let highEnergy = 0, total = 0;
    for (let i = 0; i < freq.length; i++) {
      total += freq[i];
      if (i >= threshold) highEnergy += freq[i];
    }
    return total > 0 ? highEnergy / total : 0;
  }

  private estimateSyllables(text: string): number {
    // Simple vowel-cluster count
    const matches = text.toLowerCase().match(/[aeiou]+/g);
    return matches ? matches.length : 1;
  }

  // ─── Expose SpeechRecognition for wiring in app.ts ───────────────────────
  getRecognition(): SpeechRecognition | null {
    return this.recognition;
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
