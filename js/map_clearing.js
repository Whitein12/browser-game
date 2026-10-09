// ==========================================
// map_clearing.js - Slime Caves stage 1: the forest clearing in front of the cave
// ==========================================
// Two cached world-size layers: the ground (grass, path, cliff, cave, obstacles, canopy shadows) under everything,
// and the canopy that overhangs the clearing's edge above the fighters. Small live touches are drawn each frame.

const clr = { ground: null, canopy: null, view: null, built: false };

function clrRng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clrEdgeX = y => 2012 + Math.sin(y * 0.011) * 14 + Math.sin(y * 0.031 + 2) * 8 - Math.exp(-(((y - 735) / 120) ** 2)) * 22; // cliff face line; it bows out around the cave
const CLR_PATH = [[150, 800], [700, 930], [1300, 590], [1965, 738]];
function clrPathPt(t) { const [a, b, c, d] = CLR_PATH, u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; }
function clrNearPath(x, y, r) { for (let t = 0; t <= 1; t += 0.02) { const [px, py] = clrPathPt(t); if (Math.hypot(px - x, py - y) < r) return true; } return false; }

function buildClearing() {
    if (clr.built) return;
    const D = STAGE_MAPS.clearing, W = D.w, H = D.h, B = D.bounds, M = D.mouth;
    const rnd = clrRng(7177);
    const g = document.createElement('canvas'); g.width = W; g.height = H;
    const c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';

    // --- grass ---
    c.fillStyle = '#3c6229'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
        const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 260, dark = rnd() < 0.5;
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, dark ? 'rgba(40, 72, 26, 0.5)' : 'rgba(104, 146, 62, 0.35)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ['#557f38', '#36592a', '#5f8c40', '#456e2f', '#6b9449'];
    c.lineWidth = 1.4;
    for (let i = 0; i < 30000; i++) {
        const x = rnd() * W, y = rnd() * H, l = 4 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
        c.strokeStyle = blades[(rnd() * blades.length) | 0]; c.globalAlpha = 0.4 + rnd() * 0.35;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;

    // --- dirt path from the west edge to the cave mouth ---
    const strokePath = (w, col, a) => { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(...CLR_PATH[0]); c.bezierCurveTo(...CLR_PATH[1], ...CLR_PATH[2], ...CLR_PATH[3]); c.stroke(); };
    strokePath(122, '#3d5a26', 0.5); strokePath(96, '#5b4a31', 0.75); strokePath(78, '#73603f', 0.9); strokePath(44, '#86704b', 0.5);
    c.globalAlpha = 1;
    for (let i = 0; i < 700; i++) { // pebbles and footprints of dust
        const [px, py] = clrPathPt(rnd()), ox = (rnd() - 0.5) * 80, oy = (rnd() - 0.5) * 80;
        c.fillStyle = rnd() < 0.5 ? 'rgba(60, 46, 30, 0.5)' : 'rgba(170, 150, 115, 0.5)';
        c.beginPath(); c.ellipse(px + ox, py + oy, 1 + rnd() * 2.5, 1 + rnd() * 1.8, rnd() * 3, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 260; i++) { // grass creeping over the path edges
        const [px, py] = clrPathPt(rnd()), a = rnd() * Math.PI * 2, r = 36 + rnd() * 10, x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
        c.strokeStyle = blades[(rnd() * 4) | 0]; c.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + k * 2, y); c.lineTo(x + k * 2 + (rnd() - 0.5) * 4, y - 5 - rnd() * 4); c.stroke(); }
    }

    // --- flowers, clover, pebbles, mushrooms ---
    const petals = ['#f5f5f5', '#ffeb3b', '#b39ddb', '#f8bbd0'];
    for (let i = 0; i < 60; i++) {
        const cx = B.left + rnd() * (B.right - B.left), cy = B.top + rnd() * (B.bottom - B.top);
        if (clrNearPath(cx, cy, 70)) continue;
        const col = petals[(rnd() * petals.length) | 0];
        c.globalAlpha = 0.8;
        for (let k = 0, n = 3 + (rnd() * 5 | 0); k < n; k++) {
            const x = cx + (rnd() - 0.5) * 50, y = cy + (rnd() - 0.5) * 40;
            c.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.8, 0, Math.PI * 2); c.fill(); }
            c.fillStyle = '#ffb300'; c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
    }
    for (let i = 0; i < 160; i++) {
        const x = rnd() * W, y = rnd() * H;
        c.fillStyle = '#6e6a60'; c.beginPath(); c.ellipse(x, y, 2 + rnd() * 4, 1.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.beginPath(); c.arc(x - 1, y - 1, 1, 0, Math.PI * 2); c.fill();
    }
    const mushroom = (x, y, s, cap) => {
        c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(x + 2, y + 3, s * 1.1, s * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = cap; c.strokeStyle = '#2a1a10'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); c.stroke();
        if (cap === '#c62828') { c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (rnd() - 0.5) * s, y + (rnd() - 0.5) * s, s * 0.2, 0, Math.PI * 2); c.fill(); } }
        c.fillStyle = 'rgba(255, 255, 255, 0.35)'; c.beginPath(); c.arc(x - s * 0.35, y - s * 0.35, s * 0.3, 0, Math.PI * 2); c.fill();
    };
    for (let i = 0; i < 46; i++) { // in the shade of the tree line
        const side = rnd(), x = side < 0.5 ? B.left + 20 + rnd() * (B.right - B.left - 40) : B.left + 10 + rnd() * 40, y = side < 0.25 ? B.top + 10 + rnd() * 40 : side < 0.5 ? B.bottom - 10 - rnd() * 40 : B.top + rnd() * (B.bottom - B.top);
        const n = 1 + (rnd() * 3 | 0); for (let k = 0; k < n; k++) mushroom(x + k * 7, y + (rnd() - 0.5) * 8, 3 + rnd() * 3, rnd() < 0.4 ? '#c62828' : '#a1887f');
    }

    // --- forest floor: deep shade beyond the tree line ---
    const shade = (x0, y0, x1, y1) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(12, 26, 8, 0.95)'); gr.addColorStop(1, 'rgba(12, 26, 8, 0)'); return gr; };
    c.fillStyle = shade(0, 0, 0, B.top + 70); c.fillRect(0, 0, W, B.top + 70);
    c.fillStyle = shade(0, H, 0, B.bottom - 70); c.fillRect(0, B.bottom - 70, W, H - B.bottom + 70);
    c.fillStyle = shade(0, 0, B.left + 70, 0); c.fillRect(0, 0, B.left + 70, H);

    // --- the cliff and the cave mouth on the east side ---
    c.beginPath(); c.moveTo(W, 0); c.lineTo(clrEdgeX(0), 0);
    for (let y = 0; y <= H; y += 10) c.lineTo(clrEdgeX(y), y);
    c.lineTo(W, H); c.closePath();
    let gr = c.createLinearGradient(1990, 0, W, 0); gr.addColorStop(0, '#6f6a5f'); gr.addColorStop(0.12, '#56534b'); gr.addColorStop(1, '#3d3b36');
    c.fillStyle = gr; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 260; i++) { // rock texture and moss on top of the cliff
        const x = 2000 + rnd() * 400, y = rnd() * H, r = 6 + rnd() * 26;
        c.fillStyle = rnd() < 0.5 ? 'rgba(30, 28, 26, 0.25)' : 'rgba(150, 145, 130, 0.15)';
        c.beginPath(); c.ellipse(x, y, r, r * 0.7, rnd() * 3, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 40; i++) { const x = 2060 + rnd() * 340, y = rnd() * H, r = 18 + rnd() * 40, mg = c.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, 'rgba(78, 112, 50, 0.45)'); mg.addColorStop(1, 'rgba(78, 112, 50, 0)'); c.fillStyle = mg; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.restore();
    c.strokeStyle = 'rgba(30, 28, 25, 0.5)'; c.lineWidth = 2; // strata on the cliff face
    for (let y = 0; y < H; y += 14 + rnd() * 18) { const x = clrEdgeX(y); c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 26 + rnd() * 20, y + (rnd() - 0.5) * 6); c.stroke(); }
    c.strokeStyle = '#26241f'; c.lineWidth = 4; c.beginPath();
    for (let y = 0; y <= H; y += 10) { if (Math.abs(y - M.y) < 96) { c.stroke(); c.beginPath(); continue; } c.lineTo(clrEdgeX(y), y); }
    c.stroke();
    // Boulders at the foot of the cliff
    for (let i = 0; i < 26; i++) { const y = rnd() * H; if (Math.abs(y - M.y) < 130) continue; clrRock(c, clrEdgeX(y) - 8 - rnd() * 20, y, 10 + rnd() * 16, rnd); }
    // Cave mouth: a dark opening cut into the cliff, its rocky lip arching over it
    const fx = clrEdgeX(M.y), plateau = () => { c.beginPath(); c.moveTo(W, 0); for (let y = 0; y <= H; y += 10) c.lineTo(clrEdgeX(y), y); c.lineTo(W, H); c.closePath(); };
    c.save(); plateau(); c.clip();
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(fx, M.y, 132, 118, 0, 0, Math.PI * 2); c.fill(); // shadow around the lip
    gr = c.createRadialGradient(fx + 110, M.y, 6, fx + 10, M.y, 120); gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#07090a'); gr.addColorStop(1, '#22261a');
    c.fillStyle = gr; c.beginPath(); c.ellipse(fx - 4, M.y, 112, 94, 0, 0, Math.PI * 2); c.fill();
    // The lip: a jagged band of rock around the opening (not a smooth ring), lit on its north-west side
    const lipIn = [], lipOut = [];
    for (let i = 0; i <= 20; i++) {
        const a = -Math.PI / 2 - 0.15 + i / 20 * (Math.PI + 0.3), jr = rnd() * 10;
        lipIn.push([fx - 4 + Math.cos(a) * (104 - jr * 0.6), M.y + Math.sin(a) * (86 - jr * 0.6)]);
        lipOut.push([fx - 4 + Math.cos(a) * (124 + jr), M.y + Math.sin(a) * (106 + jr)]);
    }
    c.beginPath(); lipOut.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); for (let i = lipIn.length - 1; i >= 0; i--) c.lineTo(...lipIn[i]); c.closePath();
    gr = c.createLinearGradient(fx, M.y - 110, fx + 120, M.y + 110); gr.addColorStop(0, '#8a857a'); gr.addColorStop(1, '#4e4b44');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#1f1d1a'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(30, 28, 25, 0.55)'; c.lineWidth = 1.5; // cracks across the lip
    for (let i = 1; i < 20; i += 2 + (rnd() * 2 | 0)) { c.beginPath(); c.moveTo(...lipIn[i]); c.lineTo(...lipOut[i]); c.stroke(); }
    for (let i = 0; i < 3; i++) { // a couple of stubby stalactites
        const k = 4 + i * 6 + (rnd() * 2 | 0), [rx, ry] = lipIn[k], a = Math.atan2(ry - M.y, rx - fx), L = 7 + rnd() * 7;
        c.fillStyle = '#56524a'; c.strokeStyle = '#1f1d1a'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(rx + Math.cos(a + 1.57) * 5, ry + Math.sin(a + 1.57) * 5); c.lineTo(rx - Math.cos(a) * L, ry - Math.sin(a) * L); c.lineTo(rx - Math.cos(a + 1.57) * 5, ry - Math.sin(a + 1.57) * 5); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) clrRock(c, fx - 6 - rnd() * 16, M.y + s * (100 + k * 22 + rnd() * 10), 11 + rnd() * 10, rnd, true); // rubble flanking the entrance
    // Slime pooled in front of the cave and the trails of slimes crawling out
    c.strokeStyle = 'rgba(120, 180, 60, 0.16)'; c.lineWidth = 18;
    for (let k = 0; k < 4; k++) {
        let x = fx - 40, y = M.y + (k - 1.5) * 30; c.beginPath(); c.moveTo(x, y);
        for (let s2 = 0; s2 < 4; s2++) { const nx = x - 90 - rnd() * 60, ny = y + (rnd() - 0.5) * 70; c.quadraticCurveTo((x + nx) / 2, y + (rnd() - 0.5) * 50, nx, ny); x = nx; y = ny; }
        c.stroke();
    }
    c.fillStyle = 'rgba(96, 150, 48, 0.45)'; c.beginPath();
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, rr = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 5); c.lineTo(fx - 60 + Math.cos(a) * 78 * rr, M.y + 4 + Math.sin(a) * 54 * rr); }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(210, 255, 170, 0.28)'; c.beginPath(); c.ellipse(fx - 84, M.y - 14, 26, 7, -0.25, 0, Math.PI * 2); c.fill();

    // --- solid obstacles ---
    for (const o of D.obstacles) (o.kind === 'stump' ? clrStump : clrBoulder)(c, o, rnd);

    // --- bushes and ferns lining the inside of the tree line ---
    const bush = (x, y, s) => {
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x + 6, y + 8, s * 1.3, s * 0.8, 0, 0, Math.PI * 2); c.fill();
        for (const [col, k, ox, oy] of [['#1f3d15', 1.15, 0, 0], ['#2f5a1f', 1, -2, -2], ['#3f7529', 0.7, -s * 0.25, -s * 0.3]]) {
            c.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p * 1.2566 + x; c.beginPath(); c.arc(x + ox + Math.cos(a) * s * 0.5, y + oy + Math.sin(a) * s * 0.4, s * 0.55 * k, 0, Math.PI * 2); c.fill(); }
        }
        c.fillStyle = 'rgba(140, 200, 90, 0.5)'; for (let p = 0; p < 4; p++) { c.beginPath(); c.arc(x - s * 0.4 + rnd() * s * 0.4, y - s * 0.5 + rnd() * s * 0.4, 1.5, 0, Math.PI * 2); c.fill(); }
    };
    for (let x = B.left; x < B.right; x += 34 + rnd() * 30) { bush(x, B.top + 28 + rnd() * 16, 13 + rnd() * 8); bush(x + 15, B.bottom - 22 - rnd() * 16, 13 + rnd() * 8); }
    for (let y = B.top; y < B.bottom; y += 34 + rnd() * 30) bush(B.left + 24 + rnd() * 14, y, 13 + rnd() * 8);

    // --- canopy: tree crowns along the north, west and south edges, overhanging the clearing ---
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const k = cv.getContext('2d');
    const crowns = [];
    for (const [row, depth] of [[2, 200], [1, 110], [0, 30]]) {
        for (let x = -60; x < W + 60; x += 60 + rnd() * 50) crowns.push({ x, y: B.top - depth + 30 + rnd() * 30, r: 52 + rnd() * 34 });
        for (let x = -60; x < W + 60; x += 60 + rnd() * 50) crowns.push({ x, y: B.bottom + depth - 30 - rnd() * 30, r: 52 + rnd() * 34 });
        for (let y = B.top - 40; y < B.bottom + 40; y += 60 + rnd() * 50) crowns.push({ x: B.left - depth + 30 + rnd() * 30, y, r: 52 + rnd() * 34 });
    }
    for (const t of crowns) { // shadows thrown into the clearing (light from the top-left)
        const sg = c.createRadialGradient(t.x + 26, t.y + 32, t.r * 0.3, t.x + 26, t.y + 32, t.r * 1.15);
        sg.addColorStop(0, 'rgba(8, 20, 5, 0.45)'); sg.addColorStop(1, 'rgba(8, 20, 5, 0)');
        c.fillStyle = sg; c.beginPath(); c.arc(t.x + 26, t.y + 32, t.r * 1.15, 0, Math.PI * 2); c.fill();
    }
    for (const t of crowns) clrCrown(k, t, rnd);

    clr.ground = g; clr.canopy = cv; clr.built = true;
}

function clrRock(c, x, y, r, rnd, rim) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(x + r * 0.3, y + r * 0.35, r, r * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r * (0.8 + rnd() * 0.3); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } c.closePath();
    const gr = c.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, rim ? '#9a958a' : '#8f8b80'); gr.addColorStop(1, '#4f4c45');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#25231f'; c.lineWidth = 1.8; c.stroke();
}
function clrBoulder(c, o, rnd) {
    const { x, y, r } = o;
    c.fillStyle = 'rgba(5, 15, 3, 0.4)'; c.beginPath(); c.ellipse(x + 14, y + 16, r * 1.08, r * 0.85, 0.3, 0, Math.PI * 2); c.fill();
    const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = r * (0.9 + rnd() * 0.22); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]); }
    c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath();
    const gr = c.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, '#b4afa3'); gr.addColorStop(0.5, '#86827a'); gr.addColorStop(1, '#55524b');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#24221e'; c.lineWidth = 3; c.stroke();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(40, 38, 34, 0.5)'; c.lineWidth = 2; // facets
    c.beginPath(); c.moveTo(x - r * 0.2, y - r); c.lineTo(x + r * 0.1, y + r * 0.1); c.lineTo(x + r, y + r * 0.3); c.moveTo(x + r * 0.1, y + r * 0.1); c.lineTo(x - r * 0.3, y + r); c.stroke();
    for (let i = 0; i < 6; i++) { // moss on the lit top
        const mx = x - r * 0.35 + (rnd() - 0.5) * r * 0.9, my = y - r * 0.4 + (rnd() - 0.5) * r * 0.6;
        c.fillStyle = 'rgba(88, 134, 52, 0.9)'; c.beginPath(); c.ellipse(mx, my, r * (0.15 + rnd() * 0.2), r * (0.1 + rnd() * 0.12), rnd() * 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(150, 200, 90, 0.7)'; c.beginPath(); c.arc(mx - 2, my - 2, 2, 0, Math.PI * 2); c.fill();
    }
    c.restore();
}
function clrStump(c, o, rnd) {
    const { x, y, r } = o;
    c.fillStyle = 'rgba(5, 15, 3, 0.4)'; c.beginPath(); c.ellipse(x + 12, y + 14, r * 1.15, r * 0.95, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) { // roots
        const a = i / 5 * Math.PI * 2 + rnd(), L = r * (0.6 + rnd() * 0.5);
        c.strokeStyle = '#24170f'; c.lineWidth = 12; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * (r + L), y + Math.sin(a) * (r + L)); c.stroke();
        c.strokeStyle = '#5d4037'; c.lineWidth = 8; c.stroke();
    }
    c.fillStyle = '#5d4037'; c.strokeStyle = '#24170f'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#c8a46e'; c.beginPath(); c.arc(x - 1, y - 1, r * 0.8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(140, 100, 55, 0.7)'; c.lineWidth = 1.5;
    for (let k = 1; k <= 4; k++) { c.beginPath(); c.arc(x - 1 + rnd() * 2, y - 1 + rnd() * 2, r * 0.8 * k / 5, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = 'rgba(80, 50, 25, 0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * 0.7, y - r * 0.2); c.stroke();
    c.fillStyle = 'rgba(88, 134, 52, 0.8)'; c.beginPath(); c.ellipse(x + r * 0.6, y + r * 0.55, r * 0.35, r * 0.22, 0.6, 0, Math.PI * 2); c.fill();
}
function clrCrown(k, t, rnd) {
    const { x, y, r } = t, pine = rnd() < 0.25;
    if (pine) { // top-down pine: layered star of needles
        for (const [col, s] of [['#0f2410', 1.08], ['#1b3d1f', 1], ['#28543a', 0.72], ['#3a6e4a', 0.42]]) {
            k.fillStyle = col; k.beginPath();
            for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + s, rr = r * s * (i % 2 ? 0.72 : 1); k.lineTo(x + Math.cos(a) * rr - (1 - s) * r * 0.2, y + Math.sin(a) * rr - (1 - s) * r * 0.2); }
            k.closePath(); k.fill();
        }
        return;
    }
    const blobs = []; for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.45; blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + rnd() * 0.2)]); }
    const layer = (col, grow, ox, oy) => { k.fillStyle = col; for (const [bx, by, br] of blobs) { k.beginPath(); k.arc(bx + ox, by + oy, br * grow, 0, Math.PI * 2); k.fill(); } };
    layer('#132a0e', 1.12, 0, 0); layer('#264d1a', 1, 0, 0); layer('#356a24', 0.78, -r * 0.1, -r * 0.12); layer('#4a8530', 0.48, -r * 0.2, -r * 0.24);
    for (let i = 0; i < 26; i++) { // leaf texture
        const a = rnd() * Math.PI * 2, d = rnd() * r * 0.85;
        k.fillStyle = rnd() < 0.5 ? 'rgba(20, 45, 14, 0.6)' : 'rgba(130, 190, 80, 0.45)';
        k.beginPath(); k.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + rnd() * 3, 0, Math.PI * 2); k.fill();
    }
}

// ---------- per-frame drawing (world space; the camera transform is already applied) ----------

function clrViewRect() { return [Math.max(0, Math.floor(camera.x)), Math.max(0, Math.floor(camera.y)), canvas.width + 2, canvas.height + 2]; }

function drawClearingGround() {
    const [sx, sy, sw, sh] = clrViewRect();
    ctx.drawImage(clr.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    const M = STAGE_MAPS.clearing.mouth, t = fxTime;
    // Glow breathing out of the cave, brighter once the way is open
    const open = currentMap.caveOpen, p = 0.5 + 0.5 * Math.sin(t * (open ? 3 : 1.4));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ptGlow(ctx, clrEdgeX(M.y) + 50, M.y, open ? 150 : 100, '#7cb342', (open ? 0.35 : 0.16) + 0.1 * p);
    ctx.restore();
    // Slime dripping from the cave lip
    for (let i = 0; i < 5; i++) {
        const k = (t * 0.45 + i * 0.37) % 1, dx = clrEdgeX(M.y) + 8 + Math.sin(i * 2.3) * 6, dy = M.y - 60 + i * 30;
        ctx.fillStyle = 'rgba(150, 215, 80, 0.85)';
        ctx.beginPath(); ctx.ellipse(dx - k * 26, dy, 3 + k * 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (open) { // chevrons and a ring marking the way in
        ctx.save(); ctx.strokeStyle = '#d4ff8a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 12; ctx.shadowColor = '#8bc34a';
        for (let i = 0; i < 3; i++) {
            const a = (Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5), x = M.x - 170 + i * 34 + Math.sin(t * 3) * 6;
            ctx.globalAlpha = 0.3 + 0.7 * a; ctx.beginPath(); ctx.moveTo(x - 10, M.y - 16); ctx.lineTo(x + 6, M.y); ctx.lineTo(x - 10, M.y + 16); ctx.stroke();
        }
        ctx.globalAlpha = 0.4 + 0.3 * p; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(M.x - 10, M.y, 92, 92, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

// The canopy goes over the fighters, with a soft see-through hole around the hero so they never vanish under a tree
function drawClearingCanopy() {
    const cw = canvas.width, ch = canvas.height;
    if (!clr.view || clr.view.width !== cw || clr.view.height !== ch) { clr.view = document.createElement('canvas'); clr.view.width = cw; clr.view.height = ch; }
    const v = clr.view.getContext('2d'), cx = Math.floor(camera.x), cy = Math.floor(camera.y);
    v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, cw, ch);
    v.drawImage(clr.canopy, Math.max(0, cx), Math.max(0, cy), cw, ch, Math.max(0, -cx), Math.max(0, -cy), cw, ch);
    const px = player.x - cx, py = player.y - cy, hole = v.createRadialGradient(px, py, 30, px, py, 120);
    hole.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    v.globalCompositeOperation = 'destination-out'; v.fillStyle = hole; v.fillRect(px - 120, py - 120, 240, 240);
    ctx.drawImage(clr.view, cx, cy);
    // Fireflies drifting along the forest edge
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const B = STAGE_MAPS.clearing.bounds;
    for (let i = 0; i < 26; i++) {
        const side = i % 3, u = (i * 0.137 + fxTime * 0.012 * (1 + i % 4)) % 1;
        const x = side === 2 ? B.left + 30 + Math.sin(fxTime * 0.7 + i) * 30 : B.left + u * (B.right - B.left);
        const y = side === 0 ? B.top + 40 + Math.sin(fxTime * 0.9 + i) * 26 : side === 1 ? B.bottom - 40 + Math.sin(fxTime * 0.8 + i) * 26 : B.top + u * (B.bottom - B.top);
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(fxTime * 2.3 + i * 1.7));
        ptGlow(ctx, x, y, 9, '#e6ff8a', 0.5 * a); ctx.fillStyle = `rgba(250, 255, 200, ${a})`; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
}
