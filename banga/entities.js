// ================= SINH TÀU / SINH ĐỊCH =================
'use strict';

function newPlayer() {
  return { x: W / 2, y: H - 70, vx: 0, vy: 0, r: 16, gun: 0, lvl: 1, inv: 0, cd: 0, msl: 0, nuke: 0 };
}

// ---------- 4 LOẠI GÀ ----------
// normal: thường; fast: bay nhanh, HP thấp; tank: trâu, chậm; shooter: bắn trứng đều
function spawnChickens() {
  const d = diffAt(wave);
  const styles = ['grid', 'grid', 'vee', 'arc', 'grid', 'vee']; // theo sector
  const pattern = styles[d.sector % styles.length];
  const n = Math.min(7 + wave, 16);
  const rows = Math.min(2 + Math.floor(wave / 3), 4);
  chickens.length = 0;

  if (pattern === 'vee') {
    // đội hình chữ V
    for (let i = 0; i < n; i++) {
      const k = Math.ceil(i / 2) * 46;
      const side = (i % 2 === 0) ? -1 : 1;
      chickens.push(makeChicken(W / 2 + side * k, 80 + k * .55, d, i));
    }
  } else if (pattern === 'arc') {
    // vòng cung
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + 0.7 * i / (n - 1));
      chickens.push(makeChicken(W / 2 - Math.cos(a) * W * .38, 210 - Math.sin(a) * 130, d, i));
    }
  } else {
    // lưới chuẩn
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < n; i++)
        chickens.push(makeChicken(80 + i * ((W - 160) / (n - 1)), 70 + r * 58, d, r * n + i));
  }
}

function makeChicken(x, y, d, idx) {
  let type = 'normal';
  const roll = Math.random();
  if (idx % 9 === 4) type = 'tank';                 // 1 con tank mỗi nhóm 9
  else if (idx % 7 === 3) type = 'fast';            // 1 con fast mỗi nhóm 7
  else if (idx % 5 === 2) type = 'shooter';         // 1 con shooter mỗi nhóm 5

  const base = { normal: 1, fast: .6, tank: 4, shooter: 1.5 }[type];
  const speedMul = { normal: 1, fast: 2.2, tank: .55, shooter: .9 }[type];

  return {
    x, y, r: type === 'tank' ? 26 : 18, type,
    hp: Math.max(1, Math.round(base * d.chickenHp)),
    hpMax: Math.max(1, Math.round(base * d.chickenHp)),
    t: rand(0, Math.PI * 2),
    side: Math.random() < .5 ? 1 : -1,
    speed: speedMul,
    shootCd: rand(80, 240)
  };
}

// ---------- BOSS ----------
function spawnBoss() {
  const cfg = BOSSES.find(b => b.wave === wave);
  const tier = BOSSES.indexOf(cfg);                  // 0..5
  const d = diffAt(wave);
  boss = {
    id: cfg.id, name: cfg.name, r: cfg.r, tier,
    x: W / 2, y: -140, ty: 150,
    hp: cfg.hp, hpMax: cfg.hp,
    t: 0, phase: 1, side: 1, cd: 90, dashCd: 240,
    speed: .9 + tier * .22,
    eggSpeed: 2.0 + tier * .28
  };
  bossNameFlash = 180; // hiện tên boss to giữa màn hình
}
