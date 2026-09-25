// Test mô phỏng stub DOM/canvas: kiểm tra đạn, boss, độ khó theo màn
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
    return noop;
  },
  set(t, k, v) { t[k] = v; return true; }
});

const sandbox = {
  console, setTimeout, performance: { now: () => 0 },
  document: {
    getElementById: () => ({ classList: { add: noop, remove: noop }, addEventListener: noop, innerHTML: '', getContext: () => ctxStub, width: 900, height: 650 })
  },
  addEventListener: noop,
  requestAnimationFrame: noop,
  Math, Date, JSON
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const files = ['config.js', 'audio.js', 'entities.js', 'game.js', 'render.js', 'main.js'];
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
}

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

vm.runInContext(`
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  const reset = () => {
    state = 'play';
    player = newPlayer();
    chickens = []; bullets = []; eggs = []; drops = []; parts = []; missiles = [];
    boss = null; wave = 1; keys[' '] = false; mouse.down = false;
  };

  // ===== 1. ĐẠN MỖI LOẠI SÚNG ĐỀU TẠO RA ĐẠN =====
  reset();
  for (let gi = 0; gi < GUNS.length; gi++) {
    player.gun = gi; player.lvl = 3; player.cd = 0;
    bullets = [];
    fire();
    assert(bullets.length > 0, 'súng ' + GUNS[gi].name + ' không tạo đạn');
  }
  console.log('1. 8/8 loại súng đều tạo đạn OK');

  // ===== 2. ĐẠN THẲNG HẠ GÀ (bắn liên tục + canh theo gà) =====
  reset();
  chickens = [{ x: 450, y: 200, r: 20, type: 'normal', hp: 3, hpMax: 3, t: 0, side: 1, speed: 1, shootCd: 9999 }];
  const gThuong = chickens[0]; // giữ tham chiếu gốc (nextWave thay mảng khi qua màn)
  keys[' '] = true;
  let frames = 0;
  while (frames < 900 && !gThuong.dead) {
    stepGame(); frames++;
    if (!gThuong.dead) player.x = gThuong.x; // canh tàu theo gà
  }
  keys[' '] = false;
  assert(gThuong.dead, 'đạn không hạ được gà thường');
  console.log('2. Đạn hạ gà thường sau', frames, 'khung hình OK');

  // ===== 3. ĐẠN HOMING TỰ TÌM MỤC TIÊU =====
  reset();
  chickens = [{ x: 150, y: 150, r: 20, type: 'normal', hp: 1, hpMax: 1, t: 0, side: 1, speed: 1, shootCd: 9999 }];
  const gHoming = chickens[0];
  bullets = [{ x: 700, y: 500, vx: 0, vy: -9, r: 4, dmg: 5, c: '#fff', kind: 'homing', tgt: null }];
  for (let i = 0; i < 120 && !gHoming.dead; i++) stepGame();
  assert(gHoming.dead, 'đạn homing không tự tìm được mục tiêu');
  console.log('3. Đạn homing tự tìm và hạ gà OK');

  // ===== 4. ĐẠN XUYÊN PHÁ ĐẬU 2 GÀ LIÊN TIẾP =====
  reset();
  chickens = [
    { x: 450, y: 200, r: 20, type: 'normal', hp: 1, hpMax: 1, t: 0, side: 0, speed: 0, shootCd: 9999 },
    { x: 450, y: 260, r: 20, type: 'normal', hp: 1, hpMax: 1, t: 0, side: 0, speed: 0, shootCd: 9999 }
  ];
  bullets = [{ x: 450, y: 300, vx: 0, vy: -9, r: 4.5, dmg: 5, c: '#fff', kind: 'pierce', life: 130, hitSet: new Set() }];
  const g1 = chickens[0], g2 = chickens[1];
  for (let i = 0; i < 60; i++) stepGame();
  const killed = (g1.dead ? 1 : 0) + (g2.dead ? 1 : 0);
  assert(killed === 2, 'đạn xuyên chỉ hạ được ' + killed + '/2 gà');
  console.log('4. Đạn xuyên phá hạ cả 2 gà trên đường đạn OK');

  // ===== 5. TẤT CẢ 6 BOSS SPAWN ĐƯỢC VÀ CÓ MÁU =====
  reset();
  for (const bcfg of BOSSES) {
    wave = bcfg.wave;
    spawnBoss();
    assert(boss && boss.id === bcfg.id, 'boss màn ' + bcfg.wave + ' spawn sai');
    assert(boss.hp === bcfg.hp, 'boss ' + bcfg.name + ' sai máu');
    boss = null;
  }
  console.log('5. 6/6 boss spawn đúng loại và máu OK');

  // ===== 6. MỖI BOSS CÓ ĐÒN ĐÁNH (trứng xuất hiện khi chạy AI) =====
  for (const bcfg of BOSSES) {
    reset();
    wave = bcfg.wave;
    spawnBoss();
    boss.y = 150; // vào vị trí ngay
    player.x = boss.x; player.y = H - 70;
    for (let i = 0; i < 400; i++) {
      stepGame();
      if (eggs.length > 0) break;
    }
    assert(eggs.length > 0, 'boss ' + bcfg.name + ' không đánh bất kỳ đòn nào');
    // regression: màn boss không được làm hỏng tàu chơi (bug updateBoss(p))
    assert(Number.isFinite(player.x) && Number.isFinite(player.y),
      'tàu/player bị NaN ở màn boss ' + bcfg.name);
    boss = null;
  }
  console.log('6. 6/6 boss đều có đòn tấn công + tàu không hỏng OK');

  // ===== 7. ĐỘ KHÓ TĂNG THEO MÀN =====
  reset();
  const d1 = diffAt(1), d15 = diffAt(15), d30 = diffAt(30);
  assert(d1.chickenHp < d15.chickenHp && d15.chickenHp < d30.chickenHp, 'HP gà không tăng theo màn');
  assert(d1.speedMul < d30.speedMul, 'tốc độ không tăng theo màn');
  assert(d1.eggRate < d30.eggRate, 'tần suất trứng không tăng theo màn');
  console.log('7. Độ khó tăng dần: HP', d1.chickenHp + '->' + d30.chickenHp,
    '| tốc x', d1.speedMul.toFixed(1) + '->' + d30.speedMul.toFixed(1), 'OK');

  // ===== 8. GÀ TANK TRÂU HƠN GÀ THƯỜNG =====
  reset();
  wave = 10;
  chickens = [
    { x: 300, y: 200, r: 20, type: 'normal', hp: 5, hpMax: 5, t: 0, side: 0, speed: 1, shootCd: 9999 },
    { x: 600, y: 200, r: 26, type: 'tank', hp: 20, hpMax: 20, t: 0, side: 0, speed: 1, shootCd: 9999 }
  ];
  bullets = [
    { x: 300, y: 240, vx: 0, vy: -9, r: 3.5, dmg: 1, c: '#fff', kind: 'straight' },
    { x: 600, y: 240, vx: 0, vy: -9, r: 3.5, dmg: 1, c: '#fff', kind: 'straight' }
  ];
  for (let i = 0; i < 5; i++) stepGame();
  assert(!chickens[0].dead && !chickens[1].dead, 'HP không giảm đúng');
  assert(chickens[0].hp < chickens[1].hp, 'tank phải trâu hơn thường');
  console.log('8. Gà tank trâu hơn gà thường OK (HP còn', chickens[0].hp, 'vs', chickens[1].hp + ')');

  // ===== 9. 30 MÀN CHẠY QUA MÀN KHÔNG LỖI (mô phỏng nhanh) =====
  reset();
  for (let wv = 1; wv <= 30; wv++) {
    wave = wv;
    if (BOSSES.some(b => b.wave === wv)) spawnBoss(); else spawnChickens();
    // giết sạch ngay
    chickens.forEach(c => { c.dead = true; });
    if (boss) boss = null;
    const oldNext = state;
    // gọi logic qua màn
    chickens.every(c => c.dead) && !boss && (score += wave * 100);
    // mô phỏng vài frame để không crash
    state = 'play';
    for (let i = 0; i < 3; i++) stepGame();
  }
  console.log('9. 30 màn mô phỏng không crash OK');

  // ===== 10. VŨ KHÍ ĐẶC BIỆT CÓ COOLDOWN (không xả tràn khi giữ phím) =====
  reset();
  chickens = [{ x: 900, y: 80, r: 18, type: 'normal', hp: 999, hpMax: 999, t: 0, side: 0, speed: 0, shootCd: 9999 }];
  player.nuke = 3; player.msl = 5;
  fireNuke();                   // phát 1
  fireNuke();                   // auto-repeat giữ phím -> bị chặn
  assert(player.nuke === 2, 'nuke xả tràn khi giữ phím (hoá ra ' + player.nuke + ')');
  fireMissile(); fireMissile(); // 2 lần sát nhau -> chỉ mất 1 cặp
  assert(player.msl === 4, 'tên lửa xả tràn khi giữ Shift');
  for (let i = 0; i < 30; i++) stepGame(); // hết nukeCd + missileCd
  fireNuke(); fireMissile();
  assert(player.nuke === 1, 'nuke không bắn được quả sau cooldown');
  assert(player.msl === 3, 'tên lửa không bắn được sau cooldown');
  console.log('10. Nuke/Tên lửa có cooldown chống xả tràn OK');

  console.log('');
  console.log('== TAT CA 10 NHOM KIEM TRA DEU PASS ==');
`, sandbox, { filename: 'scenario' });
