// ==========================================
// ui.js - Level up & evolution, wave cleared / victory, inventory, shop, tooltips, dev console
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
function itemTier(item) { const m = /^T(\d+)/.exec(item.name); return m ? +m[1] : null; }
function itemTypeLine(item) { return item.rarity === 'rare' ? `Rare ${SLOT_NAMES[item.type]}` : `Tier ${itemTier(item) || 1} ${SLOT_NAMES[item.type]}`; }
// Rare amulets work by name rather than by value, so they can't be compared as a number
function comparable(a, b) { return !(a.type === 'amulet' && (a.rarity === 'rare' || (b && b.rarity === 'rare'))); }
function itemDelta(item) { const eq = equipment[item.type]; if (!eq || eq === item || !comparable(item, eq)) return null; return item.val - eq.val; }
function isUpgrade(item) { const eq = equipment[item.type]; if (!eq) return true; const d = itemDelta(item); return d !== null && d > 0; }

function itemTooltip(item, foot) {
    const eq = equipment[item.type], worn = eq === item;
    let cmp = '';
    if (!worn) {
        if (!eq) cmp = `<div class="tt-cmp up">Empty slot: a straight upgrade</div>`;
        else if (!comparable(item, eq)) cmp = `<div class="tt-cmp same">Unique effect: compare with ${eq.name}</div>`;
        else {
            const d = item.val - eq.val, cls = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
            cmp = `<div class="tt-cmp ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${d === 0 ? 'Same as worn' : fmtStat(item.type, Math.abs(d)).replace(/^\+?/, d > 0 ? '+' : '-')} vs. ${eq.name}</div>`;
        }
    }
    return `<div class="tt-name" style="color:${item.rarity === 'rare' ? 'var(--rare)' : 'var(--text)'}">${item.name}</div>
        <div class="tt-type">${itemTypeLine(item)}${worn ? ' · worn' : ''}</div>
        <div class="tt-stat">${item.desc}</div>${cmp}${foot ? `<div class="tt-foot">${foot}</div>` : ''}`;
}
// An inventory-style square showing one item (or an empty slot)
function itemCell(item, opts = {}) {
    const d = document.createElement('div');
    d.className = 'item-cell' + (!item ? ' empty' : item.rarity === 'rare' ? ' rare' : '');
    if (item) {
        const tier = itemTier(item);
        d.innerHTML = `<img src="${itemIcon(item)}">${tier ? `<span class="tier">T${tier}</span>` : ''}${opts.better && isUpgrade(item) ? '<span class="better">▲</span>' : ''}`;
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

let dollAnim = 0;
window.openInventory = () => {
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
window.closeInventory = () => { hideTooltip(); el('inventory-screen').classList.add('hidden'); el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION; };

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
    const dmg = (activeClass.dmgMult + (equipment.weapon ? equipment.weapon.val : 0)) * (1 + player.bonusDmg);
    const rows = [
        ['Max Health', Math.round(player.maxHp)], ['Armor', player.armor], ['Damage', `${Math.round(dmg * 100)}%`],
        ['Attack Speed', `+${Math.round((equipment.gloves ? equipment.gloves.val : 0) * 100)}%`],
        ['Cooldown Reduction', `${Math.round((1 - getCDR()) * 100)}%`], ['Move Speed', Math.round(player.speed)],
        ['Gold', player.gold],
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

let shopFromFight = false; // opened mid-fight from the dev console: leaving goes back to the fight, not to the wave-cleared screen
window.openShop = () => {
    shopFromFight = gameState === STATE.PLAYING;
    gameState = STATE.SHOP; uiOpenedAt = performance.now();
    el('intermission-screen').classList.add('hidden'); el('shop-screen').classList.remove('hidden');
    if (shopWave !== wave) { generateShop(); shopWave = wave; } // stock is fixed for this visit; leaving and coming back doesn't re-roll it
    renderShop();
};
window.closeShop = () => {
    hideTooltip(); el('shop-screen').classList.add('hidden');
    if (shopFromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); return; }
    el('intermission-screen').classList.remove('hidden'); gameState = STATE.INTERMISSION;
};

function generateShop() {
    shopItems = []; for (let i = 0; i < 3; i++) shopItems.push(generateItem(wave + 2));
    shopItems.push({ id: 'rare_wep', name: activeClass.rareWeapon.name, type: 'weapon', val: 1.0, desc: activeClass.rareWeapon.desc, price: 250, rarity: 'rare' });
    shopItems.push({ id: 'rare_arm', name: activeClass.rareArmor.name, type: 'armor', val: 240, desc: activeClass.rareArmor.desc, price: 200, rarity: 'rare' });
    shopItems.push({ id: 'rare_amu', name: activeClass.rareAmulet.name, type: 'amulet', val: 0.20, desc: activeClass.rareAmulet.desc, price: 200, rarity: 'rare' });
    shopItems.push({ id: 'rare_bot', name: activeClass.rareBoots.name, type: 'boots', val: 50, desc: activeClass.rareBoots.desc, price: 150, rarity: 'rare' });
    shopItems.push({ id: 'rare_glv', name: activeClass.rareGloves.name, type: 'gloves', val: 0.25, desc: activeClass.rareGloves.desc, price: 150, rarity: 'rare' });
}

function renderShop() {
    el('shop-gold-display').textContent = player.gold;
    const buy = el('shop-buy-list'); buy.innerHTML = '';
    shopItems.forEach(item => {
        const afford = player.gold >= item.price, d = document.createElement('div');
        d.className = 'ware' + (item.rarity === 'rare' ? ' rare' : '') + (afford ? '' : ' poor');
        d.appendChild(itemCell(item));
        d.insertAdjacentHTML('beforeend', `<div class="w-name">${item.name}</div><div class="w-stat">${item.desc}</div><div class="w-price"><span class="coin"></span>${item.price}</div>`);
        bindTooltip(d, () => itemTooltip(item, afford ? `Click to buy for ${item.price} gold` : `You need ${item.price - player.gold} more gold`));
        d.onclick = () => {
            if (player.gold < item.price) return;
            hideTooltip(); player.gold -= item.price; inventory.push(item); shopItems.splice(shopItems.indexOf(item), 1); renderShop(); updateHUD();
        };
        buy.appendChild(d);
    });
    if (!shopItems.length) buy.innerHTML = '<div class="ui-hint" style="grid-column:1/-1">Sold out. The merchant looks pleased.</div>';
    fillBackpack(el('shop-sell-list'), {
        tip: item => `Click to sell for ${Math.floor(item.price * 0.5)} gold`,
        click: item => { player.gold += Math.floor(item.price * 0.5); inventory.splice(inventory.indexOf(item), 1); renderShop(); updateHUD(); },
    });
}

// ==========================================
// Level up & evolution
// ==========================================

function skillStats(sk, from, to) {
    const L = [];
    if (sk.baseDmg > 0) L.push(from ? `DMG ${Math.round(calcUtility(sk.baseDmg, from))} → <b>${Math.round(calcUtility(sk.baseDmg, to))}</b>` : `DMG <b>${sk.baseDmg}</b>`);
    if (sk.maxCd) L.push(from ? `CD ${calcCooldown(sk.maxCd, from).toFixed(1)}s → <b>${calcCooldown(sk.maxCd, to).toFixed(1)}s</b>` : `CD <b>${sk.maxCd}s</b>`);
    return L.join('<br>');
}

function triggerLevelUp(customTitle = null) {
    if (gameState === STATE.EVOLVE || player.skillPoints <= 0) return;
    gameState = STATE.LEVELUP; isProcessingClick = false; uiOpenedAt = performance.now();

    el('levelup-title').textContent = customTitle ? customTitle : 'Level Up';
    el('levelup-sub').innerHTML = customTitle ? 'Pick the skill you start the run with' : `Level ${player.level} · ${player.skillPoints} skill point${player.skillPoints > 1 ? 's' : ''} to spend`;
    el('levelup-screen').classList.remove('hidden');
    const container = el('skill-buttons'); container.innerHTML = '';
    const cid = activeClassId();

    let allMaxed = true;
    for (let i = 1; i <= 4; i++) {
        const sk = activeClass.skills[i], card = document.createElement('div');
        card.className = 'skill-card'; card.style.setProperty('--cc', classColor()); card.dataset.slot = i;
        let action, stats = '', pick = null;
        if (i === 4 && player.level < 5 && sk.level === 0 && !customTitle) { action = 'Unlocks at Lv. 5'; card.classList.add('disabled'); }
        else if (sk.level >= 4) { action = `Mastered · ${sk.selectedUpg === 'B' ? sk.upgB.name : sk.upgA.name}`; card.classList.add('disabled'); }
        else {
            allMaxed = false;
            if (sk.level === 0) { action = 'Unlock'; stats = skillStats(sk, 0, 1); }
            else if (sk.level === 3) { action = 'Evolve'; card.classList.add('evolve'); stats = `<span style="color:#b39ddb">${sk.upgA.name}</span><br>or <span style="color:#ffab91">${sk.upgB.name}</span>`; }
            else { action = `Rank ${sk.level} → ${sk.level + 1}`; stats = skillStats(sk, sk.level, sk.level + 1); }
            pick = () => {
                if (isProcessingClick) return; isProcessingClick = true;
                if (sk.level === 3) triggerEvolution(i); else { sk.level++; finishLevelUp(); }
            };
        }
        const pips = [0, 1, 2, 3].map(k => `<i class="${k < sk.level ? 'on' : (k === sk.level && pick ? 'next' : '')}"></i>`).join('');
        card.innerHTML = `<kbd class="sc-key">${i}</kbd><span class="sc-slot">${SLOT_KEYS[i] === 'SPC' ? 'Space' : SLOT_KEYS[i]}</span><img class="sc-icon" src="${skillIcon(cid, i)}">
            <div class="sc-name">${sk.name}</div><div class="sc-pips">${pips}</div><div class="sc-action">${action}</div><div class="sc-stats">${stats}</div>`;
        if (pick) card.onclick = pick;
        container.appendChild(card);
    }

    if (allMaxed && !customTitle) {
        const card = document.createElement('div'); card.className = 'skill-card bonus'; card.dataset.slot = 'bonus';
        card.innerHTML = `<div class="sc-name">All skills mastered</div><div class="sc-action">Take a blessing</div><div class="sc-stats">Max HP <b>+20</b><br>Damage <b>+5%</b></div>`;
        card.onclick = () => {
            if (isProcessingClick) return; isProcessingClick = true;
            player.bonusMaxHp += 20; recalcStats(); player.hp += 20; player.bonusDmg += 0.05; finishLevelUp();
        };
        container.appendChild(card);
    }
}

function triggerEvolution(skillIndex) {
    el('levelup-screen').classList.add('hidden'); gameState = STATE.EVOLVE; evolvingSkillId = skillIndex; uiOpenedAt = performance.now();
    const sk = activeClass.skills[skillIndex];
    el('upgrade-screen').classList.remove('hidden');
    el('evolve-skill-icon').src = skillIcon(activeClassId(), skillIndex);
    el('evolve-skill-name').textContent = sk.name;
    el('upg-a-title').textContent = sk.upgA.name; el('upg-a-desc').textContent = sk.upgA.desc;
    el('upg-b-title').textContent = sk.upgB.name; el('upg-b-desc').textContent = sk.upgB.desc;
    isProcessingClick = false;
}

window.selectUpgrade = function(path) {
    if (gameState !== STATE.EVOLVE || isProcessingClick) return; isProcessingClick = true;
    const sk = activeClass.skills[evolvingSkillId]; sk.level++; sk.selectedUpg = path;
    el('upgrade-screen').classList.add('hidden');
    el('dev-screen').classList.add('hidden'); // Force hide dev menu if it was open behind the upgrade screen
    gameState = STATE.LEVELUP;
    finishLevelUp();
}

function finishLevelUp() {
    player.skillPoints--;
    if (player.skillPoints > 0) { triggerLevelUp(); }
    else {
        el('levelup-screen').classList.add('hidden'); updateHUD();
        isProcessingClick = false; // Reset the click latch immediately when done!
        if (wave === 0) startNextWave();
        else if (enemiesToSpawn === 0 && activeEnemies === 0) onWaveCleared(); // stage.js
        else {
            gameState = STATE.PLAYING;
            lastTime = performance.now();
        }
    }
}

// ==========================================
// Wave cleared & victory
// ==========================================

function statBoxes(list) { return `<div class="stat-row">${list.map(([v, l]) => `<div class="stat-box"><div class="sv">${v}</div><div class="sl">${l}</div></div>`).join('')}</div>`; }

function showWaveCleared(o = {}) { // o: optional title / sub / next overrides (stage endings)
    gameState = STATE.INTERMISSION; uiOpenedAt = performance.now();
    const s = siteById(activeDungeonId), nextBoss = (wave + 1) % 5 === 0, gold = Math.max(0, player.gold - waveStats.gold0);
    const boss = isBossWave;
    el('intermission-panel').innerHTML = `
        <h1 class="ui-title" id="intermission-title">${o.title || (boss ? 'Boss Defeated' : `Wave ${wave} Cleared`)}</h1>
        <div class="ui-sub">${o.sub || ((isEndlessMode ? 'Limitless' : s ? s.name : '') + (boss ? ` · Wave ${wave}` : ''))}</div>
        <div class="ui-divider"><span></span></div>
        ${statBoxes([[waveStats.kills, 'Kills'], [`+${gold}`, 'Gold'], [fmtTime(waveStats.time), 'Time'], [Math.round(waveStats.dmgTaken), 'Damage taken']])}
        <div class="next-wave${nextBoss ? ' boss' : ''}">Next: <b>${o.next ? o.next + ' · ' : ''}Wave ${wave + 1}${nextBoss ? ' · Boss' : ''}</b></div>
        <div class="ui-hint" style="margin-top:0">Starting the next wave restores 30% of your health.</div>
        <div class="ui-row" style="margin-top:18px">
            <button class="btn" onclick="openInventory()">Inventory${inventory.length ? `<span class="badge">${inventory.length}</span>` : ''} <kbd>I</kbd></button>
            <button class="btn btn-gold${boss ? '' : ' hidden'}" id="btn-shop" onclick="openShop()">Visit Shop</button>
            <button class="btn btn-primary" onclick="startNextWave()">Next Wave <kbd>Enter</kbd></button>
        </div>`;
    el('intermission-screen').classList.remove('hidden');
}

function showVictory() {
    gameState = STATE.VICTORY;
    const s = siteById(activeDungeonId);
    el('intermission-panel').innerHTML = `
        <h1 class="ui-title" id="intermission-title">Dungeon Cleared</h1>
        <div class="ui-sub">You have conquered ${s ? s.name : 'this domain'}.</div>
        <div class="ui-divider"><span></span></div>
        ${statBoxes([[wave, 'Waves'], [score, 'Kills'], [player.level, 'Level'], [player.gold, 'Gold']])}
        <div class="ui-row" style="margin-top:22px">
            <button class="btn btn-primary" onclick="startEndlessMode()">Enter Limitless Mode</button>
            <button class="btn btn-danger" onclick="location.reload()">End Run</button>
        </div>`;
    el('intermission-screen').classList.remove('hidden');
}

// ==========================================
// Keyboard shortcuts for the screens
// ==========================================

window.addEventListener('keydown', e => {
    if (e.repeat || performance.now() - uiOpenedAt < 350) return;
    const k = e.key.toLowerCase(), open = id => !el(id).classList.contains('hidden');
    if (gameState === STATE.LEVELUP && open('levelup-screen')) {
        // Number keys, not Q/E/Space/R: level-ups pop mid-fight and a skill key pressed a moment too late shouldn't spend the point
        const slot = { '1': 1, '2': 2, '3': 3, '4': 4, enter: 'bonus' }[k];
        const card = slot && el('skill-buttons').querySelector(`[data-slot="${slot}"]`);
        if (card && card.onclick) card.onclick();
    } else if (gameState === STATE.EVOLVE && open('upgrade-screen')) {
        if (k === '1' || k === 'arrowleft') selectUpgrade('A');
        else if (k === '2' || k === 'arrowright') selectUpgrade('B');
    } else if (gameState === STATE.INTERMISSION && open('intermission-screen')) {
        if (k === 'enter') startNextWave();
        else if (k === 'i') openInventory();
    } else if (k === 'escape' || (k === 'i' && open('inventory-screen'))) {
        if (open('inventory-screen')) closeInventory();
        else if (open('shop-screen')) closeShop();
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
        ['Level', `${player.level} (${Math.floor(player.xp)}/${player.maxXp} XP)`], ['Health', `${Math.ceil(player.hp)} / ${Math.round(player.maxHp)}`],
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
window.devLevelUp = function() { gainXP(player.maxXp - player.xp); openDevMenu(); } // the points wait until the console closes
window.devAddGold = function() { player.gold += 1000; updateHUD(); openDevMenu(); }
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
window.closeDevMenu = function() { el('dev-screen').classList.add('hidden'); gameState = STATE.PLAYING; lastTime = performance.now(); }
