// ==========================================
// engine.js - Core Physics and Systems
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, LEVELUP: 3, EVOLVE: 4, INTERMISSION: 5, INVENTORY: 6, SHOP: 7, DEAD: 8, VICTORY: 9, DEV: 10 };
let gameState = STATE.MENU;

let lastTime = performance.now();
let score = 0; let wave = 1; let enemiesToSpawn = 0; let enemySpawnTimer = 0; let activeEnemies = 0; let isBossWave = false; let bossSpawned = false;
let hitStopTimer = 0; let isEndlessMode = false;

const keys = { w: false, a: false, s: false, d: false };
let isMouseDown = false; let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;

const player = { 
    x: 0, y: 0, radius: 18, speed: 250, isMoving: false,
    level: 1, xp: 0, maxXp: 50,
    baseHp: 100, hp: 100, maxHp: 100, shield: 0, shieldTimer: 0,
    gold: 0, bonusDmg: 0.0, skillPoints: 0, armor: 0,
    frenzyStacks: 0, frenzyTimer: 0, momentum: 0, arcaneResonance: false
};

let classDataConfig = {}; let enemyDataConfig = {}; let itemDataConfig = {};
let selectedClassId = null; let activeClass = null; let activeDungeon = null; let activeDungeonId = null;
let equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null };
let inventory = []; let shopItems = [];
let evolvingSkillId = null; let isProcessingClick = false; 

const cooldowns = { basic: 0, s1: 0, s2: 0, s3: 0, s4: 0, rmb: 0 };
const buffs = { rapidFire: 0, msBoost: 0, slowed: 0, ironBulwark: 0, rooted: 0, powerSurgeStacks: 0, powerSurgeTimer: 0, weakened: 0, evade100: 0, deathMarkActive: 0 };
const enemies = []; const projectiles = []; const effects = []; const drops = [];
const el = (id) => document.getElementById(id);

let currentMap = { type: 'open', left: 0, right: 0, top: 0, bottom: 0, valeriusTriggered: false };

function updateMapBounds() {
    if (currentMap.type === 'bridge') {
        const bridgeHeight = 450;
        currentMap.left = 0;
        currentMap.right = canvas.width;
        currentMap.top = canvas.height / 2 - bridgeHeight / 2;
        currentMap.bottom = canvas.height / 2 + bridgeHeight / 2;
    } else {
        currentMap.left = 0;
        currentMap.right = canvas.width;
        currentMap.top = 0;
        currentMap.bottom = canvas.height;
    }
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; updateMapBounds(); }
window.addEventListener('resize', resize); resize();

function clampToBounds(obj, radius) {
    obj.x = Math.max(currentMap.left + radius, Math.min(currentMap.right - radius, obj.x));
    obj.y = Math.max(currentMap.top + radius, Math.min(currentMap.bottom - radius, obj.y));
}

async function initializeData() {
    try {
        const [classesRes, enemiesRes, itemsRes] = await Promise.all([ fetch('data/classes.json'), fetch('data/enemies.json'), fetch('data/items.json') ]);
        if (!classesRes.ok || !enemiesRes.ok || !itemsRes.ok) throw new Error("Fetch failed.");
        classDataConfig = await classesRes.json(); enemyDataConfig = await enemiesRes.json(); itemDataConfig = await itemsRes.json();
        
        el('loading-text').classList.add('hidden'); el('class-selection').classList.remove('hidden');
    } catch (e) {
        console.error("Failed to load JSON:", e);
        el('loading-text').innerText = "Error: Could not load data. Ensure Python server is running on localhost."; el('loading-text').style.color = "#d32f2f";
    }
}
initializeData();

window.chooseClass = (cid) => { selectedClassId = cid; el('class-selection').classList.add('hidden'); el('dungeon-selection').classList.remove('hidden'); };
window.selectDungeon = (did) => { activeDungeonId = did; activeDungeon = enemyDataConfig[did]; startGame(selectedClassId); };

function startGame(className) {
    activeClass = JSON.parse(JSON.stringify(classDataConfig[className])); 
    player.color = activeClass.color; player.x = canvas.width / 2; player.y = canvas.height / 2;
    player.level = 1; player.xp = 0; player.maxXp = 50; player.gold = 0; player.bonusDmg = 0.0; player.skillPoints = 1;
    wave = 0; equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; inventory = [];
    isEndlessMode = false;
    
    recalcStats(); player.hp = player.maxHp; player.shield = 0; player.shieldTimer = 0; player.markTimer = 0; player.cowlCooldown = 0;
    buffs.rooted = 0; buffs.powerSurgeStacks = 0; buffs.powerSurgeTimer = 0; buffs.weakened = 0; buffs.evade100 = 0; buffs.deathMarkActive = 0;
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0;
    
    el('start-screen').classList.add('hidden'); el('hud').classList.remove('hidden');
    triggerLevelUp("Choose Starting Skill");
    loop();
}

function recalcStats() {
    let gearHp = equipment.armor ? equipment.armor.val : 0;
    player.maxHp = activeClass.baseMaxHp + gearHp;
    player.armor = activeClass.baseArmor;
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    
    let gearMs = equipment.boots ? equipment.boots.val : 0;
    player.speed = 250 + gearMs;
    updateHUD();
}

function calcDmg(baseAmount, skillLevel = 1) {
    let scaledBase = baseAmount + (skillLevel > 1 ? (skillLevel - 1) * (baseAmount * 0.3) : 0);
    let mult = activeClass.dmgMult + (equipment.weapon ? equipment.weapon.val : 0);
    if (activeClass.name === 'Dragonknight') mult += (player.frenzyStacks * 0.02);
    if (activeClass.name === 'Ranger') mult += player.momentum;
    mult += (buffs.powerSurgeStacks * 0.1); 
    
    let finalDmg = scaledBase * mult * (1.0 + player.bonusDmg);
    if (buffs.weakened > 0) finalDmg *= 0.7; 
    return finalDmg;
}

function getCDR() {
    let cdr = 1.0;
    if (equipment.amulet && equipment.amulet.type === 'amulet' && equipment.amulet.rarity !== 'rare') cdr -= equipment.amulet.val;
    if (equipment.amulet && equipment.amulet.name === 'Amulet of Power') cdr -= 0.20;
    return Math.max(0.2, cdr); 
}

function applyDamage(enemy, amount, source = 'player', projAngle = null) {
    if (source === 'melee_basic') hitStopTimer = 0.04;
    if (enemy.isStaggered) amount *= 2.0; 

    if (enemy.type === 'boss_slime_queen' && enemy.hp - amount <= 0 && enemy.state !== 'death_throes') {
        enemy.hp = 1; enemy.state = 'death_throes'; enemy.stateTimer = 5.0; enemy.invulnerable = true;
        enemy.originalSize = enemy.size; enemy.bulletAngle = 0;
        enemy.x = canvas.width / 2; enemy.y = canvas.height / 2; 
        effects.push({ type: 'text', text: 'CORE COLLAPSE!', x: enemy.x, y: enemy.y - 60, color: '#ff5252', life: 2.0, maxLife: 2.0 });
        return; 
    }

    if (enemy.type === 'slime_warden' && enemy.orbs > 0) {
        enemy.orbs--; enemy.invulnTimer = 0.2; 
        effects.push({ type: 'text', text: 'SHIELDED', x: enemy.x, y: enemy.y - 20, color: '#ffca28', life: 0.6, maxLife: 0.6 });
        if (enemy.orbs === 0) {
            enemy.stunTimer = 2.0; 
            effects.push({ type: 'text', text: 'STUNNED', x: enemy.x, y: enemy.y - 30, color: '#ffeb3b', life: 1.0, maxLife: 1.0 });
        }
        return;
    }

    if (enemy.invulnerable) {
        effects.push({ type: 'text', text: 'IMMUNE', x: enemy.x, y: enemy.y - 20, color: '#03a9f4', life: 0.6, maxLife: 0.6 });
        return;
    }

    if (enemy.reflective) takeDamage(amount * 0.5);

    if (enemy.type === 'thief' && Math.random() < 0.20) {
        effects.push({ type: 'text', text: 'Evaded!', x: enemy.x, y: enemy.y - 20, color: '#fff', life: 0.6, maxLife: 0.6 }); return;
    }
    if (enemy.type === 'shield' && enemy.shieldHp > 0) {
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        let diff = enemy.facingAngle - angleToPlayer; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
        if (Math.abs(diff) < Math.PI / 2.5) { 
            enemy.shieldHp -= amount;
            effects.push({ type: 'text', text: 'Blocked', x: enemy.x, y: enemy.y - 20, color: '#78909c', life: 0.6, maxLife: 0.6 });
            if (enemy.shieldHp <= 0) effects.push({ type: 'text', text: 'SHIELD BROKEN', x: enemy.x, y: enemy.y - 30, color: '#ffeb3b', life: 1.0, maxLife: 1.0 });
            return; 
        }
    }
    
    let isNightblade = activeClass.name === 'Nightblade';
    if (enemy.markAngle !== undefined && (source === 'melee_basic' || source === 'phantom_dash' || source === 'assassin_skill' || source === 'execute')) {
        let hitAngle;
        if (projAngle !== null) {
            hitAngle = projAngle + Math.PI; 
        } else {
            hitAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x); 
        }
        
        let diff = enemy.markAngle - hitAngle;
        while(diff < -Math.PI) diff += Math.PI*2;
        while(diff > Math.PI) diff -= Math.PI*2;

        if (Math.abs(diff) <= Math.PI / 3) { 
            enemy.markAngle = undefined;
            let trueDmg = activeClass.basicDmg * 5; 
            if (isNightblade && activeClass.skills[3].selectedUpg === 'A' && source === 'phantom_dash') trueDmg *= 3;
            
            enemy.hp -= trueDmg; 
            buffs.msBoost = 1.0; 
            effects.push({ type: 'text', text: 'WEAKPOINT!', x: enemy.x, y: enemy.y - 40, color: '#e1bee7', life: 0.8, maxLife: 0.8 });
            
            if (isNightblade && activeClass.skills[3].level > 0 && source === 'phantom_dash') {
                cooldowns.s3 = Math.max(0, cooldowns.s3 - (activeClass.skills[3].maxCd * getCDR() * 0.5));
            }
            
            if (buffs.deathMarkActive > 0) {
                if (isNightblade && activeClass.skills[4].selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1);
                effects.push({ type: 'circle', x: enemy.x, y: enemy.y, radius: 100, color: 'rgba(156, 39, 176, 0.4)', life: 0.3, maxLife: 0.3 });
                for(let k=enemies.length-1; k>=0; k--) {
                    if (enemies[k] !== enemy && Math.hypot(enemy.x - enemies[k].x, enemy.y - enemies[k].y) <= 100 + enemies[k].size/2) {
                        enemies[k].hp -= (trueDmg * 0.5); checkEnemyDeath(enemies[k]);
                    }
                }
            }
        }
    }

    if (activeClass.name === 'Ranger' && activeClass.skills[1].selectedUpg === 'B' && source !== 'magic' && source !== 'dot') enemy.hp -= (amount * 1.2); 
    else enemy.hp -= amount;

    if (equipment.gloves && equipment.gloves.name === 'Vampiric Grips') player.hp = Math.min(player.maxHp, player.hp + amount * 0.02);

    if (activeClass.name === 'Dragonknight' && (source === 'melee' || source === 'melee_basic')) {
        player.frenzyStacks = Math.min(10, player.frenzyStacks + 1); player.frenzyTimer = 3.0;
    }

    checkEnemyDeath(enemy);
}

function takeDamage(amount, isContinuous = false) {
    if (buffs.evade100 > 0) {
        if (!isContinuous) effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
        return;
    }
    if (player.inSmoke && Math.random() < 0.5) {
        if (!isContinuous) effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
        return;
    }

    if (buffs.ironBulwark > 0) amount *= 0.5;
    if (equipment.boots && equipment.boots.name === 'Ethereal Treads' && player.isMoving) amount *= 0.5;
    if (!isContinuous) amount = Math.max(1, amount - player.armor); 
    
    if (player.shield > 0) {
        if (player.shield >= amount) { player.shield -= amount; return; }
        else { amount -= player.shield; player.shield = 0; }
    }
    
    player.hp -= amount;
    
    if (equipment.armor && equipment.armor.name === "Nightblade's Cowl" && player.hp / player.maxHp < 0.3 && (player.cowlCooldown || 0) <= 0) {
        buffs.evade100 = 2.0; player.cowlCooldown = 15.0; 
        effects.push({ type: 'text', text: 'ELUSIVE!', x: player.x, y: player.y - 50, color: '#e1bee7', life: 1.0, maxLife: 1.0 });
    }

    if (player.hp <= 0) { player.hp = 0; gameState = STATE.DEAD; el('death-wave').innerText = wave; el('death-screen').classList.remove('hidden'); }
    updateHUD();
}

function gainXP(amount) {
    player.xp += amount; let leveledUp = false;
    while (player.xp >= player.maxXp) { player.level++; player.xp -= player.maxXp; player.maxXp = Math.floor(player.maxXp * 1.5); player.skillPoints++; leveledUp = true; }
    if (leveledUp && gameState === STATE.PLAYING) triggerLevelUp();
    updateHUD();
}

function generateItem(tierLevel) {
    const types = itemDataConfig.slots; const type = types[Math.floor(Math.random() * types.length)];
    const tier = Math.max(1, Math.ceil(tierLevel / 2));
    const slotData = itemDataConfig.slotData[type]; const val = tier * slotData.valMult;
    let displayVal = (type === 'weapon' || type === 'gloves' || type === 'amulet') ? Math.round(val * 100) : Math.round(val);
    return { id: Math.random().toString(36).substr(2, 9), name: `T${tier} ${slotData.namePrefix}`, type, val, desc: slotData.descTemplate.replace('{VAL}', displayVal), price: tier * 25, rarity: 'common' };
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
        } else { gameState = STATE.PLAYING; lastTime = performance.now(); }
    }
}

window.startEndlessMode = function() {
    isEndlessMode = true;
    el('intermission-screen').innerHTML = `<h1 style="color:#ffca28;" id="intermission-title">Wave Cleared</h1>
    <button class="btn" onclick="openInventory()">Open Inventory</button>
    <button class="btn btn-gold hidden" id="btn-shop" onclick="openShop()">Visit Shop</button>
    <button class="btn" onclick="startNextWave()" style="border-color:#4caf50; color:#4caf50;">Start Next Wave</button>`;
    startNextWave();
}

function startNextWave() {
    wave++; 
    isBossWave = (wave % 5 === 0); 
    bossSpawned = false;
    enemiesToSpawn = isBossWave ? 4 : 3 + Math.floor(wave * 2.5); 
    
    if (activeDungeonId === 'bandit_bastion' && wave === 11 && !isEndlessMode) {
        currentMap.type = 'bridge';
        isBossWave = true;
        enemiesToSpawn = 0; 
    } else if (activeDungeonId === 'bandit_bastion' && wave > 11 && !isEndlessMode) {
        currentMap.type = 'bridge';
    } else {
        currentMap.type = 'open';
    }
    updateMapBounds();

    if (activeDungeonId === 'bandit_bastion' && wave === 11 && !isEndlessMode) {
        currentMap.valeriusTriggered = false;
        player.x = currentMap.left + 80;
        player.y = (currentMap.top + currentMap.bottom) / 2;
    }

    el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.add('hidden'); el('shop-screen').classList.add('hidden');
    player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.3)); 
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD();
    if (player.skillPoints > 0) triggerLevelUp();
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

window.devLevelUp = function() { gainXP(player.maxXp - player.xp); closeDevMenu(); }
window.devAddGold = function() { player.gold += 1000; updateHUD(); }
window.devKillAll = function() { 
    for(let i = enemies.length - 1; i >= 0; i--) { enemies[i].hp = 0; checkEnemyDeath(enemies[i]); }
    closeDevMenu(); 
}
window.closeDevMenu = function() { el('dev-screen').classList.add('hidden'); gameState = STATE.PLAYING; lastTime = performance.now(); }

function spawnEnemy() {
    enemiesToSpawn--; activeEnemies++;
    
    let ex, ey;
    if (currentMap.type === 'bridge') {
        ex = Math.random() < 0.5 ? currentMap.left - 50 : currentMap.right + 50;
        ey = currentMap.top + Math.random() * (currentMap.bottom - currentMap.top);
    } else {
        if (Math.random() < 0.5) { 
            ex = Math.random() < 0.5 ? currentMap.left - 30 : currentMap.right + 30; 
            ey = currentMap.top + Math.random() * (currentMap.bottom - currentMap.top); 
        } else { 
            ex = currentMap.left + Math.random() * (currentMap.right - currentMap.left); 
            ey = Math.random() < 0.5 ? currentMap.top - 30 : currentMap.bottom + 30; 
        }
    }

    const stage = isEndlessMode ? Math.floor(Math.random() * 3) + 1 : (wave > 10 ? 3 : (wave > 5 ? 2 : 1));
    let minionList = activeDungeon[`stage${stage}_minions`] || activeDungeon.stage1_minions;

    if (isEndlessMode && activeDungeon === enemyDataConfig['slime_caves']) {
        minionList = [...activeDungeon.stage1_minions, ...activeDungeon.stage2_minions, ...activeDungeon.stage3_minions];
    }

    if (isBossWave && !bossSpawned && enemiesToSpawn === 0) {
        bossSpawned = true; 
        let bList = [activeDungeon.stage1_boss, activeDungeon.stage2_boss, activeDungeon.stage3_boss].filter(b=>b);
        let b = isEndlessMode ? bList[Math.floor(Math.random()*bList.length)] : (activeDungeon[`stage${stage}_boss`] || activeDungeon.stage1_boss);
        const bossHp = b.baseHp + (wave * b.hpScale);
        const bossSpeed = b.baseSpeed + (wave * 2.0);
        let bx = currentMap.type === 'bridge' ? currentMap.right - 150 : (currentMap.left+currentMap.right)/2;
        let by = currentMap.type === 'bridge' ? (currentMap.top+currentMap.bottom)/2 : currentMap.top + 100;
        enemies.push({ x: bx, y: by, size: b.size, color: b.color, speed: bossSpeed, hp: bossHp, maxHp: bossHp, type: b.type, dmg: b.baseDmg + (wave * b.dmgScale), xp: b.baseXp, attackTimer: b.attackTimer, meleeTimer: 0, frozenTimer: 0, state: 'idle', stateTimer: b.stateTimer || 2.0, facingAngle: 0, puddleTimer: 0, bleedTimer: 0, bleedDmg: 0 });
        updateHUD(); return;
    }

    if (minionList.length === 0) return;

    const roll = Math.random(); let cumulative = 0; let m = minionList[0];
    for (const minion of minionList) { cumulative += minion.weight; if (roll <= cumulative) { m = minion; break; } }
    
    const speed = m.baseSpeed + Math.random() * m.speedVar + (wave * 2.5); 
    enemies.push({ x: ex, y: ey, size: m.size, color: m.color, speed: speed, hp: m.baseHp + (wave * m.hpScale), maxHp: m.baseHp + (wave * m.hpScale), type: m.type, dmg: m.baseDmg + (wave * m.dmgScale), xp: m.baseXp + (wave * m.xpScale), attackTimer: m.attackTimer || 0, meleeTimer: 0, ammo: m.ammo || 0, frozenTimer: 0, facingAngle: 0, shieldHp: m.shieldHp, shieldMax: m.shieldMax, puddleTimer: m.puddleTimer || 0, bleedTimer: 0, bleedDmg: 0, orbs: m.orbs || 0 });
    updateHUD();
}

function collectAllDrops() {
    for (const d of drops) {
        if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
        else if (d.type === 'dmg') { player.bonusDmg += 0.05; } 
        else if (d.type === 'gold') { player.gold += d.val; } 
        else if (d.type === 'item') { inventory.push(d.itemData); }
    } drops.length = 0; updateHUD();
}

function checkEnemyDeath(e) {
    if (e.hp <= 0 && !e.dead) {
        e.dead = true;

        if (e.markAngle !== undefined && activeClass.name === 'Nightblade' && activeClass.skills[4].selectedUpg === 'B') {
            effects.push({ type: 'circle', x: e.x, y: e.y, radius: 150, color: 'rgba(156, 39, 176, 0.3)', life: 0.3, maxLife: 0.3 });
            for(let k=enemies.length-1; k>=0; k--) {
                if (Math.hypot(e.x - enemies[k].x, e.y - enemies[k].y) <= 150 + enemies[k].size/2) applyDamage(enemies[k], 50, 'magic');
            }
            let nearest = getNearestEnemyFromPoint(e.x, e.y, 300, [e]);
            if (nearest) nearest.markAngle = Math.random() * Math.PI * 2;
        }

        if (e.type === 'boss_slime_queen' || e.type === 'boss_valerius') {
            gameState = STATE.VICTORY;
            el('intermission-title').innerText = "DUNGEON CLEARED!";
            el('intermission-title').style.color = "#00e676";
            el('btn-shop').classList.add('hidden');
            el('intermission-screen').innerHTML = `<h1 style="color:#00e676; font-size:48px; margin-bottom:10px; text-shadow: 2px 2px 0 #000;">DUNGEON CLEARED!</h1>
            <p style="color:#fff; font-size:18px; margin-bottom:30px;">You have conquered this domain.</p>
            <button class="btn btn-gold" onclick="startEndlessMode()">Enter Limitless Mode</button>
            <button class="btn" style="border-color:#ff5252; color:#ff5252;" onclick="location.reload()">End Game</button>`;
            el('intermission-screen').classList.remove('hidden');
            return; 
        }

        if (e.type === 'spore_slime') effects.push({ type: 'spore_cloud', x: e.x, y: e.y, radius: 100, color: 'rgba(205, 220, 57, 0.4)', life: 3.0, maxLife: 3.0 });
        
        if (activeClass.name === 'Dragonknight' && equipment.armor && equipment.armor.name === 'Dragon Scale Plate') player.hp = Math.min(player.maxHp, player.hp + 5);
        if (activeClass.name === 'Spellweaver' && equipment.amulet && equipment.amulet.name === 'Chronos Pendant') {
            for(let i=1; i<=4; i++) cooldowns[`s${i}`] = Math.max(0, cooldowns[`s${i}`] - 0.5); cooldowns.rmb = Math.max(0, cooldowns.rmb - 0.5);
        }

        const rates = itemDataConfig.dropChances;
        if (e.type.startsWith('boss')) {
            drops.push({ x: e.x + 20, y: e.y, type: 'item', itemData: generateItem(wave + 2), radius: 10, life: 30.0 });
            for(let i=0; i<5; i++) drops.push({ x: e.x - 20 + (i*10), y: e.y + (i*10), type: 'gold', val: 20 + wave*2, radius: 8, life: 30.0 });
        } else {
            const roll = Math.random();
            if (roll < rates.item) drops.push({ x: e.x, y: e.y, type: 'item', itemData: generateItem(wave), radius: 10, life: 15.0 });
            else if (roll < rates.item + rates.orb) drops.push({ x: e.x, y: e.y, type: Math.random() > 0.5 ? 'hp' : 'dmg', radius: 12, life: 10.0 });
            else if (roll < rates.item + rates.orb + rates.gold) drops.push({ x: e.x, y: e.y, type: 'gold', val: 5 + wave, radius: 8, life: 10.0 });
        }
        
        gainXP(e.xp); const idx = enemies.indexOf(e); if (idx > -1) enemies.splice(idx, 1);
        activeEnemies--; score++; updateHUD();

        if (enemiesToSpawn <= 0 && activeEnemies <= 0) {
            collectAllDrops();
            if (gameState === STATE.PLAYING) { 
                gameState = STATE.INTERMISSION; el('intermission-title').innerText = isBossWave ? "Boss Defeated!" : "Wave Cleared"; el('btn-shop').classList.toggle('hidden', !isBossWave); el('intermission-screen').classList.remove('hidden');
            }
        }
    }
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
    shopItems.push({ id: 'rare_arm', name: activeClass.rareArmor.name, type: 'armor', val: activeClass.name==='Dragonknight'?200:activeClass.name==='Ranger'?120:100, desc: activeClass.rareArmor.desc, price: 200, rarity: 'rare' });
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

function updateHUD() {
    if (!activeClass) return;
    el('class-name').innerText = `${activeClass.name} Lv.${player.level}`;
    el('hp-bar').style.width = Math.max(0, (player.hp / player.maxHp * 100)) + '%'; 
    el('shield-bar').style.width = Math.min(100, (player.shield / player.maxHp * 100)) + '%'; 
    el('hp-text').innerText = player.shield > 0 ? `${Math.ceil(player.hp)} (+${Math.ceil(player.shield)}) / ${player.maxHp}` : `${Math.ceil(player.hp)} / ${player.maxHp}`;
    el('xp-bar').style.width = Math.max(0, (player.xp / player.maxXp * 100)) + '%'; el('xp-text').innerText = `${player.xp} / ${player.maxXp} XP`;
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
    if (buffs.powerSurgeStacks > 0) passives.push(`Power Surge: ${buffs.powerSurgeStacks}`);
    if (buffs.weakened > 0) passives.push(`WEAKENED`);
    el('perm-display').innerText = passives.join(' | ');
}

// --- Abilities & Mechanics --- //

window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mousedown', e => { 
    if (e.button === 0) isMouseDown = true; 
    if (e.button === 2 && equipment.weapon && equipment.weapon.rarity === 'rare' && cooldowns.rmb <= 0 && gameState === STATE.PLAYING) {
        cooldowns.rmb = 4.0 * getCDR();
        window.SkillRegistry[activeClass.name]['rmb']();
    }
});
window.addEventListener('mouseup', e => { if (e.button === 0) isMouseDown = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if (k === '`' || k === '~') {
        if (gameState === STATE.PLAYING) { gameState = STATE.DEV; el('dev-screen').classList.remove('hidden'); }
        else if (gameState === STATE.DEV) closeDevMenu();
        return;
    }
    if (k === ' ') { k = 'space'; e.preventDefault(); }
    if (k === 'p') {
        if (gameState === STATE.PLAYING) gameState = STATE.PAUSED;
        else if (gameState === STATE.PAUSED) { gameState = STATE.PLAYING; lastTime = performance.now(); }
        return;
    }
    if (gameState !== STATE.PLAYING || player.hp <= 0) return;
    if (k === 'w') keys.w = true; if (k === 'a') keys.a = true; if (k === 's') keys.s = true; if (k === 'd') keys.d = true;
    
    const keyMap = { 'q': 1, 'e': 2, 'space': 3, 'r': 4 };
    if (keyMap[k]) {
        let i = keyMap[k];
        if (cooldowns[`s${i}`] <= 0 && activeClass.skills[i].level > 0) {
            const sk = activeClass.skills[i];
            let cdReduction = getCDR();
            if (activeClass.name === 'Dragonknight' && i === 3 && equipment.boots && equipment.boots.name === 'Earthshaker Treads') sk.maxCd = Math.max(1, sk.maxCd - 2.0);
            cooldowns[`s${i}`] = sk.maxCd * cdReduction;
            
            if (equipment.amulet && equipment.amulet.name === 'Amulet of Power') {
                buffs.powerSurgeStacks = Math.min(5, buffs.powerSurgeStacks + 1);
                buffs.powerSurgeTimer = 3.0;
            }

            let dmg = calcDmg(sk.baseDmg, sk.level);
            window.SkillRegistry[activeClass.name][i](sk, dmg);
        }
    }
});
window.addEventListener('keyup', e => { 
    let k = e.key.toLowerCase(); 
    if (k === ' ') k = 'space';
    if (k === 'w') keys.w = false; if (k === 'a') keys.a = false; if (k === 's') keys.s = false; if (k === 'd') keys.d = false; 
});

function getVector(x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; return [dx, dy, Math.hypot(dx, dy)]; }

function distToSegment(px, py, x1, y1, x2, y2) {
    let l2 = (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
    if (l2 === 0) return Math.hypot(px-x1, py-y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function getNearestEnemyFromPoint(x, y, range, excludeList = []) {
    let nearest = null; let minDist = range;
    for(const e of enemies) { if (excludeList.includes(e)) continue; const dist = Math.hypot(e.x - x, e.y - y); if(dist < minDist) { minDist = dist; nearest = e; } }
    return nearest;
}

function castBasic() {
    const ANIM_LOCK = 0.15;
    let gloveBonus = equipment.gloves ? equipment.gloves.val : 0; 
    cooldowns.basic = ANIM_LOCK + ((activeClass.basicAttackCD * getCDR()) / (1.0 + gloveBonus));
    let dmg = calcDmg(activeClass.basicDmg, 1);
    
    let isResonance = false;
    if (activeClass.name === 'Spellweaver' && player.arcaneResonance) { isResonance = true; player.arcaneResonance = false; dmg *= 1.5; }

    window.BasicAttackRegistry[activeClass.weapon](dmg, isResonance);
    updateHUD();
}

function update(dt) {
    if (enemiesToSpawn > 0) { enemySpawnTimer -= dt; if (enemySpawnTimer <= 0) { spawnEnemy(); enemySpawnTimer = Math.max(0.5, 2.0 - (wave * 0.1)); } }
    if (cooldowns.basic > 0) cooldowns.basic -= dt;
    if (cooldowns.rmb > 0) cooldowns.rmb -= dt;
    for(let i=1; i<=4; i++) if (cooldowns[`s${i}`] > 0) cooldowns[`s${i}`] -= dt;
    if (buffs.msBoost > 0) buffs.msBoost -= dt;
    if (buffs.slowed > 0) buffs.slowed -= dt;
    if (buffs.rooted > 0) buffs.rooted -= dt;
    if (buffs.ironBulwark > 0) buffs.ironBulwark -= dt;
    if (buffs.weakened > 0) buffs.weakened -= dt;
    if (buffs.evade100 > 0) buffs.evade100 -= dt;
    if (buffs.deathMarkActive > 0) buffs.deathMarkActive -= dt;
    if (player.cowlCooldown > 0) player.cowlCooldown -= dt;

    if (buffs.powerSurgeTimer > 0) { buffs.powerSurgeTimer -= dt; if (buffs.powerSurgeTimer <= 0) buffs.powerSurgeStacks = 0; }
    if (player.shield > 0) { player.shieldTimer -= dt; if (player.shieldTimer <= 0) { player.shield = 0; updateHUD(); } }
    if (activeClass && activeClass.name === 'Dragonknight') { if (player.frenzyTimer > 0) { player.frenzyTimer -= dt; if (player.frenzyTimer <= 0) player.frenzyStacks = 0; } }

    if (activeClass && activeClass.name === 'Nightblade') {
        player.markTimer = (player.markTimer || 0) - dt;
        if (player.markTimer <= 0) {
            player.markTimer = 3.0;
            let unmarked = enemies.filter(e => e.markAngle === undefined && Math.hypot(player.x - e.x, player.y - e.y) < 400);
            let count = Math.floor(Math.random() * 3) + 1;
            for (let i=0; i<count && unmarked.length > 0; i++) {
                let idx = Math.floor(Math.random() * unmarked.length);
                unmarked[idx].markAngle = Math.random() * Math.PI * 2;
                unmarked.splice(idx, 1);
            }
        }
    }

    let cdText = [];
    const keyLabels = {1: 'Q', 2: 'E', 3: 'SPC', 4: 'R'};
    for(let i=1; i<=4; i++) { if (activeClass.skills[i].level > 0) cdText.push(`${keyLabels[i]}: ${Math.max(0, cooldowns[`s${i}`]).toFixed(1)}s`); }
    if (equipment.weapon && equipment.weapon.rarity === 'rare') cdText.push(`RMB: ${Math.max(0, cooldowns.rmb).toFixed(1)}s`);
    el('cd-display').innerText = cdText.join(' | ');

    if (isMouseDown && cooldowns.basic <= 0) castBasic();

    let vx = 0; let vy = 0;
    if (keys.w) vy -= 1; if (keys.s) vy += 1; if (keys.a) vx -= 1; if (keys.d) vx += 1;
    const mag = Math.hypot(vx, vy);
    player.isMoving = mag > 0;
    
    let currentSpeed = player.speed; 
    if (buffs.msBoost > 0) currentSpeed *= 1.5;
    if (buffs.slowed > 0) currentSpeed *= 0.5;
    if (buffs.rooted > 0) currentSpeed = 0;

    if (mag > 0 && currentSpeed > 0) {
        player.x += (vx / mag) * currentSpeed * dt; player.y += (vy / mag) * currentSpeed * dt;
        clampToBounds(player, player.radius);
        if (activeClass && activeClass.name === 'Ranger') player.momentum = Math.min(0.20, player.momentum + (0.05 * dt)); 
    } else { if (activeClass && activeClass.name === 'Ranger') player.momentum = 0; }

    if (currentMap.type === 'bridge' && wave === 11 && !currentMap.valeriusTriggered && player.x > currentMap.right - 200) {
        currentMap.valeriusTriggered = true; bossSpawned = true; let b = activeDungeon.stage3_boss;
        const bossHp = b.baseHp + (wave * b.hpScale); const bossSpeed = b.baseSpeed + (wave * 2.0);
        let bx = (currentMap.left + currentMap.right) / 2; let by = (currentMap.top + currentMap.bottom) / 2;
        enemies.push({ x: bx, y: currentMap.top - 300, size: b.size, color: b.color, speed: bossSpeed, hp: bossHp, maxHp: bossHp, type: b.type, dmg: b.baseDmg + (wave * b.dmgScale), xp: b.baseXp, attackTimer: b.attackTimer, meleeTimer: 0, frozenTimer: 0, state: 'jump_in', stateTimer: 1.0, facingAngle: 0, puddleTimer: 0, bleedTimer: 0, bleedDmg: 0, targetY: by });
        activeEnemies++; updateHUD();
    }

    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt; if (d.life <= 0) { drops.splice(i, 1); continue; }
        if (Math.hypot(player.x - d.x, player.y - d.y) < player.radius + d.radius) {
            if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
            else if (d.type === 'dmg') { player.bonusDmg += 0.05; } 
            else if (d.type === 'gold') { player.gold += d.val; }
            else if (d.type === 'item') { inventory.push(d.itemData); }
            else if (d.type === 'shield_catch') { let shieldAmt = d.skill && d.skill.selectedUpg === 'B' ? 100 : 50; player.shield += shieldAmt; player.shieldTimer = 5.0; }
            drops.splice(i, 1); updateHUD();
        }
    }

    player.inSmoke = false;
    for (let i = effects.length - 1; i >= 0; i--) { 
        effects[i].life -= dt; 
        if (effects[i].type === 'smoke_bomb') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) <= effects[i].radius) player.inSmoke = true;
            for(let k=enemies.length-1; k>=0; k--) {
                if (Math.hypot(enemies[k].x - effects[i].x, enemies[k].y - effects[i].y) <= effects[i].radius + enemies[k].size/2) {
                    if (effects[i].poison) applyDamage(enemies[k], effects[i].dmg * dt, 'dot');
                }
            }
        } else if (effects[i].type === 'fire_puddle') {
            for(let k=enemies.length-1; k>=0; k--) {
                if (Math.hypot(enemies[k].x - effects[i].x, enemies[k].y - effects[i].y) <= effects[i].radius + enemies[k].size/2) {
                    applyDamage(enemies[k], effects[i].dmg * dt, 'dot');
                }
            }
        } else if (effects[i].type === 'puddle') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius) takeDamage(15 * dt, true);
        } else if (effects[i].type === 'bear_trap') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius) {
                buffs.rooted = 1.5; takeDamage(effects[i].dmg); effects.splice(i, 1); continue;
            }
        } else if (effects[i].type === 'spore_cloud') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius) buffs.weakened = 0.5;
        }
        if (effects[i].life <= 0) effects.splice(i, 1); 
    }

    const oozes = enemies.filter(e => e.type === 'voltaic_ooze');
    for (let i=0; i<oozes.length; i++) {
        for (let j=i+1; j<oozes.length; j++) {
            if (Math.hypot(oozes[i].x - oozes[j].x, oozes[i].y - oozes[j].y) < 250) {
                effects.push({type: 'lightning', x1: oozes[i].x, y1: oozes[i].y, x2: oozes[j].x, y2: oozes[j].y, color: '#03a9f4', life: 0.1, maxLife: 0.1});
                if (distToSegment(player.x, player.y, oozes[i].x, oozes[i].y, oozes[j].x, oozes[j].y) < player.radius + 5) { takeDamage(15 * dt, true); buffs.slowed = 0.5; }
            }
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; 
        
        if (p.source === 'fan_of_knives' && p.returnDmg && p.life <= 0.5 && !p.returning) {
            p.returning = true; p.hitList = [];
        }
        if (p.source === 'fan_of_knives' && p.returning) {
            const [rx, ry, rd] = getVector(p.x, p.y, player.x, player.y);
            if (rd < p.radius + player.radius) { projectiles.splice(i, 1); continue; }
            p.vx = (rx/rd)*1200; p.vy = (ry/rd)*1200; p.life = 0.5;
        }
        
        if (p.type === 'hound') {
            if (p.trackTimer > 0) {
                p.trackTimer -= dt;
                const [tx, ty, tdist] = getVector(p.x, p.y, player.x, player.y);
                let targetAngle = Math.atan2(ty, tx); let currentAngle = Math.atan2(p.vy, p.vx); let diff = targetAngle - currentAngle;
                while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                currentAngle += diff * 2.5 * dt; p.vx = Math.cos(currentAngle) * p.speed; p.vy = Math.sin(currentAngle) * p.speed;
            }
            p.x += p.vx * dt; p.y += p.vy * dt; 
        } else if (p.type === 'trap_throw' || p.type === 'spore') {
            const [tx, ty, td] = getVector(p.x, p.y, p.targetX, p.targetY); const spd = p.speed || 400;
            if (td > 10) { p.x += (tx/td)*spd*dt; p.y += (ty/td)*spd*dt; }
        } else {
            p.x += p.vx * dt; p.y += p.vy * dt; 
        }
        
        p.life -= dt;
        
        if (p.life <= 0 || p.x < currentMap.left - 50 || p.x > currentMap.right + 50 || p.y < currentMap.top - 50 || p.y > currentMap.bottom + 50) { 
            if (p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
            if (p.type === 'trap_throw') { effects.push({ type: 'bear_trap', x: p.x, y: p.y, radius: 15, color: '#5d4037', life: 8.0, maxLife: 8.0, dmg: p.damage }); }
            if (p.type === 'spore') { effects.push({ type: 'spore_cloud', x: p.x, y: p.y, radius: 100, color: 'rgba(205, 220, 57, 0.4)', life: 3.0, maxLife: 3.0 }); }
            projectiles.splice(i, 1); continue; 
        }

        if (p.isEnemy) {
            if (p.type !== 'trap_throw' && p.type !== 'spore' && Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) { 
                takeDamage(p.damage); 
                if (p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
                if (p.type === 'bolas') { 
                    buffs.rooted = 1.0; const boss = enemies.find(e => e.type === 'boss_beastmaster');
                    if (boss) { const [bx, by, bdist] = getVector(player.x, player.y, boss.x, boss.y); player.x += (bx/bdist)*100; player.y += (by/bdist)*100; clampToBounds(player, player.radius); }
                }
                projectiles.splice(i, 1); 
            }
        } else {
            if (p.type === 'shield_throw') {
                if (!p.returning && (p.life <= 1.0 || p.x<=currentMap.left+20 || p.x>=currentMap.right-20 || p.y<=currentMap.top+20 || p.y>=currentMap.bottom-20)) { p.returning = true; p.hitList = []; }
                if (p.returning) {
                    const [rx, ry, rd] = getVector(p.x, p.y, p.startX, p.startY);
                    if (rd < p.radius + 10) {
                        drops.push({ type: 'shield_catch', x: p.x, y: p.y, radius: 12, life: 5.0, skill: p.sourceSkill });
                        projectiles.splice(i, 1); continue;
                    } else { p.vx = (rx/rd)*800; p.vy = (ry/rd)*800; }
                }
            }

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (Math.hypot(p.x - e.x, p.y - e.y) < e.size/2 + p.radius) {
                    if ((p.pierce || p.type === 'shield_throw' || p.type === 'fan_of_knives') && p.hitList.includes(e)) continue;

                    if (p.type === 'fireball' || p.resonance) {
                        let explRadius = p.sourceSkill && p.sourceSkill.selectedUpg === 'B' ? 100 : 70;
                        effects.push({ type: 'circle', x: p.x, y: p.y, radius: explRadius, color: '#ff7043', life: 0.3, maxLife: 0.3 });
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'B') {
                            effects.push({ type: 'fire_puddle', x: p.x, y: p.y, radius: explRadius, color: 'rgba(255, 87, 34, 0.4)', life: 0.75, maxLife: 0.75, dmg: p.damage * 0.5 });
                        }
                        for(let k=enemies.length-1; k>=0; k--) {
                            if (Math.hypot(p.x - enemies[k].x, p.y - enemies[k].y) <= explRadius + enemies[k].size/2) applyDamage(enemies[k], p.damage, 'magic');
                        }
                    } else if (p.type === 'shield_throw') {
                        applyDamage(e, p.damage, 'melee');
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'A') {
                            effects.push({ type: 'circle', x: e.x, y: e.y, radius: 60, color: '#e0e0e0', life: 0.2, maxLife: 0.2 });
                            for(let k=enemies.length-1; k>=0; k--) {
                                if (e !== enemies[k] && Math.hypot(e.x - enemies[k].x, e.y - enemies[k].y) <= 60 + enemies[k].size/2) applyDamage(enemies[k], p.damage*0.5, 'melee');
                            }
                        }
                    } else if (p.type === 'ricochet') {
                        applyDamage(e, p.damage, 'ranged');
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'B') { e.frozenTimer = 1.0; e.bleedTimer = 3.0; e.bleedDmg = p.damage * 0.4; } 
                        if (p.bounces > 0) {
                            p.bounces--; p.hitList.push(e);
                            let nextT = null; let minDist = 400;
                            for(const et of enemies) { if (p.hitList.includes(et)) continue; const dist = Math.hypot(et.x - p.x, et.y - p.y); if(dist < minDist) { minDist = dist; nextT = et; } }
                            if (nextT) { const [nx, ny, nd] = getVector(p.x, p.y, nextT.x, nextT.y); p.vx = (nx/nd)*900; p.vy = (ny/nd)*900; } 
                            else { hit = true; } 
                        } else { hit = true; }
                    } else { applyDamage(e, p.damage, activeClass.name === 'Ranger' ? 'ranged' : (p.source === 'fan_of_knives' ? 'assassin_skill' : 'magic'), Math.atan2(p.vy, p.vx)); }
                    
                    if (p.pierce || p.type === 'shield_throw' || p.type === 'ricochet' || p.type === 'fan_of_knives') { if (p.type !== 'ricochet') p.hitList.push(e); } else { hit = true; break; }
                }
            }
            if (hit) projectiles.splice(i, 1);
        }
    }

    let hasCasterAura = false;
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.frozenTimer > 0) { e.frozenTimer -= dt; e.renderColor = '#90caf9'; } 
        else { e.renderColor = e.color; }

        if (e.bleedTimer > 0) {
            e.bleedTimer -= dt; applyDamage(e, e.bleedDmg * dt, 'dot');
            if (Math.random() < 0.1) effects.push({ type: 'circle', x: e.x, y: e.y, radius: 4, color: '#f44336', life: 0.2, maxLife: 0.2 });
        }

        let curSpd = (e.speed === 0 || e.frozenTimer > 0) ? (e.speed === 0 ? 0 : e.speed * 0.3) : e.speed;
        
        hasCasterAura = false;
        for(let j=0; j<enemies.length; j++) { if (enemies[j].type === 'caster' && Math.hypot(e.x - enemies[j].x, e.y - enemies[j].y) < 400) hasCasterAura = true; }
        if (hasCasterAura) curSpd *= 2.0;

        let [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
        if (player.inSmoke) { edx = 0; edy = 0; edist = Infinity; }
        if (e.meleeTimer > 0) e.meleeTimer -= dt; 

        if (edist < player.radius + e.size / 2 && e.state !== 'dash_execute' && e.state !== 'bounce_telegraph' && e.state !== 'charge' && e.state !== 'jousting' && e.state !== 'death_throes') {
            if (!(equipment.boots && equipment.boots.name === 'Ethereal Treads')) {
                let overlap = (player.radius + e.size / 2) - edist;
                e.x -= (edx / edist) * overlap; e.y -= (edy / edist) * overlap;
            }
        }

        if (edist > 0) {
            let targetAngle = Math.atan2(edy, edx);
            if (e.type === 'shield') {
                let diff = targetAngle - (e.facingAngle || 0); while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2; e.facingAngle = (e.facingAngle || 0) + diff * 3.0 * dt; 
            } else { e.facingAngle = targetAngle; }
        }

        if (window.EnemyAI[e.type]) window.EnemyAI[e.type](e, dt, curSpd, edx, edy, edist, i);
        else window.EnemyAI['slime_melee'](e, dt, curSpd, edx, edy, edist, i);
        
        clampToBounds(e, e.size/2);
    }
}

function draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (currentMap.type === 'bridge') {
        ctx.fillStyle = '#2c2c2c'; ctx.fillRect(currentMap.left, currentMap.top, currentMap.right - currentMap.left, currentMap.bottom - currentMap.top);
        ctx.fillStyle = '#3e2723'; 
        ctx.fillRect(currentMap.left, currentMap.top - 10, canvas.width, 10);
        ctx.fillRect(currentMap.left, currentMap.bottom, canvas.width, 10);
    } else {
        ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; const gridSize = 100;
        for (let i = 0; i < canvas.width; i += gridSize) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
        for (let i = 0; i < canvas.height; i += gridSize) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
    }

    for (const ef of effects) {
        if (ef.type === 'puddle' || ef.type === 'fire_puddle' || ef.type === 'spore_cloud' || ef.type === 'smoke_bomb') {
            ctx.fillStyle = ef.color; ctx.globalAlpha = ef.life / ef.maxLife * 0.5; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
        }
    }

    for (const d of drops) {
        if (d.type === 'shield_catch') { ctx.strokeStyle = '#78909c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI*2); ctx.stroke(); }
        else {
            if (d.type === 'item') ctx.fillStyle = '#4caf50'; else if (d.type === 'gold') ctx.fillStyle = '#ffd54f'; else ctx.fillStyle = d.type === 'hp' ? '#e53935' : '#ab47bc';
            ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = d.type === 'gold' ? '#000' : '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let icon = d.type === 'hp' ? '+' : d.type === 'dmg' ? '⚔' : d.type === 'gold' ? '$' : '♦'; ctx.fillText(icon, d.x, d.y);
        }
    }

    for (const ef of effects) {
        if (ef.type === 'puddle' || ef.type === 'fire_puddle' || ef.type === 'spore_cloud' || ef.type === 'smoke_bomb') continue; 
        ctx.globalAlpha = ef.isWarning ? 1.0 : ef.life / ef.maxLife; ctx.fillStyle = ef.color;
        if (ef.type === 'circle') { ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); if (ef.isWarning) { ctx.strokeStyle = '#ff5722'; ctx.lineWidth = 2; ctx.stroke(); } ctx.fill(); } 
        else if (ef.type === 'line') { ctx.strokeStyle = ef.color; ctx.lineWidth = ef.lineWidth || 40; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); } 
        else if (ef.type === 'cone') { ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.arc(ef.x, ef.y, ef.radius, ef.angle - ef.spread/2, ef.angle + ef.spread/2); ctx.closePath(); ctx.fill(); }
        else if (ef.type === 'lightning') { ctx.strokeStyle = ef.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); }
        else if (ef.type === 'triangle') { ctx.strokeStyle = ef.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ef.p1.x, ef.p1.y); ctx.lineTo(ef.p2.x, ef.p2.y); ctx.lineTo(ef.p3.x, ef.p3.y); ctx.closePath(); ctx.stroke(); ctx.fill(); }
        else if (ef.type === 'bear_trap') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius/2, 0, Math.PI*2); ctx.fill(); }
        else if (ef.type === 'text') { ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText(ef.text, ef.x, ef.y - (1.0 - (ef.life/ef.maxLife)) * 30); }
        ctx.globalAlpha = 1.0;
    }

    for (const e of enemies) {
        if (e.state === 'split') continue; 
        ctx.fillStyle = e.renderColor || e.color;
        if (e.type === 'slime_ranged' || e.type.startsWith('boss') || e.type === 'voltaic_ooze' || e.type === 'toxic_sludge' || e.type === 'amalgam_minion' || e.type === 'caster' || e.type === 'spore_slime' || e.type === 'crystal_slime' || e.type === 'slime_warden' || e.type === 'queen_guard') { ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill(); } 
        else { ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); }
        
        if (e.type === 'shield' && e.shieldHp > 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.arc(e.x, e.y, e.size/2 + 2, e.facingAngle - Math.PI/2.5, e.facingAngle + Math.PI/2.5); 
            ctx.stroke();
        }

        if (e.markAngle !== undefined) {
            ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = 3;
            let mx = e.x + Math.cos(e.markAngle) * (e.size/2 + 15);
            let my = e.y + Math.sin(e.markAngle) * (e.size/2 + 15);
            
            ctx.beginPath(); ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - 6, my); ctx.closePath(); ctx.stroke();
            
            ctx.strokeStyle = 'rgba(225, 190, 231, 0.4)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2 + 15, e.markAngle - 0.4, e.markAngle + 0.4); ctx.stroke();
        }

        if (!e.type.startsWith('boss')) { ctx.fillStyle = '#000'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size, 4); ctx.fillStyle = '#4caf50'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size * (e.hp/e.maxHp), 4); }
    }

    for (const p of projectiles) {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill(); ctx.shadowBlur = 0;
    }

    if (player.hp > 0 && gameState !== STATE.MENU && gameState !== STATE.DEAD) {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x); ctx.lineWidth = 4;
        
        if (activeClass && activeClass.name === 'Spellweaver' && player.arcaneResonance) { ctx.strokeStyle = '#2196f3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI*2); ctx.stroke(); }
        
        if (activeClass && activeClass.weapon === 'staff') {
            ctx.strokeStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#2196f3' : '#8d6e63'; ctx.beginPath(); ctx.moveTo(player.x, player.y);
            const tipX = player.x + Math.cos(angle)*35; const tipY = player.y + Math.sin(angle)*35; ctx.lineTo(tipX, tipY); ctx.stroke();
            ctx.fillStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#e3f2fd' : '#29b6f6'; ctx.beginPath(); ctx.arc(tipX, tipY, 6, 0, Math.PI*2); ctx.fill();
        } else if (activeClass && activeClass.weapon === 'bow') {
            ctx.strokeStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#2196f3' : '#a1887f'; ctx.beginPath(); ctx.arc(player.x + Math.cos(angle)*20, player.y + Math.sin(angle)*20, 20, angle - Math.PI/2.5, angle + Math.PI/2.5); ctx.stroke();
            if (cooldowns.basic <= 0) { ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.x + Math.cos(angle)*30, player.y + Math.sin(angle)*30); ctx.stroke(); }
        } else if (activeClass && activeClass.weapon === 'sword') {
            ctx.strokeStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#2196f3' : '#bdbdbd'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(player.x + Math.cos(angle)*10, player.y + Math.sin(angle)*10); ctx.lineTo(player.x + Math.cos(angle)*40, player.y + Math.sin(angle)*40); ctx.stroke();
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 4; ctx.beginPath(); const cx = player.x + Math.cos(angle)*15; const cy = player.y + Math.sin(angle)*15; const perp = angle + Math.PI/2;
            ctx.moveTo(cx + Math.cos(perp)*12, cy + Math.sin(perp)*12); ctx.lineTo(cx - Math.cos(perp)*12, cy - Math.sin(perp)*12); ctx.stroke();
        } else if (activeClass && activeClass.weapon === 'dagger') {
            const isRare = equipment.weapon && equipment.weapon.rarity === 'rare';
            const handleColor = isRare ? '#4a148c' : '#9c27b0';
            const bladeColor = '#bdbdbd';
            ctx.lineWidth = 4;
            const perp = angle + Math.PI/2;
            
            // Left Dagger
            let d1x = player.x + Math.cos(angle - 0.7)*15; let d1y = player.y + Math.sin(angle - 0.7)*15;
            ctx.strokeStyle = handleColor; ctx.beginPath(); ctx.moveTo(d1x, d1y); ctx.lineTo(d1x + Math.cos(angle)*6, d1y + Math.sin(angle)*6); ctx.stroke();
            ctx.strokeStyle = bladeColor; ctx.beginPath(); ctx.moveTo(d1x + Math.cos(angle)*6, d1y + Math.sin(angle)*6); ctx.lineTo(d1x + Math.cos(angle)*22, d1y + Math.sin(angle)*22); ctx.stroke();
            ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d1x + Math.cos(angle)*22, d1y + Math.sin(angle)*22); ctx.lineTo(d1x + Math.cos(angle)*26, d1y + Math.sin(angle)*26); ctx.stroke();
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2; ctx.beginPath();
            let c1x = d1x + Math.cos(angle)*6; let c1y = d1y + Math.sin(angle)*6;
            ctx.moveTo(c1x + Math.cos(perp)*6, c1y + Math.sin(perp)*6); ctx.lineTo(c1x - Math.cos(perp)*6, c1y - Math.sin(perp)*6); ctx.stroke();
            
            // Right Dagger
            ctx.lineWidth = 4;
            let d2x = player.x + Math.cos(angle + 0.7)*15; let d2y = player.y + Math.sin(angle + 0.7)*15;
            ctx.strokeStyle = handleColor; ctx.beginPath(); ctx.moveTo(d2x, d2y); ctx.lineTo(d2x + Math.cos(angle)*6, d2y + Math.sin(angle)*6); ctx.stroke();
            ctx.strokeStyle = bladeColor; ctx.beginPath(); ctx.moveTo(d2x + Math.cos(angle)*6, d2y + Math.sin(angle)*6); ctx.lineTo(d2x + Math.cos(angle)*22, d2y + Math.sin(angle)*22); ctx.stroke();
            ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d2x + Math.cos(angle)*22, d2y + Math.sin(angle)*22); ctx.lineTo(d2x + Math.cos(angle)*26, d2y + Math.sin(angle)*26); ctx.stroke();
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2; ctx.beginPath();
            let c2x = d2x + Math.cos(angle)*6; let c2y = d2y + Math.sin(angle)*6;
            ctx.moveTo(c2x + Math.cos(perp)*6, c2y + Math.sin(perp)*6); ctx.lineTo(c2x - Math.cos(perp)*6, c2y - Math.sin(perp)*6); ctx.stroke();
        }
        
        if (player.shield > 0) { ctx.strokeStyle = '#78909c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI*2); ctx.stroke(); }
        
        ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    } 

    const boss = enemies.find(e => e.type.startsWith('boss'));
    if (boss && boss.state !== 'death_throes') {
        const bw = 400; const bh = 20; const bx = canvas.width/2 - bw/2; const by = 30;
        ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = '#ffeb3b'; ctx.fillRect(bx, by, bw * (boss.hp/boss.maxHp), bh);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh); ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`Wave ${wave} Boss`, canvas.width/2, by - 5);
    }

    if (gameState === STATE.PAUSED) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; ctx.font = '48px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
    }
}

function loop() {
    const now = performance.now(); let dt = (now - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = now;
    
    if (gameState === STATE.PLAYING && player.hp > 0) {
        if (hitStopTimer > 0) { hitStopTimer -= dt; } 
        else { update(dt); }
    }
    
    draw(); requestAnimationFrame(loop);
}