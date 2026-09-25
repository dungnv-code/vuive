// ================= ÂM THANH (WebAudio, không cần file) =================
'use strict';

let AC = null;
function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

function beep(f, d, type = 'square', v = .12, slide = 0) {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + d);
    g.gain.setValueAtTime(v, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + d);
  } catch (e) { /* âm thanh không bắt buộc */ }
}

const sfx = {
  shoot:  () => beep(680, .06, 'square', .05, -350),
  hit:    () => beep(240, .08, 'sawtooth', .10, -120),
  squawk: () => { beep(rand(900, 1300), .09, 'sawtooth', .10, -400); beep(rand(600, 900), .14, 'square', .07, -300); },
  boom:   () => { beep(120, .4, 'sawtooth', .22, -90); beep(70, .5, 'square', .18, -40); },
  power:  () => { beep(520, .09, 'square', .10); setTimeout(() => beep(780, .12, 'square', .10), 90); },
  missile:() => beep(300, .25, 'sawtooth', .12, 600),
  nuke:   () => beep(60, .9, 'sawtooth', .30, -30),
  hurt:   () => beep(150, .3, 'square', .18, -100),
  boss:   () => { beep(90, .7, 'sawtooth', .20, 50); setTimeout(() => beep(120, .7, 'sawtooth', .18, -40), 400); },
  win:    () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .18, 'square', .12), i * 140)); }
};
