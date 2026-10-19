// ==========================================
// map_base.js - The base (BASE.md): Cinderholt freed, by day
// ==========================================
// The same village as the Bastion's first stage (map_village.js: its layout, its tree line and road, the drawing helpers
// for houses, fences, props and the palisade), the morning after. The fires are out, the barricade is gone and the gate
// stands open. The houses fared three ways (BASE_STATE): the few the bandits never reached stand whole; the ones that
// burned at the roof are damaged, scorched and holed but standing (a repair); the ones that burned to the ground are
// gone, a broken footing and a heap of charred timber on an empty lot (a rebuild). Destroyed lots are open ground.
// No waves and no enemies: the friends (npcs.js) stroll about, and skills work but hit nothing. Three houses can be
// entered (BASE_DOORS, interiors.js).
// A hero who cleared the Bastion lives here (save.js); the first time home plays the arrival (startArrival). The dev console
// walks any hero in (devVisitBase).

const BASE_ID = 'cinderholt';
function isBase() { return activeDungeonId === BASE_ID; }

STAGE_MAPS.base = {
    w: 2800, h: 1800, cell: 25,
    bounds: { left: 30, top: 30, right: 2770, bottom: 1770 },
    start: { x: 2440, y: 905 }, // just inside the east gate: home from the Bastion
    obstacles: [], grid: null,
};

// What the raid left of each house (VIL_HOUSES' states then). Renovation (BASE.md step 4) will keep its own per-house state in the save.
const BASE_STATE = { intact: 'intact', burning: 'damaged', burnt: 'destroyed' };
// The houses with a way in (interiors.js): the longhall is the town hall (the tavern, the rooms, the trophy room), the
// apothecary lives in the house with the north garden, the merchant keeps shop in the house by the pen. E at the doorstep.
const BASE_DOORS = [
    { id: 'hall', x: 1487, y: 680, label: 'Enter the tavern', to: 'tavern' },
    { id: 'apothecary', x: 887, y: 630, label: "Enter the apothecary's", to: 'apothecary' },
    { id: 'merchant', x: 2250, y: 1070, label: "Enter the merchant's", to: 'merchant' },
    { id: 'smith', x: 1400, y: 1150, label: 'Enter the smithy', to: 'smithy' }, // on the lot's north side, once his house is rebuilt
];
// Each door exists only once its building is rebuilt (rebuild.js baseDoors); until then the friend stands outside and E at the doorstep offers the rebuild.
// The smith's house burned to the ground (the lot south of the square): he waits by its ruin. His smithy is built in
// interiors.js but has no door until the house is rebuilt.
const BASE_BOARD = { x: 2475, y: 812, r: 20 }; // the noticeboard on the road's north verge just inside the gate, where the barricade stood (interiors.js: E opens the map)
const bse = { built: false, key: null, ground: null, canopy: null, view: null, houses: [], chimneys: [], forgePuff: null, raised: null };

function buildBase() {
    const key = baseBuiltKey(); // rebuild.js: a different hero or a new rebuild repaints (houses, walls, chimneys)
    if (bse.built && bse.key === key) return;
    const D = STAGE_MAPS.base;
    D.grid = baseGenerate(D);
    basePaint(D, D.grid);
    bse.built = true; bse.key = key;
}

// The hero walks into the village (main.js startGame for the base, or the dev console from any run): no waves, no enemies
function startBase() {
    const wasTraining = isTraining(); // a dev visit from the Training Room must not save its rank-1 kit over the hero
    activeDungeonId = BASE_ID;
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0; gameTimers.length = 0;
    wave = 0; isBossWave = false; enemiesToSpawn = 0; activeEnemies = 0; enemySpawnTimer = 1e9; waveBreak = 0; isEndlessMode = false;
    if (!Object.keys(player.tree).some(k => k.endsWith('_learn'))) { for (let i = 1; i <= 4; i++) player.tree[`s${i}_learn`] = true; applyTree(); } // a hero with no skill yet still gets their dash to get about
    const tp = el('training-panel'); if (tp) tp.classList.add('hidden'); // training.js
    setStageMap('base'); // stage.js: the hero at the gate
    resetDruidState(true); // druid.js: the companion at the hero's side
    placeFriends(); // rebuild.js: each friend outside their ruin, or behind their counter once it's rebuilt
    questMapChanged('base'); // sidequests.js: the clean-up above wiped the props, so the stash and wares go out again
    resetHUD(); el('wave-dungeon').textContent = 'The village'; // hud.js: the plaque's line under the name
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD();
    if (!wasTraining) baseSave(); // save.js: coming home is saved (heroData.base stays as it was)
    if (heroSlot >= 0 && !wasTraining && !heroBase().seen.arrival) startArrival(); // the first time home: the merchant meets the hero at the gate
}

// ---------- generation ----------

function baseGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), forest = new Uint8Array(n), N = cavNoise(4401), rnd = vilRng(812);
    const ctr = i => [(i % cols + 0.5) * cs, (Math.floor(i / cols) + 0.5) * cs];
    const inRect = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
    for (let i = 0; i < n; i++) { // the tree line exactly as the Bastion's village had it (the same noise)
        const [x, y] = ctr(i), z = N(x, y) - 0.5;
        let f = y < VIL_FOREST_N + z * VIL_FOREST_WOB || y > VIL_FOREST_S + z * VIL_FOREST_WOB || (x < 105 + z * 70 && Math.abs(y - vilRoadY(x)) > 90 + z * 20);
        if (x >= PAL.x1 && Math.abs(y - PAL.y) > 105 + z * 40) f = true;
        forest[i] = f ? 1 : 0;
        data[i] = f ? T_WALL : T_FLOOR;
        if (f) continue;
        VIL_HOUSES.forEach((h, k) => { if (baseHouseState(k, h[4]) !== 'destroyed' && inRect(x, y, h)) data[i] = T_WALL; }); // a lot burned to the ground is open (rebuild.js: until it's rebuilt)
        for (const t of VIL_TOWERS) if (inRect(x, y, t)) data[i] = T_WALL;
        if (x >= PAL.x0 && x < PAL.x1 && !(y >= PAL.g0 && y < PAL.g1)) data[i] = T_WALL; // the palisade, its gate open
    }
    for (const [x0, y0, x1, y1] of VIL_FENCES) {
        const gx0 = Math.floor(Math.min(x0, x1) / cs), gx1 = Math.floor((Math.max(x0, x1) - 1) / cs), gy0 = Math.floor(Math.min(y0, y1) / cs), gy1 = Math.floor((Math.max(y0, y1) - 1) / cs);
        for (let gy = y0 === y1 ? Math.floor(y0 / cs) : gy0; gy <= (y0 === y1 ? Math.floor(y0 / cs) : gy1); gy++)
            for (let gx = x0 === x1 ? Math.floor(x0 / cs) : gx0; gx <= (x0 === x1 ? Math.floor(x0 / cs) : gx1); gx++) if (data[gy * cols + gx] === T_FLOOR) data[gy * cols + gx] = T_FENCE;
    }
    const seen = new Uint8Array(n), q = [Math.floor(D.start.y / cs) * cols + Math.floor(D.start.x / cs)]; seen[q[0]] = 1; // floor nobody can reach becomes wall
    while (q.length) {
        const i = q.pop(), gx = i % cols;
        for (const j of [gx > 0 ? i - 1 : -1, gx < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < n && !seen[j] && data[j] === T_FLOOR) { seen[j] = 1; q.push(j); }
    }
    for (let i = 0; i < n; i++) if (!seen[i] && data[i] === T_FLOOR) data[i] = T_WALL;

    bse.houses = VIL_HOUSES.map(([x0, y0, x1, y1, was, side, hall], hi) => {
        const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const door = { x: side === 'w' ? x0 : side === 'e' ? x1 : cx, y: side === 'n' ? y0 : side === 's' ? y1 : cy };
        const horiz = x1 - x0 >= y1 - y0, toWorld = (lx, ly) => horiz ? [cx + lx, cy + ly] : [cx - ly, cy + lx];
        return { x0, y0, x1, y1, cx, cy, w: x1 - x0, h: y1 - y0, state: baseHouseState(hi, was), side, out, door, hall: !!hall, holes: [], embers: [], seed: rnd() * 10, horiz, toWorld,
            forge: hi === BUILDINGS.smith.house && isBuilt('smith'), // rebuild.js: the smith's house rebuilt is a smithy (slate roof, forge chimney)
            L: horiz ? x1 - x0 : y1 - y0, Sd: horiz ? y1 - y0 : x1 - x0 };
    });
    D.obstacles.length = 0;
    for (const [x, y, r, kind] of VIL_PROPS) { const seed = kind === 'hay' ? rnd() * 5 : rnd() * 10; if (Math.hypot(x - BASE_BOARD.x, y - BASE_BOARD.y) > 80) D.obstacles.push({ x, y, r, kind, seed }); } // hay seeds over 6 are drawn burnt: none here; the board stands clear of the clutter
    D.obstacles.push({ x: BASE_BOARD.x, y: BASE_BOARD.y, r: BASE_BOARD.r, kind: 'board', seed: 0 });
    for (const s of [-1, 1]) D.obstacles.push({ x: BASE_BOARD.x + s * BOARD_RX, y: BASE_BOARD.y - 6, r: 9, kind: 'board_post', seed: 0 }); // its posts: the roof is wider than the circle
    bse.chimneys = [];
    for (const h of bse.houses) {
        const [chx, chy] = h.toWorld(h.L * 0.28, -h.Sd * 0.22);
        if (h.state === 'destroyed') { // what's left on the lot: the chimney's stump and a heap of charred timber
            const [sx, sy] = h.toWorld(h.L * 0.3, -h.Sd * 0.18), [rx, ry] = h.toWorld(-h.L * 0.18, h.Sd * 0.12);
            D.obstacles.push({ x: sx, y: sy, r: 15, kind: 'stub', seed: rnd() * 10 }, { x: rx, y: ry, r: 26, kind: 'timber', seed: rnd() * 10 });
        } else if (h.forge) { // the forge's stack on the east gable, an anvil and a quench tub by the door
            const [fx, fy] = h.toWorld(h.L * 0.36, 0); bse.chimneys.push({ x: fx, y: fy, seed: h.seed, forge: true });
            D.obstacles.push({ x: h.door.x - 62, y: h.door.y - 24, r: 13, kind: 'anvil', seed: 0 }, { x: h.door.x + 64, y: h.door.y - 24, r: 12, kind: 'tub', seed: 0 });
        } else if (!h.hall && h.state === 'intact') bse.chimneys.push({ x: chx, y: chy, seed: h.seed });
    }
    return { cols, rows, cell: cs, data, forest };
}

// ---------- the cached ground and canopy ----------

function basePaint(D, G) {
    const W = D.w, H = D.h, rnd = vilRng(2716), cs = G.cell;
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const fAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows ? 1 : G.forest[gy * G.cols + gx]; };
    const floorAt = (x, y) => !fAt(x, y) && G.data[Math.floor(y / cs) * G.cols + Math.floor(x / cs)] === T_FLOOR;

    // --- green grass in the sun ---
    c.fillStyle = '#5d7a36'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
        const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 280, k = rnd(), gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, k < 0.4 ? 'rgba(52, 78, 30, 0.45)' : k < 0.75 ? 'rgba(160, 170, 80, 0.28)' : 'rgba(110, 96, 60, 0.25)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ['#6e8c3e', '#577532', '#86a04a', '#4b6a2b', '#98ae56', '#66843c'];
    c.lineWidth = 1.4;
    for (let i = 0; i < 32000; i++) {
        const x = rnd() * W, y = rnd() * H, l = 4 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
        c.strokeStyle = blades[(rnd() * blades.length) | 0]; c.globalAlpha = 0.4 + rnd() * 0.35;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 260; i++) { const x = rnd() * W, y = rnd() * H; if (!floorAt(x, y)) continue; c.fillStyle = ['#f5f1e0', '#ffe066', '#c9a0dc'][(rnd() * 3) | 0]; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 12, 1.4 + rnd(), 0, Math.PI * 2); c.fill(); } } // wildflowers
    // old ash round the houses that burned, the grass already coming back through it
    for (const h of bse.houses) if (h.state !== 'intact') {
        const r = Math.max(h.w, h.h) * (h.state === 'destroyed' ? 0.85 : 0.7), gr = c.createRadialGradient(h.cx + 10, h.cy + 10, r * 0.2, h.cx + 10, h.cy + 10, r);
        gr.addColorStop(0, 'rgba(40, 36, 30, 0.42)'); gr.addColorStop(0.6, 'rgba(60, 56, 46, 0.2)'); gr.addColorStop(1, 'rgba(60, 56, 46, 0)');
        c.fillStyle = gr; c.fillRect(h.cx - r, h.cy - r, r * 2 + 20, r * 2 + 20);
        for (let k = 0; k < 60; k++) { const a = rnd() * Math.PI * 2, d = r * (0.4 + rnd() * 0.6), x = h.cx + Math.cos(a) * d, y = h.cy + Math.sin(a) * d; c.strokeStyle = '#7a9a44'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 4); c.stroke(); }
    }
    const ga = { x: PAL.x0 + 25, y: PAL.y }, gg = c.createRadialGradient(ga.x, ga.y, 10, ga.x, ga.y, 110); // where the barricade burned
    gg.addColorStop(0, 'rgba(40, 34, 28, 0.4)'); gg.addColorStop(1, 'rgba(40, 34, 28, 0)'); c.fillStyle = gg; c.fillRect(ga.x - 110, ga.y - 110, 220, 220);

    // --- the road, through the square and out of the open gate ---
    const road = () => { c.beginPath(); c.moveTo(...VIL_ROAD[0]); for (let i = 1; i < VIL_ROAD.length - 1; i++) c.quadraticCurveTo(VIL_ROAD[i][0], VIL_ROAD[i][1], (VIL_ROAD[i][0] + VIL_ROAD[i + 1][0]) / 2, (VIL_ROAD[i][1] + VIL_ROAD[i + 1][1]) / 2); c.lineTo(...VIL_ROAD[VIL_ROAD.length - 1]); };
    for (const [w, col, a] of [[132, '#4f6230', 0.4], [106, '#6e583a', 0.8], [90, '#8a6e4c', 0.92], [42, '#93785a', 0.6], [30, '#8a6e4c', 1], [52, '#a08566', 0.35]]) { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; road(); c.stroke(); }
    c.globalAlpha = 1;
    for (let i = 0; i < 900; i++) {
        const k = rnd() * (VIL_ROAD.length - 1), s = Math.floor(k), u = k - s, [ax, ay] = VIL_ROAD[s], [bx, by] = VIL_ROAD[s + 1];
        const x = ax + (bx - ax) * u + (rnd() - 0.5) * 90, y = ay + (by - ay) * u + (rnd() - 0.5) * 80;
        c.fillStyle = rnd() < 0.5 ? 'rgba(80, 62, 42, 0.5)' : 'rgba(190, 170, 140, 0.45)';
        c.beginPath(); c.ellipse(x, y, 1 + rnd() * 2.6, 1 + rnd() * 1.8, rnd() * 3, 0, Math.PI * 2); c.fill();
    }

    // --- the square's cobbles ---
    const S = VIL_SQUARE;
    c.save(); c.translate(S.x, S.y); c.scale(1, S.ry / S.rx);
    const sq = c.createRadialGradient(0, 0, S.rx * 0.6, 0, 0, S.rx * 1.1); sq.addColorStop(0, 'rgba(96, 88, 76, 0.9)'); sq.addColorStop(1, 'rgba(96, 88, 76, 0)');
    c.fillStyle = sq; c.beginPath(); c.arc(0, 0, S.rx * 1.1, 0, Math.PI * 2); c.fill(); c.restore();
    const cob = ['#8e877b', '#968f83', '#837c71', '#9c9588', '#7c766b'];
    for (let y = S.y - S.ry; y < S.y + S.ry; y += 10) for (let x = S.x - S.rx + ((y / 10) % 2) * 6; x < S.x + S.rx; x += 11 + rnd() * 3) {
        const q = Math.hypot((x - S.x) / S.rx, (y - S.y) / S.ry); if (q > 1 || (q > 0.72 && rnd() < (q - 0.72) * 3.5) || rnd() < 0.04) continue;
        const sx = x + (rnd() - 0.5) * 2.5, sy = y + (rnd() - 0.5) * 2.5, w = 4 + rnd() * 1.8, h = 3.3 + rnd() * 1.3;
        c.fillStyle = cob[(rnd() * cob.length) | 0]; c.beginPath(); c.ellipse(sx, sy, w, h, (rnd() - 0.5) * 0.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255, 250, 235, 0.14)'; c.fillRect(sx - w * 0.5, sy - h * 0.6, w * 0.7, 1.2);
    }
    for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2, d = rnd() * 0.8; vilSoot(c, S.x + Math.cos(a) * S.rx * d, S.y + Math.sin(a) * S.ry * d, 12 + rnd() * 20); } // the last of the soot

    // --- the yards: the gardens trampled but sprouting again, the pen ---
    for (const [x0, y0, x1, y1, kind] of VIL_YARDS) {
        c.save(); c.beginPath(); c.rect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12); c.clip();
        c.fillStyle = kind === 'pen' ? '#6a5640' : '#5e4630'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (kind === 'garden') for (let y = y0 + 16; y < y1 - 6; y += 15) {
            c.strokeStyle = 'rgba(40, 28, 16, 0.5)'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (rnd() - 0.5) * 4); c.stroke();
            for (let x = x0 + 10; x < x1 - 6; x += 9 + rnd() * 6) if (rnd() < 0.6) { c.fillStyle = rnd() < 0.5 ? '#6e9a3a' : '#8bb848'; c.beginPath(); c.arc(x, y - 5, 1.6 + rnd() * 2.2, 0, Math.PI * 2); c.fill(); }
        } else for (let i = 0; i < 160; i++) { c.strokeStyle = rnd() < 0.6 ? 'rgba(230, 200, 120, 0.55)' : 'rgba(70, 52, 34, 0.4)'; c.lineWidth = 1.3; const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), a = rnd() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); c.stroke(); }
        c.restore();
    }

    // --- the forest floor, bushes along its edge ---
    c.save(); c.filter = 'blur(10px)'; c.fillStyle = '#1f3315'; c.beginPath();
    for (let i = 0; i < G.cols * G.rows; i++) if (G.forest[i]) c.rect((i % G.cols) * cs - 4, Math.floor(i / G.cols) * cs - 4, cs + 8, cs + 8);
    c.fill(); c.restore();
    const bush = (x, y, s) => {
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x + 6, y + 8, s * 1.3, s * 0.8, 0, 0, Math.PI * 2); c.fill();
        for (const [col, k] of [['#24421a', 1.15], ['#356024', 1], ['#4a7a30', 0.7]]) { c.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p * 1.2566 + x; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.5 - (1 - k) * s * 0.4, y + Math.sin(a) * s * 0.4 - (1 - k) * s * 0.4, s * 0.55 * k, 0, Math.PI * 2); c.fill(); } }
    };
    for (let i = 0; i < G.cols * G.rows; i++) {
        if (!G.forest[i] || rnd() > 0.5) continue;
        const gx = i % G.cols, gy = Math.floor(i / G.cols), x = (gx + 0.5) * cs, y = (gy + 0.5) * cs;
        if (!fAt(x + cs, y) || !fAt(x - cs, y) || !fAt(x, y + cs) || !fAt(x, y - cs)) bush(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, 11 + rnd() * 8);
    }

    // --- what the raid left lying about, fewer now: planks, a sack, a wheel ---
    for (let i = 0; i < 45; i++) {
        const x = 150 + rnd() * (PAL.x0 - 200), y = VIL_FOREST_N + 40 + rnd() * (VIL_FOREST_S - VIL_FOREST_N - 80); if (!floorAt(x, y)) continue;
        const k = rnd(); c.save(); c.translate(x, y); c.rotate(rnd() * Math.PI);
        if (k < 0.5) { c.fillStyle = rnd() < 0.3 ? '#4a3626' : '#7a5c40'; c.fillRect(-12 - rnd() * 8, -2.5, 24 + rnd() * 10, 5); c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(-8, 1, 16, 1.5); }
        else if (k < 0.7) { c.fillStyle = '#8a6e4a'; c.strokeStyle = '#3e2e1c'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
        else if (k < 0.85) { c.fillStyle = '#a06c48'; for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(rnd() * 10, rnd() * 10); c.lineTo(rnd() * 10 - 5, rnd() * 8); c.lineTo(rnd() * 6, -rnd() * 6); c.fill(); } }
        else { c.strokeStyle = '#5e4430'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke(); for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(j) * 10, Math.sin(j) * 10); c.stroke(); } }
        c.restore();
    }

    // --- fences, props, houses, the palisade with its gate open ---
    for (const f of VIL_FENCES) vilFence(c, f, rnd);
    for (const h of bse.houses) if (h.state !== 'destroyed') vilHouseShadow(c, h);
    for (const h of bse.houses) if (h.state === 'destroyed') baseRuin(c, h, rnd);
    for (const o of D.obstacles) { if (o.kind === 'board_post') continue; if (o.kind === 'stub' || o.kind === 'timber') baseRubble(c, o, rnd); else if (o.kind === 'board') baseBoard(c, o, rnd); else if (o.kind === 'anvil' || o.kind === 'tub') baseSmithProp(c, o, rnd); else vilProp(c, o, rnd); }
    for (const h of bse.houses) if (h.state !== 'destroyed') { baseHouse(c, h, rnd); if (h.forge) baseForge(c, h, rnd); }
    vilPalisade(c, rnd);
    for (const s of [-1, 1]) { // the gate's two leaves, swung wide open against the road's verges outside
        const y = PAL.y + s * 82, x = PAL.x1 + 6;
        c.fillStyle = 'rgba(8, 6, 4, 0.35)'; c.fillRect(x + 6, y - 6 + 6, 72, 13);
        c.fillStyle = '#7a5838'; c.strokeStyle = '#2a1d13'; c.lineWidth = 2; c.fillRect(x, y - 6, 72, 12); c.strokeRect(x, y - 6, 72, 12);
        c.strokeStyle = 'rgba(40, 26, 16, 0.6)'; c.lineWidth = 1; for (let k = 12; k < 72; k += 12) { c.beginPath(); c.moveTo(x + k, y - 6); c.lineTo(x + k, y + 6); c.stroke(); }
        c.fillStyle = '#37474f'; c.fillRect(x + 8, y - 6, 4, 12); c.fillRect(x + 56, y - 6, 4, 12); // iron straps
    }

    // --- the canopy: the same crowns as the village, green in the sun (a few the fire reached stay bare) ---
    const cv = cavCanvas(W, H), k = cv.getContext('2d'), crowns = [];
    for (let x = -40; x < W + 60; x += 55 + rnd() * 45) {
        const depths = x > PAL.x0 - 30 ? [95, 175, 255, 335] : [30, 110, 200, 290];
        let y = 0; while (y < H / 2 && fAt(x, y)) y += cs;
        if (y > 0) for (const dpt of depths) if (y - dpt > -80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y - dpt + rnd() * 30, r: 50 + rnd() * 34 });
        y = H; while (y > H / 2 && fAt(x, y - 1)) y -= cs;
        if (y < H) for (const dpt of depths) if (y + dpt < H + 80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y + dpt - rnd() * 30, r: 50 + rnd() * 34 });
    }
    for (let y = VIL_FOREST_N - 60; y < VIL_FOREST_S + 60; y += 55 + rnd() * 45) {
        let x = 0; while (x < 400 && fAt(x, y)) x += cs;
        if (x > 0) for (const dpt of [30, 110]) crowns.push({ x: x - dpt + rnd() * 30, y: y + (rnd() - 0.5) * 30, r: 50 + rnd() * 30 });
    }
    for (const t of crowns) {
        const sg = c.createRadialGradient(t.x + 26, t.y + 32, t.r * 0.3, t.x + 26, t.y + 32, t.r * 1.15);
        sg.addColorStop(0, 'rgba(10, 20, 6, 0.42)'); sg.addColorStop(1, 'rgba(10, 20, 6, 0)');
        c.fillStyle = sg; c.beginPath(); c.arc(t.x + 26, t.y + 32, t.r * 1.15, 0, Math.PI * 2); c.fill();
    }
    for (const t of crowns) { if (rnd() < 0.06) vilBurntCrown(k, t, rnd); else clrCrown(k, t, rnd); }
    k.globalCompositeOperation = 'source-atop'; k.fillStyle = 'rgba(255, 240, 190, 0.07)'; k.fillRect(0, 0, W, H); // sunlight on the leaves
    bse.ground = g; bse.canopy = cv;
}

// A house left standing. Intact: as it always was, smoke from the chimney (drawn live). Damaged: the roof scorched and
// holed where the fire ate through, its rafters bare in the holes, the chimney sooted, the door kicked in. A repair.
function baseHouse(c, h, rnd) {
    vilHouse(c, { ...h, state: h.state === 'intact' ? 'intact' : 'damaged', holes: [], embers: [] }, rnd); // map_village.js: the roof, the step, the door
    if (h.state === 'intact') return;
    const { L, Sd } = h, e = 7;
    c.save(); c.translate(h.cx, h.cy); if (!h.horiz) c.rotate(Math.PI / 2);
    c.beginPath(); c.rect(-L / 2 - e, -Sd / 2 - e, L + e * 2, Sd + e * 2); c.clip();
    for (let i = 0; i < 4; i++) { const x = (rnd() - 0.5) * L * 0.9, y = (rnd() - 0.5) * Sd * 0.8, r = 40 + rnd() * 40, gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(24, 16, 10, 0.5)'); gr.addColorStop(1, 'rgba(24, 16, 10, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } // soot over the roof
    const n = h.hall ? 3 : 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
        const lx = (-0.34 + 0.68 * (n === 1 ? 0.5 : i / (n - 1))) * L + (rnd() - 0.5) * 20, ly = (rnd() - 0.5) * Sd * 0.45, r = (h.hall ? 30 : 22) + rnd() * 10;
        c.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = r * (0.7 + rnd() * 0.4); c.lineTo(lx + Math.cos(a) * rr, ly + Math.sin(a) * rr * 0.8); } c.closePath();
        c.fillStyle = '#1a120c'; c.fill(); c.strokeStyle = '#2b2018'; c.lineWidth = 5; c.stroke(); c.strokeStyle = 'rgba(70, 56, 44, 0.8)'; c.lineWidth = 1.5; c.stroke(); // charred edges
        c.save(); c.clip(); c.fillStyle = 'rgba(70, 60, 48, 0.5)'; c.fillRect(lx - r, ly - r, r * 2, r * 2); c.restore(); // the floor inside, in daylight
        for (const o of [-0.45, 0, 0.4]) { c.strokeStyle = '#2a1c12'; c.lineWidth = 6; c.beginPath(); c.moveTo(lx + o * r, ly - r * 0.85); c.lineTo(lx + o * r * 0.8, ly + r * 0.85); c.stroke(); c.strokeStyle = '#6b5038'; c.lineWidth = 3.5; c.stroke(); } // bare rafters across it
    }
    c.restore();
    if (!h.hall) { // the chimney, sooted
        const [x, y] = h.toWorld(L * 0.28, -Sd * 0.22); c.fillStyle = '#5f5a52'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2; c.fillRect(x - 9, y - 9, 18, 18); c.strokeRect(x - 9, y - 9, 18, 18);
        c.fillStyle = '#0e0c0a'; c.fillRect(x - 4.5, y - 4.5, 9, 9); c.fillStyle = 'rgba(0, 0, 0, 0.4)'; c.fillRect(x - 9, y - 9, 18, 6);
    } else { // the longhall's doors, kicked out by the Warchief, lie where they fell
        const d = h.door; c.fillStyle = '#16100b'; c.fillRect(d.x - 27, d.y - 5, 54, 10);
        for (const [ox, oy, a] of [[-30, 44, -0.5], [26, 58, 0.9]]) {
            c.save(); c.translate(d.x + ox, d.y + oy); c.rotate(a);
            c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.fillRect(-13 + 4, -22 + 5, 26, 44);
            c.fillStyle = '#5e4430'; c.strokeStyle = '#1a110a'; c.lineWidth = 2; c.fillRect(-13, -22, 26, 44); c.strokeRect(-13, -22, 26, 44);
            c.strokeStyle = 'rgba(20, 12, 8, 0.6)'; c.lineWidth = 1; for (const px of [-4, 5]) { c.beginPath(); c.moveTo(px, -22); c.lineTo(px, 22); c.stroke(); }
            c.fillStyle = '#37474f'; c.fillRect(-13, -12, 26, 3); c.fillRect(-13, 9, 26, 3);
            c.restore();
        }
    }
}

// A house burned to the ground: an empty lot. A dark patch of old ash with grass growing through, the stone footing
// broken into rubble, a doorstep with nothing behind it (the chimney's stump and the timber heap are props: baseRubble)
function baseRuin(c, h, rnd) {
    const { L, Sd } = h;
    c.save(); c.translate(h.cx, h.cy); if (!h.horiz) c.rotate(Math.PI / 2);
    c.fillStyle = 'rgba(42, 38, 32, 0.6)'; c.fillRect(-L / 2, -Sd / 2, L, Sd);
    for (let i = 0; i < L * Sd / 70; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(140, 132, 120, 0.25)' : 'rgba(10, 8, 6, 0.3)'; c.fillRect(-L / 2 + rnd() * L, -Sd / 2 + rnd() * Sd, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let i = 0; i < L * Sd / 120; i++) { const x = -L / 2 + rnd() * L, y = -Sd / 2 + rnd() * Sd; c.strokeStyle = rnd() < 0.5 ? '#6e8c3e' : '#86a04a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 4); c.stroke(); } // grass through the ash
    for (let i = 0; i < 3; i++) { const x = (rnd() - 0.5) * L * 0.7, y = (rnd() - 0.5) * Sd * 0.6; c.save(); c.translate(x, y); c.rotate(rnd() * 3); c.fillStyle = '#2a2018'; c.fillRect(-18, -3, 36, 6); c.restore(); } // a charred plank or two
    const sideDoor = h.side === 'n' || h.side === 's' ? (h.horiz ? (h.side === 'n' ? 'top' : 'bottom') : (h.side === 'n' ? 'left' : 'right')) : (h.horiz ? (h.side === 'w' ? 'left' : 'right') : (h.side === 'w' ? 'bottom' : 'top'));
    const walls = { top: [-L / 2, -Sd / 2, L / 2, -Sd / 2], bottom: [-L / 2, Sd / 2, L / 2, Sd / 2], left: [-L / 2, -Sd / 2, -L / 2, Sd / 2], right: [L / 2, -Sd / 2, L / 2, Sd / 2] };
    for (const [side, [ax, ay, bx, by]] of Object.entries(walls)) { // the footing: short runs of stone, most of it tumbled
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 9) {
            const u = d / len; if (side === sideDoor && Math.abs(u - 0.5) < 18 / len) continue;
            const x = ax + (bx - ax) * u, y = ay + (by - ay) * u, k = rnd();
            if (k < 0.45) cavRock(c, x, y, 4.5 + rnd() * 2, rnd, '#7a7266');
            else if (k < 0.7) cavRock(c, x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 22, 3 + rnd() * 3, rnd, '#6d665c');
        }
    }
    c.restore();
}

// The noticeboard, where the barricade stood: seen from above it's mostly its little shingled roof between two post tops,
// the board's face a strip below the south eave with notices pinned to it, their lower ends curling out into the light
// (one is a route map: E here opens the dungeon map). A lantern hangs off the east post. The flutter and the first-time
// shimmer are live (drawBoardLive).
const BOARD_RX = 42, BOARD_NOTES = [[-31, 13, '#efe4c4'], [-18, 17, '#e3d3aa'], [0, 22, 'map'], [18, 15, '#f3ead2'], [31, 12, '#e8dcb8']]; // [x, hang length, paper]
function baseBoard(c, o, rnd) {
    const { x, y } = o, rx = BOARD_RX, top = y - 20, ridge = y - 7, eave = y + 6;
    c.save(); c.filter = 'blur(3px)'; c.fillStyle = 'rgba(8, 6, 4, 0.45)'; c.fillRect(x - rx + 8, top + 9, rx * 2 + 4, eave - top + 22); c.restore(); // its shadow to the bottom-right
    for (let i = 0; i < 3; i++) { c.save(); c.translate(x - 26 + i * 24 + rnd() * 10, y + 38 + rnd() * 8); c.rotate((rnd() - 0.5) * 1.2); c.fillStyle = 'rgba(0, 0, 0, 0.2)'; c.fillRect(-3, -2, 8, 6); c.fillStyle = '#d8c9a0'; c.fillRect(-4, -3, 8, 6); c.restore(); } // a notice or two blown down
    // the board's face below the eave: planks, then the notices
    c.fillStyle = '#7a5838'; c.strokeStyle = '#24170d'; c.lineWidth = 1.4; c.fillRect(x - rx + 3, eave - 1, rx * 2 - 6, 12); c.strokeRect(x - rx + 3, eave - 1, rx * 2 - 6, 12);
    c.strokeStyle = 'rgba(40, 24, 12, 0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - rx + 3, eave + 5); c.lineTo(x + rx - 3, eave + 5); c.stroke();
    for (const [nx, len, paper] of BOARD_NOTES) {
        const px = x + nx, map = paper === 'map', w = map ? 19 : 12, py = eave + 1;
        c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(px - w / 2 + 2, py + 2, w, len);
        c.fillStyle = map ? '#efe2b8' : paper; c.strokeStyle = 'rgba(70, 52, 30, 0.75)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px + w / 2, py); c.lineTo(px + w / 2 + 0.6, py + len - 2); c.quadraticCurveTo(px, py + len + 2, px - w / 2 - 0.6, py + len - 1); c.closePath(); c.fill(); c.stroke(); // its lower edge curling
        if (map) { // the route map: hills, woods, a red line to an X
            c.strokeStyle = 'rgba(90, 70, 40, 0.75)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px - 8, py + 7); c.lineTo(px - 5.5, py + 4.5); c.lineTo(px - 3, py + 7); c.moveTo(px + 1, py + 17); c.lineTo(px + 3.5, py + 14.5); c.lineTo(px + 6, py + 17); c.stroke();
            c.fillStyle = 'rgba(70, 110, 60, 0.6)'; c.beginPath(); c.arc(px - 6, py + 15, 2.4, 0, Math.PI * 2); c.arc(px + 6, py + 9, 2, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#b3261e'; c.lineWidth = 1.1; c.setLineDash([2, 1.4]); c.beginPath(); c.moveTo(px - 7, py + 19); c.quadraticCurveTo(px - 4, py + 9, px + 4, py + 6); c.stroke(); c.setLineDash([]);
            c.lineWidth = 1.3; c.beginPath(); c.moveTo(px + 3, py + 3); c.lineTo(px + 7, py + 7); c.moveTo(px + 7, py + 3); c.lineTo(px + 3, py + 7); c.stroke();
        } else { c.strokeStyle = 'rgba(60, 50, 40, 0.5)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(px - w / 2 + 2, py + 4); c.lineTo(px + w / 2 - 2, py + 4); for (let ly = py + 6.5; ly < py + len - 3; ly += 2.3) { c.moveTo(px - w / 2 + 2, ly); c.lineTo(px + w / 2 - 2 - rnd() * 4, ly); } c.stroke(); } // a heading, a few lines of writing
        c.fillStyle = map ? '#c62828' : '#3a2a1a'; c.beginPath(); c.arc(px, py + 1.8, map ? 1.6 : 1.2, 0, Math.PI * 2); c.fill(); // the pin
    }
    const sh = c.createLinearGradient(0, eave - 1, 0, eave + 8); sh.addColorStop(0, 'rgba(10, 6, 2, 0.6)'); sh.addColorStop(1, 'rgba(10, 6, 2, 0)'); c.fillStyle = sh; c.fillRect(x - rx + 3, eave - 1, rx * 2 - 6, 9); // the eave's shadow over the top of it all
    // the roof: two slopes of shingles, the north one in the light
    for (const s of [-1, 1]) {
        const y0 = s < 0 ? top : ridge, h = s < 0 ? ridge - top : eave - ridge, base = s < 0 ? '#8c6643' : '#583a24';
        c.save(); c.beginPath(); c.rect(x - rx, y0, rx * 2, h); c.clip();
        c.fillStyle = base; c.fillRect(x - rx, y0, rx * 2, h);
        for (let yy = 0, row = 0; yy < h; yy += 4.4, row++) { // shingle courses: each laps over the one below it, a shadow along its lower edge
            const ry = s < 0 ? ridge - yy - 4.4 : ridge + yy;
            for (let xx = -rx - (row % 2) * 4; xx < rx; xx += 8) { c.fillStyle = sprShade(base, (rnd() - 0.5) * 0.22); c.fillRect(x + xx + 0.6, ry, 7.4, 4.4); }
            c.fillStyle = 'rgba(20, 10, 4, 0.45)'; c.fillRect(x - rx, s < 0 ? ry : ry + 3.4, rx * 2, 1); // downslope is away from the ridge
            c.fillStyle = 'rgba(255, 228, 180, 0.12)'; c.fillRect(x - rx, s < 0 ? ry + 3.4 : ry, rx * 2, 0.8);
        }
        c.restore();
    }
    c.strokeStyle = '#24160c'; c.lineWidth = 2; c.strokeRect(x - rx, top, rx * 2, eave - top); // eaves
    c.fillStyle = '#3a2516'; c.fillRect(x - rx - 1, ridge - 2, rx * 2 + 2, 4); c.fillStyle = 'rgba(255, 220, 160, 0.25)'; c.fillRect(x - rx - 1, ridge - 2, rx * 2 + 2, 1); // the ridge board
    for (const s of [-1, 1]) { const px = x + s * (rx + 1); c.fillStyle = '#4a3220'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.3; c.fillRect(px - 4.5, ridge - 4.5, 9, 9); c.strokeRect(px - 4.5, ridge - 4.5, 9, 9); c.fillStyle = 'rgba(255, 220, 170, 0.25)'; c.fillRect(px - 3.8, ridge - 3.8, 7.6, 1.6); } // the two post tops
    const lx = x - rx - 10, ly = ridge + 7; // the lantern on its bracket off the west post
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - rx - 4, ridge); c.lineTo(lx, ridge); c.lineTo(lx, ly - 4); c.stroke();
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(lx - 2, ly - 1, 8, 8);
    c.fillStyle = '#ffd98a'; c.fillRect(lx - 3.5, ly - 3.5, 7, 7); c.strokeStyle = '#262422'; c.lineWidth = 1.4; c.strokeRect(lx - 3.5, ly - 3.5, 7, 7);
    c.beginPath(); c.moveTo(lx, ly - 3.5); c.lineTo(lx, ly + 3.5); c.moveTo(lx - 3.5, ly); c.lineTo(lx + 3.5, ly); c.stroke(); // its iron frame
}

// Live, on the ground layer: the map's corner lifting in the breeze, the lantern's glow, and until the board's first use a
// slow golden shimmer so the hero notices it (save.js openBoard sets seen.board)
function drawBoardLive() {
    const c = ctx, { x, y } = BASE_BOARD, t = fxTime;
    if (!cavIn(x, y, cavView(80))) return;
    const eave = y + 6, px = x, py = eave + 1, lift = 0.5 + 0.5 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1); // gusts: a flutter that comes and goes
    c.fillStyle = '#f6ecd0'; c.strokeStyle = 'rgba(70, 52, 30, 0.7)'; c.lineWidth = 0.7; // the map's lower corner curling up and over
    c.beginPath(); c.moveTo(px + 10, py + 14); c.lineTo(px + 10.5 + lift * 3.5, py + 21.5 - lift * 6); c.lineTo(px + 3 - lift * 2, py + 22.5 - lift * 3); c.closePath(); c.fill(); c.stroke();
    const fresh = heroData && !heroBase().seen.board, lx = x - BOARD_RX - 10, ly = y;
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, lx, ly, 22, '#ffcc66', 0.22 + 0.05 * Math.sin(t * 5.3) * Math.sin(t * 3.7)); // bandits.js: the lantern, faint by day
    if (fresh) { // never read: a golden shimmer over the notices and a star on the map
        glow(c, x, eave + 10, 60, '#ffe08a', 0.22 + 0.12 * Math.sin(t * 2.4));
        const ph = (t % 2.6) / 0.5;
        if (ph < 1) { const s = Math.sin(Math.PI * ph), r = 9 * s; glow(c, px + 5, py + 5, 14 * s + 2, '#fff1c8', 0.45 * s); c.translate(px + 5, py + 5); c.rotate(ph * 0.8); c.fillStyle = `rgba(255, 248, 220, ${s})`; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r); c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r); c.fill(); }
    }
    c.restore();
}

// The rebuilt smithy's stack: a broad stone chimney on the east gable, its flue glowing (the glow, smoke and sparks are live)
function baseForge(c, h, rnd) {
    const [x, y] = h.toWorld(h.L * 0.36, 0), S = 17;
    const sg = c.createRadialGradient(x, y, S, x, y, S * 2.6); sg.addColorStop(0, 'rgba(20, 16, 14, 0.45)'); sg.addColorStop(1, 'rgba(20, 16, 14, 0)'); c.fillStyle = sg; c.fillRect(x - S * 2.6, y - S * 2.6, S * 5.2, S * 5.2); // soot on the slates
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x - S + 5, y - S + 6, S * 2, S * 2);
    c.fillStyle = '#3c3935'; c.strokeStyle = '#141210'; c.lineWidth = 2; c.fillRect(x - S, y - S, S * 2, S * 2); c.strokeRect(x - S, y - S, S * 2, S * 2);
    c.save(); c.beginPath(); c.rect(x - S + 1, y - S + 1, S * 2 - 2, S * 2 - 2); c.clip();
    for (let row = 0; row < 4; row++) for (let k = -1; k < 3; k++) { // dressed stone in courses
        const bx = x - S + 1 + k * 11.3 + (row % 2) * 5.6, by = y - S + 1 + row * 8.5;
        c.fillStyle = sprShade('#5f5a53', (rnd() - 0.5) * 0.25); c.fillRect(bx, by, 10.6, 7.8);
        c.fillStyle = 'rgba(255, 245, 230, 0.16)'; c.fillRect(bx, by, 10.6, 1.2);
    }
    const soot = c.createRadialGradient(x, y, 4, x, y, S * 1.3); soot.addColorStop(0, 'rgba(10, 8, 6, 0.75)'); soot.addColorStop(1, 'rgba(10, 8, 6, 0)'); c.fillStyle = soot; c.fillRect(x - S, y - S, S * 2, S * 2); // blackened round the flue
    c.restore();
    c.fillStyle = '#3a3632'; c.fillRect(x - 10, y - 10, 20, 20); // the cap round the flue
    c.fillStyle = '#0c0807'; c.fillRect(x - 7, y - 7, 14, 14);
    c.fillStyle = 'rgba(150, 50, 16, 0.75)'; c.fillRect(x - 4.5, y - 4.5, 9, 9); c.fillStyle = 'rgba(255, 140, 50, 0.6)'; c.fillRect(x - 2.5, y - 2.5, 5, 5); // embers far down
}

// The anvil and the quench tub by the smithy's door
function baseSmithProp(c, o, rnd) {
    const { x, y } = o;
    c.fillStyle = 'rgba(8, 6, 4, 0.4)'; c.beginPath(); c.ellipse(x + 5, y + 6, o.r * 1.15, o.r * 0.85, 0, 0, Math.PI * 2); c.fill();
    if (o.kind === 'anvil') {
        c.fillStyle = '#6b4a30'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.fill(); c.stroke(); // the stump it sits on
        c.strokeStyle = 'rgba(40, 24, 12, 0.5)'; c.lineWidth = 0.8; for (const r of [4, 7.5]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
        c.save(); c.translate(x, y); c.rotate(-0.2);
        c.fillStyle = '#3a3f45'; c.strokeStyle = '#121416'; c.lineWidth = 1.5; // the anvil: face, horn to the left, heel to the right
        c.beginPath(); c.moveTo(-6, -4.5); c.lineTo(9, -4.5); c.lineTo(10, 4.5); c.lineTo(-6, 4.5); c.quadraticCurveTo(-11, 3, -16, 0.5); c.quadraticCurveTo(-11, -3, -6, -4.5); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#9aa5ae'; c.fillRect(-5, -3.2, 13.5, 2.2); c.fillStyle = '#121416'; c.fillRect(6, -1, 2, 2); // its polished face, the hardy hole
        c.strokeStyle = '#6d4c33'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(2, 9); c.lineTo(13, 13); c.stroke(); c.fillStyle = '#4a4f55'; c.fillRect(0, 6.5, 4.5, 5); // a hammer left lying
        c.restore();
    } else {
        c.fillStyle = '#5e4128'; c.strokeStyle = '#1a110a'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill(); c.stroke(); // a barrel cut down
        c.strokeStyle = '#3c454c'; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y, 10.6, 0, Math.PI * 2); c.stroke(); // its hoop
        c.fillStyle = '#1d2a2e'; c.beginPath(); c.arc(x, y, 8.6, 0, Math.PI * 2); c.fill(); // dark water
        c.fillStyle = 'rgba(190, 220, 230, 0.3)'; c.beginPath(); c.ellipse(x - 3, y - 3, 3.5, 1.4, -0.6, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#8a929a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 2, y - 8); c.lineTo(x + 10, y + 6); c.stroke(); // tongs leaning in it
    }
}

// The forge's smoke: darker and quicker than a hearth's, sparks riding up in it (live, drawBaseAbove)
function drawForgeSmoke(ch, t) {
    if (!bse.forgePuff) { bse.forgePuff = cavCanvas(96, 96); const k = bse.forgePuff.getContext('2d'), g = k.createRadialGradient(48, 48, 3, 48, 48, 48); g.addColorStop(0, 'rgba(84, 78, 76, 0.9)'); g.addColorStop(0.55, 'rgba(74, 69, 68, 0.5)'); g.addColorStop(1, 'rgba(70, 66, 66, 0)'); k.fillStyle = g; k.fillRect(0, 0, 96, 96); }
    const c = ctx, { x, y, seed } = ch;
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, 15, '#ff6a1a', 0.5 + 0.15 * Math.sin(t * 7 + seed) * Math.sin(t * 3.3)); c.restore(); // the flue's glow
    for (let i = 0; i < 7; i++) {
        const k = (t * 0.16 + i / 7 + seed) % 1, d = k * 240, r = 16 + k * 60;
        const px = x + WIND_X * d + Math.sin(t * 0.9 + i * 1.7 + seed) * 14 * k, py = y + WIND_Y * d + Math.cos(t * 0.7 + i * 2.1) * 10 * k;
        c.globalAlpha = 0.72 * Math.sin(Math.PI * Math.min(1, k * 1.2 + 0.08)); c.drawImage(bse.forgePuff, px - r, py - r, r * 2, r * 2);
    }
    c.globalAlpha = 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { // sparks: each rises, drifts downwind and winks out
        const k = (t * 0.55 + i * 0.37 + seed * 0.3) % 1, d = k * 120, wob = Math.sin(t * 6 + i * 2.3) * 6 * k;
        c.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(t * 25 + i)); c.fillStyle = k < 0.4 ? '#ffd27a' : '#ff8a2a';
        c.fillRect(x + WIND_X * d + wob + (cavHash(i + 3) - 0.5) * 8, y + WIND_Y * d - k * 12 + (cavHash(i + 9) - 0.5) * 8, 2.6, 2.6);
    }
    c.restore();
}

// What stands on a destroyed lot: the chimney's broken stump, and the heap of charred timber that was the house
function baseRubble(c, o, rnd) {
    const { x, y, r } = o;
    c.fillStyle = 'rgba(8, 6, 4, 0.35)'; c.beginPath(); c.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.85, 0, 0, Math.PI * 2); c.fill();
    if (o.kind === 'stub') {
        for (let i = 0; i < 6; i++) cavRock(c, x + (rnd() - 0.5) * r * 1.8, y + (rnd() - 0.5) * r * 1.8, 4 + rnd() * 3, rnd, '#6f6a62');
        c.fillStyle = '#625c54'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 11, y - 11); c.lineTo(x + 11, y - 11); c.lineTo(x + 11, y + 4); c.lineTo(x + 3, y + 11); c.lineTo(x - 11, y + 11); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#121010'; c.fillRect(x - 5, y - 5, 10, 10);
        return;
    }
    for (let i = 0; i < 7; i++) cavRock(c, x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r * 1.6, 4 + rnd() * 3, rnd, '#6d665c');
    for (let i = 0; i < 6; i++) { // charred beams heaped criss-cross
        const a = rnd() * Math.PI, l = r * (1.2 + rnd() * 0.6), ox = (rnd() - 0.5) * r * 0.6, oy = (rnd() - 0.5) * r * 0.6;
        c.strokeStyle = '#0f0b08'; c.lineWidth = 9; c.beginPath(); c.moveTo(x + ox - Math.cos(a) * l / 2, y + oy - Math.sin(a) * l / 2); c.lineTo(x + ox + Math.cos(a) * l / 2, y + oy + Math.sin(a) * l / 2); c.stroke();
        c.strokeStyle = i % 2 ? '#2e241c' : '#3a2e24'; c.lineWidth = 6.5; c.stroke();
        c.strokeStyle = 'rgba(150, 130, 110, 0.3)'; c.lineWidth = 1.2; c.stroke();
    }
}

// ---------- per-frame ----------

function updateBase(dt) { // stage.js updateStage
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius); // a blink can't leave the hero inside a house
    player.wallHit = null;
    updateDoorFade(dt); // interiors.js: going in through a door
}

// ---------- the arrival (base2.md): home from the Bastion, once per hero ----------
// The screen opens on the road outside the gate and the hero walks in. The merchant, out on the road by his shop, spots
// them, hurries over and stops a few steps off; they talk (npcs.js ARRIVAL_LINES, the hero answering from the right).
// Then he heads back to his shop and a banner points at the ruins. seen.arrival is set only at the very end, so a reload
// mid-scene simply plays it again.
const ARRIVE = { from: [2740, 902], to: [2445, 906], walk: 105, mFrom: [1955, 928], meet: 72, notice: 1.0, hurry: 1.6, run: 165 };
function startArrival() {
    let m = outdoorFriend('merchant'), temp = false; // rebuild.js
    if (!m) { m = addNpc('merchant', ARRIVE.mFrom[0], ARRIVE.mFrom[1], 40, 'base'); temp = true; } // his shop already rebuilt (a dev reset of the arrival only): one stands in for the scene
    m.x = ARRIVE.mFrom[0]; m.y = ARRIVE.mFrom[1]; m.target = null; m.wait = 1e9; m.facing = 0.45; // looking over at his roofless shop
    player.x = ARRIVE.from[0]; player.y = ARRIVE.from[1]; player.sceneFace = Math.PI; player.exitFade = 1; // main.js: faces where the scene says
    resetDruidState(true); // druid.js: the companion comes in alongside
    keys.w = keys.a = keys.s = keys.d = false; isMouseDown = false;
    stageEvent = { type: 'base_arrival', t: 0, blocking: true, phase: 'walk', m, temp, bangAt: null };
    camera.tx = player.x - 160; camera.ty = player.y; camera.speed = 2.2; updateCamera(0, true);
}

const turnTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k);
function updateArrival(ev, dt) { // stage.js updateStageEvent
    const m = ev.m, t = ev.t, [tx, ty] = ARRIVE.to;
    player.dash = null; player.grappleTarget = null; player.charge = null;
    player.exitFade = Math.max(0, 1 - t / 0.9); // stage.js drawStageScreen: from black, on the road outside
    const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy);
    if (d > 0.5) { // the walk in, easing to a stop
        const step = Math.min(d, ARRIVE.walk * dt * Math.min(1, 0.3 + d / 40)), sx = dx / d * step, sy = dy / d * step;
        player.x += sx; player.y += sy;
        for (const w of player.wolves || []) { w.x += sx; w.y += sy; } // druid.js: the companion keeps pace
    }
    if (t >= ARRIVE.notice && ev.bangAt === null) ev.bangAt = t; // he spots the hero (drawBaseAbove: a "!")
    const toHero = Math.atan2(player.y - m.y, player.x - m.x);
    if (ev.bangAt !== null) m.facing = turnTo(m.facing, toHero, dt * 7);
    if (ev.phase === 'walk' && t >= ARRIVE.hurry) {
        const meet = { x: player.x - ARRIVE.meet, y: player.y + 4 };
        m.speed = ARRIVE.run; m.target = meet; // re-aimed every frame: the hero is still walking in
        if (Math.hypot(meet.x - m.x, meet.y - m.y) < 10 && d < 1) { ev.phase = 'meet'; ev.mt = t; m.target = null; m.wait = 1e9; m.speed = null; }
    }
    if (t >= ARRIVE.hurry) player.sceneFace = turnTo(player.sceneFace, Math.atan2(m.y - player.y, m.x - player.x), dt * 4); // the hero turns to him
    if (ev.phase === 'meet' && t - ev.mt > 0.45) {
        ev.phase = 'talk';
        openDialogue({ name: FRIENDS.merchant.name, title: FRIENDS.merchant.title, portrait: 'merchant', lines: ARRIVAL_LINES, onClose: () => { // dialogue.js, npcs.js
            ev.phase = 'after'; ev.at = ev.t;
            m.speed = 95; m.target = { x: m.home.x, y: m.home.y }; m.wait = 1; // back to his shop, then about his usual wander there
        } });
    }
    updateNpcs(dt); // npcs.js: a blocking scene skips the usual call
    if (ev.phase === 'after' && t - ev.at > 0.7) { // the hero's free: the banner points the way
        stageEvent = null; camera.tx = camera.ty = null; camera.speed = 0; player.sceneFace = null; player.exitFade = 0;
        if (ev.temp) npcs = npcs.filter(n => n !== m); else m.speed = null; // his usual stroll from here
        heroBase().seen.arrival = true; baseSave(); // save.js
        baseBanner('Rebuild Cinderholt', 'Press E at a ruined building', 'Home again'); // rebuild.js
        return;
    }
    const lead = ev.phase === 'walk' && t < ARRIVE.hurry; // the camera: ahead of the hero coming in, then framing the two of them
    camera.tx = lead ? player.x - 160 : (player.x + m.x) / 2; camera.ty = lead ? player.y : (player.y + m.y) / 2;
}

// ---------- a building rebuilt (rebuild.js applyBuilt, at the fade's dark point) ----------
// When the fade lifts, dust rolls off the new walls, a few shavings drift down off the roof and warm light sweeps across it
function baseRaised(id) {
    const h = bse.houses[BUILDINGS[id].house]; if (!h) return;
    bse.raised = { h, t0: fxTime };
    const per = (h.w + h.h) * 2;
    for (let i = 0; i < 26; i++) { // dust round the footing, rolling outward
        let u = Math.random() * per, x, y, nx = 0, ny = 0;
        if (u < h.w) { x = h.x0 + u; y = h.y0 - 6; ny = -1; } else if ((u -= h.w) < h.h) { x = h.x1 + 6; y = h.y0 + u; nx = 1; } else if ((u -= h.h) < h.w) { x = h.x0 + u; y = h.y1 + 6; ny = 1; } else { x = h.x0 - 6; y = h.y0 + u - h.w; nx = -1; }
        const sp = 30 + Math.random() * 50;
        spawnParticle({ kind: 'smoke', color: Math.random() < 0.5 ? '#cbbd9e' : '#b3a589', x, y, vx: nx * sp + (Math.random() - 0.5) * 20, vy: ny * sp + (Math.random() - 0.5) * 20, size: 7 + Math.random() * 6, grow: 26, life: 1.3 + Math.random() * 0.6, drag: 1.4, spin: 0, rot: 0 });
    }
    for (let i = 0; i < 14; i++) spawnParticle({ kind: 'leaf', color: Math.random() < 0.5 ? '#e8c992' : '#d6b073', x: h.x0 + Math.random() * h.w, y: h.y0 + Math.random() * h.h, vx: WIND_X * 30 + (Math.random() - 0.5) * 30, vy: WIND_Y * 20 + (Math.random() - 0.5) * 30, size: 4 + Math.random() * 2, grow: 0, life: 1.8 + Math.random() * 0.8, drag: 0.6, spin: (Math.random() - 0.5) * 8, rot: Math.random() * 6 }); // wood shavings on the breeze
}
function drawRaised() { // drawBaseAbove, under the canopy
    const R = bse.raised, t = fxTime - R.t0, T = 1.7;
    if (t > T) { bse.raised = null; return; }
    const h = R.h, e = 8, k = t / T, fade = Math.sin(Math.PI * Math.min(1, k * 1.15)), c = ctx;
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, h.cx, h.cy, Math.max(h.w, h.h) * 0.85, '#ffd98a', 0.2 * fade); // bandits.js
    c.beginPath(); c.rect(h.x0 - e, h.y0 - e, h.w + e * 2, h.h + e * 2); c.clip();
    const span = h.w + h.h, s = -0.25 + k * 1.5, bx = h.x0 - e + span * s, g = c.createLinearGradient(bx - 60, h.y0 - e, bx + 60 - h.h * 0.6, h.y1 + e); // a band of light crossing the new roof
    g.addColorStop(0, 'rgba(255, 226, 160, 0)'); g.addColorStop(0.5, `rgba(255, 226, 160, ${0.32 * fade})`); g.addColorStop(1, 'rgba(255, 226, 160, 0)');
    c.fillStyle = g; c.fillRect(h.x0 - e, h.y0 - e, h.w + e * 2, h.h + e * 2);
    c.restore();
}

// Under the hero (main.js draw): the cached ground
function drawBaseGround() {
    const W = bse.ground.width, H = bse.ground.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, Math.ceil(viewW()) + 42), sh = Math.min(H - sy, Math.ceil(viewH()) + 42);
    ctx.drawImage(bse.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    drawBoardLive();
}

// Above everyone: chimney smoke from the houses people live in (the forge's darker, with sparks), a rebuild's light, the
// canopy (see-through round the hero), seeds on the breeze
function drawBaseAbove() {
    const c = ctx, t = fxTime, V = cavView(500);
    for (const ch of bse.chimneys) if (cavIn(ch.x + 150, ch.y - 120, V)) { if (ch.forge) drawForgeSmoke(ch, t); else drawSmokeColumn(ch.x, ch.y, t, ch.seed, 0.6, 0.38); } // map_village.js
    if (bse.raised) drawRaised();
    const ev = stageEvent && stageEvent.type === 'base_arrival' ? stageEvent : null;
    if (ev && ev.bangAt !== null && ev.t - ev.bangAt < 1.2) { // the merchant spots the hero: a "!" pops over him
        const k = ev.t - ev.bangAt, pop = k < 0.12 ? k / 0.12 * 1.3 : k < 0.22 ? 1.3 - (k - 0.12) / 0.1 * 0.3 : 1, x = ev.m.x, y = ev.m.y - 36;
        c.save(); c.globalAlpha = k > 0.9 ? 1 - (k - 0.9) / 0.3 : 1; c.translate(x, y); c.scale(pop, pop);
        c.fillStyle = 'rgba(18, 12, 8, 0.85)'; c.strokeStyle = '#e6c46a'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-8, -11, 16, 20, 5); c.fill(); c.stroke();
        c.fillStyle = '#ffe9a8'; c.font = 'bold 15px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 0);
        c.restore();
    }
    const cw = Math.ceil(viewW()), chh = Math.ceil(viewH()), cx = Math.floor(camera.x), cy = Math.floor(camera.y);
    if (player.y > 470 && player.y < 1330 && player.x > 400 && player.x < PAL.x0 - 100) { const sx = Math.max(0, cx), sy = Math.max(0, cy); c.drawImage(bse.canopy, sx, sy, cw, chh, sx, sy, cw, chh); }
    else {
        if (!bse.view || bse.view.width !== cw || bse.view.height !== chh) bse.view = cavCanvas(cw, chh);
        const v = bse.view.getContext('2d');
        v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, cw, chh);
        v.drawImage(bse.canopy, Math.max(0, cx), Math.max(0, cy), cw, chh, Math.max(0, -cx), Math.max(0, -cy), cw, chh);
        const px = player.x - cx, py = player.y - cy, hole = v.createRadialGradient(px, py, 30, px, py, 120);
        hole.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
        v.globalCompositeOperation = 'destination-out'; v.fillStyle = hole; v.fillRect(px - 120, py - 120, 240, 240);
        c.drawImage(bse.view, cx, cy);
    }
    const tx0 = Math.floor(player.x / 200), ty0 = Math.floor(player.y / 200); // thistledown drifting by, slower than the ash was
    c.fillStyle = '#fbf8ee';
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 3; tx <= tx0 + 3; tx++) {
        const hsh = tx * 73 + ty * 151, x = tx * 200 + ((cavHash(hsh) * 200 + t * 14 * (0.6 + cavHash(hsh + 2))) % 200 + 200) % 200, y = ty * 200 + ((cavHash(hsh + 5) * 200 + Math.sin(t * 0.8 + hsh) * 12 - t * 5) % 200 + 200) % 200;
        c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 1.5 + hsh); c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    drawInteractPrompt(); // interiors.js: E at a door or a friend
}
