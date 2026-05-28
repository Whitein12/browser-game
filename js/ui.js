// ==========================================
// ui.js - User Interface, HUD, & Menus
// ==========================================

window.updateHUD = function() {
    if (!activeClass) return;
    
    el('class-name').innerText = `${activeClass.name} Lv.${player.level}`;
    el('hp-bar').style.width = Math.max(0, (player.hp / player.maxHp * 100)) + '%'; 
    el('shield-bar').style.width = Math.min(100, (player.shield / player.maxHp * 100)) + '%'; 
    el('hp-text').innerText = player.shield > 0 ? `${Math.ceil(player.hp)} (+${Math.ceil(player.shield)}) / ${player.maxHp}` : `${Math.ceil(player.hp)} / ${player.maxHp}`;
    
    el('xp-bar').style.width = Math.max(0, (player.xp / player.maxXp * 100)) + '%'; 
    el('xp-text').innerText = `${player.xp} / ${player.maxXp} XP`;
    
    el('hud-wave').innerText = `Wave: ${wave}`;
    el('hud-enemies').innerText = `Remaining: ${enemiesToSpawn + activeEnemies}`;
    el('hud-gold').innerText = `Gold: ${player.gold}`;

    if (activeClass.name === 'Swordsaint') {
        el('flow-bar-container').classList.remove('hidden');
        el('flow-bar').style.width = `${player.flow || 0}%`;
    } else {
        el('flow-bar-container').classList.add('hidden');
    }

    let bottomHudHTML = '';
    const keys = ['Q', 'E', 'SPACE', 'R', 'RMB'];
    const cdKeys = ['s1', 's2', 's3', 's4', 'rmb'];
    
    for(let i=0; i<5; i++) {
        let maxCd = i === 4 ? 4.0 : (activeClass.skills[i+1] ? activeClass.skills[i+1].maxCd : 0);
        let curCd = cooldowns[cdKeys[i]] || 0;
        let pct = maxCd > 0 ? (curCd / maxCd) : 0;
        let offset = 144 - (144 * (1.0 - pct)); 
        let opacity = curCd > 0 ? 0.5 : 1.0;
        
        bottomHudHTML += `
        <div class="cd-circle" style="opacity: ${opacity}">
            ${curCd > 0 ? Math.ceil(curCd) : ''}
            <svg><circle cx="25" cy="25" r="23" style="stroke-dashoffset: ${offset}"></circle></svg>
            <div class="cd-key">${keys[i]}</div>
        </div>`;
    }
    el('bottom-hud').innerHTML = bottomHudHTML;

    let passives = [];
    if (player.bonusDmg > 0) passives.push(`Perm DMG: +${Math.round(player.bonusDmg * 100)}%`);
    if (activeClass.name === 'Dragonknight' && player.frenzyStacks > 0) passives.push(`Frenzy: ${player.frenzyStacks}`);
    if (activeClass.name === 'Ranger' && player.momentum > 0) passives.push(`Momentum: +${Math.round(player.momentum * 100)}%`);
    if (buffs.powerSurgeStacks > 0) passives.push(`Power Surge: ${buffs.powerSurgeStacks}`);
    if (buffs.weakened > 0) passives.push(`WEAKENED`);
    if (activeClass.name === 'Machinist' && buffs.overclockTimer > 0) passives.push(`OVERCLOCK: ${buffs.overclockTimer.toFixed(1)}s`);
    el('perm-display').innerText = passives.join(' | ');
};

// ==========================================
// LEVEL UP & UPGRADES
// ==========================================

window.triggerLevelUp = function(customText) {
    if (gameState === STATE.DEAD) return;
    gameState = STATE.MENU;
    el('levelup-title').innerText = customText || "LEVEL UP!";
    el('levelup-screen').classList.remove('hidden');
    
    let html = '';
    for (let i = 1; i <= 4; i++) {
        let sk = activeClass.skills[i];
        if (sk.level < 5) {
            html += `<button class="btn" style="width: 100%; text-align: left;" onclick="selectSkill(${i})">
                        <span style="color:#ffeb3b;">[Level ${sk.level + 1}]</span> ${sk.name} <br>
                        <span style="font-size:12px; color:#aaa;">${sk.desc}</span>
                     </button>`;
        } else if (sk.level === 5 && !sk.selectedUpg) {
            html += `<button class="btn" style="width: 100%; text-align: left; border-color:#00e5ff;" onclick="openUpgradeScreen(${i})">
                        <span style="color:#00e5ff;">[EVOLVE]</span> ${sk.name} <br>
                        <span style="font-size:12px; color:#aaa;">Select a permanent evolution path.</span>
                     </button>`;
        }
    }
    
    html += `<button class="btn" style="width: 100%; text-align: left; border-color:#4caf50;" onclick="selectStat('hp')">
                <span style="color:#4caf50;">[STAT]</span> Vitality Boost <br>
                <span style="font-size:12px; color:#aaa;">+20 Max HP and heal to full.</span>
             </button>`;
    html += `<button class="btn" style="width: 100%; text-align: left; border-color:#ff9800;" onclick="selectStat('dmg')">
                <span style="color:#ff9800;">[STAT]</span> Raw Power <br>
                <span style="font-size:12px; color:#aaa;">+5% Permanent Damage.</span>
             </button>`;

    el('skill-buttons').innerHTML = html;
};

window.selectSkill = function(idx) {
    activeClass.skills[idx].level++;
    player.skillPoints--;
    resumeGameAfterMenu();
};

window.selectStat = function(type) {
    if (type === 'hp') { player.maxHp += 20; player.hp = player.maxHp; }
    if (type === 'dmg') { player.bonusDmg += 0.05; }
    player.skillPoints--;
    resumeGameAfterMenu();
};

let pendingUpgradeSkill = null;
window.openUpgradeScreen = function(idx) {
    el('levelup-screen').classList.add('hidden');
    el('upgrade-screen').classList.remove('hidden');
    pendingUpgradeSkill = activeClass.skills[idx];
    el('evolve-skill-name').innerText = pendingUpgradeSkill.name;
    el('upg-a-desc').innerText = pendingUpgradeSkill.upgA;
    el('upg-b-desc').innerText = pendingUpgradeSkill.upgB;
};

window.selectUpgrade = function(path) {
    if (pendingUpgradeSkill) pendingUpgradeSkill.selectedUpg = path;
    pendingUpgradeSkill = null;
    player.skillPoints--;
    el('upgrade-screen').classList.add('hidden');
    resumeGameAfterMenu();
};

function resumeGameAfterMenu() {
    if (player.skillPoints > 0) {
        triggerLevelUp();
    } else {
        el('levelup-screen').classList.add('hidden');
        gameState = STATE.PLAYING;
        lastTime = performance.now();
    }
}

// ==========================================
// INVENTORY
// ==========================================

window.openInventory = function() {
    gameState = STATE.MENU;
    el('inventory-screen').classList.remove('hidden');
    renderInventory();
};

window.closeInventory = function() {
    el('inventory-screen').classList.add('hidden');
    recalcStats();
    if (activeEnemies === 0 && enemiesToSpawn === 0) {
        el('intermission-screen').classList.remove('hidden');
    } else {
        gameState = STATE.PLAYING;
        lastTime = performance.now();
    }
};

window.renderInventory = function() {
    const slots = ['weapon', 'armor', 'amulet', 'boots', 'gloves'];
    slots.forEach(slot => {
        const item = equipment[slot];
        if (item) {
            el(`equip-${slot}`).innerHTML = `
                <div><span style="color:${item.rarity==='rare'?'#b39ddb':'#fff'}">${item.name}</span><br><span class="item-stats">${item.desc}</span></div>
                <button class="btn btn-dev" style="padding: 5px 10px;" onclick="unequipItem('${slot}')">Unequip</button>
            `;
            el(`equip-${slot}`).className = `item-slot ${item.rarity === 'rare' ? 'rare' : ''}`;
        } else {
            el(`equip-${slot}`).innerHTML = `<div style="color:#555;">Empty ${slot.toUpperCase()} Slot</div>`;
            el(`equip-${slot}`).className = 'item-slot';
        }
    });

    let bpHTML = '';
    inventory.forEach((item, index) => {
        bpHTML += `
        <div class="item-slot ${item.rarity === 'rare' ? 'rare' : ''}">
            <div><span style="color:${item.rarity==='rare'?'#b39ddb':'#fff'}">${item.name}</span><br><span class="item-stats">${item.desc}</span></div>
            <button class="btn btn-dev" style="padding: 5px 10px; border-color:#4caf50; color:#4caf50;" onclick="equipItem(${index})">Equip</button>
        </div>`;
    });
    el('backpack-list').innerHTML = bpHTML || '<div style="color:#555;">Backpack is empty.</div>';
};

window.equipItem = function(index) {
    const item = inventory.splice(index, 1)[0];
    if (equipment[item.type]) { inventory.push(equipment[item.type]); }
    equipment[item.type] = item;
    renderInventory(); recalcStats();
};

window.unequipItem = function(slot) {
    if (equipment[slot]) {
        inventory.push(equipment[slot]);
        equipment[slot] = null;
        renderInventory(); recalcStats();
    }
};

// ==========================================
// SHOP
// ==========================================

window.openShop = function() {
    gameState = STATE.MENU;
    el('intermission-screen').classList.add('hidden');
    el('shop-screen').classList.remove('hidden');
    renderShop();
};

window.closeShop = function() {
    el('shop-screen').classList.add('hidden');
    el('intermission-screen').classList.remove('hidden');
};

window.renderShop = function() {
    el('shop-gold-display').innerText = `Your Gold: ${player.gold}`;
    
    // Auto-generate some dummy shop items for now based on wave
    let shopItems = [
        { name: "Health Potion", desc: "Restores 50% HP immediately.", type: "consumable", cost: 20 },
        { name: "Iron Ring", desc: "+10 Max HP", type: "amulet", rarity: "common", val: 10, cost: 50 },
        { name: "Swift Boots", desc: "+20 Move Speed", type: "boots", rarity: "common", val: 20, cost: 60 }
    ];

    let buyHTML = '';
    shopItems.forEach((item, index) => {
        let canAfford = player.gold >= item.cost;
        buyHTML += `
        <div class="item-slot">
            <div><span style="color:#fff">${item.name}</span> <span class="price-tag">(${item.cost}g)</span><br><span class="item-stats">${item.desc}</span></div>
            <button class="btn btn-dev" style="padding: 5px 10px; border-color:#ffd54f; color:#ffd54f;" ${canAfford ? '' : 'disabled'} onclick="buyItem(${index})">Buy</button>
        </div>`;
    });
    el('shop-buy-list').innerHTML = buyHTML;

    let sellHTML = '';
    inventory.forEach((item, index) => {
        let sellPrice = item.rarity === 'rare' ? 50 : 15;
        sellHTML += `
        <div class="item-slot ${item.rarity === 'rare' ? 'rare' : ''}">
            <div><span style="color:${item.rarity==='rare'?'#b39ddb':'#fff'}">${item.name}</span> <span class="price-tag">(Sell: ${sellPrice}g)</span><br><span class="item-stats">${item.desc}</span></div>
            <button class="btn btn-dev" style="padding: 5px 10px;" onclick="sellItem(${index}, ${sellPrice})">Sell</button>
        </div>`;
    });
    el('shop-sell-list').innerHTML = sellHTML || '<div style="color:#555;">Nothing to sell.</div>';
};

window.buyItem = function(index) { /* Placeholder for actual item logic */ player.gold -= 20; updateHUD(); renderShop(); };
window.sellItem = function(index, price) { inventory.splice(index, 1); player.gold += price; updateHUD(); renderShop(); };

// ==========================================
// DEV CONSOLE
// ==========================================

window.closeDevMenu = function() {
    el('dev-screen').classList.add('hidden');
    gameState = STATE.PLAYING; lastTime = performance.now();
};

window.devJumpWave = function() {
    wave = parseInt(el('dev-wave-input').value) - 1;
    activeEnemies = 0; enemiesToSpawn = 0; enemies = []; projectiles = [];
    closeDevMenu(); startNextWave();
};

window.devLevelUp = function() { player.xp = player.maxXp; checkEnemyDeath({hp:0}); };
window.devAddGold = function() { player.gold += 1000; updateHUD(); };
window.devKillAll = function() { enemies.forEach(e => e.hp = 0); };
window.devToggleCooldowns = function() {
    devNoCooldowns = !devNoCooldowns;
    el('btn-dev-cd').innerText = devNoCooldowns ? "Cooldowns: Zero" : "Cooldowns: Normal";
};
window.devOpenShop = function() { closeDevMenu(); openShop(); };