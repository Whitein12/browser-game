// ==========================================
// interiors.js - Inside Cinderholt's houses (BASE.md): small room maps, doors, stairs, and E to interact
// ==========================================
// Each interior is its own grid map (STAGE_MAPS['in_' + id], 25 px cells like the village): walls round the edge, counters
// and tables low (T_FENCE: walkers go round, shots go over), shelves, hearths and stairs solid, barrels and pedestals round
// obstacles. One canvas per room is painted once (floor, furniture, light from windows and lamps); flames, bubbles and
// candles are live. Doors and stairs are interactables: the village's house doors lead in (map_base.js BASE_DOORS), an
// exit leads back out to the house's doorstep, stairs lead to the next floor, through a short fade (inFade).
// The town hall: the tavern (ground floor), the rooms (first floor), the trophy room (the attic). The apothecary's and the
// merchant's shops, each keeper behind the counter. The smithy is built but has no door yet: the smith's house burned
// down, and it waits to be rebuilt (only the dev console looks inside).
// E: in Cinderholt E opens a door or talks to a friend when one is in reach (main.js keydown, baseInteract); anywhere
// else it is still the E skill.

const isInterior = t => typeof t === 'string' && t.startsWith('in_');
const inId = () => isInterior(currentMap.type) ? currentMap.type.slice(3) : null;

// Where each door lets out in the village (the house's doorstep, map_base.js)
const IN_OUT = { tavern: [1487, 705], apothecary: [887, 655], merchant: [2250, 1045], smithy: [1400, 1150] };
const WALL_WOOD = { top: '#4a3728', rim: '#7a5a3c', grain: 'rgba(160, 120, 80, 0.3)' }, WALL_STONE = { top: '#4e4842', rim: '#857d74', grain: 'rgba(180, 170, 160, 0.22)' };
// Empty margins above and below each room: the camera stops at a map's edge, and without them a door in the top or the
// bottom wall sat under the wave plaque or the skill bar. Rooms are written in their own coordinates; the map adds IN_TOP.
const IN_TOP = 150, IN_BOT = 200;

const INTERIORS = {
    // ---- the town hall, ground floor: the tavern ----
    tavern: {
        name: 'The Tavern', sub: 'The town hall · ground floor', w: 1500, h: 1000, arrive: [750, 870],
        exits: [{ x: 750, y: 918, label: 'Out to the square', to: 'base', at: IN_OUT.tavern },
                { x: 1225, y: 228, label: 'Upstairs: the rooms', to: 'rooms', at: [230, 450] }],
        build(set, O) {
            set(100, 50, 600, 75, T_WALL); // the shelves behind the bar
            set(100, 225, 600, 275, T_FENCE); // the bar
            set(1375, 400, 1450, 600, T_WALL); // the hearth
            set(1150, 50, 1300, 200, T_WALL); // the stairs up
            set(200, 500, 450, 550, T_FENCE); set(200, 700, 450, 750, T_FENCE); // two long tables
            for (const [x, y] of [[650, 350], [1050, 350], [650, 800], [1050, 800]]) O(x, y, 17, 'post');
            for (const [x, y] of [[850, 330], [780, 570], [990, 610], [860, 820], [1200, 810]]) O(x, y, 32, 'table');
            for (const [x, y] of [[160, 130], [225, 120], [560, 115], [560, 175]]) O(x, y, 22, 'barrel');
            O(1315, 440, 22, 'chair'); O(1315, 560, 22, 'chair');
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inPlanks(c, 0, 0, D.w, D.h, '#7a5a3c', rnd), WALL_WOOD);
            inRug(c, 1150, 410, 1360, 590, ['#4a1814', '#c9a227', '#8e2a22'], rnd);
            inRug(c, 640, 470, 1080, 700, ['#2a3a2a', '#b08d3a', '#3e5a3a'], rnd);
            inShelfRow(c, 100, 50, 600, 75, rnd, 'bottles');
            for (const o of D.obstacles) if (o.kind === 'barrel') inBarrel(c, o.x, o.y, o.r);
            inCounter(c, 100, 225, 600, 275, rnd, 'bar');
            inHearth(c, 1375, 400, 1450, 600, rnd);
            for (const o of D.obstacles) if (o.kind === 'chair') inChair(c, o.x, o.y, o.r, 0);
            inLongTable(c, 200, 500, 450, 550, rnd); inLongTable(c, 200, 700, 450, 750, rnd);
            for (const o of D.obstacles) if (o.kind === 'table') inRoundTable(c, o.x, o.y, o.r, rnd);
            for (const o of D.obstacles) if (o.kind === 'post') inPost(c, o.x, o.y, o.r);
            inStairs(c, 1150, 50, 1300, 200, 'n', true);
            inDoor(c, D, 750, 'bottom');
            inBanner(c, 720, 50, '#8e2a22', '#c9a227'); // Cinderholt's banner over the room
            const L = [];
            for (const x of [300, 1200]) inWindow(c, D, x, 'bottom', L);
            inWindow(c, D, 950, 'top', L); inWindow(c, D, 800, 'left', L);
            L.push([1390, 500, 340, '#ff9a40', 0.32], [820, 560, 300, '#ffd27a', 0.22], [350, 150, 220, '#ffcf80', 0.2]);
            inLight(c, D, L, 0.5);
        },
        live(c, t) { const f = 0.85 + 0.15 * Math.sin(t * 8) + 0.06 * Math.sin(t * 19); glow(c, 1400, 500, 230 * f, '#ff7a1a', 0.22 * f); drawFlame(c, 1408, 505, 24, t, 0.3, 1); drawFlame(c, 1408, 478, 16, t, 1.1, 1); },
        above(c, t) { inChandelier(c, 820, 560, t); },
    },

    // ---- the town hall, first floor: rooms for travellers along a corridor ----
    rooms: {
        name: 'The Rooms', sub: 'The town hall · first floor', w: 1500, h: 900, arrive: [230, 450],
        exits: [{ x: 205, y: 450, label: 'Downstairs: the tavern', to: 'tavern', at: [1225, 262] },
                { x: 1295, y: 450, label: 'Upstairs: the trophy room', to: 'trophy', at: [230, 400] }],
        build(set, O) {
            set(50, 350, 1450, 375, T_WALL); set(50, 525, 1450, 550, T_WALL); // the corridor's walls
            for (const x of [400, 750, 1100]) { set(x, 50, x + 25, 350, T_WALL); set(x, 550, x + 25, 850, T_WALL); }
            for (const [x0, x1] of IN_ROOMS) { const g = roomGap(x0, x1); set(g, 350, g + 75, 375, T_FLOOR); set(g, 525, g + 75, 550, T_FLOOR); } // each room's door
            set(50, 375, 175, 525, T_WALL); set(1325, 375, 1450, 525, T_WALL); // the stairs down and up
            IN_ROOMS.forEach(([x0, x1], i) => {
                set(x0 + 25, 50, x0 + 100, 175, T_FENCE); O(x1 - 45, 90, 18, 'chest'); // top: the bed against the far wall, a chest
                set(x0 + 25, 725, x0 + 100, 850, T_FENCE); O(x1 - 45, 810, 18, 'chest');
                if (i === 2) O((x0 + x1) / 2 + 30, 230, 26, 'rubble'); // the room under the hole in the roof
            });
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inPlanks(c, 0, 0, D.w, D.h, '#80603f', rnd, 22), WALL_WOOD);
            inRunner(c, 175, 410, 1325, 490, rnd);
            const L = [], blankets = ['#7a2e2a', '#2e5a7a', '#5a6a2e', '#6a3a7a'];
            IN_ROOMS.forEach(([x0, x1], i) => {
                const cx = (x0 + x1) / 2, broken = i === 2;
                for (const [top, bed0, bed1] of [[true, 50, 175], [false, 725, 850]]) {
                    if (!(broken && top)) inRug(c, cx - 70, top ? 200 : 590, cx + 90, top ? 320 : 690, ['#3a2a1e', '#a08050', blankets[(i + (top ? 0 : 1)) % 4]], rnd);
                    inBed(c, x0 + 25, bed0, x0 + 100, bed1, top, blankets[(i + (top ? 0 : 2)) % 4], rnd, broken && top);
                    inChest(c, x1 - 45, top ? 90 : 810, 36, 26);
                    inStool(c, x1 - 60, top ? 280 : 640);
                }
                inRoomDoor(c, roomGap(x0, x1), 350); inRoomDoor(c, roomGap(x0, x1), 525);
                inWindow(c, D, cx, 'top', L); inWindow(c, D, cx, 'bottom', L);
            });
            for (const o of D.obstacles) if (o.kind === 'rubble') inRubble(c, o.x, o.y, o.r, rnd);
            inStairs(c, 50, 375, 175, 525, 'w', false); inStairs(c, 1325, 375, 1450, 525, 'e', true);
            for (const x of [400, 750, 1100]) { inSconce(c, x + 12, 380); L.push([x + 12, 450, 150, '#ffcf80', 0.2]); }
            L.push([967, 200, 170, '#fff6d8', 0.35]); // sunlight through the hole in the roof
            inLight(c, D, L, 0.5);
        },
        above(c, t) { inSunShaft(c, 967, 200, 70, t); },
    },

    // ---- the town hall, the attic: the trophy room, its pedestals still empty ----
    trophy: {
        name: 'The Trophy Room', sub: 'The town hall · the attic', w: 1300, h: 800, arrive: [230, 400],
        exits: [{ x: 205, y: 400, label: 'Downstairs: the rooms', to: 'rooms', at: [1270, 450] }],
        build(set, O) {
            set(50, 325, 175, 475, T_WALL); // the stairs down
            for (const x of [400, 600, 800, 1000]) { O(x, 180, 26, 'pedestal'); O(x, 620, 26, 'pedestal'); }
            set(1125, 300, 1250, 500, T_FENCE); O(1190, 400, 30, 'crown');
            O(640, 410, 14, 'bucket');
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inPlanks(c, 0, 0, D.w, D.h, '#6e5236', rnd, 26), WALL_WOOD);
            c.fillStyle = 'rgba(0, 0, 0, 0.12)'; for (let x = 120; x < D.w; x += 150) { c.beginPath(); c.moveTo(x, 50); c.lineTo(x + 40, 50); c.lineTo(x + 140, D.h - 50); c.lineTo(x + 100, D.h - 50); c.closePath(); c.fill(); } // the rafters' shadows
            inRunner(c, 260, 360, 1120, 440, rnd, ['#4a1814', '#c9a227']);
            inDais(c, 1125, 300, 1250, 500);
            let k = 0; for (const o of D.obstacles) if (o.kind === 'pedestal') inPedestal(c, o.x, o.y, o.r, o.y < 400, k++ % 3 === 1);
            inCrownStand(c, 1190, 400);
            inBucket(c, 640, 410);
            for (const [x, s] of [[300, 1], [700, 1], [1100, 1], [500, -1], [900, -1]]) inBanner(c, x, s > 0 ? 50 : D.h - 50, s > 0 ? '#2e4a6a' : '#5a2e2e', '#c9a227', s < 0);
            inStairs(c, 50, 325, 175, 475, 'w', false);
            const L = []; inWindow(c, D, 400, 'right', L);
            L.push([640, 400, 200, '#fff6d8', 0.38], [880, 260, 150, '#fff6d8', 0.25]); // the roof's holes
            inLight(c, D, L, 0.55);
        },
        above(c, t) { inSunShaft(c, 640, 400, 80, t); inSunShaft(c, 880, 260, 55, t + 3); },
    },

    // ---- the apothecary's shop: her counter, shelves of jars, a bubbling cauldron, herbs drying overhead ----
    apothecary: {
        name: "The Apothecary's", sub: 'Herbs and remedies', w: 1100, h: 800, arrive: [550, 670], keeper: ['apothecary', 550, 335, 60],
        exits: [{ x: 550, y: 718, label: 'Out to the village', to: 'base', at: IN_OUT.apothecary }],
        build(set, O) {
            set(100, 50, 1000, 75, T_WALL); // shelves of jars
            set(250, 375, 850, 425, T_FENCE); // the counter
            set(700, 150, 950, 200, T_FENCE); // the workbench
            O(225, 200, 36, 'cauldron');
            for (const [x, y] of [[140, 540], [960, 540], [180, 600]]) O(x, y, 20, 'basket');
            for (const [x, y] of [[110, 690], [990, 690]]) O(x, y, 18, 'pot');
            O(980, 320, 22, 'barrel');
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inPlanks(c, 0, 0, D.w, D.h, '#8a6a48', rnd, 22), WALL_WOOD);
            inRug(c, 380, 470, 720, 640, ['#2e4a3a', '#cdd95e', '#4e7a5a'], rnd);
            inShelfRow(c, 100, 50, 1000, 75, rnd, 'jars');
            inCounter(c, 250, 375, 850, 425, rnd, 'apothecary');
            inBench(c, 700, 150, 950, 200, rnd);
            for (const o of D.obstacles) {
                if (o.kind === 'cauldron') inCauldron(c, o.x, o.y, o.r);
                else if (o.kind === 'basket') inBasket(c, o.x, o.y, o.r, rnd);
                else if (o.kind === 'pot') inPot(c, o.x, o.y, o.r, rnd);
                else if (o.kind === 'barrel') inBarrel(c, o.x, o.y, o.r);
            }
            inDoor(c, D, 550, 'bottom');
            const L = []; inWindow(c, D, 400, 'left', L); inWindow(c, D, 400, 'right', L); inWindow(c, D, 250, 'bottom', L); inWindow(c, D, 850, 'bottom', L);
            L.push([225, 200, 200, '#7cff6a', 0.18], [820, 175, 160, '#ffcf80', 0.2]);
            inLight(c, D, L, 0.42);
        },
        live(c, t) { // the cauldron bubbling
            glow(c, 225, 200, 70, '#69f0ae', 0.25 + 0.08 * Math.sin(t * 3));
            for (let i = 0; i < 6; i++) { const k = (t * 0.8 + i / 6) % 1, a = i * 2.4, r = 6 + 16 * ((i * 0.37) % 1); ptEll(c, 225 + Math.cos(a) * r, 200 + Math.sin(a) * r * 0.8, 2 + k * 5, 2 + k * 5, `rgba(190, 255, 170, ${0.7 * (1 - k)})`, 0); }
        },
        above(c, t) { inHerbs(c, 260, 860, 270, t); },
    },

    // ---- the merchant's shop: arms and armour on racks, crates and sacks, a counter with scales and a strongbox ----
    merchant: {
        name: "The Merchant's", sub: 'Goods from the road', w: 1100, h: 800, arrive: [550, 140], keeper: ['merchant', 550, 565, 60],
        exits: [{ x: 550, y: 88, label: 'Out to the village', to: 'base', at: IN_OUT.merchant }],
        build(set, O) {
            set(300, 475, 800, 525, T_FENCE); // the counter
            set(100, 725, 1000, 750, T_WALL); // shelves of goods behind it
            set(50, 150, 75, 450, T_WALL); // the weapon rack on the west wall
            for (const y of [220, 340, 460]) O(150, y, 22, 'armour');
            O(950, 200, 20, 'crate'); O(905, 262, 17, 'crate'); O(985, 330, 18, 'sack'); O(950, 410, 22, 'barrel'); O(985, 470, 18, 'sack');
            O(900, 655, 22, 'strongbox');
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inPlanks(c, 0, 0, D.w, D.h, '#7e5e40', rnd, 24), WALL_WOOD);
            inRug(c, 330, 200, 770, 420, ['#5a1e2e', '#e6b830', '#8e2a3e'], rnd, true);
            inShelfRow(c, 100, 725, 1000, 750, rnd, 'goods');
            inWeaponRack(c, 50, 150, 75, 450, rnd);
            inCounter(c, 300, 475, 800, 525, rnd, 'merchant');
            for (const o of D.obstacles) {
                if (o.kind === 'armour') inArmourStand(c, o.x, o.y, o.r, rnd);
                else if (o.kind === 'crate') vilCrate(c, o.x, o.y, o.r * 0.03, o.r); // map_village.js
                else if (o.kind === 'sack') inSack(c, o.x, o.y, o.r, rnd);
                else if (o.kind === 'barrel') inBarrel(c, o.x, o.y, o.r);
                else if (o.kind === 'strongbox') inChest(c, o.x, o.y, 48, 32, true);
            }
            inDoor(c, D, 550, 'top');
            const L = []; inWindow(c, D, 300, 'top', L); inWindow(c, D, 800, 'top', L); inWindow(c, D, 600, 'right', L);
            for (const x of [380, 720]) { inSconce(c, x, 755, true); L.push([x, 680, 160, '#ffcf80', 0.2]); }
            inLight(c, D, L, 0.42);
        },
        above(c, t) { for (const x of [420, 680]) inLantern(c, x, 330, t); },
    },

    // ---- the smithy: the smith's house, once rebuilt (rebuild.js); he works by the anvil ----
    smithy: {
        name: 'The Smithy', sub: 'Steel and sparks', w: 1200, h: 800, arrive: [600, 140], keeper: ['smith', 690, 330, 45],
        exits: [{ x: 600, y: 88, label: 'Out to the village', to: 'base', at: IN_OUT.smithy }],
        build(set, O) {
            set(1050, 250, 1150, 500, T_WALL); // the forge
            set(50, 200, 75, 600, T_WALL); // racks of blades
            set(150, 600, 450, 650, T_FENCE); // the workbench
            set(850, 560, 1000, 610, T_FENCE); // the quench trough
            O(800, 380, 28, 'anvil'); O(990, 300, 22, 'bellows'); O(1080, 640, 32, 'coal'); O(300, 300, 26, 'grindstone');
            O(500, 220, 20, 'barrel'); O(950, 160, 18, 'crate');
        },
        paint(c, D, G, rnd) {
            inShell(c, D, G, rnd, () => inFlags(c, 0, 0, D.w, D.h, '#6a645c', rnd), WALL_STONE);
            inForge(c, 1050, 250, 1150, 500, rnd);
            inWeaponRack(c, 50, 200, 75, 600, rnd);
            inBench(c, 150, 600, 450, 650, rnd, true);
            inTrough(c, 850, 560, 1000, 610);
            for (const o of D.obstacles) {
                if (o.kind === 'anvil') inAnvil(c, o.x, o.y);
                else if (o.kind === 'bellows') inBellows(c, o.x, o.y);
                else if (o.kind === 'coal') inCoal(c, o.x, o.y, o.r, rnd);
                else if (o.kind === 'grindstone') inGrindstone(c, o.x, o.y, o.r);
                else if (o.kind === 'barrel') inBarrel(c, o.x, o.y, o.r);
                else if (o.kind === 'crate') vilCrate(c, o.x, o.y, 0.2, o.r);
            }
            inDoor(c, D, 600, 'top');
            const L = []; inWindow(c, D, 300, 'top', L); inWindow(c, D, 400, 'left', L);
            L.push([1060, 375, 380, '#ff7a1a', 0.4], [800, 380, 160, '#ff9a40', 0.12]);
            inLight(c, D, L, 0.5);
        },
        live(c, t) { const f = 0.8 + 0.2 * Math.sin(t * 6) + 0.08 * Math.sin(t * 23); glow(c, 1070, 375, 260 * f, '#ff6a00', 0.25 * f); drawFlame(c, 1075, 375, 30, t, 0.7, 1); drawFlame(c, 1080, 340, 18, t, 2.1, 1); drawFlame(c, 1080, 410, 18, t, 3.3, 1); },
    },
};
const IN_ROOMS = [[50, 400], [425, 750], [775, 1100], [1125, 1450]]; // the first floor's rooms, west to east
const roomGap = (x0, x1) => Math.floor((x0 + x1) / 2 / 25) * 25 - 25; // the left edge of a room's 75 px doorway

for (const id in INTERIORS) { const I = INTERIORS[id], H = I.h + IN_TOP + IN_BOT; STAGE_MAPS['in_' + id] = { w: I.w, h: H, cell: 25, bounds: { left: 30, top: 30, right: I.w - 30, bottom: H - 30 }, start: { x: I.arrive[0], y: I.arrive[1] + IN_TOP }, obstacles: [], grid: null, interior: id }; }
const inCache = {};

// stage.js setStageMap: lay out and paint a room the first time it's entered
function buildInterior(type) {
    const id = type.slice(3), I = INTERIORS[id], D = STAGE_MAPS[type]; if (inCache[id]) return;
    const cs = 25, cols = I.w / cs, rows = I.h / cs, data = new Uint8Array(cols * rows).fill(T_WALL), R = { w: I.w, h: I.h, obstacles: [] }; // R: the room in its own coordinates
    const set = (x0, y0, x1, y1, v) => { for (let gy = Math.floor(y0 / cs); gy < Math.ceil(y1 / cs); gy++) for (let gx = Math.floor(x0 / cs); gx < Math.ceil(x1 / cs); gx++) data[gy * cols + gx] = v; };
    set(50, 50, I.w - 50, I.h - 50, T_FLOOR);
    I.build(set, (x, y, r, kind) => R.obstacles.push({ x, y, r, kind }));
    const G = { cols, rows, cell: cs, data };
    const cv = cavCanvas(I.w, I.h); I.paint(cv.getContext('2d'), R, G, vilRng(5000 + id.length * 97)); // map_cavern.js, map_village.js
    inCache[id] = cv;
    const off = IN_TOP / cs, all = rows + (IN_TOP + IN_BOT) / cs, big = new Uint8Array(cols * all).fill(T_WALL); // the map: the room with its margins
    big.set(data, off * cols);
    D.grid = { cols, rows: all, cell: cs, data: big, forest: new Uint8Array(cols * all) };
    D.obstacles.length = 0; for (const o of R.obstacles) D.obstacles.push({ ...o, y: o.y + IN_TOP });
}

// ---------- going through doors ----------

let inFade = null; // { t, to, at, fn, after }: fading out, switching maps (or running fn) at the dark middle, fading back in

function goThrough(to, at) {
    if (inFade) return;
    inFade = { t: 0, to, at, done: false };
    player.dash = null; player.grappleTarget = null;
}

// The same fade without a map change: fn runs at the dark point, after() once the screen is clear (rebuild.js)
function fadeThen(fn, after) {
    if (inFade) return;
    inFade = { t: 0, fn, after, done: false };
    player.dash = null; player.grappleTarget = null;
}

function updateDoorFade(dt) { // map_base.js updateBase / updateInterior
    if (!inFade) return;
    inFade.t += dt;
    if (!inFade.done && inFade.t >= 0.22) {
        inFade.done = true;
        if (inFade.fn) inFade.fn(); // a fadeThen: no map change
        else {
        setStageMap(inFade.to === 'base' ? 'base' : 'in_' + inFade.to); // stage.js
        player.x = inFade.at[0]; player.y = inFade.at[1] + (inFade.to === 'base' ? 0 : IN_TOP); updateCamera(0, true);
        resetDruidState(true); // druid.js: the companion comes along
        el('wave-dungeon').textContent = inFade.to === 'base' ? 'The village' : INTERIORS[inFade.to].name; // hud.js plaque
        }
    }
    if (inFade.t >= 0.5) { const after = inFade.after; inFade = null; if (after) after(); }
}

function drawDoorFade() { // main.js, screen space after the world
    if (!inFade) return;
    const a = inFade.t < 0.22 ? inFade.t / 0.22 : Math.max(0, 1 - (inFade.t - 0.22) / 0.28);
    ctx.fillStyle = `rgba(6, 4, 2, ${a})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function updateInterior(dt) { // stage.js updateStage
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius);
    player.wallHit = null;
    updateDoorFade(dt);
}

function baseSubtitle() { const id = inId(); return id ? INTERIORS[id].sub : matsLine(); } // hud.js wave plaque: in the village, the materials in the pack (caches.js)

// ---------- E: what's in reach ----------

// The doors, stairs and friends on this map: { x, y, r, label, act }
function interactables() {
    const out = [];
    const id = inId();
    if (id) for (const e of INTERIORS[id].exits) out.push({ x: e.x, y: e.y + IN_TOP, r: 60, label: e.label, act: () => goThrough(e.to, e.at) });
    else if (currentMap.type === 'base') {
        for (const d of baseDoors()) out.push({ x: d.x, y: d.y, r: 60, label: d.label, act: () => goThrough(d.to, INTERIORS[d.to].arrive) }); // map_base.js, rebuild.js: only rebuilt buildings have a door
        for (const bid of BUILDING_IDS) if (!isBuilt(bid)) out.push({ x: BUILDINGS[bid].at[0], y: BUILDINGS[bid].at[1], r: 60, label: 'Rebuild ' + BUILDINGS[bid].name, act: () => openRebuild(bid) }); // rebuild.js
    }
    if (currentMap.type === 'base' && heroSlot >= 0) out.push({ x: BASE_BOARD.x, y: BASE_BOARD.y, r: 95, label: 'Read the noticeboard', act: openBoard }); // map_base.js, save.js: the parchment map over the village
    if (currentMap.type === 'base') out.push(...questInteractables()); // sidequests.js: the ruins' stash
    for (const n of npcs) if (n.map === currentMap.type && FRIENDS[n.id]) out.push({ x: n.x, y: n.y - 4, r: id ? 200 : 95, label: 'Talk to the ' + FRIENDS[n.id].role, act: () => talkTo(n.id) }); // npcs.js; indoors across the counter
    return out;
}

let inFocus = null;
function nearestInteractable() {
    if (!isBase() || inFade || player.dash || (stageEvent && stageEvent.blocking)) return null; // no prompt over a scene (the arrival walks past the noticeboard)
    let best = null, bd = 1e9;
    for (const o of interactables()) { const d = Math.hypot(o.x - player.x, o.y - player.y); if (d < o.r && d < bd) { bd = d; best = o; } }
    return best;
}

// main.js keydown: E in Cinderholt with something in reach acts on it instead of casting the E skill
function baseInteract() {
    const o = nearestInteractable(); if (!o) return false;
    o.act(); return true;
}

// The prompt over what E would act on (world space, above everything)
function drawInteractPrompt() {
    const o = nearestInteractable(); if (!o) return;
    const c = ctx, y = o.y - 46 + Math.sin(fxTime * 3) * 2;
    c.save(); c.font = 'bold 13px Georgia, serif'; c.textBaseline = 'middle';
    const w = c.measureText(o.label).width + 44, x = o.x - w / 2;
    c.fillStyle = 'rgba(18, 12, 8, 0.85)'; c.strokeStyle = '#b08d3a'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x, y - 13, w, 26, 4); c.fill(); c.stroke();
    c.fillStyle = '#3a2a1a'; c.strokeStyle = '#e6c46a'; c.beginPath(); c.roundRect(x + 6, y - 9, 18, 18, 3); c.fill(); c.stroke();
    c.fillStyle = '#ffe9a8'; c.textAlign = 'center'; c.fillText('E', x + 15, y + 1);
    c.textAlign = 'left'; c.fillStyle = '#f0e2c0'; c.fillText(o.label, x + 32, y + 1);
    c.restore();
}

// ---------- drawing (main.js draw) ----------

function drawInteriorGround() {
    const id = inId(), I = INTERIORS[id];
    ctx.drawImage(inCache[id], 0, IN_TOP);
    if (I.live) { ctx.save(); ctx.translate(0, IN_TOP); I.live(ctx, fxTime); ctx.restore(); }
}

function drawInteriorAbove() {
    const I = INTERIORS[inId()];
    if (I.above) { ctx.save(); ctx.translate(0, IN_TOP); I.above(ctx, fxTime); ctx.restore(); }
    drawInteractPrompt();
}

// ==========================================
// Painting helpers (all cached once per room)
// ==========================================

// The room's shell: the floor, then the walls (their tops dark, a timber or stone rim where they meet the floor) and
// the shadows they cast to the bottom-right
function inShell(c, D, G, rnd, floor, pal) {
    const cs = G.cell, wall = (gx, gy) => gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows || G.data[gy * G.cols + gx] === T_WALL;
    floor();
    for (let gy = 0; gy < G.rows; gy++) for (let gx = 0; gx < G.cols; gx++) {
        if (!wall(gx, gy)) continue; const x = gx * cs, y = gy * cs;
        if (!wall(gx, gy + 1)) { c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x, y + cs, cs, 10); c.fillStyle = 'rgba(0, 0, 0, 0.14)'; c.fillRect(x, y + cs + 10, cs, 10); }
        if (!wall(gx + 1, gy)) { c.fillStyle = 'rgba(0, 0, 0, 0.26)'; c.fillRect(x + cs, y, 8, cs); c.fillStyle = 'rgba(0, 0, 0, 0.12)'; c.fillRect(x + cs + 8, y, 8, cs); }
    }
    for (let gy = 0; gy < G.rows; gy++) for (let gx = 0; gx < G.cols; gx++) {
        if (!wall(gx, gy)) continue; const x = gx * cs, y = gy * cs;
        c.fillStyle = pal.top; c.fillRect(x, y, cs, cs);
        c.fillStyle = pal.grain; for (let k = 0; k < 3; k++) c.fillRect(x + rnd() * cs, y + rnd() * cs, 3 + rnd() * 8, 1.2);
        c.fillStyle = pal.rim;
        if (!wall(gx, gy + 1)) c.fillRect(x, y + cs - 6, cs, 6);
        if (!wall(gx, gy - 1)) c.fillRect(x, y, cs, 6);
        if (!wall(gx + 1, gy)) c.fillRect(x + cs - 6, y, 6, cs);
        if (!wall(gx - 1, gy)) c.fillRect(x, y, 6, cs);
        c.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (!wall(gx, gy + 1)) c.fillRect(x, y + cs - 1.5, cs, 1.5);
        if (!wall(gx + 1, gy)) c.fillRect(x + cs - 1.5, y, 1.5, cs);
    }
}

function inPlanks(c, x0, y0, x1, y1, col, rnd, pw = 24) {
    for (let y = y0; y < y1; y += pw) {
        let x = x0 - rnd() * 150;
        while (x < x1) {
            const l = 110 + rnd() * 160, a = Math.max(x, x0), b = Math.min(x + l, x1);
            c.fillStyle = sprShade(col, (rnd() - 0.5) * 0.22); c.fillRect(a, y, b - a, pw);
            c.strokeStyle = 'rgba(30, 18, 8, 0.22)'; c.lineWidth = 1;
            for (let k = 0; k < 2; k++) { const gy = y + 5 + rnd() * (pw - 10); c.beginPath(); c.moveTo(a + 4, gy); c.quadraticCurveTo((a + b) / 2, gy + (rnd() - 0.5) * 4, b - 4, gy + (rnd() - 0.5) * 2); c.stroke(); }
            if (rnd() < 0.3) { c.fillStyle = 'rgba(40, 24, 10, 0.35)'; c.beginPath(); c.ellipse(a + rnd() * (b - a), y + pw / 2, 3, 2, 0, 0, Math.PI * 2); c.fill(); } // a knot
            c.fillStyle = 'rgba(20, 12, 6, 0.55)'; c.fillRect(b - 1.5, y, 1.5, pw); // the butt joint
            x += l;
        }
        c.fillStyle = 'rgba(20, 12, 6, 0.5)'; c.fillRect(x0, y + pw - 1.5, x1 - x0, 1.5);
        c.fillStyle = 'rgba(255, 230, 190, 0.07)'; c.fillRect(x0, y, x1 - x0, 1.5);
    }
}

function inFlags(c, x0, y0, x1, y1, col, rnd) {
    c.fillStyle = '#2a2622'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let y = y0; y < y1;) {
        const h = 34 + rnd() * 18;
        for (let x = x0 - rnd() * 30; x < x1;) { const w = 40 + rnd() * 40; c.fillStyle = sprShade(col, (rnd() - 0.5) * 0.28); c.fillRect(x + 2, y + 2, w - 4, h - 4); c.fillStyle = 'rgba(255, 245, 230, 0.08)'; c.fillRect(x + 2, y + 2, w - 4, 2); x += w; }
        y += h;
    }
}

// Darkness toward the corners, then each light poured in on top: [x, y, r, colour, strength]
function inLight(c, D, lights, dark) {
    const g = c.createRadialGradient(D.w / 2, D.h / 2, Math.min(D.w, D.h) * 0.2, D.w / 2, D.h / 2, Math.max(D.w, D.h) * 0.62);
    g.addColorStop(0, 'rgba(10, 6, 3, 0)'); g.addColorStop(1, `rgba(10, 6, 3, ${dark})`); c.fillStyle = g; c.fillRect(0, 0, D.w, D.h);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, col, a] of lights) { const l = c.createRadialGradient(x, y, 0, x, y, r); l.addColorStop(0, ptRgba(col, a)); l.addColorStop(1, ptRgba(col, 0)); c.fillStyle = l; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.restore();
}

// A window in an outer wall at `pos` along it: the panes in the wall, a pool of daylight on the floor (pushed into `L`)
function inWindow(c, D, pos, side, L) {
    const horiz = side === 'top' || side === 'bottom', w = 64;
    const x = horiz ? pos - w / 2 : side === 'left' ? 14 : D.w - 36, y = horiz ? (side === 'top' ? 14 : D.h - 36) : pos - w / 2, W = horiz ? w : 22, H = horiz ? 22 : w;
    c.fillStyle = '#1a120c'; c.fillRect(x - 3, y - 3, W + 6, H + 6);
    c.fillStyle = '#b9d2de'; c.fillRect(x, y, W, H);
    c.fillStyle = 'rgba(255, 255, 255, 0.45)'; c.fillRect(x + 2, y + 2, horiz ? W * 0.4 : 4, horiz ? 4 : H * 0.4);
    c.strokeStyle = '#3a2a1c'; c.lineWidth = 2.5; c.beginPath();
    if (horiz) { c.moveTo(x + W / 2, y); c.lineTo(x + W / 2, y + H); c.moveTo(x, y + H / 2); c.lineTo(x + W, y + H / 2); } else { c.moveTo(x, y + H / 2); c.lineTo(x + W, y + H / 2); c.moveTo(x + W / 2, y); c.lineTo(x + W / 2, y + H); }
    c.stroke();
    const into = 110, lx = horiz ? pos : side === 'left' ? 50 + into : D.w - 50 - into, ly = horiz ? (side === 'top' ? 50 + into : D.h - 50 - into) : pos;
    L.push([lx, ly, 150, '#fff1c8', 0.2]);
}

// The way out: a doorway in the wall bright with daylight, a mat before it
function inDoor(c, D, x, side) {
    const top = side === 'top', y = top ? 0 : D.h - 50, inner = top ? 50 : D.h - 50;
    const g = c.createLinearGradient(0, top ? 0 : D.h, 0, inner); g.addColorStop(0, '#f4ecc8'); g.addColorStop(1, '#a89a70');
    c.fillStyle = g; c.fillRect(x - 36, y, 72, 50);
    c.fillStyle = '#5a3f2a'; c.fillRect(x - 42, y, 6, 50); c.fillRect(x + 36, y, 6, 50); // the jambs
    const lg = c.createRadialGradient(x, inner, 0, x, inner, 130); lg.addColorStop(0, 'rgba(255, 244, 210, 0.35)'); lg.addColorStop(1, 'rgba(255, 244, 210, 0)'); c.fillStyle = lg; c.fillRect(x - 130, inner - (top ? 0 : 130), 260, 130);
    const my = top ? inner + 10 : inner - 40; // the mat
    c.fillStyle = '#7a3a2a'; c.fillRect(x - 40, my, 80, 30); c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.strokeRect(x - 34, my + 5, 68, 20);
    c.strokeStyle = 'rgba(220, 200, 150, 0.6)'; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 9; k++) { c.moveTo(x - 38 + k * 9.5, my); c.lineTo(x - 38 + k * 9.5, my - 4); c.moveTo(x - 38 + k * 9.5, my + 30); c.lineTo(x - 38 + k * 9.5, my + 34); } c.stroke();
}

// Stairs: steps across the way you climb (dir), lighter going up toward the eye, darker going down into the dark
function inStairs(c, x0, y0, x1, y1, dir, up) {
    const n = 8, vert = dir === 'n' || dir === 's';
    c.fillStyle = '#1a120c'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, sh = up ? -0.3 + i * 0.07 : -0.08 - i * 0.09;
        let rx, ry, rw, rh;
        if (vert) { rh = (y1 - y0) / n; rw = x1 - x0 - 16; rx = x0 + 8; ry = dir === 'n' ? y1 - u1 * (y1 - y0) : y0 + u0 * (y1 - y0); }
        else { rw = (x1 - x0) / n; rh = y1 - y0 - 16; ry = y0 + 8; rx = dir === 'w' ? x1 - u1 * (x1 - x0) : x0 + u0 * (x1 - x0); }
        c.fillStyle = sprShade('#8a6a48', sh); c.fillRect(rx, ry, rw, rh);
        c.fillStyle = 'rgba(0, 0, 0, 0.45)'; // the riser's edge, on the side toward the foot
        if (vert) c.fillRect(rx, dir === 'n' ? ry + rh - 2.5 : ry, rw, 2.5); else c.fillRect(dir === 'w' ? rx + rw - 2.5 : rx, ry, 2.5, rh);
    }
    c.fillStyle = '#3a2818'; if (vert) { c.fillRect(x0, y0, 8, y1 - y0); c.fillRect(x1 - 8, y0, 8, y1 - y0); } else { c.fillRect(x0, y0, x1 - x0, 8); c.fillRect(x0, y1 - 8, x1 - x0, 8); } // the stringers
    c.fillStyle = '#6b4d33'; if (vert) { c.fillRect(x0 + 2, y0, 3, y1 - y0); c.fillRect(x1 - 5, y0, 3, y1 - y0); } else { c.fillRect(x0, y0 + 2, x1 - x0, 3); c.fillRect(x0, y1 - 5, x1 - x0, 3); }
    if (!up) { const far = dir === 'w' ? [x0, 0] : dir === 'e' ? [x1, 0] : dir === 'n' ? [0, y0] : [0, y1], g = vert ? c.createLinearGradient(0, far[1], 0, (y0 + y1) / 2) : c.createLinearGradient(far[0], 0, (x0 + x1) / 2, 0); g.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)'); c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
}

const inShadow = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(x + 6, y + 8, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
const inBox = (c, x, y, w, h, fill, lw = 2) => { c.fillStyle = fill; c.fillRect(x, y, w, h); if (lw) { c.strokeStyle = '#1a110a'; c.lineWidth = lw; c.strokeRect(x, y, w, h); } };

function inRug(c, x0, y0, x1, y1, [edge, trim, field], rnd, ornate) {
    c.fillStyle = 'rgba(0, 0, 0, 0.2)'; c.fillRect(x0 + 4, y0 + 5, x1 - x0, y1 - y0);
    c.fillStyle = edge; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = trim; c.lineWidth = 3; c.strokeRect(x0 + 7, y0 + 7, x1 - x0 - 14, y1 - y0 - 14);
    c.fillStyle = field; c.fillRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, n = Math.max(2, Math.floor((x1 - x0) / 70));
    c.fillStyle = trim; c.globalAlpha = 0.75;
    for (let i = 0; i < n; i++) { const x = x0 + 12 + (i + 0.5) * (x1 - x0 - 24) / n, s = Math.min(16, (y1 - y0) * 0.18); c.beginPath(); c.moveTo(x, cy - s); c.lineTo(x + s * 0.8, cy); c.lineTo(x, cy + s); c.lineTo(x - s * 0.8, cy); c.closePath(); c.fill(); }
    if (ornate) { c.beginPath(); c.ellipse(cx, cy, (x1 - x0) * 0.22, (y1 - y0) * 0.3, 0, 0, Math.PI * 2); c.lineWidth = 2.5; c.strokeStyle = trim; c.stroke(); }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(230, 210, 160, 0.6)'; c.lineWidth = 1; c.beginPath(); for (let y = y0 + 4; y < y1 - 2; y += 6) { c.moveTo(x0, y); c.lineTo(x0 - 5, y); c.moveTo(x1, y); c.lineTo(x1 + 5, y); } c.stroke(); // the fringe
    c.fillStyle = 'rgba(0, 0, 0, 0.08)'; for (let i = 0; i < 30; i++) c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 4, 1.5); // wear
}

// A long runner down a corridor or an aisle
function inRunner(c, x0, y0, x1, y1, rnd, cols = ['#5a2a1e', '#a08050']) {
    c.fillStyle = cols[0]; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = cols[1]; c.lineWidth = 2.5; c.strokeRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
    c.fillStyle = 'rgba(0, 0, 0, 0.1)'; for (let i = 0; i < 40; i++) c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 5, 1.5);
}

function inBarrel(c, x, y, r) {
    inShadow(c, x, y, r, r * 0.9);
    c.fillStyle = '#7a5434'; c.strokeStyle = '#1e140c'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#33373b'; c.lineWidth = 2.5; for (const k of [0.92, 0.6]) { c.beginPath(); c.arc(x, y, r * k, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = 'rgba(30, 18, 8, 0.5)'; c.lineWidth = 1; c.beginPath(); for (const o of [-0.3, 0, 0.3]) { c.moveTo(x - r * 0.55, y + o * r); c.lineTo(x + r * 0.55, y + o * r); } c.stroke();
    c.fillStyle = 'rgba(255, 230, 190, 0.15)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill();
}

function inSack(c, x, y, r, rnd) {
    inShadow(c, x, y, r, r * 0.8);
    c.fillStyle = '#b39b6e'; c.strokeStyle = '#3e3020'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(x, y, r, r * 0.85, rnd() * 3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(80, 60, 30, 0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 0.4, y - r * 0.2); c.quadraticCurveTo(x, y + r * 0.1, x + r * 0.5, y - r * 0.3); c.stroke();
    ptEll(c, x, y - r * 0.7, r * 0.28, r * 0.2, '#7a6440', 1.4);
}

function inCounter(c, x0, y0, x1, y1, rnd, kind) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0);
    inBox(c, x0, y0, x1 - x0, y1 - y0, '#6b4a30', 2.5);
    c.fillStyle = '#86603e'; c.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 14); // the top, the front edge in shadow below it
    c.strokeStyle = 'rgba(40, 24, 12, 0.35)'; c.lineWidth = 1; c.beginPath(); for (let y = y0 + 10; y < y1 - 12; y += 9) { c.moveTo(x0 + 4, y); c.lineTo(x1 - 4, y); } c.stroke();
    c.fillStyle = 'rgba(255, 235, 200, 0.12)'; c.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, 2);
    const L = x1 - x0, at = u => x0 + L * u, cy = y0 + (y1 - y0) * 0.4;
    if (kind === 'bar') { // mugs, a tapped keg, a cloth
        for (const u of [0.12, 0.2, 0.55, 0.62, 0.86]) inMug(c, at(u), cy + (rnd() - 0.5) * 6);
        inBarrel(c, at(0.38), cy, 15); ptEll(c, at(0.38), cy + 14, 3, 2, '#c9a227', 1);
        c.fillStyle = '#e8e0cc'; c.fillRect(at(0.72), cy - 7, 26, 14);
    } else if (kind === 'apothecary') { // a mortar, a scale, little bottles, a book open
        ptEll(c, at(0.18), cy, 13, 13, '#8a8378', 2); ptEll(c, at(0.18), cy, 8, 8, '#4a4540', 0); ptLine(c, '#b0a898', 3, [[at(0.18) - 2, cy - 2], [at(0.18) + 12, cy - 12]]);
        for (let k = 0; k < 5; k++) inBottle(c, at(0.32) + k * 11, cy + (k % 2) * 6, ['#69f0ae', '#ff8a65', '#ba68c8', '#4fc3f7', '#fff176'][k]);
        inBook(c, at(0.62), cy, rnd); inScale(c, at(0.85), cy);
    } else if (kind === 'merchant') { // a ledger, scales, coins stacked, a lockbox
        inBook(c, at(0.2), cy, rnd); inScale(c, at(0.45), cy);
        for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) ptEll(c, at(0.66) + k * 10, cy - 4 + j * -2 + (k % 2) * 6, 5, 3, '#e6b830', 1);
        inChest(c, at(0.88), cy, 30, 20, true);
    }
}

function inMug(c, x, y) { ptEll(c, x, y, 6, 6, '#8a6a48', 1.4); ptEll(c, x, y, 4, 4, '#f3ead2', 0); c.fillStyle = '#8a6a48'; c.fillRect(x + 5, y - 1.5, 4, 3); }
function inBottle(c, x, y, col) { ptEll(c, x, y, 4.5, 4.5, col, 1.2); ptEll(c, x - 1.2, y - 1.2, 1.4, 1.4, 'rgba(255, 255, 255, 0.7)', 0); ptEll(c, x, y, 1.6, 1.6, '#5d4037', 0); }
function inBook(c, x, y, rnd) { c.save(); c.translate(x, y); c.rotate((rnd() - 0.5) * 0.4); inBox(c, -16, -11, 32, 22, '#6a2a22', 1.5); c.fillStyle = '#efe6cf'; c.fillRect(-14, -9, 13, 18); c.fillRect(1, -9, 13, 18); c.strokeStyle = 'rgba(60, 40, 30, 0.5)'; c.lineWidth = 0.8; c.beginPath(); for (let k = 0; k < 5; k++) { c.moveTo(-12, -6 + k * 3.5); c.lineTo(-3, -6 + k * 3.5); c.moveTo(3, -6 + k * 3.5); c.lineTo(12, -6 + k * 3.5); } c.stroke(); c.restore(); }
function inScale(c, x, y) { ptLine(c, '#b08d3a', 2.5, [[x - 16, y], [x + 16, y]]); ptEll(c, x, y, 4, 4, '#8a6a2a', 1.2); for (const s of [-1, 1]) ptEll(c, x + s * 16, y, 8, 8, '#c9a227', 1.4); }

function inShelfRow(c, x0, y0, x1, y1, rnd, kind) {
    inBox(c, x0, y0, x1 - x0, y1 - y0, '#4a3322', 2);
    c.fillStyle = '#5e4129'; c.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, 5);
    const cy = (y0 + y1) / 2;
    for (let x = x0 + 10; x < x1 - 8;) {
        if (kind === 'bottles') { inBottle(c, x, cy + (rnd() - 0.5) * 6, ['#4e7a3a', '#7a2e2a', '#c9a227', '#3a5a7a', '#5d4037'][(rnd() * 5) | 0]); x += 10 + rnd() * 6; }
        else if (kind === 'jars') { const r = 5 + rnd() * 3; ptEll(c, x, cy, r, r, ['#cfe8d0', '#e8d8b0', '#d0c8e8', '#f0e0c0'][(rnd() * 4) | 0], 1.2); ptEll(c, x, cy, r * 0.6, r * 0.6, ['#6a8a3a', '#8a4a2a', '#5a3a7a', '#c9a227', '#3a6a5a'][(rnd() * 5) | 0], 0); x += r * 2 + 3 + rnd() * 4; }
        else { const k = rnd(); if (k < 0.4) { ptEll(c, x + 6, cy, 7, 6, '#b39b6e', 1.2); x += 16; } else if (k < 0.7) { inBox(c, x, cy - 6, 14, 12, ['#7a2e2a', '#2e4a6a', '#5a6a2e'][(rnd() * 3) | 0], 1.2); x += 17; } else { ptEll(c, x + 5, cy, 6, 6, '#8a6a48', 1.2); x += 14; } }
    }
}

function inHearth(c, x0, y0, x1, y1, rnd) {
    c.fillStyle = '#5f5850'; c.fillRect(x0 - 20, y0, x1 - x0 + 20, y1 - y0);
    for (let y = y0 + 8; y < y1; y += 16) for (let x = x0 - 14 + ((y / 16) % 2) * 8; x < x1; x += 18) cavRock(c, x, y, 7 + rnd() * 2, rnd, '#7a7266');
    c.fillStyle = '#140e0a'; c.fillRect(x0 - 8, y0 + 40, x1 - x0 - 10, y1 - y0 - 80); // the firebox
    c.fillStyle = '#5a1e0a'; c.fillRect(x0 - 4, y0 + 50, x1 - x0 - 18, y1 - y0 - 100);
    for (const [ax, ay, bx, by] of [[x0 - 2, y0 + 90, x0 + 50, y0 + 112], [x0, y0 + 120, x0 + 48, y0 + 92]]) { ptLine(c, '#3a2414', 7, [[ax, ay], [bx, by]]); }
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x0 - 20, y0, x1 - x0 + 20, 10);
}

function inChair(c, x, y, r, a) {
    inShadow(c, x, y, r, r);
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = '#5a2a1e'; c.strokeStyle = '#1a0e08'; c.lineWidth = 2; c.beginPath(); c.roundRect(-r, -r, r * 2, r * 2, 6); c.fill(); c.stroke();
    c.fillStyle = '#7a3a2a'; c.beginPath(); c.roundRect(-r + 5, -r + 6, r * 2 - 12, r * 2 - 12, 4); c.fill();
    c.fillStyle = '#4a2218'; c.fillRect(r - 8, -r, 8, r * 2); // its back, toward the wall
    c.restore();
}

function inStool(c, x, y) { inShadow(c, x, y, 9, 9); ptEll(c, x, y, 9, 9, '#6b4a30', 1.8); ptEll(c, x - 2, y - 2, 4, 4, 'rgba(255, 230, 190, 0.15)', 0); }

function inRoundTable(c, x, y, r, rnd) {
    inShadow(c, x, y, r + 6, r + 4);
    const a0 = rnd() * Math.PI; for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2 + (rnd() - 0.5) * 0.3; inStool(c, x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14)); }
    c.fillStyle = '#7d5637'; c.strokeStyle = '#1e140c'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.save(); c.clip(); c.strokeStyle = 'rgba(40, 24, 12, 0.35)'; c.lineWidth = 1; c.beginPath(); for (let k = -r; k < r; k += 9) { c.moveTo(x - r, y + k); c.lineTo(x + r, y + k); } c.stroke(); c.restore();
    c.fillStyle = 'rgba(255, 235, 200, 0.12)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 2; k++) inMug(c, x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r);
    if (rnd() < 0.6) ptEll(c, x + (rnd() - 0.5) * r * 0.6, y + (rnd() - 0.5) * r * 0.6, 8, 8, '#d8d0c0', 1.2);
}

function inLongTable(c, x0, y0, x1, y1, rnd) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 6, y0 - 10, x1 - x0, y1 - y0 + 34);
    for (const by of [y0 - 18, y1 + 6]) inBox(c, x0 + 10, by, x1 - x0 - 20, 12, '#5e4129', 1.5); // the benches
    inBox(c, x0, y0, x1 - x0, y1 - y0, '#7d5637', 2.5);
    c.strokeStyle = 'rgba(40, 24, 12, 0.35)'; c.lineWidth = 1; c.beginPath(); for (let y = y0 + 9; y < y1; y += 9) { c.moveTo(x0 + 2, y); c.lineTo(x1 - 2, y); } c.stroke();
    for (let x = x0 + 25; x < x1 - 15; x += 34 + rnd() * 20) { if (rnd() < 0.5) inMug(c, x, y0 + 12 + rnd() * (y1 - y0 - 24)); else ptEll(c, x, (y0 + y1) / 2, 8, 8, '#d8d0c0', 1.2); }
}

function inPost(c, x, y, r) { c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x - r + 6, y - r + 8, r * 2, r * 2); inBox(c, x - r, y - r, r * 2, r * 2, '#5a3f2a', 2.5); c.fillStyle = 'rgba(255, 230, 190, 0.15)'; c.fillRect(x - r + 2, y - r + 2, r * 2 - 4, 3); }

function inBanner(c, x, y, col, trim, flip) {
    const d = flip ? -1 : 1, top = y + (flip ? -4 : 4);
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x - 22 + 5, top + 5 * d, 44, 70 * d);
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 22, top); c.lineTo(x + 22, top); c.lineTo(x + 22, top + 64 * d); c.lineTo(x, top + 76 * d); c.lineTo(x - 22, top + 64 * d); c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = 2; c.stroke();
    ptEll(c, x, top + 32 * d, 9, 9, trim, 0); ptEll(c, x, top + 32 * d, 5, 5, col, 0);
    c.fillStyle = '#3a2a1a'; c.fillRect(x - 26, top - 3 * d - (flip ? 4 : 0), 52, 5);
}

function inBed(c, x0, y0, x1, y1, headTop, col, rnd, broken) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0);
    c.save(); if (broken) { c.translate((x0 + x1) / 2, (y0 + y1) / 2); c.rotate(0.18); c.translate(-(x0 + x1) / 2, -(y0 + y1) / 2); }
    inBox(c, x0, y0, x1 - x0, y1 - y0, '#4e3424', 2.5);
    c.fillStyle = broken ? '#a89a80' : '#e8e0cc'; c.fillRect(x0 + 5, y0 + 5, x1 - x0 - 10, y1 - y0 - 10);
    const hy = headTop ? y0 + 22 : y1 - 22; ptEll(c, (x0 + x1) / 2, hy, (x1 - x0) * 0.32, 11, broken ? '#9a9080' : '#f6f1e4', 1.4);
    const b0 = headTop ? y0 + (y1 - y0) * 0.4 : y0 + 5, b1 = headTop ? y1 - 5 : y1 - (y1 - y0) * 0.4;
    c.fillStyle = col; c.fillRect(x0 + 4, b0, x1 - x0 - 8, b1 - b0); c.fillStyle = 'rgba(255, 255, 255, 0.2)'; c.fillRect(x0 + 4, headTop ? b0 : b1 - 6, x1 - x0 - 8, 6); // the blanket, turned down
    c.restore();
    if (broken) for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(40, 32, 24, 0.5)'; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 6, 3); }
}

function inChest(c, x, y, w, h, rich) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x - w / 2 + 5, y - h / 2 + 6, w, h);
    inBox(c, x - w / 2, y - h / 2, w, h, rich ? '#5a3a24' : '#6e4a2c', 2);
    c.fillStyle = '#3d4247'; c.fillRect(x - w / 2 + w * 0.2, y - h / 2, 4, h); c.fillRect(x + w / 2 - w * 0.2 - 4, y - h / 2, 4, h);
    ptEll(c, x, y + h / 2 - 4, 3.5, 3, rich ? '#e6b830' : '#c9a227', 1);
}

function inRoomDoor(c, gx, y) { c.fillStyle = '#3a2818'; c.fillRect(gx - 4, y, 4, 25); c.fillRect(gx + 75, y, 4, 25); c.fillStyle = 'rgba(0, 0, 0, 0.18)'; c.fillRect(gx, y, 75, 25); }
function inSconce(c, x, y, below) { ptEll(c, x, y + (below ? -8 : 8), 5, 5, '#3a3d42', 1.4); ptEll(c, x, y + (below ? -8 : 8), 2.5, 2.5, '#ffd27a', 0); }

function inRubble(c, x, y, r, rnd) {
    inShadow(c, x, y, r, r * 0.8);
    for (let i = 0; i < 6; i++) cavRock(c, x + (rnd() - 0.5) * r * 1.4, y + (rnd() - 0.5) * r * 1.4, 4 + rnd() * 3, rnd, '#7a6a5a');
    for (let i = 0; i < 4; i++) { const a = rnd() * Math.PI, l = r * (1 + rnd() * 0.5); ptLine(c, i % 2 ? '#4a3626' : '#5e4430', 5, [[x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2], [x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2]]); }
    for (let i = 0; i < 10; i++) { c.fillStyle = ['#8a6a2a', '#6a7a3a', '#a07a3a'][i % 3]; c.beginPath(); c.ellipse(x + (rnd() - 0.5) * r * 2.4, y + (rnd() - 0.5) * r * 2.4, 3, 1.6, rnd() * 3, 0, Math.PI * 2); c.fill(); } // leaves blown in
}

function inDais(c, x0, y0, x1, y1) { c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0); inBox(c, x0, y0, x1 - x0, y1 - y0, '#5a2a24', 2.5); c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.strokeRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12); }

// An empty pedestal waiting for its trophy, a brass plaque on its front; some still under a dust sheet
function inPedestal(c, x, y, r, top, sheet) {
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x - r + 6, y - r + 8, r * 2, r * 2);
    inBox(c, x - r, y - r, r * 2, r * 2, '#6d665c', 2.5); inBox(c, x - r + 5, y - r + 5, r * 2 - 10, r * 2 - 10, '#8a8378', 1.5);
    c.fillStyle = 'rgba(255, 250, 235, 0.15)'; c.fillRect(x - r + 5, y - r + 5, r * 2 - 10, 3);
    const py = top ? y + r + 6 : y - r - 12; inBox(c, x - 16, py, 32, 7, '#b08d3a', 1.2);
    if (sheet) { c.fillStyle = '#d8d0c0'; c.strokeStyle = '#6a6458'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - r - 4, y - r + 2); c.quadraticCurveTo(x, y - r - 8, x + r + 4, y - r + 2); c.lineTo(x + r + 6, y + r + 2); c.quadraticCurveTo(x, y + r + 8, x - r - 6, y + r + 2); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = 'rgba(100, 90, 80, 0.5)'; c.beginPath(); c.moveTo(x - 6, y - r); c.lineTo(x - 10, y + r); c.moveTo(x + 8, y - r); c.lineTo(x + 12, y + r); c.stroke(); }
}

function inCrownStand(c, x, y) { inShadow(c, x, y, 30, 26); ptEll(c, x, y, 30, 30, '#4a2a24', 2.5); ptEll(c, x, y, 22, 22, '#7a2e2a', 1.5); c.strokeStyle = '#c9a227'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.stroke(); } // a velvet cushion, its crown still to come
function inBucket(c, x, y) { inShadow(c, x, y, 14, 12); ptEll(c, x, y, 14, 14, '#6b4a30', 2); ptEll(c, x, y, 10, 10, '#6a8aa0', 0); ptEll(c, x - 3, y - 3, 3, 1.5, 'rgba(255, 255, 255, 0.6)', 0); } // catching the rain from the roof

function inCauldron(c, x, y, r) {
    inShadow(c, x, y, r + 4, r);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; ptEll(c, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95, 5, 5, '#26292e', 1.4); } // its feet
    ptEll(c, x, y, r, r, '#1e2024', 2.5); ptEll(c, x, y, r * 0.86, r * 0.86, '#3a3d42', 0);
    ptEll(c, x, y, r * 0.74, r * 0.74, '#4caf50', 0); ptEll(c, x - 4, y - 4, r * 0.45, r * 0.4, '#7ad070', 0);
    c.fillStyle = 'rgba(255, 120, 30, 0.6)'; c.beginPath(); c.ellipse(x, y + r + 4, r * 0.6, 5, 0, 0, Math.PI * 2); c.fill(); // embers under it
}

function inBench(c, x0, y0, x1, y1, rnd, smith) {
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0);
    inBox(c, x0, y0, x1 - x0, y1 - y0, '#6b4a30', 2.5); c.fillStyle = '#7d5637'; c.fillRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 10);
    const cy = (y0 + y1) / 2 - 2, at = u => x0 + (x1 - x0) * u;
    if (smith) { // tongs, hammers, a file
        ptLine(c, '#3a3d42', 3, [[at(0.15), cy - 8], [at(0.3), cy + 6]]); ptLine(c, '#3a3d42', 3, [[at(0.17), cy + 8], [at(0.3), cy - 4]]);
        ptLine(c, '#6d4c33', 4, [[at(0.45), cy + 8], [at(0.58), cy - 6]]); inBox(c, at(0.58) - 9, cy - 13, 18, 10, '#3b3e44', 1.4);
        ptLine(c, '#8e979e', 2.5, [[at(0.75), cy], [at(0.9), cy - 3]]);
        return;
    }
    ptEll(c, at(0.15), cy, 11, 11, '#8a8378', 1.8); ptEll(c, at(0.15), cy, 6, 6, '#3a5a2a', 0); // a mortar of crushed leaves
    ptEll(c, at(0.42), cy, 13, 13, '#cfe0e6', 1.6); ptEll(c, at(0.42), cy, 9, 9, '#a07ad0', 0); ptLine(c, '#cfe0e6', 2.5, [[at(0.42) + 10, cy - 6], [at(0.6), cy - 14]]); // an alembic
    for (let k = 0; k < 4; k++) inBottle(c, at(0.7) + k * 12, cy + (k % 2) * 5, ['#ff8a65', '#69f0ae', '#fff176', '#4fc3f7'][k]);
    for (let k = 0; k < 5; k++) sprLeaf(c, at(0.08) + rnd() * (x1 - x0) * 0.8, cy + 10, rnd() * 6, 7, '#66bb6a'); // sprites.js
}

function inBasket(c, x, y, r, rnd) {
    inShadow(c, x, y, r, r);
    ptEll(c, x, y, r, r, '#a07a48', 2); c.strokeStyle = 'rgba(70, 48, 24, 0.6)'; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke();
    const col = ['#66bb6a', '#c62828', '#8d6e63', '#fdd835'][(rnd() * 4) | 0]; for (let k = 0; k < 6; k++) ptEll(c, x + (rnd() - 0.5) * r * 1.1, y + (rnd() - 0.5) * r * 1.1, 4, 4, col, 1);
}

function inPot(c, x, y, r, rnd) { inShadow(c, x, y, r, r); ptEll(c, x, y, r, r, '#b0603a', 2); ptEll(c, x, y, r * 0.75, r * 0.75, '#4a3020', 0); for (let k = 0; k < 7; k++) sprLeaf(c, x, y, k * 0.9 + rnd(), r * 1.2, k % 2 ? '#4caf50' : '#66bb6a'); }

function inWeaponRack(c, x0, y0, x1, y1, rnd) {
    inBox(c, x0, y0, x1 - x0 + 14, y1 - y0, '#4a3322', 2);
    for (let y = y0 + 20; y < y1 - 10; y += 34) {
        const k = rnd(), x = x0 + 6;
        if (k < 0.5) { ptLine(c, '#cfd8dc', 4, [[x, y], [x + 44, y]]); ptLine(c, '#8a6a2a', 3, [[x - 2, y - 6], [x - 2, y + 6]]); ptLine(c, '#4a3020', 3.5, [[x - 4, y], [x - 14, y]]); } // a sword
        else if (k < 0.8) { ptLine(c, '#6d4c33', 3, [[x - 10, y], [x + 50, y]]); ptPoly(c, [[x + 50, y - 4], [x + 64, y], [x + 50, y + 4]], '#cfd8dc', 1.2); } // a spear
        else { ptLine(c, '#6d4c33', 3, [[x - 10, y], [x + 34, y]]); ptPoly(c, [[x + 26, y - 9], [x + 38, y - 4], [x + 38, y + 4], [x + 26, y + 9]], '#9ea7aa', 1.2); } // an axe
    }
}

function inArmourStand(c, x, y, r, rnd) {
    inShadow(c, x, y, r, r);
    ptEll(c, x, y, r * 0.5, r * 0.5, '#4a3322', 1.5);
    const metal = rnd() < 0.5 ? '#9ea7aa' : '#8a6a48';
    ptEll(c, x, y, r * 0.75, r, metal, 2); // the cuirass on its post
    for (const s of [-1, 1]) ptEll(c, x, y + s * r * 0.95, r * 0.42, r * 0.36, sprShade(metal, -0.15), 1.6); // pauldrons
    ptEll(c, x - 3, y - 4, r * 0.25, r * 0.4, 'rgba(255, 255, 255, 0.25)', 0);
}

function inForge(c, x0, y0, x1, y1, rnd) {
    c.fillStyle = '#4a443e'; c.fillRect(x0 - 30, y0 - 20, x1 - x0 + 30, y1 - y0 + 40);
    for (let y = y0 - 12; y < y1 + 20; y += 16) for (let x = x0 - 24 + ((y / 16) % 2) * 8; x < x1; x += 18) cavRock(c, x, y, 7 + rnd() * 2, rnd, '#6a625a');
    c.fillStyle = '#100a06'; c.fillRect(x0 - 10, y0 + 40, 70, y1 - y0 - 80); // the hearth of the forge
    c.fillStyle = '#7a2a0a'; c.fillRect(x0 - 4, y0 + 50, 58, y1 - y0 - 100);
    for (let i = 0; i < 26; i++) ptEll(c, x0 + rnd() * 52, y0 + 55 + rnd() * (y1 - y0 - 110), 3 + rnd() * 3, 3 + rnd() * 3, rnd() < 0.5 ? '#ff8a3a' : '#2a1a10', 0); // coals
}

function inTrough(c, x0, y0, x1, y1) { inBox(c, x0, y0, x1 - x0, y1 - y0, '#4a3322', 2.5); c.fillStyle = '#3a5a6a'; c.fillRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12); c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.fillRect(x0 + 10, y0 + 9, 40, 2); }
function inAnvil(c, x, y) { inShadow(c, x, y, 30, 18); ptEll(c, x, y, 18, 18, '#4a3322', 2); ptPoly(c, [[x - 30, y - 10], [x + 18, y - 10], [x + 36, y - 3], [x + 18, y + 4], [x + 18, y + 10], [x - 30, y + 10]], '#3b3e44', 2.5); c.fillStyle = 'rgba(255, 255, 255, 0.3)'; c.fillRect(x - 26, y - 8, 40, 3); }
function inBellows(c, x, y) { inShadow(c, x, y, 22, 14); ptPoly(c, [[x - 22, y - 14], [x + 14, y - 8], [x + 14, y + 8], [x - 22, y + 14]], '#6b4a30', 2); ptLine(c, '#3b3e44', 4, [[x + 14, y], [x + 34, y]]); ptLine(c, '#4a3020', 3, [[x - 22, y - 10], [x - 34, y - 14]]); }
function inCoal(c, x, y, r, rnd) { inShadow(c, x, y, r, r * 0.8); for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r; ptEll(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + rnd() * 2, 3 + rnd() * 2, rnd() < 0.5 ? '#1e1c1a' : '#2e2a26', 0); } }
function inGrindstone(c, x, y, r) { inShadow(c, x, y, r, r * 0.6); inBox(c, x - r, y - 8, r * 2, 16, '#5e4129', 2); ptEll(c, x, y, r * 0.35, r, '#8a8378', 2); ptLine(c, '#3b3e44', 3, [[x - r, y], [x - r - 12, y + 8]]); }

// ---------- live touches ----------

function inChandelier(c, x, y, t) { // an iron ring of candles hanging over the room
    c.strokeStyle = 'rgba(20, 14, 10, 0.85)'; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 34, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#3a3d42'; c.lineWidth = 3; c.stroke();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, cx = x + Math.cos(a) * 34, cy = y + Math.sin(a) * 34; glow(c, cx, cy, 22, '#ffb74d', 0.3 + 0.08 * Math.sin(t * 7 + k)); ptEll(c, cx, cy, 3, 3, '#f3ead2', 1); ptEll(c, cx, cy - 1, 1.6, 2.4, '#ffd54f', 0); }
}

function inLantern(c, x, y, t) { glow(c, x, y, 70, '#ffcf80', 0.3 + 0.05 * Math.sin(t * 5 + x)); inBox(c, x - 7, y - 7, 14, 14, '#3a3d42', 1.5); ptEll(c, x, y, 4, 4, '#ffe08a', 0); }

function inSunShaft(c, x, y, r, t) { // daylight falling through a hole in the roof, dust turning in it
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 1.3); g.addColorStop(0, 'rgba(255, 246, 220, 0.16)'); g.addColorStop(1, 'rgba(255, 246, 220, 0)');
    c.fillStyle = g; c.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
    c.fillStyle = 'rgba(255, 250, 230, 0.6)';
    for (let i = 0; i < 10; i++) { const a = t * 0.2 + i * 1.7, d = r * (0.2 + 0.7 * ((i * 0.37 + t * 0.03) % 1)); c.fillRect(x + Math.cos(a) * d, y + Math.sin(a * 1.3) * d * 0.8, 1.6, 1.6); }
    c.restore();
}

function inHerbs(c, x0, x1, y, t) { // bundles of herbs drying from a beam across the shop
    c.fillStyle = 'rgba(30, 20, 12, 0.85)'; c.fillRect(x0, y - 4, x1 - x0, 8);
    for (let x = x0 + 30, k = 0; x < x1 - 20; x += 46, k++) {
        const sw = Math.sin(t * 1.2 + k) * 0.06, col = ['#5a8a3a', '#7a6a3a', '#8a5a8a', '#6a8a4a'][k % 4];
        c.save(); c.translate(x, y); c.rotate(sw);
        for (let j = -2; j <= 2; j++) sprLeaf(c, 0, 4, Math.PI / 2 + j * 0.25, 18, col); // sprites.js
        ptEll(c, 0, 4, 3, 3, '#8a6a3a', 1);
        c.restore();
    }
}
