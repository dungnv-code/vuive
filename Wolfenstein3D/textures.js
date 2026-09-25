/* =========================================================
   WOLFENSTEIN 3D — Procedural textures (pixel-art thuần JS)
   Tất cả texture 64x64 vẽ vào offscreen canvas.
   ========================================================= */
'use strict';

const TEX_SIZE = 64;

function makeTex(draw) {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  const ctx = c.getContext('2d');
  draw(ctx);
  return c;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noise(ctx, alpha, dark) {
  for (let i = 0; i < 260; i++) {
    const x = (Math.random() * TEX_SIZE) | 0;
    const y = (Math.random() * TEX_SIZE) | 0;
    ctx.fillStyle = dark
      ? `rgba(0,0,0,${Math.random() * alpha})`
      : `rgba(255,255,255,${Math.random() * alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/* ---------- WALLS: index trùng mã tile trong map ---------- */
const WALLS = {};

// 1 — tường đá xanh xám
WALLS[1] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#5a5148');
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = 0; col < 5; col++) {
      const x = col * 16 - off, y = row * 8;
      const sh = 38 + ((row * 7 + col * 13) % 12);
      px(ctx, x + 1, y + 1, 14, 6, `rgb(${sh + 42},${sh + 34},${sh + 24})`);
    }
  }
  noise(ctx, .25, true);
});

// 2 — tường đá có rêu
WALLS[2] = makeTex(ctx => {
  ctx.drawImage(WALLS[1], 0, 0);
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() * 60) | 0, y = (Math.random() * 60) | 0;
    px(ctx, x, y, 2 + (Math.random() * 3 | 0), 2, `rgba(60,${100 + Math.random() * 50 | 0},40,.6)`);
  }
});

// 3 — tường đá nứt
WALLS[3] = makeTex(ctx => {
  ctx.drawImage(WALLS[1], 0, 0);
  ctx.strokeStyle = '#1c1812'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(10, 0);
  ctx.lineTo(18, 20); ctx.lineTo(12, 34); ctx.lineTo(24, 52); ctx.lineTo(18, 64);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(48, 8); ctx.lineTo(42, 30); ctx.lineTo(52, 48); ctx.stroke();
});

// 4 — cờ phát xít (dây treo)
WALLS[4] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#4a4038');
  noise(ctx, .2, true);
  // dây
  px(ctx, 31, 0, 2, 10, '#222');
  // nền cờ đỏ
  px(ctx, 12, 10, 40, 46, '#7a1418');
  px(ctx, 12, 10, 40, 46, 'rgba(0,0,0,.15)');
  px(ctx, 14, 12, 36, 42, '#8e1a1e');
  // vòng trắng + chữ thập đen kiểu Zeitgeist-fake
  ctx.fillStyle = '#d8d0c0';
  ctx.beginPath(); ctx.arc(32, 32, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#141414';
  ctx.fillRect(29, 22, 6, 20);
  ctx.fillRect(22, 29, 20, 6);
  px(ctx, 12, 54, 40, 2, '#3a322b');
});

// 5 — cột đá
WALLS[5] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#3e3830');
  px(ctx, 6, 0, 52, 64, '#6a5f50');
  px(ctx, 10, 0, 10, 64, '#8a7d68');
  px(ctx, 44, 0, 8, 64, '#4c443a');
  for (let y = 4; y < 64; y += 12) px(ctx, 6, y, 52, 2, '#54493c');
  noise(ctx, .2, true);
});

// 6 — tường gỗ
WALLS[6] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#5e3a1c');
  for (let x = 0; x < 64; x += 10) {
    px(ctx, x, 0, 8, 64, `rgb(${86 + (x % 30)},${52 + (x % 18)},${24 + (x % 10)})`);
    px(ctx, x + 8, 0, 2, 64, '#3a2210');
  }
  for (let i = 0; i < 14; i++)
    px(ctx, (Math.random() * 62) | 0, (Math.random() * 64) | 0, 1, 3 + Math.random() * 8, '#3a2210');
});

// 7 — tường gỗ +when hòm
WALLS[7] = makeTex(ctx => {
  ctx.drawImage(WALLS[6], 0, 0);
  px(ctx, 8, 8, 48, 48, '#4a2c14');
  px(ctx, 10, 10, 44, 44, '#5c3a1a');
  ctx.strokeStyle = '#2e1a0a'; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 44, 44);
  ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(54, 54);
  ctx.moveTo(54, 10); ctx.lineTo(10, 54); ctx.stroke();
});

// 8 — tường đá xanh biếc (phòng boss)
WALLS[8] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#2c3444');
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = 0; col < 5; col++) {
      const x = col * 16 - off, y = row * 8;
      px(ctx, x + 1, y + 1, 14, 6, `rgb(${52 + (row * 5 + col * 9) % 14},${62 + (row * 7 + col * 11) % 14},${84})`);
    }
  }
  noise(ctx, .22, true);
});

// 9 — biểu tượng Eagles (đại bàng đá)
WALLS[9] = makeTex(ctx => {
  ctx.drawImage(WALLS[1], 0, 0);
  px(ctx, 12, 8, 40, 48, '#3a352c');
  px(ctx, 14, 10, 36, 44, '#8a7d5c');
  // vòng nguyệt quặp
  ctx.strokeStyle = '#c8b878'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(32, 34, 14, 0, 7); ctx.stroke();
  // đại bàng đơn giản
  ctx.fillStyle = '#2a2418';
  ctx.beginPath();
  ctx.moveTo(32, 22); ctx.lineTo(24, 30); ctx.lineTo(18, 28);
  ctx.lineTo(26, 36); ctx.lineTo(20, 44); ctx.lineTo(30, 38);
  ctx.lineTo(32, 44); ctx.lineTo(34, 38); ctx.lineTo(44, 44);
  ctx.lineTo(38, 36); ctx.lineTo(46, 28); ctx.lineTo(40, 30);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(30, 24, 4, 14);
});

// 10 — tường xương trắng (ngục)
WALLS[10] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#6a655c');
  noise(ctx, .2, true);
  ctx.fillStyle = '#d8d2c4';
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 12, y = 10 + (i % 3) * 16;
    ctx.fillRect(x, y, 4, 22);
    ctx.beginPath(); ctx.arc(x + 2, y + 2, 4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 2, y + 20, 4, 0, 7); ctx.fill();
  }
  noise(ctx, .15, true);
});

// 90 — cửa gỗ (nêm sắt)
WALLS[90] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#4a2e14');
  for (let x = 0; x < 64; x += 13) px(ctx, x, 0, 11, 64, '#63401e');
  px(ctx, 0, 0, 64, 4, '#2e1c0a'); px(ctx, 0, 60, 64, 4, '#2e1c0a');
  // bản lề + tay nắm
  px(ctx, 0, 14, 64, 3, '#6a6a72'); px(ctx, 0, 47, 64, 3, '#6a6a72');
  px(ctx, 48, 30, 10, 4, '#c8b060'); px(ctx, 56, 30, 4, 8, '#8a7830');
});

// 91 — cửa thang máy (kim loại, khóa vàng)
WALLS[91] = makeTex(ctx => {
  px(ctx, 0, 0, 64, 64, '#4c4c54');
  px(ctx, 2, 2, 60, 60, '#66666e');
  px(ctx, 4, 4, 26, 56, '#787884');
  px(ctx, 34, 4, 26, 56, '#787884');
  px(ctx, 30, 0, 4, 64, '#3a3a42');
  for (let y = 8; y < 60; y += 10) { px(ctx, 6, y, 22, 1, '#5a5a64'); px(ctx, 36, y, 22, 1, '#5a5a64'); }
  // ổ khóa vàng
  px(ctx, 24, 24, 16, 16, '#c8a020');
  px(ctx, 27, 27, 10, 10, '#e8c040');
  px(ctx, 30, 30, 4, 6, '#7a5a10');
});

/* ---------- ITEMS: sprite billboard 64x64 ---------- */
const ITEMS = {};

function itemCanvas(draw) { return makeTex(draw); }

// 101: chìa khóa vàng
ITEMS[101] = itemCanvas(ctx => {
  ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(32, 22, 9, 0, 7); ctx.stroke();
  px(ctx, 29, 30, 6, 24, '#ffd23a');
  px(ctx, 35, 42, 8, 5, '#ffd23a');
  px(ctx, 35, 50, 8, 5, '#ffd23a');
  ctx.fillStyle = '#8a6a00';
  ctx.beginPath(); ctx.arc(32, 22, 3, 0, 7); ctx.fill();
});

// 102: y tế (medkit)
ITEMS[102] = itemCanvas(ctx => {
  px(ctx, 14, 22, 36, 26, '#b8b8c0');
  px(ctx, 16, 24, 32, 22, '#e8e8f0');
  px(ctx, 29, 28, 6, 16, '#c81a1a');
  px(ctx, 24, 33, 16, 6, '#c81a1a');
  px(ctx, 26, 18, 12, 5, '#98989f');
});

// 103: đồ ăn (gà quay)
ITEMS[103] = itemCanvas(ctx => {
  ctx.fillStyle = '#c8883a';
  ctx.beginPath(); ctx.ellipse(32, 38, 16, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8b060';
  ctx.beginPath(); ctx.ellipse(30, 35, 11, 7, 0, 0, 7); ctx.fill();
  px(ctx, 46, 20, 3, 16, '#d8d0c0');
  ctx.fillStyle = '#d8d0c0';
  ctx.beginPath(); ctx.arc(47, 19, 3, 0, 7); ctx.fill();
});

// 104: báu vật (chéng vàng)
ITEMS[104] = itemCanvas(ctx => {
  ctx.fillStyle = '#e8c040';
  ctx.beginPath(); ctx.arc(32, 34, 14, 3.34, 6.08); ctx.fill();
  px(ctx, 20, 34, 24, 4, '#c89820');
  px(ctx, 30, 18, 4, 8, '#e8c040');
  ctx.fillStyle = '#ffe080';
  ctx.beginPath(); ctx.arc(28, 32, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#a87818';
  ctx.beginPath(); ctx.arc(32, 34, 17, 3.3, 6.1); ctx.stroke();
});

// 105: ký ức (chén thánh)
ITEMS[105] = itemCanvas(ctx => {
  ctx.fillStyle = '#d8d8e8';
  ctx.beginPath(); ctx.arc(32, 26, 10, 0, 3.14); ctx.fill();
  px(ctx, 22, 26, 20, 4, '#b8b8c8');
  px(ctx, 30, 30, 4, 14, '#b8b8c8');
  px(ctx, 24, 44, 16, 4, '#d8d8e8');
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(29, 24, 2.5, 0, 7); ctx.fill();
});

// 106: đạn lục
ITEMS[106] = itemCanvas(ctx => {
  px(ctx, 18, 30, 28, 18, '#4a4a30');
  px(ctx, 18, 30, 28, 3, '#5e5e3e');
  for (let i = 0; i < 4; i++) px(ctx, 21 + i * 6, 34, 4, 11, '#c8b040');
  px(ctx, 20, 26, 24, 5, '#3a3a24');
});

// 107: đạn súng máy
ITEMS[107] = itemCanvas(ctx => {
  px(ctx, 16, 28, 32, 20, '#3a3a2a');
  for (let i = 0; i < 3; i++) {
    px(ctx, 19 + i * 10, 24, 6, 18, '#8a8a5a');
    px(ctx, 19 + i * 10, 24, 6, 4, '#c8c880');
  }
});

// 108: súng máy (chaingun) nhặt được
ITEMS[108] = itemCanvas(ctx => {
  px(ctx, 12, 34, 40, 6, '#3a3a42');
  for (let i = 0; i < 4; i++) px(ctx, 14 + i * 9, 26, 6, 10, '#5a5a66');
  px(ctx, 40, 40, 8, 12, '#6a4a2a');
  px(ctx, 12, 40, 10, 6, '#2a2a32');
});

// 109: tiểu liên (machine gun pickup)
ITEMS[109] = itemCanvas(ctx => {
  px(ctx, 10, 32, 36, 6, '#44444e');
  px(ctx, 30, 38, 6, 10, '#5a3a1e');
  px(ctx, 40, 34, 8, 5, '#38383f');
  px(ctx, 12, 28, 8, 5, '#55555f');
});

// 110: kho báu chén nhỏ (treasure cup)
ITEMS[110] = itemCanvas(ctx => {
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath(); ctx.arc(32, 36, 10, 3.14, 0); ctx.fill();
  px(ctx, 22, 36, 20, 4, '#e8b020');
  px(ctx, 30, 40, 4, 10, '#e8b020');
  px(ctx, 25, 50, 14, 3, '#e8b020');
});

// 111: súng pháo (rocket launcher) — vũ khí 5
ITEMS[111] = itemCanvas(ctx => {
  px(ctx, 10, 32, 40, 8, '#1f3a2a');
  px(ctx, 14, 30, 6, 10, '#2e4a36');
  px(ctx, 40, 28, 12, 6, '#3a5240');
  px(ctx, 46, 28, 5, 16, '#8a8a90');
  px(ctx, 12, 40, 8, 6, '#2a2a32');
});

// 112: đạn pháo (rocket ammo)
ITEMS[112] = itemCanvas(ctx => {
  px(ctx, 16, 28, 32, 16, '#2e4a36');
  px(ctx, 20, 34, 28, 4, '#3a5240');
  for (let i = 0; i < 4; i++) {
    px(ctx, 22 + i * 6, 32, 4, 8, '#c8d8a0');
    px(ctx, 23 + i * 6, 40, 2, 4, '#8a8a90');
  }
});

/* ---------- ENEMIES: sprite billboard ---------- */
const ENEMIES = {};

// Vẽ người lính chung: mũ, mặt, thân áo màu uniform, chân, súng (theo loại)
function drawSoldier(ctx, coat, pants, helmet, skin, gun) {
  // bóng
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(32, 60, 14, 4, 0, 0, 7); ctx.fill();
  // chân
  px(ctx, 24, 46, 6, 12, pants);
  px(ctx, 34, 46, 6, 12, pants);
  px(ctx, 23, 57, 8, 4, '#1c1c1c');
  px(ctx, 33, 57, 8, 4, '#1c1c1c');
  // thân áo
  px(ctx, 20, 26, 24, 21, coat);
  px(ctx, 20, 26, 24, 3, shade(coat, -18));
  // dây đeo
  px(ctx, 22, 28, 3, 17, shade(coat, -30));
  // tay + súng khác nhau theo loại vũ khí
  if (gun === 'pistol') {
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(38, 30, 14, 4);
    px(ctx, 40, 28, 3, 7, '#3c3c44');
  } else if (gun === 'smg') {
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(14, 31, 30, 4);
    px(ctx, 32, 35, 5, 10, '#3c3c44');
    px(ctx, 42, 31, 4, 6, '#4e4e58');
  } else if (gun === 'chain') {
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
    ctx.fillStyle = '#222228'; ctx.fillRect(34, 27, 10, 9);
    ctx.fillStyle = '#55555f'; ctx.fillRect(38, 30, 3, 3);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(12, 31, 27, 5);
    px(ctx, 44, 28, 6, 8, '#3c3c44');
  } else if (gun === 'rifle') {
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(10, 28, 40, 3);
    ctx.fillStyle = '#222'; ctx.fillRect(42, 24, 5, 4);
    px(ctx, 14, 31, 6, 4, '#3c3c44');
  } else if (gun === 'rocket') {
    px(ctx, 12, 27, 30, 7, '#1f3a2a');
    ctx.fillStyle = '#2a4432'; ctx.fillRect(34, 28, 12, 5);
    ctx.fillStyle = '#8a8a90'; ctx.fillRect(46, 29, 5, 4);
    px(ctx, 38, 24, 8, 3, '#6a6a72');
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
  } else {
    px(ctx, 14, 30, 8, 6, coat);
    px(ctx, 42, 30, 8, 6, coat);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(12, 31, 40, 4);
  }
  // đầu
  px(ctx, 24, 12, 16, 14, skin);
  px(ctx, 27, 18, 3, 3, '#1a1a1a');    // mắt
  px(ctx, 34, 18, 3, 3, '#1a1a1a');
  px(ctx, 29, 23, 6, 2, shade(skin, -40)); // miệng
  // mũ
  px(ctx, 22, 8, 20, 6, helmet);
  px(ctx, 24, 4, 16, 5, helmet);
  px(ctx, 24, 4, 16, 2, shade(helmet, 24));
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// Guard — lính thường áo xanh, súng lục
ENEMIES.guard = makeTex(ctx => drawSoldier(ctx, '#3e4a5e', '#2c3038', '#4a5468', '#e0b090', 'pistol'));
// Officer — sĩ quan áo trắng, tiểu liên
ENEMIES.officer = makeTex(ctx => drawSoldier(ctx, '#d8d8d8', '#4a4a52', '#b8b8c0', '#e0b090', 'smg'));
// Gunner — xạ thủ súng máy, áo olive
ENEMIES.gunner = makeTex(ctx => drawSoldier(ctx, '#4e5a2e', '#2c3038', '#4a4a30', '#c8926a', 'chain'));
// Sniper — bắn tỉa camo tối, súng trường dài ống ngắm
ENEMIES.sniper = makeTex(ctx => drawSoldier(ctx, '#3a3f48', '#23272e', '#2f333c', '#e0b090', 'rifle'));
// Boss — trùm áo nâu, bệ phóng rocket
ENEMIES.boss = makeTex(ctx => drawSoldier(ctx, '#5e4a2e', '#3a2e1c', '#4a3a22', '#e0b090', 'rocket'));

/* ---------- ALLIED: đồng đội AI (phe bạn) ---------- */
const ALLIED = {};
ALLIED.rifle = makeTex(ctx => drawSoldier(ctx, '#3a4a7a', '#2c3050', '#4a5a8a', '#e0b090', 'rifle'));
ALLIED.smg = makeTex(ctx => drawSoldier(ctx, '#3e6278', '#2c3a46', '#4a6a78', '#e0b090', 'smg'));
ALLIED.corpse = makeTex(ctx => {
  ctx.fillStyle = 'rgba(30,40,90,.75)';
  ctx.beginPath(); ctx.ellipse(32, 56, 20, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(90,6,6,.8)';
  ctx.beginPath(); ctx.ellipse(26, 56, 10, 4, 0, 0, 7); ctx.fill();
  // người nằm
  px(ctx, 18, 48, 22, 7, '#8a8a92');
  px(ctx, 40, 49, 9, 6, '#e0b090');
  px(ctx, 14, 49, 6, 5, '#3a4a7a');
});

// Dog — chó ng(training) xám
ENEMIES.dog = makeTex(ctx => {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(32, 60, 16, 4, 0, 0, 7); ctx.fill();
  // thân
  ctx.fillStyle = '#6a5540';
  ctx.beginPath(); ctx.ellipse(32, 40, 16, 11, 0, 0, 7); ctx.fill();
  // đầu
  ctx.fillStyle = '#7a6450';
  ctx.beginPath(); ctx.ellipse(30, 26, 9, 8, 0, 0, 7); ctx.fill();
  // mõm
  px(ctx, 20, 26, 9, 6, '#8a7460');
  px(ctx, 16, 27, 5, 3, '#2a1a10');
  // tai
  px(ctx, 34, 16, 5, 8, '#5a4636');
  px(ctx, 26, 15, 5, 8, '#5a4636');
  // mắt
  px(ctx, 25, 23, 2, 2, '#c02020');
  // chân
  px(ctx, 22, 48, 5, 11, '#5a4636');
  px(ctx, 36, 48, 5, 11, '#5a4636');
  // đuôi
  px(ctx, 46, 34, 6, 4, '#6a5540');
});

// Xác chết (máu + người nằm)
ENEMIES.corpse = makeTex(ctx => {
  ctx.fillStyle = 'rgba(120,10,10,.75)';
  ctx.beginPath(); ctx.ellipse(32, 56, 20, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(90,6,6,.8)';
  ctx.beginPath(); ctx.ellipse(26, 56, 10, 4, 0, 0, 7); ctx.fill();
  // người nằm
  px(ctx, 18, 48, 22, 7, '#8a8a92');
  px(ctx, 40, 49, 9, 6, '#e0b090');
  px(ctx, 14, 49, 6, 5, '#3e4a5e');
});
