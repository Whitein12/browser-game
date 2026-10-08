// ==========================================
// combat.js - Damage, XP, and Loot Logic
// ==========================================

function calcDmg(baseAmount, skillLevel = 1) {
    let scaledBase = baseAmount + (skillLevel > 1 ? (skillLevel - 1) * (baseAmount * 0.3) : 0);
    let mult = activeClass.dmgMult + (equipment.weapon ? equipment.weapon.val : 0);
    if (activeClass && activeClass.name === 'Dragonknight') mult += (player.frenzyStacks * 0.02);
    if (activeClass && activeClass.name === 'Ranger') mult += player.momentum;
    if (activeClass && activeClass.name === 'Cleric' && buffs.aspectOfReaper > 0) mult += 0.50; // Aspect of the Reaper +50% DMG
    if (activeClass && activeClass.name === 'Cleric' && buffs.ascension > 0) mult += 0.25; // Base Ascension +25% DMG
    mult += (buffs.powerSurgeStacks * 0.1); 
    
    let finalDmg = scaledBase * mult * (1.0 + player.bonusDmg);
    if (buffs.weakened > 0) finalDmg *= 0.7; 
    return finalDmg;
}

function calcUtility(baseAmount, skillLevel = 1) {
    return baseAmount + (skillLevel > 1 ? (skillLevel - 1) * (baseAmount * 0.3) : 0);
}

function calcCooldown(baseCd, skillLevel = 1) {
    // Reduces cooldowns by 15% to 30% dynamically based on skill level.
    return baseCd * Math.max(0.4, (1 - ((skillLevel > 1 ? skillLevel - 1 : 0) * 0.15)));
}

function getCDR() {
    let cdr = 1.0;
    if (equipment.amulet && equipment.amulet.type === 'amulet' && equipment.amulet.rarity !== 'rare') cdr -= equipment.amulet.val;
    if (equipment.amulet && equipment.amulet.name === 'Amulet of Power') cdr -= 0.20;
    if (equipment.amulet && equipment.amulet.name === 'Prismatic Core') cdr -= 0.15;
    if (activeClass && activeClass.name === 'Cleric' && buffs.aspectOfReaper > 0) cdr -= 0.50; // Aspect of the Reaper -50% CD
    return Math.max(0.2, cdr); 
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

function applyDamage(enemy, amount, source = 'player', projAngle = null) {
    if (enemy.dead) return;
    amount *= 0.6; // Global player damage reduction
    
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
    
    if ((enemy.type === 'shield' || enemy.type === 'boss_valerius') && enemy.shieldHp > 0) {
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        let diff = enemy.facingAngle - angleToPlayer; 
        while(diff < -Math.PI) diff += Math.PI*2; 
        while(diff > Math.PI) diff -= Math.PI*2;
        if (Math.abs(diff) < Math.PI / 2.5) { 
            enemy.shieldHp -= amount;
            effects.push({ type: 'text', text: 'Blocked', x: enemy.x, y: enemy.y - 20, color: '#78909c', life: 0.6, maxLife: 0.6 });
            if (enemy.shieldHp <= 0) effects.push({ type: 'text', text: 'SHIELD BROKEN', x: enemy.x, y: enemy.y - 30, color: '#ffeb3b', life: 1.0, maxLife: 1.0 });
            return; 
        }
    }
    
    let isNightblade = activeClass.name === 'Nightblade';
    if (enemy.markAngle !== undefined && (source === 'melee_basic' || source === 'phantom_dash' || source === 'assassin_skill' || source === 'execute')) {
        let hitAngle = projAngle !== null ? projAngle + Math.PI : Math.atan2(player.y - enemy.y, player.x - enemy.x); 
        
        let diff = enemy.markAngle - hitAngle;
        while(diff < -Math.PI) diff += Math.PI*2;
        while(diff > Math.PI) diff -= Math.PI*2;

        if (Math.abs(diff) <= Math.PI / 3) { 
            enemy.markAngle = undefined;
            let trueDmg = activeClass.basicDmg * 5; 
            if (isNightblade && activeClass.skills[3].selectedUpg === 'A' && source === 'phantom_dash') trueDmg *= 3;
            
            enemy.hp -= trueDmg;
            buffs.msBoost = 1.0;
            addShake(4);
            burst(enemy.x, enemy.y, hitAngle + Math.PI, 2.2, 14, { kind: 'spark', color: '#ea80fc', size: 3, life: 0.35, speed: [200, 520], drag: 5 });
            effects.push({ type: 'text', text: 'WEAKPOINT!', x: enemy.x, y: enemy.y - 40, color: '#e1bee7', life: 0.8, maxLife: 0.8 });
            
            if (isNightblade && activeClass.skills[3].level > 0 && source === 'phantom_dash') {
                cooldowns.s3 = Math.max(0, cooldowns.s3 - (activeClass.skills[3].maxCd * getCDR() * 0.5));
            }
            
            if (buffs.deathMarkActive > 0) {
                if (isNightblade && activeClass.skills[4].selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1);
                effects.push({ type: 'holy_nova', x: enemy.x, y: enemy.y, radius: 100, color: '#ce93d8', life: 0.35, maxLife: 0.35 }); // skillfx_space.js
                
                for(let k=enemies.length-1; k>=0; k--) {
                    let et = enemies[k];
                    if (et !== enemy && Math.hypot(enemy.x - et.x, enemy.y - et.y) <= 100 + et.size/2) {
                        et.aoeResistStacks = (et.aoeResistStacks || 0) + 1;
                        et.aoeResistTimer = 2.0; 
                        let splashDmg = (trueDmg * 0.5) / et.aoeResistStacks; 
                        et.hp -= splashDmg; 
                        checkEnemyDeath(et);
                    }
                }
            }
        }
    }

    if (activeClass.name === 'Ranger' && activeClass.skills[1].selectedUpg === 'B' && source !== 'magic' && source !== 'dot') enemy.hp -= (amount * 1.2); 
    else enemy.hp -= amount;
    spawnHitFx(enemy, source, projAngle);

    if (equipment.gloves && equipment.gloves.name === 'Vampiric Grips') player.hp = Math.min(player.maxHp, player.hp + amount * 0.02);

    if (activeClass.name === 'Dragonknight' && (source === 'melee' || source === 'melee_basic')) {
        player.frenzyStacks = Math.min(10, player.frenzyStacks + 1); player.frenzyTimer = 3.0;
    }

    checkEnemyDeath(enemy);
}

function takeDamage(amount, isContinuous = false, sourceObj = null) {
    amount *= 0.6; // Global enemy damage reduction to player

    if (player.parryTimer > 0 && !isContinuous) {
        effects.push({ type: 'text', text: 'Parried!', x: player.x, y: player.y - 30, color: '#00e5ff', life: 0.6, maxLife: 0.6 });
        onParry(sourceObj);
        
        let flowGain = player.maxFlow * 0.2; // Base parry flow gain
        
        // Grant Maximum Flow and reset cooldown for Upgrade A
        if (activeClass && activeClass.skills[1] && activeClass.skills[1].selectedUpg === 'A') {
            flowGain = player.maxFlow;
            cooldowns.s1 = 0; // Reset skill 1 cooldown
        }
        
        player.flow = Math.min(player.maxFlow, (player.flow || 0) + flowGain);
        player.flowGainTimer = 0;
        
        return; // Mitigate all damage
    }

    if (player.iFrames > 0) return;
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
    if (equipment.armor && equipment.armor.name === 'Hazard Suit' && (isContinuous || amount < 5)) return;
    
    // Cleric Vestments of the Fractured Soul interaction
    if (activeClass && activeClass.name === 'Cleric' && equipment.armor && equipment.armor.name === 'Vestments of the Fractured Soul') {
        let isShadow = activeClass.skills[1].selectedUpg === 'B';
        let isHoly = activeClass.skills[1].selectedUpg === 'A';
        
        if (isShadow && player.hp / player.maxHp < 0.25) { // Free Desecration < 25% HP
            // Ensure no infinity loop by adding a small tiny cooldown check on `cowlCooldown`
            if ((player.vestmentCD || 0) <= 0) {
                window.SkillRegistry['Cleric'][2]({ selectedUpg: 'B' }, calcDmg(activeClass.skills[2].baseDmg || 15));
                player.vestmentCD = 2.0; // max once every 2 seconds
            }
        }
        if (isHoly && sourceObj && sourceObj.isProjectile) { // Reflect 15% projectile DMG
            amount *= 0.85; // take 15% less
            let nearest = typeof getNearestEnemyFromPoint === 'function' ? getNearestEnemyFromPoint(player.x, player.y, 400) : null;
            if (nearest) {
                let dx = nearest.x - player.x, dy = nearest.y - player.y, dist = Math.hypot(dx,dy) || 1;
                projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*500, vy: (dy/dist)*500, radius: 8, color: '#fbc02d', life: 1.0, type: 'fireball', shape: 'fireball', damage: amount * 0.15 * 5, pierce: false, hitList: [], isEnemy: false });
            }
        }
    }

    let armor = player.armor;
    if (activeClass && activeClass.name === 'Paladin') {
        amount *= paladinDamageTakenMult(); // Bastion Dome, Plate of the Gilded Bastion
        armor *= paladinArmorMult();       // light shield while the hammer is away
    }
    if (!isContinuous) amount = Math.max(1, amount - armor);
    
    if (player.shield > 0) {
        if (player.shield >= amount) { player.shield -= amount; return; }
        else { amount -= player.shield; player.shield = 0; player.shieldTimer = 0; }
    }
    
    // Saint's Silk Shroud override
    if (activeClass && activeClass.name === 'Swordsaint' && equipment.armor && equipment.armor.name === "Saint's Silk Shroud") {
        if (player.stance === 'handheld') {
            player.flow = Math.min(player.maxFlow, player.flow + player.maxFlow * 0.05);
            player.flowGainTimer = 0;
        } else {
            player.flow = Math.min(player.maxFlow, player.flow + player.maxFlow * 0.025);
            if (Math.random() < 0.10) {
                if (!isContinuous) effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
                return;
            }
        }
    }

    player.hp -= amount;
    if (!isContinuous) player.hurtFlash = 0.2; // sprite hit flash
    if (!isContinuous && amount >= player.maxHp * 0.08) addShake(3);

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

        if ((e.type === 'boss_slime_queen' || e.type === 'boss_valerius') && !isEndlessMode) {
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
        
        if (activeClass && activeClass.name === 'Cleric' && buffs.aspectOfReaper > 0) {
            let missingHp = player.maxHp - player.hp;
            player.hp += missingHp * 0.25;
            effects.push({ type: 'text', text: '+HP', x: player.x, y: player.y - 30, color: '#69f0ae', life: 0.8, maxLife: 0.8 });
        }

        if (activeClass.name === 'Dragonknight' && equipment.armor && equipment.armor.name === 'Dragon Scale Plate') player.hp = Math.min(player.maxHp, player.hp + 5);

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
        
        if (activeClass.name === 'Machinist' && Math.random() < 0.25) {
            drops.push({ x: e.x, y: e.y, type: 'scrap', radius: 10, life: 15.0 });
        }
        
        gainXP(e.xp); // the corpse is removed from `enemies` by removeDeadEnemies()
        activeEnemies--; score++; updateHUD();

        if (enemiesToSpawn <= 0 && activeEnemies <= 0) {
            collectAllDrops();
            if (gameState === STATE.PLAYING) { 
                gameState = STATE.INTERMISSION; el('intermission-title').innerText = isBossWave ? "Boss Defeated!" : "Wave Cleared"; el('btn-shop').classList.toggle('hidden', !isBossWave); el('intermission-screen').classList.remove('hidden');
            }
        }
    }
}

function collectAllDrops() {
    for (const d of drops) {
        if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
        else if (d.type === 'dmg') { player.bonusDmg += 0.05; } 
        else if (d.type === 'gold') { player.gold += d.val; } 
        else if (d.type === 'item') { inventory.push(d.itemData); }
        else if (d.type === 'scrap') { player.hp = Math.min(player.maxHp, player.hp + 5); for(let i=1; i<=4; i++) cooldowns[`s${i}`] = Math.max(0, cooldowns[`s${i}`] - 0.5); }
    } drops.length = 0; updateHUD();
}