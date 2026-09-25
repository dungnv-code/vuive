/* =========================================================
   WOLFENSTEIN 3D — Engine (thuần JS, không thư viện)
   Raycasting + billboard sprites + HUD + âm thanh WebAudio.
   ========================================================= */
'use strict';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const FOV = Math.PI / 3;
const NUM_RAYS = 320;
const COL_W = W / NUM_RAYS;

const wallTex = t => WALLS[t] || WALLS[1];

const TAN_HFOV = Math.tan(FOV / 2);
const rayBx = new Float32Array(NUM_RAYS);
const rayInvLen = new Float32Array(NUM_RAYS);
for (let r = 0; r < NUM_RAYS; r++) {
  rayBx[r] = (2 * r / NUM_RAYS - 1) * TAN_HFOV;
  rayInvLen[r] = 1 / Math.hypot(1, rayBx[r]);
}
const zBuffer = new Float32Array(NUM_RAYS);
const lowTopY = new Float32Array(NUM_RAYS); // mép trên (px) của hòm che phía dưới cột
const lowTopD = new Float32Array(NUM_RAYS); // khoảng cách hòm che gần nhất
const FOG_COLOR = '#06060a';
const COL_ALLY = '#45ff7a', COL_ENEMY = '#ff4a4a';

const ENEMY_STATS = {
  guard:   { hp: 25,  speed: 1.7, gun: 'pistol',   aggro: 9,   dmg: 6,  bite: 0 },
  officer: { hp: 40,  speed: 2.3, gun: 'smg',      aggro: 10,  dmg: 4,  bite: 0 },
  gunner:  { hp: 90,  speed: 1.3, gun: 'chain',    aggro: 11,  dmg: 9,  bite: 0 },
  sniper:  { hp: 35,  speed: 1.1, gun: 'rifle',    aggro: 17,  dmg: 16, bite: 0 },
  boss:    { hp: 220, speed: 1.0, gun: 'rocket',   aggro: 13,  dmg: 20, bite: 0 },
  dog:     { hp: 15,  speed: 3.4, gun: 'melee',    aggro: 10,  dmg: 9,  bite: .8 }
};
const ENEMY_GUNS = {
  pistol:   { range: 10, rate: 1.05, hit: .55 },
  smg:      { range: 12, rate: .28,  hit: .42 },
  chain:    { range: 11, rate: .34,  hit: .58 },
  rifle:    { range: 24, rate: 1.5,  hit: .75 },
  rocket:   { range: 16, rate: 1.3,  hit: 1,    proj: 5.0, splash: 1.5 }
};
const ALLY_STATS = {
  rifle: { hp: 70, dmg: 12, rate: 1.1, range: 15, speed: 2.0 },
  smg:   { hp: 60, dmg: 5,  rate: .26, range: 11, speed: 2.5 }
};
const ALLY_RESPAWN = 6;
const ALLY_SFX = { rifle: 'pistol', smg: 'mg' };

/* ---------------- Trạng thái game ---------------- */
let levelIdx = 0;
let level = null, grid = null, GW = 0, GH = 0;
let player, enemies, allies, pickups, doors, pushwalls;
let gameState = 'title'; // title | play | dead | win
let runId = 0; // chống timeout của ván cũ after restart
let stats = { kills: 0, secrets: 0, treasures: 0, time: 0, totalKills: 0, alliesLost: 0 };
let bullets = [];
let tracers = [];
let explosions = [];
let shake = 0;
let clearTimer = -1;

const keys = {};
let mouseDown = false;

/* ---------------- Âm thanh WebAudio ---------------- */
let actx = null;
function AC() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }
function tone(freq, dur, type = 'square', vol = .08, slide = 0) {
  try {
    const a = AC(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch (e) {}
}
function noiseBurst(dur, vol = .12, freq = 800) {
  try {
    const a = AC(), len = a.sampleRate * dur;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  } catch (e) {}
}
const SFX = {
  knife:    () => noiseBurst(.08, .06, 2500),
  pistol:   () => { noiseBurst(.09, .14, 1600); tone(180, .06, 'square', .05, -80); },
  mg:       () => { noiseBurst(.06, .12, 1400); tone(150, .05, 'square', .04, -60); },
  chaingun: () => { noiseBurst(.05, .13, 1200); tone(130, .04, 'square', .04, -50); },
  shotgun:  () => { noiseBurst(.13, .2, 900); tone(95, .14, 'square', .07, -50); },
  sniper:   () => { noiseBurst(.14, .22, 2200); tone(170, .12, 'square', .06, -140); },
  rocket:   () => { tone(90, .2, 'sawtooth', .09, -50); noiseBurst(.14, .14, 500); },
  boom:     () => { noiseBurst(.5, .2, 200); tone(60, .4, 'sawtooth', .14, -40); },
  enemyGun: () => noiseBurst(.08, .07, 900),
  hurt:     () => tone(220, .18, 'sawtooth', .1, -120),
  die:      () => { tone(300, .5, 'sawtooth', .12, -240); noiseBurst(.4, .1, 500); },
  enemyDie: () => { tone(240, .3, 'square', .08, -160); noiseBurst(.25, .08, 700); },
  dogBite:  () => noiseBurst(.12, .1, 3000),
  pickup:   () => { tone(660, .07); setTimeout(() => tone(880, .09), 60); },
  secret:   () => { tone(523, .1); setTimeout(() => tone(659, .1), 90); setTimeout(() => tone(784, .18), 180); },
  door:     () => noiseBurst(.25, .06, 300),
  locked:   () => tone(140, .15, 'square', .08, -40),
  push:     () => noiseBurst(.4, .08, 220),
  win:      () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .15), i * 130)); }
};

/* ---------------- Khởi tạo màn chơi ---------------- */
function loadLevel(idx) {
  runId++;
  levelIdx = idx;
  const data = parseLevel(LEVELS[idx]);
  grid = data.grid; GW = data.W; GH = data.H;
  clearTimer = -1;
  player = {
    x: data.player.x, y: data.player.y, dir: data.player.dir,
    hp: 100, weapon: 1, variant: 0,
    hasWeapon: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
    vert: 0, jumpV: 0, jumping: false,
    pitch: 0,
    alive: true
  };
  bloom = .012; aimKick = 0; scopeZoom = 1; fireTimer = 0; muzzle = 0;
  stats = { kills: 0, secrets: 0, treasures: 0, time: 0, totalKills: data.enemies.length, alliesLost: 0 };
  enemies = data.enemies.map(e => {
    const s = ENEMY_STATS[e.type];
    return {
      ...e,
      hp:    s.hp, speed: s.speed, gun: s.gun, dmg: s.dmg, bite: s.bite, aggro: s.aggro,
      state: 'idle', timer: Math.random() * 1.5, flash: 0,
      dead: false, deathTimer: 0,
      vert: 0, jumpV: 0, jumping: false,
      strafeT: 0, strafeDur: 0, strafeDir: 0
    };
  });
  allies = data.allies.map(a => {
    const s = ALLY_STATS[a.type];
    return {
      x: a.x, y: a.y, type: a.type,
      hp: s.hp, dmg: s.dmg, rate: s.rate, range: s.range, speed: s.speed,
      timer: Math.random(), flash: 0,
      dead: false, deathTimer: 0, respawn: 0, home: { x: a.x, y: a.y }
    };
  });
  pickups = data.pickups.map(p => ({ ...p, taken: false }));
  doors = {};
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const t = grid[y][x];
    if (t === 90 || t === 91) doors[`${x},${y}`] = { x, y, open: 0, opening: false, locked: t === 91 };
  }
  pushwalls = data.pushwalls.map(p => ({ ...p }));
  bullets = [];
  tracers = [];
  explosions = [];
  level = data;
}

/* ---------------- Va chạm lưới ---------------- */
function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= GW || y >= GH) return 1;
  return grid[y | 0][x | 0];
}
function isSolid(t) { return t > 0 && t < 90; }

// HÒM (tile 7): ngại vật thấp — nhảy lên đứng được, đạn/đường ngắm bay qua
const CRATE_H = .45;   // chiều cao hòm (phân số của chiều cao tường)
const isCrate = t => t === 7;
function crateUnderH() { return isCrate(tileAt(player.x, player.y)) ? CRATE_H : 0; }

function opaqueBase(t) {
  if (isSolid(t) || t === 200) return true;
  if (t === 90 || t === 91) return true;
  return false;
}
// chặn tầm nhìn/đạn: tường, pushwall, cửa chưa mở (hòm thì bỏ qua → bắn qua được)
function opaque(x, y) {
  const t = tileAt(x, y);
  if (isCrate(t)) return false;
  if (t === 90 || t === 91) {
    const d = doors[`${x | 0},${y | 0}`];
    return !(d && d.open > .7);
  }
  return opaqueBase(t);
}
// tầm nhìn của địch/đồng đội: hòm vẫn chặn (chúng bắn từ tầm thấp)
// nhưng người chơi ĐANG ĐỨNG TRÊN hòm thì lộ đầu → không bị chặn
function opaqueEnemy(x, y) {
  const t = tileAt(x, y);
  if (isCrate(t)) {
    if (player && player.vert >= CRATE_H - .04 &&
        (player.x | 0) === (x | 0) && (player.y | 0) === (y | 0)) return false;
    // kẻ địch (boss) đứng/nhảy trên hòm cũng lộ đầu ra
    for (const e of enemies) {
      if (!e.dead && (e.vert || 0) >= CRATE_H - .04 &&
          (e.x | 0) === (x | 0) && (e.y | 0) === (y | 0)) return false;
    }
    return true;
  }
  return opaque(x, y);
}
function blocked(x, y) {
  const t = tileAt(x, y);
  if (isSolid(t) || t === 200) return true;
  if (t === 90 || t === 91) {
    const d = doors[`${x | 0},${y | 0}`];
    return !(d && d.open > .7);
  }
  return false;
}
function canMove(x, y, r) {
  return !blocked(x - r, y - r) && !blocked(x + r, y - r) &&
         !blocked(x - r, y + r) && !blocked(x + r, y + r);
}
// unit (player/địch) được phép bay qua hòm khi đang nhảy cao hơn hòm
function unitMoveAllowed(u, x, y, r) {
  if (canMove(x, y, r)) return true;
  if ((u.vert || 0) >= CRATE_H - .04) {
    const corners = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (const [cx, cy] of corners)
      if (blocked(cx, cy) && !isCrate(tileAt(cx, cy))) return false;
    return true;
  }
  return false;
}
// người chơi được phép bay qua hòm khi đang nhảy cao hơn hòm
function moveAllowed(x, y, r) {
  return unitMoveAllowed(player, x, y, r);
}
function moveUnit(u, mx, my, r) {
  let ok = false;
  if (mx !== 0 && my !== 0 && unitMoveAllowed(u, u.x + mx, u.y + my, r)) { u.x += mx; u.y += my; ok = true; }
  else if (mx !== 0 && unitMoveAllowed(u, u.x + mx, u.y, r)) { u.x += mx; ok = true; }
  else if (my !== 0 && unitMoveAllowed(u, u.x, u.y + my, r)) { u.y += my; ok = true; }
  return ok;
}
// trọng lực cho kẻ địch nhảy lên hòm (boss)
function crateUnderUnit(u) { return isCrate(tileAt(u.x, u.y)) ? CRATE_H : 0; }
function updateEnemyJump(e, dt) {
  const gH = crateUnderUnit(e);
  if (e.jumping) {
    e.vert += e.jumpV * dt;
    e.jumpV -= 16 * dt;
    if (e.vert <= gH && e.jumpV <= 0) { e.vert = gH; e.jumpV = 0; e.jumping = false; }
  } else if (e.vert > gH) {
    e.vert = Math.max(gH, e.vert - dt * 7);
  }
}
// boss có hòm đang đè vào thân (phía trước hoặc mắc lại sau lưng)?
function crateOverlapUnit(u) {
  const r = .3 + .02; // bù dung sai để không kẹt sát mép hòm do làm tròn
  const pts = [[u.x - r, u.y - r], [u.x + r, u.y - r], [u.x - r, u.y + r], [u.x + r, u.y + r]];
  for (const [px, py] of pts)
    if (blocked(px, py) && isCrate(tileAt(px, py))) return true;
  return false;
}
// boss di chuyển linh hoạt: áp sát + né ngang (strafe) + nhảy qua hòm
function bossMove(e, t, spd, dt) {
  let dx = t.u.x - e.x, dy = t.u.y - e.y;
  const d = Math.hypot(dx, dy) || .001;
  dx /= d; dy /= d;

  e.strafeT -= dt;
  if (e.strafeT <= 0) {
    e.strafeT = 1 + Math.random() * 1.8;
    e.strafeDur = .6 + Math.random() * 1.3;
    e.strafeDir = Math.random() < .35 ? 0 : (Math.random() < .5 ? -1 : 1);
  }
  if (e.strafeDur > 0) e.strafeDur -= dt;

  let mx, my;
  if (e.strafeDur > 0 && e.strafeDir !== 0) {
    mx = -dy * e.strafeDir * spd * 1.5;
    my =  dx * e.strafeDir * spd * 1.5;
  } else {
    mx = dx * spd; my = dy * spd;
  }
  // bay trong không trung: thêm đà ngang để vượt trọn hòm
  if (e.jumping && (e.vert || 0) >= CRATE_H * .6) { mx *= 2.6; my *= 2.6; }

  const ok = moveUnit(e, mx, my, .3);
  if (!ok) {
    if (!e.jumping && crateOverlapUnit(e)) { e.jumping = true; e.jumpV = 9; e.vert = 0; }
    moveUnit(e, -dy * spd * .4, dx * spd * .4, .3);
  }
}

// GÓC NHÌN LÊN/XUỐNG (pitch) — dịch chuyển toàn cảnh theo pixel
const PITCH_MAX = .42;
function pitchPx() { return Math.max(-72, Math.min(72, player.pitch * 250)); }

// vị trí mép trên của hòm trên màn hình (dùng để cắt sprite phía sau)
function crateTopPx(dl, vert, pxV) {
  const lineH = (H / dl) | 0;
  const bottom = (H + lineH) / 2 + vert * (H / dl) + pxV;
  return bottom - lineH * CRATE_H;
}

/* ---------------- Cửa & pushwall ---------------- */
function tryAction() {
  const dx = Math.cos(player.dir), dy = Math.sin(player.dir);
  const tx = (player.x + dx * .9) | 0, ty = (player.y + dy * .9) | 0;
  const t = tileAt(tx, ty);

  if (t === 90 || t === 91) {
    const d = doors[`${tx},${ty}`];
    if (d.locked) { SFX.locked(); flash('CỬA BỊ KHÓA!'); return; }
    if (!d.opening) { d.opening = true; SFX.door(); }
    return;
  }
  // pushwall: đẩy ô phía trước
  for (const p of pushwalls) {
    if (!p.active && p.x === tx && p.y === ty && grid[ty][tx] === 200) {
      let ddx = Math.round(dx), ddy = Math.round(dy);
      if (Math.abs(dx) > Math.abs(dy)) { ddy = 0; if (!ddx) ddx = 1; } else { ddx = 0; if (!ddy) ddy = 1; }
      const nx = p.x + ddx, ny = p.y + ddy;
      if (tileAt(nx, ny) === 0) {
        p.active = true;
        grid[ty][tx] = 0; grid[ny][nx] = 200;
        p.x = nx; p.y = ny;
        stats.secrets++; SFX.push(); SFX.secret(); flash('BÍ MẬT!');
      }
      return;
    }
  }
}

function enemyOnTile(x, y) {
  for (const e of enemies) if (!e.dead && (e.x | 0) === x && (e.y | 0) === y) return true;
  return false;
}

function updateDoors(dt) {
  for (const k in doors) {
    const d = doors[k];
    if (d.opening && d.open < 1) {
      d.open = Math.min(1, d.open + dt * 1.6);
    } else if (!d.opening && d.open > 0) {
      const playerOn = (player.x | 0) === d.x && (player.y | 0) === d.y;
      const enemyOn = enemyOnTile(d.x, d.y);
      if (!playerOn && !enemyOn) d.open = Math.max(0, d.open - dt * 1.2);
      else d.opening = true;
    }
  }
}

/* ================= HỆ VŨ KHÍ PUBG — 8 NHÓM =================
   Chọn nhóm bằng phím 1-8; nhấn lại số để đổi dòng súng trong nhóm.
   Đặc tính: dmg sát thương / rate giây mỗi phát / range tầm bắn /
   rec độ giật mỗi phát / maxB độ giật tối đa / auto full-auto /
   bolt nạp đạn / pellets+spread đạn shotgun chùm. */
const GUNS = [
  {
    label: 'AR · SÚNG TRƯỜNG',
    guns: [
      { name: 'M416',       dmg: 24, rate: .105, range: 26, rec: .006,  maxB: .030, auto: true,  sfx: 'mg' },
      { name: 'AKM',        dmg: 28, rate: .110, range: 25, rec: .016,  maxB: .070, auto: true,  sfx: 'mg' },
      { name: 'Beryl M762', dmg: 29, rate: .092, range: 24, rec: .018,  maxB: .080, auto: true,  sfx: 'mg' },
      { name: 'Groza',      dmg: 30, rate: .088, range: 26, rec: .010,  maxB: .045, auto: true,  sfx: 'mg' }
    ]
  },
  {
    label: 'SR · BẮN TỈA', scope: true,
    guns: [
      { name: 'Kar98k', dmg: 62,  rate: 1.35, range: 45, rec: .006, maxB: .020, bolt: true, sfx: 'sniper' },
      { name: 'M24',    dmg: 72,  rate: 1.65, range: 48, rec: .006, maxB: .022, bolt: true, sfx: 'sniper' },
      { name: 'AWM',    dmg: 95,  rate: 1.9,  range: 52, rec: .008, maxB: .024, bolt: true, sfx: 'sniper' }
    ]
  },
  {
    label: 'DMR · THIỆN XẠ',
    guns: [
      { name: 'Mini 14',  dmg: 26, rate: .20, range: 32, rec: .006,  maxB: .030, sfx: 'pistol' },
      { name: 'SLR',      dmg: 30, rate: .28, range: 32, rec: .012,  maxB: .055, sfx: 'pistol' },
      { name: 'Mk14 EBR', dmg: 34, rate: .16, range: 34, rec: .010,  maxB: .055, auto: true,  sfx: 'mg' }
    ]
  },
  {
    label: 'SMG · TIỂU LIÊN',
    guns: [
      { name: 'UMP45',     dmg: 18, rate: .085, range: 18, rec: .006, maxB: .038, auto: true, sfx: 'mg' },
      { name: 'Micro UZI', dmg: 13, rate: .050, range: 15, rec: .010, maxB: .050, auto: true, sfx: 'mg' },
      { name: 'Vector',    dmg: 15, rate: .044, range: 16, rec: .011, maxB: .055, auto: true, sfx: 'mg' }
    ]
  },
  {
    label: 'SG · SHOTGUN',
    guns: [
      { name: 'S686', dmg: 16, rate: .95, range: 10, rec: .020, maxB: .060, pellets: 7,  spread: .11, sfx: 'shotgun' },
      { name: 'S12K', dmg: 13, rate: .55, range: 10, rec: .016, maxB: .055, pellets: 8,  spread: .12, auto: true, sfx: 'shotgun' },
      { name: 'DBS',  dmg: 12, rate: .85, range: 10, rec: .022, maxB: .070, pellets: 10, spread: .15, sfx: 'shotgun' }
    ]
  },
  {
    label: 'LMG · SÚNG MÁY HẠNG NHẸ',
    guns: [
      { name: 'DP-28', dmg: 24, rate: .120, range: 28, rec: .012, maxB: .065, auto: true, sfx: 'chaingun' },
      { name: 'M249',  dmg: 19, rate: .080, range: 27, rec: .009, maxB: .055, auto: true, sfx: 'chaingun' }
    ]
  },
  {
    label: 'PISTOL · SÚNG LỤC',
    guns: [
      { name: 'P92',        dmg: 16, rate: .26, range: 20, rec: .004, maxB: .025, sfx: 'pistol' },
      { name: 'P18C',       dmg: 13, rate: .055,range: 16, rec: .007, maxB: .040, auto: true,  sfx: 'mg' },
      { name: 'Desert Eagle', dmg: 36, rate: .55, range: 24, rec: .014, maxB: .060, sfx: 'pistol' }
    ]
  },
  {
    label: 'GL · SÚNG PHÓNG LỰU',
    guns: [
      { name: 'GP-25', dmg: 60, rate: .90, range: 20, rec: .014, maxB: .050, proj: 5.5, splash: 2.2, sfx: 'rocket' },
      { name: 'M79',   dmg: 72, rate: 1.25,range: 22, rec: .018, maxB: .060, proj: 6.0, splash: 2.6, sfx: 'rocket' }
    ]
  }
];

const curFam = () => GUNS[player.weapon - 1];
const curGun = () => GUNS[player.weapon - 1].guns[player.variant];

let fireTimer = 0, muzzle = 0;
let bloom = .012;         // độ giật lan ra (sai số đường đạn)
let aimKick = 0;          // tâm bắn nẩy lên khi bắn
let scopeZoom = 1;        // zoom ngắm của súng bắn tỉa
let mouseWasDown = false;
let rightDown = false;

function tryFire() {
  if (fireTimer > 0) return;
  const cur = curGun();
  fireTimer = cur.rate; muzzle = .1;
  SFX[cur.sfx ? cur.sfx : 'pistol']();
  bloom = Math.min(bloom + cur.rec, cur.maxB);
  aimKick = Math.min(aimKick + cur.rec * 40, 1);

  // đạn phóng (súng phóng lựu): bay thành quỹ đạo, nổ khi va vật cản/địch
  if (cur.proj) {
    const a = player.dir + (Math.random() - .5) * 2 * bloom;
    fireBullet(player.x + Math.cos(a) * .5, player.y + Math.sin(a) * .5, a, cur.dmg, cur.proj, cur.splash, 'player');
    return;
  }

  const shots = cur.pellets || 1;
  for (let k = 0; k < shots; k++) {
    // độ lệch: shotgun toả đều quanh trục, súng thường theo bloom giật
    const dev = cur.pellets
      ? (k % 2 === 0 ? -1 : 1) * (((k + 1) >> 1) * cur.spread + Math.random() * cur.spread * .5)
      : (Math.random() - .5) * 2 * bloom;
    const a = player.dir + dev;
    const dx = Math.cos(a), dy = Math.sin(a);

    const dmg = cur.dmg * (0.85 + Math.random() * .3);
    let best = null, bestDist = cur.range, wallBlocked = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = e.x - player.x, ey = e.y - player.y;
      const pdot = ex * dx + ey * dy;
      if (pdot <= 0 || pdot > bestDist) continue;
      const perp = Math.abs(ex * dy - ey * dx);
      if (perp < .35) { best = e; bestDist = pdot; }
    }
    let headshot = false;
    if (best) {
      for (let s = .2; s < bestDist; s += .2)
        if (opaque(player.x + dx * s, player.y + dy * s)) { wallBlocked = true; break; }
      // chấm bắn trên màn hình có rơi vào vùng ĐẦU (30% trên) → sát thương x2?
      const pxV = pitchPx();
      const aimY = (H - 34) / 2 - aimKick * 16;
      const feet = H / 2 + (H / bestDist) * .5 + player.vert * (H / bestDist) + pxV;
      const sz = (H / bestDist) * .95;
      if (aimY < feet - sz * .72) headshot = true;
    }
    if (best && !wallBlocked) damageEnemy(best, headshot ? dmg * 2 : dmg);

    // vệt đạn từ họng súng tới điểm va tường/đhết tầm
    const sx = player.x + dx * .5, sy = player.y + dy * .5;
    let ex = sx, ey = sy;
    for (let s = .8; s < cur.range + 1; s += .2) {
      const px = player.x + dx * s, py = player.y + dy * s;
      if (opaque(px, py)) break;
      ex = px; ey = py;
    }
    tracers.push({ x0: sx, y0: sy, x1: ex, y1: ey, kind: 'player', t: .12, thin: !!cur.pellets, hs: headshot });
  }
}

function switchWeapon(n) {
  n = Math.max(1, Math.min(8, n | 0));
  if (player.weapon === n) {
    const fam = GUNS[n - 1];
    player.variant = (player.variant + 1) % fam.guns.length; // đổi dòng súng trong nhóm
  } else {
    player.weapon = n; player.variant = 0;
    bloom = .012;
  }
  const fam = GUNS[player.weapon - 1], gun = fam.guns[player.variant];
  flash(fam.label + ' — ' + gun.name);
}

function damageEnemy(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.state = 'chase';
  if (e.hp <= 0) {
    e.dead = true; e.deathTimer = 0; stats.kills++;
    SFX.enemyDie();
    if (aliveEnemies() === 0) triggerClear();
  }
}

function aliveEnemies() {
  let n = 0;
  for (const e of enemies) if (!e.dead) n++;
  return n;
}

function triggerClear() {
  if (gameState !== 'play' || clearTimer >= 0) return;
  clearTimer = 1.6;
  flash('ĐỘI ĐỐI PHƯƠNG ĐÃ BỊ TIÊU DIỆT!');
}

/* ---------------- Kẻ địch ---------------- */
function lineOfSight(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy), steps = Math.ceil(dist * 3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (opaqueEnemy(ax + dx * t, ay + dy * t)) return false;
  }
  return true;
}

function nearestEnemy(x, y, maxD, needLOS) {
  let best = null, bd = maxD;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd && (!needLOS || lineOfSight(x, y, e.x, e.y))) { bd = d; best = { e, d }; }
  }
  return best;
}

function nearestUnitTarget(x, y) {
  let best = null, bd = Infinity, bIsP = false, bU = null;
  if (player.alive) { const d = Math.hypot(player.x - x, player.y - y); if (d < bd) { bd = d; bIsP = true; bU = player; } }
  for (const a of allies) {
    if (a.dead) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bd) { bd = d; bIsP = false; bU = a; }
  }
  return bd < Infinity ? { u: bU, isPlayer: bIsP, d: bd } : null;
}

function slideTo(unit, tx, ty, spd) {
  const dx = tx - unit.x, dy = ty - unit.y;
  const d = Math.max(.001, Math.hypot(dx, dy));
  const mx = dx / d * spd, my = dy / d * spd;
  if (canMove(unit.x + mx, unit.y + my, .3)) { unit.x += mx; unit.y += my; }
  else if (canMove(unit.x + mx, unit.y, .3)) unit.x += mx;
  else if (canMove(unit.x, unit.y + my, .3)) unit.y += my;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) { e.deathTimer += dt; continue; }
    e.timer -= dt;
    if (e.flash > 0) e.flash -= dt;
    updateEnemyJump(e, dt);
    const gun = ENEMY_GUNS[e.gun] || null;
    const reach = e.gun === 'melee' ? 1.3 : gun.range;

    if (e.state === 'idle') {
      const near = nearestUnitTarget(e.x, e.y);
      if (near && near.d < e.aggro && lineOfSight(e.x, e.y, near.u.x, near.u.y)) e.state = 'chase';
      continue;
    }

    const target = nearestUnitTarget(e.x, e.y);
    if (!target) { e.state = 'idle'; continue; }

    if (target.d > 1.05 && target.d > reach * .6) {
      if (e.type === 'boss') bossMove(e, target, e.speed * dt, dt);
      else slideTo(e, target.u.x, target.u.y, e.speed * dt);
    }

    if (e.timer <= 0) {
      if (e.gun === 'melee') {
        if (target.d < 1.3) {
          if (target.isPlayer) hurtPlayer(e.dmg); else damageAlly(target.u, e.dmg);
          SFX.dogBite(); e.timer = e.bite;
        } else e.timer = .3;
      } else if (gun.proj) {
        if (target.d < gun.range && lineOfSight(e.x, e.y, target.u.x, target.u.y)) {
          const dir = Math.atan2(target.u.y - e.y, target.u.x - e.x) + (Math.random() - .5) * .08;
          fireBullet(e.x, e.y, dir, e.dmg, gun.proj, gun.splash, 'enemy');
          SFX.enemyGun(); e.flash = .12;
          e.timer = gun.rate * (Math.random() * .6 + .7);
        } else e.timer = .4;
      } else if (target.d < gun.range && lineOfSight(e.x, e.y, target.u.x, target.u.y)) {
        SFX.enemyGun(); e.flash = .12;
        // vệt đạn đỏ của địch
        {
          const ex = e.x, ey = e.y;
          const dx = target.u.x - ex, dy = target.u.y - ey;
          const dd = Math.hypot(dx, dy) || 1;
          const ux = dx / dd, uy = dy / dd;
          const sx = ex + ux * .4, sy = ey + uy * .4;
          let gx = sx, gy = sy;
          for (let s = .6; s < Math.min(gun.range, dd) + 1; s += .2) {
            const px = ex + ux * s, py = ey + uy * s;
            if (opaque(px, py)) break;
            gx = px; gy = py;
          }
          tracers.push({ x0: sx, y0: sy, x1: gx, y1: gy, kind: 'enemy', t: .12 });
        }
        const hit = Math.max(.14, gun.hit - target.d * .028);
        if (Math.random() < hit) {
          const dmg = e.dmg * (Math.random() * .5 + .75);
          if (target.isPlayer) hurtPlayer(dmg); else damageAlly(target.u, dmg);
        }
        e.timer = gun.rate * (Math.random() * .6 + .7);
      } else e.timer = .4;
    }
  }
}

function updateAllies(dt) {
  for (const a of allies) {
    if (a.dead) {
      a.deathTimer += dt; a.respawn -= dt;
      if (a.respawn <= 0) {
        a.dead = false; a.hp = ALLY_STATS[a.type].hp;
        a.x = a.home.x; a.y = a.home.y; a.timer = 1; a.flash = .3;
      }
      continue;
    }
    a.timer -= dt;
    if (a.flash > 0) a.flash -= dt;

    const tgt = nearestEnemy(a.x, a.y, a.range, true);
    const move = tgt || nearestEnemy(a.x, a.y, 60, false);
    if (move) slideTo(a, move.e.x, move.e.y, (move.d > a.range * .9 ? a.speed : a.speed * .35) * dt);

    if (tgt && a.timer <= 0) {
      const g = ALLY_STATS[a.type];
      SFX[ALLY_SFX[a.type]]();
      a.flash = .12;
      // vệt đạn xanh của đồng đội
      {
        const ex = a.x, ey = a.y;
        const dx = tgt.e.x - ex, dy = tgt.e.y - ey;
        const dd = Math.hypot(dx, dy) || 1;
        const ux = dx / dd, uy = dy / dd;
        const sx = ex + ux * .4, sy = ey + uy * .4;
        let gx = sx, gy = sy;
        for (let s = .6; s < Math.min(g.range, dd) + 1; s += .2) {
          const px = ex + ux * s, py = ey + uy * s;
          if (opaque(px, py)) break;
          gx = px; gy = py;
        }
        tracers.push({ x0: sx, y0: sy, x1: gx, y1: gy, kind: 'ally', t: .12 });
      }
      const hit = Math.max(.15, .5 - tgt.d * .03);
      if (Math.random() < hit) damageEnemy(tgt.e, g.dmg * (Math.random() * .4 + .8));
      a.timer = g.rate * (Math.random() * .5 + .75);
    }
  }
}

function damageAlly(a, dmg) {
  if (a.dead) return;
  a.hp -= dmg; a.flash = .15;
  if (a.hp <= 0) {
    a.dead = true; a.deathTimer = 0; a.respawn = ALLY_RESPAWN;
    stats.alliesLost++;
    SFX.enemyDie();
  }
}

function fireBullet(x, y, dir, dmg, speed, splash, owner) {
  bullets.push({ x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, owner, dmg, splash, life: 5, trail: [] });
}

function contactUnit(b, x, y) {
  if (b.owner === 'player') {
    for (const e of enemies) if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < .3) return true;
  } else {
    if (player.alive && (player.x - x) ** 2 + (player.y - y) ** 2 < .3) return true;
    for (const a of allies) if (!a.dead && (a.x - x) ** 2 + (a.y - y) ** 2 < .3) return true;
  }
  return false;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (b.life <= 0) { bullets.splice(i, 1); continue; }
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 7) b.trail.shift();
    let dead = false;
    for (let s = 1; s <= 4; s++) {
      const nx = b.x + b.vx * dt * (s / 4), ny = b.y + b.vy * dt * (s / 4);
      if (opaque(nx, ny)) { explode(b, nx, ny); dead = true; break; }
      if (contactUnit(b, nx, ny)) { explode(b, nx, ny); dead = true; break; }
      b.x = nx; b.y = ny;
    }
    if (dead) bullets.splice(i, 1);
  }
}

function explode(b, x, y) {
  SFX.boom();
  shake = Math.min(1, shake + .35);
  explosions.push({ x, y, t: .5 });
  if (b.owner === 'player') {
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < b.splash) damageEnemy(e, (1 - d / b.splash) * b.dmg);
    }
  } else {
    if (player.alive) {
      const d = Math.hypot(player.x - x, player.y - y);
      if (d < b.splash) hurtPlayer((1 - d / b.splash) * b.dmg);
    }
    for (const a of allies) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < b.splash) damageAlly(a, (1 - d / b.splash) * b.dmg);
    }
  }
}

function hurtPlayer(dmg) {
  if (!player.alive) return;
  player.hp -= dmg;
  SFX.hurt(); shake = Math.min(1, shake + .5);
  flashRed = Math.min(1, flashRed + .45);
  if (player.hp <= 0) {
    player.hp = 0; player.alive = false;
    gameState = 'dead';
    SFX.die();
    const rid = runId;
    setTimeout(() => { if (rid === runId) showEnd(); }, 1600);
  }
}

/* ---------------- Pickups & qua màn ---------------- */
let flashMsg = '', flashTime = 0, flashRed = 0;
function flash(msg) { flashMsg = msg; flashTime = 1.8; }

function updatePickups() {
  for (const p of pickups) {
    if (p.taken) continue;
    if ((p.x - player.x) ** 2 + (p.y - player.y) ** 2 < .3025) {
      let msg = '';
      switch (p.id) {
        case 101: msg = 'CHÌA KHÓA VÀNG!'; SFX.pickup(); break;
        case 102: if (player.hp >= 100) continue; player.hp = Math.min(100, player.hp + 25); msg = '+25 HP'; SFX.pickup(); break;
        case 103: if (player.hp >= 100) continue; player.hp = Math.min(100, player.hp + 10); msg = '+10 HP'; SFX.pickup(); break;
        case 104: stats.treasures++; msg = 'BÁU VẬT!'; SFX.pickup(); break;
        case 105: stats.treasures++; msg = 'THÁNH CHÉN!'; SFX.pickup(); break;
        case 106: SFX.pickup(); msg = '+ĐẠN!'; break;
        case 107: SFX.pickup(); msg = '+ĐẠN!'; break;
        case 108: player.hasWeapon[6] = true; switchWeapon(6); msg = 'SÚNG MÁY HẠNG NHẸ (LMG 6)!'; SFX.pickup(); break;
        case 109: player.hasWeapon[4] = true; switchWeapon(4); msg = 'TIỂU LIÊN (SMG 4)!'; SFX.pickup(); break;
        case 110: stats.treasures++; msg = 'KHO BÁU!'; SFX.pickup(); break;
        case 111: player.hasWeapon[2] = true; switchWeapon(2); msg = 'SÚNG BẮN TỈA (SR 2)!'; SFX.pickup(); break;
        case 112: SFX.pickup(); msg = '+ĐẠN!'; break;
        case 113: player.hasWeapon[8] = true; switchWeapon(8); msg = 'SÚNG PHÓNG LỰU (GL 8)!'; SFX.pickup(); break;
      }
      p.taken = true;
      flash(msg);
    }
  }
}

function nextLevel() {
  if (levelIdx + 1 < LEVELS.length) {
    loadLevel(levelIdx + 1);
    flash(level.name);
  } else {
    winGame();
  }
}

/* ---------------- Input ---------------- */
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Enter') {
    if (gameState === 'title') startGame();
    else if (gameState === 'dead' || gameState === 'win') { hideOverlays(); startGame(); }
  }
  if (gameState !== 'play') return;
  if (e.code === 'KeyE') tryAction();
  if (e.code >= 'Digit1' && e.code <= 'Digit8') switchWeapon(+e.code.slice(5));
});
document.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('mousedown', e => {
  if (e.button === 0) mouseDown = true;
  else if (e.button === 2) rightDown = true;
  try { AC(); } catch (err) {}
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
  else if (e.button === 2) rightDown = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousemove', e => {
  if (gameState === 'play' && document.pointerLockElement === canvas) {
    player.dir += e.movementX * .0022;
    player.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, player.pitch - e.movementY * .0015));
  }
});
canvas.addEventListener('click', () => { if (gameState === 'play') canvas.requestPointerLock(); });

document.getElementById('btn-start').onclick = () => startGame();
document.getElementById('btn-restart').onclick = () => { hideOverlays(); startGame(); };

function hideOverlays() {
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
}
function startGame() {
  hideOverlays();
  loadLevel(0);
  gameState = 'play';
  flash('TIÊU DIỆT TOÀN BỘ ĐỘI ĐỐI PHƯƠNG!');
}
function winGame() {
  if (gameState !== 'play') return;
  gameState = 'win'; SFX.win();
  setTimeout(showEnd, 1200);
}
function showEnd() {
  const won = gameState === 'win';
  const et = document.getElementById('end-title');
  et.textContent = won ? 'ĐỒNG ĐỘI CHIẾN THẮNG!' : 'GAME OVER';
  et.className = 'end-title' + (won ? ' win' : '');
  document.getElementById('end-stats').innerHTML =
    `Đối phương tiêu diệt: <b>${stats.kills}/${stats.totalKills}</b><br>` +
    `Đồng đội hy sinh: <b>${stats.alliesLost}</b> (tự hồi sinh)<br>` +
    `Báu vật: <b>${stats.treasures}</b><br>` +
    `Bí mật: <b>${stats.secrets}</b><br>` +
    `Thời gian: <b>${stats.time | 0}s</b>`;
  document.getElementById('end-screen').style.display = 'flex';
}

/* ---------------- Cập nhật người chơi ---------------- */
function updatePlayer(dt) {
  if (!player.alive) return;
  const spd = (keys['ShiftLeft'] || keys['ShiftRight'] ? 4.6 : 2.8) * dt;
  const dx = Math.cos(player.dir), dy = Math.sin(player.dir);

  let mx = 0, my = 0;
  if (keys['KeyW'] || keys['ArrowUp'])   { mx += dx * spd; my += dy * spd; }
  if (keys['KeyS'] || keys['ArrowDown']) { mx -= dx * spd; my -= dy * spd; }
  if (keys['KeyA']) { mx += dy * spd; my -= dx * spd; }
  if (keys['KeyD']) { mx -= dy * spd; my += dx * spd; }
  if (keys['ArrowLeft'])  player.dir -= 2.6 * dt;
  if (keys['ArrowRight']) player.dir += 2.6 * dt;

  if (moveAllowed(player.x + mx, player.y, .25)) player.x += mx;
  if (moveAllowed(player.x, player.y + my, .25)) player.y += my;

  fireTimer -= dt;
  const gun = curGun(), fam = curFam();
  if (mouseDown && fireTimer <= 0 && (gun.auto || !mouseWasDown)) tryFire();
  mouseWasDown = mouseDown;
  muzzle -= dt;

  // độ giật tan dần + nẩy tâm bắn hạ xuống
  bloom = Math.max(.012, bloom - dt * 1.2);
  aimKick = Math.max(0, aimKick - dt * 1.5);

  // zoom ngắm: giữ chuột phải với súng bắn tỉa
  const zoomTarget = (rightDown && fam.scope) ? 2.6 : 1;
  scopeZoom += (zoomTarget - scopeZoom) * Math.min(1, dt * 9);

  // nhảy (Space): camera cao lên → cảnh dịch xuống theo độ sâu (Z vẫn là phím phụ)
  // có thể nhảy lên/đứng trên hòm (ngại vật thấp)
  let baseH = crateUnderH();
  if ((keys['Space'] || keys['KeyZ']) && !player.jumping) { player.jumping = true; player.jumpV = 7.5; player.vert = baseH; }
  if (player.jumping) {
    player.vert += player.jumpV * dt;
    player.jumpV -= 16 * dt;
    const gH = crateUnderH();
    if (player.vert <= gH && player.jumpV <= 0) { player.vert = gH; player.jumpV = 0; player.jumping = false; }
  } else {
    // bước khỏi hòm → tụt dần xuống sàn
    const gH = crateUnderH();
    if (player.vert > gH) player.vert = Math.max(gH, player.vert - dt * 7);
    else player.vert = gH;
  }
}

/* ---------------- Raycasting render ---------------- */
/* ---------------- Bầu trời + sàn (canvas lớn, lệch theo pitch) ---------------- */
const BG_H = 560; // H + 160 để hứng camera ngước/ngó
const bg = (() => {
  const c = document.createElement('canvas');
  c.width = W; c.height = BG_H;
  const g = c.getContext('2d');
  const mid = BG_H / 2;
  const sky = g.createLinearGradient(0, 0, 0, mid);
  sky.addColorStop(0, '#2c3550'); sky.addColorStop(.55, '#4a5a78'); sky.addColorStop(1, '#8a8a72');
  g.fillStyle = sky; g.fillRect(0, 0, W, mid);
  // mặt trời
  const sun = g.createRadialGradient(W * .82, mid * .28, 6, W * .82, mid * .28, 60);
  sun.addColorStop(0, 'rgba(255,240,200,.95)'); sun.addColorStop(.4, 'rgba(255,220,150,.5)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, mid);
  g.fillStyle = '#f2e4b8';
  g.beginPath(); g.arc(W * .82, mid * .28, 26, 0, 7); g.fill();
  // mây
  for (let i = 0; i < 7; i++) {
    const mx = (i * 97 % W), my = mid * (.12 + (i % 3) * .22);
    g.fillStyle = `rgba(220,225,235,${.28 + (i % 4) * .12})`;
    g.beginPath();
    g.ellipse(mx, my, 46 + (i % 3) * 14, 12 + (i % 2) * 6, 0, 0, 7);
    g.ellipse(mx + 24, my - 6, 26 + (i % 2) * 10, 9, 0, 0, 7);
    g.fill();
  }
  const floor = g.createLinearGradient(0, mid, 0, BG_H);
  floor.addColorStop(0, '#241d14'); floor.addColorStop(.3, '#2c241a'); floor.addColorStop(1, '#4a4034');
  g.fillStyle = floor; g.fillRect(0, mid, W, BG_H - mid);
  // đốm sàn
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * .12})`;
    g.fillRect(Math.random() * W, mid + Math.random() * (BG_H - mid), 2 + Math.random() * 5, 1 + Math.random() * 3);
  }
  return c;
})();

function glow(c1, c2) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 6, 32, 32, 32);
  grad.addColorStop(0, c1); grad.addColorStop(.45, c2); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return c;
}
const BULLET_ENEMY = glow('#ffd8c0', 'rgba(255,70,30,.95)');
const BULLET_PLAYER = glow('#d8ffd0', 'rgba(64,220,90,.95)');

function render() {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (shake > 0) {
    ctx.translate((Math.random() - .5) * shake * 14, (Math.random() - .5) * shake * 14);
    shake = Math.max(0, shake - .04);
  }
  // zoom ngắm (súng bắn tỉa): phóng to quanh tâm màn hình
  if (scopeZoom > 1.01) {
    ctx.translate(W / 2, (H - 34) / 2);
    ctx.scale(scopeZoom, scopeZoom);
    ctx.translate(-W / 2, -(H - 34) / 2);
  }
  ctx.globalAlpha = 1;
  const pxV = pitchPx();
  // bầu trời/sàn: kéo lệch theo góc nhìn (mặt phân chia luôn ở H/2 + pitchPx)
  ctx.drawImage(bg, 0, Math.round((H / 2 + pxV) - BG_H / 2));

  const cosd = Math.cos(player.dir), sind = Math.sin(player.dir);
  const cw = COL_W + .5;
  ctx.fillStyle = FOG_COLOR;
  const vert = player.vert;

  for (let r = 0; r < NUM_RAYS; r++) {
    const bx = rayBx[r];
    const rdx = cosd - sind * bx;
    const rdy = sind + cosd * bx;

    let mapX = player.x | 0, mapY = player.y | 0;
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (player.x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - player.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (player.y - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - player.y) * ddy; }

    // DDA: đi xuyên qua hòm (thấp) để tìm tường cao phía sau
    const segs = [];
    let side = 0;
    for (let guard = 0; guard < 64; guard++) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
      else           { sdy += ddy; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= GW || mapY >= GH) break;
      const t = grid[mapY][mapX];
      if (t === 0) continue;
      if (t === 90 || t === 91) {
        const d = doors[`${mapX},${mapY}`];
        if (d && d.open > .95) continue;
      }
      const dl = Math.max(.05, (side === 0 ? sdx - ddx : sdy - ddy) * rayInvLen[r]);
      let wallX = side === 0 ? player.y + dl * rdy : player.x + dl * rdx;
      wallX -= Math.floor(wallX);
      let texX = (wallX * 64) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 63 - texX;
      segs.push({ t, side, texX, dl, full: !isCrate(t) });
      if (!isCrate(t)) break;            // tường cao/cửa: dừng tia
    }

    // zBuffer: tường cao chặn toàn cột; chỉ hòm thì phần trên hở (đạn/địch hiện sau lưng)
    const zFull = segs.find(s => s.full);
    const nearCrate = segs.find(s => !s.full);
    zBuffer[r] = zFull ? zFull.dl : 1e9;
    if (!zFull && nearCrate) {
      lowTopD[r] = nearCrate.dl;
      lowTopY[r] = crateTopPx(nearCrate.dl, vert, pxV);
    } else {
      lowTopD[r] = 1e9;
      lowTopY[r] = -1;
    }

    for (const s of segs.slice().sort((a, b) => b.dl - a.dl)) {
      const lineH = (H / s.dl) | 0;
      if (lineH < 1) continue;
      const bottom = (H + lineH) / 2 + vert * (H / s.dl) + pxV;
      const hFrac = s.full ? 1 : CRATE_H;
      const top = bottom - lineH * hFrac;
      if (bottom <= 0 || top >= H) continue;
      const colX = r * COL_W;
      const tex = wallTex(s.t === 200 ? 1 : s.t);
      if (!tex) continue;
      const ySrc = s.full ? 0 : (64 * (1 - CRATE_H)) | 0;
      const hSrc = s.full ? 64 : (64 * CRATE_H) | 0;
      ctx.drawImage(tex, s.texX, ySrc, 1, hSrc, colX, top, cw, lineH * hFrac);
      const fog = Math.min(.65, s.dl / 14);
      const a = s.side === 1 ? fog + .28 * (1 - fog) : fog;
      if (a > .01) { ctx.globalAlpha = a; ctx.fillRect(colX, top, cw, lineH * hFrac); ctx.globalAlpha = 1; }
      // mép trên của hòm sáng lên nhìn rõ
      if (!s.full && top > 0 && top < H - 2) {
        ctx.fillStyle = 'rgba(255,235,190,.12)';
        ctx.fillRect(colX, top, cw, Math.max(1, 2 * hFrac));
      }
    }
  }

  /* ---- Sprites: kẻ địch, item, xác ---- */
  const all = [];
  for (const e of enemies) all.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
  for (const a of allies) all.push({ x: a.x, y: a.y, kind: 'ally', ref: a });
  for (const b of bullets) all.push({ x: b.x, y: b.y, kind: 'bullet', ref: b });
  for (const p of pickups) if (!p.taken) all.push({ x: p.x, y: p.y, kind: 'item', ref: p });
  for (const s of all) s.dist = (s.x - player.x) ** 2 + (s.y - player.y) ** 2;
  all.sort((a, b) => b.dist - a.dist);

  const ca = Math.cos(player.dir), sa = Math.sin(player.dir);
  const proj = (px, py) => {
    const dx = px - player.x, dy = py - player.y;
    const depth = ca * dx + sa * dy;
    if (depth <= .15) return null;
    const lateral = -sa * dx + ca * dy;
    return {
      sx: (W / 2) * (1 + lateral / depth),
      sy: H / 2 + (H / depth) * .5 + player.vert * (H / depth) + pxV,
      depth
    };
  };
  for (const s of all) {
    const dx = s.x - player.x, dy = s.y - player.y;
    const depth = ca * dx + sa * dy;          // khoảng cách trước sau
    const lateral = -sa * dx + ca * dy;       // lệch ngang
    if (depth <= .15) continue;

    const screenX = (W / 2) * (1 + lateral / depth);
    const scale = s.kind === 'item' ? .45 : (s.kind === 'bullet' ? .55 : .95);
    const size = (H / depth) * scale;
    const uv = (s.ref && s.ref.vert) || 0;
    const yBase = H / 2 + (H / depth) * .5 + player.vert * (H / depth) + pxV - uv * (H / depth);
    const x0 = screenX - size / 2;

    let img = null;
    if (s.kind === 'item') img = ITEMS[s.ref.id];
    else if (s.kind === 'ally') img = s.ref.dead ? ALLIED.corpse : ALLIED[s.ref.type];
    else if (s.kind === 'bullet') img = s.ref.owner === 'enemy' ? BULLET_ENEMY : BULLET_PLAYER;
    else img = s.ref.dead ? ENEMIES.corpse : ENEMIES[s.ref.type];
    if (!img) continue;

    // vệt khói theo đường bay của đạn phóng
    if (s.kind === 'bullet') {
      const ref = s.ref, tcol = ref.owner === 'enemy' ? '#ff6a3a' : '#8dff8d';
      if (ref.trail && ref.trail.length > 1) {
        for (let i = 1; i < ref.trail.length; i++) {
          const A = proj(ref.trail[i - 1].x, ref.trail[i - 1].y);
          const B = proj(ref.trail[i].x, ref.trail[i].y);
          if (!A || !B) continue;
          const mid = proj((ref.trail[i - 1].x + ref.trail[i].x) / 2, (ref.trail[i - 1].y + ref.trail[i].y) / 2);
          if (!mid) continue;
          const raw = (mid.sx / COL_W) | 0;
          if (raw >= 0 && raw < NUM_RAYS && zBuffer[raw] < mid.depth) continue; // bị tường che
          ctx.globalAlpha = (i / ref.trail.length) * .5;
          ctx.strokeStyle = tcol; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // vẽ từng cột dọc với z-test (hòm thấp cắt phần chân của sprite)
    const colStart = Math.max(0, (x0 / COL_W) | 0);
    const colEnd = Math.min(NUM_RAYS - 1, ((x0 + size) / COL_W) | 0);
    for (let c = colStart; c <= colEnd; c++) {
      if (depth >= zBuffer[c]) continue;
      const u = ((c * COL_W - x0) / size * 64) | 0;
      if (u < 0 || u > 63) continue;
      const colX = c * COL_W;
      const topY = yBase - size;
      let hh = size;
      if (lowTopD[c] < depth) {
        const lt = lowTopY[c];
        if (lt <= topY) continue;         // hòm che kín sprite
        if (lt < yBase) hh = lt - topY;
      }
      ctx.drawImage(img, u, 0, 1, (hh / size) * 64, colX, topY, cw, hh);
      const fog = Math.min(.6, depth / 14);
      if (fog > .02) { ctx.globalAlpha = fog; ctx.fillRect(colX, topY, cw, hh); ctx.globalAlpha = 1; }
    }

    // lõi sáng của đạn phóng (chỉ khi không bị tường che)
    if (s.kind === 'bullet') {
      const bc = Math.max(0, Math.min(NUM_RAYS - 1, (screenX / COL_W) | 0));
      if (depth < zBuffer[bc]) {
        ctx.fillStyle = s.ref.owner === 'enemy' ? '#ffdfc0' : '#e4ffe4';
        ctx.beginPath(); ctx.arc(screenX, yBase - size / 2, Math.max(2, size * .07), 0, 7); ctx.fill();
      }
    }
    // chỉ thị màu đội trên đầu: xanh = đồng đội, đỏ = đối phương
    if ((s.kind === 'enemy' && !s.ref.dead) || (s.kind === 'ally' && !s.ref.dead)) {
      const mw = Math.max(5, size * .32);
      const my = yBase - size - mw * 1.1;
      if (my > 0) {
        ctx.fillStyle = s.kind === 'ally' ? COL_ALLY : COL_ENEMY;
        ctx.beginPath();
        ctx.moveTo(screenX - mw, my); ctx.lineTo(screenX + mw, my); ctx.lineTo(screenX, my + mw * 1.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }

  /* ---- Vụ nổ (lựu đạn / rocket) ---- */
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.t -= 1 / 60;
    if (ex.t <= 0) { explosions.splice(i, 1); continue; }
    const p = proj(ex.x, ex.y);
    if (!p) continue;
    const raw = (p.sx / COL_W) | 0;
    if (raw < 0 || raw >= NUM_RAYS || zBuffer[raw] < p.depth) continue;
    const k = ex.t / .5;
    const pr = Math.max(2, (H / p.depth) * (1 - k) * .34);
    ctx.fillStyle = `rgba(255,${(130 + Math.random() * 60) | 0},40,${k})`;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, pr, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,240,180,${k * .7})`;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, pr * .45, 0, 7); ctx.fill();
  }

  drawTracers();

  ctx.restore();

  drawWeapon();
  if (gameState === 'play') drawCrosshair();

  if (flashRed > 0) {
    ctx.fillStyle = `rgba(200,0,0,${flashRed * .45})`;
    ctx.fillRect(0, 0, W, H);
    flashRed = Math.max(0, flashRed - .05);
  }
  if (muzzle > 0) {
    ctx.fillStyle = `rgba(255,220,120,${muzzle * 2})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();
  if (gameState === 'play') drawMinimap();

  if (flashTime > 0) {
    flashTime -= 1 / 60;
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,220,120,${Math.min(1, flashTime)})`;
    ctx.fillText(flashMsg, W / 2, 90);
    ctx.textAlign = 'left';
  }
}

/* ---------------- Vệt đạn (tracer) ---------------- */
const TRACER_COLORS = { player: '#ffd97a', ally: '#45ff7a', enemy: '#ff5248' };
function drawTracers() {
  if (!player) return;
  const ca = Math.cos(player.dir), sa = Math.sin(player.dir);
  const pxV = pitchPx();
  const proj = (px, py) => {
    const dx = px - player.x, dy = py - player.y;
    const depth = ca * dx + sa * dy;
    if (depth <= .15) return null;
    const lateral = -sa * dx + ca * dy;
    return {
      sx: (W / 2) * (1 + lateral / depth),
      sy: H / 2 + (H / depth) * .5 + player.vert * (H / depth) + pxV,
      depth
    };
  };
  ctx.save();
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= 1 / 60;
    if (tr.t <= 0) { tracers.splice(i, 1); continue; }
    const A = proj(tr.x0, tr.y0), B = proj(tr.x1, tr.y1);
    if (!A || !B) continue;
    const mid = proj((tr.x0 + tr.x1) / 2, (tr.y0 + tr.y1) / 2);
    if (mid) {
      const raw = (mid.sx / COL_W) | 0;
      if (raw >= 0 && raw < NUM_RAYS && zBuffer[raw] < mid.depth) continue; // bị tường che
    }
    const col = TRACER_COLORS[tr.kind] || '#fff';
    const alpha = Math.min(1, tr.t / .1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = tr.hs ? '#fff6d0' : col;
    ctx.lineWidth = tr.hs ? 4 : 2.5;
    ctx.shadowColor = tr.hs ? '#fff6d0' : col; ctx.shadowBlur = tr.hs ? 12 : 6;
    ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------------- Minimap góc trên bên trái ---------------- */
function drawMinimap() {
  if (!player || !grid) return;
  const mw = 176, mh = 150, ox = 8, oy = 8;
  const sc = Math.min((mw - 6) / GW, (mh - 6) / GH) || 1;
  const mmW = GW * sc, mmH = GH * sc;
  const mx0 = ox + (mw - mmW) / 2, my0 = oy + (mh - mmH) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(ox, oy, mw, mh);
  ctx.strokeStyle = 'rgba(200,162,74,.65)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, mw, mh);

  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const t = grid[y][x];
      if (t === 0) continue;
      const px = mx0 + x * sc, py = my0 + y * sc;
      if (t === 90 || t === 91) {
        const d = doors[`${x},${y}`];
        ctx.fillStyle = d && d.open > .95 ? '#3a3a34' : '#8a5a32';
      } else if (t === 200) {
        ctx.fillStyle = '#8a7a52';
      } else {
        ctx.fillStyle = '#66665e';
      }
      ctx.fillRect(px, py, sc + .5, sc + .5);
    }
  }

  // báu vật / đạn còn lại
  for (const p of pickups) {
    if (p.taken) continue;
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(mx0 + (p.x - .5) * sc + sc * .25, my0 + (p.y - .5) * sc + sc * .25, sc * .5, sc * .5);
  }

  // đồng đội
  for (const a of allies) {
    if (a.dead) continue;
    ctx.fillStyle = '#45ff7a';
    ctx.fillRect(mx0 + (a.x - .5) * sc + sc * .25, my0 + (a.y - .5) * sc + sc * .25, sc * .5, sc * .5);
  }

  // đối phương
  for (const e of enemies) {
    if (e.dead) continue;
    const isBoss = e.type === 'boss';
    const ex = mx0 + e.x * sc, ey = my0 + e.y * sc;
    const rr = Math.max(2, sc * (isBoss ? .62 : .45));
    ctx.fillStyle = isBoss ? '#ffb060' : '#ff4a4a';
    if (isBoss) {
      ctx.beginPath();                              // boss hiện hình thoi từ trên xuống
      ctx.moveTo(ex, ey - rr); ctx.lineTo(ex + rr, ey); ctx.lineTo(ex, ey + rr); ctx.lineTo(ex - rr, ey);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(ex, ey, rr, 0, 7); ctx.fill();
    }
  }

  // người chơi: tam giác theo hướng nhìn + đường ngắm
  const pxC = mx0 + player.x * sc, pyC = my0 + player.y * sc;
  const trLen = sc * 1.8;
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pxC, pyC);
  ctx.lineTo(pxC + Math.cos(player.dir) * trLen, pyC + Math.sin(player.dir) * trLen);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(pxC, pyC);
  ctx.rotate(player.dir);
  ctx.beginPath();
  ctx.moveTo(trLen * .85, 0); ctx.lineTo(-4, 4.5); ctx.lineTo(-4, -4.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* ---------------- Tâm bắn (crosshair) ---------------- */
function drawCrosshair() {
  const cx = W / 2, cy0 = (H - 34) / 2;
  const cy = cy0 - aimKick * 16; // nẩy lên theo độ giật
  const fam = curFam();

  // ống ngắm của súng bắn tỉa
  if (scopeZoom > 1.05 && fam.scope) {
    const scx = cx, scy = cy0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.94)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(scx, scy, 205, 0, 7, false);
    ctx.fill('evenodd');
    // thước ngắm
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(scx - 1, 0, 2, scy - 205);
    ctx.fillRect(scx - 1, scy + 205, 2, H - scy - 205);
    ctx.fillRect(0, scy - 1, scx - 205, 2);
    ctx.fillRect(scx + 205, scy - 1, W - scx - 205, 2);
    // dấu tâm + vạch chuẩn
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(scx - 5, scy, 10, 1.5);
    ctx.fillRect(scx, scy - 5, 1.5, 10);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      ctx.fillRect(scx + k * 9 - 1, scy - 3, 2, 6);
    }
    ctx.restore();
    return;
  }

  // tâm bắn thường: xòe rộng theo độ giật (bloom)
  const gap = 5 + Math.min(16, bloom * 380);
  const ln = 9 + gap * .25;
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - .8, cy - ln - gap, 1.6, ln);
  ctx.fillRect(cx - .8, cy + gap, 1.6, ln);
  ctx.fillRect(cx - ln - gap, cy - .8, ln, 1.6);
  ctx.fillRect(cx + gap, cy - .8, ln, 1.6);
  ctx.fillRect(cx - .8, cy - .8, 1.6, 1.6);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.stroke();
  ctx.restore();
}

/* ---------------- Vẽ vũ khí (2D overlay) ---------------- */
function moving() {
  return keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'] ||
         keys['ArrowUp'] || keys['ArrowDown'];
}
function drawWeapon() {
  const t = performance.now() / 1000;
  const bobY = Math.sin(t * 9) * (moving() ? 7 : 2) + aimKick * 7;
  const bobX = Math.cos(t * 4.5) * (moving() ? 5 : 1);
  const bx = W / 2 + bobX, by = H - 40 + bobY;

  const cur = curGun();
  const name = cur.name;

  ctx.save();
  if (player.weapon === 1) { // AR: SÚNG TRƯỜNG
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(bx - 12, by - 18, 12, 16);          // tay cầm
    ctx.fillRect(bx - 30, by - 58, 76, 16);          // hộp nạp đạn
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(bx + 34, by - 53, 36, 10);          // ốp tay
    ctx.fillStyle = '#15151d';
    ctx.fillRect(bx + 66, by - 56, 20, 4);           // nòng
    ctx.fillStyle = '#26262e';
    ctx.fillRect(bx - 8, by - 42, 14, 26);           // băng đạn
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(bx + 2, by - 74, 22, 3);            // tay cầm vận hành
    ctx.fillRect(bx + 6, by - 71, 3, 13); ctx.fillRect(bx + 22, by - 71, 3, 13);
    ctx.fillRect(bx + 6, by - 78, 19, 3);            // thanh hãng trên
    ctx.fillStyle = name === 'M416' ? '#a0a0b0' : '#3a3a46';
    ctx.fillRect(bx + 46, by - 76, 10, 5);
  } else if (player.weapon === 2) { // SR: SÚNG BẮN TỈA
    ctx.fillStyle = '#23232b';
    ctx.fillRect(bx - 30, by - 60, 72, 12);          // hộp đạn
    ctx.fillStyle = '#181820';
    ctx.fillRect(bx - 52, by - 66, 26, 20);          // báng súng
    ctx.fillStyle = '#0f1016';
    ctx.fillRect(bx + 36, by - 58, 64, 6);           // nòng dài
    ctx.fillStyle = '#1b1c22';
    ctx.fillRect(bx - 2, by - 46, 10, 22);           // đế băng đạn
    ctx.fillRect(bx + 1, by - 40, 8, 16);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(bx - 10, by - 84, 52, 12);          // ống ngắm
    ctx.fillStyle = '#20242c';
    ctx.fillRect(bx + 36, by - 81, 8, 6); ctx.fillRect(bx - 12, by - 82, 4, 8);
    ctx.fillStyle = '#3a4050';
    ctx.beginPath(); ctx.arc(bx + 40, by - 78, 4, 0, 7); ctx.fill(); // vật kính
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.arc(bx - 8, by - 54, 4, 0, 7); ctx.fill();  // tay kéo khóa nòng
    ctx.fillStyle = '#101016';
    ctx.fillRect(bx - 14, by - 20, 12, 18);          // tay cầm
  } else if (player.weapon === 3) { // DMR: THIỆN XẠ
    ctx.fillStyle = '#2b2b34';
    ctx.fillRect(bx - 26, by - 56, 78, 14);
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(bx + 40, by - 52, 22, 8);
    ctx.fillStyle = '#15151d';
    ctx.fillRect(bx + 56, by - 56, 14, 4);           // nòng ngắn hơn AR
    ctx.fillStyle = '#26262e';
    ctx.fillRect(bx - 4, by - 40, 14, 26);           // băng đạn
    ctx.fillStyle = '#05050a';
    ctx.fillRect(bx - 2, by - 72, 34, 8);            // ống ngắm nhỏ
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(bx + 4, by - 76, 12, 4);
    ctx.fillStyle = '#101016';
    ctx.fillRect(bx - 14, by - 18, 12, 16);
  } else if (player.weapon === 4) { // SMG: TIỂU LIÊN
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(bx - 22, by - 52, 56, 12);          // thân nhỏ gọn
    ctx.fillStyle = '#15151d';
    ctx.fillRect(bx + 28, by - 49, 28, 5);           // nòng ngắn
    ctx.fillStyle = '#222229';
    ctx.fillRect(bx - 28, by - 40, 56, 12);          // báng lùa
    ctx.fillStyle = '#33333c';
    ctx.beginPath();                                  // băng đạn cong
    ctx.moveTo(bx - 6, by - 44); ctx.lineTo(bx - 16, by - 12); ctx.lineTo(bx - 4, by - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#101016';
    ctx.fillRect(bx + 2, by - 16, 10, 14);            // tay cầm
  } else if (player.weapon === 5) { // SG: SHOTGUN
    ctx.fillStyle = '#2e2e36';
    ctx.fillRect(bx + 6, by - 56, 62, 14);            // nòng to
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(bx + 18, by - 52, 24, 8);            // đốc bơm
    ctx.fillStyle = '#23232c';
    ctx.fillRect(bx - 30, by - 62, 40, 22);           // hộp đạn chắc chắn
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(bx - 56, by - 58, 30, 14);           // báng súng
    ctx.fillStyle = '#101016';
    ctx.fillRect(bx - 12, by - 20, 12, 18);           // tay cầm
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(bx - 34, by - 60, 42, 4);            // ray nạp đạn
  } else if (player.weapon === 6) { // LMG: SÚNG MÁY HẠNG NHẸ
    ctx.fillStyle = '#23232c';
    ctx.fillRect(bx - 30, by - 62, 70, 26);           // hộp đạn lớn
    ctx.fillStyle = '#1b1b24';
    ctx.fillRect(bx + 32, by - 58, 46, 12);           // cụm nòng dày
    for (let i = 0; i < 6; i++) {                      // rãnh tản nhiệt
      ctx.fillStyle = i % 2 ? '#2c2c36' : '#20202a';
      ctx.fillRect(bx + 34 + i * 7, by - 58, 5, 12);
    }
    ctx.fillStyle = '#191922';
    ctx.fillRect(bx - 8, by - 36, 20, 32);            // băng đạn hộp
    ctx.fillStyle = '#101016';
    ctx.fillRect(bx - 14, by - 20, 12, 18);
    ctx.strokeStyle = '#2b2b34'; ctx.lineWidth = 3;    // chân chống đôi
    ctx.beginPath(); ctx.moveTo(bx + 40, by - 46); ctx.lineTo(bx + 30, by + 4);
    ctx.moveTo(bx + 46, by - 46); ctx.lineTo(bx + 58, by + 4); ctx.stroke();
  } else if (player.weapon === 8) { // GL: SÚNG PHÓNG LỰU
    ctx.fillStyle = '#2e2e36';
    ctx.fillRect(bx - 26, by - 58, 64, 16);           // thân khối bệ phóng
    ctx.fillStyle = '#1f1f28';
    ctx.fillRect(bx + 30, by - 60, 20, 22);           // khung nạp phía trước
    ctx.fillStyle = '#15151d';
    ctx.fillRect(bx + 44, by - 60, 26, 6);            // nòng phóng ngắn
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(bx + 44, by - 53, 24, 5);            // vành nòng
    ctx.fillStyle = '#111118';
    ctx.fillRect(bx - 14, by - 26, 14, 20);           // tay cầm
    ctx.fillStyle = '#24242c';
    ctx.fillRect(bx - 48, by - 56, 26, 12);           // báng sau
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(bx + 62, by - 56, 7, 10);            // ốp ngắm trên nòng
    ctx.fillStyle = '#ffb060';
    ctx.beginPath(); ctx.arc(bx + 58, by - 44, 9, 0, 7); ctx.fill();    // quả lựu trước nòng
    ctx.fillStyle = '#e8d8b0';
    ctx.beginPath(); ctx.arc(bx + 59, by - 45, 4, 0, 7); ctx.fill();
  } else { // 7: PISTOL — SÚNG LỤC
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(bx - 18, by - 56, 36, 14);           // khối nạp
    ctx.fillStyle = '#15151d';
    ctx.fillRect(bx + 12, by - 53, 10, 6);            // nòng
    ctx.fillStyle = '#22222a';
    ctx.fillRect(bx - 10, by - 26, 16, 26);           // báng tay
    ctx.beginPath(); ctx.moveTo(bx - 14, by - 42); ctx.lineTo(bx - 8, by - 44); ctx.lineTo(bx - 8, by - 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a4a56';
    ctx.fillRect(bx - 10, by - 60, 10, 3);            // lẫy ngắm
  }

  // các vòng khóa nòng nổi bật theo độ giật
  if (bloom > .05) {
    ctx.strokeStyle = `rgba(255,255,255,${(bloom - .05) * 6})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 6, by - 34, 16, 10);
  }

  const muzX = { 1: 84, 2: 96, 3: 68, 4: 54, 5: 66, 6: 74, 7: 20, 8: 56 }[player.weapon];
  if (muzzle > 0) {
    ctx.fillStyle = `rgba(255,230,140,${Math.min(1, muzzle * 9)})`;
    ctx.beginPath(); ctx.arc(bx + muzX, by - 52, 16 + Math.random() * 10, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,255,220,${Math.min(1, muzzle * 13)})`;
    ctx.beginPath(); ctx.arc(bx + muzX, by - 52, 6, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ---------------- HUD ---------------- */
function drawHUD() {
  ctx.fillStyle = '#181410';
  ctx.fillRect(0, H - 34, W, 34);
  ctx.strokeStyle = '#c8a24a'; ctx.lineWidth = 2;
  ctx.strokeRect(1, H - 35, W - 2, 34);

  ctx.font = 'bold 15px Courier New';
  ctx.textAlign = 'center';
  const cx = W / 2;
  let aAlive = 0;
  for (const a of allies) if (!a.dead) aAlive++;

  ctx.fillStyle = player.hp > 30 ? '#e8d8b0' : '#ff5040';
  ctx.fillText('HP ' + Math.ceil(player.hp), 60, H - 12);

  const fab = curFam(), fgun = curGun();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 16px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(fgun.name + (fgun.auto ? ' [AUTO]' : fgun.bolt ? ' [NGẮM]' : ' [BÁN TỰ ĐỘNG]'), 60, H - 27);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c8a24a';
  ctx.font = 'bold 15px Courier New';
  ctx.fillText(fab.label, 60, H - 6);
  ctx.fillStyle = aAlive ? '#58a8ff' : '#4a4030';
  ctx.fillText('ĐỒNG ĐỘI: ' + aAlive, 150, H - 12);

  ctx.fillStyle = '#e8d8b0';
  ctx.fillText('SÚNG 1-8', cx - 67, H - 26);
  for (let i = 1; i <= 8; i++) {
    ctx.fillStyle = i === player.weapon ? '#ffd23a' : '#8a8060';
    ctx.fillText('' + i, cx - 67 + (i - 1) * 18, H - 10);
  }

  ctx.fillStyle = '#ffb060';
  ctx.fillText('ĐỊCH:' + (stats.totalKills - stats.kills), cx + 118, H - 12);
  ctx.fillStyle = '#e8d8b0';
  ctx.fillText(`K:${stats.kills}`, cx + 196, H - 12);
  ctx.fillText(`T:${stats.treasures}`, cx + 238, H - 12);
  ctx.fillText(`S:${stats.secrets}`, cx + 276, H - 12);
  ctx.fillText(`${stats.time | 0}s`, W - 34, H - 12);
  ctx.fillText(level ? `${levelIdx + 1}-${LEVELS.length}` : '', W - 34, H - 27);
  ctx.textAlign = 'left';
}

/* ---------------- Vòng lặp chính ---------------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (gameState === 'play') {
    stats.time += dt;
    updatePlayer(dt);
    updateDoors(dt);
    updateEnemies(dt);
    updateAllies(dt);
    updateBullets(dt);
    updatePickups();
    if (clearTimer >= 0) {
      clearTimer -= dt;
      if (clearTimer <= 0) { clearTimer = -2; nextLevel(); }
    }
  }
  if (gameState !== 'title') render();
  requestAnimationFrame(loop);
}
loadLevel(0);
requestAnimationFrame(loop);
