// Sound, synthesised with WebAudio and nothing else: no sound files, no
// network. The context starts on the first user gesture (browsers demand
// it) and every effect is an oscillator or a short noise burst.
let context = null;
let muted = false;

/** Create the context on demand; safe to call before any gesture. */
export function ensureAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return context;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    return context;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

/** A short oscillator note with a decaying gain envelope. */
function tone(freq, duration, type, volume, slideTo) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Sound never breaks the game.
  }
}

/** A short burst of filtered noise (impacts, cracks). */
function noise(duration, volume, lowFreq) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  } catch {
    // Sound never breaks the game.
  }
}

/** Play one game event's sound. */
export function playEvent(event) {
  switch (event.type) {
    case 'drink':
      tone(660, 0.12, 'sine', 0.16, 990);
      break;
    case 'hit-stone':
      tone(110, 0.18, 'square', 0.2, 55);
      noise(0.12, 0.18, 400);
      break;
    case 'hit-grub':
      tone(180, 0.15, 'sawtooth', 0.14, 90);
      break;
    case 'branch':
      tone(523, 0.1, 'sine', 0.14);
      setTimeout(() => tone(784, 0.14, 'sine', 0.14), 90);
      break;
    case 'branch-lost':
      tone(330, 0.2, 'sine', 0.1, 165);
      break;
    case 'crack':
      noise(0.3, 0.3, 900);
      tone(220, 0.25, 'triangle', 0.2, 110);
      break;
    case 'depth':
      tone(392, 0.15, 'sine', 0.12, 523);
      break;
    case 'bloom':
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.35, 'sine', 0.16), i * 110);
      });
      break;
    case 'wither':
      tone(220, 0.7, 'sawtooth', 0.14, 55);
      break;
    case 'click':
      tone(880, 0.06, 'sine', 0.1);
      break;
    default:
      break;
  }
}
