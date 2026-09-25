// Battle City — engine game (thuần JS)
'use strict';

// ===================== HẰNG SỐ =====================
const TILE = 16;                 // kích thước 1 ô
const SUB = 8;                   // khối con (gạch/thép vỡ theo 8x8)
const GRID = 26;                 // 26x26 ô
const W = TILE * GRID;           // 416
const STAGE_ENEMIES = 20;
const MAX_ON_FIELD = 4;          // tối đa 4 địch trên sân

const DIRS = [                   // 0 lên, 1 phải, 2 xuống, 3 trái
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

const TANK_SPEED = 48;           // px/giây (xe thường)
const FAST_SPEED = 78;
const PLAYER_SPEED = 60;
const BULLET_SPEED = 160;
const FAST_BULLET_SPEED = 240;

const SPAWNS = [                 // điểm xuất hiện địch (góc trên)
  { x: 0, y: 0 },
  { x: W / 2 - TILE / 2, y: 0 },
  { x: W - TILE, y: 0 }
];
const PLAYER_SPAWN = { x: 4 * TILE, y: 12 * TILE };
const PLAYER2_SPAWN = { x: 8 * TILE, y: 12 * TILE };

// Vùng căn cứ (đại bàng + tường gạch) — giữa đáy
const BASE_X = 12;               // ô
const BASE_Y = 24;
const BASE_PX = BASE_X * TILE;   // 192

// ===================== CANVAS =====================
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ===================== ÂM THANH (WebAudio) =====================
const Sound = (function () {
  let actx = null;
  let enabled = true;

  function ac() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }

  function beep(freq, dur, type, vol, slide) {
    if (!enabled) return;
    const a = ac();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }

  function noise(dur, vol) {
    if (!enabled) return;
    const a = ac();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol || 0.12;
    s.buffer = buf; s.connect(g); g.connect(a.destination);
    s.start();
  }

  return {
    toggle() { enabled = !enabled; return enabled; },
    get on() { return enabled; },
    shoot()   { beep(880, 0.06, 'square', 0.05, 440); },
    hitWall() { beep(200, 0.05, 'square', 0.06, 120); },
    hitSteel(){ beep(140, 0.06, 'square', 0.07, 90); },
    boomBig() { noise(0.35, 0.2); beep(90, 0.3, 'sawtooth', 0.1, 40); },
    boomSmall(){ noise(0.18, 0.12); },
    powerup() { beep(660, 0.08, 'square', 0.08); setTimeout(() => beep(880, 0.08, 'square', 0.08), 80); setTimeout(() => beep(1100, 0.1, 'square', 0.08), 160); },
    score()   { beep(1200, 0.05, 'square', 0.06); },
    stageStart(){ [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'square', 0.07), i * 120)); },
    gameover(){ [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.1), i * 250)); }
  };
})();

// ===================== TRẠNG THÁI GAME =====================
let terrain = [];        // ma trận SUB-level: 0 trống, 1 gạch, 2 thép, 3 nước, 4 rừng, 5 băng, 6 đại bàng
let bullets = [];
let enemies = [];
let players = [];        // 1 hoặc 2 người
let explosions = [];
let powerups = [];       // tối đa 1 trên sân
let spawnQueue = [];     // danh sách loại địch chưa ra sân
let spawnTimer = 0;
let frozenTimer = 0;     // power-up đồng hồ
let shovelTimer = 0;     // power-up xẻng
let flashes = [];        // số nhấp nháy điểm số
let stage = 1;
let score = 0;
let state = 'title';     // title | playing | stageclear | gameover | paused
let stateTimer = 0;
let waterFrame = 0;
let eagleAlive = true;
let playerCount = 1;

// cache vẽ địa hình: địa hình tĩnh vẽ 1 lần vào offscreen, chỉ redraw khi có ô đổi
let terrainDirty = true;
let terrainCanvas = null;
let waterCells = [];   // danh sách [sx,sy] các ô con nước (vẽ động mỗi frame)
let forestCells = [];  // danh sách [sx,sy] các ô con rừng (vẽ đè sau xe tăng)

const keys = {};

// ===================== TIỆN ÍCH ĐỊA HÌNH =====================
function tAt(px, py) {  // terrain tại toạ độ pixel
  const sx = Math.floor(px / SUB), sy = Math.floor(py / SUB);
  if (sx < 0 || sy < 0 || sx >= GRID * 2 || sy >= GRID * 2) return 2; // ngoài biên = thép
  return terrain[sy][sx];
}

function rectBlocked(x, y, w, h, forTank) {
  // quét các khối con 8x8 mà hình chữ nhật chạm tới
  const x0 = Math.floor(x / SUB), x1 = Math.floor((x + w - 0.01) / SUB);
  const y0 = Math.floor(y / SUB), y1 = Math.floor((y + h - 0.01) / SUB);
  for (let sy = y0; sy <= y1; sy++) {
    for (let sx = x0; sx <= x1; sx++) {
      let t;
      if (sx < 0 || sy < 0 || sx >= GRID * 2 || sy >= GRID * 2) t = 2;
      else t = terrain[sy][sx];
      if (t === 1 || t === 2 || t === 6) return true;      // gạch, thép, đại bàng
      if (t === 3 && forTank) return true;                  // nước chặn xe, đạn bay qua
    }
  }
  return false;
}

function tankBlocked(tank, x, y) {
  if (x < 0 || y < 0 || x + TILE > W || y + TILE > W) return true;
  if (rectBlocked(x, y, TILE, TILE, true)) return true;
  // va xe khác (tránh cấp phát mảng mỗi bước)
  for (const list of [enemies, players]) {
    for (const o of list) {
      if (o === tank || o.dead) continue;
      if (x < o.x + TILE - 2 && x + TILE - 2 > o.x && y < o.y + TILE - 2 && y + TILE - 2 > o.y) return true;
    }
  }
  return false;
}

// ===================== XÂY MÀN =====================
function buildStage(n) {
  const lv = LEVELS[(n - 1) % LEVELS.length];
  terrain = [];
  for (let y = 0; y < GRID * 2; y++) {
    terrain.push(new Array(GRID * 2).fill(0));
  }
  const code = { 'B': 1, 'S': 2, 'W': 3, 'F': 4, 'I': 5 };

  for (let gy = 0; gy < GRID; gy++) {
    const row = lv.map[gy] || '';
    for (let gx = 0; gx < GRID; gx++) {
      const ch = row[gx] || '.';
      const t = code[ch] || 0;
      // điền 4 khối con
      terrain[gy * 2][gx * 2] = t;
      terrain[gy * 2][gx * 2 + 1] = t;
      terrain[gy * 2 + 1][gx * 2] = t;
      terrain[gy * 2 + 1][gx * 2 + 1] = t;
    }
  }

  // --- căn cứ đại bàng + tường gạch (đè lên bản đồ) ---
  // đại bàng ở ô (12,24), tường gạch bao quanh
  const walls = [
    // tường trên
    [11, 23], [12, 23], [13, 23],
    // tường hai bên
    [11, 24], [13, 24],
    // tường dưới
    [11, 25], [12, 25], [13, 25]
  ];
  for (const [gx, gy] of walls) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      terrain[gy * 2 + dy][gx * 2 + dx] = 1;
    }
  }
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    terrain[BASE_Y * 2 + dy][BASE_X * 2 + dx] = 6; // đại bàng
  }

  // --- dọn vùng xuất hiện để xe không bị kẹt trong tường ---
  const clearArea = (gx, gy) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const sx = gx * 2 + dx, sy = gy * 2 + dy;
      if (terrain[sy][sx] !== 6) terrain[sy][sx] = 0;
    }
  };
  clearArea(0, 0); clearArea(12, 0); clearArea(24, 0); // 3 điểm spawn địch
  clearArea(4, 12); clearArea(8, 12);                  // 2 điểm spawn người chơi

  // precompute các ô nước/rừng để vẽ nhanh (không quét lại toàn lưới mỗi frame)
  waterCells = []; forestCells = [];
  for (let sy = 0; sy < GRID * 2; sy++) {
    for (let sx = 0; sx < GRID * 2; sx++) {
      const t = terrain[sy][sx];
      if (t === 3) waterCells.push([sx, sy]);
      else if (t === 4) forestCells.push([sx, sy]);
    }
  }
  terrainDirty = true;

  eagleAlive = true;
  bullets = []; enemies = []; explosions = []; powerups = []; flashes = [];
  spawnQueue = lv.enemies.slice();
  spawnTimer = 0;
  frozenTimer = 0;
  shovelTimer = 0;

  // người chơi
  players = [];
  for (let i = 0; i < playerCount; i++) {
    const sp = i === 0 ? PLAYER_SPAWN : PLAYER2_SPAWN;
    players.push(makePlayer(sp.x, sp.y, i));
  }
}

// ===================== XE TĂNG =====================
function makePlayer(x, y, idx) {
  return {
    isPlayer: true, idx,
    x, y, dir: 0,
    speed: PLAYER_SPEED,
    bulletSpeed: BULLET_SPEED,
    maxBullets: 1,
    bullets: 0,
    cooldown: 0,
    moving: false,
    slides: 0,            // ô băng còn trượt
    slideDir: 0,
    starLevel: 0,         // 0..3
    helmetTimer: 0,       // khiên
    dead: false,
    respawnTimer: 0,
    lives: idx === 0 ? 2 : 2,
    spawnFlash: 120       // hiệu ứng xuất hiện
  };
}

function makeEnemy(type, x, y) {
  const e = {
    isPlayer: false, type,
    x, y, dir: 2,
    moving: true,
    bullets: 0,
    cooldown: 30 + Math.random() * 60,
    aiTimer: 0,
    dead: false,
    spawnFlash: 90,
    flashTimer: 0       // địch mang power-up nhấp nháy đỏ
  };
  if (type === 'fast') { e.speed = FAST_SPEED; e.bulletSpeed = BULLET_SPEED; }
  else if (type === 'power') { e.speed = TANK_SPEED; e.bulletSpeed = FAST_BULLET_SPEED; }
  else if (type === 'armor') { e.speed = TANK_SPEED; e.bulletSpeed = BULLET_SPEED; e.hp = 4; }
  else { e.speed = TANK_SPEED; e.bulletSpeed = BULLET_SPEED; }
  return e;
}

// ===================== ĐẠN =====================
function fireBullet(tank) {
  if (tank.bullets >= tank.maxBullets || tank.cooldown > 0 || tank.dead || tank.spawnFlash > 0) return;
  const d = DIRS[tank.dir];
  const b = {
    owner: tank,
    x: tank.x + TILE / 2 - 1.5 + d.x * (TILE / 2),
    y: tank.y + TILE / 2 - 2 + d.y * (TILE / 2),
    dir: tank.dir,
    speed: tank.bulletSpeed,
    power: tank.isPlayer ? tank.starLevel : (tank.type === 'power' ? 2 : 1)
  };
  tank.bullets++;
  tank.cooldown = tank.isPlayer ? 6 : 20;    // người chơi ~100ms giữa các phát bắn
  bullets.push(b);
  Sound.shoot();
}

function bulletBlockedByTank(b, x, y) {
  // đạn của địch không bắn địch (đi xuyên); đạn người chơi bắn tất cả
  if (b.owner.isPlayer) {
    for (const t of enemies) {
      if (t.dead || t.spawnFlash > 0) continue;
      if (x < t.x + TILE && x + 3 > t.x && y < t.y + TILE && y + 4 > t.y) return t;
    }
  }
  for (const t of players) {
    if (t === b.owner || t.dead || t.spawnFlash > 0) continue;
    if (x < t.x + TILE && x + 3 > t.x && y < t.y + TILE && y + 4 > t.y) return t;
  }
  return null;
}

function updateBullet(b, dt) {
  const d = DIRS[b.dir];
  // di chuyển từng bước nhỏ để không xuyên tường
  let remaining = b.speed * dt;
  while (remaining > 0) {
    const step = Math.min(2, remaining);
    b.x += d.x * step;
    b.y += d.y * step;
    remaining -= step;

    // ra khỏi màn
    if (b.x < 0 || b.y < 0 || b.x + 3 > W || b.y + 4 > W) {
      explodeSmall(b.x, b.y); destroyBullet(b); return;
    }

    // chạm đại bàng
    if (tAt(b.x + 1, b.y + 2) === 6 || tAt(b.x + 1, b.y + 1) === 6) {
      destroyBullet(b);
      killBase();
      return;
    }

    // địa hình
    const t = tAt(b.x + 1, b.y + 2);
    if (t === 1) { // gạch
      damageBrick(b);
      destroyBullet(b);
      Sound.hitWall();
      return;
    } else if (t === 2) { // thép
      if (b.power >= 3) damageSteel(b); // ngôi sao 3 phá được thép
      destroyBullet(b);
      Sound.hitSteel();
      return;
    }

    // đạn chạm đạn
    for (const ob of bullets) {
      if (ob === b || ob.dead) continue;
      if (ob.owner.isPlayer === b.owner.isPlayer && b.owner.isPlayer) continue; // đạn 2 người chơi xuyên nhau
      if (Math.abs(ob.x - b.x) < 4 && Math.abs(ob.y - b.y) < 5) {
        ob.dead = true; destroyBullet(b); return;
      }
    }

    // trúng xe
    const hit = bulletBlockedByTank(b, b.x, b.y);
    if (hit) {
      destroyBullet(b);
      hitTank(hit, b.owner);
      return;
    }
  }
}

function destroyBullet(b) {
  b.dead = true;
  b.owner.bullets = Math.max(0, b.owner.bullets - 1);
}

function explodeSmall(x, y) {
  explosions.push({ x, y, t: 0, small: true });
}

function damageBrick(b) {
  // phá khối con 8x8 tại vị trí chạm, và 1 khối vuông góc để tạo lỗ rộng
  const d = DIRS[b.dir];
  const cx = b.x + 1 + d.x * 3, cy = b.y + 2 + d.y * 3;
  const sx = Math.floor(cx / SUB), sy = Math.floor(cy / SUB);
  const clearCell = (x, y) => {
    if (x >= 0 && y >= 0 && x < GRID * 2 && y < GRID * 2 && terrain[y][x] === 1) {
      terrain[y][x] = 0;
      terrainDirty = true;
      explosions.push({ x: x * SUB + SUB / 2, y: y * SUB + SUB / 2, t: 6, small: true });
    }
  };
  clearCell(sx, sy);
  if (d.x !== 0) { clearCell(sx, sy - 1); clearCell(sx, sy + 1); }
  else { clearCell(sx - 1, sy); clearCell(sx + 1, sy); }
}

function damageSteel(b) {
  const d = DIRS[b.dir];
  const sx = Math.floor((b.x + 1 + d.x * 3) / SUB), sy = Math.floor((b.y + 2 + d.y * 3) / SUB);
  if (sx >= 0 && sy >= 0 && sx < GRID * 2 && sy < GRID * 2 && terrain[sy][sx] === 2) {
    terrain[sy][sx] = 0;
    terrainDirty = true;
    explosions.push({ x: sx * SUB + SUB / 2, y: sy * SUB + SUB / 2, t: 6, small: true });
  }
}

function hitTank(t, owner) {
  if (t.isPlayer) {
    if (t.helmetTimer > 0) { Sound.hitSteel(); return; }
    killPlayer(t);
  } else {
    t.hp = (t.hp || 1) - 1;
    if (t.hp <= 0) {
      t.dead = true;
      explosions.push({ x: t.x + TILE / 2, y: t.y + TILE / 2, t: 0 });
      Sound.boomBig();
      if (owner && owner.isPlayer) {
        const pts = { basic: 100, fast: 200, power: 300, armor: 400 }[t.type] || 100;
        score += pts;
        owner.kills = (owner.kills || 0) + 1;
        flashes.push({ x: t.x + TILE / 2, y: t.y, text: String(pts), t: 40 });
        Sound.score();
        // thả power-up nếu địch này nhấp nháy
        if (t.flashTimer > 0) dropPowerup();
      }
    } else {
      Sound.hitSteel();
      // đổi màu theo máu còn lại (bằng cách đổi sprite khi vẽ)
    }
  }
}

function killPlayer(p) {
  p.dead = true;
  explosions.push({ x: p.x + TILE / 2, y: p.y + TILE / 2, t: 0 });
  Sound.boomBig();
  p.lives--;
  p.respawnTimer = 90;
  p.starLevel = 0;
  p.maxBullets = 1;
  p.bulletSpeed = BULLET_SPEED;
}

function killBase() {
  if (!eagleAlive) return;
  eagleAlive = false;
  terrainDirty = true;
  explosions.push({ x: BASE_PX + TILE / 2, y: BASE_Y * TILE + TILE / 2, t: 0 });
  Sound.boomBig();
  endGame();
}

function endGame() {
  state = 'gameover';
  stateTimer = 0;
  Sound.gameover();
}

// ===================== POWER-UP =====================
const PU_TYPES = ['star', 'grenade', 'clock', 'tank', 'shovel', 'helmet'];

function dropPowerup() {
  powerups = []; // chỉ 1 cái trên sân
  const type = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
  // tìm ô có thể đứng được (không rơi vào tường/nước)
  let x, y, tries = 0;
  do {
    x = 8 + Math.floor(Math.random() * (GRID - 12)) * TILE;
    y = 8 + Math.floor(Math.random() * (GRID - 12)) * TILE;
  } while (rectBlocked(x, y, TILE, TILE, true) && tries++ < 30);
  powerups.push({ type, x, y, timer: 900 });
  Sound.powerup();
}

function applyPowerup(p, type) {
  switch (type) {
    case 'star':
      p.starLevel = Math.min(3, p.starLevel + 1);
      if (p.starLevel >= 2) p.maxBullets = 2;
      if (p.starLevel >= 1) p.bulletSpeed = FAST_BULLET_SPEED;
      break;
    case 'grenade':
      for (const e of enemies) {
        if (!e.dead && e.spawnFlash <= 0) {
          e.dead = true;
          explosions.push({ x: e.x + TILE / 2, y: e.y + TILE / 2, t: 0 });
          score += { basic: 100, fast: 200, power: 300, armor: 400 }[e.type] || 100;
        }
      }
      Sound.boomBig();
      break;
    case 'clock':
      frozenTimer = 600; // 10 giây
      break;
    case 'tank':
      p.lives++;
      break;
    case 'shovel':
      shovelTimer = 900; // 15 giây tường thép
      fortifyBase(true);
      break;
    case 'helmet':
      p.helmetTimer = 600;
      break;
  }
  score += 500;
  Sound.powerup();
}

function fortifyBase(steel) {
  // đổi tường quanh căn cứ sang thép (hoặc trả về gạch)
  const walls = [[11,23],[12,23],[13,23],[11,24],[13,24],[11,25],[12,25],[13,25]];
  for (const [gx, gy] of walls) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      if (terrain[gy * 2 + dy][gx * 2 + dx] === 1 || (steel && terrain[gy * 2 + dy][gx * 2 + dx] === 2) || terrain[gy * 2 + dy][gx * 2 + dx] === 0) {
        if (steel) terrain[gy * 2 + dy][gx * 2 + dx] = 2;
        else if (eagleAlive) terrain[gy * 2 + dy][gx * 2 + dx] = 1;
      }
    }
  }
  terrainDirty = true;
}

// ===================== AI ĐỊCH =====================
function enemyAI(e, T60) {
  e.aiTimer -= T60;
  if (e.aiTimer <= 0) {
    e.aiTimer = 20 + Math.floor(Math.random() * 40);
    // 3/12 hướng về người chơi/căn cứ, còn lại ngẫu nhiên
    const r = Math.random();
    if (r < 0.25) {
      // hướng về căn cứ
      e.dir = e.y > BASE_Y * TILE - TILE ? (BASE_PX + TILE/2 > e.x + TILE/2 ? 1 : 3) : 2;
    } else if (r < 0.5 && players.some(p => !p.dead)) {
      // đuổi người chơi gần nhất
      let best = null, bd = 1e9;
      for (const p of players) {
        if (p.dead) continue;
        const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        const dx = best.x - e.x, dy = best.y - e.y;
        e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      }
    } else {
      e.dir = Math.floor(Math.random() * 4);
    }
    // bắn ngẫu nhiên, thường hơn khi thẳng hàng với người chơi/căn cứ
    const d = DIRS[e.dir];
    const alignedBase = Math.abs((e.x + TILE/2) - (BASE_PX + TILE/2)) < TILE && e.dir === 2;
    const alignedPlayer = players.some(p => {
      if (p.dead) return false;
      return (e.dir === 0 || e.dir === 2) ? Math.abs(p.x - e.x) < TILE : Math.abs(p.y - e.y) < TILE;
    });
    const fireChance = (alignedBase || alignedPlayer) ? 0.5 : 0.12;
    if (Math.random() < fireChance && e.bullets === 0) fireBullet(e);
  }
}

// ===================== CẬP NHẬT =====================
function update(dt) {
  const T60 = dt * 60;              // đếm theo nhịp 60fps để độc lập tần số quét
  waterFrame += dt;
  if (waterFrame > 0.5) waterFrame = 0;

  if (state !== 'playing') {
    stateTimer += dt;
    updateExplosions(dt);
    return;
  }

  // spawn địch
  spawnTimer -= T60;
  const onField = enemies.filter(e => !e.dead).length;
  if (spawnQueue.length > 0 && onField < MAX_ON_FIELD && spawnTimer <= 0) {
    const type = spawnQueue.shift();
    // chọn điểm spawn không bị chiếm (ưu tiên ngẫu nhiên trong các vị trí trống)
    const free = SPAWNS.filter(s => {
      const occupied = enemies.some(e => !e.dead && e.x === s.x && e.y === s.y) ||
                       players.some(p => !p.dead && Math.abs(p.x - s.x) < TILE && Math.abs(p.y - s.y) < TILE);
      return !occupied;
    });
    const sp = free.length ? free[Math.floor(Math.random() * free.length)]
                           : SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
    const e = makeEnemy(type, sp.x, sp.y);
    if (spawnQueue.length % 4 === 3) e.flashTimer = 1e9; // định kỳ: 1 địch mang power-up
    enemies.push(e);
    spawnTimer = 120;
  }

  if (frozenTimer > 0) frozenTimer -= T60;
  if (shovelTimer > 0) {
    shovelTimer -= T60;
    if (shovelTimer <= 0) fortifyBase(false); // trả về gạch
  }

  // người chơi
  for (const p of players) {
    if (p.dead) {
      p.respawnTimer -= T60;
      if (p.respawnTimer <= 0) {
        if (p.lives >= 0) {
          p.dead = false;
          p.x = p.idx === 0 ? PLAYER_SPAWN.x : PLAYER2_SPAWN.x;
          p.y = p.idx === 0 ? PLAYER_SPAWN.y : PLAYER2_SPAWN.y;
          p.dir = 0;
          p.bullets = 0;
          p.cooldown = 0;
          p.spawnFlash = 90;
          p.helmetTimer = 180;
        }
      }
      continue;
    }
    if (p.spawnFlash > 0) { p.spawnFlash -= T60; continue; }
    if (p.helmetTimer > 0) p.helmetTimer -= T60;
    if (p.cooldown > 0) p.cooldown -= T60;

    // điều khiển
    let wantDir = -1;
    if (p.idx === 0) {
      if (keys['ArrowUp'] || keys['KeyW']) wantDir = 0;
      else if (keys['ArrowRight'] || keys['KeyD']) wantDir = 1;
      else if (keys['ArrowDown'] || keys['KeyS']) wantDir = 2;
      else if (keys['ArrowLeft'] || keys['KeyA']) wantDir = 3;
      if (keys['Space']) fireBullet(p);
    } else {
      // Người 2: I/J/K/L + F
      if (keys['KeyI']) wantDir = 0;
      else if (keys['KeyL']) wantDir = 1;
      else if (keys['KeyK']) wantDir = 2;
      else if (keys['KeyJ']) wantDir = 3;
      if (keys['KeyF']) fireBullet(p);
    }

    p.moving = wantDir !== -1;
    if (p.moving) {
      if (wantDir !== p.dir) { p.dir = wantDir; snapToGrid(p); }
      moveTank(p, p.speed * dt * (p.slides > 0 ? 1.5 : 1), true);
    } else if (p.slides > 0) {
      moveTank(p, p.speed * dt * 1.5, true); // trượt trên băng
    }
    if (p.slides > 0) p.slides -= T60;
  }

  // địch
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.spawnFlash > 0) { e.spawnFlash -= T60; continue; }
    if (e.flashTimer > 0 && e.flashTimer !== 1e9) e.flashTimer -= T60;
    if (frozenTimer > 0) continue; // bị đóng băng
    if (e.cooldown > 0) e.cooldown -= T60;

    enemyAI(e, T60);
    const moved = moveTank(e, e.speed * dt, false);
    if (!moved && e.moving) {
      // bị chặn: thử đổi hướng ngay
      e.aiTimer = 0;
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // đạn
  for (const b of bullets) {
    if (!b.dead) updateBullet(b, dt);
  }
  bullets = bullets.filter(b => !b.dead);

  updateExplosions(dt);

  // power-up
  for (const pu of powerups) {
    pu.timer -= T60;
    for (const p of players) {
      if (!p.dead && p.spawnFlash <= 0 &&
          p.x < pu.x + TILE && p.x + TILE > pu.x &&
          p.y < pu.y + TILE && p.y + TILE > pu.y) {
        applyPowerup(p, pu.type);
        pu.timer = 0;
      }
    }
  }
  powerups = powerups.filter(pu => pu.timer > 0);

  // nhấp nháy điểm
  for (const f of flashes) f.t -= T60;
  flashes = flashes.filter(f => f.t > 0);

  // thắng màn?
  if (spawnQueue.length === 0 && enemies.length === 0 && state === 'playing') {
    state = 'stageclear';
    stateTimer = 0;
  }

  // game over khi hết mạng?
  if (players.every(p => p.dead && p.lives < 0) && state === 'playing') {
    endGame();
  }
}

function updateExplosions(dt) {
  for (const ex of explosions) ex.t += dt * 60;
  explosions = explosions.filter(ex => ex.t < (ex.small ? 8 : 16));
}

function moveTank(t, dist, isPlayer) {
  const d = DIRS[t.dir];
  let moved = false;
  let remaining = dist;
  while (remaining > 0) {
    const step = Math.min(1, remaining);
    const nx = t.x + d.x * step, ny = t.y + d.y * step;
    if (!tankBlocked(t, nx, ny)) {
      t.x = nx; t.y = ny; moved = true;
      // phát hiện băng
      if (isPlayer) {
        const c = tAt(t.x + TILE/2, t.y + TILE/2);
        if (c === 5 && t.slides <= 0) t.slides = 30;
      }
    } else break;
    remaining -= step;
  }
  // căn snap khi đi hết ô
  if (moved) {
    if (d.x !== 0) t.y = Math.round(t.y / 2) * 2;
    else t.x = Math.round(t.x / 2) * 2;
  }
  return moved;
}

// xoay 90° thì căn vào lưới 8px để đi thẳng hàng (không snap nếu bị kẹt tường)
function snapToGrid(t) {
  const half = TILE / 2;
  if (t.dir === 0 || t.dir === 2) {
    const snapped = Math.round(t.x / half) * half;
    if (snapped !== t.x && !tankBlocked(t, snapped, t.y)) t.x = snapped;
  } else {
    const snapped = Math.round(t.y / half) * half;
    if (snapped !== t.y && !tankBlocked(t, t.x, snapped)) t.y = snapped;
  }
}

// ===================== VẼ =====================
// Địa hình tĩnh (gạch/thép/băng/đại bàng) render vào offscreen, chỉ redraw khi đổi
function renderTerrain() {
  if (!terrainCanvas) {
    terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = W; terrainCanvas.height = W;
  }
  const g = terrainCanvas.getContext('2d');
  g.clearRect(0, 0, W, W);
  for (let gy = 0; gy < GRID * 2; gy += 2) {
    for (let gx = 0; gx < GRID * 2; gx += 2) {
      const t = terrain[gy][gx];
      const px = gx * SUB, py = gy * SUB;
      if (t === 1) g.drawImage(TEX.brick, px, py);
      else if (t === 2) g.drawImage(TEX.steel, px, py);
      else if (t === 5) g.drawImage(TEX.ice, px, py);
      else if (t === 6) g.drawImage(eagleAlive ? TEX.eagleAlive : TEX.eagleDead, px - 8, py - 8, 32, 32);
    }
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, W);

  if (state === 'title') {
    drawTitle();
    return;
  }

  // địa hình tĩnh (cache) + nước động
  if (terrainDirty) { renderTerrain(); terrainDirty = false; }
  ctx.drawImage(terrainCanvas, 0, 0);
  const wf = waterFrame < 0.25 ? 0 : 1;
  for (const [gx, gy] of waterCells) {
    if (gy % 2 === 0 && gx % 2 === 0) ctx.drawImage(TEX.water[wf], gx * SUB, gy * SUB);
  }

  // power-up
  for (const pu of powerups) {
    if (Math.floor(pu.timer / 8) % 2 === 0 || pu.timer > 700) {
      ctx.drawImage(TEX.powerups[pu.type], pu.x, pu.y);
    }
  }

  // xe tăng
  for (const p of players) drawTank(p);
  for (const e of enemies) drawTank(e);

  // đạn
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x + 1.5, b.y + 2);
    ctx.rotate(b.dir * Math.PI / 2);
    ctx.drawImage(TEX.bullet, -1.5, -2);
    ctx.restore();
  }

  // rừng vẽ đè (danh sách đã tính trước)
  for (const [gx, gy] of forestCells) {
    if (gx % 2 === 0 && gy % 2 === 0) ctx.drawImage(TEX.forest, gx * SUB, gy * SUB);
  }

  // nổ
  for (const ex of explosions) {
    const size = ex.small ? 8 : 16;
    const phase = ex.t < (ex.small ? 4 : 8) ? TEX.boom1 : TEX.boom2;
    ctx.drawImage(phase, ex.x - size / 2, ex.y - size / 2, size, size);
  }

  // điểm nhấp nháy
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = '#fff';
  for (const f of flashes) {
    ctx.fillText(f.text, f.x - 8, f.y - (40 - f.t) / 4);
  }

  // khiên người chơi
  for (const p of players) {
    if (p.dead || p.helmetTimer <= 0) continue;
    if (Math.floor(p.helmetTimer / 4) % 2 === 0) {
      ctx.strokeStyle = '#8fd8ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 1.5, p.y - 1.5, TILE + 3, TILE + 3);
    }
  }

  // HUD
  updateHUD();

  if (state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, W / 2 - 20, W, 40);
    ctx.fillStyle = '#e8b430';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('TẠM DỪNG', W / 2 - 44, W / 2 + 6);
  }
  if (state === 'stageclear') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, W / 2 - 44, W, 88);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MÀN ' + stage + ' HOÀN THÀNH!', W / 2, W / 2 - 4);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Điểm: ' + score, W / 2, W / 2 + 22);
    ctx.textAlign = 'left';
  }
  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#e04a3a';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, W / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('Điểm: ' + score + ' — Màn: ' + stage, W / 2, W / 2 + 22);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText('Nhấn ENTER để chơi lại', W / 2, W / 2 + 48);
    ctx.textAlign = 'left';
  }
}

function drawTank(t) {
  if (t.dead) return;
  const spawn = t.spawnFlash > 0;
  if (spawn) {
    // hiệu ứng sao xuất hiện
    const f = Math.floor(t.spawnFlash / 6) % 4;
    ctx.fillStyle = ['#fff', '#e8b430', '#8fd8ff', '#fff'][f];
    const cx = t.x + TILE / 2, cy = t.y + TILE / 2, r = 4 + f * 2;
    ctx.fillRect(cx - r, cy - 1, r * 2, 2);
    ctx.fillRect(cx - 1, cy - r, 2, r * 2);
    return;
  }

  let kind;
  if (t.isPlayer) {
    kind = (t.starLevel > 0) ? 'playerUp' : 'player';
    if (t.idx === 1) { /* người 2: vẽ nguyên bản, có thể thêm viền */ }
  } else {
    kind = t.type;
  }
  const sprite = TEX.tanks[kind][t.dir];
  ctx.drawImage(sprite, t.x, t.y);

  // địch máu cao: vẽ lưới màu theo hp
  if (!t.isPlayer && t.type === 'armor' && t.hp < 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    if (t.hp === 3) ctx.fillRect(t.x, t.y + 7, TILE, 2);
    else if (t.hp === 2) { ctx.fillRect(t.x, t.y + 7, TILE, 2); ctx.fillRect(t.x + 7, t.y, 2, TILE); }
  }

  // địch mang power-up nhấp nháy
  if (!t.isPlayer && t.flashTimer > 0 && Math.floor(Date.now() / 120) % 2 === 0) {
    ctx.fillStyle = 'rgba(230,60,60,0.4)';
    ctx.fillRect(t.x, t.y, TILE, TILE);
  }
}

function drawTitle() {
  ctx.fillStyle = '#e8b430';
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BATTLE', W / 2, 120);
  ctx.fillText('CITY', W / 2, 165);

  ctx.drawImage(TEX.tanks.playerUp[1], W / 2 - 60, 200);
  ctx.drawImage(TEX.tanks.basic[3], W / 2 + 20, 200);

  ctx.fillStyle = '#fff';
  ctx.font = '15px "Courier New", monospace';
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillText('NHẤN ENTER ĐỂ BẮT ĐẦU', W / 2, 300);
  }
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('1 — 1 người     2 — 2 người', W / 2, 340);
  ctx.textAlign = 'left';
}

// ===================== HUD =====================
function updateHUD() {
  const icons = document.getElementById('enemy-icons');
  const left = spawnQueue.length + enemies.length;
  if (icons.childElementCount !== left) {
    icons.innerHTML = '';
    for (let i = 0; i < left; i++) {
      const d = document.createElement('div');
      d.className = 'e';
      icons.appendChild(d);
    }
  }
  document.getElementById('score').textContent = score;
  document.getElementById('stage').textContent = stage;
  const p0 = players[0];
  document.getElementById('lives').textContent = p0 ? Math.max(0, p0.lives) : 0;
  document.getElementById('flag').textContent = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][(stage - 1) % 10];
}

// ===================== VÒNG LẶP =====================
// Sim theo thời gian thực (dt) nên tốc độ giống nhau trên mọi tần số quét,
// phím bấm phản hồi ngay theo từng frame render.
let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;                    // tránh "jump" khi tab bị treo/ẩn
  if (state !== 'paused') {
    try { update(dt); }
    catch (e) { console.error('update error:', e); }
  }
  try { draw(); }
  catch (e) { console.error('draw error:', e); }
  requestAnimationFrame(loop);
}

// ===================== ĐIỀU KHIỂN =====================
window.addEventListener('keydown', (ev) => {
  keys[ev.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(ev.code)) ev.preventDefault();

  if (ev.code === 'KeyM') {
    const on = Sound.toggle();
    document.getElementById('overlay-msg').textContent = on ? 'ÂM THANH: BẬT' : 'ÂM THANH: TẮT';
    setTimeout(() => { if (state === 'title') resetOverlay(); }, 1200);
  }

  // bắn ngay tại thời điểm nhấn phím (không chờ frame update) để không cảm giác "trễ"
  if (state === 'playing') {
    if (ev.code === 'Space' && players[0]) fireBullet(players[0]);
    if (ev.code === 'KeyF' && players[1]) fireBullet(players[1]);
  }

  if (ev.code === 'KeyP' && (state === 'playing' || state === 'paused')) {
    state = state === 'playing' ? 'paused' : 'playing';
  }

  if (ev.code === 'Enter') {
    if (state === 'title' || state === 'gameover') startGame();
  }

  if (state === 'title') {
    if (ev.code === 'Digit1') { playerCount = 1; }
    if (ev.code === 'Digit2') { playerCount = 2; }
  }
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });

function resetOverlay() {
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlay-msg').textContent = 'NHẤN ENTER ĐỂ BẮT ĐẦU';
}

function startGame() {
  score = 0;
  stage = 1;
  buildStage(stage);
  state = 'playing';
  document.getElementById('overlay').classList.add('hidden');
  Sound.stageStart();
}

// sang màn mới
function nextStage() {
  stage++;
  buildStage(stage);
  state = 'playing';
  Sound.stageStart();
}

// Enter ở màn hình stageclear -> nextStage
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Enter' && state === 'stageclear') nextStage();
});

// ===================== KHỞI ĐỘNG =====================
buildStage(1);
players = []; // màn hình title chưa có người chơi
updateHUDStatic();
requestAnimationFrame(loop);

function updateHUDStatic() {
  document.getElementById('stage').textContent = stage;
  document.getElementById('flag').textContent = 'I';
}
