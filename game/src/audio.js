// Glimmerdeep — procedural sound. One job: every effect and the ambient hum is
// synthesised with WebAudio, so the game ships no audio files and never loads
// anything over the network. Silent until the first key or click, as browsers
// require, and muteable at any time.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    padNodes: null,
    lastPlayed: {},
  };
}

export function ensureAudioContext(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    audio.ctx = new Ctor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);
    startAmbientPad(audio);
    return true;
  } catch {
    return false;
  }
}

export function setAudioMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.ctx.currentTime, 0.02);
  }
}

export function toggleAudioMuted(audio) {
  setAudioMuted(audio, !audio.muted);
  return audio.muted;
}

function startAmbientPad(audio) {
  const { ctx } = audio;
  const gain = ctx.createGain();
  gain.gain.value = 0.0;
  gain.connect(audio.master);
  const voices = [];
  for (const [freq, detune] of [[110, 0], [165, 4], [220.5, -5]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(gain);
    osc.start();
    voices.push(osc);
  }
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();
  gain.gain.setTargetAtTime(0.016, ctx.currentTime, 2.5);
  audio.padNodes = { gain, voices, lfo };
}

function tone(audio, { freq, endFreq, dur, type = 'sine', vol = 0.2, delay = 0, attack = 0.005 }) {
  if (!audio.ctx) return;
  const t0 = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(audio, { dur, vol = 0.2, filterFreq = 1200, type = 'lowpass', delay = 0 }) {
  if (!audio.ctx) return;
  const t0 = audio.ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t0);
}

// One named effect. Throttled per name so a held key cannot stack sounds.
export function playSound(audio, name) {
  if (!audio.ctx || audio.muted) return;
  const now = audio.ctx.currentTime;
  const throttle = { digTick: 0.09, bump: 0.22, step: 0.14, beep: 0.5 };
  if (throttle[name] && now - (audio.lastPlayed[name] || -9) < throttle[name]) return;
  audio.lastPlayed[name] = now;
  switch (name) {
    case 'click':
      tone(audio, { freq: 660, dur: 0.06, type: 'triangle', vol: 0.16 });
      break;
    case 'step':
      noiseBurst(audio, { dur: 0.05, vol: 0.05, filterFreq: 500 });
      break;
    case 'digTick':
      noiseBurst(audio, { dur: 0.07, vol: 0.2, filterFreq: 900 });
      tone(audio, { freq: 140, endFreq: 70, dur: 0.08, type: 'triangle', vol: 0.12 });
      break;
    case 'digDone':
      noiseBurst(audio, { dur: 0.12, vol: 0.25, filterFreq: 700 });
      tone(audio, { freq: 180, endFreq: 60, dur: 0.14, type: 'sine', vol: 0.25 });
      break;
    case 'bump':
      tone(audio, { freq: 110, endFreq: 55, dur: 0.09, type: 'square', vol: 0.08 });
      break;
    case 'gemAmber':
      tone(audio, { freq: 784, dur: 0.16, type: 'sine', vol: 0.2 });
      tone(audio, { freq: 1175, dur: 0.22, type: 'sine', vol: 0.16, delay: 0.07 });
      break;
    case 'gemTeal':
      tone(audio, { freq: 880, dur: 0.16, type: 'sine', vol: 0.2 });
      tone(audio, { freq: 1319, dur: 0.22, type: 'sine', vol: 0.16, delay: 0.07 });
      tone(audio, { freq: 1760, dur: 0.26, type: 'sine', vol: 0.1, delay: 0.14 });
      break;
    case 'gemViolet':
      tone(audio, { freq: 659, dur: 0.15, type: 'sine', vol: 0.2 });
      tone(audio, { freq: 988, dur: 0.18, type: 'sine', vol: 0.18, delay: 0.06 });
      tone(audio, { freq: 1319, dur: 0.2, type: 'sine', vol: 0.16, delay: 0.12 });
      tone(audio, { freq: 1976, dur: 0.3, type: 'sine', vol: 0.12, delay: 0.18 });
      break;
    case 'pickup':
      tone(audio, { freq: 520, endFreq: 780, dur: 0.12, type: 'triangle', vol: 0.18 });
      break;
    case 'swing':
      noiseBurst(audio, { dur: 0.11, vol: 0.14, filterFreq: 2400, type: 'bandpass' });
      break;
    case 'wispHit':
      tone(audio, { freq: 920, endFreq: 300, dur: 0.1, type: 'sawtooth', vol: 0.1 });
      break;
    case 'wispDie':
      tone(audio, { freq: 1200, endFreq: 120, dur: 0.3, type: 'sawtooth', vol: 0.14 });
      noiseBurst(audio, { dur: 0.2, vol: 0.12, filterFreq: 1800, type: 'highpass' });
      break;
    case 'hurt':
      tone(audio, { freq: 220, endFreq: 70, dur: 0.25, type: 'sawtooth', vol: 0.2 });
      noiseBurst(audio, { dur: 0.15, vol: 0.18, filterFreq: 400 });
      break;
    case 'boulder':
      noiseBurst(audio, { dur: 0.18, vol: 0.3, filterFreq: 300 });
      tone(audio, { freq: 90, endFreq: 40, dur: 0.2, type: 'sine', vol: 0.3 });
      break;
    case 'buy':
      tone(audio, { freq: 988, dur: 0.1, type: 'triangle', vol: 0.18 });
      tone(audio, { freq: 1319, dur: 0.14, type: 'triangle', vol: 0.18, delay: 0.08 });
      tone(audio, { freq: 1760, dur: 0.2, type: 'triangle', vol: 0.16, delay: 0.16 });
      break;
    case 'deny':
      tone(audio, { freq: 220, dur: 0.12, type: 'square', vol: 0.08 });
      tone(audio, { freq: 185, dur: 0.16, type: 'square', vol: 0.08, delay: 0.1 });
      break;
    case 'beep':
      tone(audio, { freq: 1046, dur: 0.09, type: 'square', vol: 0.07 });
      break;
    case 'win': {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((freq, i) => tone(audio, { freq, dur: 0.3, type: 'triangle', vol: 0.2, delay: i * 0.12 }));
      break;
    }
    case 'lose': {
      const notes = [392, 370, 349, 311];
      notes.forEach((freq, i) => tone(audio, { freq, dur: 0.42, type: 'triangle', vol: 0.18, delay: i * 0.22 }));
      break;
    }
    default:
      break;
  }
}
