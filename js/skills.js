// ==========================================
// skills.js - Class Abilities & Attacks
// ==========================================

function castBasic() {
    const ANIM_LOCK = 0.15;
    let gloveBonus = equipment.gloves ? equipment.gloves.val : 0; 
    if (activeClass && activeClass.name === 'Swordsaint' && equipment.gloves && equipment.gloves.name === 'Aether Grips') {
        gloveBonus += 0.3; // +30% attack speed
    }
    let stanceBonus = (activeClass && activeClass.name === 'Swordsaint' && player.stance === 'airborne') ? (player.flow / player.maxFlow) * 0.5 : 0; // up to +50% atk speed in airborne

    cooldowns.basic = devNoCooldowns ? 0 : ANIM_LOCK + ((activeClass.basicAttackCD * getCDR()) / (1.0 + gloveBonus + stanceBonus));
    let dmg = calcDmg(activeClass.basicDmg, 1);
    
    let isResonance = false;
    if (activeClass.name === 'Spellweaver' && player.arcaneResonance) { 
        isResonance = true; 
        player.arcaneResonance = false; 
        dmg *= 1.5; 
    }

    window.BasicAttackRegistry[activeClass.weapon](dmg, isResonance);
    if (typeof updateHUD === "function") updateHUD();
}

var SkillRegistry = {
    'Swordsaint': {
        1: (sk, dmg) => { // Parry Thrust / Blade Surge
            if (player.stance === 'handheld') {
                player.parryTimer = 0.5; // active parry frames handled in combat
                player.parryDamage = dmg * 2; // used for counter
                player.parrySkill = sk;
            } else {
                let ab = player.airborneBlade;
                let target = getNearestEnemyFromPoint(mouseX, mouseY, 300);
                if (target) {
                    ab.x = target.x; ab.y = target.y; // instant surge onto target
                    effects.push({ type: 'slash', x: target.x, y: target.y, radius: 80, angle: 0, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                    applyDamage(target, dmg * 1.5, 'slash');
                    // Chaining Surge (Path B handled in enemies death logic later or right here if killed) Wait, path B triggers "on kill/completion". 
                    // Let's implement immediate chain if it dies, or just chain anyway.
                    if (sk.selectedUpg === 'B') {
                        let chained = 0; let delay = 200;
                        let lastTarget = target;
                        for(let i=0; i<3; i++) {
                            setTimeout(() => {
                                if (gameState !== STATE.PLAYING) return;
                                let nextT = getNearestEnemyFromPoint(lastTarget.x, lastTarget.y, 250);
                                if (nextT) {
                                    ab.x = nextT.x; ab.y = nextT.y;
                                    effects.push({ type: 'slash', x: nextT.x, y: nextT.y, radius: 80, angle: 0, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                                    applyDamage(nextT, dmg * 1.5, 'slash');
                                    lastTarget = nextT;
                                }
                            }, delay);
                            delay += 200;
                        }
                    }
                }
            }
        },
        2: (sk, dmg) => { // Deploy / Recall (Toggle)
            if (player.stance === 'handheld') {
                player.stance = 'airborne';
                if (sk.selectedUpg === 'B') player.flow = Math.min(player.maxFlow, player.flow + (player.maxFlow * 0.30));
            } else {
                player.stance = 'handheld';
                player.airborneBlade.x = player.x; player.airborneBlade.y = player.y;
                if (sk.selectedUpg === 'A') player.iFrames = 0.5;
                
                // Unique Weapon logic: Detonate Residual Blades
                if (equipment.weapon && equipment.weapon.name === 'Shattered Reality') {
                    for (let i = effects.length - 1; i >= 0; i--) {
                        if (effects[i].type === 'residual_blade') {
                            effects.push({ type: 'slash', x: effects[i].x, y: effects[i].y, radius: 100, angle: 0, color: '#00bcd4', life: 0.15, maxLife: 0.15 });
                            for (let e of enemies) {
                                if (Math.hypot(e.x - effects[i].x, e.y - effects[i].y) < 100 + e.size/2) {
                                    applyDamage(e, activeClass.skills[2].baseDmg * 2 + player.bonusDmg, 'slash');
                                }
                            }
                            effects[i].life = 0; // Destroy
                        }
                    }
                }
            }
        },
        3: (sk, dmg) => { // Shadow Step / Spatial Swap
            if (player.stance === 'handheld') {
                const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let moveDist = Math.min(dist, equipment.boots && equipment.boots.name === 'Windwalker Steps' ? 400 : 300);
                
                if (sk.selectedUpg === 'A') {
                    // Leaves phantom
                    player.phantomDecoy = { x: player.x, y: player.y, life: 3.0 }; 
                    effects.push({ type: 'circle', x: player.x, y: player.y, radius: player.radius, color: 'rgba(0, 188, 212, 0.4)', life: 3.0, maxLife: 3.0 });
                }
                player.x += (dx/dist)*moveDist; player.y += (dy/dist)*moveDist; clampToBounds(player, player.radius);
                player.iFrames = 0.3;
            } else {
                // Swap places with Airborne Blade
                let tmpX = player.x; let tmpY = player.y;
                player.x = player.airborneBlade.x; player.y = player.airborneBlade.y;
                player.airborneBlade.x = tmpX; player.airborneBlade.y = tmpY;
                effects.push({ type: 'line', x1: tmpX, y1: tmpY, x2: player.x, y2: player.y, color: '#00bcd4', life: 0.2, maxLife: 0.2, lineWidth: 4 });
                if (sk.selectedUpg === 'B') cooldowns.s1 = 0; // Reset Q (Blade Surge)
            }
        },
        4: (sk, dmg) => { // Blade Whirlwind / Shatter Storm
            if (player.stance === 'handheld') {
                effects.push({ type: 'slash', x: player.x, y: player.y, radius: 200, angle: 0, color: '#00e5ff', life: 0.3, maxLife: 0.3 });
                effects.push({ type: 'slash', x: player.x, y: player.y, radius: 200, angle: Math.PI, color: '#00e5ff', life: 0.3, maxLife: 0.3 });
                for(let i=enemies.length-1; i>=0; i--) {
                    let e = enemies[i];
                    if (Math.hypot(player.x - e.x, player.y - e.y) < 200 + e.size/2) {
                        applyDamage(e, dmg, 'slash');
                        if (sk.selectedUpg === 'A') {
                            let [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
                            e.x += (edx/edist) * Math.min(edist, 100); e.y += (edy/edist) * Math.min(edist, 100);
                        }
                    }
                }
            } else {
                let ab = player.airborneBlade;
                let isPierce = sk.selectedUpg === 'B';
                for(let i=0; i<8; i++) {
                    let ang = (Math.PI*2 / 8) * i;
                    projectiles.push({ x: ab.x, y: ab.y, vx: Math.cos(ang)*800, vy: Math.sin(ang)*800, radius: 5, color: '#18ffff', life: 1.5, type: isPierce ? 'pierce' : 'basic', shape: 'knife', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false });
                }
            }
        }
    },
    'Dragonknight': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*600, vy: (dy/dist)*600, radius: 14, color: '#e0e0e0', life: 2.0, type: 'shield_throw', shape: 'shield', damage: dmg, pierce: true, hitList: [], isEnemy: false, returning: false, sourceSkill: sk, startX: player.x, startY: player.y });
        },
        2: (sk, dmg) => {
            player.shield += 50; player.shieldTimer = 5.0;
            effects.push({ type: 'iron_bulwark', x: player.x, y: player.y, radius: 120, color: '#78909c', life: 0.5, maxLife: 0.5 });
            if (sk.selectedUpg === 'A') {
                for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 120 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'melee');
            }
            if (sk.selectedUpg === 'B') { buffs.msBoost = 2.0; player.frenzyStacks = Math.min(10, player.frenzyStacks + 3); }
        },
        3: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 400); player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            if (sk.selectedUpg === 'A') {
                const tx = player.x; const ty = player.y;
                effects.push({ type: 'circle', x: tx, y: ty, radius: 100, color: 'rgba(229, 57, 53, 0.3)', life: 1.0, maxLife: 1.0, isWarning: true });
                setTimeout(() => {
                    if (gameState !== STATE.PLAYING) return;
                    effects.push({ type: 'crater', x: tx, y: ty, radius: 100, color: '#e53935', life: 0.5, maxLife: 0.5 });
                    for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 100 + enemies[i].size/2) applyDamage(enemies[i], dmg*1.5, 'melee');
                }, 1000);
            } else if (sk.selectedUpg === 'B') {
                for(let r=0; r<4; r++) { const angle = (Math.PI*2/4) * r; projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*500, vy: Math.sin(angle)*500, radius: 8, color: '#ffca28', life: 1.0, type: 'basic', damage: dmg, pierce: false, isEnemy: false }); }
            }
            effects.push({ type: 'crater', x: player.x, y: player.y, radius: 80, color: '#ef5350', life: 0.5, maxLife: 0.5 });
            for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'melee');
        },
        4: (sk, dmg) => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let color = sk.selectedUpg === 'A' ? '#2196f3' : '#ff5722';
            let count = 0;
            let breathInt = setInterval(() => {
                if (gameState !== STATE.PLAYING || count > 20) { clearInterval(breathInt); return; }
                let spread = attackAngle + (Math.random() - 0.5) * 0.8;
                projectiles.push({ x: player.x + Math.cos(spread)*20, y: player.y + Math.sin(spread)*20, vx: Math.cos(spread)*700, vy: Math.sin(spread)*700, radius: 15 + Math.random()*15, color: color, life: 0.6, type: 'pierce', shape: 'fireball', damage: dmg * 0.25, pierce: true, hitList: [], isEnemy: false });
                count++;
            }, 50);
            
            if (sk.selectedUpg === 'A') {
                for(let i=enemies.length-1; i>=0; i--) {
                    if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 400 + enemies[i].size/2) {
                        let diff = Math.atan2(enemies[i].y-player.y, enemies[i].x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                        if (Math.abs(diff) <= 0.4) enemies[i].frozenTimer = 3.0; 
                    }
                }
            } else if (sk.selectedUpg === 'B') {
                for(let i=enemies.length-1; i>=0; i--) {
                    if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 400 + enemies[i].size/2 && enemies[i].shieldHp > 0) {
                        let diff = Math.atan2(enemies[i].y-player.y, enemies[i].x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                        if (Math.abs(diff) <= 0.4) enemies[i].shieldHp = 0; 
                    }
                }
            }
        },
        'rmb': () => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            effects.push({ type: 'slash', x: player.x, y: player.y, radius: 150, angle: attackAngle, color: '#2196f3', life: 0.25, maxLife: 0.25 });
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= 150 + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    if (Math.abs(diff) <= (Math.PI/1.5)/2) applyDamage(e, calcDmg(80), 'melee');
                }
            }
        }
    },
    'Spellweaver': {
        1: (sk, dmg) => {
            player.arcaneResonance = true; 
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const staffTipX = player.x + Math.cos(angle) * 45; const staffTipY = player.y + Math.sin(angle) * 45;
            const [dx, dy, dist] = getVector(staffTipX, staffTipY, mouseX, mouseY);
            let speed = sk.selectedUpg === 'A' ? 800 : 500;
            if(dist>0) projectiles.push({ x: staffTipX, y: staffTipY, vx: (dx/dist)*speed, vy: (dy/dist)*speed, radius: 12, color: '#ff5722', life: 2.0, type: 'fireball', shape: 'fireball', damage: dmg, pierce: false, isEnemy: false, sourceSkill: sk });
        },
        2: (sk, dmg) => {
            player.arcaneResonance = true; 
            let spikes = [];
            for(let k=0; k<15; k++) {
                let dist = Math.random() * 180;
                let ang = Math.random() * Math.PI * 2;
                spikes.push({ xOffset: Math.cos(ang)*dist, yOffset: Math.sin(ang)*dist, size: 10 + Math.random()*15 });
            }
            effects.push({ type: 'random_ice_spikes', x: player.x, y: player.y, radius: 180, color: '#81d4fa', life: 0.6, maxLife: 0.6, spikes: spikes });
            if (sk.selectedUpg === 'B') { player.shield += 40; player.shieldTimer = 5.0; }
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 180 + enemies[i].size/2) { applyDamage(enemies[i], dmg, 'magic'); if(sk.selectedUpg === 'A') enemies[i].speed = 0; enemies[i].frozenTimer = 3.0; }
            }
        },
        3: (sk, dmg) => {
            player.arcaneResonance = true; const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 350); const startX = player.x; const startY = player.y;
            effects.push({ type: 'sparkle_poof', x: player.x, y: player.y, radius: player.radius, color: player.color, life: 0.3, maxLife: 0.3 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*700, vy: (ty/td)*700, radius: 8, color: '#e040fb', life: 1.5, type: 'basic', shape: 'fireball', damage: calcDmg(30), pierce: false, isEnemy: false });
                }
            }
            if (sk.selectedUpg === 'B') {
                effects.push({ type: 'random_ice_spikes', x: startX, y: startY, radius: 100, color: '#81d4fa', life: 0.4, maxLife: 0.4, spikes: [{xOffset: 0, yOffset: 0, size: 25}, {xOffset: 20, yOffset: 20, size: 15}, {xOffset: -20, yOffset: -20, size: 15}] });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(startX-enemies[i].x, startY-enemies[i].y) <= 100 + enemies[i].size/2) { applyDamage(enemies[i], dmg, 'magic'); enemies[i].frozenTimer = 2.0; } }
            }
        },
        4: (sk, dmg) => {
            player.arcaneResonance = true;
            const tx = Math.max(currentMap.left, Math.min(currentMap.right, mouseX)); 
            const ty = Math.max(currentMap.top, Math.min(currentMap.bottom, mouseY)); 
            let delay = sk.selectedUpg === 'A' ? 0.75 : 1.0;
            effects.push({ type: 'circle', x: tx, y: ty, radius: 150, color: '#ff5722', life: delay, maxLife: delay, isWarning: true, outlineOnly: true });
            effects.push({ type: 'meteor_drop', x: tx, y: ty, radius: 40, color: '#ff5722', life: delay, maxLife: delay });
            
            setTimeout(() => {
                if(gameState!==STATE.PLAYING) return;
                effects.push({ type: 'fiery_explosion', x: tx, y: ty, radius: 150, life: 0.5, maxLife: 0.5 });
                effects.push({ type: 'crater', x: tx, y: ty, radius: 150, color: '#ff5722', life: 0.6, maxLife: 0.6 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 150 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'magic'); }
                if (sk.selectedUpg === 'B') {
                    effects.push({ type: 'circle', x: tx, y: ty, radius: 80, color: '#ff9800', life: 1.5, maxLife: 1.5, isWarning: true, outlineOnly: true });
                    effects.push({ type: 'meteor_drop', x: tx, y: ty, radius: 20, color: '#ff9800', life: 1.5, maxLife: 1.5 });
                    setTimeout(() => {
                        if(gameState!==STATE.PLAYING) return;
                        effects.push({ type: 'fiery_explosion', x: tx, y: ty, radius: 80, life: 0.5, maxLife: 0.5 });
                        effects.push({ type: 'crater', x: tx, y: ty, radius: 80, color: '#ff9800', life: 0.4, maxLife: 0.4 });
                        for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg*0.5, 'magic'); }
                    }, 1500);
                }
            }, delay * 1000);
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x); const endX = player.x + Math.cos(angle) * 500; const endY = player.y + Math.sin(angle) * 500;
            effects.push({ type: 'line', x1: player.x, y1: player.y, x2: endX, y2: endY, color: '#2196f3', life: 0.3, maxLife: 0.3 });
            const l2 = 500*500;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i]; let t = ((e.x - player.x) * (endX - player.x) + (e.y - player.y) * (endY - player.y)) / l2; t = Math.max(0, Math.min(1, t));
                const projX = player.x + t * (endX - player.x); const projY = player.y + t * (endY - player.y);
                if (Math.hypot(e.x - projX, e.y - projY) < e.size/2 + 20) applyDamage(e, calcDmg(120), 'magic');
            }
        }
    },
    'Ranger': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY); let bounces = sk.selectedUpg === 'A' ? 5 : 3; 
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*900, vy: (dy/dist)*900, radius: 6, color: '#ffeb3b', life: 3.0, type: 'ricochet', shape: 'arrow', damage: dmg, pierce: false, isEnemy: false, bounces: bounces, hitList: [], sourceSkill: sk });
        },
        2: (sk, dmg) => {
            let healAmt = sk.selectedUpg === 'A' ? 30 : 15; player.hp = Math.min(player.maxHp, player.hp + healAmt); buffs.msBoost = sk.selectedUpg === 'B' ? 4.0 : 2.0;
            effects.push({ type: 'wind_swirl', x: player.x, y: player.y, radius: 60, color: '#4caf50', life: 0.6, maxLife: 0.6 }); updateHUD();
        },
        3: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, sk.selectedUpg === 'B' ? 500 : 300);
            effects.push({ type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x + (dx/dist)*moveDist, y2: player.y + (dy/dist)*moveDist, color: '#81c784', life: 0.3, maxLife: 0.3 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*1200, vy: (ty/td)*1200, radius: 8, color: '#00e676', life: 1.5, type: 'basic', shape: 'arrow', damage: dmg, pierce: false, isEnemy: false });
                }
            }
        },
        4: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const count = sk.selectedUpg === 'B' ? 4 : 2; const pierce = sk.selectedUpg === 'A';
            for(let i = -count; i <= count; i++) {
                const angle = baseAngle + (i * 0.15);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*1000, vy: Math.sin(angle)*1000, radius: 6, color: '#e0e0e0', life: 1.5, type: pierce?'pierce':'basic', shape: 'arrow', damage: dmg, pierce: pierce, hitList: [], isEnemy: false });
            }
        },
        'rmb': () => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            for(let i = -1; i <= 1; i++) projectiles.push({ x: player.x, y: player.y, vx: Math.cos(baseAngle+(i*0.2))*1500, vy: Math.sin(baseAngle+(i*0.2))*1500, radius: 8, color: '#2196f3', life: 1.5, type: 'pierce', shape: 'arrow', damage: calcDmg(60), pierce: true, hitList: [], isEnemy: false });
        }
    },
    'Nightblade': {
        1: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let count = 5; let pierce = sk.selectedUpg === 'A'; let returnDmg = sk.selectedUpg === 'B';
            for(let i=0; i<count; i++) {
                let angle = baseAngle - 0.4 + (i * 0.2);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*800, vy: Math.sin(angle)*800, radius: 5, color: '#e1bee7', life: 1.0, type: pierce?'pierce':'fan_of_knives', shape: 'knife', damage: dmg, pierce: pierce, hitList: [], isEnemy: false, source: 'fan_of_knives', returning: false, returnDmg: returnDmg });
            }
        },
        2: (sk, dmg) => {
            let radius = sk.selectedUpg === 'B' ? 250 : 150; let poison = sk.selectedUpg === 'A';
            let particles = [];
            for (let i = 0; i < 20; i++) {
                particles.push({
                    xOffset: (Math.random() - 0.5) * radius * 0.8,
                    yOffset: (Math.random() - 0.5) * radius * 0.8,
                    r: radius * (0.3 + Math.random() * 0.5),
                    rotSpeed: (Math.random() - 0.5) * 1.5,
                    startAng: Math.random() * Math.PI * 2
                });
            }
            let smokeColor = poison ? 'rgba(76, 175, 80, 0.7)' : 'rgba(80, 80, 80, 0.7)';
            effects.push({ type: 'smoke_bomb', x: player.x, y: player.y, radius: radius, color: smokeColor, life: 5.0, maxLife: 5.0, poison: poison, dmg: dmg, particles: particles });
            if (sk.selectedUpg === 'B') { buffs.slowed = 0; buffs.rooted = 0; }
        },
        3: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let moveDist = sk.selectedUpg === 'A' ? Math.min(dist, 600) : Math.min(dist, 300);
            let pDashAngle = Math.atan2(dy, dx);
            effects.push({ type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x + (dx/dist)*moveDist, y2: player.y + (dy/dist)*moveDist, color: '#9c27b0', life: 0.2, maxLife: 0.2 });
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (distToSegment(e.x, e.y, player.x, player.y, player.x + (dx/dist)*moveDist, player.y + (dy/dist)*moveDist) < e.size/2 + 20) applyDamage(e, dmg, 'phantom_dash', pDashAngle);
            }
            player.x += (dx/dist)*moveDist; player.y += (dy/dist)*moveDist; clampToBounds(player, player.radius);
            player.iFrames = 0.4; 
            if (sk.selectedUpg === 'B') {
                if (!player.phantomChargeUsed) { player.phantomChargeUsed = true; cooldowns.s3 = 0.5; } 
                else { player.phantomChargeUsed = false; }
            }
        },
        4: (sk, dmg) => {
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: 600, color: 'rgba(74, 20, 140, 0.4)', life: 0.5, maxLife: 0.5 });
            let targets = enemies.filter(e => Math.hypot(player.x - e.x, player.y - e.y) <= 600);
            targets.forEach(e => e.markAngle = Math.random() * Math.PI * 2);
            buffs.deathMarkActive = 5.0;
            targets.forEach((target, index) => {
                let delay = Math.min(index * 80, 1500); 
                setTimeout(() => {
                    if (gameState !== STATE.PLAYING || target.hp <= 0 || target.dead) return;
                    let markAng = target.markAngle !== undefined ? target.markAngle : Math.random() * Math.PI * 2;
                    let startX = target.x + Math.cos(markAng) * 200;
                    let startY = target.y + Math.sin(markAng) * 200;
                    let dashAngle = Math.atan2(target.y - startY, target.x - startX);
                    effects.push({ type: 'thrust_edge', x: startX, y: startY, x2: target.x, y2: target.y, angle: dashAngle, color: '#e1bee7', life: 0.2, maxLife: 0.2 });
                    let ultDmg = dmg * 3; 
                    if (sk.selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.05);
                    applyDamage(target, ultDmg, 'assassin_skill', dashAngle);
                }, delay);
            });
        },
        'rmb': () => {
            let target = getNearestEnemyFromPoint(mouseX, mouseY, 150);
            if (!target) target = getNearestEnemyFromPoint(player.x, player.y, 400);
            if (target) {
                let execAngle = Math.atan2(target.y - player.y, target.x - player.x);
                effects.push({ type: 'thrust_edge', x: player.x, y: player.y, x2: target.x, y2: target.y, angle: execAngle, color: '#4a148c', life: 0.2, maxLife: 0.2 });
                player.x = target.x - 20; player.y = target.y - 20; clampToBounds(player, player.radius);
                applyDamage(target, calcDmg(150), 'execute', execAngle);
                if (target.hp <= 0 || target.dead) cooldowns.rmb = 0;
            }
        }
    },
    'Machinist': {
        1: (sk, dmg) => {
            const tx = mouseX; const ty = mouseY;
            let isLaser = sk.selectedUpg === 'A';
            let isVolatile = sk.selectedUpg === 'B';
            projectiles.push({
                x: tx, y: ty, vx: 0, vy: 0, radius: 12, color: '#ff9800', life: 10.0, type: 'turret', damage: dmg, isEnemy: false, volatile: isVolatile, isLaser: isLaser, attackTimer: 0, angle: 0,
                customUpdate: function(dt, p) {
                    this.attackTimer -= dt * (buffs.overclockTimer > 0 ? 2.0 : 1.0);
                    let target = getNearestEnemyFromPoint(this.x, this.y, 500);
                    if (target) {
                        this.angle = Math.atan2(target.y - this.y, target.x - this.x);
                        if (this.attackTimer <= 0) {
                            if (this.isLaser) {
                                effects.push({ type: 'line', x1: this.x, y1: this.y, x2: target.x, y2: target.y, color: '#ff9800', life: 0.2, maxLife: 0.2, lineWidth: 4 });
                                applyDamage(target, this.damage * 1.5, 'magic');
                                this.attackTimer = 1.0;
                            } else {
                                projectiles.push({ x: this.x + Math.cos(this.angle)*15, y: this.y + Math.sin(this.angle)*15, vx: Math.cos(this.angle)*800, vy: Math.sin(this.angle)*800, radius: 4, color: '#ffb74d', life: 1.5, type: 'basic', shape: 'bullet', damage: this.damage, pierce: false, isEnemy: false });
                                this.attackTimer = 0.4;
                            }
                        }
                    }
                }
            });
        },
        2: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let tx = player.x + (dx/dist)*Math.min(dist, 400); let ty = player.y + (dy/dist)*Math.min(dist, 400);
            let isRoot = sk.selectedUpg === 'A'; let isNetwork = sk.selectedUpg === 'B';
            projectiles.push({
                x: tx, y: ty, vx: 0, vy: 0, radius: 15, color: '#00e5ff', life: 8.0, type: 'tesla_coil_trap', damage: dmg, isEnemy: false, tickTimer: 0,
                customUpdate: function(dt, p) {
                    this.tickTimer -= dt;
                    if (this.tickTimer <= 0) {
                        effects.push({ type: 'circle', x: this.x, y: this.y, radius: isRoot ? 200 : 150, color: 'rgba(0, 229, 255, 0.2)', life: 0.2, maxLife: 0.2 });
                        for (let i = enemies.length - 1; i >= 0; i--) {
                            let e = enemies[i];
                            if (Math.hypot(e.x - this.x, e.y - this.y) < (isRoot ? 200 : 150) + e.size/2) {
                                applyDamage(e, this.damage, 'magic');
                                e.shockTimer = 0.6;
                                if (isRoot && !e.teslaRooted) { e.frozenTimer = 1.0; e.teslaRooted = true; }
                            }
                        }
                        if (isNetwork) {
                            for (let t of projectiles) {
                                if (t.type === 'turret' && Math.hypot(t.x - this.x, t.y - this.y) < 400) {
                                    effects.push({ type: 'lightning', x1: this.x, y1: this.y, x2: t.x, y2: t.y, color: '#00e5ff', life: 0.2, maxLife: 0.2 });
                                    for(let i = enemies.length - 1; i >= 0; i--) { 
                                        let e = enemies[i];
                                        if (distToSegment(e.x, e.y, this.x, this.y, t.x, t.y) < e.size/2 + 20) applyDamage(e, this.damage * 2, 'magic'); 
                                    }
                                }
                            }
                        }
                        this.tickTimer = 0.5;
                    }
                }
            });
        },
        3: (sk, dmg) => {
            let targetX = mouseX; let targetY = mouseY;
            let foundTarget = false;
            for (let p of projectiles) {
                if ((p.type === 'turret' || p.type === 'tesla_coil_trap') && Math.hypot(p.x - mouseX, p.y - mouseY) < 50) {
                    targetX = p.x; targetY = p.y; foundTarget = true; break;
                }
            }
            if (!foundTarget) cooldowns.s3 += 2.0; 
            
            if (sk.selectedUpg === 'A') { player.shield += 100; player.shieldTimer = 4.0; }
            if (sk.selectedUpg === 'B') {
                let decoyX = player.x; let decoyY = player.y;
                effects.push({ type: 'circle', x: decoyX, y: decoyY, radius: player.radius, color: 'rgba(255, 152, 0, 0.5)', life: 2.0, maxLife: 2.0 });
                for(let e of enemies) {
                    if (Math.hypot(e.x - decoyX, e.y - decoyY) < 300 && !e.type.startsWith('boss')) { e.x += (decoyX - e.x)*0.05; e.y += (decoyY - e.y)*0.05; }
                }
            }
            
            effects.push({ type: 'grapple_chain', x1: player.x, y1: player.y, x2: targetX, y2: targetY, color: '#9e9e9e', life: 0.3, maxLife: 0.3 });
            player.x = targetX; player.y = targetY; clampToBounds(player, player.radius);
            player.iFrames = 0.3;
        },
        4: (sk, dmg) => {
            buffs.overclockTimer = 6.0;
            for(let p of projectiles) { if (p.type === 'turret' || p.type === 'tesla_coil_trap') p.life = p.type === 'turret' ? 10.0 : 8.0; }
            if (sk.selectedUpg === 'B') {
                SkillRegistry['Machinist'][1]({ selectedUpg: activeClass.skills[1].selectedUpg }, calcDmg(activeClass.skills[1].baseDmg));
                mouseX += 40; SkillRegistry['Machinist'][1]({ selectedUpg: activeClass.skills[1].selectedUpg }, calcDmg(activeClass.skills[1].baseDmg));
            }
            if (sk.selectedUpg === 'A') {
                setTimeout(() => {
                    if (gameState !== STATE.PLAYING) return;
                    for (let p of projectiles) {
                        if (p.type === 'turret' || p.type === 'tesla_coil_trap') {
                            p.life = 0; p.volatile = true; p.damage = dmg * 3;
                        }
                    }
                }, 6000);
            }
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            for(let i=0; i<3; i++) {
                let tx = player.x + Math.cos(angle - 0.4 + i*0.4) * 200;
                let ty = player.y + Math.sin(angle - 0.4 + i*0.4) * 200;
                projectiles.push({ x: tx, y: ty, vx: 0, vy: 0, radius: 10, color: '#f44336', life: 10.0, type: 'trap_throw', damage: calcDmg(100), isEnemy: false });
            }
        }
    }
};

var BasicAttackRegistry = {
    'phantom_blade': (dmg) => {
        if (player.stance === 'handheld') {
            // Handheld flow damage bonus: up to +50% dmg based on flow
            dmg *= 1.0 + (player.flow / Math.max(1, player.maxFlow)) * 0.5;

            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            effects.push({ type: 'slash', x: player.x, y: player.y, radius: 100, angle: attackAngle, color: '#00e5ff', life: 0.15, maxLife: 0.15 }); 
            let hitAnything = false;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= 100 + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    if (Math.abs(diff) <= (Math.PI/1.5)/2) { 
                        applyDamage(e, dmg, 'slash'); 
                        hitAnything = true;
                    }
                }
            }
            if (hitAnything) {
                let flowGain = 10;
                if (equipment.gloves && equipment.gloves.name === 'Aether Grips') flowGain *= 1.1; // +10% more Flow
                player.flow = Math.min(player.maxFlow, player.flow + flowGain);
            }
        } else if (player.stance === 'airborne') {
            player.airborneBlade.overrideX = mouseX;
            player.airborneBlade.overrideY = mouseY;
        }
    },
    'sword': (dmg) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        effects.push({ type: 'slash', x: player.x, y: player.y, radius: 110, angle: attackAngle, color: '#e0e0e0', life: 0.15, maxLife: 0.15 }); 
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= 110 + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= (Math.PI/1.5)/2) { applyDamage(e, dmg, 'melee_basic'); if (equipment.gloves && equipment.gloves.name === 'Titan Gauntlets') { e.x += Math.cos(attackAngle) * 30; e.y += Math.sin(attackAngle) * 30; clampToBounds(e, e.size/2); } }
            }
        }
    },
    'staff': (dmg, isResonance) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        const staffTipX = player.x + Math.cos(angle) * 45; const staffTipY = player.y + Math.sin(angle) * 45;
        const [dx, dy, dist] = getVector(staffTipX, staffTipY, mouseX, mouseY);
        if (dist > 0) {
            let isPierce = (equipment.armor && equipment.armor.name === 'Robes of the Magi');
            projectiles.push({ x: staffTipX, y: staffTipY, vx: (dx/dist)*700, vy: (dy/dist)*700, radius: 6, color: isResonance ? '#2196f3' : '#ffca28', life: 1.5, type: isPierce ? 'pierce' : 'fireball', shape: 'fireball', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false, resonance: isResonance });
        }
    },
    'bow': (dmg) => {
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        if (dist > 0) {
            let isPierce = (equipment.gloves && equipment.gloves.name === "Sniper's Grips"); let numArrows = (equipment.amulet && equipment.amulet.name === 'Pendant of the Hunt') ? 2 : 1; const baseAngle = Math.atan2(dy, dx);
            for(let i=0; i<numArrows; i++) { let angle = numArrows > 1 ? baseAngle - 0.1 + (i*0.2) : baseAngle; projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*700, vy: Math.sin(angle)*700, radius: 4, color: '#e0e0e0', life: 1.5, type: isPierce ? 'pierce' : 'basic', shape: 'arrow', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false, resonance: false }); }
        }
    },
    'dagger': (dmg, isResonance) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let closest = getNearestEnemyFromPoint(player.x, player.y, 50);
        let dashDist1 = closest ? 0 : 30;
        player.x += Math.cos(angle) * dashDist1; player.y += Math.sin(angle) * dashDist1; clampToBounds(player, player.radius);
        
        let startX1 = player.x + Math.cos(angle - 0.4)*20; let startY1 = player.y + Math.sin(angle - 0.4)*20;
        let endX1 = startX1 + Math.cos(angle) * 90; let endY1 = startY1 + Math.sin(angle) * 90;
        effects.push({ type: 'thrust_edge', x: startX1, y: startY1, x2: endX1, y2: endY1, angle: angle, color: '#9c27b0', life: 0.15, maxLife: 0.15 });
        
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (distToSegment(e.x, e.y, startX1, startY1, endX1, endY1) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
        }
        
        setTimeout(() => {
            if (gameState !== STATE.PLAYING) return;
            closest = getNearestEnemyFromPoint(player.x, player.y, 50);
            let dashDist2 = closest ? 0 : 15;
            player.x += Math.cos(angle) * dashDist2; player.y += Math.sin(angle) * dashDist2; clampToBounds(player, player.radius);
            
            let startX2 = player.x + Math.cos(angle + 0.4)*20; let startY2 = player.y + Math.sin(angle + 0.4)*20;
            let endX2 = startX2 + Math.cos(angle) * 90; let endY2 = startY2 + Math.sin(angle) * 90;
            effects.push({ type: 'thrust_edge', x: startX2, y: startY2, x2: endX2, y2: endY2, angle: angle, color: '#e1bee7', life: 0.15, maxLife: 0.15 });
            
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (distToSegment(e.x, e.y, startX2, startY2, endX2, endY2) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
            }
        }, 150);
    },
    'scattergun': (dmg) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let isPierce = buffs.overclockTimer > 0;
        for(let i=-2; i<=2; i++) {
            let spreadAngle = angle + (i*0.1);
            projectiles.push({ x: player.x, y: player.y, vx: Math.cos(spreadAngle)*900, vy: Math.sin(spreadAngle)*900, radius: 4, color: '#ffb74d', life: 0.4, type: 'scattergun', shape: 'bullet', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false });
        }
    }
};