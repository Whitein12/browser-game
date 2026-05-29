// ==========================================
// ui.js - Menus, HUD, and Dev Console
// ==========================================

function updateHUD() {
    if (!activeClass) return;
    el('class-name').innerText = `${activeClass.name} Lv.${player.level}`;
    el('hp-bar').style.width = Math.max(0, (player.hp / player.maxHp * 100)) + '%'; 
    el('shield-bar').style.width = Math.min(100, (player.shield / player.maxHp * 100)) + '%'; 
    el('hp-text').innerText = player.shield > 0 ? `${Math.ceil(player.hp)} (+${Math.ceil(player.shield)}) / ${player.maxHp}` : `${Math.ceil(player.hp)} / ${player.maxHp}`;
    el('xp-bar').style.width = Math.max(0, (player.xp / player.maxXp * 100)) + '%'; el('xp-text').innerText = `${player.xp} / ${player.maxXp} XP`;
    
    if (activeClass.name === 'Swordsaint') {
        el('flow-bar-container').style.display = 'block';
        el('flow-bar').style.width = Math.max(0, (player.flow / player.maxFlow * 100)) + '%';
        el('flow-text').innerText = `${Math.floor(player.flow)} / ${player.maxFlow} Flow`;
    } else {
        el('flow-bar-container').style.display = 'none';
    }

    el('wave-display').innerText = `Wave ${wave}`; el('wave-subtext').innerText = `Enemies Left: ${enemiesToSpawn + activeEnemies}`; el('gold-display').innerText = `Gold: ${player.gold}`;

    let cdText = [];
    const keyLabels = {1: 'Q', 2: 'E', 3: 'SPC', 4: 'R'};
    for(let i=1; i<=4; i++) { if (activeClass.skills[i].level > 0) cdText.push(`${keyLabels[i]}: ${Math.max(0, cooldowns[`s${i}`]).toFixed(1)}s`); }
    if (equipment.weapon && equipment.weapon.rarity === 'rare') cdText.push(`RMB: ${Math.max(0, cooldowns.rmb).toFixed(1)}s`);
    el('cd-display').innerText = cdText.join(' | ');

    let skillText = [];
    for(let i=1; i<=4; i++) { if (activeClass.skills[i].level > 0) skillText.push(`${keyLabels[i]}: ${activeClass.skills[i].name}`); }
    if (equipment.weapon && equipment.weapon.rarity === 'rare') skillText.push(`RMB: ${activeClass.rareWeapon.rmbSkill}`);
    el('skill-display').innerText = skillText.join(' | ');
    
    let passives = [];
    if (player.bonusDmg > 0) passives.push(`Perm DMG: +${Math.round(player.bonusDmg * 100)}%`);
    if (activeClass.name === 'Dragonknight' && player.frenzyStacks > 0) passives.push(`Frenzy: ${player.frenzyStacks}`);
    if (activeClass.name === 'Ranger' && player.momentum > 0) passives.push(`Momentum: +${Math.round(player.momentum * 100)}%`);
    if (activeClass.name === 'Swordsaint') passives.push(player.stance === 'handheld' ? `Handheld (Flow: DMG)` : `Airborne (Flow: ATK SPD)`);
    if (buffs.powerSurgeStacks > 0) passives.push(`Power Surge: ${buffs.powerSurgeStacks}`);
    if (buffs.weakened > 0) passives.push(`WEAKENED`);

    if (activeClass.name === 'Machinist' && buffs.overclockTimer > 0) passives.push(`OVERCLOCK: ${buffs.overclockTimer.toFixed(1)}s`);
    el('perm-display').innerText = passives.join(' | ');
}

window.openInventory = () => { gameState = STATE.INVENTORY; el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.remove('hidden'); renderInventory(); }
window.closeInventory = () => { el('inventory-screen').classList.add('hidden'); el('intermission-screen').classList.remove('hidden'); }
window.openShop = () => { gameState = STATE.SHOP; el('intermission-screen').classList.add('hidden'); el('shop-screen').classList.remove('hidden'); generateShop(); renderShop(); }
window.closeShop = () => { el('shop-screen').classList.add('hidden'); el('intermission-screen').classList.remove('hidden'); }

function equipItem(itemIndex) {
    const item = inventory[itemIndex]; if (equipment[item.type]) inventory.push(equipment[item.type]); 
    equipment[item.type] = item; inventory.splice(itemIndex, 1); recalcStats(); renderInventory();
}

function renderInventory() {
    itemDataConfig.slots.forEach(t => {
        const eq = equipment[t];
        el(`equip-${t}`).innerHTML = eq ? `<span>[${t.toUpperCase()}] ${eq.name}</span> <span class="item-stats">${eq.desc}</span>` : `<span>[${t.toUpperCase()}] Empty</span>`;
        if(eq && eq.rarity === 'rare') el(`equip-${t}`).classList.add('rare'); else el(`equip-${t}`).classList.remove('rare');
    });
    const list = el('backpack-list'); list.innerHTML = '';
    if (inventory.length === 0) list.innerHTML = '<span style="color:#666;">Backpack is empty.</span>';
    inventory.forEach((item, index) => {
        const div = document.createElement('div'); div.className = `item-slot ${item.rarity === 'rare' ? 'rare' : ''}`;
        div.innerHTML = `<span>[${item.type.toUpperCase()}] ${item.name}</span> <span class="item-stats">${item.desc}</span>`;
        div.onclick = () => equipItem(index); list.appendChild(div);
    });
}

function generateShop() {
    shopItems = []; for(let i=0; i<3; i++) shopItems.push(generateItem(wave + 2)); 
    shopItems.push({ id: 'rare_wep', name: activeClass.rareWeapon.name, type: 'weapon', val: 1.0, desc: activeClass.rareWeapon.desc, price: 250, rarity: 'rare' });
    shopItems.push({ id: 'rare_arm', name: activeClass.rareArmor.name, type: 'armor', val: 240, desc: activeClass.rareArmor.desc, price: 200, rarity: 'rare' });
    shopItems.push({ id: 'rare_amu', name: activeClass.rareAmulet.name, type: 'amulet', val: 0.20, desc: activeClass.rareAmulet.desc, price: 200, rarity: 'rare' });
    shopItems.push({ id: 'rare_bot', name: activeClass.rareBoots.name, type: 'boots', val: 50, desc: activeClass.rareBoots.desc, price: 150, rarity: 'rare' });
    shopItems.push({ id: 'rare_glv', name: activeClass.rareGloves.name, type: 'gloves', val: 0.25, desc: activeClass.rareGloves.desc, price: 150, rarity: 'rare' });
}

function renderShop() {
    el('shop-gold-display').innerText = `Your Gold: ${player.gold}`;
    const buyList = el('shop-buy-list'); buyList.innerHTML = '';
    shopItems.forEach((item, index) => {
        const div = document.createElement('div'); div.className = `item-slot ${item.rarity === 'rare' ? 'rare' : ''}`;
        div.innerHTML = `<div><span>[${item.type.toUpperCase()}] ${item.name}</span><br><span class="item-stats">${item.desc}</span></div><div class="price-tag">${item.price}g</div>`;
        div.onclick = () => { if (player.gold >= item.price) { player.gold -= item.price; inventory.push(item); shopItems.splice(index, 1); renderShop(); updateHUD(); } };
        buyList.appendChild(div);
    });
    const sellList = el('shop-sell-list'); sellList.innerHTML = '';
    if (inventory.length === 0) sellList.innerHTML = '<span style="color:#666;">Nothing to sell.</span>';
    inventory.forEach((item, index) => {
        const sellPrice = Math.floor(item.price * 0.5);
        const div = document.createElement('div'); div.className = `item-slot ${item.rarity === 'rare' ? 'rare' : ''}`;
        div.innerHTML = `<div><span>[${item.type.toUpperCase()}] ${item.name}</span><br><span class="item-stats">${item.desc}</span></div><div class="price-tag">+${sellPrice}g</div>`;
        div.onclick = () => { player.gold += sellPrice; inventory.splice(index, 1); renderShop(); updateHUD(); };
        sellList.appendChild(div);
    });
}

function triggerLevelUp(customTitle = null) {
    if (gameState === STATE.EVOLVE || player.skillPoints <= 0) return;
    gameState = STATE.LEVELUP; isProcessingClick = false; 
    
    el('levelup-title').innerText = customTitle ? customTitle : `LEVEL UP! (${player.skillPoints} Points)`;
    el('levelup-screen').classList.remove('hidden');
    const container = el('skill-buttons'); container.innerHTML = '';
    
    let allMaxed = true;
    for (let i = 1; i <= 4; i++) {
        const sk = activeClass.skills[i];
        const btn = document.createElement('button'); btn.className = 'btn';
        
        if (i === 4 && player.level < 5 && sk.level === 0 && !customTitle) { 
            btn.innerText = `[LOCKED] ${sk.name} (Unlocks at Lv.5)`; btn.disabled = true; 
        } 
        else if (sk.level >= 4) { 
            btn.innerText = `${sk.name} (MAX LEVEL)`; btn.disabled = true; 
        } 
        else {
            allMaxed = false; 
            if (sk.level === 0) { btn.innerText = `Unlock ${sk.name}`; btn.innerHTML += `<br><span style="font-size:12px;color:#aaa;">Base Dmg: ${sk.baseDmg} | CD: ${sk.maxCd}s</span>`; }
            else if (sk.level === 3) { btn.innerText = `EVOLVE ${sk.name} (Rank 4)`; btn.style.borderColor = '#ffca28'; btn.style.color = '#ffca28'; }
            else btn.innerText = `Upgrade ${sk.name} (Lv.${sk.level} -> Lv.${sk.level + 1})`;
            
            btn.onclick = () => {
                if (isProcessingClick) return; isProcessingClick = true; 
                if (sk.level === 3) triggerEvolution(i); else { sk.level++; finishLevelUp(); }
            };
        }
        container.appendChild(btn);
    }

    if (allMaxed && !customTitle) {
        const btn = document.createElement('button'); btn.className = 'btn'; btn.style.borderColor = '#00e676'; btn.style.color = '#00e676'; btn.innerText = "All Skills Maxed! Gain +20 Max HP & +5% DMG";
        btn.onclick = () => {
            if (isProcessingClick) return; isProcessingClick = true;
            player.maxHp += 20; player.hp += 20; player.bonusDmg += 0.05; finishLevelUp();
        };
        container.appendChild(btn);
    }
}

function triggerEvolution(skillIndex) {
    el('levelup-screen').classList.add('hidden'); gameState = STATE.EVOLVE; evolvingSkillId = skillIndex;
    const sk = activeClass.skills[skillIndex];
    el('upgrade-screen').classList.remove('hidden'); 
    el('upgrade-screen').querySelector('h1').innerText = "RANK 4 EVOLUTION";
    el('evolve-skill-name').innerText = sk.name;
    el('upg-a-title').innerText = sk.upgA.name; el('upg-a-desc').innerText = sk.upgA.desc;
    el('upg-b-title').innerText = sk.upgB.name; el('upg-b-desc').innerText = sk.upgB.desc;
    isProcessingClick = false; 
}

window.selectUpgrade = function(path) {
    if (gameState !== STATE.EVOLVE || isProcessingClick) return; isProcessingClick = true;
    const sk = activeClass.skills[evolvingSkillId]; sk.level++; sk.selectedUpg = path;
    el('upgrade-screen').classList.add('hidden'); finishLevelUp();
}

function finishLevelUp() {
    player.skillPoints--;
    if (player.skillPoints > 0) { triggerLevelUp(); } 
    else {
        el('levelup-screen').classList.add('hidden'); updateHUD();
        if (wave === 0) startNextWave(); 
        else if (enemiesToSpawn === 0 && activeEnemies === 0) {
            gameState = STATE.INTERMISSION; el('intermission-title').innerText = isBossWave ? "Boss Defeated!" : "Wave Cleared"; el('intermission-title').style.color = "#ffca28"; el('btn-shop').classList.toggle('hidden', !isBossWave); el('intermission-screen').classList.remove('hidden');
        } else { 
            if (!el('dev-screen').classList.contains('hidden')) { gameState = STATE.DEV; } 
            else { gameState = STATE.PLAYING; }
            lastTime = performance.now(); 
        }
    }
}

window.devJumpWave = function() {
    const w = parseInt(el('dev-wave-input').value);
    if (!isNaN(w) && w > 0) {
        wave = w - 1; 
        enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0;
        activeEnemies = 0; enemiesToSpawn = 0;
        closeDevMenu(); startNextWave();
    }
}
window.devLevelUp = function() { gainXP(player.maxXp - player.xp); }
window.devAddGold = function() { player.gold += 1000; updateHUD(); }
window.devKillAll = function() { for(let i = enemies.length - 1; i >= 0; i--) { enemies[i].hp = 0; checkEnemyDeath(enemies[i]); } closeDevMenu(); }
window.devToggleCooldowns = function() { devNoCooldowns = !devNoCooldowns; el('btn-dev-cd').innerText = devNoCooldowns ? "Cooldowns: OFF" : "Cooldowns: Normal"; }
window.devOpenShop = function() { closeDevMenu(); openShop(); }
window.closeDevMenu = function() { el('dev-screen').classList.add('hidden'); gameState = STATE.PLAYING; lastTime = performance.now(); }