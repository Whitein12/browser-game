const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, LEVELUP: 3, EVOLVE: 4, INTERMISSION: 5, INVENTORY: 6, SHOP: 7 };
let gameState = STATE.MENU;

let lastTime = performance.now();
let score = 0;
let wave = 1;
let enemiesToSpawn = 0;
let enemySpawnTimer = 0;
let activeEnemies = 0;
let isBossWave = false;
let bossSpawned = false;

const keys = { w: false, a: false, s: false, d: false };
let isMouseDown = false;
let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;

const player = { 
    x: 0, y: 0, radius: 18, speed: 250,
    level: 1, xp: 0, maxXp: 50,
    baseHp: 100, hp: 100, maxHp: 100,
    gold: 0, bonusDmg: 0.0, skillPoints: 0 
};

let classDataConfig = {};
let enemyDataConfig = {};
let itemDataConfig = {};

let selectedClassId = null;
let activeClass = null;
let activeDungeon = null;

let equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null };
let inventory = [];
let shopItems = [];
let evolvingSkillId = null; 
let isProcessingClick = false; 

const cooldowns = { basic: 0, s1: 0, s2: 0, s3: 0, s4: 0, rmb: 0 };
const buffs = { rapidFire: 0, msBoost: 0, slowed: 0 };
const enemies = []; const projectiles = []; const effects = []; const drops = [];

const el = (id) => document.getElementById(id);

// --- Initialization & Fetch Pipeline --- //

async function initializeData() {
    try {
        const [classesRes, enemiesRes, itemsRes] = await Promise.all([
            fetch('data/classes.json'), fetch('data/enemies.json'), fetch('data/items.json')
        ]);
        if (!classesRes.ok || !enemiesRes.ok || !itemsRes.ok) throw new Error("Fetch failed.");

        classDataConfig = await classesRes.json();
        enemyDataConfig = await enemiesRes.json();
        itemDataConfig = await itemsRes.json();
        
        el('loading-text').classList.add('hidden');
        el('class-selection').classList.remove('hidden');
    } catch (e) {
        console.error("Failed to load JSON:", e);
        el('loading-text').innerText = "Error: Could not load data. Ensure Python server is running on localhost.";
        el('loading-text').style.color = "#d32f2f";
    }
}
initializeData();

window.chooseClass = (cid) => {
    selectedClassId = cid;
    el('class-selection').classList.add('hidden');
    el('dungeon-selection').classList.remove('hidden');
};

window.selectDungeon = (did) => {
    activeDungeon = enemyDataConfig[did];
    startGame(selectedClassId);
};

function startGame(className) {
    activeClass = JSON.parse(JSON.stringify(classDataConfig[className])); 
    player.color = activeClass.color;
    player.x = canvas.width / 2; player.y = canvas.height / 2;
    player.level = 1; player.xp = 0; player.maxXp = 50; player.gold = 0; player.bonusDmg = 0.0; player.skillPoints = 0;
    wave = 0; equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; inventory = [];
    
    recalcStats();
    player.hp = player.maxHp;
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0;
    
    el('start-screen').classList.add('hidden');
    el('hud').classList.remove('hidden');
    
    gameState = STATE.PLAYING;
    lastTime = performance.now();
    updateHUD();
    startNextWave();
    loop();
}

function recalcStats() {
    let gearHp = equipment.armor ? equipment.armor.val : 0;
    player.maxHp = activeClass.baseMaxHp + gearHp;
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    
    let gearMs = equipment.boots ? equipment.boots.val : 0;
    player.speed = 250 + gearMs;
    updateHUD();
}

function calcDmg(baseAmount, skillLevel = 1) {
    let scaledBase = baseAmount + (skillLevel > 1 ? (skillLevel - 1) * (baseAmount * 0.3) : 0);
    let mult = activeClass.dmgMult;
    if (equipment.weapon) mult += equipment.weapon.val;
    return scaledBase * mult * (1.0 + player.bonusDmg);
}

function getCDR() {
    let cdr = 1.0;
    if (equipment.amulet && equipment.amulet.type === 'amulet' && equipment.amulet.rarity !== 'rare') cdr -= equipment.amulet.val;
    return Math.max(0.2, cdr); 
}

// --- Universal Damage Logic (Thief Evade & Shield Block) --- //
function applyDamage(enemy, amount) {
    if (enemy.type === 'thief' && Math.random() < 0.20) {
        effects.push({ type: 'text', text: 'Evaded!', x: enemy.x, y: enemy.y - 20, color: '#fff', life: 0.6, maxLife: 0.6 });
        return;
    }
    if (enemy.type === 'shield') {
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        let diff = enemy.facingAngle - angleToPlayer;
        while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
        if (Math.abs(diff) < Math.PI / 2) {
            amount *= 0.5;
            effects.push({ type: 'text', text: 'Blocked', x: enemy.x, y: enemy.y - 20, color: '#78909c', life: 0.6, maxLife: 0.6 });
        }
    }
    enemy.hp -= amount;
    checkEnemyDeath(enemy);
}

function gainXP(amount) {
    player.xp += amount;
    let leveledUp = false;
    while (player.xp >= player.maxXp) {
        player.level++; player.xp -= player.maxXp; player.maxXp = Math.floor(player.maxXp * 1.5);
        player.skillPoints++; leveledUp = true;
    }
    if (leveledUp && gameState === STATE.PLAYING) triggerLevelUp();
    updateHUD();
}

function generateItem(tierLevel) {
    const types = itemDataConfig.slots;
    const type = types[Math.floor(Math.random() * types.length)];
    const tier = Math.max(1, Math.ceil(tierLevel / 2));
    
    const slotData = itemDataConfig.slotData[type];
    const val = tier * slotData.valMult;
    let displayVal = (type === 'weapon' || type === 'gloves' || type === 'amulet') ? Math.round(val * 100) : Math.round(val);
    
    return { id: Math.random().toString(36).substr(2, 9), name: `T${tier} ${slotData.namePrefix}`, type, val, desc: slotData.descTemplate.replace('{VAL}', displayVal), price: tier * 25, rarity: 'common' };
}

function triggerLevelUp() {
    if (gameState === STATE.EVOLVE || player.skillPoints <= 0) return;
    gameState = STATE.LEVELUP; isProcessingClick = false; 
    
    el('levelup-screen').querySelector('h1').innerText = `LEVEL UP! (${player.skillPoints} Points)`;
    el('levelup-screen').classList.remove('hidden');
    const container = el('skill-buttons'); container.innerHTML = '';
    
    let allMaxed = true;
    for (let i = 1; i <= 4; i++) {
        const sk = activeClass.skills[i];
        const btn = document.createElement('button'); btn.className = 'btn';
        
        if (i === 4 && player.level < 6) { btn.innerText = `[LOCKED] ${sk.name} (Unlocks at Lv.6)`; btn.disabled = true; } 
        else if (sk.level >= 5) { btn.innerText = `${sk.name} (MAX LEVEL)`; btn.disabled = true; } 
        else {
            allMaxed = false; 
            if (sk.level === 0) btn.innerText = `Unlock ${sk.name}`;
            else if (sk.level === 2) { btn.innerText = `EVOLVE ${sk.name} (Rank 3)`; btn.style.borderColor = '#ffca28'; btn.style.color = '#ffca28'; }
            else btn.innerText = `Upgrade ${sk.name} (Lv.${sk.level} -> Lv.${sk.level + 1})`;
            
            btn.onclick = () => {
                if (isProcessingClick) return; isProcessingClick = true; 
                if (sk.level === 2) triggerEvolution(i); else { sk.level++; finishLevelUp(); }
            };
        }
        container.appendChild(btn);
    }

    if (allMaxed) {
        const btn = document.createElement('button'); btn.className = 'btn'; btn.style.borderColor = '#00e676'; btn.style.color = '#00e676';
        btn.innerText = "All Skills Maxed! Gain +20 Max HP & +5% DMG";
        btn.onclick = () => {
            if (isProcessingClick) return; isProcessingClick = true;
            player.maxHp += 20; player.hp += 20; player.bonusDmg += 0.05; finishLevelUp();
        };
        container.appendChild(btn);
    }
}

function triggerEvolution(skillIndex) {
    el('levelup-screen').classList.add('hidden');
    gameState = STATE.EVOLVE; evolvingSkillId = skillIndex;
    const sk = activeClass.skills[skillIndex];
    
    el('upgrade-screen').classList.remove('hidden');
    el('evolve-skill-name').innerText = sk.name;
    el('upg-a-title').innerText = sk.upgA.name; el('upg-a-desc').innerText = sk.upgA.desc;
    el('upg-b-title').innerText = sk.upgB.name; el('upg-b-desc').innerText = sk.upgB.desc;
    isProcessingClick = false; 
}

window.selectUpgrade = function(path) {
    if (gameState !== STATE.EVOLVE || isProcessingClick) return; isProcessingClick = true;
    const sk = activeClass.skills[evolvingSkillId];
    sk.level++; sk.selectedUpg = path;
    el('upgrade-screen').classList.add('hidden'); finishLevelUp();
}

function finishLevelUp() {
    player.skillPoints--;
    if (player.skillPoints > 0) { triggerLevelUp(); } 
    else {
        el('levelup-screen').classList.add('hidden'); updateHUD();
        if (enemiesToSpawn === 0 && activeEnemies === 0) {
            gameState = STATE.INTERMISSION;
            el('intermission-title').innerText = isBossWave ? "Boss Defeated!" : "Wave Cleared";
            el('btn-shop').classList.toggle('hidden', !isBossWave); 
            el('intermission-screen').classList.remove('hidden');
        } else {
            gameState = STATE.PLAYING; lastTime = performance.now(); 
        }
    }
}

function startNextWave() {
    wave++; isBossWave = (wave % 5 === 0); bossSpawned = false;
    enemiesToSpawn = isBossWave ? 4 : 3 + Math.floor(wave * 2.5);
    activeEnemies = 0; enemySpawnTimer = 1.0;
    
    el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.add('hidden'); el('shop-screen').classList.add('hidden');
    player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.3)); 
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD();
    
    if (player.skillPoints > 0) triggerLevelUp();
}

function spawnEnemy() {
    enemiesToSpawn--; activeEnemies++;
    let ex, ey;
    if (Math.random() < 0.5) { ex = Math.random() < 0.5 ? -30 : canvas.width + 30; ey = Math.random() * canvas.height; } 
    else { ex = Math.random() * canvas.width; ey = Math.random() < 0.5 ? -30 : canvas.height + 30; }

    if (isBossWave && !bossSpawned && enemiesToSpawn === 0) {
        bossSpawned = true; const b = activeDungeon.boss;
        const bossHp = b.baseHp + (wave * b.hpScale);
        enemies.push({ x: canvas.width/2, y: -50, size: b.size, color: b.color, speed: b.baseSpeed, hp: bossHp, maxHp: bossHp, type: b.type, dmg: b.baseDmg + (wave * b.dmgScale), xp: b.baseXp, attackTimer: b.attackTimer, frozenTimer: 0, state: 'idle', stateTimer: 2.0, facingAngle: 0 });
        updateHUD(); return;
    }

    const roll = Math.random(); let cumulative = 0; let m = activeDungeon.minions[0];
    for (const minion of activeDungeon.minions) { cumulative += minion.weight; if (roll <= cumulative) { m = minion; break; } }
    
    const hpScale = m.baseHp + (wave * m.hpScale);
    const dmgScale = m.baseDmg + (wave * m.dmgScale);
    const speed = m.baseSpeed + Math.random() * m.speedVar;
    
    enemies.push({ x: ex, y: ey, size: m.size, color: m.color, speed: speed, hp: hpScale, maxHp: hpScale, type: m.type, dmg: dmgScale, xp: m.baseXp + (wave * m.xpScale), attackTimer: m.attackTimer || 0, ammo: m.ammo || 0, frozenTimer: 0, facingAngle: 0 });
    updateHUD();
}

function collectAllDrops() {
    for (const d of drops) {
        if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
        else if (d.type === 'dmg') { player.bonusDmg += 0.05; }
        else if (d.type === 'gold') { player.gold += d.val; }
        else if (d.type === 'item') { inventory.push(d.itemData); }
    }
    drops.length = 0; updateHUD();
}

function checkEnemyDeath(e) {
    if (e.hp <= 0) {
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
        
        gainXP(e.xp);
        const idx = enemies.indexOf(e); if (idx > -1) enemies.splice(idx, 1);
        activeEnemies--; score++; updateHUD();

        if (enemiesToSpawn === 0 && activeEnemies === 0) {
            collectAllDrops();
            if (gameState === STATE.PLAYING) { 
                gameState = STATE.INTERMISSION;
                el('intermission-title').innerText = isBossWave ? "Boss Defeated!" : "Wave Cleared";
                el('btn-shop').classList.toggle('hidden', !isBossWave); 
                el('intermission-screen').classList.remove('hidden');
            }
        }
    }
}

// UI Nav exposed to global
window.openInventory = () => { gameState = STATE.INVENTORY; el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.remove('hidden'); renderInventory(); }
window.closeInventory = () => { el('inventory-screen').classList.add('hidden'); el('intermission-screen').classList.remove('hidden'); }
window.openShop = () => { gameState = STATE.SHOP; el('intermission-screen').classList.add('hidden'); el('shop-screen').classList.remove('hidden'); generateShop(); renderShop(); }
window.closeShop = () => { el('shop-screen').classList.add('hidden'); el('intermission-screen').classList.remove('hidden'); }
window.startNextWave = startNextWave;

function equipItem(itemIndex) {
    const item = inventory[itemIndex];
    if (equipment[item.type]) inventory.push(equipment[item.type]); 
    equipment[item.type] = item; inventory.splice(itemIndex, 1);
    recalcStats(); renderInventory();
}

function renderInventory() {
    const types = itemDataConfig.slots;
    types.forEach(t => {
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
    shopItems = [];
    for(let i=0; i<3; i++) shopItems.push(generateItem(wave + 2)); 
    shopItems.push({ id: 'rare_wep', name: activeClass.rareWeapon.name, type: 'weapon', val: 2.0, desc: activeClass.rareWeapon.desc, price: 250, rarity: 'rare' });
    shopItems.push({ id: 'rare_arm', name: activeClass.rareArmor.name, type: 'armor', val: activeClass.name==='Dragonknight'?150:activeClass.name==='Ranger'?80:60, desc: activeClass.rareArmor.desc, price: 200, rarity: 'rare' });
    shopItems.push({ id: 'rare_amu', name: activeClass.rareAmulet.name, type: 'amulet', val: 0, desc: activeClass.rareAmulet.desc, price: 200, rarity: 'rare' });
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
    el('hp-bar').style.width = Math.max(0, (player.hp / player.maxHp * 100)) + '%'; el('hp-text').innerText = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    el('xp-bar').style.width = Math.max(0, (player.xp / player.maxXp * 100)) + '%'; el('xp-text').innerText = `${player.xp} / ${player.maxXp} XP`;
    el('wave-display').innerText = `Wave ${wave}`; el('wave-subtext').innerText = `Enemies Left: ${enemiesToSpawn + activeEnemies}`; el('gold-display').innerText = `Gold: ${player.gold}`;

    let skillText = [];
    for(let i=1; i<=4; i++) { if (activeClass.skills[i].level > 0) skillText.push(`${i}: ${activeClass.skills[i].name}`); }
    if (equipment.weapon && equipment.weapon.rarity === 'rare') skillText.push(`RMB: ${activeClass.rareWeapon.rmbSkill}`);
    el('skill-display').innerText = skillText.join(' | ');
    el('perm-display').innerText = player.bonusDmg > 0 ? `Perm DMG: +${Math.round(player.bonusDmg * 100)}%` : '';
}

// --- Input, Casting & Game Loop --- //

window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mousedown', e => { 
    if (e.button === 0) isMouseDown = true; 
    if (e.button === 2 && equipment.weapon && equipment.weapon.rarity === 'rare' && cooldowns.rmb <= 0 && gameState === STATE.PLAYING) castRMB();
});
window.addEventListener('mouseup', e => { if (e.button === 0) isMouseDown = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'p') {
        if (gameState === STATE.PLAYING) gameState = STATE.PAUSED;
        else if (gameState === STATE.PAUSED) { gameState = STATE.PLAYING; lastTime = performance.now(); }
        return;
    }
    if (gameState !== STATE.PLAYING || player.hp <= 0) return;
    if (k === 'w') keys.w = true; if (k === 'a') keys.a = true; if (k === 's') keys.s = true; if (k === 'd') keys.d = true;
    for (let i=1; i<=4; i++) if (k === i.toString() && cooldowns[`s${i}`] <= 0 && activeClass.skills[i].level > 0) castSkill(i);
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = false; if (k === 'a') keys.a = false; if (k === 's') keys.s = false; if (k === 'd') keys.d = false;
});

function getVector(x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; return [dx, dy, Math.hypot(dx, dy)]; }
function getNearestEnemyFromPoint(x, y, range, excludeList = []) {
    let nearest = null; let minDist = range;
    for(const e of enemies) { if (excludeList.includes(e)) continue; const dist = Math.hypot(e.x - x, e.y - y); if(dist < minDist) { minDist = dist; nearest = e; } }
    return nearest;
}

function castRMB() {
    cooldowns.rmb = 4.0 * getCDR();
    if (activeClass.name === 'Dragonknight') {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        effects.push({ type: 'cone', x: player.x, y: player.y, radius: 150, angle: attackAngle, spread: Math.PI/1.5, color: '#2196f3', life: 0.25, maxLife: 0.25 });
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= 150 + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= (Math.PI/1.5)/2) applyDamage(e, calcDmg(80));
            }
        }
    } else if (activeClass.name === 'Spellweaver') {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        const endX = player.x + Math.cos(angle) * 500; const endY = player.y + Math.sin(angle) * 500;
        effects.push({ type: 'line', x1: player.x, y1: player.y, x2: endX, y2: endY, color: '#2196f3', life: 0.3, maxLife: 0.3 });
        const l2 = 500*500;
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            let t = ((e.x - player.x) * (endX - player.x) + (e.y - player.y) * (endY - player.y)) / l2; t = Math.max(0, Math.min(1, t));
            const projX = player.x + t * (endX - player.x); const projY = player.y + t * (endY - player.y);
            if (Math.hypot(e.x - projX, e.y - projY) < e.size/2 + 20) applyDamage(e, calcDmg(120));
        }
    } else if (activeClass.name === 'Ranger') {
        const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        for(let i = -1; i <= 1; i++) {
            const angle = baseAngle + (i * 0.2);
            projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*1500, vy: Math.sin(angle)*1500, radius: 8, color: '#2196f3', life: 1.5, type: 'pierce', damage: calcDmg(60), pierce: true, hitList: [], isEnemy: false });
        }
    }
    updateHUD();
}

function castSkill(index) {
    const sk = activeClass.skills[index];
    cooldowns[`s${index}`] = sk.maxCd * getCDR();
    let dmg = calcDmg(sk.baseDmg, sk.level);

    if (activeClass.name === 'Dragonknight') {
        if (index===1) {
            let radius = 100 + (sk.level*10); if (sk.selectedUpg === 'A') radius *= 1.5; if (sk.selectedUpg === 'B') dmg *= 1.5;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: radius, color: 'rgba(229, 57, 53, 0.4)', life: 0.25, maxLife: 0.25 });
            for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= radius + enemies[i].size/2) applyDamage(enemies[i], dmg); }
        }
        else if (index===2) {
            let radius = sk.selectedUpg === 'A' ? 180 : 120; let stunTime = sk.selectedUpg === 'B' ? 4.0 : 2.0;
            if (equipment.amulet && equipment.amulet.name === 'Heart of the Mountain') { stunTime = 4.0; buffs.msBoost = 3.0; }
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: radius, color: '#ffb74d', life: 0.3, maxLife: 0.3 });
            for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= radius + enemies[i].size/2) { applyDamage(enemies[i], dmg); enemies[i].frozenTimer = stunTime; } }
        }
        else if (index===3) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let maxDist = sk.selectedUpg === 'A' ? 450 : 300; if (sk.selectedUpg === 'B') dmg *= 2.0; const moveDist = Math.min(dist, maxDist);
            effects.push({ type: 'line', x1: player.x, y1: player.y, x2: player.x + (dx/dist)*moveDist, y2: player.y + (dy/dist)*moveDist, color: '#e53935', life: 0.2, maxLife: 0.2 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: 80, color: '#ef5350', life: 0.3, maxLife: 0.3 });
            for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg); }
        }
        else if (index===4) {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let range = sk.selectedUpg === 'B' ? 375 : 250; let spread = sk.selectedUpg === 'A' ? Math.PI*2 : Math.PI/3;
            effects.push({ type: 'cone', x: player.x, y: player.y, radius: range, angle: attackAngle, spread: spread, color: 'rgba(255, 87, 34, 0.7)', life: 0.15, maxLife: 0.15 });
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= range + enemies[i].size/2) {
                    let diff = Math.atan2(enemies[i].y-player.y, enemies[i].x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    if (Math.abs(diff) <= spread/2) applyDamage(enemies[i], dmg);
                }
            }
        }
    } else if (activeClass.name === 'Spellweaver') {
        if (index===1) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let speed = sk.selectedUpg === 'A' ? 600 : 400; let life = sk.selectedUpg === 'A' ? 3.0 : 2.0;
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*speed, vy: (dy/dist)*speed, radius: 12, color: '#ff5722', life: life, type: 'fireball', damage: dmg, pierce: false, isEnemy: false, sourceSkill: sk });
        }
        else if (index===2) {
            let radius = sk.selectedUpg === 'B' ? 225 : 150;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: radius, color: '#81d4fa', life: 0.4, maxLife: 0.4 });
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= radius + enemies[i].size/2) {
                    applyDamage(enemies[i], dmg); if(sk.selectedUpg === 'A') enemies[i].speed = 0; enemies[i].frozenTimer = 3.0; 
                }
            }
        }
        else if (index===3) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 300); const startX = player.x; const startY = player.y;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: player.radius, color: player.color, life: 0.2, maxLife: 0.2 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist;
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*600, vy: (ty/td)*600, radius: 8, color: '#e040fb', life: 1.5, type: 'basic', damage: calcDmg(30), pierce: false, isEnemy: false });
                }
            }
            if (sk.selectedUpg === 'B') {
                effects.push({ type: 'circle', x: startX, y: startY, radius: 100, color: '#81d4fa', life: 0.3, maxLife: 0.3 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(startX-enemies[i].x, startY-enemies[i].y) <= 100 + enemies[i].size/2) { applyDamage(enemies[i], dmg); enemies[i].frozenTimer = 2.0; } }
            }
        }
        else if (index===4) {
            const tx = mouseX; const ty = mouseY; let radius = sk.selectedUpg === 'B' ? 180 : 120;
            if (sk.selectedUpg === 'A') {
                effects.push({ type: 'circle', x: tx, y: ty, radius: radius, color: '#ff5722', life: 0.4, maxLife: 0.4 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= radius + enemies[i].size/2) applyDamage(enemies[i], dmg); }
            } else {
                effects.push({ type: 'circle', x: tx, y: ty, radius: radius, color: 'rgba(255, 87, 34, 0.3)', life: 1.0, maxLife: 1.0, isWarning: true });
                setTimeout(() => {
                    if(gameState!==STATE.PLAYING) return;
                    effects.push({ type: 'circle', x: tx, y: ty, radius: radius, color: '#ff5722', life: 0.4, maxLife: 0.4 });
                    for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= radius + enemies[i].size/2) applyDamage(enemies[i], dmg); }
                }, 1000);
            }
        }
    } else if (activeClass.name === 'Ranger') {
        if (index===1) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let bounces = sk.selectedUpg === 'A' ? 5 : 3; if (sk.selectedUpg === 'B') dmg *= 1.5;
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*900, vy: (dy/dist)*900, radius: 6, color: '#ffeb3b', life: 3.0, type: 'ricochet', damage: dmg, pierce: false, isEnemy: false, bounces: bounces, hitList: [] });
        }
        else if (index===2) {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const count = sk.selectedUpg === 'A' ? 2 + sk.level + 2 : 2 + sk.level; const pierce = sk.selectedUpg === 'B';
            for(let i = -count; i <= count; i++) {
                const angle = baseAngle + (i * 0.1);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*800, vy: Math.sin(angle)*800, radius: 4, color: '#e0e0e0', life: 1.2, type: pierce?'pierce':'basic', damage: dmg, pierce: pierce, hitList: [], isEnemy: false });
            }
        }
        else if (index===3) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, sk.selectedUpg === 'B' ? 525 : 350);
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: player.radius, color: player.color, life: 0.2, maxLife: 0.2 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist;
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*1000, vy: (ty/td)*1000, radius: 6, color: '#00e676', life: 1.5, type: 'pierce', damage: calcDmg(40), pierce: true, hitList: [], isEnemy: false });
                }
            }
        }
        else if (index===4) {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if (sk.selectedUpg === 'B') dmg *= 1.5; let radius = sk.selectedUpg === 'A' ? 20 : 10;
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*1200, vy: (dy/dist)*1200, radius: radius, color: '#00e676', life: 2.0, type: 'pierce', damage: dmg, pierce: true, hitList: [], isEnemy: false });
        }
    }
}

// Fixed Attack Speed Model: 0.15s hard lock + variable gear cooldown
function castBasic() {
    const ANIM_LOCK = 0.15;
    let gloveBonus = equipment.gloves ? equipment.gloves.val : 0; 
    cooldowns.basic = ANIM_LOCK + ((activeClass.basicAttackCD * getCDR()) / (1.0 + gloveBonus));
    const dmg = calcDmg(activeClass.basicDmg, 1);
    
    if (activeClass.weapon === 'sword') {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        effects.push({ type: 'cone', x: player.x, y: player.y, radius: 75, angle: attackAngle, spread: Math.PI/1.5, color: '#e0e0e0', life: 0.15, maxLife: 0.15 });
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= 75 + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= (Math.PI/1.5)/2) applyDamage(e, dmg);
            }
        }
    } else {
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        if (dist > 0) {
            let isPierce = (activeClass.name === 'Spellweaver' && equipment.armor && equipment.armor.name === 'Robes of the Magi');
            let numArrows = (activeClass.name === 'Ranger' && equipment.amulet && equipment.amulet.name === 'Pendant of the Hunt') ? 2 : 1;
            const baseAngle = Math.atan2(dy, dx);
            for(let i=0; i<numArrows; i++) {
                let angle = numArrows > 1 ? baseAngle - 0.1 + (i*0.2) : baseAngle;
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*700, vy: Math.sin(angle)*700, radius: activeClass.name === 'Ranger' ? 4 : 6, color: activeClass.name === 'Ranger' ? '#e0e0e0' : '#ffca28', life: 1.5, type: isPierce ? 'pierce' : 'basic', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false });
            }
        }
    }
}

function update(dt) {
    if (enemiesToSpawn > 0) { enemySpawnTimer -= dt; if (enemySpawnTimer <= 0) { spawnEnemy(); enemySpawnTimer = Math.max(0.5, 2.0 - (wave * 0.1)); } }
    if (cooldowns.basic > 0) cooldowns.basic -= dt;
    if (cooldowns.rmb > 0) cooldowns.rmb -= dt;
    for(let i=1; i<=4; i++) if (cooldowns[`s${i}`] > 0) cooldowns[`s${i}`] -= dt;
    if (buffs.msBoost > 0) buffs.msBoost -= dt;
    if (buffs.slowed > 0) buffs.slowed -= dt;

    let cdText = [];
    for(let i=1; i<=4; i++) { if (activeClass.skills[i].level > 0) cdText.push(`${i}: ${Math.max(0, cooldowns[`s${i}`]).toFixed(1)}s`); }
    if (equipment.weapon && equipment.weapon.rarity === 'rare') cdText.push(`RMB: ${Math.max(0, cooldowns.rmb).toFixed(1)}s`);
    el('cd-display').innerText = cdText.join(' | ');

    if (isMouseDown && cooldowns.basic <= 0) castBasic();

    let vx = 0; let vy = 0;
    if (keys.w) vy -= 1; if (keys.s) vy += 1; if (keys.a) vx -= 1; if (keys.d) vx += 1;
    const mag = Math.hypot(vx, vy);
    
    let currentSpeed = player.speed; 
    if (buffs.msBoost > 0) currentSpeed *= 1.5;
    if (buffs.slowed > 0) currentSpeed *= 0.5;

    if (mag > 0) {
        player.x += (vx / mag) * currentSpeed * dt; player.y += (vy / mag) * currentSpeed * dt;
        player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
    }

    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt; if (d.life <= 0) { drops.splice(i, 1); continue; }
        if (Math.hypot(player.x - d.x, player.y - d.y) < player.radius + d.radius) {
            if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); updateHUD(); } 
            else if (d.type === 'dmg') { player.bonusDmg += 0.05; updateHUD(); } 
            else if (d.type === 'gold') { player.gold += d.val; updateHUD(); }
            else if (d.type === 'item') { inventory.push(d.itemData); }
            drops.splice(i, 1);
        }
    }

    for (let i = effects.length - 1; i >= 0; i--) { effects[i].life -= dt; if (effects[i].life <= 0) effects.splice(i, 1); }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) { projectiles.splice(i, 1); continue; }

        if (p.isEnemy) {
            if (Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) {
                player.hp -= p.damage; if (player.hp < 0) player.hp = 0; updateHUD(); projectiles.splice(i, 1);
            }
        } else {
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (Math.hypot(p.x - e.x, p.y - e.y) < e.size/2 + p.radius) {
                    if (p.pierce && p.hitList.includes(e)) continue;

                    if (p.type === 'fireball') {
                        let explRadius = p.sourceSkill && p.sourceSkill.selectedUpg === 'B' ? 120 : 80;
                        effects.push({ type: 'circle', x: p.x, y: p.y, radius: explRadius, color: '#ff7043', life: 0.3, maxLife: 0.3 });
                        for(let k=enemies.length-1; k>=0; k--) {
                            if (Math.hypot(p.x - enemies[k].x, p.y - enemies[k].y) <= explRadius + enemies[k].size/2) applyDamage(enemies[k], p.damage);
                        }
                    } else if (p.type === 'ricochet') {
                        applyDamage(e, p.damage);
                        if (p.bounces > 0) {
                            p.bounces--; p.hitList.push(e);
                            let nextT = getNearestEnemyFromPoint(p.x, p.y, 400, p.hitList);
                            if (nextT) { const [nx, ny, nd] = getVector(p.x, p.y, nextT.x, nextT.y); p.vx = (nx/nd)*900; p.vy = (ny/nd)*900; } 
                            else { hit = true; } 
                        } else { hit = true; }
                    } else { applyDamage(e, p.damage); }
                    
                    if (p.pierce || p.type === 'ricochet') { if (p.type !== 'ricochet') p.hitList.push(e); } else { hit = true; break; }
                }
            }
            if (hit) projectiles.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.frozenTimer > 0) { e.frozenTimer -= dt; e.color = '#90caf9'; } 
        else { e.color = e.type === 'thief' ? '#ff9800' : e.type === 'archer' ? '#8d6e63' : e.type === 'shield' ? '#78909c' : e.type === 'boss_warlord' ? '#d84315' : e.type === 'boss_slime' ? '#cddc39' : e.type === 'slime_ranged' ? '#ab47bc' : '#8bc34a'; }

        const curSpd = (e.speed === 0 || e.frozenTimer > 0) ? (e.speed === 0 ? 0 : e.speed * 0.3) : e.speed;
        const [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
        
        if (edist > 0) {
            let targetAngle = Math.atan2(edy, edx);
            if (e.type === 'shield') {
                let diff = targetAngle - (e.facingAngle || 0);
                while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                e.facingAngle = (e.facingAngle || 0) + diff * 3.0 * dt; 
            } else {
                e.facingAngle = targetAngle;
            }
        }

        if (e.type === 'slime_melee' || e.type === 'thief' || e.type === 'shield') {
            if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size / 2) { 
                player.hp -= e.dmg * dt; if (player.hp < 0) player.hp = 0; updateHUD(); 
                if (e.type === 'slime_melee') buffs.slowed = 0.5; 
            }
        } else if (e.type === 'slime_ranged' || e.type === 'archer') {
            if (edist > 250) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            e.attackTimer -= dt;
            if (e.attackTimer <= 0 && edist <= 400 && e.frozenTimer <= 0) {
                projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*350, vy: (edy/edist)*350, radius: 6, color: e.type==='archer' ? '#8d6e63' : '#e040fb', life: 3.0, isEnemy: true, damage: e.dmg });
                if (e.type === 'archer') {
                    e.ammo--; if (e.ammo <= 0) { e.ammo = 3; e.attackTimer = 2.0; } else { e.attackTimer = 0.4; } 
                } else { e.attackTimer = 2.5; }
            }
        } else if (e.type === 'boss_slime') {
            e.stateTimer -= dt;
            if (e.state === 'idle') {
                if (edist > 50) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
                if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
                    if (Math.random() < 0.5) { e.state = 'bounce_telegraph'; e.stateTimer = 1.0; e.dashTargetX = player.x; e.dashTargetY = player.y; } 
                    else { e.state = 'fireball'; e.stateTimer = 0.5; }
                }
            } else if (e.state === 'fireball') {
                if (e.stateTimer <= 0) {
                    for(let r=0; r<4; r++) { const angle = (Math.PI*2/4) * r + (Math.PI/4); projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*300, vy: Math.sin(angle)*300, radius: 10, color: '#ff3d00', life: 4.0, isEnemy: true, damage: e.dmg }); }
                    e.state = 'idle'; e.stateTimer = 2.0;
                }
            } else if (e.state === 'bounce_telegraph') {
                effects.push({ type: 'circle', x: e.dashTargetX, y: e.dashTargetY, radius: 100, color: 'rgba(255, 235, 59, 0.3)', life: 0.1, maxLife: 0.1 });
                if (e.stateTimer <= 0) {
                    e.x = e.dashTargetX; e.y = e.dashTargetY;
                    effects.push({ type: 'circle', x: e.x, y: e.y, radius: 100, color: 'rgba(255, 235, 59, 0.7)', life: 0.3, maxLife: 0.3 });
                    if (Math.hypot(e.x - player.x, e.y - player.y) <= 100 + player.radius) { player.hp -= e.dmg * 2; if (player.hp < 0) player.hp = 0; updateHUD(); }
                    e.state = 'idle'; e.stateTimer = 2.0;
                }
            }
        } else if (e.type === 'boss_warlord') {
            e.stateTimer -= dt;
            if (e.state === 'idle') {
                if (edist > 80) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
                if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
                    if (Math.random() < 0.5) { e.state = 'knife_volley'; e.stateTimer = 0.5; } 
                    else { e.state = 'dash_telegraph'; e.stateTimer = 0.4; e.dashTargetX = player.x + (edx/edist)*250; e.dashTargetY = player.y + (edy/edist)*250; }
                }
            } else if (e.state === 'knife_volley') {
                if (e.stateTimer <= 0) {
                    const baseAngle = Math.atan2(edy, edx);
                    for(let r=-2; r<=2; r++) { projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle+(r*0.15))*500, vy: Math.sin(baseAngle+(r*0.15))*500, radius: 6, color: '#ff9800', life: 2.0, isEnemy: true, damage: e.dmg }); }
                    e.state = 'idle'; e.stateTimer = 2.0;
                }
            } else if (e.state === 'dash_telegraph') {
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size, color: 'rgba(216, 67, 21, 0.2)', life: 0.1, maxLife: 0.1 });
                if (e.stateTimer <= 0) { 
                    e.state = 'dash_execute'; 
                    e.stateTimer = 0.1; 
                    e.dashSpeedX = (e.dashTargetX - e.x) / 0.1; 
                    e.dashSpeedY = (e.dashTargetY - e.y) / 0.1; 
                }
            } else if (e.state === 'dash_execute') {
                e.x += e.dashSpeedX * dt; 
                e.y += e.dashSpeedY * dt;
                
                e.x = Math.max(e.size/2, Math.min(canvas.width - e.size/2, e.x));
                e.y = Math.max(e.size/2, Math.min(canvas.height - e.size/2, e.y));

                if (Math.hypot(e.x - player.x, e.y - player.y) < e.size/2 + player.radius) { player.hp -= e.dmg * 2; if (player.hp < 0) player.hp = 0; updateHUD(); }
                if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 2.0; }
            }
        }
    }
}

function draw() {
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; const gridSize = 100;
    const offsetX = (player.x % gridSize) * -0.2; const offsetY = (player.y % gridSize) * -0.2;
    for (let i = offsetX; i < canvas.width; i += gridSize) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for (let i = offsetY; i < canvas.height; i += gridSize) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    for (const d of drops) {
        if (d.type === 'item') ctx.fillStyle = '#4caf50'; else if (d.type === 'gold') ctx.fillStyle = '#ffd54f'; else ctx.fillStyle = d.type === 'hp' ? '#e53935' : '#ab47bc';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d.type === 'gold' ? '#000' : '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let icon = d.type === 'hp' ? '+' : d.type === 'dmg' ? '⚔' : d.type === 'gold' ? '$' : '♦'; ctx.fillText(icon, d.x, d.y);
    }

    for (const ef of effects) {
        ctx.globalAlpha = ef.isWarning ? 1.0 : ef.life / ef.maxLife; ctx.fillStyle = ef.color;
        if (ef.type === 'circle') { ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); if (ef.isWarning) { ctx.strokeStyle = '#ff5722'; ctx.lineWidth = 2; ctx.stroke(); } ctx.fill(); } 
        else if (ef.type === 'line') { ctx.strokeStyle = ef.color; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); } 
        else if (ef.type === 'cone') { ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.arc(ef.x, ef.y, ef.radius, ef.angle - ef.spread/2, ef.angle + ef.spread/2); ctx.closePath(); ctx.fill(); }
        else if (ef.type === 'text') { ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText(ef.text, ef.x, ef.y - (1.0 - (ef.life/ef.maxLife)) * 30); }
        ctx.globalAlpha = 1.0;
    }

    for (const e of enemies) {
        ctx.fillStyle = e.color;
        if (e.type === 'slime_ranged' || e.type.startsWith('boss')) { ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill(); } 
        else { ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); }
        
        if (e.type === 'shield') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.arc(e.x, e.y, e.size/2 + 2, e.facingAngle - Math.PI/2, e.facingAngle + Math.PI/2);
            ctx.stroke();
        }

        if (!e.type.startsWith('boss')) { ctx.fillStyle = '#000'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size, 4); ctx.fillStyle = '#4caf50'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size * (e.hp/e.maxHp), 4); }
    }

    for (const p of projectiles) {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill(); ctx.shadowBlur = 0;
    }

    if (player.hp > 0 && gameState !== STATE.MENU) {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x); ctx.lineWidth = 4;
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
        }
        ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    } else if (player.hp <= 0 && gameState !== STATE.MENU) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#d32f2f'; ctx.font = '64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('YOU DIED', canvas.width/2, canvas.height/2);
    }

    const boss = enemies.find(e => e.type.startsWith('boss'));
    if (boss) {
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
    if (gameState === STATE.PLAYING && player.hp > 0) update(dt);
    draw(); requestAnimationFrame(loop);
}