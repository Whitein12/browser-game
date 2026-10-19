// ==========================================
// caches.js - Materials (wood, iron, stone) and the supply caches hidden in the dungeons (base2.md, BASE.md step 4)
// ==========================================
// Rebuilding Cinderholt (rebuild.js) costs gold plus materials the hero finds by being thorough: each dungeon map hides a
// few breakable caches (any hit opens one, like a powder keg) that give their materials once per hero (`cacheFound`).
// A cache is an enemy of type 'supply_cache' with `pod` and `prop` set, so every keg / brood pod exclusion applies: nothing
// targets it, it never counts toward the wave, AI and knockbacks skip it, and a map change clears it. Only a saved hero
// finds them (not Quick Play, the Training Room or Limitless). save.js heroSnapshot / applyHero carry `mats` and `found`.
// Art: three kinds baked once each (cacheSprite): a rope-tied bundle of planks, an iron-banded crate with ingots showing
// through a missing lid plank, a burlap sack beside cut stone blocks. A star twinkles on each now and then; on the dark maps
// a small warm light (cacheLights, called from each map's darkness) keeps them from vanishing. Broken, it splinters by kind
// and the materials fly to the hero as chips, a "+14 Wood" line per material (MAT_FX, drawn above everything).

const MAT_KEYS = ['wood', 'iron', 'stone'], MAT_NAMES = { wood: 'Wood', iron: 'Iron', stone: 'Stone' }, MAT_COLORS = { wood: '#c8955a', iron: '#9fb4c4', stone: '#bdbdb4' };
let mats = { wood: 0, iron: 0, stone: 0 }, cacheFound = {};

// Hand-placed in out-of-the-way open spots: dead ends, nooks off the main paths, corners. `kind` picks the art, `give` what it holds.
// Slime Caves total: stone ~60, wood ~15, iron ~10. Bandit Bastion: wood ~100, iron ~55, stone ~15.
const CACHES = {
    clearing: [
        { id: 'clr1', x: 1820, y: 350, kind: 'stone', give: { stone: 8 } },
        { id: 'clr2', x: 360, y: 1160, kind: 'wood', give: { wood: 5, stone: 3 } },
        { id: 'clr3', x: 1450, y: 1190, kind: 'stone', give: { stone: 7 } },
    ],
    cavern: [
        { id: 'cav1', x: 1560, y: 230, kind: 'stone', give: { stone: 10 } },
        { id: 'cav2', x: 3200, y: 320, kind: 'iron', give: { iron: 5, stone: 4 } },
        { id: 'cav3', x: 720, y: 2540, kind: 'stone', give: { stone: 9 } },
    ],
    hive: [
        { id: 'hiv1', x: 400, y: 1450, kind: 'stone', give: { stone: 13 } },
        { id: 'hiv2', x: 2800, y: 1300, kind: 'wood', give: { wood: 10 } },
        { id: 'hiv3', x: 900, y: 2050, kind: 'iron', give: { iron: 5, stone: 5 } },
    ],
    village: [
        { id: 'vil1', x: 300, y: 620, kind: 'wood', give: { wood: 14 } },
        { id: 'vil2', x: 1700, y: 1420, kind: 'wood', give: { wood: 12, stone: 3 } },
        { id: 'vil3', x: 1900, y: 360, kind: 'iron', give: { iron: 6, wood: 6 } },
    ],
    trail: [
        { id: 'trl1', x: 330, y: 1080, kind: 'wood', give: { wood: 14 } },
        { id: 'trl2', x: 2300, y: 350, kind: 'iron', give: { iron: 8, wood: 6 } },
        { id: 'trl3', x: 2900, y: 1440, kind: 'wood', give: { wood: 12, iron: 4, stone: 4 } },
        { id: 'trl4', x: 4100, y: 480, kind: 'iron', give: { iron: 8, wood: 8 } },
    ],
    bridge: [
        { id: 'brg1', x: 3400, y: 880, kind: 'iron', give: { iron: 8, wood: 4 } },
    ],
    castle: [
        { id: 'cst1', x: 560, y: 1450, kind: 'iron', give: { iron: 8, wood: 6 } },
        { id: 'cst2', x: 1250, y: 320, kind: 'wood', give: { wood: 6, iron: 4, stone: 4 } },
        { id: 'cst3', x: 3380, y: 520, kind: 'iron', give: { iron: 6, stone: 4 } },
        { id: 'cst4', x: 6280, y: 520, kind: 'wood', give: { wood: 10, iron: 4, stone: 4 } },
    ],
};
const CACHE_R = 14;
let cacheObs = []; // { list, obs, def }: the circle obstacle of every cache placed, so a stale one can be taken out of its map

function resetMats() { mats = { wood: 0, iron: 0, stone: 0 }; cacheFound = {}; } // main.js startGame, before applyHero
function applyMats(h) { // save.js applyHero: old saves have none
    mats = { wood: 0, iron: 0, stone: 0, ...(h.mats || {}) }; cacheFound = { ...(h.found || {}) };
}
const matsLine = () => MAT_KEYS.map(k => `${MAT_NAMES[k]} ${mats[k]}`).join(' · '); // hud.js plaque in the village
const matsHtml = () => MAT_KEYS.map(k => `<span class="mat-chip" title="${MAT_NAMES[k]}">${matImg(k)}${mats[k]}</span>`).join(''); // icons.js: the same, with icons

const cacheAlive = c => c.ent && !c.ent.dead && enemies.includes(c.ent);

// stage.js setStageMap (a map change) and main.js startNextWave: drop stale obstacles, then put the unfound caches of this map out
function placeCaches(type) {
    cacheObs = cacheObs.filter(o => { if (cacheAlive(o.def)) return true; const i = o.list.indexOf(o.obs); if (i >= 0) o.list.splice(i, 1); return false; });
    const list = CACHES[type];
    if (!list || heroSlot < 0 || isTraining() || isEndlessMode || isBase() || isInterior(type) || !currentMap.obstacles) return;
    for (const c of list) {
        if (cacheFound[c.id] || cacheAlive(c)) continue;
        const e = { type: 'supply_cache', pod: c, prop: true, x: c.x, y: c.y, size: 28, color: MAT_COLORS[c.kind], hp: 1, maxHp: 1, xp: 0, dmg: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: 0, seed: Math.random() * 10, bornAt: fxTime };
        c.ent = e; enemies.push(e);
        const obs = { x: c.x, y: c.y, r: CACHE_R, kind: 'cache' };
        currentMap.obstacles.push(obs); cacheObs.push({ list: currentMap.obstacles, obs, def: c });
    }
}

// combat.js checkEnemyDeath: a cache was hit. The materials go in the pack, a line floats up for each, and it splinters.
function cacheBroken(e) {
    if (e.dead) return;
    e.dead = true; dmgPending.delete(e); // fx.js: no damage number over the pickup lines
    const c = e.pod; c.ent = null; if (!c.quest) cacheFound[c.id] = true; // a quest cache (sidequests.js) gives no materials and is not "found" for good
    const o = cacheObs.find(o => o.def === c); if (o) { const i = o.list.indexOf(o.obs); if (i >= 0) o.list.splice(i, 1); cacheObs.splice(cacheObs.indexOf(o), 1); }
    let n = 0; const lines = MAT_KEYS.filter(k => c.give[k] > 0).length;
    for (const k of MAT_KEYS) {
        const v = c.give[k] || 0; if (!v) continue;
        mats[k] += v;
        const t0 = fxTime + n * 0.12;
        MAT_FX.push({ text: `+${v} ${MAT_NAMES[k]}`, k, x: e.x, y: e.y - 34 - (lines - 1 - n) * 21, t0 }); // the pickup lines, top to bottom, staggered
        for (let i = 0, m = Math.min(5, Math.ceil(v / 3)); i < m; i++) { // chips: scatter out, then home in on the hero
            const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 30;
            MAT_FX.push({ chip: true, k, x: e.x, y: e.y, sx: e.x + Math.cos(a) * d, sy: e.y + Math.sin(a) * d * 0.8, t0: fxTime + n * 0.08 + i * 0.05, rot: Math.random() * 6 });
        }
        n++;
    }
    if (c.quest) { questItemFx(e, c.quest); questCacheBroken(c); } // sidequests_fx.js: picked up, not splintered; sidequests.js: the stash opened, the item found
    else cacheBreakFx(e.x, e.y, c.kind);
    updateHUD();
}

// The cache coming apart: what it was made of flies off, dust, a soft knock
function cacheBreakFx(x, y, kind) {
    const deb = (cols, n, size, sp) => { for (const col of cols) burst(x, y, 0, Math.PI * 2, n, { kind: 'debris', color: col, size, speed: sp, life: 0.8, drag: 3.2 }); };
    addShake(2);
    spawnParticle({ kind: 'ring', color: '#fff3d6', x, y, vx: 0, vy: 0, size: 8, grow: 190, life: 0.26, drag: 0, spin: 0, rot: 0 });
    burst(x, y, 0, Math.PI * 2, 6, { kind: 'dot', color: '#fff3d6', size: 2.4, speed: [60, 160], life: 0.3 });
    if (kind === 'wood') {
        deb(['#a8743f', '#c39257', '#7a5232'], 5, 5.5, [110, 320]); // splinters
        burst(x, y, -Math.PI / 2, Math.PI * 1.6, 6, { kind: 'leaf', color: '#e6c48a', size: 6, speed: [60, 170], life: 1.0, drag: 2.5 }); // curled shavings
        deb(['#d8c08a'], 3, 3.5, [60, 180]); // rope ends
        dustPuff(x, y, 0, Math.PI * 2, 5, '#a08a6a');
    } else if (kind === 'iron') {
        deb(['#7a5634', '#5e4128'], 5, 5.5, [110, 300]); // the crate's boards
        deb(['#8ea3b3', '#56687a'], 4, 4, [140, 340]); // bits of iron band
        burst(x, y, 0, Math.PI * 2, 9, { kind: 'spark', color: '#ffe3a8', size: 2, speed: [200, 420], life: 0.22, drag: 6 }); // iron rings out
        dustPuff(x, y, 0, Math.PI * 2, 4, '#8d8478');
    } else {
        deb(['#c9c8bf', '#9a998f', '#7d7c74'], 5, 5, [90, 280]); // stone chips
        deb(['#b59b6e'], 4, 3.5, [70, 200]); // burlap scraps
        dustPuff(x, y, 0, Math.PI * 2, 8, '#a9a69c');
    }
}

// Flying chips and pickup lines (main.js draw, after the damage numbers). Timed on fxTime, so they pause with the game.
const MAT_FX = [], MAT_CHIP_OUT = 0.22, MAT_CHIP_IN = 0.42, MAT_LINE = 1.9;
function drawMatFx() {
    if (!MAT_FX.length) return;
    const c = ctx; c.save(); c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = 'bold 15px Georgia, serif'; // left: a draw before may leave it centred, which put the text over its icon
    for (let i = MAT_FX.length - 1; i >= 0; i--) {
        const f = MAT_FX[i], t = fxTime - f.t0;
        if (t < 0) continue;
        if (f.chip) {
            if (t > MAT_CHIP_OUT + MAT_CHIP_IN) { MAT_FX.splice(i, 1); spawnParticle({ kind: 'dot', color: f.icon ? '#ffe39a' : MAT_COLORS[f.k], x: player.x, y: player.y - 6, vx: 0, vy: -40, size: 3, life: 0.25, drag: 2, grow: 0, spin: 0, rot: 0 }); continue; }
            let x, y, s = 1;
            if (t < MAT_CHIP_OUT) { const u = t / MAT_CHIP_OUT, e = 1 - (1 - u) * (1 - u); x = f.x + (f.sx - f.x) * e; y = f.y + (f.sy - f.y) * e - Math.sin(Math.PI * u) * 16; } // popped out with a hop
            else { const u = (t - MAT_CHIP_OUT) / MAT_CHIP_IN, e = u * u; x = f.sx + (player.x - f.sx) * e; y = f.sy + (player.y - 8 - f.sy) * e; s = 1 - 0.4 * e; } // drawn in, speeding up
            const z = f.big ? 13 : 7; // sidequests_fx.js: a quest item or a ware flies in whole, upright
            c.save(); c.translate(x, y); if (!f.big) c.rotate(f.rot + t * 9); c.drawImage(f.icon || matIconCanvas(f.k), -z * s, -z * s, z * 2 * s, z * 2 * s); c.restore(); // icons.js
            continue;
        }
        if (t > MAT_LINE) { MAT_FX.splice(i, 1); continue; }
        const k = t / MAT_LINE, pop = t < 0.14 ? 1.3 - 0.3 * (t / 0.14) : 1, y = f.y - 26 * Math.sqrt(k);
        c.globalAlpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
        const w = c.measureText(f.text).width, x0 = f.x - (w + 20) / 2;
        c.save(); c.translate(f.x, y); c.scale(pop, pop); c.translate(-f.x, -y);
        if (f.icon) c.drawImage(f.icon, x0 - 6, y - 13, 26, 26); // a quest line brings its own icon (padded, so a little larger) and colour (sidequests.js questLine)
        else c.drawImage(matIconCanvas(f.k), x0 - 2, y - 9, 18, 18);
        c.fillStyle = 'rgba(0, 0, 0, 0.75)'; c.fillText(f.text, x0 + 20 + 1, y + 1.5);
        c.fillStyle = f.color || MAT_COLORS[f.k]; c.fillText(f.text, x0 + 20, y);
        c.restore();
    }
    c.restore();
}

// ---------- the art ----------

const CACHE_SPR = {}, CACHE_S = 2, CACHE_HALF = 28, CACHE_DRAW = 1.15; // baked at 2x, drawn a little larger than painted (a 28 px prop was easy to walk past)
const CACHE_GLINT = { wood: [10, -14], iron: [-1, 1], stone: [9, -11] }; // where the star twinkles: the rope's knot, an ingot, a block's corner
const CACHE_DARK = { cavern: 1, hive: 1, castle: 1, village: 1 }; // maps under a darkness layer: the cache gets a little light

function cacheSprite(kind) {
    if (CACHE_SPR[kind]) return CACHE_SPR[kind];
    const cv = cavCanvas(CACHE_HALF * 2 * CACHE_S, CACHE_HALF * 2 * CACHE_S), c = cv.getContext('2d'), rnd = clrRng(kind.length * 977);
    c.scale(CACHE_S, CACHE_S); c.translate(CACHE_HALF, CACHE_HALF); c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.filter = 'blur(2px)'; c.fillStyle = 'rgba(6, 4, 2, 0.4)'; c.beginPath(); c.ellipse(4, 5, kind === 'stone' ? 19 : 18, 14, 0, 0, Math.PI * 2); c.fill(); c.restore(); // shadow to the bottom-right
    const OUT = '#24170d';
    if (kind === 'wood') { // a bundle of planks, tied with two rope bands
        c.rotate(-0.22);
        const tones = ['#a06d3c', '#c39257', '#946336', '#bd8a50', '#a8743f'];
        for (let i = 0; i < 5; i++) {
            const y = (i - 2) * 5.2, L = 31 + rnd() * 6, dx = (rnd() - 0.5) * 4;
            c.fillStyle = tones[i]; c.strokeStyle = OUT; c.lineWidth = 1.1; c.fillRect(-L / 2 + dx, y - 2.6, L, 5.2); c.strokeRect(-L / 2 + dx, y - 2.6, L, 5.2);
            c.fillStyle = 'rgba(255, 232, 186, 0.28)'; c.fillRect(-L / 2 + dx + 1, y - 2.2, L - 2, 1.1); // the lit edge
            c.strokeStyle = 'rgba(64, 38, 16, 0.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-L / 2 + dx + 3, y + 0.3); c.quadraticCurveTo(dx, y + 1.4 * (rnd() - 0.5), L / 2 + dx - 3, y + 0.6); c.stroke(); // grain
            if (rnd() < 0.5) { c.fillStyle = 'rgba(60, 34, 14, 0.6)'; c.beginPath(); c.ellipse(dx + (rnd() - 0.5) * L * 0.6, y, 1.4, 0.9, 0, 0, Math.PI * 2); c.fill(); } // a knot
            c.fillStyle = 'rgba(40, 22, 8, 0.35)'; c.fillRect(L / 2 + dx - 1.6, y - 2.6, 1.6, 5.2); // the sawn end
        }
        for (const x of [-8, 9]) { // rope bands, twisted
            c.fillStyle = '#d8c08a'; c.strokeStyle = '#4e3a1c'; c.lineWidth = 0.9; c.fillRect(x - 1.7, -14, 3.4, 28); c.strokeRect(x - 1.7, -14, 3.4, 28);
            c.strokeStyle = 'rgba(110, 82, 40, 0.75)'; c.lineWidth = 0.7; c.beginPath(); for (let y = -13; y < 13; y += 2.4) { c.moveTo(x - 1.7, y); c.lineTo(x + 1.7, y + 1.6); } c.stroke();
        }
        c.fillStyle = '#d8c08a'; c.strokeStyle = '#4e3a1c'; c.lineWidth = 0.9; c.beginPath(); c.arc(9, -13.5, 2.6, 0, Math.PI * 2); c.fill(); c.stroke(); // the knot
        c.strokeStyle = '#d8c08a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(10.5, -12); c.quadraticCurveTo(15, -11, 15.5, -6); c.stroke(); // its loose end
    } else if (kind === 'iron') { // an iron-banded crate, a lid plank gone: ingots inside
        c.rotate(0.14);
        const S = 13;
        c.fillStyle = '#6e4d2e'; c.strokeStyle = OUT; c.lineWidth = 1.4; c.fillRect(-S, -S, S * 2, S * 2); c.strokeRect(-S, -S, S * 2, S * 2);
        for (let i = 0; i < 4; i++) { // lid planks; the third one missing
            const y = -S + i * 6.5;
            if (i === 2) {
                c.fillStyle = '#140d08'; c.fillRect(-S + 1, y, S * 2 - 2, 6.5);
                for (const ix of [-8.5, -1.5, 5.5]) { // ingots lying in the dark
                    c.fillStyle = '#56687a'; c.fillRect(ix, y + 1.2, 6, 4.4); c.fillStyle = '#9fb4c4'; c.fillRect(ix + 0.6, y + 1.2, 4.8, 2.6);
                    c.fillStyle = 'rgba(236, 244, 250, 0.85)'; c.fillRect(ix + 1, y + 1.5, 3.6, 0.8); c.strokeStyle = '#1e2830'; c.lineWidth = 0.6; c.strokeRect(ix, y + 1.2, 6, 4.4);
                }
                continue;
            }
            c.fillStyle = sprShade('#8a6440', (rnd() - 0.5) * 0.18); c.fillRect(-S + 1, y + 0.5, S * 2 - 2, 5.5);
            c.fillStyle = 'rgba(255, 230, 190, 0.18)'; c.fillRect(-S + 1, y + 0.5, S * 2 - 2, 1);
            c.strokeStyle = 'rgba(50, 30, 14, 0.4)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-S + 3, y + 3.5); c.lineTo(S - 3, y + 3 + (rnd() - 0.5)); c.stroke();
        }
        for (const x of [-7.5, 7.5]) { // the iron bands over the lid, riveted at each plank
            c.fillStyle = '#4a545c'; c.fillRect(x - 2, -S, 4, S * 2); c.fillStyle = '#8a969e'; c.fillRect(x - 2, -S, 1, S * 2);
            c.strokeStyle = '#161a1e'; c.lineWidth = 0.8; c.strokeRect(x - 2, -S, 4, S * 2);
            c.fillStyle = '#c4ccd2'; for (let i = 0; i < 4; i++) if (i !== 2) { c.beginPath(); c.arc(x, -S + i * 6.5 + 3.2, 0.9, 0, Math.PI * 2); c.fill(); }
        }
        c.fillStyle = '#3c454c'; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillRect(sx * S - (sx > 0 ? 4 : 0), sy * S - (sy > 0 ? 1.5 : 0), 4, 1.5); c.fillRect(sx * S - (sx > 0 ? 1.5 : 0), sy * S - (sy > 0 ? 4 : 0), 1.5, 4); } // corner brackets
    } else { // a burlap sack, tied at the neck, beside cut stone blocks
        const block = (x, y, w, h, a) => {
            c.save(); c.translate(x, y); c.rotate(a);
            c.fillStyle = '#c4c3ba'; c.strokeStyle = '#2e2d29'; c.lineWidth = 1.1; c.fillRect(-w / 2, -h / 2, w, h); c.strokeRect(-w / 2, -h / 2, w, h);
            c.fillStyle = '#ecebe3'; c.fillRect(-w / 2 + 0.6, -h / 2 + 0.6, w - 1.2, 1.4); c.fillRect(-w / 2 + 0.6, -h / 2 + 0.6, 1.4, h - 1.2); // the lit bevel
            c.fillStyle = '#7d7c74'; c.fillRect(-w / 2 + 0.6, h / 2 - 2, w - 1.2, 1.4); c.fillRect(w / 2 - 2, -h / 2 + 0.6, 1.4, h - 1.2); // the shaded one
            c.strokeStyle = 'rgba(70, 68, 62, 0.5)'; c.lineWidth = 0.6; c.beginPath(); for (let i = 0; i < 3; i++) { const yy = -h / 4 + i * h / 4; c.moveTo(-w / 3, yy); c.lineTo(-w / 3 + 3, yy - 0.6); } c.stroke(); // chisel marks
            c.restore();
        };
        block(12, 8, 12, 10, 0.18); block(14, -6, 10, 9, -0.32);
        c.save(); c.translate(-3, 1); c.rotate(-0.55); // the sack lying on its side, its tied neck to the upper left
        const lump = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; lump.push([3 + Math.cos(a) * 11.5 * (0.92 + rnd() * 0.14), Math.sin(a) * 10 * (0.92 + rnd() * 0.14)]); }
        const bodyPath = () => { c.beginPath(); lump.forEach(([x, y], i) => { const [nx, ny] = lump[(i + 1) % 12]; if (!i) c.moveTo((x + lump[11][0]) / 2, (y + lump[11][1]) / 2); c.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); }); c.closePath(); };
        c.beginPath(); c.moveTo(-6, -6.5); c.quadraticCurveTo(-10, -3, -13, -2.6); c.lineTo(-13, 2.6); c.quadraticCurveTo(-10, 3, -6, 6.5); c.closePath(); // the neck, gathered in
        c.fillStyle = '#b39867'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.1; c.stroke();
        c.beginPath(); c.moveTo(-14, -2.4); c.lineTo(-19, -5.5); c.lineTo(-18, -2); c.lineTo(-20.5, 0); c.lineTo(-18, 2); c.lineTo(-19, 5.5); c.lineTo(-14, 2.4); c.closePath(); // the mouth, frilled open
        c.fillStyle = '#c4aa78'; c.fill(); c.stroke();
        c.fillStyle = '#3a2e20'; c.beginPath(); c.ellipse(-17.5, 0, 1.4, 2.6, 0, 0, Math.PI * 2); c.fill();
        bodyPath(); const g = c.createRadialGradient(0, -4, 2, 3, 0, 14); g.addColorStop(0, '#dcc596'); g.addColorStop(0.65, '#ae9264'); g.addColorStop(1, '#7c6542');
        c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
        c.save(); bodyPath(); c.clip(); c.strokeStyle = 'rgba(80, 58, 28, 0.2)'; c.lineWidth = 0.5; c.beginPath(); for (let k = -14; k < 18; k += 1.6) { c.moveTo(k, -12); c.lineTo(k, 12); c.moveTo(-14, k - 2); c.lineTo(18, k - 2); } c.stroke(); // the weave
        c.strokeStyle = 'rgba(70, 50, 24, 0.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-8, -3); c.quadraticCurveTo(0, -1, 8, -6); c.moveTo(-8, 3); c.quadraticCurveTo(1, 2, 9, 5); c.stroke(); // creases running from the neck
        c.fillStyle = 'rgba(120, 30, 20, 0.55)'; c.fillRect(2, -2.5, 6, 5); c.restore(); // a merchant's mark stencilled on it
        c.strokeStyle = '#6b4a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-12, -3.4); c.lineTo(-12, 3.4); c.stroke(); // the cord round the neck
        c.lineWidth = 1.1; c.beginPath(); c.moveTo(-12, 3); c.quadraticCurveTo(-11, 8, -15, 10); c.stroke(); // its loose end
        c.fillStyle = '#9a998f'; for (const [x, y, r] of [[-22.5, -2, 1.6], [-23, 2.2, 1.3], [-21, 4.5, 1.1]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } // grit spilling out
        c.restore();
        c.fillStyle = '#a9a8a0'; for (const [x, y, r] of [[2, 13, 1.6], [17, 2, 1.2], [-15, 10, 1.3]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } // chips
    }
    return (CACHE_SPR[kind] = cv);
}

// enemysprites.js drawEnemySprite
function drawCache(e) {
    if (e.pod.quest) { drawQuestItem(e); return; } // sidequests_fx.js: the strongbox, the hammer, the herb chest, the stash
    const c = ctx, k = e.pod.kind, x = e.x, y = e.y;
    if (CACHE_DARK[currentMap.type]) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y + 3, 40, '#ffc66b', 0.13 + 0.03 * Math.sin(fxTime * 2 + e.seed)); c.restore(); } // bandits.js: a warm pool to find it by
    const h = CACHE_HALF * CACHE_DRAW; c.drawImage(cacheSprite(k), x - h, y - h, h * 2, h * 2);
    const ph = ((fxTime + e.seed * 1.7) % 4.2) / 0.5; // a star twinkles on it every few seconds, for a sharp eye
    if (ph < 1) {
        const s = Math.sin(Math.PI * ph), [gx, gy] = CACHE_GLINT[k], gxx = x + gx * CACHE_DRAW, gyy = y + gy * CACHE_DRAW;
        c.save(); c.globalCompositeOperation = 'lighter';
        glow(c, gxx, gyy, 12 * s + 2, '#fff1c8', 0.55 * s);
        c.translate(gxx, gyy); c.rotate(0.3 + ph * 0.6); c.fillStyle = `rgba(255, 250, 230, ${0.95 * s})`;
        const r = 8 * s; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r); c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r); c.fill();
        c.restore();
    }
}

// The darkness layers (map_cavern.js, map_hive.js, map_village.js, map_castle.js): a little light round each cache
function cacheLights(hole) { for (const e of enemies) if (e.type === 'supply_cache' && !e.dead) hole(e.x, e.y, e.pod.quest ? 240 : 170, e.pod.quest ? 0.7 : 0.5); } // a quest item shines brighter
