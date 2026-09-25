// ================= VẼ TOÀN BỘ HÌNH ẢNH =================
'use strict';

function draw() {
  ctx.save();
  if (shake > 1) ctx.translate(rand(-shake, shake) * .4, rand(-shake, shake) * .4);

  drawSpace();
  if ((state === 'play' || state === 'waveIntro') && player) {
    drawParticles();
    for (const c of chickens) if (!c.dead) drawChicken(c);
    if (boss) drawBoss();
    drawEggs();
    drawDrops();
    for (const b of bullets) drawBullet(b);
    for (const m of missiles) drawMissile(m);
    drawShip();
    drawHUD();
    if (state === 'waveIntro') drawWaveBanner();
    if (bossNameFlash > 0) drawBossName();
    if (flashT > 0) drawFlash();
  } else {
    drawParticles();
  }
  if (nukeFlash > 0) {
    ctx.fillStyle = `rgba(255,255,220,${nukeFlash * .75})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawSpace() {
  // màu nền đổi theo sector
  const s = diffAt(Math.max(1, wave)).sector;
  const BG = ['#050510', '#100508', '#0a0812', '#04101a', '#0a0212', '#12060a'][s] || '#050510';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  if (!drawSpace.stars) {
    drawSpace.stars = [];
    for (let i = 0; i < 130; i++)
      drawSpace.stars.push({ x: rand(0, W), y: rand(0, H), s: rand(.4, 1.8), v: rand(.3, 1.4) });
  }
  ctx.fillStyle = '#cfe4ff';
  for (const st of drawSpace.stars) {
    if (state === 'play' || state === 'waveIntro') st.y += st.v;
    if (st.y > H) { st.y = -2; st.x = rand(0, W); }
    ctx.globalAlpha = st.s / 2 + .3;
    ctx.fillRect(st.x, st.y, st.s, st.s);
  }
  ctx.globalAlpha = 1;
  ctx.globalAlpha = .06;
  ctx.fillStyle = '#4dc9ff'; ctx.beginPath(); ctx.arc(W * .2, H * .3, 130, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff4dd2'; ctx.beginPath(); ctx.arc(W * .8, H * .7, 150, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawShip() {
  const p = player;
  if (!p) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0) ctx.globalAlpha = .35;
  const fl = rand(8, 16);
  const g = ctx.createLinearGradient(0, 14, 0, 14 + fl);
  g.addColorStop(0, '#ffd23e'); g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(6, 14); ctx.lineTo(0, 14 + fl); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dfe8ff';
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.lineTo(9, 4); ctx.lineTo(15, 12); ctx.lineTo(-15, 12); ctx.lineTo(-9, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7f8db0'; ctx.fillRect(-15, 10, 30, 5);
  ctx.fillStyle = '#4dc9ff'; ctx.beginPath(); ctx.arc(0, -4, 5, 0, 7); ctx.fill();
  ctx.strokeStyle = GUNS[p.gun].color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 21, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}

function drawChicken(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.sin(c.t * 3) * .12);

  if (c.type === 'fast') {
    // gà tốc độ: thân đỏ cam, dải mé
    ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath(); ctx.ellipse(-11, 0, 5, 7, Math.sin(c.t * 8) * .6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11, 0, 5, 7, -Math.sin(c.t * 8) * .6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(0, -8, 6, 0, 7); ctx.fill();
  } else if (c.type === 'tank') {
    // gà tank: màu xám thép + khiên
    ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 17, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath(); ctx.ellipse(-19, 0, 7, 10, Math.sin(c.t * 4) * .4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19, 0, 7, 10, -Math.sin(c.t * 4) * .4, 0, 7); ctx.fill();
    ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(0, -12, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#546e7a'; ctx.fillRect(-14, -6, 28, 6); // giáp
  } else if (c.type === 'shooter') {
    // gà xạ thủ: màu tím + mũ trùm
    ctx.fillStyle = '#ab47bc'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e1bee7';
    ctx.beginPath(); ctx.ellipse(-12, 0, 5, 8, Math.sin(c.t * 6) * .5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, 0, 5, 8, -Math.sin(c.t * 6) * .5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ab47bc'; ctx.beginPath(); ctx.arc(0, -9, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#7b1fa2'; ctx.fillRect(-7, -16, 14, 5); // mũ
  } else {
    // gà thường: trắng
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 2, 16, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.ellipse(-14, 0, 6, 9, Math.sin(c.t * 6) * .5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(14, 0, 6, 9, -Math.sin(c.t * 6) * .5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -10, 8, 0, 7); ctx.fill();
  }

  // mào + mỏ + mắt chung
  ctx.fillStyle = '#e33';
  ctx.beginPath(); ctx.arc(-3, c.r * -.85, 3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(2, c.r * -.9, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff9800';
  ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(12, -6); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(3, -10, 1.8, 0, 7); ctx.fill();

  // thanh máu nhỏ nếu bị thương
  if (c.hp < c.hpMax) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-14, -c.r - 8, 28, 4);
    ctx.fillStyle = '#7CFC00'; ctx.fillRect(-14, -c.r - 8, 28 * Math.max(0, c.hp / c.hpMax), 4);
  }
  ctx.restore();
}

function drawBoss() {
  const b = boss;
  ctx.save();
  ctx.translate(b.x, b.y);

  // hào quang chung theo phase
  if (b.phase === 2) {
    ctx.globalAlpha = .22 + Math.sin(b.t * .2) * .08;
    ctx.fillStyle = '#f00';
    ctx.beginPath(); ctx.arc(0, 0, b.r + 16, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (b.id === 'storm') {
    // Mẹ Gà Bão Tố: thân trắng lớn, lông bay
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 6, b.r * .82, b.r * .62, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e2e2e2';
    const fl = Math.sin(b.t * .08) * .5;
    ctx.beginPath(); ctx.ellipse(-b.r * .85, 0, b.r * .3, b.r * .5, fl, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(b.r * .85, 0, b.r * .3, b.r * .5, -fl, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -b.r * .5, b.r * .34, 0, 7); ctx.fill();
  } else if (b.id === 'robot') {
    // Gà Robot: thân kim loại + ăng-ten + mắt LED
    ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.ellipse(0, 6, b.r * .8, b.r * .6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b0bec5'; ctx.fillRect(-b.r * .55, -6, b.r * 1.1, 12);
    ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -b.r * .55); ctx.lineTo(0, -b.r * .85); ctx.stroke();
    ctx.fillStyle = (Math.floor(b.t / 15) % 2) ? '#ff1744' : '#ff8a80';
    ctx.beginPath(); ctx.arc(0, -b.r * .9, 5, 0, 7); ctx.fill();
    // mắt LED
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.arc(-b.r * .2, -b.r * .45, 6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(b.r * .2, -b.r * .45, 6, 0, 7); ctx.fill();
  } else if (b.id === 'ninja') {
    // Gà Ninja: thân đen + khăn đỏ
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.ellipse(0, 6, b.r * .75, b.r * .58, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#37474f';
    const fl = Math.sin(b.t * .1) * .5;
    ctx.beginPath(); ctx.ellipse(-b.r * .8, 0, b.r * .26, b.r * .45, fl, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(b.r * .8, 0, b.r * .26, b.r * .45, -fl, 0, 7); ctx.fill();
    ctx.fillStyle = '#c62828'; ctx.fillRect(-b.r * .38, -b.r * .62, b.r * .76, 10); // khăn
    ctx.fillStyle = '#ffeb3b'; // mắt nheo
    ctx.beginPath(); ctx.arc(-b.r * .16, -b.r * .42, 4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(b.r * .16, -b.r * .42, 4, 0, 7); ctx.fill();
  } else if (b.id === 'witch') {
    // Gà Phù Thủy: thân tím + mũ nhọn + hào quang
    ctx.fillStyle = '#7b1fa2'; ctx.beginPath(); ctx.ellipse(0, 6, b.r * .75, b.r * .58, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ce93d8';
    ctx.beginPath(); ctx.ellipse(-b.r * .78, 0, b.r * .26, b.r * .45, Math.sin(b.t * .1) * .5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(b.r * .78, 0, b.r * .26, b.r * .45, -Math.sin(b.t * .1) * .5, 0, 7); ctx.fill();
    // mũ nhọn
    ctx.fillStyle = '#4a148c';
    ctx.beginPath(); ctx.moveTo(-b.r * .4, -b.r * .55); ctx.lineTo(b.r * .4, -b.r * .55); ctx.lineTo(0, -b.r * 1.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23e'; ctx.fillRect(-b.r * .45, -b.r * .6, b.r * .9, 7); // vành mũ
    ctx.fillStyle = '#e1f5fe'; // mắt tím biếc
    ctx.beginPath(); ctx.arc(-b.r * .16, -b.r * .38, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(b.r * .16, -b.r * .38, 5, 0, 7); ctx.fill();
  } else if (b.id === 'emperor') {
    // Hoàng Đế: thân vàng kim + vương miện + áo choàng
    ctx.fillStyle = '#f9a825'; ctx.beginPath(); ctx.ellipse(0, 8, b.r * .85, b.r * .65, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.ellipse(0, -b.r * .45, b.r * .36, b.r * .34, 0, 0, 7); ctx.fill();
    // áo choàng
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath(); ctx.ellipse(0, 14, b.r * .95, b.r * .5, 0, 0, 7); ctx.fill();
    // vương miện
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(-b.r * .3, -b.r * .72); ctx.lineTo(-b.r * .15, -b.r * .95); ctx.lineTo(0, -b.r * .72);
    ctx.lineTo(b.r * .15, -b.r * .95); ctx.lineTo(b.r * .3, -b.r * .72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e53935'; // mắt đầy uy quyền
    ctx.beginPath(); ctx.arc(-b.r * .14, -b.r * .42, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(b.r * .14, -b.r * .42, 5, 0, 7); ctx.fill();
  } else { // mothership
    // Tổ Ngôi Kỷ Nguyên: phi thuyền kim loại + vòm kính + động cơ phát sáng
    ctx.fillStyle = '#455a64';
    ctx.beginPath(); ctx.ellipse(0, 10, b.r * .95, b.r * .42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#78909c'; ctx.fillRect(-b.r * .95, 4, b.r * 1.9, 12);
    // vòm kính có gà bên trong
    ctx.fillStyle = 'rgba(77,201,255,.45)';
    ctx.beginPath(); ctx.arc(0, -b.r * .28, b.r * .42, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -b.r * .3, 12, 0, 7); ctx.fill(); // gà lái
    ctx.fillStyle = '#e33';
    ctx.beginPath(); ctx.arc(-4, -b.r * .3 - 10, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -b.r * .3 - 11, 3.4, 0, 7); ctx.fill();
    // đèn động cơ nhấp nháy
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = (Math.floor(b.t / 8 + i) % 3) ? '#ff9100' : '#fff59d';
      ctx.beginPath(); ctx.arc(i * b.r * .34, b.r * .48, 5, 0, 7); ctx.fill();
    }
  }

  // mỏ + mắt chung
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(b.r * .14, -b.r * .2); ctx.lineTo(b.r * .42, -b.r * .12); ctx.lineTo(b.r * .14, -b.r * .04);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // thanh máu (gradient cache lại — không tạo mới mỗi khung)
  const w = 420, x = (W - w) / 2;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 2, H - 34, w + 4, 16);
  if (!drawBoss.grad) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff3355'); g.addColorStop(1, '#ff9800');
    drawBoss.grad = g;
  }
  ctx.fillStyle = drawBoss.grad;
  ctx.fillRect(x, H - 32, w * Math.max(0, b.hp / b.hpMax), 12);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillText('👑 ' + b.name + (b.phase === 2 ? ' — GIAI ĐOẠN CUỐI!' : ''), x + w / 2, H - 36);
}

function drawEggs() {
  for (const e of eggs) {
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(e.rot);
    if (e.aimed) { // trứng nhắm tàu: viền đỏ cảnh báo
      ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#d9c9a8'; ctx.lineWidth = 1;
    }
    ctx.fillStyle = '#fff8ee';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, 7); ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawDrops() {
  for (const d of drops) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.sin(d.rot * 2) * .25);
    const box = (c1, c2, label) => {
      ctx.fillStyle = c1; ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = c2; ctx.fillRect(-11, -11, 22, 6);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(label, 0, 7);
    };
    if (d.kind === 'gun') box('#2e7dff', '#56a0ff', 'G');
    if (d.kind === 'food') { ctx.font = '18px Arial'; ctx.fillText('🍗', 0, 6); }
    if (d.kind === 'missile') box('#c62828', '#ef5350', '🚀');
    if (d.kind === 'nuke') box('#2e7d32', '#66bb6a', '☢');
    if (d.kind === 'life') { ctx.font = '18px Arial'; ctx.fillText('⭐', 0, 6); }
    ctx.restore();
  }
}

function drawBullet(b) {
  ctx.save();
  ctx.fillStyle = b.c;
  ctx.shadowColor = b.c; ctx.shadowBlur = 10;

  switch (b.kind) {
    case 'plasma':
      // quả cầu plasma có quầng
      ctx.globalAlpha = .35;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      break;
    case 'homing': {
      // tên lửa nhỏ có đuôi lửa
      const a = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.6, b.r * .8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff59d';
      ctx.beginPath(); ctx.arc(-b.r * 1.4, 0, b.r * .6, 0, 7); ctx.fill();
      break;
    }
    case 'pierce':
      // đạn nhọn dài
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -b.r * 2.6); ctx.lineTo(b.r * .8, b.r * 1.4); ctx.lineTo(-b.r * .8, b.r * 1.4);
      ctx.closePath(); ctx.fill();
      break;
    case 'wave':
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.5, 0, 7); ctx.fill();
      ctx.strokeStyle = b.c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, 7); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawMissile(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = '#ddd'; ctx.fillRect(-2.5, -8, 5, 14);
  ctx.fillStyle = '#f33';
  ctx.beginPath(); ctx.moveTo(-2.5, 6); ctx.lineTo(2.5, 6); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
  ctx.fillRect(-4.5, -8, 3, 4); ctx.fillRect(1.5, -8, 3, 4);
  ctx.restore();
}

function drawParticles() {
  for (const q of parts) {
    ctx.globalAlpha = Math.min(1, q.life / 40);
    ctx.fillStyle = q.c;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const p = player;
  const d = diffAt(Math.max(1, wave));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Segoe UI';
  ctx.fillText('ĐIỂM: ' + score.toLocaleString('vi-VN'), 14, 26);
  ctx.fillText('MÀN: ' + wave + '/' + TOTAL_WAVES + '  •  ' + d.sectorName, 14, 48);
  for (let i = 0; i < lives; i++) {
    ctx.save();
    ctx.translate(30 + i * 26, 72); ctx.scale(.5, .5);
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(12, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = GUNS[p.gun].color;
  ctx.font = 'bold 13px Segoe UI';
  ctx.fillText('🔫 ' + GUNS[p.gun].name + ' Lv.' + p.lvl + '/5', 14, H - 18);
  ctx.fillStyle = '#fff';
  ctx.fillText('🚀 x' + (p.msl || 0) + ' (Shift)   ☢ x' + (p.nuke || 0) + ' (B)', 14, H - 40);
}

function drawWaveBanner() {
  const t = (110 - waveTimer) / 110;
  ctx.textAlign = 'center';
  const d = diffAt(wave);
  const isBoss = BOSSES.some(b => b.wave === wave);
  ctx.fillStyle = isBoss ? '#ff4455' : '#ffd23e';
  ctx.font = 'bold ' + (34 + Math.sin(t * 10) * 2) + 'px Segoe UI';
  if (isBoss) {
    ctx.fillText('⚠ BOSS: ' + (BOSSES.find(b => b.wave === wave)).name + ' ⚠', W / 2, H / 2 - 40);
  } else {
    ctx.fillText('MÀN ' + wave + ' — ' + d.sectorName, W / 2, H / 2 - 40);
  }
  ctx.fillStyle = '#9fd0ff'; ctx.font = '16px Segoe UI';
  const tip = isBoss ? 'Boss sắp nổi điền!' :
    ['Hạ gà, nhặt quà!', 'Cẩn thận gà xạ thủ bắn trứng nhắm!', 'Gà tank trâu bò — dùng plasma!',
     'Gà tốc độ rất khó ngắm!'][d.sector % 4];
  ctx.fillText(tip, W / 2, H / 2 - 8);
}

function drawBossName() {
  const a = Math.min(1, bossNameFlash / 60);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4455';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText('👑 ' + boss.name, W / 2, H / 2 - 60);
  ctx.font = '14px Segoe UI';
  ctx.fillStyle = '#fff';
  ctx.fillText('Giai đoạn cuối khi thanh máu dưới 50%!', W / 2, H / 2 - 36);
  ctx.globalAlpha = 1;
}

function drawFlash() {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 22px Segoe UI';
  ctx.globalAlpha = Math.min(1, flashT / 40);
  ctx.fillText(flashTxt, W / 2, H - 90);
  ctx.globalAlpha = 1;
}
