// ==========================================
// stage.js - Stage maps, camera, solid terrain, enemy pathing, spawn points, scripted stage events
// ==========================================
// Maps listed in STAGE_MAPS are bigger than the screen and scroll with a camera. Every other map type
// ('open', 'bridge') is still exactly the window, so the camera stays at 0,0 there and nothing changes.
// mouseX / mouseY are world coordinates: the screen-space mouse plus the camera offset.

const STAGE_MAPS = {
    // Slime Caves, stage 1: a forest clearing in front of the cave mouth (right side)
    clearing: {
        w: 2400, h: 1500,
        bounds: { left: 190, top: 175, right: 1995, bottom: 1325 },
        start: { x: 430, y: 770 },
        mouth: { x: 2035, y: 735 },
        exit: { x: 2035, y: 735 }, exitTo: { x: 2155, y: 735 }, exitR: 95, arrow: '#c6ff6b',
        prompt: 'The way is open &middot; walk into the cave to go deeper',
        cleared: { title: 'Stage Cleared', sub: 'The Clearing · Slime Caves', next: 'The caves below' },
        obstacles: [
            { x: 760, y: 470, r: 44, kind: 'boulder' }, { x: 1480, y: 420, r: 52, kind: 'boulder' },
            { x: 1730, y: 1070, r: 46, kind: 'boulder' }, { x: 1160, y: 1060, r: 38, kind: 'stump' },
            { x: 600, y: 1080, r: 34, kind: 'stump' },
        ],
    },
    // Slime Caves, stage 2: one huge cavern with lakes, ravines and rock walls (map_cavern.js builds the terrain grid)
    cavern: {
        w: 4000, h: 2800, cell: 25,
        bounds: { left: 40, top: 40, right: 3960, bottom: 2760 },
        start: { x: 300, y: 1450 },
        exit: { x: 3850, y: 1400 }, exitTo: { x: 4060, y: 1400 }, exitR: 90, arrow: '#ff80ab',
        prompt: 'The wall has crumbled &middot; follow the passage to the Queen',
        cleared: { title: 'Stage Cleared', sub: 'The Sunken Grotto · Slime Caves', next: 'The Queen\'s hive' },
        obstacles: [], grid: null,
    },
    // Slime Caves, stage 3: the Hive Queen's round throne hall (map_hive.js); the exit is wherever her crown falls
    hive: {
        w: 3200, h: 2600, cell: 25,
        bounds: { left: 40, top: 40, right: 3160, bottom: 2560 },
        start: { x: 1600, y: 2260 },
        exit: { x: 1600, y: 700 }, exitR: 60, arrow: '#ff80ab',
        throneFront: { x: 1600, y: 700 },
        prompt: 'The Queen is dead &middot; claim her crown',
        obstacles: [], grid: null,
    },
};

const camera = { x: 0, y: 0, tx: null, ty: null }; // top-left of the view in world space; tx/ty: a point to look at instead of the player
let mouseScreenX = window.innerWidth / 2, mouseScreenY = window.innerHeight / 2;
let stageEvent = null; // scripted sequence { type, t, blocking, ... }; blocking ones freeze the fight

const mapDef = () => STAGE_MAPS[currentMap.type] || null;
const worldW = () => (mapDef() ? mapDef().w : canvas.width);
const worldH = () => (mapDef() ? mapDef().h : canvas.height);

// Which map a wave is fought on
function mapTypeForWave(w) {
    if (isEndlessMode) return 'open';
    if (activeDungeonId === 'bandit_bastion' && w >= 11) return 'bridge';
    if (activeDungeonId === 'slime_caves' && w <= 5) return 'clearing';
    if (activeDungeonId === 'slime_caves' && w <= 10) return 'cavern';
    if (activeDungeonId === 'slime_caves' && w <= 15) return 'hive';
    return 'open';
}

// Switch maps; returns true when the map changed (the player is then placed at its start)
function setStageMap(type) {
    const changed = currentMap.type !== type;
    currentMap.type = type;
    if (changed && type === 'clearing') buildClearing(); // map_clearing.js
    if (changed && type === 'cavern') { buildCavern(); resetCavern(); } // map_cavern.js
    if (changed && type === 'hive') buildHive(); // map_hive.js
    updateMapBounds();
    if (changed) {
        currentMap.caveOpen = false; stageEvent = null; showStagePrompt(false);
        player.wading = false; player.fadeOut = 0; player.exitFade = 0; player.wallHit = null;
        effects.length = 0; projectiles.length = 0; // splats and shots don't follow you to the next map
        const d = mapDef();
        player.x = d ? d.start.x : canvas.width / 2; player.y = d ? d.start.y : canvas.height / 2;
        if (type === 'hive') resetHive(); // the brood pods are enemies, so they go in after the map is set
        updateNav(true);
        updateCamera(0, true);
    }
    return changed;
}

function updateCamera(dt, snap) {
    const cw = canvas.width, ch = canvas.height, W = worldW(), H = worldH();
    let fx = camera.tx !== null ? camera.tx : player.x, fy = camera.ty !== null ? camera.ty : player.y;
    if (camera.tx === null && currentMap.type === 'hive') { const q = enemies.find(e => e.onThrone && !e.dead); if (q) { fx += (q.x - fx) * 0.4; fy += (q.y - fy) * 0.4; } } // her last stand: keep the throne in view
    const tx = W <= cw ? (W - cw) / 2 : Math.max(0, Math.min(W - cw, fx - cw / 2));
    const ty = H <= ch ? (H - ch) / 2 : Math.max(0, Math.min(H - ch, fy - ch / 2));
    const k = snap ? 1 : 1 - Math.exp(-dt * (camera.tx !== null ? 3 : 10)); // cutscene pans are slower than player follow
    camera.x += (tx - camera.x) * k; camera.y += (ty - camera.y) * k;
    mouseX = mouseScreenX + camera.x; mouseY = mouseScreenY + camera.y;
}

// ---------- solid things ----------
// Circle obstacles (boulders, stalagmites) plus, on cave maps, a terrain grid:
// 0 floor, 1 wall, 2 lake (wadeable), 3 ravine (only airborne things cross), 4 sealed wall (until it breaks)

const T_FLOOR = 0, T_WALL = 1, T_LAKE = 2, T_RAVINE = 3, T_SEAL = 4;
const solidCell = (v, air) => v === T_WALL || v === T_SEAL || (v === T_RAVINE && !air);
function cellV(cx, cy) { const G = currentMap.grid; return cx < 0 || cy < 0 || cx >= G.cols || cy >= G.rows ? T_WALL : G.data[cy * G.cols + cx]; }
function terrainAt(x, y) { const G = currentMap.grid; return G ? cellV(Math.floor(x / G.cell), Math.floor(y / G.cell)) : T_FLOOR; }

// Push a moving circle out of the solid obstacles. Airborne things (leaps, a boss mid-jump) pass over boulders and ravines, never walls.
function pushOutOfObstacles(obj, radius) {
    const air = obj.airborne || (obj === player && player.z > 4);
    const obs = currentMap.obstacles;
    if (obs && !air) for (const o of obs) {
        const dx = obj.x - o.x, dy = obj.y - o.y, d = Math.hypot(dx, dy), min = o.r + radius;
        if (d < min) { const k = d > 0.01 ? 1 / d : 0; obj.x = o.x + (k ? dx * k : 1) * min; obj.y = o.y + (k ? dy * k : 0) * min; }
    }
    if (!currentMap.grid) return;
    const hit = pushOutOfTerrain(obj, radius, air);
    if (!hit || hit[2] === T_RAVINE) return;
    obj.wallHit = hit; // [x, y, cell type] of the contact; map_cavern.js turns hard hits into falling stalactites
    if (obj === player && player.dash) { // a dash that rams a wall stops there
        const d = player.dash, nx = player.x - hit[0], ny = player.y - hit[1], dl = Math.hypot(nx, ny) || 1, ux = d.x1 - d.x0, uy = d.y1 - d.y0, ul = Math.hypot(ux, uy) || 1;
        if ((nx * ux + ny * uy) / (dl * ul) < -0.45) { d.x0 = d.x1 = player.x; d.y0 = d.y1 = player.y; d.rammed = true; }
    }
    if (obj === player && player.grappleTarget) { player.grappleTarget.x = player.x; player.grappleTarget.y = player.y; player.grappleRammed = true; }
}

function pushOutOfTerrain(obj, r, air) {
    const G = currentMap.grid, cs = G.cell;
    let cx = Math.floor(obj.x / cs), cy = Math.floor(obj.y / cs), hit = null;
    if (solidCell(cellV(cx, cy), air)) { // the centre is inside rock (a blink, a spawn, a deep hit): hop to the nearest open cell
        const f = nearestOpenCell(cx, cy, air);
        if (f) { hit = [obj.x, obj.y, cellV(cx, cy)]; obj.x = Math.max(f[0] * cs + 1, Math.min(f[0] * cs + cs - 1, obj.x)); obj.y = Math.max(f[1] * cs + 1, Math.min(f[1] * cs + cs - 1, obj.y)); }
    }
    for (let pass = 0; pass < 2; pass++) {
        const x0 = Math.floor((obj.x - r) / cs), x1 = Math.floor((obj.x + r) / cs), y0 = Math.floor((obj.y - r) / cs), y1 = Math.floor((obj.y + r) / cs);
        for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
            const v = cellV(gx, gy); if (!solidCell(v, air)) continue;
            const nx = Math.max(gx * cs, Math.min(gx * cs + cs, obj.x)), ny = Math.max(gy * cs, Math.min(gy * cs + cs, obj.y));
            const dx = obj.x - nx, dy = obj.y - ny, d = Math.hypot(dx, dy);
            if (d < r && d > 0.001) { obj.x = nx + dx / d * r; obj.y = ny + dy / d * r; if (!hit || v !== T_RAVINE) hit = [nx, ny, v]; }
        }
    }
    return hit;
}

function nearestOpenCell(cx, cy, air) {
    for (let rad = 1; rad <= 14; rad++) {
        let best = null, bd = 1e9;
        for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== rad || solidCell(cellV(cx + ox, cy + oy), air)) continue;
            const d = ox * ox + oy * oy; if (d < bd) { bd = d; best = [cx + ox, cy + oy]; }
        }
        if (best) return best;
    }
    return null;
}

// Can something walk in a straight line from a to b? (walls and ravines block; lakes don't)
function walkClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 10);
    for (let i = 1; i < n; i++) { const k = i / n; if (solidCell(terrainAt(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k), false)) return false; }
    return true;
}
// Can a shot fly from a to b? (only walls block)
function shotClear(x0, y0, x1, y1) {
    if (!currentMap.grid) return true;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) { const k = i / n, v = terrainAt(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); if (v === T_WALL || v === T_SEAL) return false; }
    return true;
}
// Where a dash from a toward b has to stop short of a wall (null if the way is clear)
function clipToWalls(x0, y0, x1, y1, r, air) {
    if (!currentMap.grid) return null;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8);
    let lx = x0, ly = y0;
    for (let i = 1; i <= n; i++) {
        const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k, ux = (x1 - x0) / (d || 1) * r * 0.8, uy = (y1 - y0) / (d || 1) * r * 0.8;
        if (solidCell(terrainAt(x + ux, y + uy), true) || (!air && solidCell(terrainAt(x + ux, y + uy), false))) return [lx, ly];
        lx = x; ly = y;
    }
    return null;
}

// A shot that flies into rock ends there (with a puff). Shots that orbit, return or sit still are left alone.
function shotHitsWall(p) {
    const v = terrainAt(p.x, p.y);
    if (v !== T_WALL && v !== T_SEAL) return false;
    if (p.customUpdate || p.type === 'turret' || p.type === 'tesla_coil_trap' || p.type === 'trap_throw' || p.type === 'spore' || p.returning) return false;
    if (p.type === 'shield_throw') { p.returning = true; p.hitList = []; return false; }
    const back = Math.atan2(-p.vy, -p.vx);
    if (p.isEnemy) burst(p.x, p.y, back, 2.2, 6, { kind: 'goo', color: p.color || '#8bc34a', size: 3, speed: [40, 140], life: 0.45, drag: 4 });
    else burst(p.x, p.y, back, 2.0, 5, { kind: 'debris', color: '#6d6a66', size: 2.5, speed: [60, 180], life: 0.4, drag: 4 });
    return true;
}

// ---------- enemy pathing on cave maps: a flow field from the player, used whenever the straight line is blocked ----------

const nav = { dist: null, q: null, at: -9, cell: -1 };
function updateNav(force) {
    const G = currentMap.grid; if (!G) return;
    const cs = G.cell, pc = Math.floor(player.y / cs) * G.cols + Math.floor(player.x / cs);
    if (!force && (fxTime - nav.at < 0.15 || (pc === nav.cell && fxTime - nav.at < 0.6))) return;
    nav.at = fxTime; nav.cell = pc;
    const n = G.cols * G.rows;
    if (!nav.dist || nav.dist.length !== n) { nav.dist = new Int32Array(n); nav.q = new Int32Array(n); }
    const dist = nav.dist, q = nav.q, data = G.data, cols = G.cols; dist.fill(-1);
    let start = pc;
    if (data[start] !== T_FLOOR && data[start] !== T_LAKE) { const f = nearestOpenCell(pc % cols, Math.floor(pc / cols), false); if (!f) return; start = f[1] * cols + f[0]; }
    let head = 0, tail = 0; q[tail++] = start; dist[start] = 0;
    while (head < tail) {
        const i = q[head++], x = i % cols, dv = dist[i] + 1;
        if (x > 0 && dist[i - 1] < 0 && (data[i - 1] === 0 || data[i - 1] === 2)) { dist[i - 1] = dv; q[tail++] = i - 1; }
        if (x < cols - 1 && dist[i + 1] < 0 && (data[i + 1] === 0 || data[i + 1] === 2)) { dist[i + 1] = dv; q[tail++] = i + 1; }
        if (i >= cols && dist[i - cols] < 0 && (data[i - cols] === 0 || data[i - cols] === 2)) { dist[i - cols] = dv; q[tail++] = i - cols; }
        if (i + cols < n && dist[i + cols] < 0 && (data[i + cols] === 0 || data[i + cols] === 2)) { dist[i + cols] = dv; q[tail++] = i + cols; }
    }
}

// Returns a replacement [edx, edy] (same length as the real one) that walks around rock, or null to go straight
function navSteer(e, edx, edy, edist) {
    const G = currentMap.grid; if (!G || !nav.dist || edist === Infinity) return null;
    if (!(fxTime - (e.losAt || -9) < 0.25)) { e.losAt = fxTime; e.los = walkClear(e.x, e.y, player.x, player.y); }
    if (e.los) return null;
    const cs = G.cell, cols = G.cols, cx = Math.floor(e.x / cs), cy = Math.floor(e.y / cs), D = nav.dist;
    const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= G.rows ? -1 : D[y * cols + x]);
    let bd = at(cx, cy); if (bd < 0) bd = 1e9;
    let bx = null, by = null;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const v = at(cx + ox, cy + oy); if (v < 0 || v >= bd) continue;
        if (ox && oy && (at(cx + ox, cy) < 0 || at(cx, cy + oy) < 0)) continue; // don't cut rock corners
        bd = v; bx = (cx + ox + 0.5) * cs; by = (cy + oy + 0.5) * cs;
    }
    if (bx === null) return null;
    const dx = bx - e.x, dy = by - e.y, d = Math.hypot(dx, dy) || 1;
    return [dx / d * edist, dy / d * edist];
}

// A random walkable spot the enemies can reach, at least `minFromHero` away from the hero (null if none found)
function randomOpenSpot(minFromHero, near, clear = 40) {
    const G = currentMap.grid; if (!G) return null;
    for (let tries = 0; tries < 60; tries++) {
        const x = near ? near.x + (Math.random() - 0.5) * near.r * 2 : currentMap.left + Math.random() * (currentMap.right - currentMap.left);
        const y = near ? near.y + (Math.random() - 0.5) * near.r * 2 : currentMap.top + Math.random() * (currentMap.bottom - currentMap.top);
        const i = Math.floor(y / G.cell) * G.cols + Math.floor(x / G.cell);
        if (G.data[i] !== T_FLOOR || (nav.dist && nav.dist[i] < 0) || Math.hypot(x - player.x, y - player.y) < minFromHero) continue;
        if (solidCell(terrainAt(x + clear, y), false) || solidCell(terrainAt(x - clear, y), false) || solidCell(terrainAt(x, y + clear), false) || solidCell(terrainAt(x, y - clear), false)) continue;
        return [x, y];
    }
    return null;
}

// ---------- spawns ----------

// Where a new enemy appears: under the tree line or out of the cave mouth, never right next to the player
function pickSpawnPoint() {
    if (currentMap.type === 'cavern') return cavernSpawnPoint(); // map_cavern.js: out of the lakes and burrows
    if (currentMap.type === 'hive') return hiveSpawnPoint(); // map_hive.js: hatched from a brood pod
    const b = currentMap, d = mapDef();
    for (let tries = 0; tries < 14; tries++) {
        let x, y, from = 'forest';
        const r = Math.random();
        if (r < 0.28) { x = d.mouth.x - 60; y = d.mouth.y + (Math.random() - 0.5) * 90; from = 'cave'; }
        else if (r < 0.55) { x = b.left + 80 + Math.random() * (b.right - b.left - 300); y = b.top + 14; }
        else if (r < 0.82) { x = b.left + 80 + Math.random() * (b.right - b.left - 300); y = b.bottom - 14; }
        else { x = b.left + 14; y = b.top + 80 + Math.random() * (b.bottom - b.top - 160); }
        if (Math.hypot(x - player.x, y - player.y) > 380 || tries === 13) return { x, y, from };
    }
}

// Called for every enemy that spawnEnemy() creates
function onEnemySpawned(e) {
    if (!mapDef()) return;
    e.spawnT = e.spawnMax = 0.7; // bubble up out of the ground; AI waits until it's formed
    if (e.spawnFrom === 'cave') burst(e.x, e.y, Math.PI, 1.6, 8, { kind: 'goo', color: '#8bc34a', size: 4, speed: [60, 160], life: 0.6, drag: 3 });
    if (e.spawnFrom === 'lake') { burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'goo', color: '#5fd38d', size: 4, speed: [50, 150], life: 0.6, drag: 3 }); effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 50, color: '#69f0ae', life: 0.5, maxLife: 0.5 }); }
    if (e.spawnFrom === 'burrow') burst(e.x, e.y, e.spawnA || 0, 1.4, 8, { kind: 'debris', color: '#5d5a55', size: 3, speed: [60, 170], life: 0.5, drag: 3 });
}

// ---------- wave / stage flow ----------

// The wave's last enemy died (or a level-up after that closed)
function onWaveCleared() {
    if (mapDef() && isBossWave && !isEndlessMode) {
        if (!currentMap.caveOpen) {
            if (currentMap.type === 'cavern') startSealBreak(); // map_cavern.js: the wall gives way first
            else openStageExit();
        }
        gameState = STATE.PLAYING; lastTime = performance.now(); // walk out to finish the stage
        return;
    }
    showWaveCleared();
}

function openStageExit(color) {
    currentMap.caveOpen = true; showStagePrompt(true);
    const m = mapDef().exit;
    effects.push({ type: 'cave_open_flash', x: m.x, y: m.y, color: color || '#b2ff59', life: 1.2, maxLife: 1.2 });
}

function showStagePrompt(on) {
    const p = el('stage-prompt'), d = mapDef();
    if (on && d) p.innerHTML = `<span class="sp-arrow">&#10148;</span> ${d.prompt}`;
    p.classList.toggle('hidden', !on);
    p.classList.toggle('pink', !!(d && d.arrow === '#ff80ab'));
}

function startBossIntro(boss) {
    if (currentMap.type === 'cavern') { startAmalgamIntro(boss); return; } // map_cavern.js: it forms out of the lakes
    if (currentMap.type === 'hive') { startQueenWake(boss); return; } // map_hive.js: she wakes on her throne
    const m = mapDef().mouth;
    boss.state = 'intro'; boss.x = m.x + 110; boss.y = m.y; boss.introK = 0;
    stageEvent = { type: 'boss_intro', t: 0, boss, blocking: true, shook: 0 };
}

function startCaveExit() {
    stageEvent = { type: 'cave_exit', t: 0, blocking: true };
    showStagePrompt(false);
}

// Runs inside update() while an event is active. Blocking events skip the rest of the frame.
function updateStageEvent(dt) {
    const ev = stageEvent; ev.t += dt;
    const d = mapDef(), m = d && d.mouth;
    if (ev.type === 'boss_intro') {
        const b = ev.boss, t = ev.t;
        camera.tx = m.x - 260; camera.ty = m.y;
        if (t < 1.2 && t - ev.shook > 0.22) { // the cave rumbles, pebbles rain off the cliff
            ev.shook = t; addShake(2.5);
            for (let i = 0; i < 3; i++) spawnParticle({ kind: 'debris', color: '#8d8478', x: m.x - 10 + Math.random() * 30, y: m.y - 140 + Math.random() * 280, vx: -40 - Math.random() * 80, vy: (Math.random() - 0.5) * 60, size: 3 + Math.random() * 4, life: 0.8, drag: 2, spin: 6, rot: Math.random() * 6 });
        }
        if (t > 1.0 && !ev.card) { ev.card = true; showBossCard(BOSS_NAMES[b.type] || 'Guardian', 'Guardian of the Clearing'); }
        const k = Math.max(0, Math.min(1, (t - 1.0) / 1.5)), ease = 1 - Math.pow(1 - k, 3);
        b.x = m.x + 110 - ease * 300; b.y = m.y; b.introK = k;
        if (k >= 1 && !ev.landed) {
            ev.landed = true; addShake(6);
            burst(b.x, b.y, 0, Math.PI * 2, 18, { kind: 'goo', color: b.color, size: 5, speed: [120, 320], life: 0.7, drag: 3 });
            effects.push({ type: 'slime_shock', x: b.x, y: b.y, radius: 140, color: b.color, life: 0.5, maxLife: 0.5 });
        }
        if (t > 2.8) { camera.tx = camera.ty = null; }
        if (t > 3.3) { b.state = 'idle'; b.stateTimer = 1.2; b.introK = undefined; stageEvent = null; }
    } else if (ev.type === 'amalgam_form') updateAmalgamForm(ev, dt); // map_cavern.js
    else if (ev.type === 'seal_break') updateSealBreak(ev, dt);
    else if (ev.type === 'queen_wake') updateQueenWake(ev, dt); // map_hive.js
    else if (ev.type === 'trophy_claim') updateTrophyClaim(ev, dt);
    else if (ev.type === 'queen_throes') updateQueenThroes(ev, dt);
    else if (ev.type === 'cave_exit') {
        player.dash = null; player.grappleTarget = null;
        const [dx, dy, dd] = getVector(player.x, player.y, d.exitTo.x, d.exitTo.y);
        if (dd > 4) { player.x += dx / dd * 170 * dt; player.y += dy / dd * 170 * dt; } // the hero walks into the dark
        player.fadeOut = Math.min(1, ev.t / 0.75); // the hero melts into the shadow first, then the screen goes dark
        player.exitFade = Math.max(0, Math.min(1, (ev.t - 0.45) / 0.95));
        if (ev.t > 1.6) { stageEvent = null; showWaveCleared(d.cleared); }
    }
}

// Per-frame checks that don't block (exit trigger, cave terrain)
function updateStage(dt) {
    const d = mapDef();
    if (currentMap.grid) { updateNav(); if (currentMap.type === 'hive') updateHive(dt); else updateCavern(dt); } // map_hive.js / map_cavern.js
    if (d && currentMap.caveOpen && !stageEvent && Math.hypot(player.x - d.exit.x, player.y - d.exit.y) < d.exitR) {
        if (currentMap.type === 'hive') startTrophyClaim(); else startCaveExit();
    }
}

function showBossCard(name, kicker) {
    const b = el('wave-banner');
    b.classList.add('boss');
    b.querySelector('.wb-kicker').textContent = kicker;
    b.querySelector('.wb-title').textContent = name;
    b.querySelector('.wb-sub').textContent = '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- screen-space extras drawn after the world (vignette, pointer to the exit) ----------

function drawStageScreen() {
    const d = mapDef(); if (!d) return;
    const cw = canvas.width, ch = canvas.height, cave = currentMap.type === 'cavern' || currentMap.type === 'hive';
    const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * (cave ? 0.35 : 0.45), cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    v.addColorStop(0, 'rgba(0, 10, 0, 0)'); v.addColorStop(1, currentMap.type === 'hive' ? 'rgba(14, 0, 8, 0.6)' : cave ? 'rgba(0, 3, 8, 0.6)' : 'rgba(0, 12, 4, 0.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
    if (currentMap.caveOpen && !stageEvent) { // arrow at the screen edge pointing at the exit while it's off-screen
        const m = d.exit, sx = m.x - camera.x, sy = m.y - camera.y;
        if (sx < 40 || sx > cw - 40 || sy < 40 || sy > ch - 40) {
            const a = Math.atan2(sy - ch / 2, sx - cw / 2), px = Math.max(50, Math.min(cw - 50, sx)), py = Math.max(50, Math.min(ch - 200, sy));
            const pulse = 0.7 + 0.3 * Math.sin(fxTime * 5);
            ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.globalAlpha = pulse;
            ctx.fillStyle = d.arrow; ctx.shadowBlur = 14; ctx.shadowColor = d.arrow;
            ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
    if (player.wading) { // poisoned: a sickly green pulse at the screen edges
        const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        const rgb = currentMap.type === 'hive' ? '235, 70, 150' : '60, 220, 120'; // royal jelly is pink
        g.addColorStop(0, `rgba(${rgb}, 0)`); g.addColorStop(1, `rgba(${rgb}, ${0.22 + 0.08 * Math.sin(fxTime * 6)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    if (player.exitFade > 0) { ctx.fillStyle = `rgba(0, 0, 0, ${player.exitFade})`; ctx.fillRect(0, 0, cw, ch); }
}
