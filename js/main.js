// ==========================================
// main.js - Core Loop, Rendering, & Input
// ==========================================

// Menu flow: dungeon map (menu.js) -> class carousel -> run
window.selectDungeon = (did) => { activeDungeonId = did; activeDungeon = enemyDataConfig[did]; showClassSelection(); };
window.chooseClass = (cid) => { selectedClassId = cid; if (cid === 'druid') showCompanionChoice(); else startGame(cid); }; // druid.js: wolf or black jaguar first

function startGame(className) {
    activeClass = JSON.parse(JSON.stringify(classDataConfig[className])); 
    player.color = activeClass.color; player.x = canvas.width / 2; player.y = canvas.height / 2;
    player.level = 1; player.xp = 0; player.maxXp = 50; player.gold = 0; player.bonusDmg = 0.0; player.orbDmg = 0.0; player.bonusMaxHp = 0; player.skillPoints = 1;
    wave = 0; equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; inventory = [];
    isEndlessMode = false;
    
    player.blade = null;
    player.flow = 0; player.maxFlow = 100; player.stance = 'handheld'; player.comboStep = 0; player.comboTimer = 0;
    player.airborneBlade = { x: player.x, y: player.y, angle: 0, overrideX: null, overrideY: null, attackTimer: 0 };
    player.flowGainTimer = 0; // for decay tracking
    player.arcaneResonance = 0; // Spellweaver Resonance charges
    player.scrap = 0; // Machinist Scrap (bigger turrets)

    recalcStats(); player.hp = player.maxHp; player.shield = 0; player.shieldTimer = 0; player.markTimer = 0; player.cowlCooldown = 0; player.iFrames = 0;
    buffs.rooted = 0; buffs.weakened = 0; buffs.evade100 = 0; buffs.deathMarkActive = 0; buffs.overclockTimer = 0; buffs.dragonfire = 0; buffs.lightningRod = false;
    player.phantomDecoy = null;
    player.dash = null; player.z = 0; player.grappleTarget = null; player.charge = null; player.heavy = null; comboOpen = null; dashGhosts.length = 0;
    resetPaladinState();
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0; gameTimers.length = 0; particles.length = 0;
    currentMap.type = null; setStageMap(mapTypeForWave(1)); // stage.js: places the hero at the map's start
    resetDruidState(true); // druid.js: the wolf starts at the hero's side, Bond empty
    
    el('start-screen').classList.add('hidden'); 
    resetHUD(); shopWave = -1; waveBreak = 0;
    el('hud').classList.remove('hidden');
    el('hud-top').classList.remove('hidden');
    if (isTraining()) startTraining(); // training.js: no waves, every skill at rank 1, the panel
    else triggerLevelUp("Choose Starting Skill");
    loop();
}

window.startEndlessMode = function() {
    isEndlessMode = true;
    el('intermission-screen').classList.add('hidden');
    // Clear leftovers from the final boss fight (summoned guards, archers, corpses) so the wave counter starts clean
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0; gameTimers.length = 0;
    activeEnemies = 0; enemiesToSpawn = 0;
    startNextWave();
}

window.startNextWave = function() {
    // Regular waves start mid-fight (stage.js onWaveCleared), so only a new run, a new map or a screen resets the hero's kit
    const fresh = gameState !== STATE.PLAYING || wave === 0 || mapTypeForWave(wave + 1) !== currentMap.type;
    wave++; waveBreak = 0;
    if (fresh) resetPaladinState(); // the Paladin's hammer returns to hand
    isBossWave = (wave % 5 === 0); 
    bossSpawned = false;
    enemiesToSpawn = isBossWave ? 4 : 3 + Math.floor(wave * 2.5); 
    
    if (activeDungeonId === 'bandit_bastion' && wave === 11 && !isEndlessMode) { isBossWave = true; enemiesToSpawn = 0; }
    if (activeDungeonId === 'bandit_bastion' && wave === 10 && !isEndlessMode) { // the Beastmaster alone (map_trail.js)
        if (trl.guard && !trl.guard.dead && enemies.includes(trl.guard)) { enemiesToSpawn = 0; bossSpawned = true; activeEnemies++; } // already at the bridgehead since the logjam opened (his hounds counted themselves)
        else { enemiesToSpawn = 1; enemySpawnTimer = 0; } // a jump straight to wave 10: he's there at once
    }
    if (activeDungeonId === 'bandit_bastion' && wave >= 12 && !isEndlessMode) { // the castle (map_castle.js): wave 15 is a regular wave, and its waves are a little smaller than the formula
        isBossWave = false; enemiesToSpawn = CS_COUNT[Math.min(wave, 15) - 12];
        if (wave >= 16) { isBossWave = true; enemiesToSpawn = 0; } // the throne room: its scenes bring the Royal Guard (16) and Valerius (17)
    }
    setStageMap(mapTypeForWave(wave)); // stage.js
    if (currentMap.type === 'trail') trailEnter(wave); // map_trail.js: a jump to wave 8 / 10 starts in the right section with the logjams open
    if (currentMap.type === 'castle') castleEnter(wave); // map_castle.js: the same for a jump to wave 14 / 16
    player.exitFade = 0; player.fadeOut = 0;
    if (fresh) { player.dash = null; player.z = 0; player.grappleTarget = null; player.charge = null; player.heavy = null; } // never carry a dash or a charge across a map change

    if (fresh) resetDruidState(); // druid.js: the companion comes back to heel (spirits stay through a regular wave)
    if (wave > 1) awakenWeapon(); // items.js: the last wave was cleared, so the rare weapon grows
    el('intermission-screen').classList.add('hidden'); el('inventory-screen').classList.add('hidden'); el('shop-screen').classList.add('hidden');
    player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.3)); 
    waveStats = { kills: 0, gold0: player.gold, time: 0, dmgTaken: 0, peak: 0 };
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD(); showWaveBanner();
    if (player.skillPoints > 0) triggerLevelUp();
}

// ==========================================
// Initialization & Stat Calculation
// ==========================================

async function initializeData() {
    try {
        const [classesRes, enemiesRes, itemsRes] = await Promise.all([ 
            fetch('data/classes.json'), 
            fetch('data/enemies.json'), 
            fetch('data/items.json') 
        ]);
        if (!classesRes.ok || !enemiesRes.ok || !itemsRes.ok) throw new Error("Fetch failed.");
        classDataConfig = await classesRes.json(); 
        enemyDataConfig = await enemiesRes.json(); 
        itemDataConfig = await itemsRes.json();
        
        el('loading-text').classList.add('hidden'); 
        openMainMenu();
    } catch (e) {
        console.error("Failed to load JSON:", e);
        el('loading-text').innerText = "Error: Could not load data. Ensure Python server is running on localhost."; 
        el('loading-text').style.color = "#d32f2f";
    }
}
initializeData();

function recalcStats() {
    let gearHp = equipment.armor ? equipment.armor.val : 0;
    player.maxHp = activeClass.baseMaxHp + gearHp + (player.bonusMaxHp || 0);
    player.armor = activeClass.baseArmor;
    if (player.hp > player.maxHp) player.hp = player.maxHp;

    let gearMs = equipment.boots ? equipment.boots.val : 0;
    player.speed = 250 + gearMs;
    
    player.maxFlow = 100;
    
    if (typeof updateHUD === "function") updateHUD();
}

// A boss from its enemies.json entry at wave w's strength (spawnEnemy; map_trail.js places the Beastmaster ahead of his wave)
function pushBoss(b, w, x, y) {
    const hp = b.baseHp + w * b.hpScale;
    const e = { x, y, size: b.size, color: b.color, speed: b.baseSpeed + w * 2.0, hp, maxHp: hp, type: b.type, dmg: b.baseDmg + w * b.dmgScale, xp: b.baseXp, attackTimer: b.attackTimer, meleeTimer: 0, frozenTimer: 0, state: 'idle', stateTimer: b.stateTimer || 2.0, facingAngle: 0, puddleTimer: 0, bleedTimer: 0, bleedDmg: 0 };
    enemies.push(e); return e;
}

function spawnEnemy() {
    enemiesToSpawn--; activeEnemies++;
    
    let ex, ey, spawnFrom;
    if (mapDef()) { const sp = pickSpawnPoint(); ex = sp.x; ey = sp.y; spawnFrom = sp.from; } // stage.js: tree line or cave mouth
    else {
        if (Math.random() < 0.5) { 
            ex = Math.random() < 0.5 ? currentMap.left - 30 : currentMap.right + 30; 
            ey = currentMap.top + Math.random() * (currentMap.bottom - currentMap.top); 
        } else { 
            ex = currentMap.left + Math.random() * (currentMap.right - currentMap.left); 
            ey = Math.random() < 0.5 ? currentMap.top - 30 : currentMap.bottom + 30; 
        }
    }

    const stage = isEndlessMode ? Math.floor(Math.random() * (activeDungeon.stage4_minions ? 4 : 3)) + 1 : (wave > 11 && activeDungeon.stage4_minions ? 4 : wave > 10 ? 3 : (wave > 5 ? 2 : 1));
    const allMinions = [...(activeDungeon.stage1_minions || []), ...(activeDungeon.stage2_minions || []), ...(activeDungeon.stage3_minions || []), ...(activeDungeon.stage4_minions || [])];
    let minionList = activeDungeon[`stage${stage}_minions`];
    // Slime Caves mixes every stage in Endless; any stage without minions (Bandit Bastion stage 3) falls back to the full pool
    if (!minionList || minionList.length === 0 || (isEndlessMode && activeDungeonId === 'slime_caves')) minionList = allMinions;
    if (currentMap.type === 'trail') minionList = trailMinions(minionList); // map_trail.js: the section's mix, riders and hounds capped
    if (currentMap.type === 'castle') minionList = castleMinions(minionList); // map_castle.js: the bailey's mix, the keep's

    if (isBossWave && !bossSpawned && enemiesToSpawn === 0) {
        bossSpawned = true; 
        let bList = [activeDungeon.stage1_boss, activeDungeon.stage2_boss, activeDungeon.stage3_boss].filter(b=>b);
        let b = isEndlessMode ? bList[Math.floor(Math.random()*bList.length)] : (activeDungeon[`stage${stage}_boss`] || activeDungeon.stage1_boss);
        const boss = pushBoss(b, wave, (currentMap.left + currentMap.right) / 2, currentMap.top + 100);
        if (mapDef()) startBossIntro(boss); // stage.js: out of the cave / out of the lakes
        updateHUD(); return;
    }

    if (minionList.length === 0) { activeEnemies--; updateHUD(); return; }

    const totalWeight = minionList.reduce((sum, mn) => sum + mn.weight, 0);
    const roll = Math.random() * totalWeight; let cumulative = 0; let m = minionList[0];
    for (const minion of minionList) { cumulative += minion.weight; if (roll <= cumulative) { m = minion; break; } }
    
    const speed = m.baseSpeed + Math.random() * m.speedVar + (wave * 2.5); 
    const pushMinion = (x, y) => { // a hound's pack mates are pushed the same way
        enemies.push({ x: x, y: y, size: m.size, color: m.color, speed: speed, hp: m.baseHp + (wave * m.hpScale), maxHp: m.baseHp + (wave * m.hpScale), type: m.type, dmg: m.baseDmg + (wave * m.dmgScale), xp: m.baseXp + (wave * m.xpScale), attackTimer: m.attackTimer || 0, meleeTimer: 0, ammo: m.ammo || 0, frozenTimer: 0, facingAngle: 0, shieldHp: m.shieldHp, shieldMax: m.shieldMax, puddleTimer: m.puddleTimer || 0, bleedTimer: 0, bleedDmg: 0, orbs: m.orbs || 0, maxOrbs: m.orbs || 0, spawnFrom });
        onEnemySpawned(enemies[enemies.length - 1]); // stage.js
    };
    pushMinion(ex, ey);
    const packMax = currentMap.type === 'trail' ? Math.min(1, trailRoom('hound')) : currentMap.type === 'castle' ? Math.min(1, castleRoom('hound')) : 2; // map_trail.js / map_castle.js: packs of 2 at most there, never past the cap
    if (m.type === 'hound') for (let k = 0; k < packMax && enemiesToSpawn > (isBossWave ? 1 : 0); k++) { // a pack: up to two more, each one a wave enemy
        enemiesToSpawn--; activeEnemies++; pushMinion(ex, ey + (k ? 30 : -30));
    }
    updateHUD();
}

window.addEventListener('mousemove', e => { mouseScreenX = e.clientX; mouseScreenY = e.clientY; mouseX = e.clientX / camZoom() + camera.x; mouseY = e.clientY / camZoom() + camera.y; }); // world coordinates (stage.js zoom)
window.addEventListener('mousedown', e => { 
    if (e.button === 0) { isMouseDown = true; lmbClicked = gameState === STATE.PLAYING; lmbPressedAt = fxTime; } // skills.js: a Dragonknight click mid-cooldown still swings (not a menu click); combos.js: fresh-press gates
    if (e.button === 2 && equipment.weapon && equipment.weapon.rarity === 'rare' && activeClass.rareWeapon.rmbSkill && (cooldowns.rmb <= 0 || devNoCooldowns) && gameState === STATE.PLAYING && !(stageEvent && stageEvent.blocking) && !player.charge) {
        if (startCharge('rmb')) return; // hold-to-charge ability: it fires on release (mouseup)
        castRmb();
    }
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) isMouseDown = false;
    if (e.button === 2) releaseCharge('rmb');
});
window.addEventListener('blur', () => { player.charge = null; player.heavy = null; isMouseDown = false; }); // a release we'll never hear about
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if (k === '`' || k === '~') {
        if (gameState === STATE.PLAYING) openDevMenu();
        else if (gameState === STATE.DEV) closeDevMenu();
        return;
    }
    if (k === ' ') { k = 'space'; e.preventDefault(); }
    if (k === 'p') {
        if (gameState === STATE.PLAYING) gameState = STATE.PAUSED;
        else if (gameState === STATE.PAUSED) { gameState = STATE.PLAYING; lastTime = performance.now(); }
        return;
    }
    if (gameState !== STATE.PLAYING || player.hp <= 0 || (stageEvent && stageEvent.blocking)) return; // no casting during a cutscene
    if (k === 'w') keys.w = true; if (k === 'a') keys.a = true; if (k === 's') keys.s = true; if (k === 'd') keys.d = true;
    
    const keyMap = { 'q': 1, 'e': 2, 'space': 3, 'r': 4 };
    if (keyMap[k]) {
        let i = keyMap[k];
        if (player.charge && player.charge.slot === i) return; // key auto-repeat while a charge is held
        if ((cooldowns[`s${i}`] <= 0 || devNoCooldowns) && activeClass.skills[i].level > 0) {
            if (activeClass.name === 'Kensei' && i === 2 && player.stance === 'handheld' && player.flow < player.maxFlow * (activeClass.skills[2].selectedUpg === 'B' ? 0.7 : 1)) { // Early Deploy: from 70%
                effects.push({ type: 'text', text: 'Not Enough Flow!', x: player.x, y: player.y - 40, color: '#ff5252', life: 0.6, maxLife: 0.6 });
                return;
            }
            // Optional per-class gate (e.g. the Paladin's shackle needs an enemy in range); refusing keeps the cooldown unspent
            const canCast = window.SkillRegistry[activeClass.name].canCast;
            if (canCast && !canCast(i)) return;

            if (comboSkill(i)) return; // combos.js: a skill pressed in a Space window or mid-dash (Skyline Shot, Wyrmfall)
            if (startCharge(i)) return; // hold-to-charge skill: it fires on release (keyup)
            castSkill(i);
        }
    }
});
window.addEventListener('keyup', e => { 
    let k = e.key.toLowerCase(); 
    if (k === ' ') k = 'space';
    if (k === 'w') keys.w = false; if (k === 'a') keys.a = false; if (k === 's') keys.s = false; if (k === 'd') keys.d = false; 
    const slot = { 'q': 1, 'e': 2, 'space': 3, 'r': 4 }[k]; if (slot) releaseCharge(slot);
});

// Cast skill slot i: spend the cooldown, run the on-cast class hooks, then the skill itself.
// k is the charge fraction (0..1) for hold-to-charge skills, undefined otherwise.
function castSkill(i, k, opt) { // opt: extra flags for the skill (combos.js, e.g. { skyline: true })
    const sk = activeClass.skills[i];
    let cdReduction = getCDR();
    let baseCd = skillBaseCd(i, sk.level); // combat.js: only some slots get shorter with rank

    cooldowns[`s${i}`] = devNoCooldowns ? 0 : baseCd * cdReduction;
    cooldownMax[`s${i}`] = cooldowns[`s${i}`];
    
    if (activeClass && activeClass.name === 'Cleric' && buffs.avatarOfRenewal > 0 && i !== 4) {
        let bolts = 3;
        for(let b=0; b<bolts; b++) {
            let angle = Math.random() * Math.PI * 2;
            projectiles.push({
                x: player.x, y: player.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400,
                radius: 8, color: '#fff', life: 3.0, type: 'basic', shape: 'light_spear', damage: calcDmg(activeClass.skills[4].baseDmg, activeClass.skills[4].level), pierce: false, isEnemy: false,
                customUpdate: function(dt, p) {
                    let nearest = getNearestEnemyFromPoint(p.x, p.y, 400);
                    if (nearest) {
                        let [dx, dy, dist] = getVector(p.x, p.y, nearest.x, nearest.y);
                        p.vx += (dx/dist)*900 * dt;
                        p.vy += (dy/dist)*900 * dt;
                        let vDist = Math.hypot(p.vx, p.vy);
                        if (vDist > 600) { p.vx = (p.vx/vDist)*600; p.vy = (p.vy/vDist)*600; }
                    }
                }
            });
        }
    }

    let dmg = calcDmg(sk.baseDmg, sk.level);
    // items.js: what some rares need from before the cast (where you stood, your Zeal, the turret a grapple latches onto)
    const before = { x: player.x, y: player.y, zeal: buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : (player.zeal || 0),
        anchor: i === 3 && activeClass.name === 'Machinist' ? projectiles.find(p => (p.type === 'turret' || p.type === 'tesla_coil_trap') && Math.hypot(p.x - mouseX, p.y - mouseY) < 50) : null };
    window.SkillRegistry[activeClass.name][i](sk, dmg, k, opt);
    if (i === 3) { // combos.js: the dash (or a pull: Paladin charge / Iron Pull, Machinist grapple) opens the finisher window when it lands
        comboCastAt = fxTime; // only an LMB press from now on counts for the finisher
        if (player.dash) player.dash.combo = true; else if (player.grappleTarget) player.grappleTarget.combo = true;
        else openCombo({ x0: before.x, y0: before.y, x1: player.x, y1: player.y }); // an instant one (Blink): the path from where it started
    }
    itemsOnCast(i, before);
}

function castRmb(k) {
    cooldowns.rmb = devNoCooldowns ? 0 : 4.0 * getCDR();
    window.SkillRegistry[activeClass.name]['rmb'](k);
}

// Hold-to-charge: SkillRegistry[class].charge[slot](sk) returns { max, slow } (and may start its own visuals),
// or null to cast at once this time (e.g. the Machinist with too little Scrap).
// Slot is 1-4 or 'rmb'. The cooldown starts on release, when the skill fires with the charge fraction.
function startCharge(slot) {
    const ch = window.SkillRegistry[activeClass.name].charge;
    if (!ch || !ch[slot]) return false;
    const cfg = ch[slot](slot === 'rmb' ? null : activeClass.skills[slot]);
    if (!cfg) return false;
    player.charge = { slot, t: 0, max: 1, slow: 1, ...cfg };
    return true;
}
function releaseCharge(slot) {
    const c = player.charge;
    if (!c || c.slot !== slot) return;
    player.charge = null;
    if (gameState !== STATE.PLAYING || (stageEvent && stageEvent.blocking)) return; // released during a pause or cutscene: the charge is lost
    const k = Math.min(1, c.t / c.max);
    if (slot === 'rmb') castRmb(k); else castSkill(slot, k);
}

function update(dt) {
    if (stageEvent && stageEvent.blocking) { // stage.js cutscene: only the scene, effects and particles move
        player.charge = null; // no charging through a cutscene
        updateStageEvent(dt); updateFx(dt);
        for (let i = effects.length - 1; i >= 0; i--) { if ((effects[i].life -= dt) <= 0) effects.splice(i, 1); }
        updateHUD(); return;
    }
    updateStage(dt);
    updateTraining(dt); // training.js: dummy meters, god mode
    if (waveBreak > 0 && (waveBreak -= dt) <= 0) { startNextWave(); return; } // the breather between regular waves ran out
    waveStats.time += dt;
    updateGameTimers(dt);
    updateFx(dt);
    updatePaladin(dt);
    updateDruid(dt); // druid.js: the wolves
    updateBanditFx(dt); // bandits.js: fire on the ground, lit powder kegs
    if (enemiesToSpawn > 0) { enemySpawnTimer -= dt; if (enemySpawnTimer <= 0) { spawnEnemy(); enemySpawnTimer = Math.max(0.5, 2.0 - (wave * 0.1)); } }
    if (cooldowns.basic > 0) cooldowns.basic -= dt;
    if (cooldowns.rmb > 0) cooldowns.rmb -= dt;
    for(let i=1; i<=4; i++) if (cooldowns[`s${i}`] > 0) cooldowns[`s${i}`] -= dt;
    if (buffs.msBoost > 0) buffs.msBoost -= dt;
    if (buffs.slowed > 0) buffs.slowed -= dt;
    if (buffs.rooted > 0) buffs.rooted -= dt;
    if (buffs.dragonfire > 0) buffs.dragonfire -= dt;
    updateCombo(dt); // combos.js: the finisher window runs out
    if (buffs.weakened > 0) buffs.weakened -= dt;
    if (buffs.evade100 > 0) buffs.evade100 -= dt;
    if (buffs.deathMarkActive > 0) buffs.deathMarkActive -= dt;
    if (player.cowlCooldown > 0) player.cowlCooldown -= dt;
    if (player.windGuardCd > 0) player.windGuardCd -= dt; // items.js: Windrunner Tunic
    if (player.vestmentCD > 0) player.vestmentCD -= dt;
    if (player.iFrames > 0) player.iFrames -= dt;
    if (player.phantomDecoy && player.phantomDecoy.life > 0) player.phantomDecoy.life -= dt;

    if (player.shield > 0) { player.shieldTimer -= dt; if (player.shieldTimer <= 0) { player.shield = 0; updateHUD(); } }
    // Frenzy: after 3 s without a melee hit, stacks drain one every 0.5 s (a short dodge doesn't wipe the bar)
    if (activeClass && activeClass.name === 'Dragonknight' && player.frenzyStacks > 0 && (player.frenzyTimer -= dt) <= 0) { player.frenzyStacks--; player.frenzyTimer = 0.5; }
    if (equipment.armor && equipment.armor.name === 'Hazard Suit') buffs.slowed = 0;

    if (activeClass && activeClass.name === 'Nightblade') {
        player.markTimer = (player.markTimer || 0) - dt;
        if (player.markTimer <= 0) {
            player.markTimer = 3.0;
            let unmarked = enemies.filter(e => e.markAngle === undefined && !e.dead && !e.pod && Math.hypot(player.x - e.x, player.y - e.y) < 400);
            let count = Math.floor(Math.random() * 3) + 1 + (hasItem('Sigil of the Hunt') ? 1 : 0); // items.js
            for (let i=0; i<count && unmarked.length > 0; i++) {
                // the biggest first (a boss always gets its weak point to hunt), then at random
                let idx = i === 0 ? unmarked.reduce((b, e, j) => e.size > unmarked[b].size ? j : b, 0) : Math.floor(Math.random() * unmarked.length);
                unmarked[idx].markAngle = Math.random() * Math.PI * 2;
                unmarked.splice(idx, 1);
            }
        }
    }

    if (activeClass && activeClass.name === 'Machinist' && buffs.overclockTimer > 0) {
        buffs.overclockTimer -= dt;
    }
    
    if (activeClass && activeClass.name === 'Cleric') {
        // Standing in a Sanctuary (Holy Hallowed Ground) doubles Zeal from basic attacks
        buffs.inSanctuary = projectiles.some(p => p.type === 'hallowed_ground' && p.isHoly && Math.hypot(player.x - p.x, player.y - p.y) <= p.radius);
        if (buffs.avatarOfRenewal > 0) {
            buffs.avatarOfRenewal -= dt;
            buffs.zealLocked = true;
            player.zeal = player.maxZeal;
            if (buffs.avatarOfRenewal <= 0) buffs.zealLocked = false;
        }
        if (buffs.aspectOfReaper > 0) {
            buffs.aspectOfReaper -= dt;
            player.hp = Math.max(1, player.hp - player.maxHp * REAPER_DRAIN * dt); // the Reaper drinks your life while it lasts (it never kills; kills heal)
            buffs.zealLocked = true;
            player.zeal = 0;
            if (buffs.aspectOfReaper <= 0) buffs.zealLocked = false;
        }
        if (buffs.ascension > 0) {
            buffs.ascension -= dt;
            // Maybe slight passive healing/dmg boost which we handle in dmg calc
        }
    }

    if (activeClass && activeClass.name === 'Kensei') {
        if (player.comboTimer > 0) {
            player.comboTimer -= dt;
            if (player.comboTimer <= 0) player.comboStep = 0;
        }
        if (player.qAnimTimer > 0) {
            player.qAnimTimer -= dt;
        }

        if (player.stance === 'handheld') {
            player.flowGainTimer += dt;
            if (player.flowGainTimer >= FLOW_GRACE) {
                player.flow = Math.max(0, player.flow - (FLOW_DECAY * dt)); // in hand, Flow fades once you stop landing hits
            }
            // Reposition blade to player (and drop a Guardian Orbit cut short by a recall)
            player.airborneBlade.x = player.x;
            player.airborneBlade.y = player.y;
            player.airborneBlade.orbit = null;
            player.airborneBlade.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        } else if (player.stance === 'airborne') {
            // Flow constantly decays in Airborne to put a cap on it
            player.flow = Math.max(0, player.flow - (15 * (hasItem('Prismatic Core') ? 0.7 : 1) * airborneDrain(activeClass.skills[2].level) * dt)); // a full bar keeps the blade out ~6.7 s (~9.5 s at E rank 4 or with the Prismatic Core)
            if (player.flow <= 0) {
                effects.push({ type: 'flash_line', x1: player.airborneBlade.x, y1: player.airborneBlade.y, x2: player.x, y2: player.y, color: '#00e5ff', life: 0.25, maxLife: 0.25, lineWidth: 6 });
                effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 40, color: 'rgba(0, 229, 255, 0.8)', life: 0.3, maxLife: 0.3 });
                player.stance = 'handheld';
                player.empoweredAirborne = false;
                player.airborneBlade.x = player.x;
                player.airborneBlade.y = player.y;
            }
            
            // Airborne Blade Logic (AI companion)
            let ab = player.airborneBlade;
            let targetSpeed = 400 + (player.flow / player.maxFlow) * 500; // Speed scales with Flow
            
            if (isMouseDown) {
                ab.overrideX = mouseX;
                ab.overrideY = mouseY;
            } else {
                ab.overrideX = null;
                ab.overrideY = null;
            }

            // Guardian Orbit (combos.js, the Spatial Swap finisher) circles the blade round you first; then steering, then seeking
            if (ab.orbit) updateOrbit(ab, dt);
            // Override takes precedence (Left click follow & slash)
            else if (ab.overrideX !== null) {
                let dx = ab.overrideX - ab.x; let dy = ab.overrideY - ab.y;
                let dist = Math.hypot(dx, dy);
                
                if (dist > 5) {
                    let moveAngle = Math.atan2(dy, dx);
                    // Smoothly rotate towards mouse
                    let angleDiff = moveAngle - ab.angle;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI*2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                    ab.angle += angleDiff * 12 * dt;
                    
                    let followSpeed = Math.min(1200, dist * 8); 
                    ab.x += Math.cos(ab.angle) * followSpeed * dt;
                    ab.y += Math.sin(ab.angle) * followSpeed * dt;
                }

                // Slash damage through enemies on path
                if (ab.attackTimer <= 0) {
                    let hitAnything = false;
                    for (const e of enemies) {
                        if (Math.hypot(e.x - ab.x, e.y - ab.y) < e.size / 2 + 50) {
                            applyDamage(e, bladeHitDmg(BLADE_STEER_MULT), 'slash');
                            let slashColor = player.empoweredAirborne ? 'rgba(0, 229, 255, 0.9)' : 'rgba(0, 188, 212, 0.7)';
                            let slashRadius = player.empoweredAirborne ? 75 : 50;
                            effects.push({ type: 'slash', x: e.x, y: e.y, angle: ab.angle, color: slashColor, life: 0.15, maxLife: 0.15, radius: slashRadius });
                            hitAnything = true;
                        }
                    }
                    if (hitAnything) {
                        let stanceBonus = (player.flow / player.maxFlow) * 0.5;
                        ab.attackTimer = (player.empoweredAirborne ? 0.1 : 0.2) / (1 + stanceBonus) / bladeAttackSpeed(); 
                    }
                } else {
                    ab.attackTimer -= dt;
                }
            } else {
                // Seek nearest enemy in 600 radius of the Blade itself (not player)
                let bestTarget = getNearestEnemyFromPoint(ab.x, ab.y, 600);
                if (bestTarget) {
                    let btx = bestTarget.x; let bty = bestTarget.y;
                    let dx = btx - ab.x; let dy = bty - ab.y;
                    let dist = Math.hypot(dx, dy);
                    let targetAngle = Math.atan2(dy, dx);

                    let angleDiff = targetAngle - ab.angle;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI*2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                    
                    if (ab.flyTimer === undefined) ab.flyTimer = 0;
                    
                    if (ab.flyTimer > 0) {
                        ab.flyTimer -= dt;
                    } else {
                        // Wide sweeping turn to face target
                        ab.angle += angleDiff * 5 * dt; 
                    }

                    // If we are looking reasonably towards the enemy and get close, enter Pierce mode
                    if (ab.flyTimer <= 0 && dist < 160 && Math.abs(angleDiff) < Math.PI/3) {
                        ab.flyTimer = 0.45; // Lock steering and dash forward for 0.45s to punch through and fly away
                    }

                    let currentSpeed = targetSpeed * 1.4;
                    if (ab.flyTimer > 0) {
                        currentSpeed *= 2.0; // Violent piercing speed
                    } else {
                        // Slow down slightly while turning around to make tighter turns
                        currentSpeed *= 0.9;
                    }

                    ab.x += Math.cos(ab.angle) * currentSpeed * dt;
                    ab.y += Math.sin(ab.angle) * currentSpeed * dt;
                    clampToBounds(ab, 20); // Prevent flying off the map edges
                    
                    ab.attackTimer -= dt;
                    // If close, damage as it flies through
                    if (ab.attackTimer <= 0 && dist < bestTarget.size / 2 + 50) {
                        applyDamage(bestTarget, bladeHitDmg(1), 'slash');
                        let stanceBonus = (player.flow / player.maxFlow) * 0.5; 
                        ab.attackTimer = Math.max(player.empoweredAirborne ? 0.1 : 0.2, (player.empoweredAirborne ? 0.3 : 0.6) / (1 + stanceBonus)) / bladeAttackSpeed(); 
                    }
                } else {
                    // Orbit player smoothly
                    let dx = player.x - ab.x;
                    let dy = player.y - ab.y;
                    let distToPlayer = Math.hypot(dx, dy);
                    
                    let orbitAngle = Date.now() / 500;
                    let ox = player.x + Math.cos(orbitAngle) * 80;
                    let oy = player.y + Math.sin(orbitAngle) * 80;
                    let tox = ox - ab.x;
                    let toy = oy - ab.y;
                    
                    let targetAngle = Math.atan2(toy, tox);
                    let angleDiff = targetAngle - ab.angle;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI*2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                    
                    ab.angle += angleDiff * 5 * dt;
                    
                    let returnSpeed = distToPlayer > 200 ? 900 : targetSpeed;
                    ab.x += Math.cos(ab.angle) * returnSpeed * dt;
                    ab.y += Math.sin(ab.angle) * returnSpeed * dt;
                    clampToBounds(ab, 20);
                }
            }
            
            // Reusable flow gain mechanics (decay handled above)
        }
        
        // Shatter Storm mini-blades
        if (player.miniBlades && player.miniBlades.length > 0) {
            for (let i = player.miniBlades.length - 1; i >= 0; i--) {
                let mb = player.miniBlades[i];
                mb.life -= dt;
                if (mb.life <= 0) {
                    player.miniBlades.splice(i, 1);
                    continue;
                }

                if (!mb.target || mb.target.hp <= 0) {
                    mb.target = getNearestEnemyFromPoint(mb.x, mb.y, 800);
                }

                if (mb.target) {
                    let dx = mb.target.x - mb.x;
                    let dy = mb.target.y - mb.y;
                    let dist = Math.hypot(dx, dy);
                    let targetAngle = Math.atan2(dy, dx);
                    
                    let angleDiff = targetAngle - mb.angle;
                    while(angleDiff < -Math.PI) angleDiff += Math.PI*2;
                    while(angleDiff > Math.PI) angleDiff -= Math.PI*2;
                    
                    mb.angle += angleDiff * 10 * dt;
                    let speed = 900;
                    mb.x += Math.cos(mb.angle) * speed * dt;
                    mb.y += Math.sin(mb.angle) * speed * dt;

                    mb.attackTimer -= dt;
                    if (dist < mb.target.size/2 + 25 && mb.attackTimer <= 0) {
                        const tgt = mb.target; // Tempest Shards: every enemy within 60 px of the strike is cut too
                        const cut = mb.tempest ? enemies.filter(o => !o.dead && (o === tgt || Math.hypot(o.x - tgt.x, o.y - tgt.y) < o.size / 2 + 60)) : [tgt];
                        for (const o of cut) applyDamage(o, mb.dmg || 0, 'shatter_storm'); // skills.js: 5% of Shatter Storm's damage; flat, so six shards don't multiply Flow
                        mb.attackTimer = mb.tempest ? 0.3 : 0.5;
                        effects.push({ type: 'slash', x: tgt.x, y: tgt.y, angle: mb.angle, color: '#18ffff', life: 0.15, maxLife: 0.15, radius: mb.tempest ? 70 : 45 });
                        mb.target = null;
                        
                        // Recoil bounce
                        mb.x -= Math.cos(mb.angle) * 40;
                        mb.y -= Math.sin(mb.angle) * 40;
                    }
                } else {
                    let orbitAngle = (mb.life * 3) + (i * Math.PI*2 / 6);
                    let px = player.airborneBlade && player.stance === 'airborne' ? player.airborneBlade.x : player.x;
                    let py = player.airborneBlade && player.stance === 'airborne' ? player.airborneBlade.y : player.y;
                    let tx = px + Math.cos(orbitAngle)*120;
                    let ty = py + Math.sin(orbitAngle)*120;
                    
                    let dx = tx - mb.x; let dy = ty - mb.y;
                    mb.angle = Math.atan2(dy, dx);
                    let dist = Math.hypot(dx, dy);
                    let speed = Math.min(1000, Math.max(200, dist * 5));
                    mb.x += Math.cos(mb.angle) * speed * dt;
                    mb.y += Math.sin(mb.angle) * speed * dt;
                }
            }
        }

        if (player.parryTimer > 0) {
            player.parryTimer -= dt;
            player.iFrames = 0.1; // Maintain IFrames during parry window
        }
    }

    if (activeClass && activeClass.name === 'Cleric') {
        if (buffs.zealLocked) {
            if (buffs.aspectOfReaper > 0) player.zeal = 0;
            else player.zeal = player.maxZeal;
        }
    }

    if (player.charge) player.charge.t += dt; // a held right-click charge (e.g. Storm Arrow)
    if (activeClass.name === 'Dragonknight') updateHeavySwing(dt); // skills.js: tap for a light swing, hold for an overhead slam
    else if (comboInFlight()) { if (isMouseDown) comboQueued = true; } // combos.js: a press mid-dash waits for the landing, as the finisher
    else if ((isMouseDown || (comboQueued && comboOpen)) && cooldowns.basic <= 0 && !player.charge) { comboQueued = false; castBasic(); } // can't shoot while drawing a charged shot

    let vx = 0; let vy = 0;
    if (keys.w) vy -= 1; if (keys.s) vy += 1; if (keys.a) vx -= 1; if (keys.d) vx += 1;
    const mag = Math.hypot(vx, vy);
    player.isMoving = mag > 0;
    
    let currentSpeed = player.speed; 
    if (buffs.msBoost > 0) currentSpeed *= 1.5;
    if (buffs.slowed > 0) currentSpeed *= 0.5;
    if (activeClass.name === 'Ranger') currentSpeed *= 1 + player.momentum; // Fleetfoot: momentum is move speed too
    if (player.charge) currentSpeed *= player.charge.slow; // drawing a charged shot
    if (player.heavy && player.heavy.raw >= SLAM_TAP) currentSpeed *= SLAM_SLOW; // the greatsword raised overhead
    if (player.wading) currentSpeed *= 0.5; // map_cavern.js: knee-deep in a slime lake
    if (buffs.rooted > 0) currentSpeed = 0;

    if (player.dash) {
        updateDash(dt); // skillfx_space.js: timed dashes and leaps
    } else if (player.grappleTarget) {
        // Forced movement to a point (Machinist grapple, Paladin charge / Iron Pull).
        // Optional fields: speed, iFrames (default true), onStep(), onArrive(), noLine, color.
        const gt = player.grappleTarget;
        let [gx, gy, gdist] = getVector(player.x, player.y, gt.x, gt.y);
        let gSpeed = gt.speed || 2000;
        gt.time = (gt.time || 0) + dt;
        let arrived = gdist <= gSpeed * dt || gt.time > 1.5; // time cap so a blocked path can't trap the player
        if (arrived) {
            player.x = gt.x;
            player.y = gt.y;
            player.grappleTarget = null;
        } else {
            player.x += (gx/gdist) * gSpeed * dt;
            player.y += (gy/gdist) * gSpeed * dt;
        }
        if (gt.iFrames !== false) player.iFrames = 0.1;
        clampToBounds(player, player.radius);
        if (gt.onStep) gt.onStep(dt);
        if (arrived && gt.onArrive) gt.onArrive();
        if (arrived && gt.combo) openCombo({ anchor: gt.anchor }); // combos.js (anchor: the Machinist's turret or coil it latched onto)
    } else if (mag > 0 && currentSpeed > 0) {
        player.x += (vx / mag) * currentSpeed * dt; player.y += (vy / mag) * currentSpeed * dt;
        clampToBounds(player, player.radius);
        if (activeClass && activeClass.name === 'Ranger') { player.momentum = Math.min(0.20, player.momentum + 0.10 * dt * (hasItem('Trailblazer Boots') ? 2 : 1)); player.stillTime = 0; } // full in 2 s
    } else if (activeClass && activeClass.name === 'Ranger') {
        // Standing still to aim keeps Momentum for 1 s, then it drains over 2 s
        player.stillTime = (player.stillTime || 0) + dt;
        if (player.stillTime > 1.0) player.momentum = Math.max(0, player.momentum - 0.10 * dt);
    }

    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt; if (d.life <= 0) { drops.splice(i, 1); continue; }
        if (Math.hypot(player.x - d.x, player.y - d.y) < player.radius + d.radius) {
            if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
            else if (d.type === 'dmg') { pickUpDmgOrb(); }
            else if (d.type === 'gold') { player.gold += d.val; }
            else if (d.type === 'item') { inventory.push(d.itemData); }
            else if (d.type === 'scrap') { pickUpScrap(); } // skills.js: stored for bigger turrets
            drops.splice(i, 1); updateHUD();
        }
    }

    player.inSmoke = false;
    for (let i = effects.length - 1; i >= 0; i--) { 
        if (effects[i].life === undefined) effects[i].life = effects[i].maxLife = 0.35; // some effects are pushed without a lifetime
        effects[i].life -= dt; 
        if (effects[i].customUpdate) effects[i].customUpdate(dt, effects[i]);
        if (effects[i].type === 'smoke_bomb') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) <= effects[i].radius) player.inSmoke = true;
            for(let k=enemies.length-1; k>=0; k--) {
                if (Math.hypot(enemies[k].x - effects[i].x, enemies[k].y - effects[i].y) <= effects[i].radius + enemies[k].size/2) {
                    if (effects[i].poison) applyDamage(enemies[k], effects[i].dmg * dt, 'dot');
                }
            }
        } else if (effects[i].type === 'fire_puddle' || effects[i].type === 'thorn_patch' || effects[i].type === 'consecrated_ground') {
            for(let k=enemies.length-1; k>=0; k--) {
                const ek = enemies[k];
                if (Math.hypot(ek.x - effects[i].x, ek.y - effects[i].y) <= effects[i].radius + ek.size/2) {
                    applyDamage(ek, effects[i].dmg * dt, 'dot');
                    // Zone slows refresh continuously, but never override a stronger slow that is already active
                    if (effects[i].slow && (!(ek.slowTimer > 0) || effects[i].slow >= ek.slowAmount)) {
                        ek.slowTimer = Math.max(ek.slowTimer || 0, 0.5);
                        ek.slowAmount = effects[i].slow;
                    }
                }
            }
        } else if (effects[i].type === 'puddle') {
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius) takeDamage(15 * dt, true);
        } else if (effects[i].type === 'bear_trap') {
            // no snap while dashing, leaping or invulnerable, nor within 2.5 s of the last one (the trap stays armed); the root is short so a dash can still be a dodge
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius && !player.dash && player.z <= 4 && !(player.iFrames > 0) && fxTime >= (player.trapImmuneUntil || 0)) {
                buffs.rooted = 0.8; player.trapImmuneUntil = fxTime + 2.5; takeDamage(effects[i].dmg); effects[i] = { type: 'trap_snapped', x: effects[i].x, y: effects[i].y, life: 1.5, maxLife: 1.5 }; continue; // the jaws snap shut on them (bandits.js)
            }
        } else if (effects[i].type === 'spore_cloud') { // a Spore Slime's haze: standing in it weakens you
            if (Math.hypot(player.x - effects[i].x, player.y - effects[i].y) < player.radius + effects[i].radius) buffs.weakened = 0.5;
        }
        if (effects[i].life <= 0) effects.splice(i, 1); 
    }

    const oozes = enemies.filter(e => e.type === 'voltaic_ooze');
    for (let i=0; i<oozes.length; i++) {
        for (let j=i+1; j<oozes.length; j++) {
            if (Math.hypot(oozes[i].x - oozes[j].x, oozes[i].y - oozes[j].y) < 250) {
                if (distToSegment(player.x, player.y, oozes[i].x, oozes[i].y, oozes[j].x, oozes[j].y) < player.radius + 5) { takeDamage(15 * dt, true); buffs.slowed = 0.5; }
            }
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; 
        if (!p) continue; // the Queen's last stand / death clears her shots mid-loop (map_hive.js)
        
        if (p.customUpdate) { p.customUpdate(dt, p); }
        if (p.homeTarget) steerShot(p, dt); // skills.js: Ranger aim assist (not a customUpdate, so rock still stops the arrow)

        if (p.source === 'fan_of_knives' && p.returnDmg && p.life <= 0.5 && !p.returning) {
            p.returning = true; p.hitList = [];
        }
        if (p.source === 'fan_of_knives' && p.returning) {
            const [rx, ry, rd] = getVector(p.x, p.y, player.x, player.y);
            if (rd < p.radius + player.radius) { projectiles.splice(i, 1); continue; }
            p.vx = (rx/rd)*1200; p.vy = (ry/rd)*1200; p.life = 0.5;
        }
        
        if (p.type === 'trap_throw' || p.type === 'spore' || p.type === 'sling_stone') {
            const [tx, ty, td] = getVector(p.x, p.y, p.targetX, p.targetY); const spd = p.speed || 400;
            if (td > 10) { p.x += (tx/td)*spd*dt; p.y += (ty/td)*spd*dt; }
            else if (p.type === 'sling_stone') p.life = 0; // it has landed
        } else if (p.type !== 'turret' && p.type !== 'tesla_coil_trap') {
            p.x += p.vx * dt; p.y += p.vy * dt; 
        }
        
        p.life -= dt;
        if (p.rampFrom !== undefined && Math.hypot(p.x - p.ox, p.y - p.oy) > p.rampFrom) { // shots that pick up speed once they're far from where they were fired
            const s = Math.hypot(p.vx, p.vy) || 1, n = Math.min(p.rampTo, s + 600 * dt); p.vx *= n / s; p.vy *= n / s;
        }
        if (currentMap.grid && p.life > 0 && shotHitsWall(p)) p.life = 0; // stage.js: rock stops shots
        
        if (p.life <= 0 || p.x < currentMap.left - 50 || p.x > currentMap.right + 50 || p.y < currentMap.top - 50 || p.y > currentMap.bottom + 50) { 
            if (p.type === 'bramble_core') snareBurst(p.x, p.y, p.damage, p.sourceSkill); // druid.js: Bramble Snare bursts where it lands
            if (p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
            if (p.type === 'trap_throw') { effects.push({ type: 'bear_trap', x: p.x, y: p.y, radius: 15, color: '#5d4037', life: 8.0, maxLife: 8.0, dmg: p.damage, owner: p.owner }); } // owner: ai.js caps each trapper's traps
            if (p.type === 'sling_stone') { // a slinger's stone comes down on where the hero stood: dodge out of the marker
                if (Math.hypot(p.x - player.x, p.y - player.y) < 26 + player.radius) takeDamage(p.owner.dmg);
                burst(p.x, p.y, 0, Math.PI * 2, 6, { kind: 'debris', color: '#9e9e9e', size: 3, speed: [60, 180], life: 0.45, drag: 3 });
            }
            if (p.type === 'spore') { effects.push({ type: 'spore_cloud', x: p.x, y: p.y, radius: 100, color: 'rgba(205, 220, 57, 0.4)', life: 3.0, maxLife: 3.0 }); }
            if (p.type === 'turret' && p.volatile) {
                effects.push({ type: 'fiery_explosion', x: p.x, y: p.y, radius: 150, life: 0.5, maxLife: 0.5 });
                for(let e of enemies) { if (Math.hypot(e.x - p.x, e.y - p.y) < e.size/2 + 150) applyDamage(e, p.damage * 3, 'magic'); }
            }
            projectiles.splice(i, 1); continue; 
        }

        if (p.isEnemy) {
            // Check Phantom Decoy intercept first
            if (player.phantomDecoy && player.phantomDecoy.life > 0 && Math.hypot(p.x - player.phantomDecoy.x, p.y - player.phantomDecoy.y) < player.radius + p.radius) {
                player.phantomDecoy.life = 0; // destroyed
                projectiles.splice(i, 1);
                continue;
            }

            if (p.type !== 'trap_throw' && p.type !== 'spore' && p.type !== 'sling_stone' && Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) { 
                takeDamage(p.damage, false, { isProjectile: true, proj: p }); 
                if (p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
                if (p.type === 'bolas') { 
                    buffs.rooted = 0.6; const boss = enemies.find(e => e.type === 'boss_beastmaster');
                    if (boss) { const [bx, by, bdist] = getVector(player.x, player.y, boss.x, boss.y); player.x += (bx/bdist)*100; player.y += (by/bdist)*100; clampToBounds(player, player.radius); }
                }
                projectiles.splice(i, 1); 
            }
        } else {
            if (p.type === 'turret' || p.type === 'tesla_coil_trap') continue; 
            
            if (p.type === 'shield_throw') {
                const leap = player.dash && player.dash.shields && player.dash.shields.includes(p) ? player.dash : null; // combos.js Skyfall Catch
                if (leap && Math.hypot(p.x - player.x, p.y - player.y) < p.radius + player.radius + SKYFALL_REACH) { // snatched out of the air, either way it flies
                    leap.skyfall = true; catchShield(p.sourceSkill); projectiles.splice(i, 1); continue;
                }
                if (p.hold) updateShieldHold(p, dt); // combos.js: a leap aimed at it holds it in the air
                if (p.batted && updateBattedShield(p, dt)) continue; // combos.js Rebound: it ricochets for itself
                if (!p.returning && !p.hold && (p.life <= 1.0 || p.x<=currentMap.left+20 || p.x>=currentMap.right-20 || p.y<=currentMap.top+20 || p.y>=currentMap.bottom-20)) { p.returning = true; p.hitList = []; }
                if (p.returning) { // flies back to the Dragonknight wherever they are; touching it is the catch
                    const [rx, ry, rd] = getVector(p.x, p.y, player.x, player.y);
                    if (rd < p.radius + player.radius) { catchShield(p.sourceSkill); projectiles.splice(i, 1); continue; }
                    p.vx = (rx/rd)*900; p.vy = (ry/rd)*900; p.life = Math.max(p.life, 0.5); // never expires on the way home
                }
            }

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (e.dead || e.submerged) continue; // the Amalgam's Undertow: shots pass over the ripple
                if (Math.hypot(p.x - e.x, p.y - e.y) < e.size/2 + p.radius) {
                    if ((p.pierce || p.type === 'shield_throw' || p.type === 'fan_of_knives' || p.type === 'scattergun' || p.type === 'censer_pulse' || p.type === 'ricochet') && p.hitList.includes(e)) continue; // a ricochet never re-hits the enemy it just bounced off

                    if (p.type === 'fireball' || p.resonance) {
                        let explRadius = p.resonance ? resonanceRadius() : (p.sourceSkill && p.sourceSkill.selectedUpg === 'B' ? 100 : 70);
                        if (p.resonance && !p.weaveDone) { p.weaveDone = true; weaveRefund(); } // skills.js: a landed empowered bolt speeds up the next spells
                        effects.push({ type: 'fiery_explosion', x: p.x, y: p.y, radius: explRadius, life: 0.4, maxLife: 0.4 });
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'B') {
                            effects.push({ type: 'fire_puddle', x: p.x, y: p.y, radius: explRadius, color: 'rgba(255, 87, 34, 0.4)', life: 0.75, maxLife: 0.75, dmg: p.damage * 0.5 });
                        }
                        for(let k=enemies.length-1; k>=0; k--) {
                            if (Math.hypot(p.x - enemies[k].x, p.y - enemies[k].y) <= explRadius + enemies[k].size/2) applyDamage(enemies[k], p.damage, 'magic');
                        }
                    } else if (p.type === 'shield_throw') {
                        applyDamage(e, p.damage, 'melee');
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'A') {
                            effects.push({ type: 'shield_blast', x: e.x, y: e.y, radius: 60, life: 0.3, maxLife: 0.3 });
                            for(let k=enemies.length-1; k>=0; k--) {
                                if (e !== enemies[k] && Math.hypot(e.x - enemies[k].x, e.y - enemies[k].y) <= 60 + enemies[k].size/2) applyDamage(enemies[k], p.damage*0.5, 'melee');
                            }
                        }
                    } else if (p.type === 'ricochet') {
                        applyDamage(e, p.damage, 'ranged');
                        if (p.bounces > 0) {
                            p.bounces--; p.hitList.push(e);
                            let nextT = null; let minDist = 400;
                            for(const et of enemies) { if (et.dead || p.hitList.includes(et)) continue; const dist = Math.hypot(et.x - p.x, et.y - p.y); if(dist < minDist) { minDist = dist; nextT = et; } }
                            if (nextT) { const [nx, ny, nd] = getVector(p.x, p.y, nextT.x, nextT.y); p.vx = (nx/nd)*900; p.vy = (ny/nd)*900; p.homeTarget = nextT; p.life = Math.max(p.life, 0.6); // keeps tracking a target that moves, and lives long enough to reach it
                                if (p.shape === 'storm_arrow') effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: nextT.x, y2: nextT.y, color: '#80d8ff', life: 0.2, maxLife: 0.2 }); } // Chain Lightning: the jump arcs across
                            else { hit = true; } 
                        } else { hit = true; }
                    } else if (p.type === 'scattergun') {
                        applyDamage(e, p.damage, 'ranged');
                        salvagePellet(); // items.js: Salvager's Gauntlets
                        let [ebx, eby, ebd] = getVector(player.x, player.y, e.x, e.y);
                        const knock = p.knock || 15; // combos.js Point Blank pellets hit harder
                        if (!e.type.startsWith('boss') && ebd > 0) { e.x += (ebx/ebd)*knock; e.y += (eby/ebd)*knock; clampToBounds(e, e.size/2); }
                    } else if (p.type === 'net_throw') {
                        applyDamage(e, p.damage, 'ranged');
                        e.rootedTimer = 2.0; e.netTimer = 2.0; e.nettedAt = fxTime; // combos.js Conductive Net
                    } else if (p.type === 'bramble_core') {
                        snareBurst(p.x, p.y, p.damage, p.sourceSkill); // druid.js
                    } else { applyDamage(e, p.damage, activeClass.name === 'Ranger' ? 'ranged' : (p.source === 'fan_of_knives' ? 'assassin_skill' : 'magic'), Math.atan2(p.vy, p.vx)); }
                    
                    if (p.type === 'druid_spore') { druidBoltHit(e); if (p.call) pounceCall(e); } // druid.js: Packbond Bracers; Pounce Strike (combos.js)
                    if (p.burn) { e.burnTimer = 3.0; e.burnDps = p.burn; e.burnColor = p.burnColor; } // Dragon Breath: refreshes, doesn't stack

                    if (p.type === 'censer_pulse') {
                        if (!buffs.zealLocked) {
                            let zealGain = (hasItem('Thurible Chains') ? 20 : 15) * (p.zealMult || 1.0);
                            if (p.isInSanctuary) zealGain *= 2.0;
                            player.zeal = Math.min(player.maxZeal, player.zeal + zealGain);
                        }
                    }

                    if (p.pierce || p.type === 'shield_throw' || p.type === 'ricochet' || p.type === 'fan_of_knives' || p.type === 'scattergun' || p.type === 'censer_pulse') { if (p.type !== 'ricochet') p.hitList.push(e); } else { hit = true; break; }
                }
            }
            if (hit) projectiles.splice(i, 1);
        }
    }

    const bannermen = enemies.filter(o => o.type === 'bannerman' && !o.dead), RALLY_R2 = RALLY_RADIUS * RALLY_RADIUS; // once a frame, not per enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.dead) continue;
        if (e.pod) continue; // map_hive.js brood pods just sit there until popped or hatched
        if (e.spawnT > 0) { e.spawnT -= dt; continue; } // stage.js spawn: still forming
        const ccDt = e.type.startsWith('boss') ? dt * BOSS_CC_RATE : dt; // bosses shake crowd control off faster
        if (e.frozenTimer > 0) { e.frozenTimer -= ccDt; e.renderColor = '#90caf9'; }
        else if (e.rootedTimer > 0) { e.rootedTimer -= ccDt; e.renderColor = '#b0bec5'; }
        else if (e.stunTimer > 0) { e.stunTimer -= ccDt; e.renderColor = '#ffeb3b'; }
        else if (e.blindTimer > 0) { e.blindTimer -= ccDt; e.renderColor = '#e0e0e0'; }
        else if (e.slowTimer > 0 && e.slowAmount > 0) { e.renderColor = '#4fc3f7'; }
        else { e.renderColor = e.color; }

        if (e.bleedTimer > 0) {
            e.bleedTimer -= dt; applyDamage(e, e.bleedDmg * dt, 'dot');
            if (Math.random() < 0.1) effects.push({ type: 'circle', x: e.x, y: e.y, radius: 4, color: '#f44336', life: 0.2, maxLife: 0.2 });
        }
        if (e.burnTimer > 0) { // Dragon Breath burn
            e.burnTimer -= dt; applyDamage(e, e.burnDps * dt, 'dot');
            if (Math.random() < 0.2) spawnParticle({ kind: 'dot', color: e.burnColor || '#ff7043', x: e.x + jitter(e.size * 0.4), y: e.y + jitter(e.size * 0.4), vx: jitter(15), vy: -40 - Math.random() * 30, size: 2, life: 0.45, drag: 1, grow: 0, spin: 0, rot: 0 });
        }
        
        if (e.dead) continue; // killed by a DoT this frame

        if (e.aoeResistTimer > 0) {
            e.aoeResistTimer -= dt;
            if (e.aoeResistTimer <= 0) e.aoeResistStacks = 0;
        }

        if (e.shockTimer > 0) e.shockTimer -= dt;

        let isImmobilized = (e.frozenTimer > 0 || e.rootedTimer > 0 || e.stunTimer > 0);
        let curSpd = isImmobilized ? 0 : e.speed;
        if (e.shockTimer > 0) curSpd *= 0.5;
        if (e.slowTimer > 0) { e.slowTimer -= dt; curSpd *= 1 - (e.slowAmount !== undefined ? e.slowAmount : 0.4); }
        
        // the bannerman's rally (ai.js RALLY_*): allies near a living bannerman run faster and hit harder; bosses and props never
        if (!e.type.startsWith('boss') && !e.prop && (bannermen.length || e.rallyT > 0)) {
            let rallied = false;
            for (const o of bannermen) if (o !== e && (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < RALLY_R2) { rallied = true; break; }
            if (rallied) {
                curSpd *= RALLY_SPEED;
                if (!(e.rallyT > 0)) { if (e.baseDmg === undefined) e.baseDmg = e.dmg; e.dmg = e.baseDmg * RALLY_DMG; } // remember the normal hit once
                e.rallyT = 0.3;
            } else if (e.rallyT > 0) {
                e.rallyT -= dt;
                if (e.rallyT <= 0) { e.dmg = e.baseDmg; delete e.baseDmg; }
            }
        }

        let [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
        if (currentMap.grid) { const s = navSteer(e, edx, edy, edist); if (s) [edx, edy] = s; } // stage.js: walk around cave walls

        // Mantle of the Living Grove: enemies that rush into an active Barkskin get rooted (once per 3s each)
        if (e.mantleRootCd > 0) e.mantleRootCd -= dt;
        if (buffs.barkskin && equipment.armor && equipment.armor.name === 'Mantle of the Living Grove' && !(e.mantleRootCd > 0) && edist < player.radius + e.size / 2 + 10) {
            e.rootedTimer = 1.5; e.mantleRootCd = 3.0;
            effects.push({ type: 'text', text: 'ROOTED', x: e.x, y: e.y - 20, color: '#8bc34a', life: 0.6, maxLife: 0.6 });
        }

        if (player.inSmoke || e.blindTimer > 0) { edx = 0; edy = 0; edist = Infinity; }
        if (e.meleeTimer > 0) e.meleeTimer -= dt;

        // bodies push apart, but not while the hero dashes or leaps past (that used to carry a boss along under a Vault)
        if (edist < player.radius + e.size / 2 && !e.submerged && !player.dash && e.state !== 'dash_execute' && e.state !== 'bounce_telegraph' && e.state !== 'charge' && e.state !== 'jousting' && e.state !== 'death_throes') {
            let overlap = (player.radius + e.size / 2) - edist;
            e.x -= (edx / edist) * overlap; e.y -= (edy / edist) * overlap;
        }

        if (edist > 0) {
            let targetAngle = Math.atan2(edy, edx);
            if (e.type === 'shield') {
                let diff = targetAngle - (e.facingAngle || 0); while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2; e.facingAngle = (e.facingAngle || 0) + diff * 3.0 * dt; 
            } else { e.facingAngle = targetAngle; }
        }

        if (e.tauntTimer > 0) {
            // Taunted (Paladin hammer threat): walk to the taunt point instead of attacking
            e.tauntTimer -= dt;
            let [tx, ty, td] = getVector(e.x, e.y, e.tauntX, e.tauntY);
            if (td > e.size/2 + 25) { e.x += (tx/td)*curSpd*dt; e.y += (ty/td)*curSpd*dt; }
        } else if (window.EnemyAI[e.type]) {
            if (e.stunTimer > 0 && !e.type.startsWith('boss_')) {}
            else window.EnemyAI[e.type](e, dt, curSpd, edx, edy, edist, i);
        } else {
            if (e.stunTimer > 0) {}
            else window.EnemyAI['slime_melee'](e, dt, curSpd, edx, edy, edist, i);
        }
        
        clampToBounds(e, e.size/2);
    }

    removeDeadEnemies();
    updateHUD();
}

function draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (gameState === STATE.PLAYING) ctx.translate(shakeX, shakeY); // fx.js camera shake
    ctx.scale(camZoom(), camZoom()); // stage.js: some maps are drawn closer in
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y)); // stage.js camera; 0,0 on screen-sized maps
    
    if (currentMap.type === 'clearing') {
        drawClearingGround(); // map_clearing.js
    } else if (currentMap.type === 'cavern') {
        drawCavernGround(); // map_cavern.js: terrain, lakes, darkness and lights
    } else if (currentMap.type === 'hive') {
        drawHiveGround(); // map_hive.js: throne hall, pool, opened pods, the sleeping Queen
    } else if (currentMap.type === 'village') {
        drawVillageGround(); // map_village.js: the burned village at dusk, its fires and the barricade
    } else if (currentMap.type === 'trail') {
        drawTrailGround(); // map_trail.js: the road, the river, the camp, the logjams and the gate
    } else if (currentMap.type === 'training') {
        drawTrainingGround(); // training.js: the sand yard
    } else if (currentMap.type === 'bridge') {
        drawBridgeGround(); // map_bridge.js: the span, its braziers and the gatehouse
    } else if (currentMap.type === 'castle') {
        drawCastleGround(); // map_castle.js: the bailey, the keep's halls, the throne room, torchlight
    } else {
        ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20); // overscan for camera shake
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; const gridSize = 100;
        for (let i = 0; i < canvas.width; i += gridSize) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
        for (let i = 0; i < canvas.height; i += gridSize) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
    }

    for (const ef of effects) {
        if (drawEnemyGround(ef)) continue; // enemysprites.js: splats, trails, shockwaves
        if (drawSkillGround(ef)) continue; // skillfx.js
        if (ef.type === 'puddle' || ef.type === 'fire_puddle' || ef.type === 'thorn_patch' || ef.type === 'spore_cloud' || ef.type === 'consecrated_ground') {
            ctx.fillStyle = ef.color; ctx.globalAlpha = ef.life / ef.maxLife * 0.5; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
        } else if (ef.type === 'smoke_bomb') {
            ctx.fillStyle = ef.color; 
            let alphaBase = Math.min(1.0, (ef.life / ef.maxLife) * 1.5); // stays thick, fades near end
            let timeAlive = ef.maxLife - ef.life;
            if (ef.particles) {
                ef.particles.forEach(p => {
                    ctx.globalAlpha = alphaBase * 0.6;
                    let curX = ef.x + p.xOffset * Math.cos(timeAlive * p.rotSpeed * 0.5);
                    let curY = ef.y + p.yOffset * Math.sin(timeAlive * p.rotSpeed * 0.5);
                    let popRatio = Math.min(1, timeAlive * 4); // quick expansion
                    let curR = p.r * popRatio + Math.sin(timeAlive * 2 + p.startAng) * (p.r * 0.1);
                    ctx.beginPath();
                    ctx.arc(curX, curY, Math.max(1, curR), 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = alphaBase * 0.3;
                ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.globalAlpha = alphaBase * 0.5; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }
    }

    drawGroundProjectiles(); // skillfx_e.js: Hallowed Ground, Tesla field

    for (const d of drops) {
        if (d.type === 'scrap') {
            ctx.fillStyle = '#ff9800'; ctx.beginPath();
            for(let j=0; j<6; j++) { let a = (Math.PI*2/6)*j; ctx.lineTo(d.x + Math.cos(a)*d.radius, d.y + Math.sin(a)*d.radius); }
            ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚙', d.x, d.y);
        }
        else {
            if (d.type === 'item') ctx.fillStyle = '#4caf50'; else if (d.type === 'gold') ctx.fillStyle = '#ffd54f'; else ctx.fillStyle = d.type === 'hp' ? '#e53935' : '#ab47bc';
            ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = d.type === 'gold' ? '#000' : '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let icon = d.type === 'hp' ? '+' : d.type === 'dmg' ? '⚔' : d.type === 'gold' ? '$' : '♦'; ctx.fillText(icon, d.x, d.y);
        }
    }

    for (const ef of effects) {
        if (ef.type === 'puddle' || ef.type === 'fire_puddle' || ef.type === 'thorn_patch' || ef.type === 'spore_cloud' || ef.type === 'consecrated_ground' || ef.type === 'smoke_bomb' || ef.type === 'bear_trap' || ef.type === 'trap_snapped') continue; // bandits.js draws traps on the ground pass 
        
        ctx.globalAlpha = ef.isWarning ? 1.0 : ef.life / ef.maxLife; 
        if (drawSkillEffect(ef)) { ctx.globalAlpha = 1.0; continue; } // skillfx.js
        
        if (ef.type === 'meteor_drop') {
            if (!ef.rockPoints) {
                ef.rockPoints = [];
                let points = 7 + Math.floor(Math.random() * 4);
                for(let i=0; i<points; i++) {
                    let ang = (Math.PI*2/points) * i;
                    let r = ef.radius * (0.7 + Math.random() * 0.4);
                    ef.rockPoints.push({r: r, a: ang});
                }
            }

            let progress = 1.0 - (ef.life / ef.maxLife);
            let curY = ef.y - 800 + (800 * progress);
            let curX = ef.x + 400 - (400 * progress);
            
            let tailAng = Math.atan2(-800, 400); 
            let perp = tailAng + Math.PI/2;
            
            ctx.fillStyle = 'rgba(255, 87, 34, 0.6)';
            ctx.beginPath();
            ctx.moveTo(curX + Math.cos(perp)*ef.radius, curY + Math.sin(perp)*ef.radius);
            ctx.lineTo(curX + 150, curY - 300); // Tail stretches away from impact
            ctx.lineTo(curX - Math.cos(perp)*ef.radius, curY - Math.sin(perp)*ef.radius);
            ctx.closePath();
            ctx.fill();

            // Draw the jagged rock
            ctx.fillStyle = '#3e2723';
            ctx.strokeStyle = ef.color;
            ctx.lineWidth = 3;
            
            ctx.save();
            ctx.translate(curX, curY);
            ctx.rotate(progress * Math.PI * 2); // Spins violently as it falls

            ctx.beginPath();
            for(let i=0; i<ef.rockPoints.length; i++) {
                let px = Math.cos(ef.rockPoints[i].a) * ef.rockPoints[i].r;
                let py = Math.sin(ef.rockPoints[i].a) * ef.rockPoints[i].r;
                if(i===0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw inner glowing magma cracks
            if(ef.rockPoints.length >= 4) {
                ctx.strokeStyle = '#ffca28';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ef.rockPoints[0].a)*ef.rockPoints[0].r*0.4, Math.sin(ef.rockPoints[0].a)*ef.rockPoints[0].r*0.4);
                ctx.lineTo(0, 0);
                ctx.lineTo(Math.cos(ef.rockPoints[3].a)*ef.rockPoints[3].r*0.4, Math.sin(ef.rockPoints[3].a)*ef.rockPoints[3].r*0.4);
                ctx.stroke();
            }
            ctx.restore();
        } else if (ef.type === 'crater') {
            if (!ef.cracks) {
                ef.cracks = [];
                let numBranches = 4 + Math.floor(Math.random() * 4); 
                for(let i = 0; i < numBranches; i++) {
                    let angle = (Math.PI*2/numBranches) * i + (Math.random()*0.5 - 0.25);
                    let currentRadius = 0;
                    let path = [{r: 0, a: angle}];
                    let maxR = ef.radius;
                    while (currentRadius < maxR) {
                        currentRadius += maxR/4 + Math.random()*(maxR/4);
                        angle += (Math.random() - 0.5) * 1.2; 
                        path.push({r: Math.min(currentRadius, maxR), a: angle});
                        
                        if (Math.random() < 0.4 && currentRadius < maxR*0.8) {
                            let subPath = [{r: currentRadius, a: angle}];
                            let subAngle = angle + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random()*0.4);
                            subPath.push({r: currentRadius + maxR/2.5, a: subAngle});
                            ef.cracks.push(subPath);
                        }
                    }
                    ef.cracks.push(path);
                }
            }
            
            ctx.lineJoin = 'miter';
            
            ctx.strokeStyle = `rgba(15, 15, 15, ${ef.life/ef.maxLife})`; 
            ctx.lineWidth = 14 * (ef.life/ef.maxLife);
            ctx.beginPath();
            for (let path of ef.cracks) {
                for (let j=0; j<path.length; j++) {
                    let px = ef.x + Math.cos(path[j].a) * path[j].r;
                    let py = ef.y + Math.sin(path[j].a) * path[j].r;
                    if (j === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
            }
            ctx.stroke();

            ctx.strokeStyle = ef.color; 
            ctx.lineWidth = 4 * (ef.life/ef.maxLife);
            ctx.stroke();
        }
        else if (ef.type === 'flames') {
            ctx.fillStyle = ef.color;
            ctx.beginPath(); ctx.moveTo(ef.x, ef.y);
            ctx.arc(ef.x, ef.y, ef.radius, ef.angle - ef.spread/2, ef.angle + ef.spread/2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffca28';
            ctx.beginPath(); ctx.moveTo(ef.x, ef.y);
            ctx.arc(ef.x, ef.y, ef.radius*0.6, ef.angle - ef.spread/3, ef.angle + ef.spread/3); ctx.closePath(); ctx.fill();
        }
        else if (ef.type === 'fiery_explosion') {
            let p = 1.0 - (ef.life / ef.maxLife);
            ctx.fillStyle = `rgba(255, 61, 0, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = `rgba(255, 152, 0, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p * 0.7, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = `rgba(255, 235, 59, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p * 0.4, 0, Math.PI*2); ctx.fill();
        }
        else if (ef.type === 'random_ice_spikes') {
            ctx.fillStyle = ef.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            for (let s of ef.spikes) {
                let prog = ef.life / ef.maxLife;
                let height = Math.sin(prog * Math.PI) * s.size * 2; 
                ctx.beginPath();
                ctx.moveTo(ef.x + s.xOffset, ef.y + s.yOffset - height);
                ctx.lineTo(ef.x + s.xOffset - s.size*0.5, ef.y + s.yOffset);
                ctx.lineTo(ef.x + s.xOffset + s.size*0.5, ef.y + s.yOffset);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }
        else if (ef.type === 'wind_swirl') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 4;
            let swirlAng = (ef.maxLife - ef.life) * 10;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, swirlAng, swirlAng + Math.PI); ctx.stroke();
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius*0.6, swirlAng + Math.PI/2, swirlAng + Math.PI/2 + Math.PI); ctx.stroke();
        }
        else if (ef.type === 'sparkle_poof') {
            ctx.fillStyle = ef.color;
            for(let i=0; i<6; i++) {
                let ang = (Math.PI*2/6) * i;
                ctx.beginPath(); ctx.arc(ef.x + Math.cos(ang)*ef.radius, ef.y + Math.sin(ang)*ef.radius, 4, 0, Math.PI*2); ctx.fill();
            }
        }
        else if (ef.type === 'v_slash') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 6; ctx.lineCap = 'round';
            ctx.beginPath(); 
            ctx.moveTo(ef.x + Math.cos(ef.angle - 0.6)*ef.length, ef.y + Math.sin(ef.angle - 0.6)*ef.length);
            ctx.lineTo(ef.x, ef.y);
            ctx.lineTo(ef.x + Math.cos(ef.angle + 0.6)*ef.length, ef.y + Math.sin(ef.angle + 0.6)*ef.length);
            ctx.stroke(); ctx.lineCap = 'butt';
        }
        else if (ef.type === 'thrust_edge') {
            const length = Math.hypot(ef.x2 - ef.x, ef.y2 - ef.y);
            ctx.save(); ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
            ctx.globalAlpha = ef.life / ef.maxLife;
            
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath(); 
            ctx.moveTo(0, -4);
            ctx.lineTo(length, 0);
            ctx.lineTo(0, 4);
            ctx.closePath(); 
            ctx.fill();

            ctx.fillStyle = ef.color;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(length - 10, 0);
            ctx.lineTo(0, 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        else if (ef.type === 'shield_burst') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 4;
            for(let i=0; i<4; i++) {
                let ang = (Math.PI*2/4) * i;
                let dx = ef.x + Math.cos(ang)*ef.radius; let dy = ef.y + Math.sin(ang)*ef.radius;
                ctx.beginPath(); ctx.moveTo(dx - Math.cos(ang+Math.PI/2)*20, dy - Math.sin(ang+Math.PI/2)*20);
                ctx.lineTo(dx + Math.cos(ang+Math.PI/2)*20, dy + Math.sin(ang+Math.PI/2)*20); ctx.stroke();
            }
        }
        else if (ef.type === 'dash_trail') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 16 * (ef.life/ef.maxLife); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); ctx.lineCap = 'butt';
        }
        else if (ef.type === 'flash_line') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = ef.lineWidth || 4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); ctx.lineCap = 'butt';
            
            // Add a white core for brightness
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (ef.lineWidth || 4) / 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); ctx.lineCap = 'butt';
        }
        else if (ef.type === 'circle_burst') {
            ctx.strokeStyle = ef.color; 
            ctx.lineWidth = 4 * (ef.life/ef.maxLife);
            let currentRadius = ef.radius * (1.0 - ef.life/ef.maxLife);
            ctx.beginPath(); ctx.arc(ef.x, ef.y, currentRadius, 0, Math.PI*2); ctx.stroke();
            
            // Also draw a fading filled core
            ctx.fillStyle = ef.color;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, currentRadius * 0.7, 0, Math.PI*2); ctx.fill();
        }
        else if (ef.type === 'repulse_ring') {
            ctx.strokeStyle = ef.color; 
            ctx.lineWidth = 6 * (ef.life/ef.maxLife);
            let currentRadius = ef.radius * (1.0 - (ef.life/ef.maxLife));
            ctx.beginPath(); ctx.arc(ef.x, ef.y, currentRadius, 0, Math.PI*2); ctx.stroke();
            
            // Draw an extra inner ring to look cooler but not completely filled
            ctx.lineWidth = 2 * (ef.life/ef.maxLife);
            ctx.beginPath(); ctx.arc(ef.x, ef.y, currentRadius * 0.85, 0, Math.PI*2); ctx.stroke();
        }
        else if (ef.type === 'grapple_chain') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 2;
            let [dx, dy, dist] = getVector(ef.x1, ef.y1, ef.x2, ef.y2);
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
            ctx.save(); ctx.translate(ef.x2, ef.y2); ctx.rotate(Math.atan2(dy, dx));
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -10); ctx.lineTo(-5, -15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 15); ctx.stroke();
            ctx.restore();
        }
        else if (ef.type === 'lightning') {
            ctx.strokeStyle = ef.color; ctx.lineWidth = 3;
            let segments = 5; let [dx, dy, dist] = getVector(ef.x1, ef.y1, ef.x2, ef.y2);
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1);
            for(let i=1; i<segments; i++) {
                let nx = ef.x1 + (dx/dist)*(dist*(i/segments)) + (Math.random()-0.5)*30;
                let ny = ef.y1 + (dy/dist)*(dist*(i/segments)) + (Math.random()-0.5)*30;
                ctx.lineTo(nx, ny);
            }
            ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
        }
        else if (ef.type === 'radiant_flash') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate(ef.angle);
            let prog = ef.life / ef.maxLife;
            ctx.fillStyle = ef.color;
            ctx.globalAlpha = prog * 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -ef.width/2);
            ctx.lineTo(ef.length, 0);
            ctx.lineTo(0, ef.width/2);
            ctx.closePath();
            ctx.fill();
            
            // core
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = prog;
            ctx.beginPath();
            ctx.moveTo(0, -ef.width/4);
            ctx.lineTo(ef.length * 0.8, 0);
            ctx.lineTo(0, ef.width/4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        else if (ef.type === 'void_spike_cascade') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate(ef.angle);
            let progress = 1.0 - (ef.life/ef.maxLife);
            ctx.strokeStyle = ef.color;
            ctx.fillStyle = ef.color;
            
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ef.length * Math.min(1.0, progress * 2), 0);
            ctx.stroke();

            for (let i = 1; i <= 6; i++) {
                let d = (i / 6) * ef.length;
                if (progress * ef.length * 1.5 >= d) {
                    let a = 1.0 - ((progress * ef.length * 1.5 - d) / 100); 
                    if(a<0) a=0; if(a>1) a=1;
                    ctx.globalAlpha = a;
                    ctx.beginPath();
                    ctx.moveTo(d - ef.width/3, 0);
                    ctx.lineTo(d, -ef.width);
                    ctx.lineTo(d + ef.width/3, 0);
                    ctx.lineTo(d, ef.width);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        else if (ef.type === 'divine_ray_channel') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate(ef.angle);
            ctx.fillStyle = ef.color;
            // Pulsate transparency
            ctx.globalAlpha = 0.4 + Math.sin(ef.life * 30) * 0.2;
            ctx.fillRect(0, -ef.width/2, ef.length, ef.width);
            
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.8 + Math.sin(ef.life * 30) * 0.2;
            ctx.fillRect(0, -ef.width/6, ef.length, ef.width/3);
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
        else if (ef.type === 'circle') { 
            ctx.fillStyle = ef.color; 
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); 
            if (ef.isWarning) { 
                ctx.strokeStyle = ef.color; ctx.lineWidth = 2; ctx.stroke(); 
                if (!ef.outlineOnly) ctx.fill();
            } else { ctx.fill(); }
        } 
        else if (ef.type === 'line') { ctx.strokeStyle = ef.color; ctx.lineWidth = ef.lineWidth || 40; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); } 
        else if (ef.type === 'cone') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.arc(ef.x, ef.y, ef.radius, ef.angle - ef.spread/2, ef.angle + ef.spread/2); ctx.closePath(); ctx.fill(); }
        else if (ef.type === 'slash') {
            const r = (ef.radius || 50) * 0.8, sweep = Math.PI / 2.5;
            ctx.fillStyle = ef.color || '#e0e0e0';
            drawCrescent(ef.x, ef.y, r, ef.angle - sweep, ef.angle + sweep, 22 * (ef.life / ef.maxLife) + 4); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, r, ef.angle - sweep * 0.8, ef.angle + sweep * 0.8); ctx.stroke();
        }
        else if (ef.type === 'precision_slash') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            
            // Faint gradient fill for the whole slash area
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, ef.radius, ef.angle - Math.PI/3.5, ef.angle + Math.PI/3.5);
            ctx.closePath();
            
            let grad = ctx.createRadialGradient(0, 0, ef.radius * 0.3, 0, 0, ef.radius);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.8, ef.color || '#00e5ff');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.6 * (ef.life/ef.maxLife);
            ctx.fill();

            // Sharp outer edge
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, ef.radius, ef.angle - Math.PI/3.5, ef.angle + Math.PI/3.5);
            ctx.lineWidth = 4 * (ef.life/ef.maxLife);
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            
            ctx.restore();
        }
        else if (ef.type === 'precision_thrust') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate(ef.angle);
            ctx.fillStyle = ef.color;
            ctx.globalAlpha = (ef.life/ef.maxLife);
            ctx.beginPath();
            ctx.moveTo(10, -5); // base
            ctx.lineTo(ef.radius, 0); // sharp tip
            ctx.lineTo(10, 5); // base
            ctx.fill();
            let grad = ctx.createLinearGradient(0, 0, ef.radius, 0);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.5, '#ffffff');
            grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ef.radius + 20, 0);
            ctx.stroke();
            ctx.restore();
        }
        else if (ef.type === 'claw_swipe') {
            // Three tapered claw rakes
            ctx.fillStyle = ef.color || '#c62828';
            for (let c = -1; c <= 1; c++) {
                const offsetAngle = c * 0.15;
                drawCrescent(ef.x, ef.y, ef.radius * 0.8 + c * 20, ef.angle - Math.PI/3 + offsetAngle, ef.angle + Math.PI/3 + offsetAngle, 10 * (ef.life / ef.maxLife) + 2);
                ctx.fill();
            }
        }
        else if (ef.type === 'wolf_bite') drawWolfBite(ef); // fx.js
        else if (ef.type === 'storm_cyclone') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate(Date.now() / 50 + ef.angle);
            ctx.globalAlpha = ef.life / ef.maxLife;
            // Draw multiple massive curved wind/slash blades
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                let grad = ctx.createLinearGradient(0, 0, ef.radius, 0);
                grad.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, ef.radius, 0, Math.PI / 2.5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        else if (ef.type === 'text') { ctx.fillStyle = ef.color; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText(ef.text, ef.x, ef.y - (1.0 - (ef.life/ef.maxLife)) * 30); }
        else if (ef.type === 'whirlwind') {
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.rotate((1.0 - ef.life/ef.maxLife) * Math.PI * 8); // Spin rapidly
            ctx.strokeStyle = ef.color;
            ctx.lineWidth = 15 * (ef.life/ef.maxLife);
            ctx.lineCap = 'round';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, ef.radius * (0.5 + 0.5 * (ef.life/ef.maxLife)), (i * Math.PI/2), (i * Math.PI/2) + Math.PI/3);
                ctx.stroke();
            }
            ctx.filter = 'blur(4px)';
            ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, ef.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    }

    drawDruidGround(); // druid.js: scent rings, brambles, leap slams
    drawPaladinWorld();

    for (const e of enemies) {
        if (e.dead || e.state === 'split') continue;
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : (e.renderColor || e.color);
        const sprite = drawEnemySprite(e); // enemysprites.js
        
        if (sprite) {}
        else if (e.type === 'shield') {
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill();
            if (e.shieldHp > 0) {
                ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.facingAngle);
                ctx.fillStyle = '#546e7a'; ctx.fillRect(8, -20, 10, 40);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(8, -20, 10, 40);
                ctx.restore();
            }
        } 
        else if (e.type === 'thief') {
            ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size);
            ctx.fillStyle = '#9e9e9e';
            ctx.beginPath(); ctx.moveTo(e.x + 10, e.y); ctx.lineTo(e.x + 20, e.y - 5); ctx.lineTo(e.x + 20, e.y + 5); ctx.fill();
        }
        else if (e.type === 'slime_ranged' || e.type.startsWith('boss') || e.type === 'voltaic_ooze' || e.type === 'toxic_sludge' || e.type === 'amalgam_minion' || e.type === 'caster' || e.type === 'spore_slime' || e.type === 'crystal_slime' || e.type === 'slime_warden' || e.type === 'queen_guard') { 
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill(); 
        } 
        else { ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); }
        
        drawEnemyStatus(e); // skillfx_e.js
        drawRmbEnemy(e); // skillfx_rmb.js: Net Shot wrap
        if (e.markAngle !== undefined) drawDeathMarkSigil(e); // skillfx_ult.js

        if (!sprite && !e.type.startsWith('boss')) { ctx.fillStyle = '#000'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size, 4); ctx.fillStyle = '#4caf50'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2 - 12, e.size * (e.hp/e.maxHp), 4); }
    }

    for (const p of projectiles) {
        if (!p.isEnemy && drawPlayerProjectile(p)) continue; // weapons.js
        if (p.isEnemy && drawEnemyProjectile(p)) continue; // enemysprites.js
        if (p.type === 'turret') {
            ctx.fillStyle = '#424242'; ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
            ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 12, p.y - 12, 24, 24);
            ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle)*18, p.y + Math.sin(p.angle)*18); ctx.stroke();
        } else if (p.type === 'tesla_coil_trap') {
            ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.stroke();
            if (Math.random() < 0.3) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (Math.random()-0.5)*20, p.y + (Math.random()-0.5)*20); ctx.stroke(); }
        } else if (p.shape === 'arrow') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.strokeStyle = p.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
            ctx.fillStyle = p.isEnemy ? '#ff5252' : '#e0e0e0';
            ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.fill();
            ctx.strokeStyle = p.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -4); ctx.moveTo(-10, 0); ctx.lineTo(-14, 4); ctx.stroke();
            ctx.restore();
        } else if (p.shape === 'knife') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -4); ctx.lineTo(-8, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'spear') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(10, 0); ctx.stroke();
            ctx.fillStyle = '#bdbdbd'; 
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'bullet') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.roundRect(-6, -3, 12, 6, 3); ctx.fill();
            ctx.restore();
        } else if (p.type === 'censer_pulse') {
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x - p.radius * 1.5, p.y); ctx.lineTo(p.x + p.radius * 1.5, p.y);
            ctx.moveTo(p.x, p.y - p.radius * 1.5); ctx.lineTo(p.x, p.y + p.radius * 1.5);
            ctx.stroke();
        } else if (p.shape === 'hound') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.fillStyle = p.color; 
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI*2); ctx.fill(); 
            ctx.beginPath(); ctx.arc(10, -5, 6, 0, Math.PI*2); ctx.fill(); 
            ctx.fillRect(-12, 4, 4, 8); ctx.fillRect(8, 4, 4, 8); 
            ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-18, -8); ctx.lineWidth = 3; ctx.strokeStyle = p.color; ctx.stroke(); 
            ctx.restore();
        } else if (p.shape === 'bolas') {
            p.spin = (p.spin || 0) + 0.5;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
            ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
            ctx.fillStyle = '#4e342e';
            ctx.beginPath(); ctx.arc(-15, 0, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'slime_blob') {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + Math.cos(p.life*10)*4, p.y + Math.sin(p.life*10)*4, p.radius*0.6, 0, Math.PI*2); ctx.fill();
        } else if (p.shape === 'net') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.life * 5) % (Math.PI * 2));
            ctx.strokeStyle = p.color; ctx.lineWidth = 2;
            let sz = p.radius;
            ctx.beginPath();
            for(let i= -sz; i <= sz; i += sz/2) {
                ctx.moveTo(i, -sz); ctx.lineTo(i, sz);
                ctx.moveTo(-sz, i); ctx.lineTo(sz, i);
            }
            ctx.stroke();
            ctx.restore();
        } else if (p.shape === 'fireball' || p.type === 'fireball') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.fillStyle = p.color; ctx.shadowBlur = 15; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(0, 0, p.radius, -Math.PI/2, Math.PI/2); ctx.lineTo(-p.radius * 2.5, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffeb3b'; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(2, 0, p.radius * 0.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'aura') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2 + Math.sin(p.life * 5) * 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.2 + Math.sin(p.life * 5) * 0.1;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Add some spinning runes or an inner ring
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([10, 15]);
            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        } else if (p.shape === 'mini_sword') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle || 0);
            ctx.fillStyle = p.color || '#00bcd4';
            ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e0f7fa'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -1); ctx.lineTo(-3, 1); ctx.closePath(); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'shield') {
            p.spinAngle = (p.spinAngle || 0) + 0.3; 
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spinAngle);
            ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'phantom_blade_proj') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = p.color;
            ctx.filter = 'blur(4px)';
            ctx.beginPath(); ctx.ellipse(-20, 0, 60, 15, 0, 0, Math.PI*2); ctx.fill();
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
            // Draw blade
            let bladeGrad = ctx.createLinearGradient(-60, 0, 40, 0);
            bladeGrad.addColorStop(0, '#e0f7fa'); bladeGrad.addColorStop(0.3, p.color); bladeGrad.addColorStop(1, p.color);
            ctx.fillStyle = bladeGrad;
            ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-40, -10); ctx.lineTo(40, 0); ctx.lineTo(-40, 10); ctx.closePath(); ctx.fill();
            // Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(-45, 0); ctx.lineTo(-38, -4); ctx.lineTo(30, 0); ctx.lineTo(-38, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill(); ctx.shadowBlur = 0;
        }
    }

    drawDruidWorld(); // druid.js: the wolves, the howl, the Maul

    if (player.hp > 0 && gameState !== STATE.MENU && gameState !== STATE.DEAD && !(player.fadeOut >= 1)) {
        if (player.fadeOut > 0) ctx.filter = `opacity(${1 - player.fadeOut})`; // walking into the dark at a stage exit
        if (player.grappleTarget) drawGrappleCable(player.grappleTarget); // skillfx_space.js

        // Face the way you're dashing; otherwise face the cursor
        const spin = ultFacing(); // skillfx_ult.js: Blade Whirlwind spins the hero
        const aimAngle = player.dash ? player.dash.angle : spin !== null ? spin : Math.atan2(mouseY - player.y, mouseX - player.x);
        updatePlayerSpriteAnim();
        drawPlayerShadow(aimAngle);
        drawDashGhosts(); // skillfx_space.js
        ctx.lineWidth = 4;
        
        if (activeClass && activeClass.name === 'Spellweaver' && player.arcaneResonance) { ctx.strokeStyle = '#2196f3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI*2); ctx.stroke(); }
        
        drawUltAuraBack(aimAngle); // skillfx_ult.js: Ascension wings, Overclock heat

        // Leaps lift the hero (and everything they carry) off the ground, above their shadow
        const lift = player.z || 0;
        if (lift > 0) { const s = 1 + lift / 300; ctx.save(); ctx.translate(player.x, player.y - lift); ctx.scale(s, s); ctx.translate(-player.x, -player.y); }
        drawPlayerSprite(aimAngle); // sprites.js
        drawPlayerWeapon(aimAngle); // weapons.js

        drawPlayerShield(); // skillfx_e.js
        drawSlamCharge(); // weapons.js: the Dragonknight's charge ring, above the shield
        drawComboWindow(); // combos.js: a finisher is ready
        if (lift > 0) ctx.restore();
        drawUltAuraFront(aimAngle); // skillfx_ult.js: halo, Overclock gauge

        // Machinist Decoy Projection hologram
        if (player.phantomDecoy && player.phantomDecoy.life > 0) drawDecoyHologram(player.phantomDecoy, aimAngle); // skillfx_space.js
        ctx.filter = 'none';
    } else if (player.fallen && gameState !== STATE.MENU) { // combat.js playerDied: the hero lies where they fell, dimmed, while the death screen (or a taunt) is up
        const a = player.fallAngle !== undefined ? player.fallAngle : (player.fallAngle = Math.atan2(mouseY - player.y, mouseX - player.x));
        ctx.save(); ctx.fillStyle = 'rgba(90, 0, 0, 0.45)'; ctx.beginPath(); ctx.ellipse(player.x + 4, player.y + 6, 26, 16, 0, 0, Math.PI * 2); ctx.fill(); // blood under them
        ctx.filter = 'grayscale(0.7) brightness(0.55)'; drawPlayerGhost(player.x, player.y, a, 1); ctx.restore(); // sprites.js: a still pose
    }

    if (currentMap.type === 'clearing') drawClearingCanopy(); // map_clearing.js: trees overhang the fight
    if (currentMap.type === 'cavern') drawCavernAbove(); // map_cavern.js: falling stalactites, drips
    if (currentMap.type === 'hive') drawHiveAbove(); // map_hive.js: drifting spores
    if (currentMap.type === 'village') drawVillageAbove(); // map_village.js: roof fires, smoke, the canopy, ash
    if (currentMap.type === 'trail') drawTrailAbove(); // map_trail.js: the canopy, the campfire's smoke, pollen
    if (currentMap.type === 'bridge') drawBridgeAbove(); // map_bridge.js: banners, the castle's archers, mist off the gorge
    if (currentMap.type === 'castle') drawCastleAbove(); // map_castle.js: banners, the forge's smoke, chandeliers
    drawEnemyOverlay(); // enemysprites.js: lightning coming down from above
    drawFx(); // fx.js particles
    drawUltOverlay(); // skillfx_ult.js: things in the air above everything
    ctx.restore(); // end camera shake

    drawStageScreen(); // stage.js: vignette, pointer to the cave
    drawHudOrbs(); // hud.js; the boss bar is part of the HTML HUD now

    if (gameState === STATE.PAUSED) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#f1d48a'; ctx.font = 'bold 54px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PAUSED', canvas.width/2, canvas.height/2); ctx.fillStyle = '#a39279'; ctx.font = 'italic 16px Georgia, serif'; ctx.fillText('Press P to resume', canvas.width/2, canvas.height/2 + 46);
    }
}

function loop() {
    const now = performance.now(); let dt = (now - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = now;
    
    if (gameState === STATE.PLAYING && player.hp > 0) {
        if (hitStopTimer > 0) { hitStopTimer -= dt; } 
        else { update(dt); }
    }
    
    updateCamera(dt); // stage.js
    draw(); requestAnimationFrame(loop);
}