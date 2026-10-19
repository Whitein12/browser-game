// ==========================================
// ui.js - Rank numbers for the skill tree, wave cleared / victory, inventory, shop, tooltips, dev console
// ==========================================
// The HUD itself lives in hud.js.

const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', amulet: 'Amulet', boots: 'Boots', gloves: 'Gloves' };
let uiOpenedAt = 0; // keys are ignored briefly after a screen pops up, so a held skill key can't pick a card by accident

function classColor() { return activeClass.color || '#c9a86a'; }
function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ==========================================
// Tooltip
// ==========================================

function showTooltip(html, ev) {
    const tt = el('tooltip'); tt.innerHTML = html; tt.classList.remove('hidden'); moveTooltip(ev);
}
function moveTooltip(ev) {
    const tt = el('tooltip'), pad = 16;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + tt.offsetWidth > window.innerWidth - 8) x = ev.clientX - tt.offsetWidth - pad;
    if (y + tt.offsetHeight > window.innerHeight - 8) y = ev.clientY - tt.offsetHeight - pad;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
}
function hideTooltip() { el('tooltip').classList.add('hidden'); }
function bindTooltip(node, htmlFn) {
    node.addEventListener('mouseenter', ev => showTooltip(htmlFn(), ev));
    node.addEventListener('mousemove', moveTooltip);
    node.addEventListener('mouseleave', hideTooltip);
}

// ==========================================
// Items: formatting and comparison
// ==========================================

const pctStat = type => type === 'weapon' || type === 'gloves' || type === 'amulet';
function fmtStat(type, v) {
    const n = pctStat(type) ? Math.round(v * 100) : Math.round(v);
    return itemDataConfig.slotData[type].descTemplate.replace('{VAL}', n);
}
function itemTypeLine(item) { return `${item.rarity === 'rare' ? 'Rare ' : ''}${SLOT_NAMES[item.type]} · +${item.up || 0} of +${upgradeCap()}`; }
function itemDelta(item) { const eq = equipment[item.type]; if (!eq || eq === item) return null; return item.val - eq.val; }
function isUpgrade(item) { const eq = equipment[item.type]; if (!eq) return true; const d = itemDelta(item); return d !== null && d > 0; }

function itemTooltip(item, foot) {
    const eq = equipment[item.type], worn = eq === item;
    let cmp = '';
    if (!worn) {
        if (!eq) cmp = `<div class="tt-cmp up">Empty slot: a straight upgrade</div>`;
        else {
            const d = item.val - eq.val, cls = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
            cmp = `<div class="tt-cmp ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${d === 0 ? 'Same as worn' : fmtStat(item.type, Math.abs(d)).replace(/^\+?/, d > 0 ? '+' : '-')} vs. ${itemName(eq)}</div>`;
        }
    }
    return `<div class="tt-name" style="color:${item.rarity === 'rare' ? 'var(--rare)' : 'var(--text)'}">${itemName(item)}</div>
        <div class="tt-type">${itemTypeLine(item)}${worn ? ' · worn' : ''}</div>
        <div class="tt-stat">${itemDesc(item)}</div>${cmp}${foot ? `<div class="tt-foot">${foot}</div>` : ''}`;
}
// An inventory-style square showing one item (or an empty slot)
function itemCell(item, opts = {}) {
    const d = document.createElement('div');
    d.className = 'item-cell' + (!item ? ' empty' : item.rarity === 'rare' ? ' rare' : '');
    if (item) {
        d.innerHTML = `<img src="${itemIcon(item)}">${item.up > 0 ? `<span class="tier">+${item.up}</span>` : ''}${opts.better && isUpgrade(item) ? '<span class="better">▲</span>' : ''}`;
        if (opts.tip) bindTooltip(d, () => itemTooltip(item, opts.tip(item)));
        if (opts.click) d.onclick = () => { hideTooltip(); opts.click(item); };
    } else if (opts.slot) {
        d.innerHTML = `<img src="${itemIcon({ type: opts.slot })}" style="opacity:0.12; filter:grayscale(1)">`;
    }
    return d;
}
function fillBackpack(list, opts) {
    list.innerHTML = '';
    const n = Math.max(20, Math.ceil(inventory.length / 10) * 10);
    for (let i = 0; i < n; i++) list.appendChild(itemCell(inventory[i] || null, opts));
}

// ==========================================
// Inventory
// ==========================================

let dollAnim = 0, invFromFight = false, invFromHub = false; // opened mid-fight (I): the game pauses, and closing goes straight back to it
window.openInventory = () => {
    invFromFight = gameState === STATE.PLAYING; invFromHub = gameState === STATE.MENU; // save.js hub
    gameState = STATE.INVENTORY; uiOpenedAt = performance.now();
    el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.remove('hidden');
    renderInventory();
    const cv = el('doll-portrait'), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(306 * dpr); cv.height = Math.round(234 * dpr);
    const t0 = performance.now(), id = ++dollAnim, cid = activeClassId();
    (function frame(now) { // the hero idles in the paper doll while the screen is open
        if (id !== dollAnim || el('inventory-screen').classList.contains('hidden')) return;
        drawPortrait(cv, cid, (now - t0) / 1000, 0.4); requestAnimationFrame(frame);
    })(t0);
};
window.closeInventory = () => {
    hideTooltip(); el('inventory-screen').classList.add('hidden');
    if (invFromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); baseSave(); return; }
    if (invFromHub) { invFromHub = false; hubReturn(); return; } // save.js: back to Cinderholt
    el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION;
};

function equipItem(itemIndex) {
    const item = inventory[itemIndex]; if (equipment[item.type]) inventory.push(equipment[item.type]);
    equipment[item.type] = item; inventory.splice(itemIndex, 1); recalcStats(); renderInventory();
}
function unequipItem(type) {
    if (!equipment[type]) return;
    inventory.push(equipment[type]); equipment[type] = null; recalcStats(); renderInventory();
}

const DOLL_SLOTS = { weapon: [0, 24], armor: [0, 134], amulet: [406, 24], gloves: [406, 134], boots: [203, 256] };
function renderInventory() {
    const doll = el('doll');
    doll.querySelectorAll('.gear').forEach(g => g.remove());
    for (const [t, [x, y]] of Object.entries(DOLL_SLOTS)) {
        const g = document.createElement('div'); g.className = 'gear'; g.style.left = x + 'px'; g.style.top = y + 'px';
        g.innerHTML = `<div class="gear-label">${SLOT_NAMES[t]}</div>`;
        g.appendChild(itemCell(equipment[t], { slot: t, tip: () => 'Click to take it off', click: () => unequipItem(t) }));
        doll.appendChild(g);
    }
    const rows = [
        ['Max Health', Math.round(player.maxHp)], ['Armor', `${player.armor} (${Math.round(armorReduction(player.armor) * 100)}%)`], ['Power', playerPower()], // combat.js
        ['Attack Speed', `+${Math.round((equipment.gloves ? equipment.gloves.val : 0) * 100)}%`],
        ['Cooldown Reduction', `${Math.round((1 - getCDR()) * 100)}%`], ['Move Speed', Math.round(player.speed)],
        ['Gold', player.gold], ...MAT_KEYS.map(k => [matImg(k) + MAT_NAMES[k], mats[k]]), // caches.js, icons.js
    ];
    el('stats-sheet').innerHTML = `<div class="ui-label" style="margin-bottom:6px">${activeClass.name} · Lv. ${player.level}</div>` + rows.map(([k, v]) => `<div class="row">${k}<b>${v}</b></div>`).join('');
    fillBackpack(el('backpack-list'), {
        better: true, tip: () => 'Click to equip',
        click: item => equipItem(inventory.indexOf(item)),
    });
}

// ==========================================
// Shop
// ==========================================

let shopFromFight = false, shopFromHub = false; // opened mid-fight from the dev console: leaving goes back to the fight, not to the wave-cleared screen
window.openShop = () => {
    shopFromFight = gameState === STATE.PLAYING; shopFromHub = gameState === STATE.MENU; // save.js hub
    gameState = STATE.SHOP; uiOpenedAt = performance.now();
    el('intermission-screen').classList.add('hidden'); el('shop-screen').classList.remove('hidden');
    generateShop(); renderShop();
};
window.closeShop = () => {
    hideTooltip(); el('shop-screen').classList.add('hidden');
    if (shopFromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); baseSave(); return; }
    if (shopFromHub) { shopFromHub = false; hubReturn(); return; } // save.js: back to Cinderholt
    el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION;
};

// A fixed catalogue (items.js): the five commons and the class's five rares, always at +0. No rerolls, and no drops: the smith raises them.
function generateShop() { shopItems = [...GEAR_SLOT_LIST.map(makeCommon), ...GEAR_SLOT_LIST.map(t => makeRare(t))]; }

const owned = item => (equipment[item.type] && equipment[item.type].name === item.name) || inventory.some(o => o.name === item.name);
function renderShop() {
    el('shop-gold-display').textContent = player.gold;
    const buy = el('shop-buy-list'); buy.innerHTML = '';
    shopItems.forEach(item => {
        const price = shopPrice(item), have = owned(item), afford = player.gold >= price, d = document.createElement('div'); // sidequests.js: the merchant's favour
        d.className = 'ware' + (item.rarity === 'rare' ? ' rare' : '') + (afford && !have ? '' : ' poor');
        d.appendChild(itemCell(item));
        d.insertAdjacentHTML('beforeend', `<div class="w-name">${item.name}</div><div class="w-stat">${fmtStat(item.type, item.val)}</div><div class="w-price">${have ? 'Owned' : `<span class="coin"></span>${price}`}</div>`);
        bindTooltip(d, () => itemTooltip(item, have ? 'You already own this one: raise it at the smith' : afford ? `Click to buy for ${price} gold` : `You need ${price - player.gold} more gold`));
        d.onclick = () => {
            if (owned(item) || player.gold < price) return;
            hideTooltip(); player.gold -= price; inventory.push({ ...item, spent: price }); renderShop(); updateHUD(); // `spent` = what it cost, so selling it back is half of that
        };
        buy.appendChild(d);
    });
    fillBackpack(el('shop-sell-list'), {
        tip: item => `Click to sell for ${sellPrice(item)} gold`,
        click: item => { player.gold += sellPrice(item); inventory.splice(inventory.indexOf(item), 1); renderShop(); updateHUD(); },
    });
}

// ==========================================
// Smith
// ==========================================

let smithFromFight = false, smithFromHub = false, smithSel = null; // the same return pattern as the shop
window.openSmith = () => {
    smithFromFight = gameState === STATE.PLAYING; smithFromHub = gameState === STATE.MENU;
    gameState = STATE.SHOP; uiOpenedAt = performance.now(); smithSel = null;
    el('intermission-screen').classList.add('hidden'); el('smith-screen').classList.remove('hidden');
    renderSmith();
};
window.closeSmith = () => {
    hideTooltip(); el('smith-screen').classList.add('hidden');
    if (smithFromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); baseSave(); return; }
    if (smithFromHub) { smithFromHub = false; hubReturn(); return; }
    el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION;
};
function smithDetail() {
    const it = smithSel, box = el('smith-detail');
    if (!it) { box.innerHTML = '<div class="ui-hint">Pick a piece of gear to see what the next +1 does.</div>'; return; }
    const cap = upgradeCap(), cost = upgradeCost(it), capped = it.up >= cap, poor = player.gold < cost;
    const nv = itemVal({ ...it, up: it.up + 1 });
    const why = capped ? (cap < itemDataConfig.upgrade.capCaves ? `At +${cap} for now: clear the Slime Caves to go further` : `At +${cap}: the most the smith can do`) : poor ? `You need ${cost - player.gold} more gold` : '';
    box.innerHTML = `<div class="tt-name" style="color:${it.rarity === 'rare' ? 'var(--rare)' : 'var(--text)'}">${itemName(it)}</div>
        <div class="tt-type">${itemTypeLine(it)}</div>
        <div class="sm-stat">${fmtStat(it.type, it.val)}${capped ? '' : ` <span class="sm-arrow">&rarr;</span> <b>${fmtStat(it.type, nv)}</b>`}</div>
        ${it.rarity === 'rare' ? `<div class="ui-hint" style="text-align:left">${rareFx(it)}</div>` : ''}
        ${capped ? '' : `<div class="w-price sm-cost">Cost <span class="coin"></span>${cost}</div>`}
        <button class="btn btn-gold" id="btn-smith-up"${capped || poor ? ' disabled' : ''}>${capped ? 'Fully upgraded' : `Upgrade to +${it.up + 1}`}</button>
        <div class="sm-why">${why}</div>
        <div class="ui-hint" style="text-align:left">Worth ${sellPrice(it)} gold at the merchant (half of all you put in).</div>`;
    el('btn-smith-up').onclick = () => { if (upgradeItem(it)) { renderSmith(); updateHUD(); } };
}
function renderSmith() {
    el('smith-gold-display').textContent = player.gold;
    const worn = el('smith-worn'); worn.innerHTML = '';
    const pick = item => { hideTooltip(); smithSel = item; renderSmith(); };
    for (const t of GEAR_SLOT_LIST) {
        const c = itemCell(equipment[t], { slot: t, tip: () => 'Click to inspect', click: pick });
        if (equipment[t] && equipment[t] === smithSel) c.classList.add('picked');
        worn.appendChild(c);
    }
    fillBackpack(el('smith-pack'), { tip: () => 'Click to inspect', click: pick });
    el('smith-pack').querySelectorAll('.item-cell').forEach((c, i) => { if (inventory[i] && inventory[i] === smithSel) c.classList.add('picked'); });
    smithDetail();
}

// Apothecary (potions.js renderApothecary): the same return pattern as the smith
let apoFromFight = false, apoFromHub = false;
window.openApothecary = () => {
    apoFromFight = gameState === STATE.PLAYING; apoFromHub = gameState === STATE.MENU;
    gameState = STATE.SHOP; uiOpenedAt = performance.now();
    el('intermission-screen').classList.add('hidden'); el('apothecary-screen').classList.remove('hidden');
    renderApothecary();
};
window.closeApothecary = () => {
    hideTooltip(); el('apothecary-screen').classList.add('hidden');
    if (apoFromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); baseSave(); return; }
    if (apoFromHub) { apoFromHub = false; hubReturn(); return; }
    el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION;
};

// ==========================================
// Rank numbers (the skill tree's tooltips, skilltree.js)
// ==========================================

// What each rank changes, per skill: RANK_STATS[class][slot](rank, sk) → [[label, value], ...], real numbers at your current Power
// (hitDmg is the real hit, from the skill's own baseDmg). A skill without an entry shows its hit; the cooldown line is added below when the rank shortens it.
// Keep these in step with the skills: anything that reads sk.level or calcUtility(…, level) belongs here.
const RH = (base, r, m = 1) => { const v = hitDmg(base, r) * m; return v < 10 ? +v.toFixed(1) : Math.round(v); }, // small hits keep a decimal, or a rank-up would show no change
     RU = (x, r) => calcUtility(x, r), RS = v => `${(+v).toFixed(1)}s`, RP = v => `${Math.round(v)} px`;
const RANK_STATS = {
    Dragonknight: {
        1: (r, sk) => [['Hit', RH(sk.baseDmg, r)], ['Shield', Math.round(RU(50, r))], ['Shield time', RS(RU(5, r))],
            ...(sk.selectedUpg === 'A' ? [['Trail per second', RH(sk.baseDmg, r, MOLTEN_DPS)]] : sk.selectedUpg === 'B' ? [['Grind', RH(sk.baseDmg, r, GRIND_MULT)], ['Rip free', RH(sk.baseDmg, r, RIP_MULT)]] : [])],
        2: (r, sk) => [['Basic damage', `+${Math.round(RU(0.5, r) * 100)}%`], ['Burn per second', RH(sk.baseDmg, r, 0.3)]],
        3: (r, sk) => [['Landing hit', RH(sk.baseDmg, r)], ...(sk.selectedUpg === 'B' ? [['Full dive', RH(sk.baseDmg, r, DIVE_MULT)]] : [])],
        4: (r, sk) => [['Per flame', RH(sk.baseDmg, r, 0.25)], ['Burn per second', RH(sk.baseDmg, r, 0.2)]],
    },
    Spellweaver: { // spellweaver.js: each spell lists its own (SPELLS[id].stats), whichever key it's on
        1: (r, sk) => SPELLS[sk.spell].stats(r, sk), 2: (r, sk) => SPELLS[sk.spell].stats(r, sk),
        3: (r, sk) => SPELLS[sk.spell].stats(r, sk), 4: (r, sk) => SPELLS[sk.spell].stats(r, sk),
    },
    Ranger: {
        1: (r, sk) => [['Full draw', RH(sk.baseDmg, r)]],
        2: (r, sk) => [['Heal', Math.round(RU(15, r) * (hasTalent('stride_herb') ? 1.5 : 1))], ['Speed time', RS(RU(2, r) + (hasTalent('stride_light') ? 1 : 0))]],
        3: (r, sk) => [['Distance', RP(vaultReach({ level: r }))]],
        4: (r, sk) => [['Per arrow', RH(sk.baseDmg, r)]],
    },
    Nightblade: {
        1: (r, sk) => [['Per knife', RH(sk.baseDmg, r)]],
        2: (r, sk) => [['Smoke time', RS(RU(5, r))], ...(sk.selectedUpg === 'A' ? [['Toxic per second', RH(sk.baseDmg, r)]] : [])],
        3: (r, sk) => [['Hit', RH(sk.baseDmg, r)]],
        4: (r, sk) => [['Per clone strike', RH(sk.baseDmg, r, MFD_MULT)], ['Mark time', RS(RU(5, r))]],
    },
    Machinist: {
        1: (r, sk) => [['Per shot', RH(sk.baseDmg, r)], ['Turrets', 1 + Math.ceil(Math.max(1, r) / 2)]],
        2: (r, sk) => [['Per pulse', RH(sk.baseDmg, r)]],
        3: (r, sk) => [['Open-ground penalty', `+${grappleMissPenalty(r).toFixed(1)}s`], ...(sk.selectedUpg === 'A' ? [['Landing slam', RH(30, r)]] : [])], // machinist.js Crash Landing
        4: (r, sk) => [['Duration', RS(RU(6, r))]],
    },
    Kensei: {
        1: (r, sk) => [['Parry Thrust', RH(sk.baseDmg, r, 1.5)], ['Blade Surge', RH(sk.baseDmg, r, 1.8)]],
        2: (r, sk) => [['Airborne flight', RS(100 / (15 * airborneDrain(r)))]],
        3: (r, sk) => [['Step distance', RP(shadowStepReach(r))], ['Guardian Orbit', RS(RU(ORBIT_TIME, r))], ...(sk.selectedUpg === 'A' && hasTalent('ke_ghost_blades') ? [['Path of Blades', RH(sk.baseDmg, r, 2)]] : [])],
        4: (r, sk) => [['Whirlwind', RH(sk.baseDmg, r, 1.5)]],
    },
    Cleric: {
        1: (r, sk) => [['Per tick', RH(sk.baseDmg, r, 0.35)]],
        2: (r, sk) => [['Heal per tick', Math.round(RU(5 + player.maxHp * (sk.selectedUpg === 'A' ? 0.05 : 0.02), r))]],
        3: (r, sk) => [['At 100 Zeal', RH(sk.baseDmg, r)]],
        4: (r, sk) => [['Duration', RS(RU(sk.selectedUpg ? 8 : 6, r))]],
    },
    Druid: {
        1: (r, sk) => [['Hit', RH(sk.baseDmg, r)]],
        2: (r, sk) => [['Bark shell', 100 + 20 * r], ['Surge time', RS(RU(SURGE_TIME, r))]],
        3: (r, sk) => [['Landing', RH(sk.baseDmg, r)]],
        4: (r, sk) => [['Howl', RH(sk.baseDmg, r)], ['Spirit bites', `${Math.round(SPIRIT_DMG * RU(1, r) * 100)}%`]],
    },
    Witch: { // witch.js
        1: (r, sk) => [['Hex', RH(sk.baseDmg, r)]],
        2: (r, sk) => { const kind = sk.selectedUpg === 'A' ? 'knight' : sk.selectedUpg === 'B' ? 'archer' : 'zombie';
            return [[{ zombie: 'Zombie claw', knight: 'Knight sword', archer: 'Skeleton arrow' }[kind], RH(sk.baseDmg, r, WT_KINDS[kind].dmg)], ['Minion HP', Math.round(minionHp(r, kind))]]; },
        3: (r, sk) => [['Flight', RS(broomTime(r))], ['Speed', `${Math.round(broomSpeed(r))} px/s`], ...(sk.selectedUpg === 'A' ? [['Crash', RH(sk.baseDmg, r)]] : []), ['Toxic trail', `${RH(activeClass.basicDmg, 1, WT_TRAIL_DPS)}/s`]],
        4: (r, sk) => [['Hex burst', RH(sk.baseDmg, r)], ...(sk.selectedUpg === 'A' ? [['Toad burst', RH(sk.baseDmg, r, 0.5)]] : sk.selectedUpg === 'B' ? [['Familiar bite', RH(sk.baseDmg, r, 0.15)]] : [])],
    },
    Swordsaint: { // swordsaint.js
        1: (r, sk) => [[sk.selectedUpg === 'B' ? 'Lunge' : 'Spin cut', RH(sk.baseDmg, r)], ['Leap slam', RH(sk.baseDmg, r, SS_SLAM_MULT)], ...(sk.selectedUpg === 'B' ? [['Plunge', RH(sk.baseDmg, r, hasTalent('ss_duel_coup') ? SS_DUEL_COUP : SS_DUEL_PLUNGE)]] : [])],
        2: (r, sk) => [[sk.selectedUpg === 'A' ? 'Cannon' : 'Burst', RH(sk.baseDmg, r)], ['Stun', RS(sk.selectedUpg === 'A' ? SS_CANNON_STUN : hasTalent('ss_air_stun') ? 0.9 : SS_AIR_STUN)]],
        3: (r, sk) => [['Charges', ssMaxCharges()], ['Crosscut', `${RH(activeClass.basicDmg, 1, SS_CROSS_MULT * basicLevelMult())} x2 + ${RH(activeClass.basicDmg, 1, SS_CROSS_BURST * basicLevelMult())}`], // a finisher: it grows with the level, as the basic does
            ...(sk.selectedUpg === 'A' ? [['Counter', RH(activeClass.basicDmg, 1, SS_COUNTER_MULT)]] : sk.selectedUpg === 'B' ? [['Overdrive cut', RH(activeClass.basicDmg, 1)]] : [])],
        4: (r, sk) => [['Unsealed', `+${Math.round(SS_UNSEAL_POWER * 100)} Power, ${hasTalent('ss_unseal_long') ? 15 : SS_UNSEAL_TIME}s`],
            sk.selectedUpg === 'B' ? ['Each moon', `${RH(sk.baseDmg, r, 0.6)} - ${RH(sk.baseDmg, r, 1.2)}`] : ['Excalibur', `${RH(sk.baseDmg, r)} - ${RH(sk.baseDmg, r, 2)}`]],
    },
    Monk: { // monk.js
        1: (r, sk) => [['Chi Wave', RH(sk.baseDmg, r)], ['Rushing Fist', `${RH(sk.baseDmg, r)} - ${RH(sk.baseDmg, r, MK_RUSH_MAX)}`],
            ...(sk.selectedUpg === 'A' && hasTalent('mk_star_splash') ? [['Falling Star', RH(sk.baseDmg, r, 0.4)]] : [])],
        2: (r, sk) => [['Palm', RH(sk.baseDmg, r)], ...(sk.selectedUpg === 'B' ? [['Stone burst', RH(sk.baseDmg, r, 0.6)]] : [])],
        3: (r, sk) => [['Iron Will lifesteal', `${Math.round(monkWillPct(r) * 100)}%`]],
        4: (r, sk) => sk.selectedUpg === 'B'
            ? [['Kick', RH(sk.baseDmg, r, MK_KICK_MULT)], ['Air blow', RH(sk.baseDmg, r, MK_RISE_BLOW)], ['Spike', RH(sk.baseDmg, r)], ['Shockwave', RH(sk.baseDmg, r, MK_RISE_SHOCK)]]
            : [['Kick', RH(sk.baseDmg, r, MK_KICK_MULT)], ['Wall slam', RH(sk.baseDmg, r, MK_SLAM_MULT)], ...(sk.selectedUpg === 'A' ? [['Wall bounce', RH(sk.baseDmg, r, MK_PIN_WALL)]] : []), ['Stomp', RH(sk.baseDmg, r, MK_STOMP_MULT)]],
    },
    Paladin: {
        1: (r, sk) => [['Throw', RH(sk.baseDmg, r)], ['Pulse', RH(sk.baseDmg, r, 0.25)]],
        2: (r, sk) => [['Chain tick', RH(sk.baseDmg, r, TETHER_TICK_MULT)]],
        3: (r, sk) => [['Hit', RH(sk.baseDmg, r)]],
        4: (r, sk) => [['Per second', RH(sk.baseDmg, r)]],
    },
};
function skillStats(slot, sk, from, to) {
    const L = [], rs = (RANK_STATS[activeClass.name] || {})[slot];
    if (rs) { // every value the rank sets: on a rank-up only the ones that change, as "before → after"
        const a = from ? rs(from, sk) : null, b = rs(to, sk);
        b.forEach(([label, v], i) => {
            if (!a) L.push(`${label} <b>${v}</b>`);
            else if (String(a[i][1]) !== String(v)) L.push(`${label} ${a[i][1]} → <b>${v}</b>`);
        });
    } else if (sk.baseDmg > 0) L.push(from ? `Hit ${Math.round(hitDmg(sk.baseDmg, from))} → <b>${Math.round(hitDmg(sk.baseDmg, to))}</b>` : `Hit <b>${Math.round(hitDmg(sk.baseDmg, to))}</b>`); // the real hit at your current Power
    // A rank-up only lists the cooldown when it actually changes (combat.js rankScalesCooldown)
    if (sk.maxCd && !from) L.push(`CD <b>${sk.maxCd}s</b>`);
    else if (sk.maxCd && rankScalesCooldown(slot)) L.push(`CD ${skillBaseCd(slot, from).toFixed(1)}s → <b>${skillBaseCd(slot, to).toFixed(1)}s</b>`);
    return L.join('<br>');
}

// ==========================================
// Wave cleared & victory
// ==========================================

function statBoxes(list) { return `<div class="stat-row">${list.map(([v, l]) => `<div class="stat-box"><div class="sv">${v}</div><div class="sl">${l}</div></div>`).join('')}</div>`; }

function showWaveCleared(o = {}) { // o: optional title / sub / next overrides (stage endings)
    gameState = STATE.INTERMISSION; uiOpenedAt = performance.now(); el('intermission-screen').classList.remove('memory-fade');
    const s = siteById(activeDungeonId), nextBoss = (wave + 1) % 5 === 0, gold = Math.max(0, player.gold - waveStats.gold0);
    const boss = isBossWave || !!o.shops; // o.shops: the rest before the throne room (map_castle.js)
    el('intermission-panel').innerHTML = `
        <h1 class="ui-title" id="intermission-title">${o.title || (boss ? 'Boss Defeated' : `Wave ${wave} Cleared`)}</h1>
        <div class="ui-sub">${o.sub || ((isEndlessMode ? 'Limitless' : s ? s.name : '') + (boss ? ` · Wave ${wave}` : ''))}</div>
        <div class="ui-divider"><span></span></div>
        ${statBoxes([[waveStats.kills, 'Kills'], [`+${gold}`, 'Gold'], [fmtTime(waveStats.time), 'Time'], [Math.round(waveStats.dmgTaken), 'Damage taken']])}
        <div class="next-wave${nextBoss ? ' boss' : ''}">Next: <b>${o.next ? o.next + ' · ' : ''}Wave ${wave + 1}${nextBoss ? ' · Boss' : ''}</b></div>
        <div class="ui-hint" style="margin-top:0">Starting the next wave restores 30% of your health &middot; <kbd>I</kbd> inventory &middot; <kbd>K</kbd> skill tree${player.skillPoints > 0 ? ` (<b style="color:var(--gold-hi)">${player.skillPoints}</b> point${player.skillPoints > 1 ? 's' : ''})` : ''}</div>
        <div class="ui-row town-row${boss ? '' : ' hidden'}" style="margin-top:18px">
            <button class="btn btn-gold" id="btn-shop" onclick="openShop()">Merchant</button>
            <button class="btn btn-gold" id="btn-smith" onclick="openSmith()">Smith</button>
            <button class="btn btn-gold" id="btn-apoth" onclick="openApothecary()">Apothecary</button>
        </div>
        <div class="ui-row" style="margin-top:${boss ? 12 : 18}px">
            <button class="btn btn-primary" onclick="startNextWave()">Next Wave <kbd>Enter</kbd></button>
            ${heroSlot >= 0 && !isTraining() && !isEndlessMode ? '<button class="btn btn-danger" onclick="heroSaveQuit()">Save &amp; Quit</button>' : ''}
        </div>`; // save.js: the hero saved here, resumed at the next wave
    el('intermission-screen').classList.remove('hidden');
}

function showVictory() {
    gameState = STATE.VICTORY;
    heroCleared(); // save.js: the dungeon is marked cleared and the hero saved
    const s = siteById(activeDungeonId);
    el('intermission-panel').innerHTML = `
        <h1 class="ui-title" id="intermission-title">Dungeon Cleared</h1>
        <div class="ui-sub">${activeMemory ? MEMORIES.fade : `You have conquered ${s ? s.name : 'this domain'}.`}</div>
        <div class="ui-divider"><span></span></div>
        ${statBoxes([[wave, 'Waves'], [score, 'Kills'], [player.level, 'Level'], [player.gold, 'Gold']])}
        <div class="ui-row" style="margin-top:22px">
            <button class="btn btn-primary" onclick="startEndlessMode()">Enter Limitless Mode</button>
            <button class="btn btn-danger" onclick="${heroSlot >= 0 ? 'heroToMap()' : 'location.reload()'}">${heroSlot >= 0 ? (baseOpen() ? 'Return to Cinderholt' : 'Back to the Map') : 'End Run'}</button>
        </div>`;
    el('intermission-screen').classList.toggle('memory-fade', !!activeMemory); // expeditions.js: the memory fades to sepia under the panel (ui.css)
    el('intermission-screen').classList.remove('hidden');
}

// ==========================================
// Keyboard shortcuts for the screens
// ==========================================

window.addEventListener('keydown', e => {
    if (e.repeat || performance.now() - uiOpenedAt < 350) return;
    const k = e.key.toLowerCase(), open = id => !el(id).classList.contains('hidden');
    if (gameState === STATE.TREE && open('tree-screen')) { // skilltree.js
        if (tree.pending && k === 'enter') takeNode(tree.pending);
        else if (tree.pending && k === 'escape') treeCancel();
        else if (k === 'k' || k === 'escape') closeTree();
    } else if (gameState === STATE.INTERMISSION && open('intermission-screen')) {
        if (k === 'enter') startNextWave();
        else if (k === 'i') openInventory();
        else if (k === 'k') openTree();
    } else if (gameState === STATE.PLAYING && (k === 'i' || k === 'k')) {
        if (player.hp > 0 && !(stageEvent && stageEvent.blocking)) k === 'i' ? openInventory() : openTree(); // any time in a fight: they pause the game
    } else if (k === 'escape' || (k === 'i' && open('inventory-screen'))) {
        if (open('inventory-screen')) closeInventory();
        else if (open('shop-screen')) closeShop();
        else if (open('smith-screen')) closeSmith();
        else if (open('apothecary-screen')) closeApothecary();
        else if (open('rebuild-screen')) closeRebuild(); // rebuild.js
    }
});

// ==========================================
// Dev console
// ==========================================

window.openDevMenu = function() {
    gameState = STATE.DEV; el('dev-screen').classList.remove('hidden');
    const s = siteById(activeDungeonId);
    el('dev-readout').innerHTML = [
        ['Class', activeClass.name], ['Dungeon', s ? s.name : activeDungeonId], ['Wave', wave + (isBossWave ? ' (boss)' : '')],
        ['Level', `${player.level} (${Math.floor(player.xp)}/${player.maxXp} XP)`], ['Upgrade cap', '+' + upgradeCap()], ['Health', `${Math.ceil(player.hp)} / ${Math.round(player.maxHp)}`],
        ['Enemies', `${activeEnemies} alive, ${enemiesToSpawn} to spawn`], ['Gold', player.gold],
    ].map(([k, v]) => `${k}: <b>${v}</b>`).join('<br>');
    el('dev-wave-input').value = wave + 1;
};
window.devJumpWave = function() {
    const w = parseInt(el('dev-wave-input').value);
    if (!isNaN(w) && w > 0) {
        wave = w - 1;
        enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0;
        activeEnemies = 0; enemiesToSpawn = 0;
        closeDevMenu(); startNextWave();
    }
}
window.devLevelUp = function() { gainXP(player.maxXp - player.xp); openDevMenu(); } // the point waits on the skill tree (K)
window.devAddGold = function(n = 1000) { player.gold += n; updateHUD(); openDevMenu(); }
window.devSetLevel = function() { // the points come as for real level-ups (two a level); going down only lowers the level
    const L = parseInt(el('dev-level-input').value); if (isNaN(L) || L < 1) return;
    if (L > player.level) player.skillPoints += (L - player.level) * TREE_PTS_PER_LEVEL;
    player.level = L; player.xp = 0; player.maxXp = xpToNext(L); updateHUD(); openDevMenu();
}
window.devUnlockDungeons = function() { // the story gate: the Slime Caves count as cleared on this hero (Quick Play has no gate)
    if (heroData) { heroData.cleared = [...new Set([...(heroData.cleared || []), 'slime_caves'])]; saveHero({ cleared: heroData.cleared }); heroMapLocks(); }
    openDevMenu();
}
window.devKillAll = function() {
    closeDevMenu(); // back to PLAYING first, so the last kill can trigger the wave-cleared screen
    for(let i = enemies.length - 1; i >= 0; i--) { enemies[i].hp = 0; checkEnemyDeath(enemies[i]); }
    removeDeadEnemies();
}
window.devToggleCooldowns = function() {
    devNoCooldowns = !devNoCooldowns;
    el('btn-dev-cd').textContent = devNoCooldowns ? 'No cooldowns: ON' : 'No cooldowns: OFF';
    el('btn-dev-cd').classList.toggle('on', devNoCooldowns);
}
window.devOpenShop = function() { closeDevMenu(); openShop(); } // closeDevMenu sets PLAYING, so the shop knows to return to the fight
window.devTalk = function(id) { closeDevMenu(); const f = FRIENDS[id]; openDialogue({ name: f.name, title: f.title, portrait: id, lines: f.lines }); } // npcs.js: the talk alone, no shop after
window.devVisitBase = function() { closeDevMenu(); startBase(); } // map_base.js: the village by day, the friends in it
window.devVisitSmithy = function() { closeDevMenu(); if (!isBase()) startBase(); goThrough('smithy', INTERIORS.smithy.arrive); } // interiors.js: no door leads there yet
window.devAddMats = function() { for (const k of MAT_KEYS) mats[k] += 50; updateHUD(); openDevMenu(); } // caches.js
window.devResetBase = function() { closeDevMenu(); resetCinderholt(); } // rebuild.js: no rebuilds, the arrival unseen
window.devFriendsWalk = function() { // npcs.js: the three wander round the hero's spot; again sends them away
    closeDevMenu();
    if (npcs.length) { npcs = []; return; }
    ['smith', 'apothecary', 'merchant'].forEach((id, i) => addNpc(id, player.x + Math.cos(i * 2.1) * 170, player.y + Math.sin(i * 2.1) * 170));
}
window.closeDevMenu = function() { el('dev-screen').classList.add('hidden'); gameState = STATE.PLAYING; lastTime = performance.now(); }
