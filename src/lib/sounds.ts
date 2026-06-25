/**
 * Synthesizes clear, elegant notification sounds using the Web Audio API.
 * This ensures 100% compatibility across all devices and browsers, 
 * offline-first, with no external asset dependency.
 */

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  return new AudioContextClass();
}

/**
 * Ascending sweet chirp for sent messages.
 */
export function playMessageSentSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Create oscillator and gain nodes
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Waveform type
    osc.type = "sine";
    
    // Ascending frequency: C5 (523Hz) to G5 (784Hz)
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
    
    // Gain envelope (fade out nicely)
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (err) {
    console.warn("Could not play synthesized sound:", err);
  }
}

/**
 * Dual high-pitched sweet chirp for received messages.
 */
export function playMessageReceivedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // First chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.08); // B5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Second chime (staggered slightly)
    setTimeout(() => {
      try {
        const ctx2 = getAudioContext();
        if (!ctx2) return;
        const now2 = ctx2.currentTime;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(783.99, now2); // G5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, now2 + 0.1); // C6
        gain2.gain.setValueAtTime(0.12, now2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.18);
        osc2.start(now2);
        osc2.stop(now2 + 0.2);
      } catch (e) {}
    }, 70);

  } catch (err) {
    console.warn("Could not play synthesized sound:", err);
  }
}
