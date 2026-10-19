// ==========================================
// map_castle.js - Bandit Bastion stage 4: the Bastion itself (waves 12-17)
// ==========================================
// Valerius's castle, west to east, in three parts that open one after another like the Raiders' Trail: the outer bailey
// inside the curtain walls (waves 12-13: barracks, stables, a smithy and stores, the garrison pouring out of doorways and
// down the wall stairs), the keep (waves 14-15: the great hall with its long tables and hearths, then the treasury heaped
// with plunder) and the throne room (waves 16-17: the Royal Guard, then Valerius himself). The keep's doors (T_SEAL) are
// blown in by a powder cart once wave 13 is cleared (keep_breach); the throne room's doors swing open from inside after
// wave 15 (throne_doors). It's night: the shared half-resolution darkness (map_cavern.js drawDarkLayer) is lit by
// braziers, wall torches, the forge and the hearths. buildCastle() lays the grid out and paints one ground layer once;
// the doors, the fires, the powder cart, the banners and the chandeliers are live.

STAGE_MAPS.castle = {
    w: 6400, h: 1800, cell: 25,
    bounds: { left: 30, top: 30, right: 6370, bottom: 1770 },
    start: { x: 190, y: 900 },
    exit: { x: 6060, y: 900 }, exitR: 60, arrow: '#ffab40', // the run ends at his crown, not at an exit
    prompt: 'Storm the Bastion',
    obstacles: [], grid: null,
};

// Layout (25 px cells). x: where each part begins; the rooms run |y - 900| < their half-height.
const CS = { y: 900, gate: 350, keep: 2450, keepIn: 2550, div: 3500, divIn: 3550, throne: 4450, throneIn: 4500, end: 6350 };
const CS_HALF = { hall: 420, treasury: 380, throne: 450 };
const CS_COUNT = [26, 28, 30, 32]; // enemies in waves 12-15 (main.js startNextWave; the formula would give 33-40)
const CS_TOWERS = [[350, 250, 120], [350, 1550, 120], [2450, 250, 120], [2450, 1550, 120], [1400, 250, 70], [1400, 1550, 70], [200, 700, 100], [200, 1100, 100]]; // [x, y, r]: the bailey's corners, two mid-wall towers, the gatehouse
const CS_BUILD = [ // the bailey's buildings: wall blocks with doorway notches on the side they face
    { kind: 'barracks', x0: 600, y0: 250, x1: 1150, y1: 450, side: 's', doors: [740, 1010] },
    { kind: 'smithy', x0: 1600, y0: 250, x1: 1875, y1: 425, side: 's', doors: [1700] },
    { kind: 'stable', x0: 600, y0: 1350, x1: 1150, y1: 1550, side: 'n', doors: [700, 875, 1050] },
    { kind: 'store', x0: 1650, y0: 1375, x1: 2025, y1: 1550, side: 'n', doors: [1840] },
];
const CS_TABLES = [[2725, 725, 3275, 775], [2725, 1025, 3275, 1075]]; // the great hall's long tables (T_FENCE: walkers go round, shots and leaps pass)
const CS_ALCOVES = [5150, 5670]; // recesses in the throne room's side walls
const CS_PROPS = [ // solid things: [x, y, r, kind]
    [1300, 900, 32, 'well'], [1180, 640, 14, 'dummy'], [1265, 595, 14, 'dummy'], [1310, 690, 14, 'dummy'], [1035, 580, 20, 'rack'],
    [1725, 500, 30, 'forge'], [1632, 505, 14, 'anvil'], [1812, 508, 13, 'barrel'], [870, 1265, 28, 'hay'], [1010, 1275, 24, 'hay'],
    [1520, 1210, 30, 'cart'], [2120, 640, 30, 'cart'], [2230, 1265, 16, 'crate'], [2268, 1302, 13, 'crate'], [790, 545, 16, 'crate'], [1960, 470, 16, 'crate'],
    [560, 760, 18, 'brazier'], [560, 1040, 18, 'brazier'], [2330, 1040, 18, 'brazier'], [2330, 760, 18, 'brazier_t'], [2392, 1010, 30, 'pcart'],
    [2700, 630, 24, 'pillar'], [2900, 630, 24, 'pillar'], [3100, 630, 24, 'pillar'], [3300, 630, 24, 'pillar'],
    [2700, 1170, 24, 'pillar'], [2900, 1170, 24, 'pillar'], [3100, 1170, 24, 'pillar'], [3300, 1170, 24, 'pillar'],
    [3000, 500, 26, 'hearth'], [3000, 1300, 26, 'hearth'],
    [3780, 640, 34, 'gold'], [4250, 650, 34, 'gold'], [3760, 1170, 34, 'gold'], [4230, 1160, 34, 'gold'],
    [3900, 580, 16, 'chest'], [4100, 1225, 16, 'chest'], [4080, 585, 16, 'chest'], [3660, 1060, 16, 'chest'],
    [4000, 690, 26, 'pillar'], [4000, 1110, 26, 'pillar'], [3620, 560, 13, 'armor'], [3620, 1240, 13, 'armor'], [4400, 560, 13, 'armor'], [4400, 1240, 13, 'armor'],
    [4760, 610, 30, 'pillar_t'], [5020, 610, 30, 'pillar_t'], [5280, 610, 30, 'pillar_t'], [5540, 610, 30, 'pillar_t'], [5800, 610, 30, 'pillar_t'],
    [4760, 1190, 30, 'pillar_t'], [5020, 1190, 30, 'pillar_t'], [5280, 1190, 30, 'pillar_t'], [5540, 1190, 30, 'pillar_t'], [5800, 1190, 30, 'pillar_t'],
    [4640, 690, 18, 'brazier'], [4640, 1110, 18, 'brazier'], [5920, 700, 18, 'brazier'], [5920, 1100, 18, 'brazier'], [6190, 900, 44, 'throne'],
];
const CS_KEGS = [[900, 560], [1560, 1100], [2050, 1180], [1990, 570], [760, 1180], [2290, 1150]];
const CS_TRAIL = [[2340, 775], [2380, 795], [2412, 850], [2412, 930], [2398, 985]]; // the powder spilled from the brazier to the cart
const CS_DAIS = { x0: 5980, x1: 6350, hy: 300 };
const CS_THRONE = { x: 6190, y: 900 }, CS_SEAT = { x: 6168, y: 900 }; // where Valerius sits
const CS_CHAND = [[4890, 900], [5150, 735], [5150, 1065], [5410, 900], [5670, 735], [5670, 1065]]; // chandeliers hung over the nave
const CS_BANNERS = [[800, 190, 1], [1900, 190, 1], [900, 1610, -1], [2150, 1610, -1], [2500, 430, 1], [2500, 1370, -1]]; // [x, y, side]: poles on the wall tops

const cst = { built: false, ground: null, grid: null, open: 0, keepCells: [], throneCells: [], spawns: [], kegs: [], torches: [], lastSpawn: null,
    arriveAt: 0, portK: 0, promptAt: 0, brazierDown: false, fuseK: 0, breachAt: -9, throneK: 0, seated: false, guardMax: 0,
    audience: false, guardDown: 0, bark: null, barkHitAt: -99, snapAt: -9, rising: false, riseK: 0, // wave 16: the audience, the Royal Guard, his barks
    king: null, whirl: false, chand: CS_CHAND.map(() => ({ state: 'up' })), kicked: [], toppled: [], pillarSpear: null, dim: 0, dimK: 0, crown: null }; // wave 17: the King of Thieves and his hall

const csSec = x => (x < CS.keep ? 0 : x < CS.throne ? 1 : 2);
const csOutside = (x, y) => x < CS.keep && (y < 130 || y > 1670 || (x < 230 && Math.abs(y - CS.y) >= 90)) && !CS_TOWERS.some(([tx, ty, r]) => Math.hypot(x - tx, y - ty) < r);
const csInBuilding = (x, y) => CS_BUILD.some(b => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);

function buildCastle() {
    if (cst.built) return;
    const D = STAGE_MAPS.castle;
    D.grid = cst.grid = csGenerate(D);
    csPaint(D, D.grid);
    cst.built = true;
}

// Start of every visit: the keep's doors and the throne room's are barred again, the kegs are back, the gate is up behind you
function resetCastle() {
    const D = STAGE_MAPS.castle, G = cst.grid;
    for (const i of cst.keepCells) G.data[i] = T_SEAL;
    for (const i of cst.throneCells) G.data[i] = T_SEAL;
    cst.open = 0; cst.lastSpawn = null; cst.brazierDown = false; cst.fuseK = 0; cst.breachAt = -9; cst.throneK = 0; cst.seated = false; cst.guardMax = 0;
    for (const o of cst.kicked) D.obstacles.push(o); // the braziers he kicked stand again
    cartWreck(false);
    cst.kicked = []; cst.toppled = []; cst.chand = CS_CHAND.map(() => ({ state: 'up' })); cst.pillarSpear = null; cst.dim = cst.dimK = 0; cst.crown = null; cst.king = null; cst.whirl = false;
    castleSeat(false); cst.audience = false; cst.guardDown = 0; cst.bark = null; cst.barkHitAt = -99; cst.snapAt = -9; cst.rising = false; cst.riseK = 0;
    cst.arriveAt = fxTime; cst.portK = 0; cst.dropped = false; cst.promptAt = fxTime;
    for (let i = D.obstacles.length - 1; i >= 0; i--) if (D.obstacles[i].kind === 'keg') D.obstacles.splice(i, 1);
    for (const k of cst.kegs) { if (k.ent) k.ent.dead = true; k.ent = null; makeKeg(k); } // bandits.js
    showStagePrompt(true);
    if (activeExpedition) expOpenMap('castle'); // expeditions.js: the castle as it is now, every door open
}

// Entering the castle at a wave: a jump straight to wave 14 / 16 (dev console) opens the doors behind it and starts in that part
function castleEnter(w) {
    const need = w >= 16 ? 2 : w >= 14 ? 1 : 0;
    if (cst.open === need) return;
    if (cst.open > need) resetCastle();
    stageEvent = null; showStagePrompt(false);
    if (need >= 1) { cartWreck(true); for (const i of cst.keepCells) cst.grid.data[i] = T_FLOOR; cst.breachAt = fxTime - 30; cst.brazierDown = true; cst.fuseK = 1; }
    if (need >= 2) { for (const i of cst.throneCells) cst.grid.data[i] = T_FLOOR; cst.throneK = 1; castleSeat(true); } // he's on his throne, waiting
    cst.open = need;
    player.x = need === 2 ? 4600 : need === 1 ? 2650 : STAGE_MAPS.castle.start.x; player.y = CS.y;
    updateNav(true); updateCamera(0, true);
}

// ---------- generation ----------

function csFloor(x, y) {
    const dy = Math.abs(y - CS.y);
    if (x < 50) return T_WALL;
    if (x < CS.gate) return dy < 90 ? T_FLOOR : T_WALL; // the gate passage
    if (x < CS.keep) return y >= 250 && y < 1550 ? T_FLOOR : T_WALL; // the bailey
    if (x < CS.keepIn) return dy < 75 ? T_SEAL : T_WALL; // the keep's doors
    if (x < CS.div) return dy < CS_HALF.hall ? T_FLOOR : T_WALL; // the great hall
    if (x < CS.divIn) return dy < 110 || Math.abs(dy - 300) < 60 ? T_FLOOR : T_WALL; // three arches through to the treasury
    if (x < CS.throne) return dy < CS_HALF.treasury ? T_FLOOR : T_WALL;
    if (x < CS.throneIn) return dy < 100 ? T_SEAL : T_WALL; // the throne room's doors
    if (x < CS.end) return dy < CS_HALF.throne || (dy < 540 && CS_ALCOVES.some(a => Math.abs(x - a) < 70)) ? T_FLOOR : T_WALL;
    return T_WALL;
}

function csGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), rnd = clrRng(6113);
    const cxOf = i => (i % cols + 0.5) * cs, cyOf = i => (Math.floor(i / cols) + 0.5) * cs;
    cst.keepCells = []; cst.throneCells = [];
    for (let i = 0; i < n; i++) {
        const x = cxOf(i), y = cyOf(i);
        data[i] = CS_TOWERS.some(([tx, ty, r]) => Math.hypot(x - tx, y - ty) < r) ? T_WALL : csFloor(x, y);
        if (data[i] === T_SEAL) (x < CS.throne ? cst.keepCells : cst.throneCells).push(i);
    }
    for (const b of CS_BUILD) { // a block of wall with a notch two cells wide at each door
        for (let gy = b.y0 / cs; gy < b.y1 / cs; gy++) for (let gx = b.x0 / cs; gx < b.x1 / cs; gx++) data[gy * cols + gx] = T_WALL;
        const gy = b.side === 's' ? b.y1 / cs - 1 : b.y0 / cs;
        for (const dx of b.doors) for (const gx of [Math.floor(dx / cs) - 1, Math.floor(dx / cs)]) data[gy * cols + gx] = T_FLOOR;
    }
    for (const [x0, y0, x1, y1] of CS_TABLES) for (let gy = y0 / cs; gy < y1 / cs; gy++) for (let gx = x0 / cs; gx < x1 / cs; gx++) data[gy * cols + gx] = T_FENCE;
    // floor the hero can't reach becomes wall (the doors count as open for the search)
    const seen = new Uint8Array(n), start = Math.floor(D.start.y / cs) * cols + Math.floor(D.start.x / cs), q = [start];
    seen[start] = 1;
    while (q.length) {
        const i = q.pop(), gx = i % cols;
        for (const j of [gx > 0 ? i - 1 : -1, gx < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < n && !seen[j] && (data[j] === T_FLOOR || data[j] === T_SEAL || data[j] === T_FENCE)) { seen[j] = 1; q.push(j); }
    }
    for (let i = 0; i < n; i++) if (!seen[i] && data[i] === T_FLOOR) data[i] = T_WALL;
    D.obstacles.length = 0;
    for (const [x, y, r, kind] of CS_PROPS) D.obstacles.push({ x, y, r, kind, seed: rnd() * 10 });
    const at = (x, y) => data[Math.floor(y / cs) * cols + Math.floor(x / cs)];
    cst.kegs = CS_KEGS.filter(([x, y]) => at(x, y) === T_FLOOR).map(([x, y]) => ({ x, y, ent: null, goneAt: -99, obs: null }));
    cst.spawns = csSpawns();
    cst.torches = csTorches(at);
    return { cols, rows, cell: cs, data };
}

// Where the garrison steps out: building doorways, the wall stairs, the hall's side doors, from behind the treasury's
// tapestries. Each has a point inside to step out of (ox, oy) and the part of the castle it belongs to (sec).
function csSpawns() {
    const out = [], add = (x, y, ox, oy, from, sec) => out.push({ x, y, ox, oy, from, sec });
    for (const b of CS_BUILD) for (const dx of b.doors) {
        const s = b.side === 's' ? 1 : -1, face = b.side === 's' ? b.y1 : b.y0;
        add(dx, face + s * 34, dx, face - s * 12, 'door', 0);
    }
    for (const [x, s] of [[520, -1], [2180, -1], [520, 1], [2200, 1]]) add(x, CS.y + s * 610, x, CS.y + s * 700, 'stairs', 0); // down the steps from the wall walk
    for (const x of [2650, 3400]) for (const s of [-1, 1]) add(x, CS.y + s * (CS_HALF.hall - 40), x, CS.y + s * (CS_HALF.hall + 14), 'door', 1);
    for (const x of [3800, 4200]) for (const s of [-1, 1]) add(x, CS.y + s * (CS_HALF.treasury - 40), x, CS.y + s * (CS_HALF.treasury + 14), 'tapestry', 1);
    for (const s of [-1, 1]) add(4640, CS.y + s * (CS_HALF.throne - 40), 4640, CS.y + s * (CS_HALF.throne + 14), 'door', 2);
    return out;
}

// Torches in iron brackets along the wall faces, [x, y, side]: side is +1 when the room lies south of the wall
function csTorches(at) {
    const out = [], spawnNear = (x, y) => cst.spawns.some(p => Math.hypot(p.x - x, p.y - y) < 80);
    const run = (x0, x1, step, yN, yS) => { for (let x = x0; x <= x1; x += step) for (const [y, s] of [[yN, 1], [yS, -1]]) {
        if (at(x, y + s * 12) !== T_FLOOR || at(x, y - s * 12) === T_FLOOR || spawnNear(x, y) || csInBuilding(x, y - s * 12)) continue;
        if (CS_PROPS.some(([px, py, r]) => Math.hypot(px - x, py - y) < r + 40)) continue;
        out.push([x, y, s]);
    } };
    run(520, 2330, 260, 250, 1550); // the curtain walls
    run(2650, 3400, 250, CS.y - CS_HALF.hall, CS.y + CS_HALF.hall); // the great hall
    run(3650, 4350, 175, CS.y - CS_HALF.treasury, CS.y + CS_HALF.treasury); // the treasury
    run(4630, 5900, 260, CS.y - CS_HALF.throne, CS.y + CS_HALF.throne); // the throne room
    for (const b of CS_BUILD) for (const dx of b.doors) { const s = b.side === 's' ? 1 : -1, y = b.side === 's' ? b.y1 : b.y0; out.push([dx + 38, y, s]); } // beside each doorway
    return out;
}

// ---------- the cached ground ----------

function csPaint(D, G) {
    const W = D.w, H = D.h, rnd = clrRng(7717), N = cavNoise(5151), cs = G.cell, cols = G.cols, rows = G.rows;
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const at = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? T_WALL : G.data[gy * cols + gx]; };
    const blot = (x0, y0, w, h, n, cols3, rmin, rmax) => { for (let i = 0; i < n; i++) { const x = x0 + rnd() * w, y = y0 + rnd() * h, r = rmin + rnd() * (rmax - rmin), gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, cols3[(rnd() * cols3.length) | 0]); gr.addColorStop(1, 'rgba(0, 0, 0, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } };

    // --- outside the walls: dark turf on the castle's rock at night ---
    c.fillStyle = '#1b2017'; c.fillRect(0, 0, W, H);
    blot(0, 0, CS.keep + 200, H, 60, ['rgba(40, 52, 30, 0.45)', 'rgba(8, 10, 8, 0.5)'], 80, 220);
    for (let i = 0; i < 70; i++) { const x = rnd() * CS.keep, y = rnd() < 0.5 ? rnd() * 120 : 1680 + rnd() * 120; cavRock(c, x, y, 6 + rnd() * 10, rnd, '#3e3d38'); }

    // --- the bailey: packed earth, the cobbled road from the gate to the keep, paths to every door ---
    c.fillStyle = '#4b4032'; c.fillRect(CS.gate, 250, CS.keep - CS.gate, 1300);
    blot(CS.gate, 250, CS.keep - CS.gate, 1300, 80, ['rgba(34, 27, 20, 0.5)', 'rgba(110, 94, 70, 0.3)', 'rgba(60, 62, 40, 0.3)'], 80, 220);
    for (let i = 0; i < 9000; i++) { const x = CS.gate + rnd() * (CS.keep - CS.gate), y = 250 + rnd() * 1300; c.fillStyle = rnd() < 0.5 ? 'rgba(30, 24, 18, 0.35)' : 'rgba(150, 132, 104, 0.25)'; c.fillRect(x, y, 1.5 + rnd() * 2, 1.5 + rnd() * 1.5); } // grit
    for (const [x, y, r] of [[1250, 640, 140]]) { const gr = c.createRadialGradient(x, y, r * 0.6, x, y, r); gr.addColorStop(0, 'rgba(128, 110, 78, 0.85)'); gr.addColorStop(1, 'rgba(128, 110, 78, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } // the training yard's sand
    for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, d = rnd() * 110, x = 1250 + Math.cos(a) * d, y = 640 + Math.sin(a) * d; c.fillStyle = 'rgba(60, 48, 32, 0.4)'; c.beginPath(); c.ellipse(x, y, 3, 1.8, rnd() * 3, 0, Math.PI * 2); c.fill(); } // footprints in it
    for (const b of CS_BUILD) for (const dx of b.doors) { // trodden earth fanning out from each doorway, fading before the road
        const s = b.side === 's' ? 1 : -1, fy = b.side === 's' ? b.y1 : b.y0;
        for (let k = 0; k < 3; k++) { const r = 70 + k * 40, cy = fy + s * (30 + k * 45), gr = c.createRadialGradient(dx, cy, 0, dx, cy, r); gr.addColorStop(0, 'rgba(98, 82, 60, 0.35)'); gr.addColorStop(1, 'rgba(98, 82, 60, 0)'); c.fillStyle = gr; c.fillRect(dx - r, cy - r, r * 2, r * 2); }
    }
    for (let x = CS.gate; x < CS.keep; x += 11) for (let y = CS.y - 74; y < CS.y + 74; y += 10) { // the cobbled road, worn away at its edges
        const e = Math.abs(y - CS.y) / 74; if (e > 0.78 && rnd() < (e - 0.78) * 4) continue; if (rnd() < 0.04) continue;
        const sx = x + ((y / 10) % 2) * 5 + (rnd() - 0.5) * 2.5, sy = y + (rnd() - 0.5) * 2.5, w = 4.2 + rnd() * 1.6, h = 3.4 + rnd() * 1.2;
        c.fillStyle = ['#5f5a52', '#66605a', '#57524b', '#6b655c', '#524d47'][(rnd() * 5) | 0]; c.beginPath(); c.ellipse(sx, sy, w, h, (rnd() - 0.5) * 0.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255, 245, 225, 0.07)'; c.fillRect(sx - w * 0.5, sy - h * 0.6, w * 0.7, 1.2);
    }
    for (let i = 0; i < 11; i++) { const x = 500 + rnd() * 1850, y = 320 + rnd() * 1160; if (Math.abs(y - CS.y) < 90) continue; // puddles catching the moon: a muddy rim, grey-blue water, a pale sheen
        const rx = 20 + rnd() * 22, ry = 9 + rnd() * 8, a = rnd() * 0.6;
        c.fillStyle = 'rgba(38, 30, 22, 0.5)'; c.beginPath(); c.ellipse(x, y, rx + 4, ry + 3, a, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(64, 76, 92, 0.6)'; c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(170, 190, 215, 0.18)'; c.beginPath(); c.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, 2, a - 0.2, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 260; i++) { const x = 600 + rnd() * 560, y = 1210 + rnd() * 140; c.strokeStyle = rnd() < 0.5 ? 'rgba(200, 170, 90, 0.55)' : 'rgba(150, 120, 60, 0.45)'; c.lineWidth = 1.3; const a = rnd() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); c.stroke(); } // straw kicked out of the stables
    for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, d = 30 + rnd() * 70; c.fillStyle = rnd() < 0.5 ? 'rgba(10, 8, 8, 0.45)' : 'rgba(40, 30, 26, 0.5)'; c.beginPath(); c.arc(1725 + Math.cos(a) * d, 500 + Math.sin(a) * d * 0.7, 1.5 + rnd() * 3, 0, Math.PI * 2); c.fill(); } // soot and coal round the forge
    for (let i = 0; i < 700; i++) { // weeds and tufts at the foot of the walls
        const side = rnd(), x = side < 0.8 ? 360 + rnd() * 2080 : 355 + rnd() * 30, y = side < 0.4 ? 254 + rnd() * 26 : side < 0.8 ? 1520 + rnd() * 26 : 260 + rnd() * 1280;
        if (at(x, y) !== T_FLOOR || csInBuilding(x, y)) continue;
        for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + (j - 2) * 0.35, l = 5 + rnd() * 6; c.strokeStyle = j % 2 ? '#3a4a24' : '#4f6230'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    }
    for (let i = 0; i < 40; i++) { // the debris of a garrison: spent arrows, a dropped helmet, broken shafts
        const x = 450 + rnd() * 1900, y = 300 + rnd() * 1200; if (at(x, y) !== T_FLOOR || csInBuilding(x, y)) continue;
        c.save(); c.translate(x, y); c.rotate(rnd() * Math.PI * 2); const k = rnd();
        if (k < 0.5) { c.strokeStyle = '#3e2a1a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = '#9e9e9e'; c.beginPath(); c.moveTo(8, -2); c.lineTo(12, 0); c.lineTo(8, 2); c.fill(); c.fillStyle = '#c62828'; c.fillRect(-9, -1.5, 3, 3); }
        else if (k < 0.7) { c.fillStyle = '#5c6066'; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2b2d30'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.fillRect(-3, -3, 2.5, 1.5); }
        else { c.strokeStyle = '#4a3020'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-1, 0); c.moveTo(2, 1); c.lineTo(10, 2); c.stroke(); }
        c.restore();
    }
    // the powder spilled from the toppled brazier's foot to the cart against the keep's doors (keep_breach lights it)
    c.strokeStyle = 'rgba(20, 20, 22, 0.75)'; c.lineWidth = 4; c.beginPath(); c.moveTo(...CS_TRAIL[0]); for (const p of CS_TRAIL) c.lineTo(...p); c.stroke();
    c.fillStyle = 'rgba(40, 40, 44, 0.6)'; for (let i = 0; i < 40; i++) { const p = csTrailPt(rnd()); c.fillRect(p[0] + (rnd() - 0.5) * 8, p[1] + (rnd() - 0.5) * 8, 1.6, 1.6); }

    // --- the gate passage: big worn slabs between the gatehouse towers ---
    csSlabs(c, 0, CS.y - 90, CS.gate, 180, 45, 30, ['#5b5650', '#524d47', '#615b54', '#4d4843'], rnd);

    // --- the great hall: flagstones, rushes strewn on them, a red runner down the middle ---
    csSlabs(c, CS.keepIn, CS.y - CS_HALF.hall, CS.div - CS.keepIn, CS_HALF.hall * 2, 50, 50, ['#5f584e', '#575047', '#655d53', '#524b43'], rnd);
    csSlabs(c, CS.div, CS.y - 360, CS.divIn - CS.div, 720, 50, 50, ['#5a534a'], rnd);
    for (let i = 0; i < 1100; i++) { const x = CS.keepIn + rnd() * (CS.div - CS.keepIn), y = CS.y + (rnd() < 0.5 ? -1 : 1) * (150 + rnd() * 260); c.strokeStyle = rnd() < 0.5 ? 'rgba(170, 150, 90, 0.35)' : 'rgba(110, 96, 56, 0.35)'; c.lineWidth = 1.1; const a = rnd() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke(); } // rushes
    for (const [x, y, r] of [[2800, 820, 18], [3150, 980, 14], [3000, 800, 10], [2620, 1000, 22]]) { c.fillStyle = 'rgba(70, 8, 12, 0.45)'; c.beginPath(); c.ellipse(x, y, r, r * 0.7, rnd(), 0, Math.PI * 2); c.fill(); } // spilled wine
    // --- the treasury: dark polished stone in a checker, coins everywhere ---
    csSlabs(c, CS.divIn, CS.y - CS_HALF.treasury, CS.throne - CS.divIn, CS_HALF.treasury * 2, 50, 50, ['#47423d', '#3e3a36'], rnd, true);
    // --- the runner from the keep's doors to the throne room ---
    csRunner(c, CS.keepIn, CS.throne, 48, '#6e1a1a', rnd);

    // --- the throne room: black and red marble in big squares, veined and polished, the crimson carpet, the dais ---
    c.save(); c.beginPath(); c.rect(CS.throneIn, CS.y - 540, CS.end - CS.throneIn, 1080); c.clip();
    for (let y = CS.y - 540, r = 0; y < CS.y + 540; y += 75, r++) for (let x = CS.throneIn, k = 0; x < CS.end; x += 75, k++) {
        c.fillStyle = (r + k) % 2 ? '#2a2427' : '#3b2026'; c.fillRect(x, y, 75, 75);
        c.strokeStyle = 'rgba(0, 0, 0, 0.45)'; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, 74, 74);
        c.strokeStyle = (r + k) % 2 ? 'rgba(200, 190, 200, 0.08)' : 'rgba(255, 150, 150, 0.08)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + rnd() * 75, y); c.quadraticCurveTo(x + rnd() * 75, y + 37, x + rnd() * 75, y + 75); c.stroke(); // a vein
    }
    for (let k = 0; k < 14; k++) { const x = CS.throneIn + k * 140 + rnd() * 40, gr = c.createLinearGradient(x, 0, x + 120, 0); gr.addColorStop(0, 'rgba(255, 255, 255, 0)'); gr.addColorStop(0.5, 'rgba(255, 230, 220, 0.04)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0)'); c.fillStyle = gr; c.fillRect(x, CS.y - 540, 120, 1080); } // polish
    c.restore();
    csRunner(c, CS.throneIn, CS_DAIS.x0, 70, '#7a1517', rnd, true);
    csDais(c, rnd);

    // --- walls: shadows on the floor, cut stone, a lit coping along every face; the castle's mass beyond darkens away ---
    const mask = cavCanvas(W, H), mk = mask.getContext('2d'); mk.fillStyle = '#000';
    for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) { const x = (gx + 0.5) * cs, y = (gy + 0.5) * cs; if (G.data[gy * cols + gx] === T_WALL && !csOutside(x, y) && !csInBuilding(x, y)) mk.fillRect(gx * cs, gy * cs, cs, cs); }
    c.save(); c.globalAlpha = 0.65; c.filter = 'blur(9px)'; c.drawImage(mask, 12, 16); c.restore();
    const tex = cavCanvas(W, H), tk = tex.getContext('2d');
    tk.fillStyle = tk.createPattern(csStoneTile('#4d4740', '#2a2622', rnd), 'repeat'); tk.fillRect(0, 0, W, H);
    for (const [x0, x1, hh] of [[CS.keep, CS.div, CS_HALF.hall], [CS.div, CS.throne, CS_HALF.treasury], [CS.throne, CS.end + 60, CS_HALF.throne]]) for (const s of [-1, 1]) { // deeper into the keep's mass, darker
        const f = CS.y + s * (hh + 70), gr = tk.createLinearGradient(0, f, 0, f + s * 180); gr.addColorStop(0, 'rgba(6, 5, 4, 0)'); gr.addColorStop(1, 'rgba(6, 5, 4, 0.75)');
        tk.fillStyle = gr; tk.fillRect(x0, s < 0 ? 0 : f, x1 - x0, s < 0 ? f : H - f);
    }
    tk.globalCompositeOperation = 'destination-in'; tk.drawImage(mask, 0, 0);
    c.drawImage(tex, 0, 0); tex.width = 1; mask.width = 1;
    csEdges(c, G, at);
    csCurtain(c, rnd);
    for (const [tx, ty, r] of CS_TOWERS) csTower(c, tx, ty, r, rnd);
    csKeepFront(c, rnd);

    // --- the bailey's buildings, the props, the hall's tables and hearths, tapestries and torch brackets ---
    for (const b of CS_BUILD) { c.save(); c.filter = 'blur(9px)'; c.fillStyle = 'rgba(6, 4, 2, 0.55)'; c.fillRect(b.x0 + 12, b.y0 + 16, b.x1 - b.x0, b.y1 - b.y0); c.restore(); }
    for (const b of CS_BUILD) csBuilding(c, b, rnd);
    for (const [x0, y0, x1, y1] of CS_TABLES) csTable(c, x0, y0, x1, y1, rnd);
    for (const o of D.obstacles) csProp(c, o, rnd);
    for (const [x, s] of [[3800, -1], [4200, -1], [3800, 1], [4200, 1]]) csTapestry(c, x, CS.y + s * CS_HALF.treasury, s, rnd);
    for (const [x, s] of [[2650, -1], [3400, -1], [2650, 1], [3400, 1]]) csSideDoor(c, x, CS.y + s * CS_HALF.hall, s);
    for (const s of [-1, 1]) csSideDoor(c, 4640, CS.y + s * CS_HALF.throne, s);
    for (const [x, y, s] of cst.torches) csBracket(c, x, y, s);
    for (const a of CS_ALCOVES) for (const s of [-1, 1]) { const y = CS.y + s * 540; c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(a - 70, y - (s > 0 ? 40 : 0), 140, 40); } // the alcoves' gloom
    for (let i = 0; i < 260; i++) { // coins spilled across the treasury floor, thicker round the heaps
        const h = CS_PROPS.filter(p => p[3] === 'gold')[(rnd() * 4) | 0], a = rnd() * Math.PI * 2, d = h[2] + rnd() * 120, x = h[0] + Math.cos(a) * d, y = h[1] + Math.sin(a) * d * 0.8;
        if (at(x, y) !== T_FLOOR) continue; csCoin(c, x, y, rnd);
    }
    cst.ground = g;
}

// Rows of slabs over a rectangle (checker: alternate two colours instead of picking)
function csSlabs(c, x0, y0, w, h, sw, sh, pal, rnd, checker) {
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    for (let y = y0, r = 0; y < y0 + h; y += sh, r++) for (let x = x0 - (checker ? 0 : (r % 2) * sw / 2), k = 0; x < x0 + w; x += sw, k++) {
        c.fillStyle = checker ? pal[(r + k) % 2] : pal[(rnd() * pal.length) | 0]; c.fillRect(x, y, sw, sh);
        c.fillStyle = 'rgba(255, 245, 225, 0.06)'; c.fillRect(x, y, sw, 3); // the lit edge
        c.strokeStyle = 'rgba(20, 16, 12, 0.6)'; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
        if (checker && rnd() < 0.4) { c.fillStyle = 'rgba(255, 240, 220, 0.05)'; c.beginPath(); c.moveTo(x, y + sh); c.lineTo(x + sw * 0.6, y); c.lineTo(x + sw, y); c.lineTo(x + sw * 0.4, y + sh); c.fill(); } // a polished glint
    }
    c.restore();
}

// A carpet down the middle (|y - 900| < hw), gold borders, a pattern of diamonds (or his sigil, in the throne room)
function csRunner(c, x0, x1, hw, col, rnd, sigils) {
    const y = CS.y;
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0, y - hw + 3, x1 - x0, hw * 2);
    c.fillStyle = col; c.fillRect(x0, y - hw, x1 - x0, hw * 2);
    for (let x = x0; x < x1; x += 40) { c.fillStyle = rnd() < 0.5 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 210, 190, 0.04)'; c.fillRect(x, y - hw, 40, hw * 2); } // wear
    c.strokeStyle = '#b08d4a'; c.lineWidth = 2.6; for (const o of [-hw + 5, hw - 5]) { c.beginPath(); c.moveTo(x0, y + o); c.lineTo(x1, y + o); c.stroke(); }
    c.lineWidth = 1.2; for (const o of [-hw + 10, hw - 10]) { c.beginPath(); c.moveTo(x0, y + o); c.lineTo(x1, y + o); c.stroke(); }
    if (sigils) for (let x = x0 + 140; x < x1 - 60; x += 260) { c.globalAlpha = 0.85; brSigil(c, x, y, 0.55); c.globalAlpha = 1; } // map_bridge.js
    else { c.lineWidth = 1.4; for (let x = x0 + 40; x < x1; x += 80) { c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x, y - 16); c.lineTo(x + 16, y); c.lineTo(x, y + 16); c.closePath(); c.stroke(); } }
}

// The dais at the east end: three steps up to the throne, each lit along its top-left edge
function csDais(c, rnd) {
    const D = CS_DAIS;
    for (let k = 0; k < 3; k++) {
        const x0 = D.x0 + k * 34, hy = D.hy - k * 34, col = ['#4a4246', '#544b50', '#5e5459'][k];
        c.fillStyle = 'rgba(0, 0, 0, 0.45)'; c.fillRect(x0 + 6, CS.y - hy + 8, D.x1 - x0, hy * 2); // the step's shadow
        c.fillStyle = col; c.fillRect(x0, CS.y - hy, D.x1 - x0, hy * 2);
        c.fillStyle = 'rgba(255, 240, 230, 0.12)'; c.fillRect(x0, CS.y - hy, D.x1 - x0, 4); c.fillRect(x0, CS.y - hy, 4, hy * 2);
        c.strokeStyle = '#1c1719'; c.lineWidth = 2; c.strokeRect(x0, CS.y - hy, D.x1 - x0, hy * 2);
    }
    c.fillStyle = '#7a1517'; c.fillRect(D.x0, CS.y - 70, 110, 140); // the carpet runs up the steps
    c.strokeStyle = '#b08d4a'; c.lineWidth = 2.6; for (const o of [-65, 65]) { c.beginPath(); c.moveTo(D.x0, CS.y + o); c.lineTo(D.x0 + 110, CS.y + o); c.stroke(); }
    for (let i = 0; i < 140; i++) { const a = rnd() * Math.PI * 2, d = 60 + rnd() * 130; csCoin(c, CS_THRONE.x + Math.cos(a) * d * 0.7, CS.y + Math.sin(a) * d, rnd); } // gold heaped round the throne
}

function csCoin(c, x, y, rnd) {
    c.fillStyle = rnd() < 0.3 ? '#a37b1c' : '#e0b43a'; c.beginPath(); c.ellipse(x, y, 2.6, 2, rnd() * 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255, 250, 200, 0.6)'; c.fillRect(x - 1, y - 1, 1.2, 1);
}

function csTrailPt(k) { // a point along the powder trail, k 0..1
    const n = CS_TRAIL.length - 1, f = clamp01(k) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    return [lerp(CS_TRAIL[i][0], CS_TRAIL[i + 1][0], u), lerp(CS_TRAIL[i][1], CS_TRAIL[i + 1][1], u)];
}

// Cut stone in courses: dark mortar, blocks shaded a little apart, a lit top on each (one tile, repeated)
function csStoneTile(base, mortar, rnd) {
    const t = cavCanvas(200, 100), k = t.getContext('2d');
    k.fillStyle = mortar; k.fillRect(0, 0, 200, 100);
    for (let row = 0; row < 4; row++) for (let x = -(row % 2) * 25; x < 200; x += 50) {
        k.fillStyle = sprShade(base, (rnd() - 0.5) * 0.24); k.fillRect(x + 1.5, row * 25 + 1.5, 47, 22);
        k.fillStyle = 'rgba(255, 240, 220, 0.07)'; k.fillRect(x + 1.5, row * 25 + 1.5, 47, 3);
        k.fillStyle = 'rgba(0, 0, 0, 0.12)'; k.fillRect(x + 1.5, row * 25 + 20.5, 47, 3);
    }
    return t;
}

// A coping along every wall face: a lighter band of dressed stone on the wall's top, lit on the faces turned to the light
function csEdges(c, G, at) {
    const cs = G.cell, lit = new Path2D(), dark = new Path2D(), band = new Path2D();
    for (let gy = 0; gy < G.rows; gy++) for (let gx = 0; gx < G.cols; gx++) {
        if (G.data[gy * G.cols + gx] !== T_WALL) continue;
        const x = gx * cs, y = gy * cs, cx = x + cs / 2, cy = y + cs / 2;
        if (csOutside(cx, cy) || csInBuilding(cx, cy) || CS_TOWERS.some(([tx, ty, r]) => Math.hypot(cx - tx, cy - ty) < r + 14)) continue;
        const open = (dx, dy) => { const v = at(cx + dx * cs, cy + dy * cs); return v !== T_WALL; };
        if (open(0, -1)) { band.rect(x, y, cs, 7); lit.moveTo(x, y); lit.lineTo(x + cs, y); }
        if (open(-1, 0)) { band.rect(x, y, 7, cs); lit.moveTo(x, y); lit.lineTo(x, y + cs); }
        if (open(0, 1)) { band.rect(x, y + cs - 7, cs, 7); dark.moveTo(x, y + cs); dark.lineTo(x + cs, y + cs); }
        if (open(1, 0)) { band.rect(x + cs - 7, y, 7, cs); dark.moveTo(x + cs, y); dark.lineTo(x + cs, y + cs); }
    }
    c.fillStyle = '#6b645a'; c.fill(band);
    c.lineCap = 'butt'; c.strokeStyle = 'rgba(255, 236, 205, 0.28)'; c.lineWidth = 2.5; c.stroke(lit);
    c.strokeStyle = 'rgba(8, 6, 4, 0.7)'; c.lineWidth = 2.5; c.stroke(dark); c.lineCap = 'round';
}

// The curtain walls round the bailey: a wall walk on top, merlons along the outer edge, steps down at the stairs
function csCurtain(c, rnd) {
    const walk = (x0, y0, w, h) => { c.fillStyle = '#3f3a34'; c.fillRect(x0, y0, w, h); c.strokeStyle = 'rgba(20, 16, 12, 0.45)'; c.lineWidth = 1; for (let x = x0; x < x0 + w; x += 36) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke(); } };
    const merlons = (x0, x1, y, h, step = 34) => { for (let x = x0; x < x1; x += step) { c.fillStyle = '#6e685e'; c.fillRect(x, y, 22, h); c.fillStyle = 'rgba(255, 240, 220, 0.1)'; c.fillRect(x, y, 22, 3); c.strokeStyle = '#25211d'; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, 21, h - 1); } };
    walk(470, 152, 1980 - 120, 76); walk(470, 1572, 1980 - 120, 76); // north and south
    merlons(470, 2330, 127, 20); merlons(470, 2330, 1653, 20);
    c.fillStyle = '#3f3a34'; c.fillRect(252, 370, 76, 230); c.fillRect(252, 1200, 76, 230); // the west wall's walk, between its towers
    for (let y = 370; y < 600; y += 34) { c.fillStyle = '#6e685e'; c.fillRect(227, y, 20, 22); c.strokeStyle = '#25211d'; c.lineWidth = 1.5; c.strokeRect(227.5, y + 0.5, 19, 21); }
    for (let y = 1200; y < 1430; y += 34) { c.fillStyle = '#6e685e'; c.fillRect(227, y, 20, 22); c.strokeStyle = '#25211d'; c.lineWidth = 1.5; c.strokeRect(227.5, y + 0.5, 19, 21); }
    for (const [x, s] of [[520, -1], [2180, -1], [520, 1], [2200, 1]]) { // stairs down from the walk: steps narrowing toward the yard
        for (let k = 0; k < 5; k++) { const y = s < 0 ? 232 + k * 7 : 1568 - k * 7 - 7, w = 52 - k * 4; c.fillStyle = k % 2 ? '#5f584e' : '#6a6257'; c.fillRect(x - w / 2, y, w, 7); c.strokeStyle = 'rgba(15, 12, 10, 0.6)'; c.lineWidth = 1; c.strokeRect(x - w / 2 + 0.5, y + 0.5, w - 1, 6); }
    }
}

// A round tower: a ring of wall with merlons round its top, a conical slate roof in radial courses (as on the bridge)
function csTower(c, tx, ty, R, rnd) {
    c.fillStyle = 'rgba(6, 4, 2, 0.5)'; c.beginPath(); c.arc(tx + 12, ty + 16, R + 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(tx, ty, R, 0, Math.PI * 2); c.fillStyle = '#5a554d'; c.fill(); c.strokeStyle = '#25211d'; c.lineWidth = 3; c.stroke();
    const m = Math.round(R / 7.5); for (let k = 0; k < m; k++) { const a = k / m * Math.PI * 2; c.fillStyle = '#6e685e'; c.beginPath(); c.arc(tx + Math.cos(a) * (R - 10), ty + Math.sin(a) * (R - 10), R > 90 ? 11 : 8, 0, Math.PI * 2); c.fill(); }
    const r = R * 0.82; c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.fillStyle = '#34383f'; c.fill();
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; c.strokeStyle = k % 2 ? '#2a2d33' : '#40454d'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r); c.stroke(); }
    for (let rr = 14; rr < r; rr += 14) { c.strokeStyle = 'rgba(15, 16, 20, 0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(tx, ty, rr, 0, Math.PI * 2); c.stroke(); }
    const lg = c.createLinearGradient(tx - r, ty - r, tx + r, ty + r); lg.addColorStop(0, 'rgba(180, 190, 230, 0.16)'); lg.addColorStop(0.5, 'rgba(0, 0, 0, 0)'); lg.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    c.fillStyle = lg; c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.fill(); // moonlight on one side of the cone
    c.fillStyle = '#20232a'; c.beginPath(); c.arc(tx, ty, 6, 0, Math.PI * 2); c.fill();
}

// The keep's front over the bailey: a walk along its top behind merlons, and the arch of the great doors
function csKeepFront(c, rnd) {
    const x = CS.keep;
    c.fillStyle = '#3f3a34'; c.fillRect(x + 30, 370, 46, 1060);
    for (let y = 372; y < 1430; y += 34) { if (Math.abs(y + 11 - CS.y) < 110) continue; c.fillStyle = '#6e685e'; c.fillRect(x + 4, y, 20, 22); c.strokeStyle = '#25211d'; c.lineWidth = 1.5; c.strokeRect(x + 4.5, y + 0.5, 19, 21); }
    for (const s of [-1, 1]) { const y = CS.y + s * 95; c.fillStyle = '#5a554d'; c.fillRect(x - 12, y - 18, 30, 36); c.strokeStyle = '#25211d'; c.lineWidth = 2; c.strokeRect(x - 12, y - 18, 30, 36); c.fillStyle = 'rgba(255, 240, 220, 0.1)'; c.fillRect(x - 12, y - 18, 30, 4); } // buttresses flanking the doors
    c.fillStyle = '#2a241f'; c.fillRect(x, CS.y - 75, CS.keepIn - x, 150); // the passage under the arch
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#4a443d' : '#3e3933'; c.fillRect(x + k * 17, CS.y - 75, 17, 150); }
}

// A building in the bailey seen from above: a pitched roof (slate on the barracks and stores, shingles on the stable and
// the smithy, the smithy with its chimney), the doorways cut into the front with the doors standing open
function csBuilding(c, b, rnd) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, cx = b.x0 + w / 2, cy = b.y0 + h / 2, e = 6;
    const pal = b.kind === 'barracks' || b.kind === 'store' ? ['#5f6670', '#454b54', '#22262b'] : ['#6a4a3a', '#4a3328', '#2a1b14'];
    for (const s of [-1, 1]) { // ridge along the long (east-west) side; the north slope catches the moon
        c.save(); c.beginPath(); c.rect(b.x0 - e, s < 0 ? b.y0 - e : cy, w + e * 2, h / 2 + e); c.clip();
        const base = s < 0 ? pal[0] : pal[1];
        for (let y = 2, row = 0; y < h / 2 + e; y += 9, row++) for (let x = b.x0 - e + (row % 2) * 6; x < b.x1 + e; x += 12) {
            c.fillStyle = sprShade(base, (rnd() - 0.5) * 0.22); c.fillRect(x, s < 0 ? cy - y - 8 : cy + y, 11, 8);
            c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x, s < 0 ? cy - y - 1.5 : cy + y + 6.5, 11, 1.5);
        }
        c.restore();
    }
    c.strokeStyle = pal[2]; c.lineWidth = 2.5; c.strokeRect(b.x0 - e, b.y0 - e, w + e * 2, h + e * 2);
    c.fillStyle = pal[2]; c.fillRect(b.x0 - e, cy - 5, w + e * 2, 10); c.strokeStyle = 'rgba(200, 210, 240, 0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(b.x0 - e, cy - 4); c.lineTo(b.x1 + e, cy - 4); c.stroke();
    if (b.kind === 'smithy') { const x = b.x0 + w * 0.7, y = cy - 22; c.fillStyle = '#6f6a62'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2; c.fillRect(x - 13, y - 13, 26, 26); c.strokeRect(x - 13, y - 13, 26, 26); c.fillStyle = '#100c0a'; c.fillRect(x - 7, y - 7, 14, 14); }
    if (b.kind === 'barracks') for (const x of [b.x0 + 80, b.x1 - 80]) { const y = cy - 20; c.fillStyle = '#6f6a62'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2; c.fillRect(x - 9, y - 9, 18, 18); c.strokeRect(x - 9, y - 9, 18, 18); c.fillStyle = '#141210'; c.fillRect(x - 4.5, y - 4.5, 9, 9); }
    const s = b.side === 's' ? 1 : -1, fy = b.side === 's' ? b.y1 : b.y0;
    for (const dx of b.doors) { // the doorway: dark inside, a stone step, the door swung back against the wall
        c.fillStyle = '#0d0907'; c.fillRect(dx - 25, fy - (s > 0 ? 25 : 0), 50, 25);
        c.fillStyle = 'rgba(255, 170, 80, 0.12)'; c.fillRect(dx - 25, fy - (s > 0 ? 6 : -1) , 50, 5); // firelight from inside
        c.fillStyle = '#6f6a62'; c.strokeStyle = '#26221d'; c.lineWidth = 1.5; c.fillRect(dx - 26, fy + (s > 0 ? 0 : -10), 52, 10); c.strokeRect(dx - 26, fy + (s > 0 ? 0 : -10), 52, 10);
        c.fillStyle = '#5d4037'; c.strokeStyle = '#1a110a'; c.save(); c.translate(dx - 25, fy); c.rotate(s * -0.9); c.fillRect(0, -3, 26, 6); c.strokeRect(0, -3, 26, 6); c.restore();
    }
    if (b.kind === 'stable') for (let x = b.x0 + 15; x < b.x1; x += 87.5) { c.fillStyle = '#2a1b14'; c.fillRect(x - 4, fy - 8, 8, 12); } // posts between the stalls
}

// A long trestle table from above: planks, with plates, goblets, bread and candles; benches either side
function csTable(c, x0, y0, x1, y1, rnd) {
    const w = x1 - x0, h = y1 - y0;
    for (const by of [y0 - 14, y1 + 4]) { c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 14, by + 4, w - 20, 10); c.fillStyle = '#4e3626'; c.fillRect(x0 + 10, by, w - 20, 10); c.strokeStyle = '#1a110a'; c.lineWidth = 1.5; c.strokeRect(x0 + 10, by, w - 20, 10); } // benches
    c.fillStyle = 'rgba(0, 0, 0, 0.4)'; c.fillRect(x0 + 8, y0 + 10, w, h);
    c.fillStyle = '#6b4a2e'; c.fillRect(x0, y0, w, h); c.strokeStyle = '#21160d'; c.lineWidth = 2; c.strokeRect(x0, y0, w, h);
    c.strokeStyle = 'rgba(30, 18, 10, 0.55)'; c.lineWidth = 1; for (let y = y0 + 12.5; y < y1; y += 12.5) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); } // planks
    c.fillStyle = 'rgba(255, 220, 170, 0.1)'; c.fillRect(x0, y0, w, 3);
    for (let x = x0 + 25; x < x1 - 15; x += 34 + rnd() * 16) {
        const k = rnd(), y = y0 + 8 + rnd() * (h - 16);
        if (k < 0.35) { c.fillStyle = '#9e9e9e'; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7a5a3a'; c.beginPath(); c.arc(x + 1, y, 3, 0, Math.PI * 2); c.fill(); } // a pewter plate with scraps
        else if (k < 0.6) { c.fillStyle = '#c9a227'; c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a0c12'; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); } // a goblet of wine
        else if (k < 0.8) { c.fillStyle = '#b07a3a'; c.beginPath(); c.ellipse(x, y, 7, 4.5, rnd(), 0, Math.PI * 2); c.fill(); } // a loaf
        else { c.fillStyle = '#e8e0cc'; c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffcc80'; c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); } // a candle stub
    }
}

// A tapestry on the treasury's wall: a hanging the bandits looted, its lower edge with a fringe (the garrison steps out from behind it)
function csTapestry(c, x, y, s, rnd) {
    const y0 = s < 0 ? y - 6 : y - 12, cols = [['#2e4a7a', '#c9a227'], ['#5a1e4a', '#d8c27a'], ['#1f5a3a', '#c9a227'], ['#7a3a1e', '#e0c890']][(rnd() * 4) | 0];
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x - 46, y0 + 4, 92, 18);
    c.fillStyle = cols[0]; c.fillRect(x - 44, y0, 88, 18); c.strokeStyle = cols[1]; c.lineWidth = 1.6; c.strokeRect(x - 42, y0 + 2, 84, 14);
    c.fillStyle = cols[1]; c.beginPath(); c.moveTo(x, y0 + 4); c.lineTo(x + 6, y0 + 9); c.lineTo(x, y0 + 14); c.lineTo(x - 6, y0 + 9); c.closePath(); c.fill();
    const fy = s < 0 ? y0 + 18 : y0; c.strokeStyle = cols[1]; c.lineWidth = 1; for (let k = -42; k <= 42; k += 4) { c.beginPath(); c.moveTo(x + k, fy); c.lineTo(x + k, fy - s * 4); c.stroke(); } // the fringe, hanging toward the room
}

// A small side door in a wall face: a dark doorway with an iron-studded door standing open
function csSideDoor(c, x, y, s) {
    c.fillStyle = '#0d0907'; c.fillRect(x - 25, s < 0 ? y - 18 : y, 50, 18);
    c.fillStyle = 'rgba(255, 170, 80, 0.1)'; c.fillRect(x - 25, s < 0 ? y - 4 : y, 50, 4);
    c.save(); c.translate(x + 25, y); c.rotate(s < 0 ? 2.3 : -2.3); c.fillStyle = '#4e3626'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.5; c.fillRect(0, -3, 26, 6); c.strokeRect(0, -3, 26, 6); c.fillStyle = '#263238'; c.fillRect(6, -3, 2, 6); c.fillRect(18, -3, 2, 6); c.restore();
}

// An iron torch bracket on a wall face (the flame is live)
function csBracket(c, x, y, s) {
    c.fillStyle = '#1e1f22'; c.fillRect(x - 5, y - 2, 10, 4);
    sprStroke(c, '#3a3d42', 2, () => { c.moveTo(x, y); c.lineTo(x, y + s * 9); });
    c.fillStyle = '#3e2a1a'; c.beginPath(); c.arc(x, y + s * 9, 3.2, 0, Math.PI * 2); c.fill();
}

// The solid props
function csProp(c, o, rnd) {
    const { x, y, r } = o, sh = (k = 1) => { c.fillStyle = 'rgba(6, 4, 2, 0.45)'; c.beginPath(); c.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05 * k, r * 0.85 * k, 0, 0, Math.PI * 2); c.fill(); };
    switch (o.kind) {
        case 'well': case 'hay': vilProp(c, o, rnd); break; // map_village.js
        case 'cart': sh(); vilCart(c, x, y, o.seed, r * 1.8, r * 1.1, true); for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#7a5a3a' : '#8d6e4a'; c.beginPath(); c.ellipse(x + Math.cos(o.seed + k * 2) * r * 0.5, y + Math.sin(o.seed + k * 2) * r * 0.3, 7, 5, k, 0, Math.PI * 2); c.fill(); csCoin(c, x + Math.cos(k * 1.7) * r * 0.6, y + Math.sin(k * 1.3) * r * 0.35, rnd); } break; // plunder sacks and a few coins
        case 'crate': sh(); vilCrate(c, x, y, o.seed, r); break;
        case 'dummy': // a straw dummy on a post wearing a stolen helmet, a crossbar for arms
            sh(0.9); sprStroke(c, '#5a4030', 3.4, () => { c.moveTo(x - r * 1.3, y); c.lineTo(x + r * 1.3, y); });
            c.beginPath(); c.arc(x, y, r * 0.85, 0, Math.PI * 2); sprFill(c, '#c9a95a');
            c.strokeStyle = 'rgba(110, 80, 30, 0.6)'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = k; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); c.stroke(); }
            sprEllipse(c, x + 1, y, r * 0.5, r * 0.5, '#6e747c'); c.fillStyle = 'rgba(255, 255, 255, 0.3)'; c.fillRect(x - 2, y - 3, 3, 1.6); break;
        case 'rack': // a weapon rack: a beam with spears and blades leaning on it
            sh(); c.save(); c.translate(x, y); c.rotate(0.1);
            sprStroke(c, '#5a4030', 4, () => { c.moveTo(-r * 1.4, 0); c.lineTo(r * 1.4, 0); });
            for (let k = -2; k <= 2; k++) { const px = k * r * 0.55; sprStroke(c, '#4a3020', 1.8, () => { c.moveTo(px, -10); c.lineTo(px + 2, 12); }); c.fillStyle = '#b0bec5'; c.beginPath(); c.moveTo(px - 2, -10); c.lineTo(px, -17); c.lineTo(px + 2, -10); c.fill(); }
            c.restore(); break;
        case 'forge': // a stone hearth with a bed of coals (the glow and flames are live) and a pair of bellows
            sh(); c.fillStyle = '#5a554d'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2.5; c.fillRect(x - r, y - r * 0.85, r * 2, r * 1.7); c.strokeRect(x - r, y - r * 0.85, r * 2, r * 1.7);
            c.fillStyle = '#1a0d08'; c.fillRect(x - r * 0.65, y - r * 0.55, r * 1.3, r * 1.1);
            for (let k = 0; k < 14; k++) { c.fillStyle = rnd() < 0.5 ? '#6e1d08' : '#a33c10'; c.beginPath(); c.arc(x + (rnd() - 0.5) * r * 1.1, y + (rnd() - 0.5) * r * 0.9, 2 + rnd() * 2.5, 0, Math.PI * 2); c.fill(); }
            c.save(); c.translate(x + r + 12, y); c.fillStyle = '#5d4037'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -10); c.lineTo(14, -6); c.lineTo(14, 6); c.lineTo(-6, 10); c.closePath(); c.fill(); c.stroke(); c.restore(); break;
        case 'anvil': sh(); c.save(); c.translate(x, y); c.fillStyle = '#2e3236'; c.strokeStyle = '#0f1012'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r, -r * 0.45); c.lineTo(r * 0.5, -r * 0.45); c.quadraticCurveTo(r * 1.4, -r * 0.3, r * 1.5, 0); c.quadraticCurveTo(r * 1.4, r * 0.3, r * 0.5, r * 0.45); c.lineTo(-r, r * 0.45); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255, 255, 255, 0.22)'; c.fillRect(-r + 2, -r * 0.4, r * 1.3, 2); c.restore(); break;
        case 'barrel': sh(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); sprFill(c, '#6b4a2e'); c.strokeStyle = '#37474f'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.86, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#1d2a33'; c.beginPath(); c.arc(x, y, r * 0.66, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(160, 190, 210, 0.25)'; c.fillRect(x - 4, y - 3, 6, 1.5); break; // the quench barrel
        case 'brazier': csBrazierStand(c, x, y, rnd); break;
        case 'pillar': case 'pillar_t': csPillar(c, x, y, r, o.kind === 'pillar_t'); break;
        case 'hearth': csHearth(c, x, y, r, rnd); break;
        case 'gold': csGoldHeap(c, x, y, r, rnd); break;
        case 'chest': sh(); c.save(); c.translate(x, y); c.rotate(o.seed); c.fillStyle = '#5d3c22'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.6; c.fillRect(-r, -r * 0.7, r * 2, r * 1.4); c.strokeRect(-r, -r * 0.7, r * 2, r * 1.4); c.fillStyle = '#e0b43a'; c.fillRect(-r + 3, -r * 0.7 + 3, r * 2 - 6, r * 1.4 - 6); for (let k = 0; k < 8; k++) csCoin(c, (rnd() - 0.5) * r * 1.6, (rnd() - 0.5) * r, rnd); c.fillStyle = '#3e2a1a'; c.fillRect(-r, -r * 0.7 - 7, r * 2, 6); c.fillStyle = '#263238'; c.fillRect(-r * 0.6, -r * 0.7 - 7, 3, 6); c.fillRect(r * 0.5, -r * 0.7 - 7, 3, 6); c.restore(); break; // open, the lid thrown back
        case 'armor': sh(); sprStroke(c, '#4a3020', 2.4, () => { c.moveTo(x - r, y); c.lineTo(x + r, y); }); sprEllipse(c, x - 1, y, r * 0.6, r * 0.95, '#7d848c'); sprEllipse(c, x + 2, y, r * 0.42, r * 0.42, '#8e959d'); c.fillStyle = 'rgba(255, 255, 255, 0.3)'; c.fillRect(x - 2, y - 4, 2, 4); break; // a suit of plate on a stand
        case 'throne': csThrone(c, x, y, r, rnd); break;
        // 'brazier_t' (the one that topples) and 'pcart' (the powder cart) are drawn live
    }
}

function csBrazierStand(c, x, y, rnd) {
    c.fillStyle = 'rgba(6, 4, 2, 0.4)'; c.beginPath(); c.ellipse(x + 6, y + 8, 22, 16, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; sprStroke(c, '#2b2b2b', 3, () => { c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); }); }
    c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fillStyle = '#262626'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke();
    for (let k = 0; k < 9; k++) { c.fillStyle = rnd() < 0.5 ? '#5d1a08' : '#a33c10'; c.beginPath(); c.arc(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18, 3 + rnd() * 2, 0, Math.PI * 2); c.fill(); }
}

// A column seen from above: its shadow, a square plinth, the round top lit from the top-left (the throne room's wear a crimson band)
function csPillar(c, x, y, r, royal) {
    c.fillStyle = 'rgba(6, 4, 2, 0.5)'; c.beginPath(); c.ellipse(x + r * 0.5, y + r * 0.6, r * 1.1, r * 0.95, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3e3933'; c.fillRect(x - r - 5, y - r - 5, r * 2 + 10, r * 2 + 10); c.strokeStyle = '#1c1916'; c.lineWidth = 2; c.strokeRect(x - r - 5, y - r - 5, r * 2 + 10, r * 2 + 10);
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, royal ? '#8a8086' : '#8f877c'); g.addColorStop(1, royal ? '#3a3236' : '#4a443d');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1c1916'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = royal ? '#8e1b1b' : 'rgba(30, 26, 22, 0.6)'; c.lineWidth = royal ? 4 : 1.5; c.beginPath(); c.arc(x, y, r * 0.72, 0, Math.PI * 2); c.stroke();
    if (royal) { c.strokeStyle = '#b08d4a'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r * 0.72 + 2.5, 0, Math.PI * 2); c.stroke(); }
}

// A great hearth set into the hall's wall: a stone surround, the firedog bars and a bed of embers (the fire is live)
function csHearth(c, x, y, r, rnd) {
    const s = y < CS.y ? -1 : 1; // which wall it's set into
    c.fillStyle = '#5a554d'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2.5; c.fillRect(x - 70, s < 0 ? y - 34 : y - 6, 140, 40); c.strokeRect(x - 70, s < 0 ? y - 34 : y - 6, 140, 40);
    c.fillStyle = '#16100c'; c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.9, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 16; k++) { c.fillStyle = rnd() < 0.5 ? '#6e1d08' : '#a33c10'; c.beginPath(); c.arc(x + (rnd() - 0.5) * r * 2.2, y + (rnd() - 0.5) * r * 1.1, 2 + rnd() * 3, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#1e1f22'; c.lineWidth = 3; for (const o of [-14, 14]) { c.beginPath(); c.moveTo(x + o, y - r * 0.8); c.lineTo(x + o, y + r * 0.8); c.stroke(); }
    c.fillStyle = 'rgba(70, 30, 10, 0.4)'; c.beginPath(); c.ellipse(x, y - s * 30, 110, 40, 0, 0, Math.PI * 2); c.fill(); // the warm-stained floor before it
}

// A heap of looted gold: coins piled in a mound, goblets, a crown or two, gems catching the light
function csGoldHeap(c, x, y, r, rnd) {
    c.fillStyle = 'rgba(6, 4, 2, 0.45)'; c.beginPath(); c.ellipse(x + 8, y + 10, r * 1.1, r * 0.85, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, '#ffe69a'); g.addColorStop(0.5, '#d4a43a'); g.addColorStop(1, '#7a5512');
    c.fillStyle = g; c.beginPath(); for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2, rr = r * (0.85 + 0.15 * Math.sin(k * 2.7 + x)); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } c.closePath(); c.fill();
    for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.85; csCoin(c, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, rnd); }
    for (let k = 0; k < 3; k++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.5, gx = x + Math.cos(a) * d, gy = y + Math.sin(a) * d; c.fillStyle = ['#e53935', '#43a047', '#1e88e5'][k]; c.beginPath(); c.arc(gx, gy, 2.6, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255, 255, 255, 0.7)'; c.fillRect(gx - 1, gy - 1.4, 1.2, 1.2); } // gems
    c.strokeStyle = '#c9a227'; c.lineWidth = 2.2; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.15, 6, 0, Math.PI * 2); c.stroke(); // a goblet's rim
}

// His throne, facing west down the nave: a seat heaped with furs, armrests, and a high back crowned with a fan of
// captured blades, gold and crimson
function csThrone(c, x, y, r, rnd) {
    c.fillStyle = 'rgba(6, 4, 2, 0.55)'; c.beginPath(); c.ellipse(x + 14, y + 16, r * 1.3, r * 1.25, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y);
    for (let k = -5; k <= 5; k++) { const a = k * 0.19; c.save(); c.rotate(a); c.fillStyle = '#90a4ae'; c.strokeStyle = '#263238'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(r * 0.6, -3); c.lineTo(r * 1.65 + Math.abs(k) * -2, 0); c.lineTo(r * 0.6, 3); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#4a3020'; c.fillRect(r * 0.5, -2, 10, 4); c.restore(); } // the fan of blades behind
    c.fillStyle = '#3a1416'; c.strokeStyle = '#140708'; c.lineWidth = 2.5; c.fillRect(r * 0.35, -r * 0.95, r * 0.45, r * 1.9); c.strokeRect(r * 0.35, -r * 0.95, r * 0.45, r * 1.9); // the high back
    c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.strokeRect(r * 0.4, -r * 0.88, r * 0.35, r * 1.76);
    for (const s of [-1, 1]) { c.fillStyle = '#4a1a1c'; c.strokeStyle = '#140708'; c.lineWidth = 2; c.fillRect(-r * 0.75, s * r * 0.62 - (s < 0 ? r * 0.28 : 0), r * 1.15, r * 0.28); c.strokeRect(-r * 0.75, s * r * 0.62 - (s < 0 ? r * 0.28 : 0), r * 1.15, r * 0.28); c.fillStyle = '#c9a227'; c.beginPath(); c.arc(-r * 0.75, s * r * 0.48, 4, 0, Math.PI * 2); c.fill(); } // armrests with gold knobs
    c.fillStyle = '#7a1517'; c.fillRect(-r * 0.7, -r * 0.62, r * 1.05, r * 1.24); // the seat
    c.fillStyle = '#3b2f2a'; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.5); c.quadraticCurveTo(-r * 1.1, 0, -r * 0.7, r * 0.55); c.lineTo(-r * 0.2, r * 0.5); c.lineTo(-r * 0.25, -r * 0.45); c.closePath(); c.fill(); // a wolf pelt draped over the front
    c.fillStyle = 'rgba(255, 220, 170, 0.12)'; c.fillRect(-r * 0.7, -r * 0.62, r * 1.05, 4);
    c.restore();
}

// ---------- spawns ----------

const CS_MIX = [ // the bailey's mix, then the keep's (the cutpurses only in the keep, the grenadiers only in the bailey)
    { shield: 0.18, archer: 0.16, slinger: 0.10, hound: 0.12, bannerman: 0.08, thief: 0.08, crossbow: 0.10, halberd: 0.10, grenadier: 0.08 },
    { thief: 0.22, shield: 0.18, archer: 0.16, bannerman: 0.08, crossbow: 0.12, halberd: 0.14, cutpurse: 0.10 }];
const CS_CAP = { hound: 4, bannerman: 2, crossbow: 3, halberd: 4, grenadier: 2, cutpurse: 2 };
const castleAlive = type => enemies.filter(e => !e.dead && !e.prop && e.type === type).length;
const castleRoom = type => Math.max(0, (CS_CAP[type] || 99) - castleAlive(type));
function castleMinions(list) {
    const mix = CS_MIX[Math.min(1, cst.spawnSec ?? cst.open)]; // the part it steps into (castleSpawnPoint), not the newest
    const out = list.map(m => ({ ...m, weight: m.type in mix ? mix[m.type] : 0 })).filter(m => m.weight > 0 && castleRoom(m.type) > 0);
    return out.length ? out : list;
}

// The garrison steps out of a doorway, down the wall stairs or from behind a tapestry in the open part, ahead of the hero
function castleSpawnPoint() {
    const G = currentMap.grid, reach = p => !nav.dist || nav.dist[Math.floor(p.y / G.cell) * G.cols + Math.floor(p.x / G.cell)] >= 0;
    const dist = p => Math.hypot(p.x - player.x, p.y - player.y), sec = cst.open;
    cst.spawnSec = sec; // castleMinions reads the part the enemy steps into
    const hs = player.x < CS.keep ? 0 : player.x < CS.throne ? 1 : 2; // the hero walked back into an earlier part: half the waves come to them there (stage.js flankSpawn)
    if (hs < sec && !isBossWave && Math.random() < 0.5) {
        const f = flankSpawn(cst.spawns.filter(p => p.sec === hs), hs === 0 ? CS.gate + 100 : CS.keepIn + 100, hs === 0 ? CS.keep - 100 : CS.throne - 100, hs === 0 ? CS.keep : CS.throne);
        if (f) { cst.spawnSec = hs; cst.lastSpawn = f; return { x: f.x + (Math.random() - 0.5) * 16, y: f.y + (Math.random() - 0.5) * 16, from: f.from }; }
    }
    const pool = cst.spawns.filter(p => p.sec === sec && reach(p));
    let cand = pool.filter(p => { const d = dist(p); return d > 430 && d < 1300 && p.x > player.x - 150; });
    if (!cand.length) cand = pool.filter(p => dist(p) > 300).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    if (!cand.length) cand = cst.spawns.filter(reach).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const c = cand[(Math.random() * cand.length) | 0] || { x: 900, y: CS.y, ox: 900, oy: CS.y - 30, from: 'door' };
    cst.lastSpawn = c;
    return { x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16, from: c.from };
}

// stage.js onEnemySpawned: where it steps in from
function castleOnSpawn(e) {
    const s = cst.lastSpawn; if (!s) return;
    e.spawnT = e.spawnMax = s.from === 'stairs' ? 0.65 : 0.5;
    e.spawnOX = s.ox; e.spawnOY = s.oy; e.facingAngle = Math.atan2(e.y - s.oy, e.x - s.ox);
    if (s.from === 'door' || s.from === 'tapestry') burst(s.ox, s.oy, e.facingAngle, 1.2, 6, { kind: 'smoke', color: 'rgba(70, 62, 56, 0.6)', size: 10, speed: [30, 90], life: 0.8, drag: 2, grow: 18 });
    cst.lastSpawn = null;
}

// ---------- per-frame gameplay ----------

function updateCastle(dt) {
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius);
    const barX = cst.open === 0 ? CS.keep : cst.open === 1 ? CS.throne : Infinity; // no blinking past a barred door
    if (player.x > barX - player.radius) player.x = barX - player.radius;
    player.wallHit = null; for (const e of enemies) e.wallHit = null;
    if (cst.open === 0) for (const k of cst.kegs) if (!k.ent && fxTime - k.goneAt > KEG_RESPAWN && Math.hypot(k.x - player.x, k.y - player.y) > 520) makeKeg(k); // bandits.js
    if (!cst.dropped && fxTime - cst.arriveAt > 0.8 && player.x < 400) { // the portcullis crashes down behind the hero: no way back
        cst.dropped = true; cst.dropAt = fxTime; addShake(4);
        burst(70, CS.y, 0, Math.PI * 2, 12, { kind: 'spark', color: '#ffcc80', size: 2.2, speed: [80, 240], life: 0.35, drag: 4 });
        burst(70, CS.y, 0, 1.4, 8, { kind: 'debris', color: '#6e685e', size: 3, speed: [60, 180], life: 0.5, drag: 3 });
    }
    cst.portK = cst.dropped ? clamp01((fxTime - cst.dropAt) / 0.15) : 0;
    if (cst.promptAt && fxTime - cst.promptAt > 4) { cst.promptAt = 0; showStagePrompt(false); }
    const inHall = cst.open === 2 && !stageEvent && player.x > 4750 && !isEndlessMode && gameState === STATE.PLAYING;
    if (inHall && wave === 16 && !cst.audience) startThroneAudience(); // an audience with the king, and his Royal Guard
    if (inHall && wave >= 17 && !cst.rising && !cst.king) startValeriusRises(); // a dev jump to wave 17: no guard, he stands at once
    updateBoltRain(); updateKingHazards(dt);
}

// Regular waves: the keep's doors are blown in after wave 13, the throne room opens after wave 15
function castleWaveCleared() {
    if (wave === 13) startKeepBreach();
    else if (wave === 15) startThroneDoors();
}

// The brazier by the keep's doors topples into the spilled powder; the spark runs to the cart and the doors are blown in
// The powder cart by the keep's doors: whole, it's a cart; blown up, a small wreck. Bot runs found heroes caught in the
// gap between the full-size cart and the keep wall, narrower than the hero
function cartWreck(on) { const o = STAGE_MAPS.castle.obstacles.find(p => p.kind === 'pcart'); if (o) o.r = on ? 16 : 30; }
function startKeepBreach() { stageEvent = { type: 'keep_breach', t: 0, blocking: true }; showStagePrompt(false); }

function updateKeepBreach(ev, dt) {
    const t = ev.t, P = CS_PROPS.find(p => p[3] === 'pcart');
    camera.tx = 2280; camera.ty = CS.y;
    if (t > 0.45 && !ev.tip) { ev.tip = true; cst.brazierDown = true; addShake(2); burst(2340, 775, 0.6, 1.6, 14, { kind: 'spark', color: '#ffb74d', size: 2.4, speed: [80, 260], life: 0.5, drag: 4 }); igniteGround(2350, 782, 26, 2.5, null); } // bandits.js
    cst.fuseK = clamp01((t - 0.6) / 1.0);
    if (t > 0.6 && t < 1.6) { const [x, y] = csTrailPt(cst.fuseK); spawnParticle({ kind: 'spark', color: '#ffe082', x, y, vx: jitter(160), vy: jitter(160), size: 1.8, life: 0.25, drag: 3, grow: 0, spin: 0, rot: 0 }); }
    if (t > 1.6 && !ev.boom) { // the cart goes up and takes the doors with it
        ev.boom = true; cst.open = 1; cst.breachAt = fxTime; addShake(9); hitStopTimer = Math.max(hitStopTimer, 0.1); cartWreck(true);
        for (const i of cst.keepCells) cst.grid.data[i] = T_FLOOR;
        updateNav(true);
        const x = P[0], y = P[1];
        effects.push({ type: 'keg_flash', x, y, life: 0.45, maxLife: 0.45 });
        for (const [r, col, life] of [[160, '#fff3e0', 0.35], [300, '#ffab40', 0.6]]) effects.push({ type: 'slime_shock', x, y, radius: r, color: col, life, maxLife: life });
        effects.push({ type: 'scorch', x, y, r: 90, seed: 3, life: 30, maxLife: 30 });
        burst(x, y, 0, Math.PI * 2, 26, { kind: 'debris', color: '#5d4330', size: 4.5, speed: [160, 520], life: 0.9, drag: 2.5 });
        burst(x, y, 0, Math.PI * 2, 22, { kind: 'spark', color: '#ffcc80', size: 2.8, speed: [200, 560], life: 0.4, drag: 4 });
        for (let k = 0; k < 10; k++) spawnParticle({ kind: 'smoke', color: 'rgba(70, 60, 54, 0.7)', x: x + jitter(60), y: y + jitter(60), vx: jitter(160), vy: jitter(160), size: 26, grow: 50, life: 1.6, drag: 1.8, spin: 0, rot: 0 });
        igniteGround(x, y, 60, 6, null);
        for (const s of [-1, 1]) effects.push({ type: 'castle_door', x0: CS.keep + 50, y0: CS.y + s * 38, x: CS.keepIn + 70 + Math.random() * 40, y: CS.y + s * (60 + Math.random() * 50), s, life: 40, maxLife: 40 }); // the leaves blown into the hall
        showStagePrompt(true, 'The keep is breached &middot; press on'); cst.promptAt = fxTime;
    }
    if (t > 2.9) camera.tx = camera.ty = null;
    if (t > 3.2) stageEvent = null;
}

// The throne room's doors swing open from inside: he's expecting you
const VALERIUS_INVITE_LINES = [
    'So. You cut your way through my whole house to get here.',
    'Come in, then. Let\'s see what\'s left of you when my guard is done.',
];
function startThroneDoors() { stageEvent = { type: 'throne_doors', t: 0, t2: 0, blocking: true, rumble: 0 }; showStagePrompt(false); }

function updateThroneDoors(ev, dt) {
    const t = ev.t;
    camera.tx = CS.throne - 220; camera.ty = CS.y;
    if (t < 0.7 && t - ev.rumble > 0.18) { ev.rumble = t; addShake(1.5); } // the bar lifted on the other side
    cst.throneK = easeOut(clamp01((t - 0.7) / 1.3));
    if (t > 0.9 && !ev.opened) { ev.opened = true; cst.open = 2; castleSeat(true); for (const i of cst.throneCells) cst.grid.data[i] = T_FLOOR; updateNav(true); addShake(3); }
    if (t > 2.2 && !ev.asked) { ev.asked = true; openDialogue({ name: 'Valerius', title: 'Lord of the Bastion', portrait: 'valerius_bare', lines: VALERIUS_INVITE_LINES, onClose: () => { ev.talked = true; } }); } // dialogue.js
    if (!ev.talked) return;
    if ((ev.t2 += dt) > 0.4) {
        camera.tx = camera.ty = null; stageEvent = null; showStagePrompt(true, 'The throne room is open'); cst.promptAt = fxTime;
        if (!isEndlessMode) showWaveCleared({ title: 'Before the Throne', sub: 'The Bastion &middot; Wave 15', next: 'The Royal Guard', shops: true }); // ui.js: a last merchant, smith and apothecary, so the castle's gold has a use before the guard and the King
    }
}

// ---------- wave 16: the audience and the Royal Guard ----------
// He sits his throne (cst.seated, drawn by drawSeatedValerius) from the moment its doors open. Crossing into the nave on
// wave 16 plays throne_audience: the camera goes to him, he speaks, snaps his fingers, and his three champions step out of
// the alcoves (ai.js WardenAI / BladeAI / CaptainAI). He stays on the throne the whole fight, untouchable and not an
// enemy, barking at it (throneBark: speech over his head that never pauses the game). The last of them down ends the
// wave: stage.js onWaveCleared plays valerius_rises.
const VALERIUS_AUDIENCE_LINES = [
    'There you are. Kneel, if you like. Everyone does, sooner or later.',
    'A Warchief, a Beastmaster, half my garrison. You\'ve cost me more than any army that ever came at these walls.',
    'But a king doesn\'t dirty his hands on every stray that wanders into his hall. That\'s what a Royal Guard is for.',
];
const VALERIUS_RISE_LINES = [
    'Enough.',
    'Gorran, Sable, Corvin. The best blades I ever bought, and you cut them down in my own hall.',
    'Fine. You want the king? Then come and take the crown off my head.',
];
const THRONE_BARKS = {
    snap: ['Guard.'],
    open: ['Entertain me.', 'Well? Kill it.'],
    hit: ['Ha! Did you feel that?', 'That\'s it. Bleed on my carpet.', 'Careful. Don\'t die before I\'ve had my turn.', 'Oh, that one hurt. Good.', 'Again!'],
    king_hit: ['Feel that? That\'s twenty years of killing.', 'Up. I\'m not done with you.', 'Bleed for your king.', 'Is that all Cinderholt had left?'],
    boss_champ_warden: ['Gorran! Twenty years at my door, and you fold to that?', 'There goes my wall. I liked that shield.'],
    boss_champ_blade: ['Sable... careless. I taught you better than that.', 'My Blade, dulled. How disappointing.'],
    boss_champ_captain: ['Corvin. You had one job: keep your distance.', 'Down goes my captain. Who taught you to aim, a blind man?'],
};
const CS_GUARD = [[0, 5150, -1, 5060, 790], [1, 5150, 1, 5110, 1050], [2, 5670, -1, 5620, 720]]; // [roster, alcove x, wall side, where they take their stand]
const CS_SNAP_HAND = { x: CS_SEAT.x - 40, y: CS_SEAT.y - 18 }; // his right hand raised (drawValeriusSeated, facing west at scale 2)

// Seated, he's solid (nobody walks through the king); the obstacle draws nothing
function castleSeat(on) {
    const O = STAGE_MAPS.castle.obstacles, i = O.findIndex(o => o.kind === 'king');
    cst.seated = on;
    if (on && i < 0) O.push({ x: CS_SEAT.x - 28, y: CS_SEAT.y, r: 32, kind: 'king' });
    if (!on && i >= 0) O.splice(i, 1);
}

function startThroneAudience() {
    cst.audience = true; showStagePrompt(false);
    player.dash = null; player.grappleTarget = null; player.charge = null; player.heavy = null;
    stageEvent = { type: 'throne_audience', t: 0, t2: 0, blocking: true };
}

function updateThroneAudience(ev, dt) {
    camera.tx = 5560; camera.ty = CS.y;
    if (ev.t > 0.9 && !ev.asked) { ev.asked = true; openDialogue({ name: 'Valerius', title: 'Lord of the Bastion', portrait: 'valerius_bare', lines: VALERIUS_AUDIENCE_LINES, onClose: () => { ev.talked = true; } }); } // dialogue.js
    if (!ev.talked) return;
    const t = ev.t2 += dt;
    if (t > 0.1 && !ev.snap) { ev.snap = true; cst.snapAt = fxTime; throneBark('snap'); }
    if (t > 0.4 && !ev.snapped) { // the snap rings round the hall
        ev.snapped = true; addShake(2);
        burst(CS_SNAP_HAND.x, CS_SNAP_HAND.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ffe0b2', size: 2, speed: [60, 180], life: 0.3, drag: 5 });
        effects.push({ type: 'slime_shock', x: CS_SNAP_HAND.x, y: CS_SNAP_HAND.y, radius: 60, color: '#ffe0b2', life: 0.35, maxLife: 0.35 });
    }
    if (t > 0.7 && !ev.guard) ev.guard = spawnRoyalGuard();
    if (ev.guard) ev.guard.forEach((e, j) => { e.spawnT = Math.max(0, Math.min(e.spawnMax, e.spawnMax - (t - 0.7 - j * 0.25))); }); // they step out one after another (the enemy loop is paused in a scene)
    if (t > 1.9 && !ev.card) { ev.card = true; showBossCard('The Royal Guard', 'Sworn to the King of Thieves'); } // stage.js
    if (t > 2.9) { for (const e of ev.guard) e.spawnT = 0; camera.tx = camera.ty = null; stageEvent = null; throneBark('open'); }
}

// The three champions, at wave 16's strength, sharing one boss bar (hud.js reads e.champion and cst.guardMax)
function spawnRoyalGuard() {
    const roster = activeDungeon.stage4_champions || [], out = [];
    for (const [ri, ax, s, x, y] of CS_GUARD) {
        const b = roster[ri]; if (!b) continue;
        const e = pushBoss(b, wave, x, y); // main.js
        e.champion = true; e.champName = b.name; e.rally = 0; e.state = null; e.stateTimer = b.stateTimer + Math.random() * 0.6; e.seed = Math.random() * 10;
        e.spawnT = e.spawnMax = 0.9; e.spawnOX = ax; e.spawnOY = CS.y + s * 500; e.facingAngle = Math.atan2(y - e.spawnOY, x - ax);
        out.push(e);
    }
    cst.guardMax = out.reduce((s, e) => s + e.maxHp, 0); cst.guardDown = 0;
    activeEnemies += out.length; enemiesToSpawn = 0; bossSpawned = true; updateHUD();
    return out;
}

// combat.js checkEnemyDeath: one of the guard is down. The others rally; he has a word about it
function championFell(e) {
    cst.guardDown++;
    const left = enemies.filter(o => o.champion && !o.dead);
    for (const o of left) {
        o.rally = Math.min(2, cst.guardDown);
        effects.push({ type: 'slime_shock', x: o.x, y: o.y, radius: 110, color: '#ff7043', life: 0.6, maxLife: 0.6 });
        effects.push({ type: 'text', text: 'Rallied!', x: o.x, y: o.y - o.size / 2 - 30, color: '#ffab91', life: 1.0, maxLife: 1.0 });
    }
    if (left.length) throneBark(e.type, true);
}

// A line from the throne over his head (drawCastleAbove), no pause. Big hits on the hero only now and then
function throneBark(kind, force) {
    if (currentMap.type !== 'castle') return;
    const k = cst.king && !cst.king.dead && !cst.king.escaping ? cst.king : null; // wave 17: he says it to your face
    if (k ? kind !== 'hit' : (!cst.seated || !cst.audience || cst.rising)) return;
    if (kind === 'hit') {
        if ((cst.bark && fxTime - cst.bark.at < cst.bark.life) || fxTime - cst.barkHitAt < 7 || Math.random() < 0.35) return;
        cst.barkHitAt = fxTime;
    } else if (!force && cst.bark && fxTime - cst.bark.at < cst.bark.life * 0.5) return;
    const set = THRONE_BARKS[k ? 'king_hit' : kind]; if (!set) return;
    const text = set[(Math.random() * set.length) | 0];
    cst.bark = { text, at: fxTime, life: 1.8 + text.length * 0.045, e: k };
}
function kingBark(e, text) { if (currentMap.type === 'castle') cst.bark = { text, at: fxTime, life: 1.8 + text.length * 0.045, e }; } // ai.js: his phase changes

// Corvin's Bolt Rain (ai.js CaptainAI): each mark is hit a second after it appears; the marker is the hit
function updateBoltRain() {
    for (const ef of effects) {
        if (ef.type !== 'bolt_rain' || ef.hit || ef.maxLife - ef.life < ef.warn) continue;
        ef.hit = true;
        if (player.z <= 4 && Math.hypot(player.x - ef.x, player.y - ef.y) < ef.r + player.radius) takeDamage(ef.dmg);
        burst(ef.x, ef.y, -Math.PI / 2, 2.4, 5, { kind: 'debris', color: '#5e4a44', size: 2.5, speed: [50, 150], life: 0.4, drag: 4 });
    }
}

// The last of the guard is down (stage.js onWaveCleared on wave 16): he rises from the throne.
// For now the scene ends in Victory; step 5 turns it into wave 17, Valerius, King of Thieves.
function startValeriusRises() {
    if (cst.rising) return;
    cst.rising = true; cst.bark = null; showStagePrompt(false);
    player.dash = null; player.grappleTarget = null; player.charge = null; player.heavy = null;
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].type === 'bolt_rain' || effects[i].type === 'gar_tell') effects.splice(i, 1);
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].isEnemy) projectiles.splice(i, 1);
    stageEvent = { type: 'valerius_rises', t: 0, t2: 0, blocking: true };
}

function updateValeriusRises(ev, dt) {
    camera.tx = 5800; camera.ty = CS.y;
    if (ev.t > 1.0 && !ev.asked) { ev.asked = true; openDialogue({ name: 'Valerius', title: 'King of Thieves', portrait: 'valerius_bare', lines: VALERIUS_RISE_LINES, onClose: () => { ev.talked = true; } }); }
    if (!ev.talked) { cst.riseK = clamp01((ev.t - 0.3) / 0.6) * 0.6; return; } // he leans forward out of the seat
    const t = ev.t2 += dt;
    cst.riseK = Math.min(1, 0.6 + t / 0.5);
    if (t > 0.5 && !ev.stood) { ev.stood = true; addShake(3); burst(CS_SEAT.x - 20, CS_SEAT.y, Math.PI, 1.6, 10, { kind: 'smoke', color: 'rgba(120, 104, 88, 0.6)', size: 12, speed: [40, 140], life: 0.6, drag: 3, grow: 22 }); }
    cst.whirl = t > 0.6 && t < 1.25; // he takes up the spear and whirls it overhead
    if (t > 1.25 && !ev.king) ev.king = kingArrives();
    if (t > 1.45 && !ev.card) { ev.card = true; showBossCard('Valerius, King of Thieves', 'Lord of the Bastion'); } // stage.js: over wave 17's banner
    if (t > 2.4) { stageEvent = null; camera.tx = camera.ty = null; }
}

// He's in the fight: the last boss, at wave 17's strength (enemies.json stage4_boss). Wave 17 starts at once, no breather
function kingArrives() {
    const e = pushBoss(activeDungeon.stage4_boss, 17, CS_SEAT.x - 34, CS_SEAT.y); // main.js
    e.king = true; e.helmless = true; e.facingAngle = Math.PI; e.state = 'rally'; e.stateTimer = 0.6; e.seed = Math.random() * 10;
    cst.king = e; cst.whirl = false; castleSeat(false);
    valImpact(e.x, e.y, 5); // ai.js
    effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 260, color: '#c9a227', life: 0.7, maxLife: 0.7 });
    if (wave === 16) startNextWave(); // main.js: wave 17 counts him in (as the trail's wave 10 counts the Beastmaster)
    else { bossSpawned = true; activeEnemies++; updateHUD(); } // a dev jump straight to wave 17
    return e;
}

// ---------- wave 17: his hall in the fight (ai.js ValeriusAI, phase 2 on) ----------

// The chandelier he'll cut down: one still hanging near you, in reach of his toss; -1 if none
function kingChandelier(e) {
    let best = -1, bd = Infinity;
    CS_CHAND.forEach(([x, y], i) => {
        if (cst.chand[i].state !== 'up') return;
        const dh = Math.hypot(x - player.x, y - player.y), de = Math.hypot(x - e.x, y - e.y);
        if (dh < 300 && de < 700 && de > 120 && dh < bd) { bd = dh; best = i; }
    });
    return best;
}
function chandelierCut(i, dmg) { // the chain parts: it drops (updateKingHazards crashes it VK_CHAND_FALL s later)
    if (cst.chand[i].state !== 'up') return;
    cst.chand[i] = { state: 'fall', t0: fxTime, dmg };
    const [x, y] = CS_CHAND[i];
    burst(x, y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#ffe0b2', size: 2.2, speed: [80, 240], life: 0.35, drag: 4 }); addShake(2);
}
// A brazier in the throne room he can get behind, with you within its lane's reach
function kingBrazier(e) {
    let best = null, bd = Infinity;
    for (const o of currentMap.obstacles) {
        if (o.kind !== 'brazier' || o.x < CS.throne) continue;
        const de = Math.hypot(o.x - e.x, o.y - e.y), dh = Math.hypot(o.x - player.x, o.y - player.y);
        if (de < 480 && dh < VK_KICK_L - 40 && dh > 140 && de < bd) { bd = de; best = o; }
    }
    return best;
}
const kickLane = (B, a) => { const cl = clipToWalls(B.x, B.y, B.x + Math.cos(a) * VK_KICK_L, B.y + Math.sin(a) * VK_KICK_L, 18, false); return cl ? Math.hypot(cl[0] - B.x, cl[1] - B.y) : VK_KICK_L; };
function brazierKick(e, B, a) { // off its stand and rolling down the lane, spilling fire
    const i = currentMap.obstacles.indexOf(B); if (i < 0) return;
    currentMap.obstacles.splice(i, 1); cst.kicked.push(B);
    effects.push({ type: 'brazier_roll', x: B.x, y: B.y, a, left: kickLane(B, a), dmg: e.dmg * VK_KICK_DMG, hit: false, acc: 0, spin: 0, life: 9, maxLife: 9 });
    addShake(3); valImpact(B.x, B.y, 3);
    burst(B.x, B.y, a, 1.2, 14, { kind: 'spark', color: '#ffb74d', size: 2.4, speed: [120, 360], life: 0.5, drag: 3 });
}
function pillarSpear(P) { cst.pillarSpear = { ...P }; } // ai.js Unchained: it stays in the pillar
function kingUnchained() { // his roar: every candle still burning gutters low
    cst.dim = 1;
    CS_CHAND.forEach(([x, y], i) => { if (cst.chand[i].state === 'up') burst(x, y, -Math.PI / 2, Math.PI, 6, { kind: 'smoke', color: 'rgba(90, 84, 80, 0.5)', size: 8, speed: [20, 70], life: 0.9, drag: 2, grow: 16 }); });
}

function updateKingHazards(dt) {
    cst.dimK += (cst.dim - cst.dimK) * Math.min(1, dt * 1.5);
    CS_CHAND.forEach(([x, y], i) => { // a chandelier coming down: the crash, candles and fire across the slabs
        const ch = cst.chand[i]; if (ch.state !== 'fall' || fxTime - ch.t0 < VK_CHAND_FALL) return;
        ch.state = 'down'; ch.seed = Math.random() * 6;
        if (player.z <= 4 && Math.hypot(player.x - x, player.y - y) < VK_CHAND_R + player.radius) takeDamage(ch.dmg);
        addShake(6); hitStopTimer = Math.max(hitStopTimer, 0.05);
        effects.push({ type: 'slime_shock', x, y, radius: VK_CHAND_R + 40, color: '#ffcc80', life: 0.45, maxLife: 0.45 });
        burst(x, y, 0, Math.PI * 2, 18, { kind: 'debris', color: '#3a3d42', size: 3.5, speed: [100, 340], life: 0.6, drag: 3 });
        burst(x, y, 0, Math.PI * 2, 16, { kind: 'spark', color: '#ffd180', size: 2.4, speed: [120, 380], life: 0.45, drag: 4 });
        igniteGround(x, y, 70, 6, null); // bandits.js
    });
    const R = player.radius;
    for (const ef of effects) { // a kicked brazier tumbling down its lane, a hit for whoever's in it, fire every few steps
        if (ef.type !== 'brazier_roll' || ef.life <= 0) continue;
        const step = Math.min(ef.left, VK_KICK_SPEED * dt), nx = ef.x + Math.cos(ef.a) * step, ny = ef.y + Math.sin(ef.a) * step;
        const blocked = solidCell(terrainAt(nx, ny), false) || currentMap.obstacles.some(o => o.kind !== 'keg' && o.kind !== 'king' && Math.hypot(nx - o.x, ny - o.y) < o.r + 16);
        if (!blocked) { ef.x = nx; ef.y = ny; ef.left -= step; ef.acc += step; ef.spin += step * 0.06; }
        if (ef.acc >= 55) { ef.acc = 0; igniteGround(ef.x, ef.y, 30, 5, null); }
        if (!ef.hit && player.z <= 4 && Math.hypot(player.x - ef.x, player.y - ef.y) < VK_KICK_W / 2 + R) {
            ef.hit = true; takeDamage(ef.dmg);
            if (!player.dash && !player.grappleTarget) { player.x += Math.cos(ef.a) * 80; player.y += Math.sin(ef.a) * 80; clampToBounds(player, R); }
        }
        if (Math.random() < 0.6) spawnParticle({ kind: 'spark', color: '#ffb74d', x: ef.x + jitter(10), y: ef.y + jitter(10), vx: jitter(80), vy: jitter(80), size: 2, life: 0.35, drag: 3, grow: 0, spin: 0, rot: 0 });
        if (blocked || ef.left <= 0) { // it fetches up against whatever stopped it
            ef.life = 0; igniteGround(ef.x, ef.y, 50, 6, null); cst.toppled.push({ x: ef.x, y: ef.y, a: ef.a }); addShake(3);
            burst(ef.x, ef.y, ef.a + Math.PI, 1.6, 12, { kind: 'spark', color: '#ffb74d', size: 2.4, speed: [100, 300], life: 0.45, drag: 3 });
        }
    }
}

// ---------- his death: he kneels, he speaks, he falls; his crown rolls free, and taking it ends the run ----------

const VALERIUS_LAST_WORDS = [
    'Ha... so this is how it looks. From the other end of the blade.',
    'I took this crown off a dead king, you know. In a burning hall, just like this one.',
    'Go on. Take it. See how long you keep it... before someone like you comes for it. Someone like me.',
];
function startValeriusFall(e) { // combat.js kingLastStand
    valReset(e); e.state = 'king_fall'; e.kneelK = 0; e.ghosting = false; e.spear = null; e.fadeK = 0; e.liftZ = 0; e.airborne = false; // ai.js
    cst.bark = null; showStagePrompt(false);
    for (let i = effects.length - 1; i >= 0; i--) { const t = String(effects[i].type); if (t.startsWith('val_') || t === 'gar_tell' || t === 'slam_warn' || t === 'charge_lane' || t === 'brazier_roll' || t === 'blade_ring' || t === 'bolt_rain') effects.splice(i, 1); }
    for (const ch of cst.chand) if (ch.state === 'fall') ch.state = 'down';
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].isEnemy) projectiles.splice(i, 1);
    player.dash = null; player.grappleTarget = null; player.charge = null; player.heavy = null;
    hitStopTimer = Math.max(hitStopTimer, 0.25); addShake(6);
    stageEvent = { type: 'valerius_fall', t: 0, t2: 0, blocking: true, e };
}

function updateValeriusFall(ev, dt) {
    const e = ev.e;
    camera.tx = lerp(player.x, e.x, 0.6); camera.ty = lerp(player.y, e.y, 0.6);
    if (!ev.talked) {
        e.kneelK = easeOut(clamp01(ev.t / 0.5)); e.facingAngle = Math.atan2(player.y - e.y, player.x - e.x);
        if (ev.t > 0.3 && !ev.dropped) { // the blades slip from his hands
            ev.dropped = true;
            if (e.blades) { e.bladesDown = true; effects.push({ type: 'dropped_blades', x: e.x, y: e.y, a: e.facingAngle, life: 9999, maxLife: 9999 }); burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#eceff1', size: 2, speed: [60, 160], life: 0.3, drag: 5 }); }
            e.unchained = true;
        }
        if (ev.t > 1.1 && !ev.asked) { ev.asked = true; openDialogue({ name: 'Valerius', title: 'King of Thieves', portrait: 'valerius_bare', lines: VALERIUS_LAST_WORDS, onClose: () => { ev.talked = true; } }); } // dialogue.js
        return;
    }
    const t = ev.t2 += dt;
    if (t > 0.3 && !ev.fell) { // he goes down, and the crown rolls off his head
        ev.fell = true; e.crownless = true; e.hp = 0; e.dead = true; activeEnemies = Math.max(0, activeEnemies - 1);
        banditDeathFx(e); addShake(5); // bandits.js: he lies in his hall for good
        const a = e.facingAngle + Math.PI + 0.7;
        let x = e.x + Math.cos(a) * 75, y = e.y + Math.sin(a) * 75;
        [x, y] = crownSpot(x, y);
        cst.crown = { x, y, x0: e.x, y0: e.y, t0: fxTime };
    }
    if (t > 1.7) { // the way to it is clear: his fires die down, his gold and XP are yours
        stageEvent = null; camera.tx = camera.ty = null;
        for (const f of effects) if (f.type === 'ground_fire') f.life = Math.min(f.life, 0.6);
        for (let i = 0; i < BOSS_PURSE; i++) drops.push({ x: e.x, y: e.y, type: 'gold', val: 20 + wave * 2, radius: 8, life: 30.0 });
        collectAllDrops(); // combat.js
        crownExit();
        gainXP(e.xp); // combat.js: after the scene, so a level-up doesn't cover it
    }
}
// Where the crown comes to rest: always out in the nave where you can walk up to it (a bot run once lost it in an
// alcove's corner, out of reach), never inside a pillar or a brazier
function crownSpot(x, y) {
    x = Math.max(CS.throneIn + 60, Math.min(CS_DAIS.x1 - 60, x)); y = Math.max(CS.y - CS_HALF.throne + 60, Math.min(CS.y + CS_HALF.throne - 60, y));
    for (const o of currentMap.obstacles) {
        if (o.kind === 'king') continue;
        const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), need = o.r + 34;
        if (d < need) { const a = d > 0.1 ? Math.atan2(dy, dx) : Math.atan2(CS.y - o.y, 0.001); x = o.x + Math.cos(a) * need; y = o.y + Math.sin(a) * need; }
    }
    return terrainAt(x, y) === T_FLOOR ? [x, y] : [5400, CS.y];
}
function crownExit() {
    STAGE_MAPS.castle.exit = { x: cst.crown.x, y: cst.crown.y };
    openStageExit('#ffd54f'); showStagePrompt(true, 'Claim his crown'); // stage.js
}

// combat.js checkEnemyDeath: his death without the scene (his HP set to 0 directly): the crown falls where he stood
function valeriusFall(e) {
    if (cst.crown) return;
    for (const f of effects) if (f.type === 'bandit_corpse' && f.kind === 'boss_valerius') { f.crownless = true; f.img = null; }
    const [cx, cy] = crownSpot(e.x, e.y + 40);
    cst.crown = { x: cx, y: cy, x0: e.x, y0: e.y, t0: fxTime };
    activeEnemies = Math.max(0, activeEnemies - 1);
    crownExit(); gainXP(e.xp);
}

function startCrownClaim() { stageEvent = { type: 'crown_claim', t: 0, blocking: true }; showStagePrompt(false); } // stage.js updateStage
function updateCrownClaim(ev, dt) {
    const C = cst.crown; player.dash = null; player.grappleTarget = null;
    camera.tx = player.x; camera.ty = player.y;
    C.claimK = clamp01(ev.t / 0.9);
    if (ev.t > 0.9 && !ev.flash) {
        ev.flash = true; addShake(4);
        effects.push({ type: 'slime_shock', x: player.x, y: player.y, radius: 260, color: '#ffd54f', life: 0.8, maxLife: 0.8 });
        burst(player.x, player.y - 30, 0, Math.PI * 2, 24, { kind: 'spark', color: '#ffe082', size: 3, speed: [140, 380], life: 0.6, drag: 4 });
    }
    if (ev.t > 2.0) { stageEvent = null; camera.tx = camera.ty = null; cst.crown = null; currentMap.caveOpen = false; showVictory(); } // ui.js: the Bastion is yours
}

// ---------- drawing (world space; the camera transform is already applied) ----------

function drawCastleGround() {
    const G = cst.ground, W = G.width, H = G.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, Math.ceil(viewW()) + 42), sh = Math.min(H - sy, Math.ceil(viewH()) + 42);
    ctx.drawImage(G, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(260);
    if (cavIn(70, CS.y, V)) drawCastlePortcullis();
    if (cavIn(CS.keep, CS.y, cavView(400))) drawKeepDoors(t);
    if (cavIn(CS.throne, CS.y, cavView(300))) drawThroneDoors();
    drawCastleDark();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; // fires and their glow, on top of the night
    for (const o of currentMap.obstacles) {
        if (!cavIn(o.x, o.y, V)) continue;
        if (o.kind === 'brazier' || (o.kind === 'brazier_t' && !cst.brazierDown)) glow(ctx, o.x, o.y, 110, '#ff8f00', 0.3 + 0.06 * Math.sin(t * 9 + o.x));
        else if (o.kind === 'forge') glow(ctx, o.x, o.y, 120, '#ff5722', 0.34 + 0.08 * Math.sin(t * 5));
        else if (o.kind === 'hearth') glow(ctx, o.x, o.y, 170, '#ff7a1a', 0.36 + 0.06 * Math.sin(t * 7 + o.y));
        else if (o.kind === 'gold') glow(ctx, o.x, o.y, 70, '#ffd54f', 0.12 + 0.05 * Math.sin(t * 2 + o.x));
    }
    for (const [x, y, s] of cst.torches) if (cavIn(x, y, V)) glow(ctx, x, y + s * 12, 60, '#ff9800', 0.3 + 0.08 * Math.sin(t * 11 + x));
    if (cst.throneK > 0 && cst.open < 2 && cavIn(CS.throne, CS.y, V)) glow(ctx, CS.throne, CS.y, 260 * cst.throneK, '#ff3d00', 0.35 * cst.throneK); // red light pouring out
    let n = 0; // a pale halo on the ground under every bandit, so their dark browns stand out against the night
    for (const e of enemies) if (!e.dead && !e.prop && !e.pod && !e.submerged && !(e.spawnT > 0) && n < 40 && cavIn(e.x, e.y, V)) { n++; glow(ctx, e.x, e.y + 3, e.size * 1.3 + 16, '#cfdcec', 0.3); }
    if (cst.seated && cavIn(CS_SEAT.x, CS_SEAT.y, V)) glow(ctx, CS_SEAT.x, CS_SEAT.y + 3, 70, '#cfdcec', 0.3); // and under the king on his throne
    ctx.restore();
    for (const o of currentMap.obstacles) {
        if (!cavIn(o.x, o.y, V)) continue;
        if (o.kind === 'brazier') drawFlame(ctx, o.x, o.y, 16, t, o.x * 0.01, 1); // bandits.js
        else if (o.kind === 'brazier_t') drawToppledBrazier(o, t);
        else if (o.kind === 'forge') drawFlame(ctx, o.x, o.y, 14, t, 2.1, 0.8);
        else if (o.kind === 'hearth') drawFlame(ctx, o.x, o.y, 24, t, o.y * 0.01, 1);
        else if (o.kind === 'pcart') drawPowderCart(o, t);
    }
    for (const [x, y, s] of cst.torches) if (cavIn(x, y, V)) drawFlame(ctx, x, y + s * 9, 7, t, x * 0.013, 1);
    CS_CHAND.forEach(([x, y], i) => { if (cst.chand[i].state === 'down' && cavIn(x, y, V)) drawChandelierWreck(x, y, cst.chand[i].seed || 0); });
    for (const o of cst.toppled) if (cavIn(o.x, o.y, V)) { // a kicked brazier where it fetched up, its coals strewn back along the lane
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a + 1.2); ctx.fillStyle = '#262626'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        for (let k = 1; k < 6; k++) { ctx.fillStyle = k % 2 ? '#5d1a08' : '#3a1206'; ctx.beginPath(); ctx.arc(o.x - Math.cos(o.a) * k * 9 + Math.sin(k) * 4, o.y - Math.sin(o.a) * k * 9 + Math.cos(k) * 4, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const ef of effects) {
        if (ef.type === 'brazier_roll' && ef.life > 0) drawBrazierRoll(ef);
        else if (ef.type === 'dropped_blades') for (const [s, kind] of [[1, 'sabre'], [-1, 'knife']]) { ctx.save(); ctx.translate(ef.x + Math.cos(ef.a + s * 1.4) * 34, ef.y + Math.sin(ef.a + s * 1.4) * 34); ctx.rotate(ef.a + s * 0.9); ctx.scale(2, 2); valBlade(ctx, 0, 0, 0, kind); ctx.restore(); } // bandits.js
    }
    if (cst.seated && cavIn(CS_SEAT.x, CS_SEAT.y, V)) drawSeatedValerius();
    if (cst.crown && cavIn(cst.crown.x, cst.crown.y, V)) drawCastleCrown();
    if (cst.fuseK > 0 && cst.fuseK < 1) { const [x, y] = csTrailPt(cst.fuseK); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 26, '#ffe082', 0.9); ctx.restore(); } // the spark running along the powder
}

// Dusk is long gone: the bailey under a cold night, the keep's halls darker still, the throne room lit by its chandeliers
function drawCastleDark() {
    const cx = camera.x + viewW() / 2, k = clamp01((cx - 2300) / 400), k2 = clamp01((cx - 4350) / 300);
    const a = 0.42 + 0.18 * k - 0.08 * k2 + 0.1 * k2 * cst.dimK, r = Math.round(lerp(10, 14, k)), gc = Math.round(lerp(9, 8, k)), b = Math.round(lerp(24, 8, k)); // dimK: darker once his roar guttered the candles
    drawDarkLayer(`rgba(${r}, ${gc}, ${b}, ${a})`, hole => { // map_cavern.js
        const t = fxTime, V = cavView(420);
        for (const o of currentMap.obstacles) {
            if (!cavIn(o.x, o.y, V)) continue;
            if (o.kind === 'brazier' || (o.kind === 'brazier_t' && !cst.brazierDown)) hole(o.x, o.y, 300 + Math.sin(t * 9 + o.x) * 10, 0.75);
            else if (o.kind === 'forge') hole(o.x, o.y, 340, 0.8);
            else if (o.kind === 'hearth') hole(o.x, o.y, 460 + Math.sin(t * 7 + o.y) * 14, 0.85);
            else if (o.kind === 'gold') hole(o.x, o.y, 150, 0.35);
        }
        for (const [x, y, s] of cst.torches) if (cavIn(x, y, V)) hole(x, y + s * 14, 230 + Math.sin(t * 11 + x) * 8, 0.6);
        CS_CHAND.forEach(([x, y], i) => { if (cst.chand[i].state === 'up' && cavIn(x, y, V)) hole(x, y, 340 * (1 - 0.45 * cst.dimK), 0.6 * (1 - 0.5 * cst.dimK)); });
        if (cst.crown) hole(cst.crown.x, cst.crown.y, 300, 0.8);
        cacheLights(hole); // caches.js: props get no pool below, so the caches are added here
        if (cst.throneK > 0 && cst.open < 2) hole(CS.throne, CS.y, 400 * cst.throneK, 0.7);
        let n = 0; // every bandit and every enemy shot stands in its own pool of light: dark browns on dark ground were hard to pick out
        for (const e of enemies) if (!e.dead && !e.prop && !e.pod && !e.submerged && n < 40 && cavIn(e.x, e.y, V)) { n++; hole(e.x, e.y, e.size * 2 + 90, 0.5); }
        if (cst.seated) hole(CS_SEAT.x, CS_SEAT.y, 230, 0.6); // the king on his throne, never lost in the dark
        for (const p of projectiles) if (p.isEnemy && n < 70 && cavIn(p.x, p.y, V)) { n++; hole(p.x, p.y, 120, 0.55); }
        for (const ef of effects) {
            if (ef.type === 'ground_fire') hole(ef.x, ef.y, ef.radius * 3.4, 0.65 * Math.min(1, ef.life / 0.8));
            else if (ef.type === 'keg_flash') hole(ef.x, ef.y, 460, 0.95 * (ef.life / ef.maxLife));
        }
    });
}

// The portcullis at the gate passage's outer end: up as you arrive, then down behind you
function drawCastlePortcullis() {
    const c = ctx, x = 60, y0 = CS.y - 90, k = cst.portK, lift = (1 - k) * 190;
    c.save(); c.beginPath(); c.rect(x - 4, y0, 22, 180); c.clip();
    c.strokeStyle = '#4a4f55'; c.lineWidth = 3.4;
    for (let y = y0 + 6; y <= y0 + 174; y += 14) { c.beginPath(); c.moveTo(x, y - lift); c.lineTo(x + 14, y - lift); c.stroke(); }
    for (const bx of [x + 2, x + 12]) { c.beginPath(); c.moveTo(bx, y0 - lift); c.lineTo(bx, y0 + 180 - lift); c.stroke(); }
    c.restore();
    c.fillStyle = '#3a352f'; c.fillRect(x - 8, y0 - 14, 30, 14); c.fillRect(x - 8, y0 + 180, 30, 14); // the grooves it runs in
}

// The keep's great doors: shut and barred, the powder cart against them; once breached, an empty arch (the leaves lie in the hall)
function drawKeepDoors(t) {
    const x = CS.keep + 50;
    if (cst.open < 1) {
        for (const s of [-1, 1]) {
            const y0 = s < 0 ? CS.y - 75 : CS.y;
            ctx.fillStyle = '#4e3626'; ctx.strokeStyle = '#1a110a'; ctx.lineWidth = 2; ctx.fillRect(x - 7, y0, 14, 75); ctx.strokeRect(x - 7, y0, 14, 75);
            ctx.fillStyle = '#263238'; for (const o of [12, 36, 60]) ctx.fillRect(x - 7, y0 + o, 14, 3); // iron bands
        }
        ctx.fillStyle = '#5d4330'; ctx.fillRect(x - 12, CS.y - 30, 6, 60); // the bar, seen across the doors' edge
    } else {
        const k = clamp01((fxTime - cst.breachAt) / 2);
        ctx.fillStyle = `rgba(20, 14, 10, ${0.5 * k})`; ctx.beginPath(); ctx.ellipse(CS.keep + 20, CS.y, 50, 90, 0, 0, Math.PI * 2); ctx.fill(); // soot over the arch
        for (let i = 0; i < 6; i++) { const a = i * 1.7, px = x + 60 + Math.cos(a) * 30, py = CS.y + Math.sin(a * 1.3) * 60; ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = '#2b1f17'; ctx.fillRect(-9, -2, 18, 4); ctx.restore(); } // splinters
    }
    for (const ef of effects) if (ef.type === 'castle_door') { // a door leaf flung into the hall, end over end, then lying charred
        const k = clamp01((ef.maxLife - ef.life) / 0.5), px = lerp(ef.x0, ef.x, easeOut(k)), py = lerp(ef.y0, ef.y, easeOut(k)), z = Math.sin(Math.PI * k) * 60;
        ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.fillRect(px - 7 + 6, py - 37 + 8, 14, 75);
        ctx.translate(px, py - z); ctx.rotate(ef.s * (0.3 + k * 2.4));
        ctx.fillStyle = '#3a281c'; ctx.strokeStyle = '#120c08'; ctx.lineWidth = 2; ctx.fillRect(-7, -37, 14, 75); ctx.strokeRect(-7, -37, 14, 75);
        ctx.fillStyle = '#263238'; for (const o of [-25, -1, 23]) ctx.fillRect(-7, o, 14, 3);
        ctx.fillStyle = 'rgba(10, 6, 4, 0.5)'; ctx.fillRect(-7, -37, 14, 30);
        ctx.restore();
    }
}

// The throne room's doors: two tall leaves of dark oak bound in red leather and gold, his sigil across both; they swing
// inward on their hinges (throneK 0 shut, 1 open against the walls)
function drawThroneDoors() {
    const x = CS.throne + 25, a = cst.throneK * Math.PI / 2 * 0.95;
    for (const s of [-1, 1]) { // the north leaf hangs from y 800 down to the middle, the south one from y 1000 up
        ctx.save(); ctx.translate(x, CS.y + s * 100); ctx.rotate(s * a); // each swings its free end toward +x, into the room
        const y0 = s < 0 ? 0 : -100;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(-2, y0 + 4, 16, 100);
        ctx.fillStyle = '#3a1a14'; ctx.strokeStyle = '#120806'; ctx.lineWidth = 2; ctx.fillRect(-8, y0, 16, 100); ctx.strokeRect(-8, y0, 16, 100);
        ctx.fillStyle = '#7a1517'; ctx.fillRect(-5, y0 + 4, 10, 92);
        ctx.fillStyle = '#c9a227'; for (let k = 0; k < 6; k++) ctx.fillRect(-1.5, y0 + 8 + k * 16, 3, 3); // gold studs
        ctx.restore();
    }
}

// The brazier by the keep's doors: standing, then knocked over with its coals spilled into the powder
function drawToppledBrazier(o, t) {
    if (!cst.brazierDown) { csBrazierStand(ctx, o.x, o.y, clrRng(o.x | 0)); drawFlame(ctx, o.x, o.y, 16, t, o.x * 0.01, 1); return; } // the same seeded coals every frame
    ctx.save(); ctx.translate(o.x + 8, o.y + 6); ctx.rotate(0.9);
    ctx.fillStyle = '#262626'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#a33c10' : '#5d1a08'; ctx.beginPath(); ctx.arc(o.x + 6 + k * 5, o.y + 14 + Math.sin(k) * 5, 3, 0, Math.PI * 2); ctx.fill(); }
}

// The powder cart against the keep's doors: kegs under a tarp; after the breach, a burnt wreck
function drawPowderCart(o, t) {
    const burnt = cst.open >= 1;
    vilCart(ctx, o.x, o.y, 1.35, 56, 34, !burnt, burnt); // map_village.js
    if (burnt) return;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(1.35);
    for (const [kx, ky] of [[-14, -8], [0, -8], [14, -8], [-7, 6], [7, 6]]) { ctx.save(); ctx.translate(kx, ky); kegShape(ctx, 7); ctx.restore(); } // bandits.js
    ctx.fillStyle = 'rgba(90, 80, 60, 0.75)'; ctx.beginPath(); ctx.moveTo(-26, -15); ctx.lineTo(4, -17); ctx.lineTo(10, 15); ctx.lineTo(-24, 14); ctx.closePath(); ctx.fill(); // the tarp half over them
    ctx.restore();
}

// Above the fighters: banners streaming from the wall tops, the forge's smoke, the chandeliers, embers in the night air
function drawCastleAbove() {
    const c = ctx, t = fxTime, V = cavView(200);
    for (const [x, y, s] of CS_BANNERS) {
        if (!cavIn(x, y, V)) continue;
        const L = 70, w = 24, a0 = Math.atan2(WIND_Y * 0.4, WIND_X) + Math.sin(t * 1.3 + x) * 0.12;
        c.save(); c.translate(x, y); c.rotate(a0);
        c.beginPath(); c.moveTo(0, -w / 2);
        for (let k = 1; k <= 8; k++) { const u = k / 8; c.lineTo(u * L, -w / 2 + Math.sin(t * 6 - u * 5 + x) * 5 * u); }
        for (let k = 8; k >= 0; k--) { const u = k / 8; c.lineTo(u * L - (k === 8 ? 8 : 0), w / 2 + Math.sin(t * 6 - u * 5 + x) * 5 * u); }
        c.closePath(); sprFill(c, '#8e1b1b');
        c.strokeStyle = '#c9a227'; c.lineWidth = 1.4; c.beginPath(); c.arc(L * 0.45, Math.sin(t * 6 - 2.2 + x) * 2.2, 6, 0, Math.PI * 2); c.stroke();
        c.restore();
        sprEllipse(c, x, y, 4.5, 4.5, '#3e2a1a'); sprEllipse(c, x, y, 2.2, 2.2, '#c9a227', false);
    }
    const F = CS_PROPS.find(p => p[3] === 'forge');
    if (cavIn(F[0] + 150, F[1] - 120, cavView(400))) drawSmokeColumn(F[0] + 30, F[1] - 120, t, 2.4, 0.7, 0.3); // map_village.js: out of the smithy's chimney
    CS_CHAND.forEach(([x, y], i) => { const ch = cst.chand[i]; if (ch.state !== 'down' && cavIn(x, y, V)) drawChandelier(x, y, t, ch.state === 'fall' ? clamp01((fxTime - ch.t0) / VK_CHAND_FALL) : 0, cst.dimK); });
    if (cst.pillarSpear && cavIn(cst.pillarSpear.x, cst.pillarSpear.y, V)) drawPillarSpear(cst.pillarSpear);
    for (const ef of effects) { // Corvin's Bolt Rain: bolts dropping onto their marks in the last moments
        if (ef.type !== 'bolt_rain') continue;
        const k = (ef.maxLife - ef.life - (ef.warn - 0.3)) / 0.3; if (k < 0 || k >= 1) continue;
        c.save(); c.strokeStyle = '#2b1a10'; c.lineWidth = 3; c.lineCap = 'round';
        for (let j = 0; j < 4; j++) { const h = (1 - k) * 170, x = ef.x + Math.cos(ef.seed + j * 1.7) * 18 + h * 0.4, y = ef.y + Math.sin(ef.seed + j * 2.3) * 14 - h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y - 12); c.stroke(); }
        c.restore();
    }
    const tx0 = Math.floor(player.x / 200), ty0 = Math.floor(player.y / 200); // embers in the bailey, dust motes in the keep
    c.fillStyle = player.x < CS.keep ? '#ffb74d' : '#d8cbb8';
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 3; tx <= tx0 + 3; tx++) {
        const hsh = tx * 73 + ty * 151, x = tx * 200 + ((cavHash(hsh) * 200 + t * 12 * WIND_X * (0.6 + cavHash(hsh + 2))) % 200 + 200) % 200, y = ty * 200 + ((cavHash(hsh + 5) * 200 - t * 14) % 200 + 200) % 200;
        c.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + hsh); c.fillRect(x, y, 1.8, 1.8);
    }
    c.globalAlpha = 1;
    if (cst.bark) drawThroneBark();
}

// Valerius on his throne, facing west down the nave (bandits.js drawValeriusSeated); risen, he stands before it
function drawSeatedValerius() {
    const snapT = fxTime - cst.snapAt, snap = snapT < 0.3 ? snapT / 0.3 : snapT < 0.9 ? 1 : snapT < 1.3 ? 1 - (snapT - 0.9) / 0.4 : 0;
    const stand = cst.riseK >= 1, pose = { t: fxTime, walk: 0, move: 0, trail: { x: 0, y: 0 }, helmless: true, seated: !stand, snap, rise: cst.riseK, whirl: cst.whirl ? fxTime * 16 : undefined };
    const x = CS_SEAT.x - (stand ? 34 : 0);
    ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + 3, CS_SEAT.y + 12, 28, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    stampBandit(null, x, CS_SEAT.y, Math.PI, 2, pose, 0, 1, 0, 'boss_valerius'); // bandits.js
}

// His bark: a dark box with the line in it over his head, a tail down to him; kept on screen when he's off it
function drawThroneBark() {
    const b = cst.bark, age = fxTime - b.at; if (age < 0 || age > b.life) { if (age > b.life) cst.bark = null; return; }
    const c = ctx, a = Math.min(1, age / 0.15, (b.life - age) / 0.3);
    c.save(); c.font = 'italic 16px Georgia, serif'; c.textAlign = 'left'; // other draws leave it centred
    const tw = c.measureText(b.text).width, w = tw + 28, h = 44, mx = 14;
    const ax = b.e ? b.e.x : CS_SEAT.x, ay = b.e ? b.e.y - (b.e.liftZ || 0) : CS_SEAT.y; // over him: on his throne, or in the fight
    let bx = ax - w / 2, by = ay - 70 - h;
    const vx0 = camera.x + mx, vx1 = camera.x + viewW() - mx - w, vy0 = camera.y + mx, vy1 = camera.y + viewH() - mx - h;
    const cx = Math.max(vx0, Math.min(vx1, bx)), cy = Math.max(vy0, Math.min(vy1, by)), pinned = cx !== bx || cy !== by; bx = cx; by = cy;
    c.globalAlpha = a; c.fillStyle = 'rgba(20, 11, 9, 0.9)'; c.strokeStyle = '#c9a227'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(bx, by, w, h, 6);
    if (!pinned) { c.moveTo(ax - 9, by + h); c.lineTo(ax, by + h + 12); c.lineTo(ax + 9, by + h); } // the tail down to him
    c.fill(); c.stroke();
    c.fillStyle = '#ff8a65'; c.font = 'bold 10px Georgia, serif'; c.textBaseline = 'top'; c.fillText(pinned ? (ax > bx + w ? 'VALERIUS  \u25B6' : ax < bx ? '\u25C0  VALERIUS' : 'VALERIUS') : 'VALERIUS', bx + 10, by + 6);
    c.fillStyle = '#f3e5c8'; c.font = 'italic 16px Georgia, serif'; c.fillText(b.text, bx + 14, by + 20);
    c.restore();
}

// A chandelier hanging over the nave: an iron wheel with candles round its rim and chains up to the dark
// fall: 0 hanging .. 1 on the floor (it shrinks away from the eye, its shadow closing in); dim: the candles guttered
function drawChandelier(x, y, t, fall = 0, dim = 0) {
    const c = ctx, R = 34, f2 = fall * fall;
    c.fillStyle = `rgba(0, 0, 0, ${0.25 + 0.25 * f2})`; c.beginPath(); c.ellipse(x + 30 * (1 - f2), y + 40 * (1 - f2), R + 6, R * 0.8, 0, 0, Math.PI * 2); c.fill(); // its shadow far below
    c.save(); c.translate(x, y); c.scale(1 - 0.2 * f2, 1 - 0.2 * f2); c.rotate(fall * 0.5); c.translate(-x, -y);
    c.strokeStyle = '#1e1f22'; c.lineWidth = 5; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#3a3d42'; c.lineWidth = 2.5; c.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); c.stroke(); }
    sprEllipse(c, x, y, 5, 5, '#2b2d30');
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, R * 2.6, '#ffb74d', (0.2 + 0.03 * Math.sin(t * 7 + x)) * (1 - 0.7 * dim)); c.restore();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, cx = x + Math.cos(a) * R, cy = y + Math.sin(a) * R; c.fillStyle = '#efe6d2'; c.beginPath(); c.arc(cx, cy, 2.6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffd180'; c.beginPath(); c.arc(cx + 0.5, cy - 0.5, (1.6 + 0.4 * Math.sin(t * 13 + k)) * (1 - 0.6 * dim), 0, Math.PI * 2); c.fill(); }
    if (fall > 0) { c.strokeStyle = '#263238'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 6, y - 6); c.lineTo(x + s * 12, y - 22 - 10 * fall); c.stroke(); } } // the parted chain whipping after it
    c.restore();
}
// A chandelier on the floor where it crashed: the iron wheel bent out of round, spokes snapped, candles strewn
function drawChandelierWreck(x, y, seed) {
    const c = ctx;
    c.save(); c.translate(x, y); c.rotate(seed);
    c.fillStyle = 'rgba(10, 6, 4, 0.5)'; c.beginPath(); c.ellipse(0, 0, 52, 44, 0, 0, Math.PI * 2); c.fill(); // soot
    c.strokeStyle = '#1e1f22'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 36, 27, 0.3, 0.4, Math.PI * 2 - 0.3); c.stroke();
    c.strokeStyle = '#3a3d42'; c.lineWidth = 2.5; c.stroke();
    for (const [a, l] of [[0.7, 30], [2.4, 18], [4.1, 26]]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * l, Math.sin(a) * l * 0.75); c.stroke(); }
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + seed, d = 22 + (k % 3) * 14; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a * 2); c.fillStyle = '#d8cfbc'; c.fillRect(-4, -1.6, 8, 3.2); c.restore(); }
    c.restore();
}
// His spear where he drove it into a pillar, the snapped chain hanging from its ring
function drawPillarSpear(P) {
    const c = ctx, sc = 2, len = (VAL_SPEAR_L + 13) * sc, ux = Math.cos(P.a), uy = Math.sin(P.a), bx = P.x - ux * len, by = P.y - uy * len;
    c.save(); c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(bx + ux * len * 0.5 + 10, by + uy * len * 0.5 + 14, len * 0.5, 4, P.a, 0, Math.PI * 2); c.fill();
    c.translate(bx, by); c.rotate(P.a); c.scale(sc, sc); valSpear(c, VAL_SPEAR_L); c.restore(); // bandits.js
    drawValChain(c, bx - ux * 4, by - uy * 4, bx - ux * 30 + 4, by - uy * 30 + 16, 4, 1.4);
    c.save(); c.beginPath(); c.arc(P.px, P.py, P.pr + 1, 0, Math.PI * 2); c.clip(); csPillar(c, P.px, P.py, P.pr, true); c.restore(); // the column over the buried blade
}
// A brazier kicked over and rolling: the iron bowl tumbling, coals spilling, its fire streaming behind
function drawBrazierRoll(ef) {
    const c = ctx;
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(ef.x + 4, ef.y + 8, 20, 12, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(ef.x, ef.y); c.rotate(ef.spin);
    c.fillStyle = '#262626'; c.strokeStyle = '#0e0e0e'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 17, 11 + 5 * Math.abs(Math.sin(ef.spin)), 0, 0, Math.PI * 2); c.fill(); c.stroke();
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ff7043' : '#a33c10'; c.beginPath(); c.arc(-6 + k * 4, Math.sin(k * 2) * 4, 2.6, 0, Math.PI * 2); c.fill(); }
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, ef.x, ef.y, 60, '#ff8f00', 0.5); c.restore();
    drawFlame(c, ef.x - Math.cos(ef.a) * 8, ef.y - Math.sin(ef.a) * 8, 14, fxTime, ef.spin, 1); // bandits.js
}
// His iron crown: a dark band with seven spikes, gold studs; lying where it rolled, lifting to the hero as it's claimed
function drawIronCrown(c, x, y, s, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt); c.scale(s, s * 0.8);
    c.strokeStyle = '#141518'; c.lineWidth = 4.4; c.beginPath(); c.ellipse(0, 0, 9, 9, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#3a3d42'; c.lineWidth = 2.6; c.stroke();
    c.fillStyle = '#26292e';
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 - Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a); c.beginPath(); c.moveTo(ux * 8.5 - uy * 2.2, uy * 8.5 + ux * 2.2); c.lineTo(ux * 15, uy * 15); c.lineTo(ux * 8.5 + uy * 2.2, uy * 8.5 - ux * 2.2); c.fill(); }
    c.fillStyle = VAL_GOLD; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 - Math.PI / 2 + Math.PI / 7; c.beginPath(); c.arc(Math.cos(a) * 9, Math.sin(a) * 9, 1.5, 0, Math.PI * 2); c.fill(); }
    c.restore();
}
function drawCastleCrown() {
    const C = cst.crown, t = fxTime, k = C.claimK || 0, roll = clamp01((t - C.t0) / 0.5);
    const gx = lerp(C.x0, C.x, easeOut(roll)), gy = lerp(C.y0, C.y, easeOut(roll)) - Math.abs(Math.sin(roll * Math.PI * 2)) * 10 * (1 - roll); // it bounces as it rolls off
    const x = lerp(gx, player.x, k), bob = roll >= 1 ? Math.sin(t * 2.5) * 3 : 0, y = lerp(gy, player.y - 46, k) - bob - k * 20;
    if (roll >= 1 && k < 1) {
        const g = ctx.createLinearGradient(gx, gy - 260, gx, gy); g.addColorStop(0, 'rgba(255, 213, 79, 0)'); g.addColorStop(1, `rgba(255, 224, 130, ${0.3 * (1 - k)})`);
        ctx.fillStyle = g; ctx.fillRect(gx - 22, gy - 260, 44, 260); // a column of light over it
        ctx.strokeStyle = `rgba(255, 224, 160, ${(0.5 + 0.3 * Math.sin(t * 4)) * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(gx, gy + 4, 40, 26, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.beginPath(); ctx.ellipse(gx, gy + 6, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 55, '#ffd54f', 0.4); ctx.restore();
    drawIronCrown(ctx, x, y, 1.7 + k * 0.6, roll < 1 ? roll * 6 : Math.sin(t * 1.2) * 0.12);
}
