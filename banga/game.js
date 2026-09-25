// ================= VÒNG LẶP CHÍNH & LOGIC GAME =================
'use strict';

// ----- Trạng thái toàn cục -----
let state = 'menu';   // menu | play | waveIntro | gameover | victory
let score = 0, lives = 3, wave = 0;
let player = null, boss = null;
let bullets = [], chickens = [], eggs = [], drops = [], parts = [], missiles = [];
let shake = 0, missileCd = 0, nukeCd = 0, nukeFlash = 0, waveTimer = 0, bossNameFlash = 0;
let flashTxt = '', flashT = 0;
let eggCd = 0; // hãm nhịp trứng rơi: tránh dồn trứng thành tường

function flashMsg(t) { flashTxt = t; flashT = 110; }

// ----- Bắt đầu / overlay -----
function startGame() {
  score = 0; lives = 3; wave = 0;
  bullets = []; chickens = []; eggs = []; drops = []; parts = []; missiles = [];
  boss = null; player = newPlayer();
  shake = 0; missileCd = 0; nukeCd = 0; nukeFlash = 0; waveTimer = 0; flashT = 0;
  bossNameFlash = 0; eggCd = 0;
  document.getElementById('overlay').classList.add('hidden');
  ac();
  nextWave();
}

function overlayMsg(title, sub, btnTxt, fn) {
  const o = document.getElementById('overlay');
  o.innerHTML = `<h1>${title}</h1><h2>${sub}</h2><button class="btn" onclick="${fn}">${btnTxt}</button>`;
  o.classList.remove('hidden');
}

function gameOver() {
  state = 'gameover';
  overlayMsg('💀 GAME OVER 💀',
    `Bạn gục ở Màn ${wave} — ${score.toLocaleString('vi-VN')} điểm<br>Địch cuối cùng bạn gặp: <b>${lastEnemyName()}</b>`,
    '▶ CHƠI LẠI', 'startGame()');
}

function victory() {
  state = 'victory'; sfx.win();
  overlayMsg('🏆 CHIẾN THẮNG! 🏆',
    `Toàn bộ 6 sector đã được giải phóng! Điểm: ${score.toLocaleString('vi-VN')}`,
    '▶ CHƠI LẠI', 'startGame()');
}

function lastEnemyName() {
  if (boss) return boss.name;
  const tank = chickens.find(c => c.type === 'tank');
  return tank ? 'Gà Tank' : 'Đàn gà thường';
}

// ----- Màn chơi -----
function nextWave() {
  wave++;
  if (wave > TOTAL_WAVES) { victory(); return; }
  chickens = []; eggs = []; bullets = []; missiles = []; drops = [];
  boss = null; state = 'waveIntro'; waveTimer = 110; eggCd = 0; nukeCd = 0;
  if (BOSSES.some(b => b.wave === wave)) { spawnBoss(); sfx.boss(); }
  else spawnChickens();
}

// ----- Vòng lặp chính: bước thời gian cố định 60fps ----
// Logic game chạy 60 nhịp/giây bất kể refresh rate màn hình; vẽ theo nhịp RAF.
let acc = 0, lastTime = 0;
function update(ts) {
  requestAnimationFrame(update);
  const now = ts > 0 ? ts : performance.now();
  if ((state === 'play' || state === 'waveIntro') && player) {
    if (!lastTime) lastTime = now;
    else {
      acc += Math.min(now - lastTime, 250); // chống "spiral of death" khi tab bị treo
      lastTime = now;
      while (acc >= STEP_MS) { stepGame(); acc -= STEP_MS; }
    }
  } else {
    lastTime = 0; acc = 0;
  }
  draw();
}

function stepGame() {
  const p = player;

  if (state === 'waveIntro' && --waveTimer <= 0) state = 'play';
  if (bossNameFlash > 0) bossNameFlash--;

  updatePlayer(p);
  if (state === 'play' && (keys[' '] || mouse.down)) fire();

  // xây DANH SÁCH MỤC TIÊU 1 lần/khung: gà sống + boss (nếu có).
  // Dùng chung cho đạn, tên lửa và đạn homing — không còn quét/gắn object mỗi đạn.
  const targets = [];
  for (const c of chickens) if (!c.dead) targets.push(c);
  if (boss) targets.push({ x: boss.x, y: boss.y, ref: boss, isBoss: true });

  updateBullets(targets);
  updateMissiles(targets);
  updateChickens(p);
  updateEggs(p);
  if (boss) updateBoss(boss);
  updateDrops(p);
  updateParticles();

  if (shake > 0) shake *= .9;
  if (nukeFlash > 0) nukeFlash -= .05;
  if (nukeCd > 0) nukeCd--;
  if (flashT > 0) flashT--;

  // hết gà & boss -> qua màn
  if (state === 'play' && !boss && !chickens.some(c => !c.dead)) {
    score += wave * 100;
    nextWave();
  }
}

// ----- điều khiển tàu -----
function updatePlayer(p) {
  const sp = .45;
  p.vx = 0; p.vy = 0;
  if (keys.ArrowLeft || keys.a) p.vx = -sp;
  if (keys.ArrowRight || keys.d) p.vx = sp;
  if (keys.ArrowUp || keys.w) p.vy = -sp;
  if (keys.ArrowDown || keys.s) p.vy = sp;
  if (mouse.active) {
    p.x += clamp(mouse.x - p.x, -9, 9);
    p.y += clamp(mouse.y - p.y, -9, 9);
  }
  p.x = clamp(p.x + p.vx, 24, W - 24);
  p.y = clamp(p.y + p.vy, 60, H - 30);
  if (p.inv > 0) p.inv--;
  if (p.cd > 0) p.cd--;
}

// ----- đạn -----
function updateBullets(targets) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // hành vi đặc biệt theo loại đạn
    if (b.kind === 'wave') {
      b.wob += b.wobSpd;
      b.x += Math.cos(b.wob) * 2.4;               // lượn sin ngang
      b.y += b.vy;
    } else if (b.kind === 'homing') {
      // mục tiêu chết / biến mất -> chọn mục tiêu mới từ danh sách chung
      if (!b.tgt || (b.tgt.isBoss ? !boss : b.tgt.dead)) {
        if (targets.length) b.tgt = targets[(Math.random() * targets.length) | 0];
      }
      if (b.tgt) {
        const dx = b.tgt.x - b.x, dy = b.tgt.y - b.y, dd = Math.hypot(dx, dy) || 1;
        if (dd < 70) { // gần mục tiêu: khóa thẳng cho chắc trúng
          b.vx = dx / dd * 9; b.vy = dy / dd * 9;
        } else {
          b.vx += (dx / dd) * .8; b.vy += (dy / dd) * .8;
          const s = Math.hypot(b.vx, b.vy), maxS = 8;
          if (s > maxS) { b.vx *= maxS / s; b.vy *= maxS / s; }
        }
      } else b.vy = -9;
      b.x += b.vx; b.y += b.vy;
    } else {
      b.x += b.vx; b.y += b.vy;
    }
    if (b.life) { b.life--; if (b.life <= 0) { bullets.splice(i, 1); continue; } }

    // --- va chạm ---
    let hit = false;
    if (b.kind === 'pierce') {
      // XUYÊN PHÁ: đạn đi xuyên, mỗi con chỉ trúng 1 lần (hitSet)
      for (const t of targets) {
        if (t.isBoss) break; // boss xử lý riêng bên dưới
        if (!t.dead && !b.hitSet.has(t) && dist2(b.x, b.y, t.x, t.y) < (t.r + b.r) ** 2) {
          b.hitSet.add(t);
          damageChicken(t, b.dmg);
          parts.push({ x: b.x, y: b.y, vx: rand(-2, 2), vy: rand(-2, 1), life: 12, c: b.c, r: 2.5 });
        }
      }
      if (boss && !b.hitSet.has(boss) && Math.abs(b.x - boss.x) < boss.r * .8 &&
          Math.abs(b.y - boss.y) < boss.r * .6) {
        b.hitSet.add(boss);
        damageBoss(b.dmg);
      }
      hit = false; // đạn xuyên không bị tiêu hủy khi trúng
    } else {
      for (const t of targets) {
        if (t.isBoss) break; // boss xử lý riêng bên dưới
        if (!t.dead && dist2(b.x, b.y, t.x, t.y) < (t.r + b.r) ** 2) {
          damageChicken(t, b.dmg);
          hit = true;
          break;
        }
      }
      if (!hit && boss && Math.abs(b.x - boss.x) < boss.r * .8 &&
          Math.abs(b.y - boss.y) < boss.r * .6) {
        damageBoss(b.dmg);
        hit = true;
      }
    }

    if (hit) {
      parts.push({ x: b.x, y: b.y, vx: rand(-2, 2), vy: rand(-2, 1), life: 12, c: b.c, r: 2.5 });
      bullets.splice(i, 1);
      continue;
    }
    if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) bullets.splice(i, 1);
  }
}

// ----- tên lửa phụ (phím Shift) -----
function updateMissiles(targets) {
  if (missileCd > 0) missileCd--;
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.y -= 7; m.trail++;
    if (m.trail % 3 === 0)
      parts.push({ x: m.x, y: m.y, vx: rand(-1, 1), vy: rand(1, 2.5), life: 18, c: '#999', r: 2 });
    if (m.y < -30) { explode(m.x, 10, '#fff', 18); missiles.splice(i, 1); continue; }

    let hitSomething = false;
    for (const t of targets) {
      if (t.isBoss) break;
      if (!t.dead && dist2(m.x, m.y, t.x, t.y) < (t.r + 10) ** 2) {
        damageChicken(t, 10); hitSomething = true; break;
      }
    }
    if (!hitSomething && boss && Math.abs(m.x - boss.x) < boss.r * .8 &&
        Math.abs(m.y - boss.y) < boss.r * .6) {
      damageBoss(10); hitSomething = true;
    }
    if (hitSomething) { explode(m.x, m.y, '#ffa640', 26); missiles.splice(i, 1); }
  }
}

// ----- gà di chuyển + thả trứng -----
function updateChickens(p) {
  const d = diffAt(wave);
  if (eggCd > 0) eggCd--;

  for (const c of chickens) {
    if (c.dead) continue;
    c.t += .03 * c.speed;

    if (c.type === 'fast') {
      c.x += c.side * .95 * d.speedMul;   // lượn ngang nhanh, dốc dọc hơn
      c.y += Math.sin(c.t * 2) * 1.6;
    } else if (c.type === 'tank') {
      c.x += c.side * .18 * d.speedMul;
      c.y += Math.sin(c.t) * .35;
    } else if (c.type === 'shooter') {
      c.x += c.side * .3 * d.speedMul;
      c.y += Math.sin(c.t) * .5;
    } else {
      c.x += c.side * .3 * d.speedMul;
      c.y += Math.sin(c.t) * .6;
    }

    if (c.x < c.r + 10 || c.x > W - c.r - 10) c.side *= -1;
    if (c.y < 50) c.y += .4; else if (c.y > 260) c.y -= .4;

    // thả trứng — có eggCd toàn màn để tránh dồn trứng thành tường
    if (state === 'play' && eggCd === 0 && Math.random() < d.eggRate * (c.type === 'shooter' ? 2.2 : 1)) {
      eggs.push({ x: c.x, y: c.y + 14, vy: d.eggSpeed * (c.type === 'shooter' ? 1.25 : 1), vx: 0, rot: 0 });
      eggCd = rand(3, 8) | 0;
      beep(180, .08, 'triangle', .05, -60);
    }
    // shooter bắn trứng nhắm tàu
    if (state === 'play' && c.type === 'shooter' && --c.shootCd <= 0) {
      c.shootCd = rand(110, 200);
      const dx = p.x - c.x, dy = p.y - c.y, dd = Math.hypot(dx, dy) || 1;
      eggs.push({ x: c.x, y: c.y + 14, vy: dy / dd * 4.2, vx: dx / dd * 4.2, rot: 0, aimed: true });
      beep(320, .1, 'sawtooth', .07, -140);
    }
  }
}

// ----- trứng rơi -----
function updateEggs(p) {
  const rr = (p.r + 10) ** 2;
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i];
    e.x += e.vx || 0;
    e.y += e.vy; e.rot += .1;
    if (e.y > H + 20 || e.x < -20 || e.x > W + 20) { eggs.splice(i, 1); continue; }
    if (dist2(e.x, e.y, p.x, p.y) < rr) {
      eggs.splice(i, 1);
      hurtPlayer();
    }
  }
}

// ================= BOSS AI =================
function bossShoot(x, y, vx, vy) {
  eggs.push({ x, y, vy, vx, rot: 0, aimed: Math.abs(vx) > .1 });
}

function updateBoss(b) {
  const p = player;
  const d = diffAt(wave);
  b.t++;
  if (b.y < b.ty) b.y += 1.6;
  const hpFrac = b.hp / b.hpMax;
  b.phase = hpFrac > .5 ? 1 : 2;
  const rage = b.phase === 2 ? 1.45 : 1;

  // di chuyển ngang chung
  b.x += b.side * b.speed * rage;
  if (b.x < b.r + 20 || b.x > W - b.r - 20) b.side *= -1;

  const cdMul = b.phase === 2 ? .62 : 1;

  switch (b.id) {
    case 'storm': {
      // MẸ GÀ BÃO TỐ: phun trứng quạt, phase 2 thêm mưa 2 biên
      if (--b.cd <= 0) {
        b.cd = rand(55, 80) * cdMul;
        const n = b.phase === 2 ? 7 : 5;
        for (let k = 0; k < n; k++)
          bossShoot(b.x, b.y + 40, (k - (n - 1) / 2) * .9, b.eggSpeed);
      }
      break;
    }
    case 'robot': {
      // GÀ ROBOT: dash ngang + bắn loạt 3 trứng nhắm tàu
      if (--b.dashCd <= 0) {
        b.dashCd = rand(150, 240);
        b.side = p.x > b.x ? 1 : -1;
        b.dashT = 26;
      }
      if (b.dashT > 0) { b.dashT--; b.x += b.side * 6.2; b.x = clamp(b.x, b.r + 20, W - b.r - 20); }
      if (--b.cd <= 0) {
        b.cd = rand(70, 95) * cdMul;
        const dx = p.x - b.x, dy = p.y - b.y, dd = Math.hypot(dx, dy) || 1;
        for (let k = -1; k <= 1; k++)
          bossShoot(b.x, b.y + 40, dx / dd * 4.4 + k * 1.1, dy / dd * 4.4);
      }
      break;
    }
    case 'ninja': {
      // GÀ NINJA: teleport + găm trứng 3 hướng
      if (b.tpCd === undefined) b.tpCd = rand(120, 180);
      if (--b.tpCd <= 0) {
        b.tpCd = rand(120, 180) * (b.phase === 2 ? .7 : 1);
        explode(b.x, b.y, '#8899bb', 24);
        b.x = rand(120, W - 120);
        b.y = rand(90, 190);
        explode(b.x, b.y, '#8899bb', 24);
        beep(700, .12, 'triangle', .09, -400);
        for (let k = -1; k <= 1; k++)
          bossShoot(b.x, b.y + 30, k * 2.6, b.eggSpeed + 1);
      }
      break;
    }
    case 'witch': {
      // GÀ PHÙ THỦY: xoáy trứng 2 chiều + triệu hồi gà nhỏ
      if (--b.cd <= 0) {
        b.cd = rand(80, 110) * cdMul;
        const dir = (b.t % 2) ? 1 : -1;
        for (let k = 0; k < 10; k++)
          bossShoot(b.x, b.y + 30, Math.sin(k * .7) * 2.8 * dir, b.eggSpeed * .8 + k * .12);
      }
      if (b.sumCd === undefined) b.sumCd = 300;
      if (--b.sumCd <= 0) {
        b.sumCd = b.phase === 2 ? 260 : 380;
        if (chickens.filter(c => !c.dead).length < 6) {
          spawnChickens();
          flashMsg('Phù thủy triệu hồi đàn gà!');
          beep(220, .3, 'sawtooth', .12, 200);
        }
      }
      break;
    }
    case 'emperor': {
      // HOÀNG ĐẾ: vương miện trứng xoáy 360° + laser quét
      if (--b.cd <= 0) {
        b.cd = (b.phase === 2 ? 26 : 40);
        const a0 = b.t * .35;
        for (let k = 0; k < 8; k++) {
          const a = a0 + k * Math.PI / 4;
          bossShoot(b.x, b.y + 20, Math.cos(a) * 2.6, Math.abs(Math.sin(a)) * 2.6 + .6);
        }
      }
      break;
    }
    case 'mothership': {
      // TỔ NGÔI: quạt + nhắm + triệu hồi + laser xoáy lúc máu vàng
      if (--b.cd <= 0) {
        b.cd = rand(45, 65) * cdMul;
        for (let k = 0; k < 5; k++)
          bossShoot(b.x, b.y + 50, (k - 2) * 1.0, b.eggSpeed);
        const dx = p.x - b.x, dy = p.y - b.y, dd = Math.hypot(dx, dy) || 1;
        bossShoot(b.x - 40, b.y + 40, dx / dd * 4.6, dy / dd * 4.6);
        bossShoot(b.x + 40, b.y + 40, dx / dd * 4.6, dy / dd * 4.6);
      }
      if (b.sumCd === undefined) b.sumCd = 420;
      if (--b.sumCd <= 0) {
        b.sumCd = 420;
        if (chickens.filter(c => !c.dead).length < 5) spawnChickens();
      }
      if (b.phase === 2) {
        if (b.spiralCd === undefined) b.spiralCd = 0;
        if (--b.spiralCd <= 0) {
          b.spiralCd = 3;
          const a = b.t * .5;
          bossShoot(b.x, b.y + 20, Math.cos(a) * 3.0, Math.abs(Math.sin(a)) * 3.0 + .5);
        }
      }
      break;
    }
  }

  // cắn tàu khi chạm
  if (b.y > b.ty - 5 && p.inv <= 0 && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r - 8) ** 2)
    hurtPlayer();
}

// ================= BẮN =================
function fire() {
  const p = player;
  if (p.cd > 0) return;
  const g = GUNS[p.gun];
  p.cd = Math.max(3, g.rate - (p.lvl - 1) * .6);   // nâng cấp = bắn nhanh hơn
  const col = g.color, lvl = p.lvl;
  const kind = g.kind;
  const add = (o) => bullets.push(Object.assign({
    x: p.x, y: p.y - 20, vx: 0, vy: -9, r: 3.5, dmg: 1 + lvl * .3, c: col, kind
  }, o));

  switch (kind) {
    case 'straight':
      if (p.gun === 0) {
        add({ dmg: 1.2 + lvl * .35 });
        if (lvl >= 3) add({ x: p.x - 10, y: p.y - 12, dmg: 1 });
        if (lvl >= 5) add({ x: p.x + 10, y: p.y - 12, dmg: 1 });
      } else { // súng đôi
        add({ x: p.x - 8, y: p.y - 14, vx: -1.1, dmg: 1 + lvl * .25 });
        add({ x: p.x + 8, y: p.y - 14, vx: 1.1, dmg: 1 + lvl * .25 });
        if (lvl >= 4) add({ dmg: 1.5 });
      }
      break;

    case 'spread': { // Green Blaster: quạt 3-5 tia
      const n = lvl >= 4 ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * .22;
        add({ vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5, dmg: 1 + lvl * .3 });
      }
      break;
    }

    case 'wave': // Neon: đạn bay sin, khó né địch không cần
      add({ dmg: 1.1 + lvl * .3, wob: 0, wobSpd: .35 });
      if (lvl >= 3) add({ x: p.x - 12, y: p.y - 10, dmg: 1, wob: Math.PI, wobSpd: .35 });
      if (lvl >= 5) add({ x: p.x + 12, y: p.y - 10, dmg: 1, wob: 0, wobSpd: .35 });
      break;

    case 'plasma': // Plasma: chậm nhưng đập rất đau
      add({ vy: -6.5, r: 8 + lvl, dmg: 4 + lvl * 1.3 });
      break;

    case 'homing': // Tên lửa tìm mục tiêu
      add({ vy: -7, r: 4, dmg: 2 + lvl * .5, vx: rand(-2, 2), tgt: null });
      if (lvl >= 4) add({ x: p.x - 12, y: p.y - 10, vy: -7, r: 4, dmg: 1.5 + lvl * .4, vx: -3, tgt: null });
      if (lvl >= 5) add({ x: p.x + 12, y: p.y - 10, vy: -7, r: 4, dmg: 1.5 + lvl * .4, vx: 3, tgt: null });
      break;

    case 'pierce': { // Xuyên phá
      const pierceDmg = 1.6 + lvl * .45;
      add({ dmg: pierceDmg, r: 4.5, life: 130, hitSet: new Set() });
      if (lvl >= 3) add({ x: p.x - 10, y: p.y - 10, vx: -1.4, dmg: pierceDmg * .8, r: 4, life: 130, hitSet: new Set() });
      if (lvl >= 3) add({ x: p.x + 10, y: p.y - 10, vx: 1.4, dmg: pierceDmg * .8, r: 4, life: 130, hitSet: new Set() });
      break;
    }

    case 'omega': { // HỦY DIỆT: thánh chiến đạn
      add({ dmg: 2 + lvl * .5, r: 5 });                          // thẳng
      const n = 4;
      for (let k = 0; k < n; k++) {                              // quạt
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * .3;
        add({ x: p.x, y: p.y - 12, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, dmg: 1 + lvl * .35, r: 3.5 });
      }
      add({ x: p.x - 14, y: p.y - 8, vy: -7, r: 4, dmg: 1.5 + lvl * .4, vx: -2, tgt: null });  // homing
      add({ x: p.x + 14, y: p.y - 8, vy: -7, r: 4, dmg: 1.5 + lvl * .4, vx: 2, tgt: null });
      break;
    }
  }
  sfx.shoot();
}

function fireMissile() {
  if (state !== 'play' && state !== 'waveIntro') return;
  if (missileCd > 0 || !player) return;
  if ((player.msl || 0) <= 0) { beep(200, .08, 'square', .06, -80); return; }
  player.msl--;
  missileCd = 18;
  missiles.push({ x: player.x - 14, y: player.y - 6, trail: 0 });
  missiles.push({ x: player.x + 14, y: player.y - 6, trail: 0 });
  sfx.missile();
}

function fireNuke() {
  if (!player || state !== 'play') return;
  if (nukeCd > 0) return;                 // chống auto-repeat keydown giữ phím B
  if ((player.nuke || 0) <= 0) return;
  player.nuke--;
  nukeCd = 25;                            // ~0.4s giữa 2 quả, đủ để né tình huống ấn trùng
  nukeFlash = 1; shake = 22; sfx.nuke();
  for (const c of chickens) if (!c.dead) damageChicken(c, 25, true);
  if (boss) damageBoss(40);
  eggs.length = 0;
  for (let i = 0; i < 80; i++)
    parts.push({ x: rand(0, W), y: rand(0, H), vx: rand(-3, 3), vy: rand(-3, 3), life: 40, c: '#ffd23e', r: rand(2, 5) });
}

// ================= SÁT THƯƠNG =================
function damageChicken(c, dmg, silent) {
  if (c.dead) return;
  c.hp -= dmg;
  if (c.hp <= 0) {
    c.dead = true;
    sfx.squawk();
    const bounty = { normal: 25, fast: 35, tank: 80, shooter: 45 }[c.type] || 25;
    score += bounty + wave * 5;
    explode(c.x, c.y, '#ffd23e', c.type === 'tank' ? 26 : 16);
    const r = Math.random();
    const tankBonus = c.type === 'tank' ? .15 : 0;
    if (r < .12 + tankBonus) drops.push({ x: c.x, y: c.y, kind: 'gun', rot: 0 });
    else if (r < .20 + tankBonus) drops.push({ x: c.x, y: c.y, kind: 'food', rot: 0 });
    else if (r < .24 + tankBonus) drops.push({ x: c.x, y: c.y, kind: 'missile', rot: 0 });
    else if (r < .27 + tankBonus) drops.push({ x: c.x, y: c.y, kind: 'nuke', rot: 0 });
    else if (r < .33 + tankBonus) drops.push({ x: c.x, y: c.y, kind: 'life', rot: 0 });
  } else if (!silent) sfx.hit();
}

function damageBoss(dmg) {
  if (!boss) return;
  boss.hp -= dmg;
  explode(boss.x + rand(-40, 40), boss.y + rand(-30, 30), '#ff6a00', 6);
  if (boss.hp <= 0) {
    score += 1500 + wave * 150;
    sfx.boom(); shake = 25;
    const bx = boss.x, by = boss.y;
    for (let i = 0; i < 8; i++)
      setTimeout(() => explode(bx + rand(-70, 70), by + rand(-50, 50), '#ffd23e', 30), i * 150);
    for (let i = 0; i < 5; i++)
      drops.push({ x: bx + rand(-60, 60), y: by, kind: ['gun', 'food', 'missile', 'nuke', 'life'][i], rot: 0 });
    boss = null;
  }
}

function hurtPlayer() {
  const p = player;
  if (p.inv > 0) return;
  lives--;
  p.inv = 150;
  sfx.hurt(); shake = 16;
  explode(p.x, p.y, '#ff5c5c', 26);
  if (p.lvl > 1) p.lvl--;
  if (lives <= 0) gameOver();
}

function explode(x, y, c, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(1, 4);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(20, 40), c, r: rand(1.5, 3.5) });
  }
  shake = Math.max(shake, 4);
}

// ----- quà rơi -----
function updateDrops(p) {
  const rr = (p.r + 16) ** 2;
  for (let i = drops.length - 1; i >= 0; i--) {
    const dr = drops[i];
    dr.y += 1.5; dr.rot += .05;
    if (dr.y > H + 20) { drops.splice(i, 1); continue; }
    if (dist2(dr.x, dr.y, p.x, p.y) < rr) {
      drops.splice(i, 1);
      applyDrop(dr);
    }
  }
}

// ----- particle -----
function updateParticles() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.x += q.vx; q.y += q.vy; q.vy += .04; q.life--;
    if (q.life <= 0) parts.splice(i, 1);
  }
}

function applyDrop(d) {
  const p = player;
  sfx.power();
  switch (d.kind) {
    case 'gun':
      if (p.lvl >= 5 && p.gun < GUNS.length - 1) {
        p.gun++; p.lvl = 1; p.cd = 0; // đổi súng: bắn ngay, không chờ cooldown cũ
        flashMsg('ĐỔI SÚNG: ' + GUNS[p.gun].name + ' — ' + GUNS[p.gun].desc);
      } else if (p.lvl < 5) {
        p.lvl++;
        flashMsg(GUNS[p.gun].name + ' Lv.' + p.lvl);
      } else {
        score += 500; flashMsg('+500 ĐIỂM');
      }
      break;
    case 'food': lives = Math.min(lives + 1, 6); flashMsg('🍗 +1 MẠNG'); break;
    case 'missile': p.msl = Math.min((p.msl || 0) + 5, 30); flashMsg('🚀 +5 TÊN LỮA (Shift)'); break;
    case 'nuke': p.nuke = Math.min((p.nuke || 0) + 1, 5); flashMsg('☢ +1 BOM NUKE (B)'); break;
    case 'life': score += 200; flashMsg('+200 ĐIỂM'); break;
  }
}