// ==========================================
// main.js - Core Loop, Rendering, & Input
// ==========================================

window.chooseClass = (cid) => { selectedClassId = cid; el('class-selection').classList.add('hidden'); el('dungeon-selection').classList.remove('hidden'); };
window.selectDungeon = (did) => { activeDungeonId = did; activeDungeon = enemyDataConfig[did]; startGame(selectedClassId); };

function startGame(className) {
    activeClass = JSON.parse(JSON.stringify(classDataConfig[className])); 
    player.color = activeClass.color; player.x = canvas.width / 2; player.y = canvas.height / 2;
    player.level = 1; player.xp = 0; player.maxXp = 50; player.gold = 0; player.bonusDmg = 0.0; player.skillPoints = 1;
    wave = 0; equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; inventory = [];
    isEndlessMode = false;
    
    if (activeClass.name === 'Swordsaint') {
        player.stance = 'handheld'; player.flow = 0;
        player.blade = { x: player.x, y: player.y, state: 'idle', timer: 0, angle: -Math.PI/2, targetX: player.x, targetY: player.y, hitList: [], baseDmg: 0 };
    } else { player.blade = null; }

    recalcStats(); player.hp = player.maxHp; player.shield = 0; player.shieldTimer = 0; player.markTimer = 0; player.cowlCooldown = 0; player.iFrames = 0;
    buffs.rooted = 0; buffs.powerSurgeStacks = 0; buffs.powerSurgeTimer = 0; buffs.weakened = 0; buffs.evade100 = 0; buffs.deathMarkActive = 0; buffs.overclockTimer = 0; buffs.bladeCascade = 0;
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0;
    
    el('start-screen').classList.add('hidden'); el('hud').classList.remove('hidden');
    triggerLevelUp("Choose Starting Skill");
    loop();
}

window.startEndlessMode = function() {
    isEndlessMode = true;
    el('intermission-screen').innerHTML = `<h1 style="color:#ffca28;" id="intermission-title">Wave Cleared</h1>
    <button class="btn" onclick="openInventory()">Open Inventory</button>
    <button class="btn btn-gold hidden" id="btn-shop" onclick="openShop()">Visit Shop</button>
    <button class="btn" onclick="startNextWave()" style="border-color:#4caf50; color:#4caf50;">Start Next Wave</button>`;
    startNextWave();
}

window.startNextWave = function() {
    wave++; 
    isBossWave = (wave % 5 === 0); 
    bossSpawned = false;
    enemiesToSpawn = isBossWave ? 4 : 3 + Math.floor(wave * 2.5); 
    
    if (activeDungeonId === 'bandit_bastion' && wave === 11 && !isEndlessMode) {
        currentMap.type = 'bridge'; isBossWave = true; enemiesToSpawn = 0; 
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

window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mousedown', e => { 
    if (e.button === 0) isMouseDown = true; 
    if (e.button === 2 && equipment.weapon && equipment.weapon.rarity === 'rare' && (cooldowns.rmb <= 0 || devNoCooldowns) && gameState === STATE.PLAYING) {
        cooldowns.rmb = devNoCooldowns ? 0 : 4.0 * getCDR();
        window.SkillRegistry[activeClass.name]['rmb']();
    }
    if (e.button === 0 && buffs.bladeCascade > 0 && activeClass.skills[4].selectedUpg !== 'A' && gameState === STATE.PLAYING) {
        window.spawnBladeDrop(mouseX + (Math.random()-0.5)*80, mouseY + (Math.random()-0.5)*80, player.blade.cascadeDmg);
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
        if ((cooldowns[`s${i}`] <= 0 || devNoCooldowns) && activeClass.skills[i].level > 0) {
            const sk = activeClass.skills[i];
            let cdReduction = getCDR();
            if (activeClass.name === 'Dragonknight' && i === 3 && equipment.boots && equipment.boots.name === 'Earthshaker Treads') sk.maxCd = Math.max(1, sk.maxCd - 2.0);
            cooldowns[`s${i}`] = devNoCooldowns ? 0 : sk.maxCd * cdReduction;
            
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
    if (player.iFrames > 0) player.iFrames -= dt;

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

    if (activeClass && activeClass.name === 'Machinist' && buffs.overclockTimer > 0) {
        buffs.overclockTimer -= dt;
    }

    if (activeClass && activeClass.name === 'Swordsaint') {
        let b = player.blade;
        if (b) {
            if (player.stance === 'handheld') {
                b.x = player.x; b.y = player.y; b.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
                if (player.flow > 0 && !isMouseDown) player.flow = Math.max(0, player.flow - dt * 2);
            } else if (player.stance === 'airborne') {
                let flowMult = 1 + ((player.flow || 0) / 100);
                if (b.state === 'ai') {
                    let target = getNearestEnemyFromPoint(player.x, player.y, 300);
                    if (target) {
                        let [dx, dy, dist] = getVector(b.x, b.y, target.x, target.y);
                        b.angle = Math.atan2(dy, dx);
                        if (dist > 5) { b.x += (dx/dist) * 800 * flowMult * dt; b.y += (dy/dist) * 800 * flowMult * dt; }
                        b.aiHitTimer = (b.aiHitTimer || 0) - dt;
                        if (b.aiHitTimer <= 0 && dist < target.size/2 + 40) { applyDamage(target, 20 * flowMult, 'magic', b.angle); b.aiHitTimer = 0.3; }
                    } else {
                        let [dx, dy, dist] = getVector(b.x, b.y, player.x, player.y);
                        b.angle = Math.atan2(dy, dx);
                        if (dist > 60) { b.x += (dx/dist) * 600 * dt; b.y += (dy/dist) * 600 * dt; }
                    }
                } else if (b.state === 'override') {
                    let [dx, dy, dist] = getVector(b.x, b.y, b.targetX, b.targetY);
                    if (dist > 20) {
                        b.x += (dx/dist) * 2000 * flowMult * dt; b.y += (dy/dist) * 2000 * flowMult * dt;
                        effects.push({ type: 'circle', x: b.x, y: b.y, radius: 15, color: '#00e5ff', life: 0.1, maxLife: 0.1 });
                        for (let e of enemies) { if (Math.hypot(e.x - b.x, e.y - b.y) < e.size/2 + 40 && !b.hitList.includes(e)) { applyDamage(e, b.baseDmg, 'magic', b.angle); b.hitList.push(e); } }
                    } else { b.state = 'ai'; }
                } else if (b.state === 'surge') {
                    b.surgeTimer -= dt;
                    if (b.surgeTarget && b.surgeTarget.hp > 0) {
                        b.x = b.surgeTarget.x; b.y = b.surgeTarget.y; b.angle += 20 * dt;
                        effects.push({ type: 'sharp_slash', x: b.x, y: b.y, radius: 60, angle: b.angle, color: '#00e5ff', life: 0.1, maxLife: 0.1 });
                        applyDamage(b.surgeTarget, b.baseDmg * dt * 2, 'magic');
                    } else {
                        if (b.surgeJumps > 0) { b.surgeJumps--; let nextT = getNearestEnemyFromPoint(b.x, b.y, 400); if (nextT) { b.surgeTarget = nextT; b.surgeTimer = 1.5; } else { b.state = 'ai'; } } 
                        else { b.state = 'ai'; }
                    }
                    if (b.surgeTimer <= 0) b.state = 'ai';
                }
            }
        }
    }

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
            else if (d.type === 'scrap') { player.hp = Math.min(player.maxHp, player.hp + 5); for(let j=1; j<=4; j++) cooldowns[`s${j}`] = Math.max(0, cooldowns[`s${j}`] - 0.5); }
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
        
        if (p.customUpdate) { p.customUpdate(dt, p); }
        
        if (p.source === 'fan_of_knives' && p.returnDmg && p.life <= 0.5 && !p.returning) {
            p.returning = true; p.hitList = [];
        }
        if (p.source === 'fan_of_knives' && p.returning) {
            const [rx, ry, rd] = getVector(p.x, p.y, player.x, player.y);
            if (rd < p.radius + player.radius) { projectiles.splice(i, 1); continue; }
            p.vx = (rx/rd)*1200; p.vy = (ry/rd)*1200; p.life = 0.5;
        }
        
        if (p.shape === 'hound' || p.type === 'hound') {
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
        } else if (p.type !== 'turret' && p.type !== 'tesla_coil_trap') {
            p.x += p.vx * dt; p.y += p.vy * dt; 
        }
        
        p.life -= dt;
        
        if (p.life <= 0 || p.x < currentMap.left - 50 || p.x > currentMap.right + 50 || p.y < currentMap.top - 50 || p.y > currentMap.bottom + 50) { 
            if (p.shape === 'slime_blob' || p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
            if (p.type === 'trap_throw') { effects.push({ type: 'bear_trap', x: p.x, y: p.y, radius: 15, color: '#5d4037', life: 8.0, maxLife: 8.0, dmg: p.damage }); }
            if (p.type === 'spore') { effects.push({ type: 'spore_cloud', x: p.x, y: p.y, radius: 100, color: 'rgba(205, 220, 57, 0.4)', life: 3.0, maxLife: 3.0 }); }
            if (p.type === 'chain_hook' && p.sourceBoss) { 
                p.sourceBoss.state = 'hook_pull'; 
                p.sourceBoss.pullTargetX = Math.max(currentMap.left + 20, Math.min(currentMap.right - 20, p.x)); 
                p.sourceBoss.pullTargetY = Math.max(currentMap.top + 20, Math.min(currentMap.bottom - 20, p.y)); 
            }
            if (p.type === 'turret' && p.volatile) {
                effects.push({ type: 'circle', x: p.x, y: p.y, radius: 150, color: '#ff5722', life: 0.3, maxLife: 0.3 });
                for(let e of enemies) { if (Math.hypot(e.x - p.x, e.y - p.y) < e.size/2 + 150) applyDamage(e, p.damage * 3, 'magic'); }
            }
            if (p.type === 'phantom_blade_drop') {
                effects.push({ type: 'circle', x: p.x, y: p.y, radius: 60, color: '#00e5ff', life: 0.2, maxLife: 0.2 });
                for(let e of enemies) { if (Math.hypot(e.x - p.x, e.y - p.y) < e.size/2 + 60) applyDamage(e, p.damage, 'magic'); }
            }
            projectiles.splice(i, 1); continue; 
        }

        if (p.isEnemy) {
            if (p.type !== 'trap_throw' && p.type !== 'spore' && Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) { 
                takeDamage(p.damage); 
                if (p.type === 'chain_hook') {
                    buffs.rooted = 1.0;
                    let [bx, by, bdist] = getVector(player.x, player.y, p.sourceBoss.x, p.sourceBoss.y);
                    player.x += (bx/bdist)*(bdist - 50); player.y += (by/bdist)*(bdist - 50); clampToBounds(player, player.radius);
                    p.sourceBoss.state = 'idle'; p.sourceBoss.stateTimer = 1.5; 
                }
                if (p.shape === 'slime_blob' || p.type === 'boss_slimeball') { effects.push({ type: 'puddle', x: p.x, y: p.y, radius: 30, color: '#009688', life: 1.5, maxLife: 1.5 }); }
                if (p.shape === 'bolas' || p.type === 'bolas') { 
                    buffs.rooted = 1.0; const boss = enemies.find(e => e.type === 'boss_beastmaster');
                    if (boss) { const [bx, by, bdist] = getVector(player.x, player.y, boss.x, boss.y); player.x += (bx/bdist)*100; player.y += (by/bdist)*100; clampToBounds(player, player.radius); }
                }
                projectiles.splice(i, 1); 
            }
        } else {
            if (p.type === 'turret' || p.type === 'tesla_coil_trap') continue; 
            
            if (p.shape === 'shield' || p.type === 'shield_throw') {
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
                    if ((p.pierce || p.type === 'shield_throw' || p.type === 'fan_of_knives' || p.type === 'scattergun') && p.hitList.includes(e)) continue;

                    if (p.shape === 'fireball' || p.type === 'fireball' || p.resonance) {
                        let explRadius = p.sourceSkill && p.sourceSkill.selectedUpg === 'B' ? 100 : 70;
                        effects.push({ type: 'fiery_explosion', x: p.x, y: p.y, radius: explRadius, life: 0.4, maxLife: 0.4 });
                        if (p.sourceSkill && p.sourceSkill.selectedUpg === 'B') {
                            effects.push({ type: 'fire_puddle', x: p.x, y: p.y, radius: explRadius, color: 'rgba(255, 87, 34, 0.4)', life: 0.75, maxLife: 0.75, dmg: p.damage * 0.5 });
                        }
                        for(let k=enemies.length-1; k>=0; k--) {
                            if (Math.hypot(p.x - enemies[k].x, p.y - enemies[k].y) <= explRadius + enemies[k].size/2) applyDamage(enemies[k], p.damage, 'magic');
                        }
                    } else if (p.shape === 'shield' || p.type === 'shield_throw') {
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
                    } else if (p.type === 'scattergun') {
                        applyDamage(e, p.damage, 'ranged');
                        let [ebx, eby, ebd] = getVector(player.x, player.y, e.x, e.y);
                        if (!e.type.startsWith('boss') && ebd > 0) { e.x += (ebx/ebd)*15; e.y += (eby/ebd)*15; clampToBounds(e, e.size/2); }
                    } else { applyDamage(e, p.damage, activeClass.name === 'Ranger' ? 'ranged' : (p.source === 'fan_of_knives' ? 'assassin_skill' : 'magic'), Math.atan2(p.vy, p.vx)); }
                    
                    if (p.pierce || p.type === 'shield_throw' || p.type === 'ricochet' || p.type === 'fan_of_knives' || p.type === 'scattergun') { if (p.type !== 'ricochet') p.hitList.push(e); } else { hit = true; break; }
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
        
        if (e.aoeResistTimer > 0) {
            e.aoeResistTimer -= dt;
            if (e.aoeResistTimer <= 0) e.aoeResistStacks = 0;
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
            if (e.type === 'shield' || e.type === 'boss_valerius') {
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
        else if (d.type === 'scrap') {
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
        if (ef.type === 'puddle' || ef.type === 'fire_puddle' || ef.type === 'spore_cloud' || ef.type === 'smoke_bomb') continue; 
        ctx.globalAlpha = ef.isWarning ? 1.0 : ef.life / ef.maxLife; 

        if (ef.type === 'fiery_explosion') {
            let p = 1.0 - (ef.life / ef.maxLife);
            ctx.fillStyle = `rgba(255, 61, 0, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = `rgba(255, 152, 0, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p * 0.7, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = `rgba(255, 235, 59, ${ef.life/ef.maxLife})`;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * p * 0.4, 0, Math.PI*2); ctx.fill();
        }
        else if (ef.type === 'ice_nova_wave') {
            let prog = 1.0 - (ef.life / ef.maxLife); 
            ctx.fillStyle = ef.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            for (let r = 1; r <= 3; r++) {
                let ringProg = prog * 1.5 - (r * 0.2); 
                if (ringProg > 0 && ringProg < 1.0) {
                    let ringRadius = ef.radius * ringProg; let numSpikes = 8 + r * 4;
                    for (let i = 0; i < numSpikes; i++) {
                        let ang = (Math.PI * 2 / numSpikes) * i + (r * 0.5);
                        let bx = ef.x + Math.cos(ang) * ringRadius; let by = ef.y + Math.sin(ang) * ringRadius;
                        let height = 20 * Math.sin(ringProg * Math.PI);
                        ctx.beginPath(); ctx.moveTo(bx, by - height); ctx.lineTo(bx - 6, by + 4); ctx.lineTo(bx + 6, by + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
                    }
                }
            }
        }
        else if (ef.type === 'sharp_slash') {
            ctx.fillStyle = ef.color; ctx.globalAlpha = (ef.life/ef.maxLife);
            let spread = Math.PI/2;
            ctx.beginPath();
            ctx.arc(ef.x, ef.y, ef.radius, ef.angle - spread, ef.angle + spread);
            ctx.quadraticCurveTo(ef.x + Math.cos(ef.angle)*ef.radius*0.2, ef.y + Math.sin(ef.angle)*ef.radius*0.2, 
                                 ef.x + Math.cos(ef.angle - spread)*ef.radius, ef.y + Math.sin(ef.angle - spread)*ef.radius);
            ctx.fill();
        }
        else if (ef.type === 'thrust_edge') {
            ctx.save(); ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
            ctx.fillStyle = ef.color; ctx.globalAlpha = ef.life/ef.maxLife;
            ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(60, 0); ctx.lineTo(0, 12); ctx.lineTo(15, 0); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        else if (ef.type === 'blade_whirlwind') {
            ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 4;
            let ang1 = (ef.maxLife - ef.life) * 15;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, ang1, ang1 + Math.PI); ctx.stroke();
            ctx.strokeStyle = '#b2ebf2';
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * 0.7, ang1 + Math.PI/2, ang1 + Math.PI/2 + Math.PI); ctx.stroke();
            ctx.fillStyle = 'rgba(0, 229, 255, 0.1)'; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill();
        }
        else if (ef.type === 'shatter_storm') {
            let prog = 1.0 - (ef.life/ef.maxLife);
            ctx.fillStyle = '#00e5ff';
            for(let i=0; i<12; i++) {
                let ang = (Math.PI*2/12) * i + (prog * 5);
                let dist = ef.radius * prog;
                ctx.save(); ctx.translate(ef.x + Math.cos(ang)*dist, ef.y + Math.sin(ang)*dist); ctx.rotate(ang + Math.PI/2);
                ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
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
        else if (ef.type === 'circle') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); if (ef.isWarning) { ctx.strokeStyle = ef.color; ctx.lineWidth = 2; ctx.stroke(); } ctx.fill(); } 
        else if (ef.type === 'line') { ctx.strokeStyle = ef.color; ctx.lineWidth = ef.lineWidth || 40; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); } 
        else if (ef.type === 'cone') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.arc(ef.x, ef.y, ef.radius, ef.angle - ef.spread/2, ef.angle + ef.spread/2); ctx.closePath(); ctx.fill(); }
        else if (ef.type === 'lightning') { ctx.strokeStyle = ef.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke(); }
        else if (ef.type === 'triangle') { ctx.strokeStyle = ef.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ef.p1.x, ef.p1.y); ctx.lineTo(ef.p2.x, ef.p2.y); ctx.lineTo(ef.p3.x, ef.p3.y); ctx.closePath(); ctx.stroke(); ctx.fill(); }
        else if (ef.type === 'bear_trap') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius/2, 0, Math.PI*2); ctx.fill(); }
        else if (ef.type === 'text') { ctx.fillStyle = ef.color; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText(ef.text, ef.x, ef.y - (1.0 - (ef.life/ef.maxLife)) * 30); }
        ctx.globalAlpha = 1.0;
    }

    for (const e of enemies) {
        if (e.state === 'split') continue; 
        ctx.fillStyle = e.renderColor || e.color;
        if (e.type === 'shield' || e.type === 'boss_valerius') {
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
        else if (e.type === 'bannerman') {
            ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size);
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(e.x - e.size/2, e.y + e.size/2); ctx.lineTo(e.x - e.size/2, e.y - e.size - 20); ctx.stroke();
            let flap = Math.sin(performance.now() / 150) * 8;
            ctx.fillStyle = '#d32f2f'; ctx.beginPath();
            ctx.moveTo(e.x - e.size/2, e.y - e.size - 20);
            ctx.lineTo(e.x - e.size/2 + 30 + flap, e.y - e.size - 25);
            ctx.lineTo(e.x - e.size/2 + 25 - flap, e.y - e.size - 10);
            ctx.lineTo(e.x - e.size/2, e.y - e.size); ctx.closePath(); ctx.fill();
        }
        else if (e.type === 'slime_ranged' || e.type.startsWith('boss') || e.type === 'voltaic_ooze' || e.type === 'toxic_sludge' || e.type === 'amalgam_minion' || e.type === 'caster' || e.type === 'spore_slime' || e.type === 'crystal_slime' || e.type === 'slime_warden' || e.type === 'queen_guard') { 
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill(); 
        } 
        else { ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); }
        
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
        if (p.type === 'turret') {
            ctx.fillStyle = '#424242'; ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
            ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 12, p.y - 12, 24, 24);
            ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle)*18, p.y + Math.sin(p.angle)*18); ctx.stroke();
        } else if (p.type === 'tesla_coil_trap') {
            ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.stroke();
            if (Math.random() < 0.3) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (Math.random()-0.5)*20, p.y + (Math.random()-0.5)*20); ctx.stroke(); }
        } else if (p.type === 'phantom_blade_drop') {
            ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 10; ctx.shadowColor = '#00e5ff'; ctx.fill(); ctx.shadowBlur = 0;
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
        } else if (p.shape === 'fireball' || p.type === 'fireball') {
            let ang = Math.atan2(p.vy, p.vx);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.fillStyle = p.color; ctx.shadowBlur = 15; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(0, 0, p.radius, -Math.PI/2, Math.PI/2);
            ctx.lineTo(-p.radius * 2.5, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffeb3b'; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(2, 0, p.radius * 0.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        } else if (p.shape === 'shield') {
            p.spinAngle = (p.spinAngle || 0) + 0.3; 
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spinAngle);
            ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill(); ctx.shadowBlur = 0;
        }
    }

    if (player.hp > 0 && gameState !== STATE.MENU && gameState !== STATE.DEAD) {
        const aimAngle = Math.atan2(mouseY - player.y, mouseX - player.x); 
        ctx.lineWidth = 4;
        
        if (activeClass && activeClass.name === 'Spellweaver' && player.arcaneResonance) { ctx.strokeStyle = '#2196f3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI*2); ctx.stroke(); }
        
        if (activeClass && activeClass.weapon === 'staff') {
            ctx.strokeStyle = '#795548'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(player.x, player.y);
            const tipX = player.x + Math.cos(aimAngle)*45; const tipY = player.y + Math.sin(aimAngle)*45; ctx.lineTo(tipX, tipY); ctx.stroke();
            ctx.fillStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#e3f2fd' : '#4fc3f7'; 
            ctx.beginPath(); ctx.arc(tipX, tipY, 8, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - Math.cos(aimAngle)*10, tipY - Math.sin(aimAngle)*10); ctx.stroke();
        } else if (activeClass && activeClass.weapon === 'bow') {
            ctx.strokeStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#2196f3' : '#8d6e63'; 
            ctx.lineWidth = 5; ctx.beginPath(); 
            ctx.arc(player.x + Math.cos(aimAngle)*15, player.y + Math.sin(aimAngle)*15, 25, aimAngle - Math.PI/2.2, aimAngle + Math.PI/2.2); ctx.stroke();
            ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2; ctx.beginPath(); 
            let p1x = player.x + Math.cos(aimAngle)*15 + Math.cos(aimAngle - Math.PI/2.2)*25;
            let p1y = player.y + Math.sin(aimAngle)*15 + Math.sin(aimAngle - Math.PI/2.2)*25;
            let p2x = player.x + Math.cos(aimAngle)*15 + Math.cos(aimAngle + Math.PI/2.2)*25;
            let p2y = player.y + Math.sin(aimAngle)*15 + Math.sin(aimAngle + Math.PI/2.2)*25;
            let drawX = cooldowns.basic <= 0 ? player.x + Math.cos(aimAngle)*5 : player.x + Math.cos(aimAngle)*15;
            let drawY = cooldowns.basic <= 0 ? player.y + Math.sin(aimAngle)*5 : player.y + Math.sin(aimAngle)*15;
            ctx.moveTo(p1x, p1y); ctx.lineTo(drawX, drawY); ctx.lineTo(p2x, p2y); ctx.stroke();
            if (cooldowns.basic <= 0) { ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(drawX, drawY); ctx.lineTo(drawX + Math.cos(aimAngle)*30, drawY + Math.sin(aimAngle)*30); ctx.stroke(); }
        } else if (activeClass && activeClass.weapon === 'sword') {
            let swordAng = aimAngle;
            if (cooldowns.basic > 0) {
                let progress = 1.0 - (cooldowns.basic / activeClass.basicAttackCD);
                let eased = Math.min(1, progress * 3); 
                swordAng = aimAngle - Math.PI/1.5 + (Math.PI * 1.2) * eased; 
            } else {
                swordAng = aimAngle - Math.PI/4; 
            }
            
            ctx.strokeStyle = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#2196f3' : '#bdbdbd'; 
            ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); 
            ctx.moveTo(player.x + Math.cos(swordAng)*15, player.y + Math.sin(swordAng)*15); 
            ctx.lineTo(player.x + Math.cos(swordAng)*60, player.y + Math.sin(swordAng)*60); ctx.stroke();
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 6; ctx.beginPath(); 
            const cx = player.x + Math.cos(swordAng)*20; const cy = player.y + Math.sin(swordAng)*20; const perp = swordAng + Math.PI/2;
            ctx.moveTo(cx + Math.cos(perp)*20, cy + Math.sin(perp)*20); ctx.lineTo(cx - Math.cos(perp)*20, cy - Math.sin(perp)*20); ctx.stroke(); ctx.lineCap = 'butt';
        } else if (activeClass && activeClass.weapon === 'scattergun') {
            ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(player.x + Math.cos(aimAngle)*10, player.y + Math.sin(aimAngle)*10); ctx.lineTo(player.x + Math.cos(aimAngle)*25, player.y + Math.sin(aimAngle)*25); ctx.stroke();
            ctx.strokeStyle = '#757575'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(player.x + Math.cos(aimAngle)*25, player.y + Math.sin(aimAngle)*25); ctx.lineTo(player.x + Math.cos(aimAngle)*40, player.y + Math.sin(aimAngle)*40); ctx.stroke();
        } else if (activeClass && activeClass.weapon === 'dagger') {
            const handleColor = equipment.weapon && equipment.weapon.rarity === 'rare' ? '#4a148c' : '#9c27b0';
            const perp = aimAngle + Math.PI/2;
            for(let j of [-1, 1]) {
                let dx = player.x + Math.cos(aimAngle + j*0.5)*18; 
                let dy = player.y + Math.sin(aimAngle + j*0.5)*18;
                ctx.strokeStyle = handleColor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(aimAngle)*8, dy + Math.sin(aimAngle)*8); ctx.stroke();
                ctx.strokeStyle = '#bdbdbd'; ctx.beginPath(); ctx.moveTo(dx + Math.cos(aimAngle)*8, dy + Math.sin(aimAngle)*8); ctx.lineTo(dx + Math.cos(aimAngle)*26, dy + Math.sin(aimAngle)*26); ctx.stroke();
                ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx + Math.cos(aimAngle)*26, dy + Math.sin(aimAngle)*26); ctx.lineTo(dx + Math.cos(aimAngle)*32, dy + Math.sin(aimAngle)*32); ctx.stroke();
                ctx.strokeStyle = '#ffca28'; ctx.beginPath(); let cx = dx + Math.cos(aimAngle)*8; let cy = dy + Math.sin(aimAngle)*8;
                ctx.moveTo(cx + Math.cos(perp)*8, cy + Math.sin(perp)*8); ctx.lineTo(cx - Math.cos(perp)*8, cy - Math.sin(perp)*8); ctx.stroke();
            }
        }
        
        if (player.shield > 0) { 
            ctx.strokeStyle = 'rgba(129, 212, 250, 0.8)'; ctx.lineWidth = 6; 
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 12, aimAngle - Math.PI/3, aimAngle + Math.PI/3); ctx.stroke();
            ctx.strokeStyle = '#0288d1'; ctx.lineWidth = 2; 
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 18, aimAngle - Math.PI/3.5, aimAngle + Math.PI/3.5); ctx.stroke();
        }
        
        ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    } 

    if (activeClass && activeClass.name === 'Swordsaint' && player.blade) {
        let b = player.blade;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);

        let flowGlow = (player.flow || 0) / 100;
        ctx.shadowBlur = 15 + (30 * flowGlow);
        ctx.shadowColor = `rgba(0, 229, 255, ${0.5 + 0.5 * flowGlow})`;

        let grad = ctx.createLinearGradient(0, -10, 80, 10);
        grad.addColorStop(0, '#f8bbd0'); 
        grad.addColorStop(0.5, '#ffffff'); 
        grad.addColorStop(1, '#84ffff'); 
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(100, 0); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#1a237e';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(5, -35, -20, -30); ctx.quadraticCurveTo(-5, -15, 0, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(5, 35, -20, 30); ctx.quadraticCurveTo(-5, 15, 0, 0); ctx.fill();

        ctx.fillStyle = '#ffe082';
        ctx.fillRect(-15, -5, 25, 10);
        ctx.beginPath(); ctx.moveTo(10, -7); ctx.lineTo(25, 0); ctx.lineTo(10, 7); ctx.fill(); 

        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(-45, -3, 30, 6); 

        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(5, -5); ctx.lineTo(-5, 0); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill();

        ctx.beginPath(); ctx.arc(-48, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
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