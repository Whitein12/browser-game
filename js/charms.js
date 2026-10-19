// ==========================================
// charms.js - Charms and wave charms, sold by the merchant (ui.js renderShop)
// ==========================================
// Charms are passive trinkets, bought once and worn in 2 slots on the paper doll (ui.js renderInventory): a build choice.
// Wave charms are one-wave usables kept in a pouch (up to 3 of each) and used from the inventory with a button; only one
// is active at a time, and it ends when the wave it covers is cleared (stage.js onWaveCleared -> charmsWaveEnd). Used mid-wave it
// covers that wave; used in the breather or on a stage-cleared screen it covers the next one (`active.endWave`). startGame,
// a death and leaving the dungeon clear it. The Training Room has no waves, so a charm there lasts until you leave.
// Separate from the sidequests' keepsakes (always on, sidequests.js). The art is charms_fx.js (charmIcon, drawCharmWorld, drawCharmScreen).
// Hooks: combat.js powerParts (Whetstone), takeDamage (Warding Candle, then charmsLethal), gainXP (Quill, Lure), checkEnemyDeath
// (charmsOnKill), main.js recalcStats (the Die), startNextWave (Wardstone), spawn gap (Lure), drop loop (Magnet), sidequests.js goldBonus.

const CHARMS = {
    magnet_stone:    { name: 'Magnet Stone', price: 120, col: '#90a4ae', short: 'Drops drift to you from far off', desc: 'Drops are drawn to you from much farther away.' },
    gamblers_die:    { name: "Gambler's Die", price: 150, col: '#e57373', short: '+25% gold, -10% max HP', desc: '+25% gold from kills, but -10% max HP.' },
    bloodstone:      { name: 'Bloodstone', price: 180, col: '#c62828', short: 'Kills under 30% HP heal', desc: 'A kill while you are under 30% HP heals 2% of your max HP.' },
    wardstone:       { name: 'Wardstone Ring', price: 200, col: '#4fc3f7', short: 'Each wave: 10% HP shield', desc: 'Each wave starts with a shield of 10% max HP for 15 s.' },
    vial_hook:       { name: 'Vial Hook', price: 160, col: '#69f0ae', short: 'A boss kill refills a flask', desc: 'A boss kill gives back one flask charge (up to the max).' },
    scholar_quill:   { name: "Scholar's Quill", price: 150, col: '#ffd54f', short: '+10% XP', desc: '+10% XP from everything.' },
    phoenix_feather: { name: 'Phoenix Feather', price: 250, col: '#ff8a50', short: 'Survive one killing blow', desc: 'The first hit that would kill you leaves you at 1 HP with 1 s of invulnerability. The feather is then spent: buy a new one.' },
};
const WAVE_CHARMS = {
    whetstone:      { name: 'Whetstone', price: 40, col: '#b0bec5', short: '+20 Power this wave', desc: '+20 Power until the wave is cleared.' },
    bounty_writ:    { name: 'Bounty Writ', price: 50, col: '#ffca28', short: '+50% gold this wave', desc: '+50% gold from kills until the wave is cleared.' },
    warding_candle: { name: 'Warding Candle', price: 50, col: '#fff59d', short: 'Blocks the first 3 hits', desc: 'The first 3 hits this wave are blocked completely.' },
    hunters_lure:   { name: "Hunter's Lure", price: 40, col: '#a5d6a7', short: 'Foes come faster, +25% XP', desc: "This wave's enemies come 25% faster and give +25% XP." },
    smelling_salts: { name: 'Smelling Salts', price: 80, col: '#ce93d8', short: 'Revive once this wave', desc: 'A death this wave revives you at 30% max HP with 1.5 s of invulnerability. Used up when it does.' },
    map_scrap:      { name: 'Map Scrap', price: 30, col: '#d7b377', short: 'Marks the nearest cache', desc: 'Marks the nearest unopened supply cache on this map until it is opened or the wave is cleared.' },
};
const CH_DUNGEON_SHOP = ['whetstone', 'bounty_writ', 'warding_candle', 'magnet_stone', 'scholar_quill']; // the stage-cleared shop; Cinderholt's sells all 13
const CH_POUCH_MAX = 3, CH_SLOTS = 2;
const CH_WHETSTONE = 0.20, CH_BOUNTY = 1.5, CH_DIE_GOLD = 1.25, CH_DIE_HP = 0.9, CH_QUILL = 1.10, CH_LURE_XP = 1.25, CH_LURE_SPAWN = 0.75;
const CH_MAGNET_R = 110, CH_MAGNET_SPEED = 340; // drops inside this reach slide toward the hero; the pickup circle is doubled too

const charms = { worn: [null, null], owned: [], pouch: {}, active: null, hitAt: -99, reviveAt: -99 };
let charmNote = ''; // the inventory's line under the pouch (why Use is shut, "No caches here")

const chDef = id => CHARMS[id] || WAVE_CHARMS[id];
const charmWorn = id => charms.worn.includes(id);
const charmOwned = id => charmWorn(id) || charms.owned.includes(id);
const waveCharm = id => !!charms.active && charms.active.id === id;

// main.js startGame, before applyHero: a new run starts bare (a saved hero's charms come back in applyCharms)
function resetCharms() { charms.worn = [null, null]; charms.owned = []; charms.pouch = {}; charms.active = null; charms.hitAt = charms.reviveAt = -99; charmNote = ''; }
// save.js heroSnapshot / applyHero: what the hero carries; the active wave charm is never saved
function charmsSnapshot() { return { worn: [...charms.worn], owned: [...charms.owned], pouch: { ...charms.pouch } }; }
function applyCharms(h) {
    resetCharms();
    const c = h.charms; if (!c) return; // old saves have none
    const seen = new Set(), take = id => CHARMS[id] && !seen.has(id) && seen.add(id);
    charms.worn = [0, 1].map(i => take(c.worn && c.worn[i]) ? c.worn[i] : null);
    charms.owned = (c.owned || []).filter(take);
    for (const id in WAVE_CHARMS) { const n = (c.pouch && c.pouch[id]) | 0; if (n > 0) charms.pouch[id] = Math.min(CH_POUCH_MAX, n); }
}
function charmsGiveAll() { // dev console, the Training Room's kit: every charm owned, the pouch full
    for (const id in CHARMS) if (!charmOwned(id)) charms.owned.push(id);
    for (const id in WAVE_CHARMS) charms.pouch[id] = CH_POUCH_MAX;
}

// ---------- the effects ----------
const charmGoldMult = () => (charmWorn('gamblers_die') ? CH_DIE_GOLD : 1) * (waveCharm('bounty_writ') ? CH_BOUNTY : 1); // sidequests.js goldBonus
const charmXpMult = () => (charmWorn('scholar_quill') ? CH_QUILL : 1) * (waveCharm('hunters_lure') ? CH_LURE_XP : 1); // combat.js gainXP
const charmHpMult = () => charmWorn('gamblers_die') ? CH_DIE_HP : 1; // main.js recalcStats
const charmSpawnMult = () => waveCharm('hunters_lure') ? CH_LURE_SPAWN : 1; // main.js: the spawn gap
const charmMagnet = () => charmWorn('magnet_stone');
const charmCue = (text, color) => effects.push({ type: 'text', text, x: player.x, y: player.y - 44, color, life: 1.0, maxLife: 1.0 });

function charmsWaveStart() { // main.js startNextWave
    if (charmWorn('wardstone')) { addShield(player.maxHp * 0.10, 15); charmCue('Wardstone', CHARMS.wardstone.col); }
}
function charmsOnKill(e) { // combat.js checkEnemyDeath, after the dummy / quest foe / prop exits: only real wave kills get here
    if (charmWorn('bloodstone') && player.hp > 0 && player.hp < player.maxHp * 0.30) {
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02); charmCue('+HP', '#e57373');
    }
    if (charmWorn('vial_hook') && isBossE(e) && !(e.champion && enemies.some(o => o !== e && o.champion && !o.dead))) { // the Royal Guard pay at the last champion
        const f = potions.flask; if (f.charges < f.max) { f.charges++; charmCue('+Flask', '#69f0ae'); }
    }
}
// combat.js takeDamage, after the dodges and the talents, before armour and shields: the Warding Candle eats whole hits
function charmsBlock(isContinuous) {
    const a = charms.active; if (!a || a.id !== 'warding_candle' || isContinuous || !(a.wardsLeft > 0)) return false;
    a.wardsLeft--; charms.hitAt = fxTime; charmCue('Blocked', CHARMS_BLOCK_COL);
    return true;
}
const CHARMS_BLOCK_COL = '#fff59d';
// combat.js takeDamage, once HP has hit 0 and god mode, Undying Flame and the Spellweaver's saves had their say. The feather first, then the salts.
function charmsLethal() {
    const i = charms.worn.indexOf('phoenix_feather');
    if (i >= 0) {
        charms.worn[i] = null; // spent for good
        player.hp = 1; player.iFrames = Math.max(player.iFrames, 1.0); charms.reviveAt = fxTime; charms.reviveKind = 'phoenix'; // charms_fx.js picks the flare
        charmCue('PHOENIX', CHARMS.phoenix_feather.col); addShake(4); return true;
    }
    if (waveCharm('smelling_salts')) {
        charms.active = null; // used up
        player.hp = player.maxHp * 0.30; player.iFrames = Math.max(player.iFrames, 1.5); charms.reviveAt = fxTime; charms.reviveKind = 'salts';
        charmCue('REVIVED', WAVE_CHARMS.smelling_salts.col); addShake(3); return true;
    }
    return false;
}

// ---------- the active wave charm ----------
function charmsWaveEnd() { // stage.js onWaveCleared: the wave it covers is done
    if (charms.active && charms.active.endWave <= wave) charms.active = null;
}
function charmsClear() { charms.active = null; charmNote = ''; } // combat.js playerDied
function updateCharms() { // main.js update: the Map Scrap follows its cache and ends when it opens
    const a = charms.active; if (!a || a.id !== 'map_scrap') return;
    if (!a.ent || a.ent.dead || !enemies.includes(a.ent)) { charms.active = null; return; }
    a.target = { x: a.ent.x, y: a.ent.y };
}
function charmUseBlock() { // '' when a wave charm can be used now
    if (charms.active) return `${WAVE_CHARMS[charms.active.id].name} is already active`;
    if (isBase() || invFromHub || inHub()) return 'Wave charms are used in a dungeon';
    return '';
}
function useWaveCharm(id) { // ui.js / the pouch row's Use button
    const def = WAVE_CHARMS[id]; charmNote = '';
    if (!def || (charms.pouch[id] | 0) <= 0) return false;
    const why = charmUseBlock(); if (why) { charmNote = why; return false; }
    const a = { id, endWave: isTraining() ? Infinity : (invFromFight && waveBreak <= 0 ? wave : wave + 1) }; // the breather or a cleared-wave screen: the next wave
    if (id === 'warding_candle') a.wardsLeft = 3;
    if (id === 'map_scrap') {
        let best = null, bd = Infinity;
        for (const e of enemies) {
            if (e.type !== 'supply_cache' || e.dead || (e.pod && e.pod.quest)) continue; // the unopened supply caches (a quest's stash has its own marker)
            const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; best = e; }
        }
        if (!best) { charmNote = 'No caches here'; charmCue('No caches here', '#9e9e9e'); return false; } // nothing spent
        a.ent = best; a.target = { x: best.x, y: best.y };
    }
    charms.pouch[id]--; if (charms.pouch[id] <= 0) delete charms.pouch[id];
    charms.active = a; charmCue(def.name, def.col);
    updateHUD(); return true;
}

// ---------- icons and tooltips ----------
function charmImg(id) { // charms_fx.js charmIcon when it is there, else a plain glyph
    if (typeof charmIcon === 'function') { const u = charmIcon(id); if (u) return u; }
    const d = chDef(id);
    return renderIcon(`ch:${id}`, d.col, c => icStar(c, 32, 32, 16, '#fff'));
}
function charmTooltip(id, foot) {
    const d = chDef(id), wave = !!WAVE_CHARMS[id];
    return `<div class="tt-name" style="color:${d.col}">${d.name}</div><div class="tt-type">${wave ? 'Wave charm · one wave' : 'Charm · worn'}</div>
        <div class="tt-stat">${d.desc}</div>${foot ? `<div class="tt-foot">${foot}</div>` : ''}`;
}
function charmCell(id, opts = {}) {
    const d = document.createElement('div'); d.className = 'item-cell' + (id ? '' : ' empty');
    if (id) {
        d.innerHTML = `<img src="${charmImg(id)}">${opts.count ? `<span class="tier">&times;${opts.count}</span>` : ''}`;
        if (opts.tip) bindTooltip(d, () => charmTooltip(id, opts.tip(id)));
        if (opts.click) d.onclick = () => { hideTooltip(); opts.click(id); };
    } else d.innerHTML = `<img src="${renderIcon('ch:slot', '#6d5a3a', c => icStar(c, 32, 32, 10, '#fff'))}" style="opacity:0.12; filter:grayscale(1)">`;
    return d;
}

// ---------- the paper doll (ui.js renderInventory) ----------
const CHARM_DOLL = [[0, 256], [76, 256]];
function wearCharm(id) { // from the pack: the first empty slot, else swapped into the first
    const i = charms.owned.indexOf(id); if (i < 0) return;
    charms.owned.splice(i, 1);
    let s = charms.worn.indexOf(null); if (s < 0) { s = 0; charms.owned.push(charms.worn[0]); }
    charms.worn[s] = id; recalcStats(); renderInventory();
}
function takeOffCharm(s) { if (!charms.worn[s]) return; charms.owned.push(charms.worn[s]); charms.worn[s] = null; recalcStats(); renderInventory(); }
function renderCharmDoll(doll) {
    CHARM_DOLL.forEach(([x, y], s) => {
        const g = document.createElement('div'); g.className = 'gear'; g.style.left = x + 'px'; g.style.top = y + 'px';
        g.innerHTML = `<div class="gear-label">Charm</div>`;
        g.appendChild(charmCell(charms.worn[s], { tip: () => 'Click to take it off', click: () => takeOffCharm(s) }));
        doll.appendChild(g);
    });
}
function renderCharmRow() { // the charms in the pack, and the wave charms' pouch with Use buttons
    const row = el('charm-row'); if (!row) return;
    const pack = document.createElement('div'); pack.className = 'cr-group';
    pack.innerHTML = '<span class="ui-label">Charms in pack</span>';
    const cells = document.createElement('div'); cells.className = 'cr-cells';
    for (const id of charms.owned) cells.appendChild(charmCell(id, { tip: () => 'Click to wear it', click: wearCharm }));
    if (!charms.owned.length) cells.innerHTML = '<span class="ui-hint cr-none">None</span>';
    pack.appendChild(cells);
    const pouch = document.createElement('div'); pouch.className = 'cr-group';
    pouch.innerHTML = '<span class="ui-label">Wave charms</span>';
    const pc = document.createElement('div'); pc.className = 'cr-cells';
    const why = charmUseBlock(), ids = Object.keys(WAVE_CHARMS).filter(id => charms.pouch[id] > 0);
    for (const id of ids) {
        const col = document.createElement('div'); col.className = 'cr-wave';
        col.appendChild(charmCell(id, { count: charms.pouch[id], tip: () => why || 'Use it from here' }));
        const b = document.createElement('button'); b.className = 'btn cr-use'; b.textContent = 'Use'; b.disabled = !!why;
        if (why) b.title = why;
        b.onclick = () => { hideTooltip(); useWaveCharm(id); renderInventory(); };
        col.appendChild(b); pc.appendChild(col);
    }
    if (!ids.length) pc.innerHTML = '<span class="ui-hint cr-none">None</span>';
    pouch.appendChild(pc);
    const a = charms.active, note = charmNote || why || '';
    const act = a ? `Active: <b style="color:${WAVE_CHARMS[a.id].col}">${WAVE_CHARMS[a.id].name}</b>${a.id === 'warding_candle' ? ` (${a.wardsLeft} ward${a.wardsLeft === 1 ? '' : 's'} left)` : ''}` : '';
    pouch.insertAdjacentHTML('beforeend', `<div class="ui-hint cr-note">${act}${act && note && !charmNote ? ' &middot; ' : ''}${a && !charmNote ? '' : note}</div>`);
    row.innerHTML = ''; row.append(pack, pouch);
}

// ---------- the merchant (ui.js renderShop) ----------
function charmShopIds() { // Cinderholt's merchant sells everything, a dungeon's stage-cleared shop five
    const full = shopFromHub || isBase();
    return { charms: Object.keys(CHARMS).filter(id => full || CH_DUNGEON_SHOP.includes(id)), wave: Object.keys(WAVE_CHARMS).filter(id => full || CH_DUNGEON_SHOP.includes(id)) };
}
function renderCharmWares(box) {
    const L = charmShopIds();
    const section = (title, ids, wave) => {
        if (!ids.length) return;
        box.insertAdjacentHTML('beforeend', `<div class="ware-head">${title}</div>`);
        for (const id of ids) {
            const d = chDef(id), price = shopPrice({ price: d.price }), have = !wave && charmOwned(id), full = wave && (charms.pouch[id] | 0) >= CH_POUCH_MAX, afford = player.gold >= price;
            const w = document.createElement('div'); w.className = 'ware' + (afford && !have && !full ? '' : ' poor');
            w.appendChild(charmCell(id, { count: wave ? charms.pouch[id] : 0 }));
            w.insertAdjacentHTML('beforeend', `<div class="w-name">${d.name}</div><div class="w-stat">${d.short}</div><div class="w-price">${have ? 'Owned' : full ? 'Pouch full' : `<span class="coin"></span>${price}`}</div>`);
            bindTooltip(w, () => charmTooltip(id, have ? 'You already own this charm' : full ? 'Your pouch holds 3 of these' : afford ? `Click to buy for ${price} gold` : `You need ${price - player.gold} more gold`));
            w.onclick = () => {
                if (have || full || player.gold < price) return;
                hideTooltip(); player.gold -= price;
                if (wave) charms.pouch[id] = (charms.pouch[id] | 0) + 1; else charms.owned.push(id);
                renderShop(); updateHUD();
            };
            box.appendChild(w);
        }
    };
    section('Charms', L.charms, false); section('Wave charms', L.wave, true);
}
const charmSellPrice = id => Math.floor(CHARMS[id].price / 2);
function renderCharmSell(list) { // the owned charms (worn or in the pack) join the backpack's cells; wave charms can't be sold back
    const sell = (id) => {
        const i = charms.owned.indexOf(id), s = charms.worn.indexOf(id);
        if (i >= 0) charms.owned.splice(i, 1); else if (s >= 0) { charms.worn[s] = null; recalcStats(); } else return;
        player.gold += charmSellPrice(id); renderShop(); updateHUD();
    };
    for (const id of [...charms.worn.filter(Boolean), ...charms.owned]) list.appendChild(charmCell(id, { tip: id => `Click to sell for ${charmSellPrice(id)} gold${charmWorn(id) ? ' (worn)' : ''}`, click: sell }));
}

// the hold-Tab sheet (hud.js renderTabSheet)
function charmsSheetHtml() {
    const worn = charms.worn.filter(Boolean), a = charms.active;
    if (!worn.length && !a) return '';
    const row = (k, v, cls) => `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;
    let h = '<h4>Charms</h4>';
    for (const id of worn) h += row(CHARMS[id].name, CHARMS[id].short, 'sub');
    if (a) h += row(WAVE_CHARMS[a.id].name, a.id === 'warding_candle' ? `${a.wardsLeft} ward${a.wardsLeft === 1 ? '' : 's'} left` : WAVE_CHARMS[a.id].short, 'sub temp');
    return h;
}
