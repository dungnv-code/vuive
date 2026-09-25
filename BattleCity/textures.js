// Battle City — sprite pixel-art vẽ bằng code (không cần file ảnh)
// Mọi sprite được render sẵn vào offscreen canvas.

const TEX = (function () {
  function make(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Vẽ từ bản đồ chuỗi: mỗi ký tự 1 pixel, '.' = trong suốt
  function fromMap(rows, palette, scale) {
    scale = scale || 1;
    const h = rows.length, w = rows[0].length;
    const c = make(w * scale, h * scale);
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || !palette[ch]) continue;
        g.fillStyle = palette[ch];
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  // ---------- ĐỊA HÌNH (ô 16x16) ----------

  // Gạch: 4 khối con 8x8
  const brickSub = fromMap([
    'rrrrrrrd',
    'rrrrrrrd',
    'rrrrrrrd',
    'dddddddd',
    'drrrrrrr',
    'drrrrrrr',
    'drrrrrrr',
    'dddddddd'
  ], { r: '#b53121', d: '#5c1e00' }, 2);

  const brick = make(16, 16);
  {
    const g = brick.getContext('2d');
    g.drawImage(brickSub, 0, 0); g.drawImage(brickSub, 8, 0);
    g.drawImage(brickSub, 0, 8); g.drawImage(brickSub, 8, 8);
  }

  // Thép
  const steelSub = fromMap([
    'wwwwwwws',
    'wgggggws',
    'wgbbbbgs',
    'wgbbbbgs',
    'wgbbbbgs',
    'wgbbbbgs',
    'wgggggws',
    'ssssssss'
  ], { w: '#ffffff', g: '#8f8f8f', b: '#636363', s: '#3a3a3a' }, 2);

  const steel = make(16, 16);
  {
    const g = steel.getContext('2d');
    g.drawImage(steelSub, 0, 0); g.drawImage(steelSub, 8, 0);
    g.drawImage(steelSub, 0, 8); g.drawImage(steelSub, 8, 8);
  }

  // Nước: 2 khung hoạt ảnh (hoán vị bảng màu)
  const WATER_ROWS = [
    'abbaabbaabbaabba',
    'abbaabbaabbaabba',
    'bbbbbbbbbbbbbbbb',
    'bbaabbaabbaabbaa',
    'bbaabbaabbaabbaa',
    'bbbbbbbbbbbbbbbb',
    'abbaabbaabbaabba',
    'abbaabbaabbaabba',
    'bbbbbbbbbbbbbbbb',
    'bbaabbaabbaabbaa',
    'bbaabbaabbaabbaa',
    'bbbbbbbbbbbbbbbb',
    'abbaabbaabbaabba',
    'abbaabbaabbaabba',
    'bbbbbbbbbbbbbbbb',
    'bbaabbaabbaabbaa'
  ];
  const water = [
    fromMap(WATER_ROWS, { a: '#5aa0e8', b: '#2b62a8' }),
    fromMap(WATER_ROWS, { a: '#2b62a8', b: '#5aa0e8' })
  ];

  // Rừng (vẽ đè lên xe tăng)
  const forest = fromMap([
    '.GG..........GG.',
    'GggG........GggG',
    'GggLG......GLggG',
    '.GggG..GG..GggG.',
    '..GG..GggG..GG..',
    '......GggG......',
    '..GG.GggggG.GG..',
    '.GggGGggggGGggG.',
    '.GggGGggggGGggG.',
    '..GG.GggggG.GG..',
    '......GggG......',
    '..GG..GggG..GG..',
    '.GggG..GG..GggG.',
    'GggLG......GLggG',
    'GggG........GggG',
    '.GG..........GG.'
  ], { G: '#0a5c1e', g: '#2e9e3e', L: '#7fe07f' });

  // Băng (trượt)
  const ice = fromMap([
    'wwwwwwwwwwwwwwww',
    'wccccccccccccccw',
    'wcwccccccccccwcw',
    'wccccccccccccccw',
    'wccccwccccwccccw',
    'wccccwccccwccccw',
    'wccccccccccccccw',
    'wcwccccccccccwcw',
    'wccccccccccccccw',
    'wccccwccccwccccw',
    'wccccwccccwccccw',
    'wccccccccccccccw',
    'wcwccccccccccwcw',
    'wccccccccccccccw',
    'wccccccccccccccw',
    'wwwwwwwwwwwwwwww'
  ], { w: '#ffffff', c: '#b8d8e8' });

  // ---------- ĐẠI BÀNG (căn cứ, 16x16 -> vẽ 2x) ----------
  const eagleAlive = fromMap([
    '................',
    '.......ww.......',
    '......wbww......',
    '.....wwbww......',
    '.....wbbbw..ww..',
    '....wwbbbwwwwbw.',
    '...wbbbbbbbbbbw.',
    '..wbbbbyybbbbw..',
    '..wbyyyyyyyybw..',
    '..wbyywwyyyybw..',
    '..wbywwwwyyybw..',
    '...wbyyyyyybw...',
    '...wwbyyyybww...',
    '.....wwbbww.....',
    '.......ww.......',
    '................'
  ], { w: '#ffffff', b: '#8f8f8f', y: '#e8b430' });

  const eagleDead = fromMap([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......rrr.......',
    '.....rbbrr......',
    '....rbbrrr......',
    '...rbbrrrr......',
    '..rbbrrrrrrr....',
    '.rbbrrrrrrrrr...',
    '.bbrrrrrrrrrrr..',
    'brrrrrrrrrrrrr..',
    '.rrrrrrrrrrrr...',
    '...rrrr.rrr.....'
  ], { r: '#7a3010', b: '#e8b430' });

  // ---------- XE TĂNG (16x16, 4 hướng) ----------
  function tankSprite(P, D, L) {
    function base() {
      const c = make(16, 16);
      const g = c.getContext('2d');
      // xích
      g.fillStyle = '#1e1e1e';
      g.fillRect(1, 1, 4, 14); g.fillRect(11, 1, 4, 14);
      g.fillStyle = '#4a4a4a';
      for (let y = 1; y < 15; y += 2) { g.fillRect(1, y, 4, 1); g.fillRect(11, y, 4, 1); }
      // thân
      g.fillStyle = D; g.fillRect(5, 2, 6, 12);
      g.fillStyle = P; g.fillRect(6, 3, 4, 10);
      g.fillStyle = L; g.fillRect(6, 3, 1, 10);
      // tháp pháo
      g.fillStyle = D; g.fillRect(5, 6, 6, 5);
      g.fillStyle = P; g.fillRect(6, 7, 4, 3);
      // nòng (hướng lên)
      g.fillStyle = L; g.fillRect(7, 0, 2, 7);
      g.fillStyle = D; g.fillRect(8, 0, 1, 7);
      return c;
    }
    const up = base();
    function rot(times) {
      const c = make(16, 16);
      const g = c.getContext('2d');
      g.translate(8, 8);
      g.rotate(times * Math.PI / 2);
      g.drawImage(up, -8, -8);
      return c;
    }
    return { 0: up, 1: rot(1), 2: rot(2), 3: rot(3) };
  }

  const tanks = {
    player:   tankSprite('#c8c8c8', '#6a6a6a', '#ffffff'),
    playerUp: tankSprite('#ffe8a0', '#b07818', '#ffffff'),
    basic:    tankSprite('#b0b0b0', '#5a5a5a', '#e0e0e0'),
    fast:     tankSprite('#7fb8e8', '#3a6a9a', '#c8e8ff'),
    power:    tankSprite('#e8b430', '#9a6a10', '#ffe8a0'),
    armor:    tankSprite('#3ecf6a', '#1a7a3a', '#a8ffc8')
  };

  // ---------- ĐẠN (3x4, hướng lên) ----------
  const bullet = fromMap([
    '.w.',
    'www',
    'www',
    '.w.'
  ], { w: '#ffffff' });

  // ---------- NỔ (16x16, 2 khung) ----------
  const boom1 = fromMap([
    '................',
    '................',
    '......y.........',
    '.y....y....y....',
    '..y..yyy..y.....',
    '...y.ywy.yy.....',
    '....yywyyy......',
    '..yyywwwyyy.....',
    '.yywwwwwwwyy....',
    '..yyywwwyyy.....',
    '....yywyyy......',
    '...y.yywyy..y...',
    '..y...yyy....y..',
    '.y....y..y...y..',
    '......y.........',
    '................'
  ], { y: '#ffb000', w: '#fff8d0' });

  const boom2 = fromMap([
    'y.....y.....y...',
    '.y...yyy...y....',
    '..y.yywy..y.....',
    '...yywyyy.y.....',
    '.yy.ywwwy..yy...',
    '..yyywwwyyy.....',
    '.yywwwwwwwyy.y..',
    'yyywwwwwwwyyy...',
    '.yywwwwwwwyy.y..',
    '..yyywwwyyy.....',
    '.yy.ywwwy..yy...',
    '...yywyyy.y.....',
    '..y.yywy..y.....',
    '.y...yyy...y....',
    'y.....y.....y...',
    '................'
  ], { y: '#ff7000', w: '#fff8d0' });

  // ---------- POWER-UP (16x16) ----------
  const powerups = {
    star: fromMap([
      '................',
      '................',
      '.......yy.......',
      '.......yy.......',
      '......yyyy......',
      '..yyyyyyyyyyyy..',
      '...yyyyyyyyyy...',
      '....yyyyyyyy....',
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yyy..yyy....',
      '...yy......yy...',
      '................',
      '................',
      '................',
      '................'
    ], { y: '#e8b430' }),

    grenade: fromMap([
      '................',
      '................',
      '........kk......',
      '.......kkk......',
      '......kkkkk.....',
      '.....kkkkkkk....',
      '.....kkkkkkk....',
      '....kkkkkkkkk...',
      '....kkkkkkkkk...',
      '....kkkkkkkkk...',
      '....kkkkkkkkk...',
      '.....kkkkkkk....',
      '......kkkkk.....',
      '................',
      '................',
      '................'
    ], { k: '#4a7a3a' }),

    clock: fromMap([
      '................',
      '................',
      '.....wwwwww.....',
      '....ww....ww....',
      '....w..ww...w...',
      '....w..ww....w..',
      '....w..ww....w..',
      '....w..wwww..w..',
      '....w........w..',
      '....ww....ww....',
      '.....wwwwww.....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { w: '#e8e8e8' }),

    tank: fromMap([
      '................',
      '................',
      '.cc..........cc.',
      '.cpggggggggggpc.',
      '.cpggggggggggpc.',
      '.cpgpggppggpgpc.',
      '.cpggggggggggpc.',
      '.cpgpggppggpgpc.',
      '.cpggggggggggpc.',
      '.cpggggggggggpc.',
      '.cc..........cc.',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { p: '#7fb8e8', g: '#e8e8e8', c: '#4a4a4a' }),

    shovel: fromMap([
      '................',
      '................',
      '......yyy.......',
      '......yyy.......',
      '......yyy.......',
      '......yyy.......',
      '......yyy.......',
      '......yyy.......',
      '....sssssss.....',
      '....sssssss.....',
      '....sssssss.....',
      '.....sssss......',
      '................',
      '................',
      '................',
      '................'
    ], { y: '#b58860', s: '#8f8f8f' }),

    helmet: fromMap([
      '................',
      '................',
      '................',
      '.....wwwww......',
      '....wwwwwww.....',
      '...wwwwwwwww....',
      '...wwwwwwwww....',
      '...wwwwwwwww....',
      '...wwwwwwwww....',
      '....wwwwwww.....',
      '......www.......',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { w: '#8f8f8f' })
  };

  return {
    brick, steel, water, forest, ice,
    eagleAlive, eagleDead,
    tanks, bullet,
    boom1, boom2,
    powerups
  };
})();
