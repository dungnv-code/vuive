// ================= HẰNG SỐ & TIỆN ÍCH =================
'use strict';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
// dist2: bình phương khoảng cách — dùng trong vòng lặp va chạm để tránh căn bậc hai
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// Bước thời gian cố định 60fps — logic chạy đúng tốc độ trên cả màn hình 60/120/144Hz
const TARGET_FPS = 60;
const STEP_MS = 1000 / TARGET_FPS;

const TOTAL_WAVES = 30;
const WAVES_PER_SECTOR = 5;
const SECTOR_NAMES = [
  'Hệ Sao Sol', 'Tinh Vân Đỏ', 'Vành Đai Tiểu Hành Tin',
  'Thiên Hà Xoắn Ốc', 'Vực Sâu Gà', 'Ngai Vàng Kỷ Nguyên'
];

// ============ HỆ VŨ KHÍ: 8 LOẠI SÚNG × 5 CẤP ============
// Mỗi loại có KIỂU ĐẠN riêng (bulletKind)
const GUNS = [
  { name: 'Laser Lỏng',    kind: 'straight', color: '#ff5c5c', rate: 9,  desc: 'Tia đỏ thẳng, nhanh' },
  { name: 'Súng Đôi',      kind: 'straight', color: '#ffd23e', rate: 8,  desc: '2 nòng mé' },
  { name: 'Green Blaster', kind: 'spread',   color: '#7CFC00', rate: 10, desc: 'Toả 3 tia' },
  { name: 'Neon Xanh',     kind: 'wave',     color: '#4dc9ff', rate: 9,  desc: 'Đạn bay hình sin' },
  { name: 'Plasma Tím',    kind: 'plasma',   color: '#c07bff', rate: 16, desc: 'Quả cầu chậm, sát thương lớn' },
  { name: 'Tên Lửa Tìm',   kind: 'homing',   color: '#ff8c1a', rate: 14, desc: 'Đạn tự tìm mục tiêu' },
  { name: 'Xuyên Phá',     kind: 'pierce',   color: '#f5f5ff', rate: 12, desc: 'Đạn xuyên nhiều gà' },
  { name: 'HỦY DIỆT',      kind: 'omega',    color: '#ff4dd2', rate: 7,  desc: 'Toả 5 tia + wave + homing' }
];

// ============ 6 BOSS — mỗi con một bộ não riêng ============
const BOSSES = [
  { wave: 5,  id: 'storm',   name: 'MẸ GÀ BÃO TỐ',      hp: 260,  r: 62 },
  { wave: 10, id: 'robot',   name: 'GÀ ROBOTS KY-9',     hp: 420,  r: 66 },
  { wave: 15, id: 'ninja',   name: 'GÀ NINJA BÓNG ĐÊM',  hp: 560,  r: 56 },
  { wave: 20, id: 'witch',   name: 'GÀ PHÙ THỦY EGGGON', hp: 700,  r: 60 },
  { wave: 25, id: 'emperor', name: 'HOÀNG ĐẾ GÀ VĨ ĐẠI', hp: 900,  r: 72 },
  { wave: 30, id: 'mothership', name: 'TỔ NGÔI KỶ NGUYÊN', hp: 1300, r: 84 }
];

// ============ ĐỘ KHÓ THEO MÀN ============
function diffAt(w) {
  const s = Math.floor((w - 1) / WAVES_PER_SECTOR);      // sector 0..5
  const t = (w - 1) / (TOTAL_WAVES - 1);                 // 0..1
  return {
    sector: s,
    sectorName: SECTOR_NAMES[s],
    chickenHp: 1 + Math.floor(w / 5),                    // 1 -> 7
    speedMul: 1 + t * 1.1,                               // 1.0 -> 2.1
    eggRate: .0012 + t * .0032,                          // xác suất thả trứng/frame/gà
    eggSpeed: 1.8 + t * 1.8                              // 1.8 -> 3.6
  };
}
