/**
 * Deep Focus v2.0 - Procedural Audio Synthesizer Engine
 */
import store from '../state/store.js';

let audioCtx = null;
let masterGainNode = null;
let eqBands = []; // Array of BiquadFilterNodes for the 5-band EQ
let analyserNode = null;

// G.O.A.T. Binaural and Solfeggio node references
let binauralOscL = null;
let binauralOscR = null;
let binauralGainL = null;
let binauralGainR = null;
let binauralPannerL = null;
let binauralPannerR = null;
let solfeggioOsc = null;
let solfeggioGain = null;

// Buffers for noise sources
let whiteNoiseBuffer = null;
let pinkNoiseBuffer = null;
let brownNoiseBuffer = null;

// Helper: Get or initialize AudioContext
export function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setupMasterChain();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Master output chain: Source -> EQ (5 bands) -> Master Gain -> Analyser -> Output
function setupMasterChain() {
  const ctx = audioCtx;

  // 1. Create Analyser (placed before final output for visualizer)
  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 256;

  // 2. Create Master Gain
  masterGainNode = ctx.createGain();
  masterGainNode.gain.value = 0.7; // matches store default

  // 3. Create 5-Band Equalizer filters
  // Frequencies: 60Hz (Low Shelf), 250Hz (Peaking), 1000Hz (Peaking), 4000Hz (Peaking), 16000Hz (High Shelf)
  const freqs = [60, 250, 1000, 4000, 16000];
  const types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
  const qs = [1, 1.2, 1.2, 1.2, 1];

  const currentEq = store.getState().audio.eq;
  eqBands = freqs.map((freq, i) => {
    const filter = ctx.createBiquadFilter();
    filter.type = types[i];
    filter.frequency.value = freq;
    filter.Q.value = qs[i];
    filter.gain.value = currentEq[i] !== undefined ? currentEq[i] : 0;
    return filter;
  });

  // Connect EQ filters in series
  for (let i = 0; i < eqBands.length - 1; i++) {
    eqBands[i].connect(eqBands[i + 1]);
  }

  // 4. Create master dynamics compressor to prevent clipping and balance output on speakers
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, ctx.currentTime);
  compressor.knee.setValueAtTime(12, ctx.currentTime);
  compressor.ratio.setValueAtTime(2.5, ctx.currentTime);
  compressor.attack.setValueAtTime(0.02, ctx.currentTime);
  compressor.release.setValueAtTime(0.25, ctx.currentTime);

  // Connect EQ Chain -> Compressor -> Master Gain -> Analyser -> Destination
  eqBands[eqBands.length - 1].connect(compressor);
  compressor.connect(masterGainNode);
  masterGainNode.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  // Prefill noise buffers
  generateNoiseBuffers(ctx);
}

export function getAnalyserNode() {
  return analyserNode;
}

export function updateMasterVolume(volume) {
  if (!masterGainNode) return;
  masterGainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
}

export function fadeMasterVolume(targetVolume, durationSeconds) {
  if (!masterGainNode || !audioCtx) return Promise.resolve();
  
  return new Promise((resolve) => {
    const startVal = masterGainNode.gain.value;
    const startTime = audioCtx.currentTime;
    
    masterGainNode.gain.cancelScheduledValues(startTime);
    masterGainNode.gain.setValueAtTime(startVal, startTime);
    masterGainNode.gain.linearRampToValueAtTime(targetVolume, startTime + durationSeconds);
    
    setTimeout(resolve, durationSeconds * 1000);
  });
}

export function playCompletionChime(type) {
  if (!audioCtx) return;
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  
  if (type === 'tibetan-bowl') {
    const fund = 180;
    const harmonics = [fund, fund * 1.52, fund * 2.06, fund * 2.76, fund * 3.12];
    const gains = [0.4, 0.25, 0.18, 0.12, 0.08];
    const decay = 6.0;

    harmonics.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((Math.random() * 2 - 1) * 8, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gains[idx] * 0.5, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + decay);
    });

  } else if (type === 'soft-bell') {
    const fund = 880;
    const decay = 3.0;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fund, now);
    osc.frequency.exponentialRampToValueAtTime(fund * 0.99, now + decay);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + decay);

    const overtone = audioCtx.createOscillator();
    const overtoneGain = audioCtx.createGain();
    
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(fund * 2.2, now);
    
    overtoneGain.gain.setValueAtTime(0, now);
    overtoneGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    overtone.connect(overtoneGain);
    overtoneGain.connect(audioCtx.destination);
    
    overtone.start(now);
    overtone.stop(now + 1.5);

  } else if (type === 'digital-chime') {
    const baseFreq = 523.25;
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2.0];
    
    notes.forEach((freq, idx) => {
      const timeOffset = idx * 0.12;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 0.7, now + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(freq, now + timeOffset + 0.08);

      gainNode.gain.setValueAtTime(0, now + timeOffset);
      gainNode.gain.linearRampToValueAtTime(0.18, now + timeOffset + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.6);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.7);
    });
  }
}

export function updateEqBand(index, gainDb) {
  if (eqBands[index]) {
    eqBands[index].gain.setTargetAtTime(gainDb, audioCtx.currentTime, 0.1);
  }
}

// Generate Noise Buffers mathematically to save memory and ensure high quality
function generateNoiseBuffers(ctx) {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of audio

  // 1. White Noise Buffer
  whiteNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const whiteData = whiteNoiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    whiteData[i] = Math.random() * 2 - 1;
  }

  // 2. Pink Noise Buffer (Kellet filter approximation)
  pinkNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const pinkData = pinkNoiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    pinkData[i] = pink * 0.11; // scale to prevent clipping
  }

  // 3. Brown Noise Buffer (Integrator filter approximation)
  brownNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const brownData = brownNoiseBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    brownData[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = brownData[i];
    brownData[i] *= 3.5; // scale to fit
  }
}

// ==========================================================================
// Ambient Generator Classes
// ==========================================================================

class AmbientSound {
  constructor() {
    this.source = null;
    this.gainNode = null;
    this.pannerNode = null;
    this.active = false;
    this.currentVol = 0.5;
    this.currentPan = 0.0;
    this.currentPitch = 1.0;
  }

  setupBaseChain() {
    const ctx = getAudioContext();
    this.gainNode = ctx.createGain();
    this.pannerNode = ctx.createStereoPanner();
    
    // Connect generator channels -> EQ input (first band)
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(eqBands[0]);

    this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
    this.pannerNode.pan.setValueAtTime(this.currentPan, ctx.currentTime);
  }

  fadeIn() {
    const ctx = getAudioContext();
    this.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.currentVol, ctx.currentTime + 2.0); // 2 sec fade in
  }

  fadeOut(callback) {
    const ctx = getAudioContext();
    this.gainNode.gain.cancelScheduledValues(ctx.currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5); // 1.5 sec fade out
    setTimeout(() => {
      if (callback) callback();
    }, 1600);
  }

  setVolume(vol) {
    this.currentVol = vol;
    if (this.active && this.gainNode) {
      const ctx = getAudioContext();
      this.gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
    }
  }

  setPan(pan) {
    this.currentPan = pan;
    if (this.active && this.pannerNode) {
      const ctx = getAudioContext();
      this.pannerNode.pan.setTargetAtTime(pan, ctx.currentTime, 0.15);
    }
  }

  setPitch(pitch) {
    this.currentPitch = pitch;
    if (this.active && this.source && this.source.playbackRate) {
      const ctx = getAudioContext();
      this.source.playbackRate.setTargetAtTime(pitch, ctx.currentTime, 0.2);
    }
  }
}

// 1. White Noise Synth
class WhiteNoiseSynth extends AmbientSound {
  start() {
    this.active = true;
    this.setupBaseChain();
    
    const ctx = getAudioContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = whiteNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch;

    this.source.connect(this.gainNode);
    this.source.start(0);
    this.fadeIn();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.pannerNode) {
        this.pannerNode.disconnect();
        this.pannerNode = null;
      }
    });
  }
}

// 2. Wind Synth (Noise modulated with random-walk filter LFO)
class WindSynth extends AmbientSound {
  constructor() {
    super();
    this.filterNode = null;
    this.lfo = null;
    this.lfoGain = null;
  }

  start() {
    this.active = true;
    this.setupBaseChain();

    const ctx = getAudioContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = pinkNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch;

    // Wind filter
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'bandpass';
    this.filterNode.Q.value = 2.5; // Resonant wind whistle
    this.filterNode.frequency.value = 450;

    // Modulate filter freq with LFO
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.08; // slow swelling gusts
    
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 250; // Sweeping range

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filterNode.frequency);

    // Chain: Source -> Filter -> GainNode -> PanNode -> EQ
    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);

    this.source.start(0);
    this.lfo.start(0);
    this.fadeIn();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfo = null;
      }
      if (this.lfoGain) this.lfoGain.disconnect();
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    });
  }
}

// 3. Rain Synth (Swelling noise background + scheduled droplet micro-bursts)
class RainSynth extends AmbientSound {
  constructor() {
    super();
    this.filterNode = null;
    this.dropletInterval = null;
  }

  start() {
    this.active = true;
    this.setupBaseChain();

    const ctx = getAudioContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = pinkNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch;

    // Lowpass filter for muffled rain background
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 1100;

    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);

    this.source.start(0);
    this.fadeIn();

    // Start procedural droplet generation loop
    this.scheduleDroplets();
  }

  scheduleDroplets() {
    const ctx = getAudioContext();
    
    // Dynamic rain droplet triggers
    this.dropletInterval = setInterval(() => {
      if (!this.active) return;

      // Number of droplets based on current volume setting
      const rate = Math.round(this.currentVol * 6);
      for (let i = 0; i < rate; i++) {
        if (Math.random() > 0.4) continue; // Random jitter spacing

        // Tiny delay inside scheduling window
        const delay = Math.random() * 0.25;
        const now = ctx.currentTime + delay;

        // Droplet transient generator
        const dropSrc = ctx.createBufferSource();
        dropSrc.buffer = whiteNoiseBuffer;

        const dropFilter = ctx.createBiquadFilter();
        dropFilter.type = 'highpass';
        // Randomize pitch/surface sound
        dropFilter.frequency.value = 4000 + Math.random() * 3500;

        const dropGain = ctx.createGain();
        // Droplet envelope (exponential decay)
        dropGain.gain.setValueAtTime(0.0001, now);
        dropGain.gain.linearRampToValueAtTime(0.015 * Math.random(), now + 0.001);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01 + Math.random() * 0.02);

        // Pan droplets randomly across stereo field
        const dropPanner = ctx.createStereoPanner();
        dropPanner.pan.setValueAtTime(this.currentPan + (Math.random() * 0.4 - 0.2), now);

        // Connections
        dropSrc.connect(dropFilter);
        dropFilter.connect(dropGain);
        dropGain.connect(dropPanner);
        dropPanner.connect(eqBands[0]); // to EQ

        dropSrc.start(now);
        dropSrc.stop(now + 0.1);
      }
    }, 200);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    if (this.dropletInterval) {
      clearInterval(this.dropletInterval);
      this.dropletInterval = null;
    }

    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    });
  }
}

// 4. Waves Synth (Swells in volume and filter cutoff)
class WavesSynth extends AmbientSound {
  constructor() {
    super();
    this.filterNode = null;
    this.lfo = null;
    this.lfoGain = null;
    this.lfoVolume = null;
  }

  start() {
    this.active = true;
    this.setupBaseChain();

    const ctx = getAudioContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = brownNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch;

    // Resonant lowpass for wave crashing sound
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 400;

    // Slow LFO for wave periods
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.06; // ~16 seconds per wave cycle

    // LFO controls filter frequency
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 350; // sweep between 150Hz and 850Hz

    // LFO controls sub-gain (to simulate ocean swell drawing back)
    this.lfoVolume = ctx.createGain();
    this.lfoVolume.gain.value = 0.25;

    // Wire up LFO modulations
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filterNode.frequency);

    this.lfo.connect(this.lfoVolume);
    this.lfoVolume.connect(this.gainNode.gain); // modulates primary channel gain

    // Chain: Source -> Filter -> GainNode -> PanNode -> EQ
    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);

    this.source.start(0);
    this.lfo.start(0);
    this.fadeIn();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfo = null;
      }
      if (this.lfoGain) this.lfoGain.disconnect();
      if (this.lfoVolume) this.lfoVolume.disconnect();
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    });
  }
}

// 5. Fire Synth (Low rumble + scheduled highpass crackles)
class FireSynth extends AmbientSound {
  constructor() {
    super();
    this.filterNode = null;
    this.crackleInterval = null;
  }

  start() {
    this.active = true;
    this.setupBaseChain();

    const ctx = getAudioContext();
    // Brown noise for soft fireplace rumble
    this.source = ctx.createBufferSource();
    this.source.buffer = brownNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch * 0.9;

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 160;

    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);

    this.source.start(0);
    this.fadeIn();

    // Start fireplace pop/crackle synthesis loop
    this.scheduleCrackles();
  }

  scheduleCrackles() {
    const ctx = getAudioContext();

    this.crackleInterval = setInterval(() => {
      if (!this.active) return;

      const density = Math.round(this.currentVol * 8);
      for (let i = 0; i < density; i++) {
        if (Math.random() > 0.45) continue;

        const now = ctx.currentTime + Math.random() * 0.15;

        // Crackle pop node (very short bandpassed noise impulse)
        const popSrc = ctx.createBufferSource();
        popSrc.buffer = whiteNoiseBuffer;

        const popFilter = ctx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.value = 1500 + Math.random() * 4000;
        popFilter.Q.value = 5;

        const popGain = ctx.createGain();
        popGain.gain.setValueAtTime(0.0001, now);
        popGain.gain.linearRampToValueAtTime(0.04 * Math.random(), now + 0.0005);
        popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004 + Math.random() * 0.008);

        const popPanner = ctx.createStereoPanner();
        popPanner.pan.setValueAtTime(this.currentPan + (Math.random() * 0.3 - 0.15), now);

        popSrc.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(popPanner);
        popPanner.connect(eqBands[0]);

        popSrc.start(now);
        popSrc.stop(now + 0.05);

        // Occasional deep wooden thuds (wood crack splitting)
        if (Math.random() > 0.88) {
          const thudOsc = ctx.createOscillator();
          thudOsc.type = 'sine';
          thudOsc.frequency.setValueAtTime(80 + Math.random() * 60, now);
          thudOsc.frequency.exponentialRampToValueAtTime(20, now + 0.05);

          const thudGain = ctx.createGain();
          thudGain.gain.setValueAtTime(0.08 * Math.random(), now);
          thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

          thudOsc.connect(thudGain);
          thudGain.connect(eqBands[0]);

          thudOsc.start(now);
          thudOsc.stop(now + 0.08);
        }
      }
    }, 180);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    if (this.crackleInterval) {
      clearInterval(this.crackleInterval);
      this.crackleInterval = null;
    }

    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    });
  }
}

// 6. Coffee Shop Synth (Crowd babble + sparse dish clanks)
class CoffeeShopSynth extends AmbientSound {
  constructor() {
    super();
    this.filterNode = null;
    this.clankInterval = null;
  }

  start() {
    this.active = true;
    this.setupBaseChain();

    const ctx = getAudioContext();
    // Pink noise bandpassed around voice spectrum for crowd hum
    this.source = ctx.createBufferSource();
    this.source.buffer = pinkNoiseBuffer;
    this.source.loop = true;
    this.source.playbackRate.value = this.currentPitch * 0.95;

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'peaking';
    this.filterNode.frequency.value = 350;
    this.filterNode.Q.value = 1.0;
    this.filterNode.gain.value = 6;

    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);

    this.source.start(0);
    this.fadeIn();

    // Start coffee shop clanks/clatters simulation
    this.scheduleClanks();
  }

  scheduleClanks() {
    const ctx = getAudioContext();

    this.clankInterval = setInterval(() => {
      if (!this.active) return;

      // Occasional clank of mugs/plates (average once every 4 seconds)
      if (Math.random() > 0.85) {
        const now = ctx.currentTime;
        
        // High frequency ceramic ring (ringing metallic sine waves)
        const ring1 = ctx.createOscillator();
        const ring2 = ctx.createOscillator();
        
        ring1.type = 'sine';
        ring2.type = 'sine';
        
        const f1 = 1200 + Math.random() * 1500;
        ring1.frequency.setValueAtTime(f1, now);
        ring2.frequency.setValueAtTime(f1 * 1.5, now); // harmonic ring

        const clankGain = ctx.createGain();
        clankGain.gain.setValueAtTime(0.0001, now);
        clankGain.gain.linearRampToValueAtTime(this.currentVol * 0.05 * Math.random(), now + 0.002);
        clankGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15 + Math.random() * 0.15);

        const clankPanner = ctx.createStereoPanner();
        clankPanner.pan.setValueAtTime(this.currentPan + (Math.random() * 0.6 - 0.3), now);

        ring1.connect(clankGain);
        ring2.connect(clankGain);
        clankGain.connect(clankPanner);
        clankPanner.connect(eqBands[0]);

        ring1.start(now);
        ring2.start(now);
        
        const duration = 0.4;
        ring1.stop(now + duration);
        ring2.stop(now + duration);
      }
    }, 600);
  }

  stop() {
    if (!this.active) return;
    this.active = false;

    if (this.clankInterval) {
      clearInterval(this.clankInterval);
      this.clankInterval = null;
    }

    this.fadeOut(() => {
      if (this.source) {
        this.source.stop();
        this.source.disconnect();
        this.source = null;
      }
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    });
  }
}

// 7. Keyboard Click Synth (Can play background click clicks, or respond to document typing!)
class KeyboardSynth extends AmbientSound {
  start() {
    this.active = true;
    this.setupBaseChain();
    this.fadeIn();

    // Start background random clicker (ambient focus noise)
    this.scheduleTicks();
  }

  scheduleTicks() {
    this.tickInterval = setInterval(() => {
      if (!this.active) return;
      // Random typing bursts
      if (Math.random() > 0.7) {
        const count = 1 + Math.floor(Math.random() * 3);
        let timeOffset = 0;
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            if (this.active) this.triggerSingleClick();
          }, timeOffset);
          timeOffset += 110 + Math.random() * 150;
        }
      }
    }, 1200);
  }

  triggerSingleClick() {
    if (!this.active) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const switchType = store.getState().audio.keyboardSwitch || 'blue';

    const keyPanner = ctx.createStereoPanner();
    keyPanner.pan.setValueAtTime(this.currentPan + (Math.random() * 0.3 - 0.15), now);
    keyPanner.connect(eqBands[0]);

    if (switchType === 'blue') {
      // Blue clicky: high pitched snap + low thock
      const thockOsc = ctx.createOscillator();
      thockOsc.type = 'sine';
      thockOsc.frequency.setValueAtTime(140 * this.currentPitch + Math.random() * 30, now);
      thockOsc.frequency.exponentialRampToValueAtTime(40, now + 0.03);

      const thockGain = ctx.createGain();
      thockGain.gain.setValueAtTime(this.currentVol * 0.15 * Math.random(), now);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = whiteNoiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.value = 5500 + Math.random() * 1500;
      clickFilter.Q.value = 6;

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(this.currentVol * 0.04 * Math.random(), now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      thockOsc.connect(thockGain);
      thockGain.connect(keyPanner);
      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(keyPanner);

      thockOsc.start(now);
      thockOsc.stop(now + 0.05);
      clickSrc.start(now);
      clickSrc.stop(now + 0.01);
    } 
    else if (switchType === 'brown') {
      // Brown tactile: tactile bump, warmer thock
      const thockOsc = ctx.createOscillator();
      thockOsc.type = 'sine';
      thockOsc.frequency.setValueAtTime(110 * this.currentPitch + Math.random() * 20, now);
      thockOsc.frequency.exponentialRampToValueAtTime(35, now + 0.04);

      const thockGain = ctx.createGain();
      thockGain.gain.setValueAtTime(this.currentVol * 0.18 * Math.random(), now);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = whiteNoiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.value = 2400 + Math.random() * 500;
      clickFilter.Q.value = 3;

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(this.currentVol * 0.02 * Math.random(), now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);

      thockOsc.connect(thockGain);
      thockGain.connect(keyPanner);
      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(keyPanner);

      thockOsc.start(now);
      thockOsc.stop(now + 0.06);
      clickSrc.start(now);
      clickSrc.stop(now + 0.02);
    } 
    else if (switchType === 'red') {
      // Red linear: muffled switch landing thud
      const thockOsc = ctx.createOscillator();
      thockOsc.type = 'sine';
      thockOsc.frequency.setValueAtTime(85 * this.currentPitch + Math.random() * 15, now);
      thockOsc.frequency.exponentialRampToValueAtTime(30, now + 0.035);

      const thockGain = ctx.createGain();
      thockGain.gain.setValueAtTime(this.currentVol * 0.22 * Math.random(), now);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = pinkNoiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'lowpass';
      clickFilter.frequency.value = 600;

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(this.currentVol * 0.015 * Math.random(), now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      thockOsc.connect(thockGain);
      thockGain.connect(keyPanner);
      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(keyPanner);

      thockOsc.start(now);
      thockOsc.stop(now + 0.05);
      clickSrc.start(now);
      clickSrc.stop(now + 0.01);
    } 
    else if (switchType === 'typewriter') {
      // Retro typewriter: metallic strike snap + body resonance ring
      const thockOsc = ctx.createOscillator();
      thockOsc.type = 'triangle';
      thockOsc.frequency.setValueAtTime(180 * this.currentPitch + Math.random() * 40, now);
      thockOsc.frequency.exponentialRampToValueAtTime(50, now + 0.04);

      const thockGain = ctx.createGain();
      thockGain.gain.setValueAtTime(this.currentVol * 0.16 * Math.random(), now);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = whiteNoiseBuffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.value = 3500 + Math.random() * 1000;
      clickFilter.Q.value = 8;

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(this.currentVol * 0.05 * Math.random(), now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      const ringOsc = ctx.createOscillator();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(820, now);
      const ringGain = ctx.createGain();
      ringGain.gain.setValueAtTime(this.currentVol * 0.018 * Math.random(), now);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      thockOsc.connect(thockGain);
      thockGain.connect(keyPanner);
      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(keyPanner);
      ringOsc.connect(ringGain);
      ringGain.connect(keyPanner);

      thockOsc.start(now);
      thockOsc.stop(now + 0.06);
      clickSrc.start(now);
      clickSrc.stop(now + 0.02);
      ringOsc.start(now);
      ringOsc.stop(now + 0.15);

      // Random bell carriage bell chime
      if (Math.random() > 0.94) {
        const bellOsc = ctx.createOscillator();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(2100, now + 0.05);
        const bellGain = ctx.createGain();
        bellGain.gain.setValueAtTime(0.0001, now + 0.05);
        bellGain.gain.linearRampToValueAtTime(this.currentVol * 0.08, now + 0.052);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        const bellPanner = ctx.createStereoPanner();
        bellPanner.pan.setValueAtTime(0.8, now + 0.05);

        bellOsc.connect(bellGain);
        bellGain.connect(bellPanner);
        bellPanner.connect(eqBands[0]);

        bellOsc.start(now + 0.05);
        bellOsc.stop(now + 0.5);
      }
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.fadeOut(() => {
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.pannerNode) {
        this.pannerNode.disconnect();
        this.pannerNode = null;
      }
    });
  }
}

// 8. Paper Rustle Synth
class PaperSynth extends AmbientSound {
  start() {
    this.active = true;
    this.setupBaseChain();
    this.fadeIn();

    this.scheduleRustles();
  }

  scheduleRustles() {
    this.rustleInterval = setInterval(() => {
      if (!this.active) return;
      
      // Rustle sheets of paper occasionally (once every 8-15 seconds)
      if (Math.random() > 0.88) {
        this.triggerSingleRustle();
      }
    }, 1500);
  }

  triggerSingleRustle() {
    if (!this.active) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Synthesize friction rustle using white noise with lowpass filter sweep
    const rustleSrc = ctx.createBufferSource();
    rustleSrc.buffer = whiteNoiseBuffer;
    rustleSrc.playbackRate.value = 0.85 + Math.random() * 0.3;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.45);
    filter.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(this.currentVol * 0.12 * Math.random(), now + 0.08);
    gain.gain.linearRampToValueAtTime(this.currentVol * 0.05, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    const rustlePanner = ctx.createStereoPanner();
    rustlePanner.pan.setValueAtTime(this.currentPan + (Math.random() * 0.4 - 0.2), now);

    rustleSrc.connect(filter);
    filter.connect(gain);
    gain.connect(rustlePanner);
    rustlePanner.connect(eqBands[0]);

    rustleSrc.start(now);
    rustleSrc.stop(now + 0.65);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    if (this.rustleInterval) {
      clearInterval(this.rustleInterval);
      this.rustleInterval = null;
    }

    this.fadeOut(() => {
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.pannerNode) {
        this.pannerNode.disconnect();
        this.pannerNode = null;
      }
    });
  }
}

// G.O.A.T. Binaural Beats Generator
export function updateBinauralBeats(active, frequency, carrier, volume) {
  if (!active && !binauralOscL) return; // Prevent early AudioContext warnings/blocks

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  if (active) {
    if (!binauralOscL) {
      binauralOscL = ctx.createOscillator();
      binauralOscR = ctx.createOscillator();
      
      binauralGainL = ctx.createGain();
      binauralGainR = ctx.createGain();
      
      binauralPannerL = ctx.createStereoPanner();
      binauralPannerR = ctx.createStereoPanner();
      
      binauralPannerL.pan.value = -1; // left channel
      binauralPannerR.pan.value = 1;  // right channel
      
      binauralOscL.connect(binauralGainL);
      binauralGainL.connect(binauralPannerL);
      binauralPannerL.connect(eqBands[0]);
      
      binauralOscR.connect(binauralGainR);
      binauralGainR.connect(binauralPannerR);
      binauralPannerR.connect(eqBands[0]);
      
      binauralOscL.start(now);
      binauralOscR.start(now);
    }
    
    binauralOscL.frequency.setTargetAtTime(carrier, now, 0.15);
    binauralOscR.frequency.setTargetAtTime(carrier + frequency, now, 0.15);
    
    binauralGainL.gain.setTargetAtTime(volume, now, 0.15);
    binauralGainR.gain.setTargetAtTime(volume, now, 0.15);
  } else {
    if (binauralOscL) {
      const gL = binauralGainL;
      const gR = binauralGainR;
      const oL = binauralOscL;
      const oR = binauralOscR;
      
      gL.gain.cancelScheduledValues(now);
      gR.gain.cancelScheduledValues(now);
      gL.gain.linearRampToValueAtTime(0, now + 1.0);
      gR.gain.linearRampToValueAtTime(0, now + 1.0);
      
      setTimeout(() => {
        try {
          oL.stop();
          oR.stop();
          oL.disconnect();
          oR.disconnect();
          gL.disconnect();
          gR.disconnect();
        } catch {}
      }, 1100);
      
      binauralOscL = null;
      binauralOscR = null;
      binauralGainL = null;
      binauralGainR = null;
      binauralPannerL = null;
      binauralPannerR = null;
    }
  }
}

// G.O.A.T. Solfeggio Frequency Tones Generator
export function updateSolfeggio(active, frequency, volume) {
  if (!active && !solfeggioOsc) return; // Prevent early AudioContext warnings/blocks

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  if (active) {
    if (!solfeggioOsc) {
      solfeggioOsc = ctx.createOscillator();
      solfeggioGain = ctx.createGain();
      
      solfeggioOsc.connect(solfeggioGain);
      solfeggioGain.connect(eqBands[0]);
      
      solfeggioOsc.start(now);
    }
    
    solfeggioOsc.frequency.setTargetAtTime(frequency, now, 0.15);
    solfeggioGain.gain.setTargetAtTime(volume, now, 0.15);
  } else {
    if (solfeggioOsc) {
      const g = solfeggioGain;
      const o = solfeggioOsc;
      
      g.gain.cancelScheduledValues(now);
      g.gain.linearRampToValueAtTime(0, now + 1.0);
      
      setTimeout(() => {
        try {
          o.stop();
          o.disconnect();
          g.disconnect();
        } catch {}
      }, 1100);
      
      solfeggioOsc = null;
      solfeggioGain = null;
    }
  }
}

// G.O.A.T. Generative Music Pad Synthesizer
class MusicPadSynth extends AmbientSound {
  constructor() {
    super();
    this.intervalId = null;
    this.activeOscillators = new Set();
  }

  start() {
    this.active = true;
    this.setupBaseChain();
    this.fadeIn();

    // Start chord scheduler loop
    this.scheduleMusic();
  }

  scheduleMusic() {
    const ctx = getAudioContext();
    
    // Generative chord progression in F major/pentatonic:
    // Fmaj7, Cmaj, Dmin7, Bbmaj7
    const chords = [
      [174.61, 220.00, 261.63, 329.63], // F Maj 7
      [130.81, 196.00, 261.63, 329.63], // C Maj
      [146.83, 220.00, 261.63, 349.23], // D Min 7
      [116.54, 174.61, 220.00, 293.66]  // Bb Maj 7
    ];
    
    let chordIndex = 0;
    
    const playChord = () => {
      if (!this.active) return;
      const now = ctx.currentTime;
      const freqSet = chords[chordIndex];
      chordIndex = (chordIndex + 1) % chords.length;
      
      const chordDuration = 10; // 10 seconds chord length
      const fadeTime = 4;       // 4 seconds crossfade
      
      // Synthesize each note in the chord
      freqSet.forEach((freq) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const lowpass = ctx.createBiquadFilter();
        
        osc.type = 'triangle'; // Warm pillowy texture
        osc.frequency.setValueAtTime(freq * this.currentPitch, now);
        
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(320, now); // Warm lowpass cutoff
        
        // Swell envelope
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(this.currentVol * 0.08, now + fadeTime);
        noteGain.gain.setValueAtTime(this.currentVol * 0.08, now + chordDuration - fadeTime);
        noteGain.gain.linearRampToValueAtTime(0.0001, now + chordDuration);
        
        osc.connect(lowpass);
        lowpass.connect(noteGain);
        noteGain.connect(this.gainNode);
        
        osc.start(now);
        osc.stop(now + chordDuration);
        
        this.activeOscillators.add(osc);
        
        setTimeout(() => {
          try {
            osc.disconnect();
            lowpass.disconnect();
            noteGain.disconnect();
            this.activeOscillators.delete(osc);
          } catch {}
        }, (chordDuration + 1) * 1000);
      });

      // Schedule high-pitched ringing bell melody chime occasionally
      if (Math.random() > 0.45) {
        const melodyNotes = [349.23, 392.00, 440.00, 523.25, 587.33, 698.46]; // F4 to F5 pentatonic
        const randomNote = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        
        const oscMelody = ctx.createOscillator();
        const melodyGain = ctx.createGain();
        const delay = Math.random() * 4 + 2; // delay inside chord loop
        
        oscMelody.type = 'sine'; // pure crystal tone
        oscMelody.frequency.setValueAtTime(randomNote * this.currentPitch, now + delay);
        
        melodyGain.gain.setValueAtTime(0.0001, now + delay);
        melodyGain.gain.linearRampToValueAtTime(this.currentVol * 0.05, now + delay + 0.6); // slow bell strike
        melodyGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 4.5); // long decay
        
        const bellPanner = ctx.createStereoPanner();
        bellPanner.pan.setValueAtTime(Math.random() * 1.6 - 0.8, now + delay);
        
        oscMelody.connect(melodyGain);
        melodyGain.connect(bellPanner);
        bellPanner.connect(this.gainNode);
        
        oscMelody.start(now + delay);
        oscMelody.stop(now + delay + 5.0);
        
        this.activeOscillators.add(oscMelody);
        
        setTimeout(() => {
          try {
            oscMelody.disconnect();
            melodyGain.disconnect();
            bellPanner.disconnect();
            this.activeOscillators.delete(oscMelody);
          } catch {}
        }, (delay + 6) * 1000);
      }
    };
    
    playChord();
    
    // Overlapping chords cycle
    this.intervalId = setInterval(playChord, 8000);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop and disconnect any active oscillators immediately
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators.clear();

    this.fadeOut(() => {
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.pannerNode) {
        this.pannerNode.disconnect();
        this.pannerNode = null;
      }
    });
  }
}

// Instances registry
export const synths = {
  rain: new RainSynth(),
  wind: new WindSynth(),
  fire: new FireSynth(),
  waves: new WavesSynth(),
  whiteNoise: new WhiteNoiseSynth(),
  coffeeShop: new CoffeeShopSynth(),
  keyboard: new KeyboardSynth(),
  paper: new PaperSynth(),
  musicPad: new MusicPadSynth()
};
export default synths;

