// ==========================================
// rebuild.js - Rebuilding Cinderholt's four buildings (base2.md, BASE.md step 4)
// ==========================================
// The raid left the town hall, the apothecary's house and the merchant's shop damaged and the smith's house burned to the
// ground. Each costs gold and materials (caches.js: wood, iron, stone found in the dungeons); any missing material can be
// paid in gold at REBUILD_MAT_GOLD each. A building rebuilt (`built[id]`, kept on the hero: save.js heroBase()) is repainted
// whole (map_base.js baseHouseState), opens its door (baseDoors) and its friend moves inside as keeper (interiors.js); until
// then the friend stands outside the ruin with no service (npcs.js talkTo). E at a ruin's rebuild point opens #rebuild-screen.
// Order is free. The rebuild fades out and back in on the house standing (interiors.js fadeThen; map_base.js baseRaised: dust,
// shavings, a sweep of light), the friend thanks the hero, then a banner (baseBanner).

const REBUILD_MAT_GOLD = 8; // gold per missing material: steep, so a thorough hero pays far less
// house: VIL_HOUSES index; before: the state it starts in; at: the rebuild point (its doorstep); room: INTERIORS id; out / range: where the friend stands meanwhile
const BUILDINGS = {
    smith: { name: 'the forge', title: 'The Forge', house: 10, before: 'destroyed', gold: 400, wood: 30, iron: 25, stone: 30, friend: 'smith', room: 'smithy', at: [1400, 1150], out: [1560, 1250], range: 50, brings: "The smith's house stands again: his forge and anvil, and the smith back at work." },
    apothecary: { name: "the apothecary's house", title: "The Apothecary's", house: 1, before: 'damaged', gold: 250, wood: 20, iron: 5, stone: 10, friend: 'apothecary', room: 'apothecary', at: [887, 630], out: [790, 680], range: 40, brings: 'The roof mended and the shelves dry: remedies and elixirs brewing again.' },
    merchant: { name: "the merchant's shop", title: "The Merchant's", house: 9, before: 'damaged', gold: 250, wood: 20, iron: 10, stone: 5, friend: 'merchant', room: 'merchant', at: [2250, 1070], out: [2150, 1020], range: 40, brings: 'His doors open again, shelves stocked with arms and armour.' },
    hall: { name: 'the town hall', title: 'The Town Hall', house: 5, before: 'damaged', gold: 450, wood: 40, iron: 15, stone: 25, friend: null, room: 'tavern', at: [1487, 680], out: null, range: 0, brings: 'The longhall made whole: a tavern, rooms to rest and a trophy room in the attic.' },
};
const BUILDING_IDS = Object.keys(BUILDINGS);
const devBuilt = {}; // a dev visit with no saved hero keeps its rebuilds here, for the session
const builtOf = () => heroData ? heroBase().built : devBuilt; // save.js heroBase
const isBuilt = id => !!builtOf()[id];
const buildingOfHouse = i => BUILDING_IDS.find(id => BUILDINGS[id].house === i);

// The house's state in the base (map_base.js): rebuilt ones stand whole, the four start as the table says
function baseHouseState(i, was) { const id = buildingOfHouse(i); return id ? (isBuilt(id) ? 'intact' : BUILDINGS[id].before) : BASE_STATE[was]; }
const baseBuiltKey = () => JSON.stringify(builtOf());

// The doors of rebuilt buildings only (interiors.js interactables); the smith's is on his lot's north side
function baseDoors() { return BASE_DOORS.filter(d => isBuilt(d.id)); }

// What the cost is for the hero now: materials first, then the shortfall in gold
function rebuildCost(id) {
    const b = BUILDINGS[id]; let missing = 0;
    for (const k of MAT_KEYS) missing += Math.max(0, b[k] - mats[k]);
    return { missing, extra: missing * REBUILD_MAT_GOLD, total: b.gold + missing * REBUILD_MAT_GOLD };
}

// Where each friend stands: in their building as keeper once it's rebuilt, otherwise outside the ruin (map_base.js startBase, dev reset)
function placeFriends() {
    npcs = [];
    for (const id of BUILDING_IDS) {
        const b = BUILDINGS[id]; if (!b.friend) continue;
        const k = INTERIORS[b.room].keeper;
        if (isBuilt(id)) addNpc(k[0], k[1], k[2] + IN_TOP, k[3], 'in_' + b.room); // interiors.js
        else addNpc(b.friend, b.out[0], b.out[1], b.range, 'base');
    }
}
const outdoorFriend = id => npcs.find(n => n.id === id && n.map === 'base'); // the arrival scene drives the merchant through this

// ---------- the screen ----------

let rebuildId = null;
function openRebuild(id) {
    if (gameState !== STATE.PLAYING) return;
    rebuildId = id; gameState = STATE.SHOP; uiOpenedAt = performance.now();
    el('rebuild-screen').classList.remove('hidden'); renderRebuild();
}
function closeRebuild() {
    el('rebuild-screen').classList.add('hidden'); rebuildId = null;
    if (gameState === STATE.SHOP) { gameState = STATE.PLAYING; lastTime = performance.now(); baseSave(); }
}

function renderRebuild() {
    const b = BUILDINGS[rebuildId], c = rebuildCost(rebuildId), poor = player.gold < c.total;
    el('rb-title').textContent = 'Rebuild ' + b.name;
    el('rb-sub').textContent = b.brings;
    el('rb-gold').textContent = player.gold;
    // One row per cost: what you have against what it takes; enough is a green tick, short is red with the missing count (ui.css .rb-table)
    const row = (icon, label, have, need, col) => { const ok = have >= need;
        return `<tr class="${ok ? 'ok' : 'short'}"><td class="rb-name" style="color: ${col};">${icon}${label}</td><td>${have}</td><td><b>${need}</b></td><td class="rb-st">${ok ? '&#10003;' : '&minus;' + (need - have)}</td></tr>`; };
    let h = `<table class="rb-table"><tr class="rb-head"><td></td><td>You have</td><td>Needed</td><td></td></tr>`
        + row('<span class="coin"></span>', 'Gold', player.gold, b.gold, '#f1d48a') + MAT_KEYS.map(k => row(matImg(k), MAT_NAMES[k], mats[k], b[k], MAT_COLORS[k])).join('') + '</table>'; // icons.js matImg
    h += c.missing > 0 ? `<div class="sm-stat">${c.missing} material${c.missing === 1 ? '' : 's'} missing &times; ${REBUILD_MAT_GOLD} gold = <b>${c.extra}</b> gold</div>` : `<div class="sm-stat">All the materials are in hand.</div>`;
    h += `<div class="sm-stat">Total <b style="color: #f1d48a">${c.total}</b> gold</div>`;
    h += `<button class="btn btn-gold" id="btn-rebuild"${poor ? ' disabled' : ''} onclick="doRebuild()">Rebuild</button>`;
    h += poor ? `<div class="sm-why">You need ${c.total - player.gold} more gold</div>` : `<div class="ui-hint" style="text-align: left">Materials are found in caches in the Slime Caves and the Bandit Bastion.</div>`;
    el('rb-body').innerHTML = h;
}

function doRebuild() {
    const id = rebuildId; if (!id || isBuilt(id)) return;
    const b = BUILDINGS[id], c = rebuildCost(id); if (player.gold < c.total) return;
    player.gold -= c.total; for (const k of MAT_KEYS) mats[k] -= Math.min(mats[k], b[k]);
    builtOf()[id] = true; updateHUD();
    closeRebuild(); // saves: the pay and the build are in the same snapshot
    const done = () => baseBanner(b.title + ' rebuilt', b.brings);
    const thank = () => { // dialogue.js; not over a screen the hero opened meanwhile
        if (gameState !== STATE.PLAYING) { after(0.3, thank); return; }
        openDialogue({ name: FRIENDS[b.friend].name, title: FRIENDS[b.friend].title, portrait: b.friend, lines: FRIENDS[b.friend].thanks, onClose: done });
    };
    fadeThen(() => applyBuilt(id), () => after(1.4, b.friend ? thank : done)); // interiors.js: at the dark point repaint; the reveal plays out (map_base.js baseRaised), then the thank-you and the banner
}

// The dark point of the fade: the village repainted with the house standing, the friend inside
function applyBuilt(id) {
    const b = BUILDINGS[id];
    refreshBase(b.at);
    if (currentMap.type === 'base') baseRaised(id); // map_base.js: dust and light round the new walls as the fade lifts
    if (b.friend) { // out of the lot, behind the counter
        npcs = npcs.filter(n => !(n.id === b.friend && n.map === 'base'));
        const k = INTERIORS[b.room].keeper; if (!npcs.some(n => n.id === k[0] && n.map === 'in_' + b.room)) addNpc(k[0], k[1], k[2] + IN_TOP, k[3], 'in_' + b.room);
    }
}

// Repaint the village from the built list now (and put the hero at a doorstep if the new walls took their spot)
function refreshBase(at = BUILDINGS.smith.at) {
    bse.built = false; buildBase(); // map_base.js
    if (currentMap.type !== 'base') return;
    updateMapBounds(); updateNav(true);
    if (solidCell(terrainAt(player.x, player.y), false)) { player.x = at[0]; player.y = at[1]; }
}

// A banner over the screen (the wave banner's markup, retitled): title, subtitle
function baseBanner(title, sub, kicker = 'Cinderholt') {
    const b = el('wave-banner'); if (!b) return;
    b.classList.remove('boss', 'quest'); // sidequests.js questBanner dresses it otherwise
    b.querySelector('.wb-kicker').textContent = kicker; b.querySelector('.wb-title').textContent = title; b.querySelector('.wb-sub').textContent = sub;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// Dev console: wipe the rebuilds and the arrival so they play again
function resetCinderholt() {
    if (heroData) { const b = heroBase(); b.built = {}; b.seen = {}; }
    for (const k in devBuilt) delete devBuilt[k];
    baseSave();
    if (isBase()) { rebuildId = null; refreshBase(); placeFriends(); }
}
