// ================= INPUT & KHỞI ĐỘNG =================
'use strict';

let keys = {};
let mouse = { x: W / 2, y: H - 80, active: false, down: false };

addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') e.preventDefault();
  if (e.key === 'Shift') fireMissile();
  if (e.key === 'b' || e.key === 'B') fireNuke();
});
addEventListener('keyup', e => keys[e.key] = false);
// tránh phím "dính" khi cửa sổ bị mất focus (Alt-Tab, ...)
addEventListener('blur', () => { keys = {}; mouse.active = false; mouse.down = false; });

cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
  mouse.active = true;
});
cv.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);
cv.addEventListener('mouseleave', () => { mouse.active = false; mouse.down = false; });

// touch cho mobile
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), t = e.touches[0];
  mouse.x = (t.clientX - r.left) * (W / r.width);
  mouse.y = (t.clientY - r.top) * (H / r.height) - 40;
  mouse.active = true; mouse.down = true;
}, { passive: false });
cv.addEventListener('touchstart', () => { mouse.down = true; }, { passive: true });
cv.addEventListener('touchend', () => { mouse.down = false; mouse.active = false; });

// nút BẮT ĐẦU trong overlay
document.getElementById('btnStart').addEventListener('click', startGame);

update(); // bắt đầu vòng lặp (menu vẫn vẽ nền sao)
