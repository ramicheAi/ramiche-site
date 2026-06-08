/* ================================================================
   PARALLAX OS — SOUND (Web Audio synth, mirrors cc-sounds.ts)
   Tasteful UI cues: boot, dispatch, success, alert, blip, nav.
   Off by default until user enables (autoplay-safe). window.poSound
   ================================================================ */
(function () {
  let ctx = null, enabled = false, master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // a single shaped tone
  function tone({ freq = 440, type = "sine", dur = 0.18, gain = 0.12, glideTo = null, delay = 0 }) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  const CUES = {
    nav:      () => tone({ freq: 540, type: "triangle", dur: 0.09, gain: 0.06 }),
    blip:     () => tone({ freq: 880, type: "sine", dur: 0.07, gain: 0.05 }),
    open:     () => { tone({ freq: 420, type: "sine", dur: 0.1, gain: 0.07 }); tone({ freq: 640, type: "sine", dur: 0.14, gain: 0.06, delay: 0.05 }); },
    dispatch: () => { tone({ freq: 360, type: "sawtooth", dur: 0.12, gain: 0.06, glideTo: 720 }); tone({ freq: 720, type: "sine", dur: 0.14, gain: 0.05, delay: 0.08 }); },
    success:  () => { [523, 659, 784].forEach((f, i) => tone({ freq: f, type: "sine", dur: 0.16, gain: 0.06, delay: i * 0.07 })); },
    alert:    () => { tone({ freq: 300, type: "square", dur: 0.16, gain: 0.07 }); tone({ freq: 300, type: "square", dur: 0.16, gain: 0.07, delay: 0.22 }); },
    boot:     () => { [180, 280, 420, 620].forEach((f, i) => tone({ freq: f, type: "sine", dur: 0.5, gain: 0.05, delay: i * 0.18 })); tone({ freq: 880, type: "triangle", dur: 0.6, gain: 0.05, delay: 0.9 }); },
  };

  window.poSound = {
    play(name) { try { (CUES[name] || CUES.nav)(); } catch (e) {} },
    setEnabled(v) { enabled = !!v; if (v) ensure(); try { localStorage.setItem("po-sound", v ? "1" : "0"); } catch (e) {} },
    isEnabled() { return enabled; },
  };
  try { if (localStorage.getItem("po-sound") === "1") enabled = true; } catch (e) {}
})();
