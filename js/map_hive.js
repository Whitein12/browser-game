// ==========================================
// map_hive.js - Slime Caves stage 3: the Hive Queen's throne hall
// ==========================================
// The heart of the colony, sealed off until the Amalgam fell: one round hall of resin and pink membrane, the throne on a
// stepped dais to the north, a royal jelly pool before it, six resin pillars, and brood pods along the walls.
// Brood pods are enemies of type 'brood_pod' (so every attack can pop them) that never count toward the wave: the waves'
// slimes hatch out of them, popped or hatched pods regrow. The Queen dozes on her throne until wave 15, then wakes;
// when she dies her crown is left on the dais, and claiming it ends the dungeon.

const hive = { built: false, ground: null, pool: null, pods: [], burrows: [], awake: false, stirAt: -9, pulseAt: -9, dead: false, trophy: null, sleeper: null };
const HIVE = { cx: 1600, cy: 1330, seat: { x: 1600, y: 440 }, dais: { x: 1600, y: 520, r: 260 } };
const HIVE_PILLARS = [0, 40, 140, 180, 220, 320].map(d => [1600 + Math.cos(d * Math.PI / 180) * 800, 1330 + Math.sin(d * Math.PI / 180) * 620, 72]);
const HIVE_POOL = { x: 1600, y: 1000, rx: 270, ry: 110, rot: 0, seed: 2.2, s: 1, drain: 0, churn: 0 };

function buildHive() {
    if (hive.built) return;
    const D = STAGE_MAPS.hive;
    D.grid = hiveGenerate(D);
    hivePaint(D, D.grid);
    hive.built = true;
}

// Every visit: fresh pods, the Queen asleep again
function resetHive() {
    for (const p of hive.pods) if (p.ent) p.ent.dead = true;
    removeDeadEnemies();
    hive.awake = false; hive.dead = false; hive.trophy = null; hive.stirAt = hive.pulseAt = -9;
    STAGE_MAPS.hive.exit = { ...STAGE_MAPS.hive.throneFront };
    for (const p of hive.pods) { p.state = 'whole'; p.ent = null; p.grownAt = -9; makePod(p); }
}

// ---------- generation ----------

function hiveGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), N = cavNoise(4401);
    const ctr = i => [(i % cols + 0.5) * cs, (Math.floor(i / cols) + 0.5) * cs];
    const at = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? T_WALL : data[gy * cols + gx]; };
    for (let i = 0; i < n; i++) {
        const [x, y] = ctr(i), z = N(x, y) - 0.5, nx = (x - HIVE.cx) / 1320, ny = (y - HIVE.cy) / 1040;
        let open = Math.pow(Math.abs(nx) ** 2.4 + Math.abs(ny) ** 2.4, 1 / 2.4) < 1 + z * 0.16; // built, so rounder than the wild cave
        if (Math.hypot(x - HIVE.dais.x, y - HIVE.dais.y) < HIVE.dais.r + 40) open = true;
        if (distToSegment(x, y, 1600, 2250, 1600, 2700) < 110 + z * 30) open = true; // the passage from the grotto
        if (Math.hypot((x - 1600) / 125, (y - 345) / 85) < 1) open = false; // the throne itself
        for (const [px, py, r] of HIVE_PILLARS) if (Math.hypot(x - px, y - py) < r * (1 + z * 0.25)) open = false;
        data[i] = open ? T_FLOOR : T_WALL;
    }
    for (let i = 0; i < n; i++) { const [x, y] = ctr(i); if (data[i] === T_FLOOR && inLake(HIVE_POOL, x, y, 1)) data[i] = T_LAKE; }
    // Brood pods along the wall (not over the entrance or the dais), four royal ones flanking the throne
    hive.pods = []; hive.burrows = [];
    const toWall = a => { let r = 960; while (r < 1600 && at(HIVE.cx + Math.cos(a) * r, HIVE.cy + Math.sin(a) * r) !== T_WALL) r += 8; return r; };
    for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2 + 0.07, south = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))), north = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
        if (south < 0.42 || north < 0.6) continue;
        const r = toWall(a) - 50, x = HIVE.cx + Math.cos(a) * r, y = HIVE.cy + Math.sin(a) * r;
        if (at(x, y) === T_FLOOR) hive.pods.push({ x, y, a });
    }
    for (const [x, y] of [[1270, 620], [1930, 620], [1330, 400], [1870, 400]]) if (at(x, y) === T_FLOOR) hive.pods.push({ x, y, a: -Math.PI / 2, royal: true });
    for (const a of [0, Math.PI, Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.2, -Math.PI * 0.8]) { // tunnels the brood crawls out of once the pods are gone
        const r = toWall(a), dx = Math.cos(a), dy = Math.sin(a);
        hive.burrows.push({ x: HIVE.cx + dx * (r + 6), y: HIVE.cy + dy * (r + 6), nx: -dx, ny: -dy, sx: HIVE.cx + dx * (r - 40), sy: HIVE.cy + dy * (r - 40) });
    }
    return { cols, rows, cell: cs, data };
}

// ---------- the cached ground layer ----------

function hivePaint(D, G) {
    const W = D.w, H = D.h, rnd = clrRng(8086), cs = G.cell;
    const cellAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows ? T_WALL : G.data[gy * G.cols + gx]; };
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const tmp = cavCanvas(W, H), t = tmp.getContext('2d');
    const noise = cavNoiseArr(W / 2, H / 2, rnd), WM = cavMask(G, v => v === T_WALL, 0.6, noise);
    const layer = (fill, cut, dx, dy) => {
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.fillStyle = fill; t.fillRect(0, 0, W, H);
        t.globalCompositeOperation = 'destination-in'; t.drawImage(WM, 0, 0, W, H);
        if (cut) { t.globalCompositeOperation = 'destination-out'; t.drawImage(WM, dx, dy, W, H); }
        t.globalCompositeOperation = 'source-over'; return tmp;
    };

    // --- floor: dark stone under a skin of wax and membrane ---
    c.fillStyle = '#25161f'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 150; i++) {
        const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 320, k = rnd(), gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, k < 0.45 ? 'rgba(10, 4, 8, 0.5)' : k < 0.75 ? 'rgba(150, 40, 95, 0.16)' : 'rgba(90, 40, 110, 0.2)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const grit = ['rgba(0, 0, 0, 0.35)', 'rgba(210, 130, 170, 0.12)', 'rgba(60, 30, 48, 0.5)', 'rgba(20, 8, 15, 0.5)'];
    for (let i = 0; i < 50000; i++) { c.fillStyle = grit[i & 3]; c.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    // Patches of honeycomb wax set into the floor
    const hex = (x, y, s) => { c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } c.closePath(); };
    for (let i = 0; i < 26; i++) {
        const px = 400 + rnd() * 2400, py = 400 + rnd() * 1900, n = 6 + (rnd() * 14 | 0), s = 14 + rnd() * 6;
        for (let k = 0; k < n; k++) {
            const q = (rnd() * 5 | 0) - 2, r = (rnd() * 5 | 0) - 2, x = px + s * 1.5 * q, y = py + s * Math.sqrt(3) * (r + q / 2);
            if (cellAt(x, y) !== T_FLOOR) continue;
            hex(x, y, s * 0.94); c.fillStyle = rnd() < 0.5 ? 'rgba(120, 60, 50, 0.35)' : 'rgba(70, 30, 40, 0.45)'; c.fill();
            c.strokeStyle = 'rgba(240, 180, 130, 0.18)'; c.lineWidth = 2; c.stroke();
            if (rnd() < 0.3) { c.fillStyle = 'rgba(255, 190, 120, 0.12)'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.2, s * 0.35, 0, Math.PI * 2); c.fill(); }
        }
    }
    // Membrane creeping off the walls
    for (let i = 0; i < 900; i++) {
        const x = rnd() * W, y = rnd() * H; if (cellAt(x, y) !== T_FLOOR || (cellAt(x + 70, y) !== T_WALL && cellAt(x - 70, y) !== T_WALL && cellAt(x, y + 70) !== T_WALL && cellAt(x, y - 70) !== T_WALL)) continue;
        const r = 40 + rnd() * 90, gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(236, 64, 122, 0.2)'); gr.addColorStop(1, 'rgba(236, 64, 122, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Veins: glossy tubes running from the walls and the dais out across the floor
    // (thick, smooth and tapering like roots, so they never read as cracks in the floor)
    const vein = (x, y, a, len, w) => {
        const pts = [[x, y]], turn = (rnd() - 0.5) * 0.08;
        for (let s = 0; s < len; s++) { const nx = x + Math.cos(a) * 30, ny = y + Math.sin(a) * 30; if (cellAt(nx, ny) === T_WALL) break; pts.push([nx, ny]); x = nx; y = ny; a += turn + Math.sin(s * 0.7) * 0.06; }
        for (const [k, col] of [[1.5, 'rgba(40, 0, 18, 0.5)'], [1, 'rgba(173, 20, 87, 0.8)'], [0.35, 'rgba(255, 150, 200, 0.45)']]) {
            c.strokeStyle = col;
            for (let i = 1; i < pts.length; i++) { c.lineWidth = Math.max(2, w * k * (1 - i / pts.length * 0.7)); c.beginPath(); c.moveTo(...pts[i - 1]); c.lineTo(...pts[i]); c.stroke(); }
        }
        for (let i = 2; i < pts.length; i += 3) { const [px, py] = pts[i]; c.fillStyle = 'rgba(255, 120, 180, 0.35)'; c.beginPath(); c.arc(px, py, w * 0.6 * (1 - i / pts.length * 0.6), 0, Math.PI * 2); c.fill(); } // bulges along it
    };
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + rnd() * 0.3; vein(HIVE.cx + Math.cos(a) * 1250, HIVE.cy + Math.sin(a) * 980, a + Math.PI + (rnd() - 0.5) * 0.5, 8 + (rnd() * 8 | 0), 12 + rnd() * 4); }
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.18 + i * 0.13); vein(HIVE.dais.x + Math.cos(a) * HIVE.dais.r, HIVE.dais.y + Math.sin(a) * HIVE.dais.r, a + (rnd() - 0.5) * 0.3, 6 + (rnd() * 6 | 0), 13); }
    for (let i = 0; i < 160; i++) { // pustules
        const x = rnd() * W, y = rnd() * H, r = 2 + rnd() * 5; if (cellAt(x, y) !== T_FLOOR) continue;
        c.fillStyle = '#880e4f'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255, 190, 220, 0.6)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill();
    }

    // --- the royal jelly pool: a wax bank around a dark bed (the surface is drawn live) ---
    lakePath(c, HIVE_POOL, 1.3); c.fillStyle = 'rgba(180, 110, 60, 0.25)'; c.fill();
    lakePath(c, HIVE_POOL, 1.14); c.fillStyle = 'rgba(70, 25, 40, 0.9)'; c.fill();
    lakePath(c, HIVE_POOL, 1.04); c.fillStyle = '#1a0a12'; c.fill();

    // --- the dais: three wax steps rising to the throne ---
    const { x: DX, y: DY, r: DR } = HIVE.dais;
    c.fillStyle = 'rgba(0, 0, 0, 0.45)'; c.beginPath(); c.arc(DX + 14, DY + 18, DR + 6, 0, Math.PI * 2); c.fill();
    [[DR, '#3a1d2b', '#6b3a52'], [DR - 40, '#4a2537', '#86506a'], [DR - 80, '#5c2e44', '#a0607f']].forEach(([r, col, lit]) => {
        const gr = c.createRadialGradient(DX - r * 0.3, DY - r * 0.35, r * 0.1, DX, DY, r); gr.addColorStop(0, lit); gr.addColorStop(1, col);
        c.fillStyle = gr; c.beginPath(); c.arc(DX, DY, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#12060c'; c.lineWidth = 3; c.stroke();
        c.strokeStyle = 'rgba(255, 200, 225, 0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(DX, DY, r - 3, Math.PI * 0.95, Math.PI * 1.6); c.stroke(); // lit lip of each step
    });
    for (let k = 0; k < 18; k++) { // eggs set into the top step like jewels
        const a = k / 18 * Math.PI * 2, x = DX + Math.cos(a) * (DR - 100), y = DY + Math.sin(a) * (DR - 100);
        c.fillStyle = '#f8bbd0'; c.strokeStyle = '#4a1530'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 7, 9, a, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.beginPath(); c.arc(x - 2, y - 3, 2, 0, Math.PI * 2); c.fill();
    }

    // --- walls: lumpy resin and flesh, honeycomb pressed into their edges, a pink-lit rim ---
    c.save(); c.globalAlpha = 0.6; c.filter = 'blur(12px)'; c.drawImage(WM, 16, 20, W, H); c.restore();
    t.clearRect(0, 0, W, H); t.fillStyle = '#22081a'; t.fillRect(0, 0, W, H);
    const lump = ['#2f0c22', '#3a1029', '#1c0612', '#451432', '#2a0a1d'];
    for (let i = 0; i < 7000; i++) {
        const x = rnd() * W, y = rnd() * H; if (cellAt(x, y) !== T_WALL && cellAt(x + 30, y + 30) !== T_WALL) continue;
        const r = 14 + rnd() * 34, gr = t.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
        const col = lump[(rnd() * lump.length) | 0]; gr.addColorStop(0, sprShade(col, 0.35)); gr.addColorStop(1, col);
        t.fillStyle = gr; t.beginPath(); t.arc(x, y, r, 0, Math.PI * 2); t.fill();
    }
    t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.65; t.filter = 'blur(30px)'; t.drawImage(WM, 0, 0, W, H); t.filter = 'none'; t.globalAlpha = 1;
    t.globalCompositeOperation = 'destination-in'; t.drawImage(WM, 0, 0, W, H); t.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, 0, 0);
    for (let i = 0; i < 2600; i++) { // honeycomb cells near the wall edge, a few still holding a glowing larva
        const x = rnd() * W, y = rnd() * H; if (cellAt(x, y) !== T_WALL) continue;
        if (cellAt(x + 50, y) === T_WALL && cellAt(x - 50, y) === T_WALL && cellAt(x, y + 50) === T_WALL && cellAt(x, y - 50) === T_WALL) continue;
        const s = 9 + rnd() * 5; hex(x, y, s); c.fillStyle = '#12040c'; c.fill(); c.strokeStyle = 'rgba(200, 110, 90, 0.4)'; c.lineWidth = 2.5; c.stroke();
        if (rnd() < 0.12) { c.fillStyle = 'rgba(255, 150, 200, 0.7)'; c.beginPath(); c.ellipse(x, y, s * 0.4, s * 0.3, rnd() * 3, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 0.55; c.drawImage(layer('#c2457e', true, 9, 10), 0, 0);
    c.globalAlpha = 0.75; c.drawImage(layer('#ffb3d4', true, 2.5, 3), 0, 0);
    c.globalAlpha = 0.5; c.drawImage(layer('#000', true, -6, -7), 0, 0);
    c.globalAlpha = 1;

    // --- resin pillars: ridged caps with resin dripping down onto the floor ---
    for (const [px, py, r] of HIVE_PILLARS) {
        for (let k = 0; k < 10; k++) { const a = rnd() * Math.PI * 2, d = r + 6 + rnd() * 26; c.fillStyle = 'rgba(200, 120, 60, 0.3)'; c.beginPath(); c.ellipse(px + Math.cos(a) * d, py + Math.sin(a) * d, 5 + rnd() * 8, 3 + rnd() * 4, a, 0, Math.PI * 2); c.fill(); }
        [[r * 0.95, '#5a1d3d'], [r * 0.72, '#7a2a52'], [r * 0.48, '#9b3a69'], [r * 0.24, '#c45c8c']].forEach(([rr, col], k) => {
            c.fillStyle = col; c.beginPath(); c.arc(px - k * 3, py - k * 3.5, rr, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(20, 4, 12, 0.7)'; c.lineWidth = 2; c.stroke();
        });
        c.fillStyle = 'rgba(255, 220, 235, 0.7)'; c.beginPath(); c.arc(px - 14, py - 16, 5, 0, Math.PI * 2); c.fill();
    }

    // --- the throne: a curved back of crystal spires behind a seat of glossy jelly ---
    const TX = 1600, TY = 345;
    c.fillStyle = 'rgba(0, 0, 0, 0.5)'; c.beginPath(); c.ellipse(TX + 16, TY + 20, 150, 105, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 11; k++) { // spires fanning out behind the seat
        const a = Math.PI + 0.25 + k / 10 * (Math.PI - 0.5), L = 70 + (k % 2 ? 0 : 40) + (k === 5 ? 50 : 0), w = 16 + (k === 5 ? 6 : 0);
        const bx = TX + Math.cos(a) * 70, by = TY + 30 + Math.sin(a) * 60, tx = TX + Math.cos(a) * (70 + L), ty = TY + 30 + Math.sin(a) * (60 + L), px = -Math.sin(a) * w, py = Math.cos(a) * w;
        const gr = c.createLinearGradient(bx, by, tx, ty); gr.addColorStop(0, '#7b1fa2'); gr.addColorStop(0.6, '#e1a6ff'); gr.addColorStop(1, '#ffffff');
        c.fillStyle = gr; c.strokeStyle = '#1a0420'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(tx, ty); c.lineTo(bx - px, by - py); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255, 255, 255, 0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx + px * 0.3, by + py * 0.3); c.lineTo(tx, ty); c.stroke();
    }
    let gr = c.createRadialGradient(TX - 30, TY - 10, 10, TX, TY + 20, 130); gr.addColorStop(0, '#8e3a63'); gr.addColorStop(1, '#3a0f26');
    c.fillStyle = gr; c.strokeStyle = '#12040c'; c.lineWidth = 4; c.beginPath(); c.ellipse(TX, TY + 25, 125, 88, 0, Math.PI, Math.PI * 2); c.lineTo(TX + 125, TY + 70); c.quadraticCurveTo(TX, TY + 130, TX - 125, TY + 70); c.closePath(); c.fill(); c.stroke();
    gr = c.createRadialGradient(TX - 20, TY + 50, 6, TX, TY + 70, 80); gr.addColorStop(0, '#ffb3d4'); gr.addColorStop(1, '#ad1457');
    c.fillStyle = gr; c.beginPath(); c.ellipse(TX, TY + 72, 84, 52, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#3a0820'; c.lineWidth = 2.5; c.stroke(); // the seat cushion of jelly

    // --- burrows for when the pods run out, bones of the ones who came before ---
    for (const b of hive.burrows) cavBurrow(c, b, rnd);
    for (let i = 0; i < 12; i++) {
        const a = rnd() * Math.PI * 2, r = 600 + rnd() * 500, x = HIVE.cx + Math.cos(a) * r * 1.2, y = HIVE.cy + Math.sin(a) * r * 0.9; if (cellAt(x, y) !== T_FLOOR) continue;
        c.strokeStyle = 'rgba(225, 215, 200, 0.55)'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { const q = rnd() * 3; c.beginPath(); c.moveTo(x + Math.cos(q) * 12, y + Math.sin(q) * 12); c.lineTo(x - Math.cos(q) * 12, y - Math.sin(q) * 12); c.stroke(); }
        c.fillStyle = 'rgba(230, 220, 205, 0.7)'; c.beginPath(); c.arc(x + 14, y - 4, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1a0a12'; c.fillRect(x + 11, y - 6, 2.5, 2.5); c.fillRect(x + 15, y - 6, 2.5, 2.5);
    }
    tmp.width = 1;
    hive.ground = g;
}

// ---------- brood pods ----------

function makePod(p) {
    const e = { type: 'brood_pod', pod: p, x: p.x, y: p.y, size: 46, color: '#f48fb1', hp: 30 + wave * 8, maxHp: 30 + wave * 8, xp: 0, dmg: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: 0, seed: Math.random() * 10 };
    p.ent = e; p.state = 'whole'; enemies.push(e);
}
function openPod(p, popped) {
    p.state = 'open'; p.openAt = fxTime; p.regrow = (popped ? 22 : 16) + Math.random() * 6; p.popped = popped;
    if (p.ent) { p.ent.dead = true; p.ent = null; }
    burst(p.x, p.y, 0, Math.PI * 2, popped ? 16 : 10, { kind: 'goo', color: '#f48fb1', size: 4, speed: [60, popped ? 260 : 160], life: 0.6, drag: 3 });
    effects.push({ type: 'slime_splat', x: p.x, y: p.y + 6, r: 26, color: '#c2185b', life: 6, maxLife: 6, seed: Math.random() * 10 });
}
// combat.js: a pod's hp ran out (popped by the hero)
function podPopped(e) {
    e.dead = true; openPod(e.pod, true);
    gainXP(4 + wave);
}

// A slime hatches from an intact pod away from the hero; with none left it crawls out of a burrow
function hiveSpawnPoint() {
    const d = p => Math.hypot(p.x - player.x, p.y - player.y), whole = hive.pods.filter(p => p.state === 'whole' && p.ent);
    let list = whole.filter(p => d(p) > 420); if (!list.length) list = whole.filter(p => d(p) > 260);
    if (list.length) { const p = list[(Math.random() * list.length) | 0]; openPod(p, false); return { x: p.x - Math.cos(p.a) * 10, y: p.y - Math.sin(p.a) * 10, from: 'pod' }; }
    const b = hive.burrows.slice().sort((a, c) => Math.hypot(c.sx - player.x, c.sy - player.y) - Math.hypot(a.sx - player.x, a.sy - player.y))[0];
    return { x: b.sx, y: b.sy, from: 'burrow' };
}

// ---------- per-frame gameplay ----------

function updateHive(dt) {
    // Wading through royal jelly is no better than slime
    const suit = equipment.armor && equipment.armor.name === 'Hazard Suit';
    player.wading = !suit && player.z <= 4 && terrainAt(player.x, player.y) === T_LAKE;
    if (player.wading) takeDamage((player.maxHp * 0.025 + wave * 0.6) * dt, true);
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius);
    player.wallHit = null; for (const e of enemies) e.wallHit = null;
    // Pods grow back
    if (!hive.dead) for (const p of hive.pods) if (p.state === 'open' && fxTime - p.openAt > p.regrow) { makePod(p); p.grownAt = fxTime; }
}
// Every slime death (enemysprites.js): the sleeping Queen stirs
function hiveOnKill(e) { if (currentMap.type === 'hive' && !hive.awake && e.type !== 'brood_pod') hive.stirAt = fxTime; }

// ---------- the Queen wakes (wave 15) ----------

function startQueenWake(b) {
    hive.awake = true;
    b.x = HIVE.seat.x; b.y = HIVE.seat.y; b.state = 'intro'; b.introK = 0; b.airborne = true; b.seed = 3;
    stageEvent = { type: 'queen_wake', t: 0, boss: b, blocking: true, shook: 0 };
}
function updateQueenWake(ev, dt) {
    const b = ev.boss, t = ev.t, front = STAGE_MAPS.hive.throneFront;
    camera.tx = HIVE.seat.x; camera.ty = HIVE.seat.y + 330;
    b.introK = clamp01(t / 2.2); // eyes open, she draws herself up
    if (t > 0.6 && t < 2.2 && t - ev.shook > 0.3) { ev.shook = t; addShake(1.2 + t); }
    if (t > 2.2 && !ev.roar) {
        ev.roar = true; addShake(9); hive.pulseAt = fxTime;
        effects.push({ type: 'slime_shock', x: b.x, y: b.y + 40, radius: 360, color: '#ff4f9a', life: 0.7, maxLife: 0.7 });
        burst(b.x, b.y, 0, Math.PI * 2, 20, { kind: 'goo', color: '#f06292', size: 5, speed: [160, 380], life: 0.6, drag: 3 });
        showBossCard(BOSS_NAMES[b.type] || 'The Hive Queen', 'Mother of the Colony');
    }
    if (t > 2.8) { const k = clamp01((t - 2.8) / 1.2), e = k * k * (3 - 2 * k); b.y = lerp(HIVE.seat.y, front.y, e); } // she glides down the steps
    if (t > 4.0 && !ev.landed) { ev.landed = true; addShake(5); effects.push({ type: 'slime_shock', x: b.x, y: b.y, radius: 170, color: '#f06292', life: 0.5, maxLife: 0.5 }); }
    if (t > 4.3) camera.tx = camera.ty = null;
    if (t > 4.7) { b.state = 'idle'; b.stateTimer = 1.5; b.introK = undefined; b.airborne = false; stageEvent = null; }
}

// ---------- her last stand: she leaps back onto her throne, then the bullet hell (ai.js) ----------

function startQueenThroes(e) {
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].isEnemy) { burst(projectiles[i].x, projectiles[i].y, 0, Math.PI * 2, 3, { kind: 'goo', color: '#ff80ab', size: 3, speed: [30, 90], life: 0.3, drag: 4 }); projectiles.splice(i, 1); }
    stageEvent = { type: 'queen_throes', t: 0, boss: e, blocking: true, fromX: e.x, fromY: e.y };
}
function updateQueenThroes(ev, dt) {
    const b = ev.boss, t = ev.t, S = HIVE.seat, pan = clamp01((t - 0.2) / 1.0);
    camera.tx = lerp(ev.fromX, S.x, pan); camera.ty = lerp(ev.fromY, S.y + 330, pan);
    if (t < 0.5 && t - (ev.shook || 0) > 0.12) { ev.shook = t; addShake(2); } // she shudders...
    const k = clamp01((t - 0.5) / 0.9); // ...then leaps back to her throne
    b.leapK = t > 0.5 && k < 1 ? k : undefined; b.airborne = k < 1;
    b.x = lerp(ev.fromX, S.x, k); b.y = lerp(ev.fromY, S.y, k);
    if (k >= 1 && !ev.landed) {
        ev.landed = true; b.onThrone = true; addShake(8); hive.pulseAt = fxTime;
        effects.push({ type: 'slime_shock', x: S.x, y: S.y + 40, radius: 380, color: '#ff4f9a', life: 0.7, maxLife: 0.7 });
        burst(S.x, S.y, 0, Math.PI * 2, 20, { kind: 'goo', color: '#f06292', size: 5, speed: [160, 380], life: 0.6, drag: 3 });
        showBossCard('Her Last Stand', 'Survive');
    }
    if (t > 2.6) { camera.tx = camera.ty = null; stageEvent = null; }
}

// ---------- she dies: the brood dies with her, her crown stays on the dais ----------

function queenDefeated(e) {
    hive.dead = true;
    for (const o of enemies) if (o !== e && !o.dead) { o.dead = true; if (o.pod) openPod(o.pod, true); else enemyDeathFx(o); }
    activeEnemies = 0; enemiesToSpawn = 0;
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].isEnemy) { burst(projectiles[i].x, projectiles[i].y, 0, Math.PI * 2, 3, { kind: 'goo', color: '#ff80ab', size: 3, speed: [30, 90], life: 0.3, drag: 4 }); projectiles.splice(i, 1); } // her last bolts burst with her
    for (const p of hive.pods) if (p.state === 'whole') openPod(p, true);
    addShake(10);
    for (const col of ['#f06292', '#f8bbd0', '#ad1457']) burst(e.x, e.y, 0, Math.PI * 2, 14, { kind: 'goo', color: col, size: 6, speed: [120, 420], life: 0.8, drag: 3 });
    effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 420, color: '#ff4f9a', life: 0.9, maxLife: 0.9 });
    const cx = e.x, cy = e.onThrone ? e.y + 100 : e.y; // off the throne, onto the top step
    hive.trophy = { x: cx, y: cy, t0: fxTime };
    STAGE_MAPS.hive.exit = { x: cx, y: cy };
    openStageExit('#ff4081');
    updateHUD();
}

function startTrophyClaim() { stageEvent = { type: 'trophy_claim', t: 0, blocking: true }; showStagePrompt(false); }
function updateTrophyClaim(ev, dt) {
    const T = hive.trophy; player.dash = null; player.grappleTarget = null;
    camera.tx = player.x; camera.ty = player.y;
    if (ev.t > 0.9 && !ev.flash) {
        ev.flash = true; addShake(4);
        effects.push({ type: 'slime_shock', x: player.x, y: player.y, radius: 260, color: '#ffd54f', life: 0.8, maxLife: 0.8 });
        burst(player.x, player.y - 30, 0, Math.PI * 2, 24, { kind: 'spark', color: '#ffe082', size: 3, speed: [140, 380], life: 0.6, drag: 4 });
    }
    T.claimK = clamp01(ev.t / 0.9);
    if (ev.t > 2.0) { stageEvent = null; camera.tx = camera.ty = null; hive.trophy = null; currentMap.caveOpen = false; showVictory(); } // the crown is yours
}

// ---------- drawing (world space) ----------

function drawHiveGround() {
    const W = hive.ground.width, H = hive.ground.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, canvas.width + 42), sh = Math.min(H - sy, canvas.height + 42);
    ctx.drawImage(hive.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(300);
    drawHivePool(t);
    for (const p of hive.pods) if (p.state !== 'whole' && cavIn(p.x, p.y, V)) drawPodShell(p, t);
    if (!hive.awake && cavIn(HIVE.seat.x, HIVE.seat.y, V)) drawSleepingQueen();
    const pulse = Math.max(0, 1 - (t - hive.pulseAt) / 1.2);
    drawDarkLayer(hive.dead ? 'rgba(14, 4, 10, 0.5)' : 'rgba(16, 3, 11, 0.62)', hole => {
        hole(HIVE_POOL.x, HIVE_POOL.y, 400, 0.45);
        hole(HIVE.seat.x, HIVE.seat.y + 80, 520, 0.6 + pulse * 0.3);
        hole(1600, 2550, 340, 0.4);
        for (const p of hive.pods) if (p.state === 'whole') hole(p.x, p.y, 130, 0.5 + pulse * 0.3);
        for (const e of enemies) if (!e.dead && e.type === 'boss_slime_queen') hole(e.x, e.y, 340, 0.55);
        for (const [px, py] of HIVE_PILLARS) hole(px, py, 160, 0.3);
        if (hive.trophy) hole(hive.trophy.x, hive.trophy.y, 360, 0.8);
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (cavIn(HIVE_POOL.x, HIVE_POOL.y, V)) ptGlow(ctx, HIVE_POOL.x, HIVE_POOL.y, 300, '#ff4f9a', 0.07 + 0.03 * Math.sin(t * 1.5));
    if (cavIn(HIVE.seat.x, HIVE.seat.y, V)) ptGlow(ctx, HIVE.seat.x, HIVE.seat.y - 40, 240, '#d48cff', 0.16 + pulse * 0.3); // the throne's crystals
    for (const p of hive.pods) if (p.state === 'whole' && cavIn(p.x, p.y, V)) ptGlow(ctx, p.x, p.y, 46, '#ff6fa8', 0.22 + 0.1 * Math.sin(t * 2 + p.x) + pulse * 0.4);
    ctx.restore();
    for (const e of enemies) if (!e.dead && !(e.spawnT > 0) && !e.airborne && e.type !== 'brood_pod' && terrainAt(e.x, e.y) === T_LAKE) cavRipple(e.x, e.y + e.size * 0.2, e.size * 0.6, e.seed || 0);
    if (player.z <= 4 && terrainAt(player.x, player.y) === T_LAKE) cavRipple(player.x, player.y + 8, 16, 0);
    if (hive.trophy) drawTrophy(t);
}

function drawHivePool(t) {
    const L = HIVE_POOL;
    if (!L.surf) { // painted once, like the cave lakes
        const R = Math.ceil(Math.max(L.rx, L.ry) * 1.2 + 6), cv = cavCanvas(R * 2, R * 2), c = cv.getContext('2d');
        c.translate(R - L.x, R - L.y); lakePath(c, L, 1);
        const g = c.createRadialGradient(L.x - L.rx * 0.3, L.y - L.ry * 0.4, 10, L.x, L.y, L.rx * 1.05); g.addColorStop(0, '#d9558d'); g.addColorStop(0.5, '#9c2259'); g.addColorStop(1, '#4a0a28');
        c.fillStyle = g; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255, 190, 220, 0.4)'; c.lineWidth = 2.5; c.stroke();
        c.fillStyle = 'rgba(255, 220, 235, 0.12)'; c.beginPath(); c.ellipse(L.x - L.rx * 0.25, L.y - L.ry * 0.35, L.rx * 0.45, L.ry * 0.18, -0.1, 0, Math.PI * 2); c.fill(); // a glossy sheen
        L.surf = cv; L.surfR = R;
    }
    ctx.drawImage(L.surf, L.x - L.surfR, L.y - L.surfR);
    ctx.save();
    for (let i = 0; i < 8; i++) { // thick bubbles of royal jelly
        const k = (t * 0.5 + cavHash(i + 7)) % 1, cyc = Math.floor(t * 0.5 + cavHash(i + 7)), bx = L.x + (cavHash(cyc * 7 + i) - 0.5) * L.rx * 1.3, by = L.y + (cavHash(cyc * 13 + i) - 0.5) * L.ry * 1.0;
        if (k < 0.8) { const br = 3 + k * 7; ctx.fillStyle = 'rgba(255, 210, 230, 0.35)'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); }
        else { const q = (k - 0.8) / 0.2; ctx.strokeStyle = `rgba(255, 220, 235, ${0.6 * (1 - q)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(bx, by, 5 + q * 12, (5 + q * 12) * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
}

// An opened pod: torn shell petals around a puddle; the last few seconds before it regrows, a new sac swells inside
function drawPodShell(p, t) {
    const c = ctx, x = p.x, y = p.y, grow = hive.dead ? 0 : clamp01((t - p.openAt - (p.regrow - 5)) / 5);
    c.fillStyle = 'rgba(120, 20, 60, 0.45)'; c.beginPath(); c.ellipse(x, y + 4, 26, 18, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + p.x, bx = x + Math.cos(a) * 14, by = y + Math.sin(a) * 12, tx = x + Math.cos(a) * 30, ty = y + Math.sin(a) * 26;
        c.fillStyle = hive.dead ? '#6d4a58' : '#d77aa0'; c.strokeStyle = '#3a0820'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(bx - Math.sin(a) * 9, by + Math.cos(a) * 9); c.lineTo(tx, ty); c.lineTo(bx + Math.sin(a) * 9, by - Math.cos(a) * 9); c.closePath(); c.fill(); c.stroke();
    }
    if (grow > 0) drawPodSac(c, x, y, 22 * grow, t, p.x, 0);
}

// The egg sac itself: translucent membrane, veins, a curled shape moving inside
function drawPodSac(c, x, y, r, t, seed, flash) {
    if (r < 1) return;
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(x + 4, y + r * 0.5, r * 1.05, r * 0.6, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, flash ? '#ffffff' : '#ffd6e7'); g.addColorStop(0.55, flash ? '#ffe0ee' : '#f06292'); g.addColorStop(1, '#880e4f');
    c.fillStyle = g; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#3a0820'; c.lineWidth = 2.2; c.stroke();
    const a = t * 0.8 + seed; // the larva turning over inside
    c.fillStyle = 'rgba(80, 0, 40, 0.45)'; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15, r * 0.5, r * 0.32, a, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(120, 0, 50, 0.5)'; c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const q = k * 2.1 + seed; c.beginPath(); c.moveTo(x + Math.cos(q) * r * 0.95, y + Math.sin(q) * r); c.quadraticCurveTo(x + Math.cos(q + 0.5) * r * 0.4, y + Math.sin(q + 0.5) * r * 0.4, x + Math.cos(q + 1.2) * r * 0.2, y + Math.sin(q + 1.2) * r * 0.2); c.stroke(); }
    c.fillStyle = 'rgba(255, 255, 255, 0.65)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.45, r * 0.25, r * 0.13, -0.6, 0, Math.PI * 2); c.fill();
}

// The Queen asleep on her throne, eyes half-lidded and following you; she stirs when her brood dies
function drawSleepingQueen() {
    if (!hive.sleeper) hive.sleeper = { x: HIVE.seat.x, y: HIVE.seat.y, size: 120, color: '#f06292', hp: 1, maxHp: 1, type: 'boss_slime_queen', seed: 3, state: 'sleep' };
    drawQueen(hive.sleeper, { sleep: 1 - clamp01((fxTime - hive.stirAt) < 1.4 ? 1 - (fxTime - hive.stirAt) / 1.4 : 0) });
}

function drawTrophy(t) {
    const T = hive.trophy, k = T.claimK || 0, x = lerp(T.x, player.x, k), bob = Math.sin(t * 2.5) * 5, y = lerp(T.y, player.y, k) - 26 - bob - k * 20;
    if (k < 1) {
        const g = ctx.createLinearGradient(T.x, T.y - 260, T.x, T.y); g.addColorStop(0, 'rgba(255, 128, 171, 0)'); g.addColorStop(1, `rgba(255, 180, 210, ${0.35 * (1 - k)})`);
        ctx.fillStyle = g; ctx.fillRect(T.x - 22, T.y - 260, 44, 260); // a column of light over it
        ctx.strokeStyle = `rgba(255, 200, 225, ${(0.5 + 0.3 * Math.sin(t * 4)) * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(T.x, T.y + 4, 40, 26, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 34 + bob, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ptGlow(ctx, x, y, 60, '#ff80ab', 0.45); ctx.restore();
    drawQueenCrown(ctx, x, y, 64, Math.sin(t * 1.2) * 0.15);
}

// Above everything: pink spores drifting through the light
function drawHiveAbove() {
    const c = ctx, t = fxTime, tx0 = Math.floor(player.x / 220), ty0 = Math.floor(player.y / 220);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let ty = ty0 - 3; ty <= ty0 + 3; ty++) for (let tx = tx0 - 4; tx <= tx0 + 4; tx++) {
        const h = tx * 61 + ty * 173, x = tx * 220 + cavHash(h) * 220 + Math.sin(t * 0.4 + h) * 30, y = ty * 220 + cavHash(h + 3) * 220 - (t * 12 + cavHash(h + 9) * 220) % 220 + 110;
        const a = (0.25 + 0.25 * Math.sin(t * 1.7 + h)) * (hive.dead ? 0.3 : 1);
        c.fillStyle = `rgba(255, 150, 200, ${a})`; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
}
