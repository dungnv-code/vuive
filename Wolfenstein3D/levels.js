/* =========================================================
   WOLFENSTEIN 3D — Levels (chế độ đối kháng 2 đội)
   Đồng đội (player + AI) vs đội boss tự động nhiều loại súng.
   Tile: 0 sàn | # tường | P cột ẩn nấp | C hòm | + tường thành
         90-91 cửa | 200 pushwall
   ========================================================= */
'use strict';

const NW = 32, NH = 32;

function empty() { return Array.from({ length: NH }, () => new Array(NW).fill(0)); }
function box(g, x, y, w, h, t) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
    if (xx >= 0 && yy >= 0 && xx < NW && yy < NH) g[yy][xx] = t;
}
function pt(g, x, y, t) { if (x >= 0 && y >= 0 && x < NW && y < NH) g[y][x] = t; }
function border(g) {
  box(g, 0, 0, NW, 1, 8); box(g, 0, NH - 1, NW, 1, 8);
  box(g, 0, 0, 1, NH, 8); box(g, NW - 1, 0, 1, NH, 8);
}

/* ---------- MAP 1: PHÁO ĐÀI NGỤC ---------- */
function map1Grid() {
  const g = empty();
  border(g);
  // tường trung tâm có 3 cổng (y=9,16,23)
  box(g, 16, 5, 1, 4, 1);
  box(g, 16, 10, 1, 6, 1);
  box(g, 16, 17, 1, 6, 1);
  box(g, 16, 24, 1, 4, 1);
  // 2 dãy bậu tường ngang (nhiều chỗ bắn / ẩn nấp)
  box(g, 2, 13, 6, 1, 1); box(g, 9, 13, 6, 1, 1); box(g, 18, 13, 6, 1, 1); box(g, 25, 13, 6, 1, 1);
  box(g, 2, 20, 7, 1, 1); box(g, 10, 20, 5, 1, 1); box(g, 18, 20, 5, 1, 1); box(g, 24, 20, 7, 1, 1);
  // khối cột lớn 4 góc
  box(g, 3, 3, 3, 3, 5); box(g, 26, 3, 3, 3, 5); box(g, 3, 26, 3, 3, 5); box(g, 26, 26, 3, 3, 5);
  // cột rải quanh cổng & giữa sân
  const pillars = [
    [14, 9], [17, 9], [12, 11], [18, 11], [14, 16], [18, 16], [13, 23], [18, 23],
    [5, 11], [27, 11], [5, 19], [27, 19], [7, 9], [24, 9], [12, 14], [20, 14],
    [6, 17], [26, 17], [11, 24], [21, 24], [9, 15], [24, 15]
  ];
  for (const [x, y] of pillars) pt(g, x, y, 5);
  // hòm đồ (nấp sau hòm)
  const crates = [
    [6, 7, 1, 2], [25, 7, 1, 2], [6, 15, 2, 1], [25, 14, 1, 2], [6, 22, 1, 2], [25, 22, 1, 2],
    [20, 12, 2, 1], [10, 23, 2, 1], [26, 19, 2, 1], [3, 11, 2, 1]
  ];
  for (const c of crates) box(g, c[0], c[1], c[2], c[3], 7);
  pt(g, 3, 9, 200); // pushwall mở kho chứa
  return g;
}

/* ---------- MAP 2: ĐẤU TRƯỜNG HỦY DIỆT ---------- */
function map2Grid() {
  const g = empty();
  border(g);
  // 2 tuyến phòng thủ ngang có khe bắn (col chia hết 4)
  for (let x = 1; x < 31; x++) { if (x % 4 === 0) continue; pt(g, x, 11, 1); pt(g, x, 21, 1); }
  // block boong-ke 4 góc
  box(g, 4, 4, 4, 4, 5); box(g, 24, 4, 4, 4, 5); box(g, 4, 24, 4, 4, 5); box(g, 24, 24, 4, 4, 5);
  // trụ trung tâm
  box(g, 11, 13, 2, 2, 5); box(g, 19, 13, 2, 2, 5); box(g, 11, 18, 2, 2, 5); box(g, 19, 18, 2, 2, 5);
  const pillars = [
    [6, 16], [7, 15], [8, 17], [25, 16], [24, 15], [10, 9], [21, 9], [6, 23], [25, 23],
    [10, 25], [21, 25], [16, 6], [15, 25], [5, 13], [27, 13], [5, 19], [27, 19], [9, 15], [22, 15]
  ];
  for (const [x, y] of pillars) pt(g, x, y, 5);
  const crates = [
    [3, 7, 2, 2], [26, 14, 2, 2], [13, 5, 2, 1], [20, 6, 2, 1], [6, 27, 2, 1], [24, 17, 1, 2]
  ];
  for (const c of crates) box(g, c[0], c[1], c[2], c[3], 7);
  pt(g, 28, 9, 200); // pushwall mở kho chứa
  return g;
}

const LEVELS = [
{
  name: 'PHÁO ĐÀI NGỤC',
  par: 180,
  grid: map1Grid(),
  player: { x: 2, y: 15, dir: 0 },
  allies: [
    { type: 'rifle', x: 2, y: 11 }, { type: 'rifle', x: 2, y: 14 },
    { type: 'smg',   x: 3, y: 15 }, { type: 'smg',   x: 1, y: 14 }
  ],
  enemies: [
    { type: 'guard',  x: 24, y: 5 }, { type: 'guard',  x: 29, y: 8 },  { type: 'guard',  x: 28, y: 24 },
    { type: 'officer',x: 24, y: 11 },{ type: 'officer',x: 26, y: 12 }, { type: 'officer',x: 17, y: 21 },
    { type: 'gunner', x: 29, y: 15 },{ type: 'gunner', x: 27, y: 7 },
    { type: 'sniper', x: 28, y: 11 },{ type: 'sniper', x: 27, y: 18 },
    { type: 'boss',   x: 27, y: 15 },
    { type: 'dog',    x: 22, y: 5 }, { type: 'dog',    x: 25, y: 25 }
  ],
  items: [
    { id: 102, x: 6,  y: 6 },  { id: 102, x: 11, y: 17 }, { id: 102, x: 19, y: 12 }, { id: 102, x: 27, y: 24 }, { id: 102, x: 2, y: 7 },
    { id: 103, x: 2,  y: 12 }, { id: 103, x: 8,  y: 8 },  { id: 103, x: 23, y: 23 }, { id: 103, x: 5,  y: 16 },
    { id: 106, x: 1,  y: 6 },  { id: 106, x: 30, y: 23 },
    { id: 107, x: 9,  y: 3 },  { id: 107, x: 23, y: 19 }, { id: 107, x: 10, y: 12 },
    { id: 109, x: 9,  y: 6 },  { id: 108, x: 2,  y: 9 },  { id: 111, x: 17, y: 15 }, { id: 112, x: 1,  y: 26 },
    { id: 104, x: 3,  y: 8 },  { id: 104, x: 23, y: 6 },  { id: 110, x: 22, y: 17 }
  ],
  pushwalls: [{ x: 3, y: 9 }]
},
{
  name: 'ĐẤU TRƯỜNG HỦY DIỆT',
  par: 240,
  grid: map2Grid(),
  player: { x: 2, y: 16, dir: 0 },
  allies: [
    { type: 'rifle', x: 2, y: 13 }, { type: 'rifle', x: 3, y: 16 },
    { type: 'smg',   x: 2, y: 14 }, { type: 'smg',   x: 1, y: 16 }
  ],
  enemies: [
    { type: 'sniper', x: 26, y: 8 }, { type: 'sniper', x: 22, y: 16 },
    { type: 'gunner', x: 22, y: 10 },{ type: 'gunner', x: 10, y: 10 },
    { type: 'boss',   x: 17, y: 10 },
    { type: 'officer',x: 23, y: 9 }, { type: 'officer',x: 12, y: 17 }, { type: 'officer',x: 20, y: 24 },
    { type: 'guard',  x: 27, y: 10 },{ type: 'guard',  x: 22, y: 22 }, { type: 'guard',  x: 9,  y: 25 },
    { type: 'dog',    x: 18, y: 5 }, { type: 'dog',    x: 9,  y: 27 }
  ],
  items: [
    { id: 102, x: 2,  y: 6 },  { id: 102, x: 7,  y: 12 }, { id: 102, x: 12, y: 9 },  { id: 102, x: 9,  y: 20 }, { id: 102, x: 21, y: 22 },
    { id: 103, x: 2,  y: 5 },  { id: 103, x: 24, y: 19 },
    { id: 106, x: 3,  y: 3 },  { id: 106, x: 3,  y: 10 },
    { id: 107, x: 3,  y: 20 }, { id: 107, x: 23, y: 23 },
    { id: 109, x: 5,  y: 16 }, { id: 108, x: 18, y: 18 }, { id: 111, x: 17, y: 15 }, { id: 112, x: 28, y: 8 },
    { id: 104, x: 8,  y: 3 },  { id: 104, x: 20, y: 25 }, { id: 110, x: 25, y: 22 },  { id: 113, x: 12, y: 15 }
  ],
  pushwalls: [{ x: 28, y: 9 }]
}
];

/* ---- Parse: dựng dữ liệu chiến đấu từ cấu trúc ---- */
function parseLevel(L) {
  const grid = L.grid;
  const W = grid[0].length, H = grid.length;
  return {
    grid, W, H,
    player: { x: L.player.x + .5, y: L.player.y + .5, dir: L.player.dir || 0 },
    allies: L.allies.map(a => ({ type: a.type, x: a.x + .5, y: a.y + .5 })),
    enemies: L.enemies.map(e => ({ type: e.type, x: e.x + .5, y: e.y + .5 })),
    pickups: L.items ? L.items.map(i => ({ id: i.id, x: i.x + .5, y: i.y + .5 })) : [],
    pushwalls: L.pushwalls ? L.pushwalls.map(p => ({ x: p.x, y: p.y })) : [],
    name: L.name, par: L.par
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { LEVELS, parseLevel };