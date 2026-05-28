// ==========================================
// registries.js - Content & Mechanics
// ==========================================

function getBladeConsumeMult() {
    if (!player.blade) return 1.0;
    let mult = 1.0 + (player.blade.charges * 0.2);
    player.blade.charges = 0;
    return mult;
}

window.spawnBladeDrop = function(x, y, dmg) {
    projectiles.push({ x: x, y: y - 500, vx: 0, vy: 2000, radius: 10, color: '#00e5ff', life: 1.0, type: 'phantom_blade_drop', damage: dmg, targetY: y });
}

var SkillRegistry = {
    'Dragonknight': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*600, vy: (dy/dist)*600, radius: 14, color: '#e0e0e0', life: 2.0, type: 'shield_throw', damage: dmg, pierce: true, hitList: [], isEnemy: false, returning: false, sourceSkill: sk, startX: player.x, startY: player.y });
        },
        2: (sk, dmg) => {
            player.shield += 50; player.shieldTimer = 5.0;
            if (sk.selectedUpg === 'A') {
                effects.push({ type: 'circle', x: player.x, y: player.y, radius: 120, color: '#78909c', life: 0.3, maxLife: 0.3 });
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
                    effects.push({ type: 'circle', x: tx, y: ty, radius: 100, color: '#e53935', life: 0.3, maxLife: 0.3 });
                    for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 100 + enemies[i].size/2) applyDamage(enemies[i], dmg*1.5, 'melee');
                }, 1000);
            } else if (sk.selectedUpg === 'B') {
                for(let r=0; r<4; r++) { const angle = (Math.PI*2/4) * r; projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*500, vy: Math.sin(angle)*500, radius: 8, color: '#ffca28', life: 1.0, type: 'basic', damage: dmg, pierce: false, isEnemy: false }); }
            }
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: 80, color: '#ef5350', life: 0.3, maxLife: 0.3 });
            for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'melee');
        },
        4: (sk, dmg) => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let color = sk.selectedUpg === 'A' ? 'rgba(33, 150, 243, 0.7)' : 'rgba(255, 87, 34, 0.7)';
            effects.push({ type: 'cone', x: player.x, y: player.y, radius: 300, angle: attackAngle, spread: Math.PI/2.5, color: color, life: 0.25, maxLife: 0.25 });
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 300 + enemies[i].size/2) {
                    let diff = Math.atan2(enemies[i].y-player.y, enemies[i].x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    if (Math.abs(diff) <= (Math.PI/2.5)/2) {
                        if (sk.selectedUpg === 'A') enemies[i].frozenTimer = 3.0; 
                        if (sk.selectedUpg === 'B' && enemies[i].shieldHp > 0) enemies[i].shieldHp = 0; 
                        applyDamage(enemies[i], dmg, 'magic');
                    }
                }
            }
        },
        'rmb': () => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            effects.push({ type: 'cone', x: player.x, y: player.y, radius: 150, angle: attackAngle, spread: Math.PI/1.5, color: '#2196f3', life: 0.25, maxLife: 0.25 });
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
            player.arcaneResonance = true; const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let speed = sk.selectedUpg === 'A' ? 800 : 500;
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*speed, vy: (dy/dist)*speed, radius: 12, color: '#ff5722', life: 2.0, type: 'fireball', damage: dmg, pierce: false, isEnemy: false, sourceSkill: sk });
        },
        2: (sk, dmg) => {
            player.arcaneResonance = true; effects.push({ type: 'circle', x: player.x, y: player.y, radius: 180, color: '#81d4fa', life: 0.4, maxLife: 0.4 });
            if (sk.selectedUpg === 'B') { player.shield += 40; player.shieldTimer = 5.0; }
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 180 + enemies[i].size/2) { applyDamage(enemies[i], dmg, 'magic'); if(sk.selectedUpg === 'A') enemies[i].speed = 0; enemies[i].frozenTimer = 3.0; }
            }
        },
        3: (sk, dmg) => {
            player.arcaneResonance = true; const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 350); const startX = player.x; const startY = player.y;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: player.radius, color: player.color, life: 0.2, maxLife: 0.2 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*700, vy: (ty/td)*700, radius: 8, color: '#e040fb', life: 1.5, type: 'basic', damage: calcDmg(30), pierce: false, isEnemy: false });
                }
            }
            if (sk.selectedUpg === 'B') {
                effects.push({ type: 'circle', x: startX, y: startY, radius: 100, color: '#81d4fa', life: 0.3, maxLife: 0.3 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(startX-enemies[i].x, startY-enemies[i].y) <= 100 + enemies[i].size/2) { applyDamage(enemies[i], dmg, 'magic'); enemies[i].frozenTimer = 2.0; } }
            }
        },
        4: (sk, dmg) => {
            player.arcaneResonance = true;
            const tx = Math.max(currentMap.left, Math.min(currentMap.right, mouseX)); 
            const ty = Math.max(currentMap.top, Math.min(currentMap.bottom, mouseY)); 
            let delay = sk.selectedUpg === 'A' ? 0.75 : 1.0;
            effects.push({ type: 'circle', x: tx, y: ty, radius: 150, color: 'rgba(255, 87, 34, 0.3)', life: delay, maxLife: delay, isWarning: true });
            setTimeout(() => {
                if(gameState!==STATE.PLAYING) return;
                effects.push({ type: 'circle', x: tx, y: ty, radius: 150, color: '#ff5722', life: 0.4, maxLife: 0.4 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 150 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'magic'); }
                if (sk.selectedUpg === 'B') {
                    effects.push({ type: 'circle', x: tx, y: ty, radius: 80, color: 'rgba(255, 152, 0, 0.3)', life: 1.5, maxLife: 1.5, isWarning: true });
                    setTimeout(() => {
                        if(gameState!==STATE.PLAYING) return;
                        effects.push({ type: 'circle', x: tx, y: ty, radius: 80, color: '#ff9800', life: 0.3, maxLife: 0.3 });
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
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*900, vy: (dy/dist)*900, radius: 6, color: '#ffeb3b', life: 3.0, type: 'ricochet', damage: dmg, pierce: false, isEnemy: false, bounces: bounces, hitList: [], sourceSkill: sk });
        },
        2: (sk, dmg) => {
            let healAmt = sk.selectedUpg === 'A' ? 30 : 15; player.hp = Math.min(player.maxHp, player.hp + healAmt); buffs.msBoost = sk.selectedUpg === 'B' ? 4.0 : 2.0;
            effects.push({ type: 'circle', x: player.x, y: player.y, radius: 40, color: '#4caf50', life: 0.5, maxLife: 0.5 }); updateHUD();
        },
        3: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, sk.selectedUpg === 'B' ? 500 : 300);
            let steps = 10; for(let s=0; s<=steps; s++) effects.push({ type: 'circle', x: player.x + (dx/dist)*(moveDist*(s/steps)), y: player.y + (dy/dist)*(moveDist*(s/steps)), radius: player.radius, color: 'rgba(129, 199, 132, 0.4)', life: 0.2, maxLife: 0.2 });
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*1200, vy: (ty/td)*1200, radius: 8, color: '#00e676', life: 1.5, type: 'basic', damage: dmg, pierce: false, isEnemy: false });
                }
            }
        },
        4: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const count = sk.selectedUpg === 'B' ? 4 : 2; const pierce = sk.selectedUpg === 'A';
            for(let i = -count; i <= count; i++) {
                const angle = baseAngle + (i * 0.15);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*1000, vy: Math.sin(angle)*1000, radius: 6, color: '#e0e0e0', life: 1.5, type: pierce?'pierce':'basic', damage: dmg, pierce: pierce, hitList: [], isEnemy: false });
            }
        },
        'rmb': () => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            for(let i = -1; i <= 1; i++) projectiles.push({ x: player.x, y: player.y, vx: Math.cos(baseAngle+(i*0.2))*1500, vy: Math.sin(baseAngle+(i*0.2))*1500, radius: 8, color: '#2196f3', life: 1.5, type: 'pierce', damage: calcDmg(60), pierce: true, hitList: [], isEnemy: false });
        }
    },
    'Nightblade': {
        1: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let count = 5; let pierce = sk.selectedUpg === 'A'; let returnDmg = sk.selectedUpg === 'B';
            for(let i=0; i<count; i++) {
                let angle = baseAngle - 0.4 + (i * 0.2);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*800, vy: Math.sin(angle)*800, radius: 5, color: '#e1bee7', life: 1.0, type: pierce?'pierce':'fan_of_knives', damage: dmg, pierce: pierce, hitList: [], isEnemy: false, source: 'fan_of_knives', returning: false, returnDmg: returnDmg });
            }
        },
        2: (sk, dmg) => {
            let radius = sk.selectedUpg === 'B' ? 250 : 150; let poison = sk.selectedUpg === 'A';
            effects.push({ type: 'smoke_bomb', x: player.x, y: player.y, radius: radius, color: 'rgba(80, 80, 80, 0.7)', life: 5.0, maxLife: 5.0, poison: poison, dmg: dmg });
            if (sk.selectedUpg === 'B') { buffs.slowed = 0; buffs.rooted = 0; }
        },
        3: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let moveDist = sk.selectedUpg === 'A' ? Math.min(dist, 600) : Math.min(dist, 300);
            let pDashAngle = Math.atan2(dy, dx);
            effects.push({ type: 'line', x1: player.x, y1: player.y, x2: player.x + (dx/dist)*moveDist, y2: player.y + (dy/dist)*moveDist, color: '#9c27b0', life: 0.2, maxLife: 0.2 });
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
                    
                    effects.push({ type: 'line', x1: startX, y1: startY, x2: target.x, y2: target.y, color: '#e1bee7', life: 0.2, maxLife: 0.2, lineWidth: 8 });
                    effects.push({ type: 'circle', x: target.x, y: target.y, radius: 40, color: '#9c27b0', life: 0.2, maxLife: 0.2 });
                    
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
                effects.push({ type: 'line', x1: player.x, y1: player.y, x2: target.x, y2: target.y, color: '#4a148c', life: 0.2, maxLife: 0.2 });
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
                                projectiles.push({ x: this.x + Math.cos(this.angle)*15, y: this.y + Math.sin(this.angle)*15, vx: Math.cos(this.angle)*800, vy: Math.sin(this.angle)*800, radius: 4, color: '#ffb74d', life: 1.5, type: 'basic', damage: this.damage, pierce: false, isEnemy: false });
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
                        for (let e of enemies) {
                            if (Math.hypot(e.x - this.x, e.y - this.y) < (isRoot ? 200 : 150) + e.size/2) {
                                applyDamage(e, this.damage, 'magic');
                                e.speed = e.baseSpeed * 0.5;
                                if (isRoot && !e.teslaRooted) { e.frozenTimer = 1.0; e.teslaRooted = true; }
                            }
                        }
                        if (isNetwork) {
                            for (let t of projectiles) {
                                if (t.type === 'turret' && Math.hypot(t.x - this.x, t.y - this.y) < 400) {
                                    effects.push({ type: 'lightning', x1: this.x, y1: this.y, x2: t.x, y2: t.y, color: '#00e5ff', life: 0.2, maxLife: 0.2 });
                                    for(let e of enemies) { if (distToSegment(e.x, e.y, this.x, this.y, t.x, t.y) < e.size/2 + 20) applyDamage(e, this.damage * 2, 'magic'); }
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
            
            effects.push({ type: 'line', x1: player.x, y1: player.y, x2: targetX, y2: targetY, color: '#757575', life: 0.2, maxLife: 0.2, lineWidth: 4 });
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
    },
    'Magic Knight': {
        1: (sk, dmg) => {
            let mult = getBladeConsumeMult();
            player.blade.state = 'orbit'; player.blade.timer = 3.0; player.blade.orbitAngle = 0; player.blade.hitList = [];
            player.blade.baseRadius = 100; player.blade.expanding = sk.selectedUpg === 'A'; player.blade.armorBuff = sk.selectedUpg === 'B'; player.blade.orbitDmg = dmg * mult;
        },
        2: (sk, dmg) => {
            let mult = getBladeConsumeMult();
            player.blade.state = 'cleave'; player.blade.timer = 4.0;
            player.blade.radius = 120 * mult; player.blade.cleaveDmg = dmg * mult; player.blade.deflect = sk.selectedUpg === 'A';
            buffs.fractureCleave = sk.selectedUpg === 'B' ? 4.0 : 0;
        },
        3: (sk, dmg) => {
            let tempX = player.x; let tempY = player.y;
            let bx = player.blade.x; let by = player.blade.y;
            
            if (sk.selectedUpg === 'A') {
                effects.push({ type: 'lightning', x1: tempX, y1: tempY, x2: bx, y2: by, color: '#00e5ff', life: 2.0, maxLife: 2.0 });
                for(let e of enemies) { if (distToSegment(e.x, e.y, tempX, tempY, bx, by) < e.size/2 + 20) applyDamage(e, dmg, 'magic'); }
            }
            if (sk.selectedUpg === 'B') buffs.evade100 = 1.5;

            effects.push({ type: 'circle', x: tempX, y: tempY, radius: 80, color: 'rgba(0, 229, 255, 0.4)', life: 0.3, maxLife: 0.3 });
            effects.push({ type: 'circle', x: bx, y: by, radius: 80, color: 'rgba(0, 229, 255, 0.4)', life: 0.3, maxLife: 0.3 });

            for(let e of enemies) {
                if (Math.hypot(e.x - tempX, e.y - tempY) < 80 + e.size/2 || Math.hypot(e.x - bx, e.y - by) < 80 + e.size/2) {
                    applyDamage(e, dmg*0.5, 'magic'); e.isStaggered = true; e.staggerTimer = 1.0;
                }
            }
            player.x = bx; player.y = by; player.blade.x = tempX; player.blade.y = tempY; clampToBounds(player, player.radius);
        },
        4: (sk, dmg) => {
            let mult = getBladeConsumeMult();
            buffs.bladeCascade = sk.selectedUpg === 'A' ? 10.0 : 6.0;
            player.blade.cascadeDmg = dmg * mult;
            
            if (sk.selectedUpg === 'B') {
                buffs.bladeCascade = 0; 
                let cx = mouseX; let cy = mouseY;
                effects.push({ type: 'circle', x: cx, y: cy, radius: 250, color: 'rgba(0, 0, 0, 0.8)', life: 3.0, maxLife: 3.0 });
                let t = 0;
                let pullInterval = setInterval(() => {
                    if (gameState !== STATE.PLAYING) return;
                    t += 0.1;
                    effects.push({ type: 'circle', x: cx, y: cy, radius: 250 - (t*80), color: '#00e5ff', life: 0.1, maxLife: 0.1 });
                    for(let e of enemies) {
                        let [dx, dy, d] = getVector(e.x, e.y, cx, cy);
                        if (d < 300 && !e.type.startsWith('boss')) { e.x += (dx/d)*300*0.1; e.y += (dy/d)*300*0.1; clampToBounds(e, e.size/2); }
                    }
                    if (t >= 3.0) {
                        clearInterval(pullInterval);
                        effects.push({ type: 'circle', x: cx, y: cy, radius: 350, color: '#fff', life: 0.5, maxLife: 0.5 });
                        for(let e of enemies) { if (Math.hypot(e.x - cx, e.y - cy) < 350 + e.size/2) applyDamage(e, dmg * mult * 4, 'magic'); }
                    }
                }, 100);
            }
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            player.x += Math.cos(angle) * 300; player.y += Math.sin(angle) * 300; clampToBounds(player, player.radius);
            player.iFrames = 0.5;
            effects.push({ type: 'line', x1: player.x - Math.cos(angle)*300, y1: player.y - Math.sin(angle)*300, x2: player.x, y2: player.y, color: '#00e5ff', life: 0.2, maxLife: 0.2, lineWidth: 8 });
            for(let e of enemies) { if (distToSegment(e.x, e.y, player.x - Math.cos(angle)*300, player.y - Math.sin(angle)*300, player.x, player.y) < e.size/2 + 20) applyDamage(e, calcDmg(100), 'magic'); }
        }
    }
};

var MeleeAI = (e, dt, curSpd, edx, edy, edist, i) => {
    if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
    if (edist < player.radius + e.size / 2 + 5) { 
        if (e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        if (e.type === 'slime_melee') buffs.slowed = 0.5; 
    }
    if (e.type === 'toxic_sludge') {
        e.puddleTimer -= dt; if (e.puddleTimer <= 0) { effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 25, color: '#009688', life: 1.5, maxLife: 1.5 }); e.puddleTimer = 0.8; }
    }
};

var RangedAI = (e, dt, curSpd, edx, edy, edist, i) => {
    if (edist > 250) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
    e.attackTimer -= dt;
    if (e.attackTimer <= 0 && edist <= 400 && e.frozenTimer <= 0) {
        projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*350, vy: (edy/edist)*350, radius: 6, color: e.type==='archer' ? '#8d6e63' : '#e040fb', life: 3.0, isEnemy: true, damage: e.dmg });
        if (e.type === 'archer') { e.ammo--; if (e.ammo <= 0) { e.ammo = 3; e.attackTimer = 2.0; } else { e.attackTimer = 0.4; } } 
        else { e.attackTimer = 2.5; }
    }
};

var EnemyAI = {
    'slime_melee': MeleeAI, 'thief': MeleeAI, 'shield': MeleeAI, 'voltaic_ooze': MeleeAI, 'toxic_sludge': MeleeAI, 'queen_guard': MeleeAI,
    'slime_ranged': RangedAI, 'archer': RangedAI,
    
    'valerius_archer': (e, dt, curSpd, edx, edy, edist, i) => {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.frozenTimer <= 0) {
            projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*400, vy: (edy/edist)*400, radius: 6, color: '#ff5722', life: 5.0, isEnemy: true, damage: e.dmg });
            e.attackTimer = 1.2; 
        }
    },

    'caster': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist > 400) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; } else if (edist < 250) { e.x -= (edx/edist)*curSpd*dt; e.y -= (edy/edist)*curSpd*dt; } 
        effects.push({ type: 'circle', x: e.x, y: e.y, radius: 400, color: 'rgba(255, 235, 59, 0.05)', life: 0.1, maxLife: 0.1 });
    },
    'trapper': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist > 300) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; } else if (edist < 200) { e.x -= (edx/edist)*curSpd*dt; e.y -= (edy/edist)*curSpd*dt; } 
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && edist <= 450 && e.frozenTimer <= 0) {
            for(let r=0; r<3; r++) { const offX = (Math.random() - 0.5) * 150; const offY = (Math.random() - 0.5) * 150; projectiles.push({ x: e.x, y: e.y, targetX: player.x + offX, targetY: player.y + offY, vx: 0, vy: 0, radius: 8, color: '#5d4037', life: 1.0, isEnemy: true, damage: 0, type: 'trap_throw' }); }
            e.attackTimer = 4.0;
        }
    },
    'horse': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0 && (!e.state || e.state === 'idle')) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        e.stateTimer -= dt;
        if (!e.state || e.state === 'idle') {
            if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < 350 && e.stateTimer <= 0 && e.frozenTimer <= 0) { 
                e.state = 'telegraph'; e.stateTimer = 0.75; 
                const [dx, dy, d] = getVector(e.x, e.y, player.x, player.y);
                e.dashVx = (dx/d) * curSpd * 7.0; e.dashVy = (dy/d) * curSpd * 7.0;
                e.dashTargetX = e.x + (dx/d)*800; e.dashTargetY = e.y + (dy/d)*800;
            }
        } else if (e.state === 'telegraph') {
            effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.dashTargetX, y2: e.dashTargetY, color: 'rgba(255, 0, 0, 0.3)', life: 0.1, maxLife: 0.1 });
            if (e.stateTimer <= 0) { e.state = 'charge'; e.stateTimer = 1.0; e.dashHit = false; }
        } else if (e.state === 'charge') {
            e.x += e.dashVx * dt; e.y += e.dashVy * dt;
            if (Math.hypot(e.x - player.x, e.y - player.y) < e.size/2 + player.radius && !e.dashHit) { takeDamage(e.dmg * 2); e.dashHit = true; buffs.slowed = 1.0; }
            if (e.stateTimer <= 0 || (e.x <= currentMap.left || e.x >= currentMap.right || e.y <= currentMap.top || e.y >= currentMap.bottom)) { e.state = 'idle'; e.stateTimer = 2.0; }
        }
    },
    'spore_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist > 250) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && edist <= 400 && e.frozenTimer <= 0) {
            projectiles.push({ x: e.x, y: e.y, targetX: player.x, targetY: player.y, speed: 400, radius: 8, color: '#cddc39', life: 2.0, isEnemy: true, damage: e.dmg, type: 'spore' });
            e.attackTimer = 3.0;
        }
    },
    'crystal_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
            e.reflective = !e.reflective; e.stateTimer = e.reflective ? 3.0 : 4.0;
            if (e.reflective) { for(let r=0; r<8; r++) { const angle = (Math.PI*2/8) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*200, vy: Math.sin(angle)*200, radius: 6, color: '#9c27b0', life: 2.0, isEnemy: true, damage: e.dmg }); } }
        }
        if (e.reflective) { e.renderColor = '#9c27b0'; effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size/2 + 5, color: 'rgba(156, 39, 176, 0.4)', life: 0.1, maxLife: 0.1 }); } 
        else { e.renderColor = e.color; MeleeAI(e, dt, curSpd, edx, edy, edist, i); }
    },
    'slime_warden': (e, dt, curSpd, edx, edy, edist, i) => {
        e.invulnTimer = (e.invulnTimer || 0) - dt;
        if (e.orbs > 0) {
            e.orbitAngle = (e.orbitAngle || 0) + dt * 3;
            for(let k=0; k<e.orbs; k++) { const angle = e.orbitAngle + (Math.PI * 2 / e.orbs) * k; effects.push({ type: 'circle', x: e.x + Math.cos(angle)*40, y: e.y + Math.sin(angle)*40, radius: 8, color: '#ffca28', life: 0.1, maxLife: 0.1 }); }
            effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size/2 + 8, color: 'rgba(255, 202, 40, 0.3)', life: 0.1, maxLife: 0.1 });
        }
        if (e.stunTimer > 0) { e.stunTimer -= dt; return; }
        MeleeAI(e, dt, curSpd, edx, edy, edist, i);
    },
    'boss_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        e.stateTimer -= dt;
        if (e.state === 'idle') {
            if (edist > 50) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) { if (Math.random() < 0.5) { e.state = 'bounce_telegraph'; e.stateTimer = 0.6; e.dashTargetX = player.x; e.dashTargetY = player.y; } else { e.state = 'fireball'; e.stateTimer = 0.5; } }
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
                if (Math.hypot(e.x - player.x, e.y - player.y) <= 100 + player.radius) takeDamage(e.dmg * 2);
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        }
    },
    'boss_slime_queen': (e, dt, curSpd, edx, edy, edist, i) => {
        if (e.state === 'death_throes') {
            e.stateTimer -= dt; e.size = Math.max(0, e.originalSize * (e.stateTimer / 5.0)); e.bulletAngle = (e.bulletAngle || 0) + dt * 10; 
            if (Math.random() < 0.5) { for(let j=0; j<3; j++) { let angle = e.bulletAngle + (Math.PI*2/3)*j; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*350, vy: Math.sin(angle)*350, radius: 8, color: '#f06292', life: 3.0, isEnemy: true, damage: e.dmg }); } }
            if (e.stateTimer <= 0) { e.invulnerable = false; e.hp = 0; checkEnemyDeath(e); }
            return; 
        }
        let hpPercent = e.hp / e.maxHp; e.stateTimer -= dt;
        if (hpPercent > 0.6) {
            if (edist > 150) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0) {
                if (Math.random() < 0.5) { for(let k=0; k<2; k++) { const offX = (Math.random() - 0.5) * 100; const offY = (Math.random() - 0.5) * 100; enemies.push({ x: e.x + offX, y: e.y + offY, size: 28, color: '#8bc34a', speed: 115, hp: 40, maxHp: 40, type: 'slime_melee', dmg: 10, xp: 0, meleeTimer: 0 }); activeEnemies++; } } 
                else { for(let k=-1; k<=1; k++) { let angle = Math.atan2(edy, edx) + k*0.3; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400, radius: 12, color: '#cddc39', life: 3.0, isEnemy: true, damage: e.dmg, type: 'boss_slimeball' }); } }
                e.stateTimer = 2.5;
            }
        } else if (hpPercent > 0.3) {
            if (!e.guardsSpawned) {
                e.guardsSpawned = true; e.guards = [];
                for(let k=0; k<4; k++) { let guard = { x: e.x, y: e.y, size: 30, color: '#03a9f4', speed: 100, hp: 200 + (wave*10), maxHp: 200 + (wave*10), type: 'queen_guard', dmg: 15, xp: 0, meleeTimer: 0, angleOffset: (Math.PI/2)*k }; enemies.push(guard); activeEnemies++; e.guards.push(guard); }
            }
            let guardsAlive = 0;
            for(let g of e.guards) {
                if (enemies.includes(g)) { guardsAlive++; g.angleOffset += dt * 1.5; g.x = e.x + Math.cos(g.angleOffset)*150; g.y = e.y + Math.sin(g.angleOffset)*150; effects.push({type: 'lightning', x1: e.x, y1: e.y, x2: g.x, y2: g.y, color: '#03a9f4', life: 0.1, maxLife: 0.1}); if (distToSegment(player.x, player.y, e.x, e.y, g.x, g.y) < player.radius + 5) takeDamage(15*dt, true); }
            }
            e.invulnerable = guardsAlive > 0;
            if (e.invulnerable) effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size/2 + 10, color: 'rgba(3, 169, 244, 0.4)', life: 0.1, maxLife: 0.1 });
            if (e.stateTimer <= 0) {
                effects.push({ type: 'circle', x: player.x, y: player.y, radius: 60, color: 'rgba(3, 169, 244, 0.3)', life: 0.5, maxLife: 0.5, isWarning: true }); let tx = player.x, ty = player.y;
                setTimeout(() => { if(gameState!==STATE.PLAYING) return; effects.push({ type: 'circle', x: tx, y: ty, radius: 60, color: '#03a9f4', life: 0.3, maxLife: 0.3 }); if (Math.hypot(tx-player.x, ty-player.y) <= 60 + player.radius) { takeDamage(e.dmg * 1.5); buffs.slowed = 1.0; } }, 500);
                e.stateTimer = 1.0;
            }
        } else {
            e.invulnerable = false;
            if (e.stateTimer <= 0) {
                e.x = currentMap.left + Math.random() * (currentMap.right - currentMap.left - 200) + 100; e.y = currentMap.top + Math.random() * (currentMap.bottom - currentMap.top - 200) + 100;
                effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 200, color: 'rgba(0, 150, 136, 0.5)', life: 2.0, maxLife: 2.0 });
                for(let r=0; r<16; r++) { const angle = (Math.PI*2/16) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*300, vy: Math.sin(angle)*300, radius: 8, color: '#ff3d00', life: 4.0, isEnemy: true, damage: e.dmg }); }
                e.stateTimer = 1.5;
            }
        }
    },
    'boss_amalgam': (e, dt, curSpd, edx, edy, edist, i) => {
        e.stateTimer -= dt;
        if (e.state === 'idle') {
            if (edist > 60) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) { 
                e.attackIndex = (e.attackIndex || 0) + 1; const nextAtk = e.attackIndex % 3;
                if (nextAtk === 1) { e.state = 'stampede'; e.stateTimer = 3.0; e.puddleTimer = 0; effects.push({ type: 'text', text: 'STAMPEDE!', x: e.x, y: e.y - 40, color: '#ff5252', life: 1.0, maxLife: 1.0 }); }
                else if (nextAtk === 2) { e.state = 'nova'; e.stateTimer = 1.0; effects.push({ type: 'text', text: 'TOXIC NOVA!', x: e.x, y: e.y - 40, color: '#009688', life: 1.0, maxLife: 1.0 });}
                else { e.state = 'summon'; e.stateTimer = 1.0; effects.push({ type: 'text', text: 'ASSIMILATE!', x: e.x, y: e.y - 40, color: '#4db6ac', life: 1.0, maxLife: 1.0 });}
            }
        } else if (e.state === 'stampede') {
            let chaseSpd = curSpd * 2.2;
            if (edist > 0) { e.x += (edx/edist)*chaseSpd*dt; e.y += (edy/edist)*chaseSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg * 1.5); e.meleeTimer = 1.0; }
            e.puddleTimer -= dt; if (e.puddleTimer <= 0) { effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 30, color: '#009688', life: 2.0, maxLife: 2.0 }); e.puddleTimer = 0.3; }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 1.5; }
        } else if (e.state === 'nova') {
            if (e.stateTimer <= 0) {
                for (let r=0; r<12; r++) { const angle = (Math.PI*2/12) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400, radius: 10, color: '#009688', life: 2.5, isEnemy: true, damage: e.dmg, type: 'boss_slimeball' }); }
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        } else if (e.state === 'summon') {
            if (e.stateTimer <= 0) {
                for(let k=0; k<4; k++) {
                    const angle = (Math.PI*2/4) * k + Math.random(); let mx = e.x + Math.cos(angle)*250; let my = e.y + Math.sin(angle)*250;
                    mx = Math.max(currentMap.left + 24, Math.min(currentMap.right - 24, mx)); my = Math.max(currentMap.top + 24, Math.min(currentMap.bottom - 24, my));
                    enemies.push({ x: mx, y: my, size: 24, color: '#4db6ac', speed: curSpd * 1.5, hp: 60, maxHp: 60, type: 'amalgam_minion', dmg: e.dmg, xp: 0, frozenTimer: 0, facingAngle: 0, meleeTimer: 0 });
                    activeEnemies++;
                }
                e.state = 'idle'; e.stateTimer = 4.0;
            }
        } else if (e.state === 'devastate') {
            if (e.stateTimer > 0) { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 300, color: 'rgba(0, 150, 136, 0.3)', life: 0.1, maxLife: 0.1 }); } 
            else { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 300, color: '#004d40', life: 0.5, maxLife: 0.5 }); if (edist <= 300 + player.radius) takeDamage(e.dmg * 3); e.state = 'idle'; e.stateTimer = 2.0; }
        }
    },
    'boss_warlord': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        e.stateTimer -= dt;
        if (e.state === 'idle') {
            if (edist > 80) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
                if (Math.random() < 0.5) { e.state = 'knife_volley'; e.stateTimer = 0.5; } else { e.state = 'dash_telegraph'; e.stateTimer = 0.4; e.dashTargetX = player.x + (edx/edist)*250; e.dashTargetY = player.y + (edy/edist)*250; }
            }
        } else if (e.state === 'knife_volley') {
            if (e.stateTimer <= 0) {
                const baseAngle = Math.atan2(edy, edx);
                for(let r=-2; r<=2; r++) { projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle+(r*0.15))*500, vy: Math.sin(baseAngle+(r*0.15))*500, radius: 6, color: '#ff9800', life: 2.0, isEnemy: true, damage: e.dmg }); }
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        } else if (e.state === 'dash_telegraph') {
            effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size, color: 'rgba(216, 67, 21, 0.2)', life: 0.1, maxLife: 0.1 });
            if (e.stateTimer <= 0) { e.state = 'dash_execute'; e.stateTimer = 0.1; e.dashSpeedX = (e.dashTargetX - e.x) / 0.1; e.dashSpeedY = (e.dashTargetY - e.y) / 0.1; e.dashHit = false; }
        } else if (e.state === 'dash_execute') {
            e.x += e.dashSpeedX * dt; e.y += e.dashSpeedY * dt;
            if (Math.hypot(e.x - player.x, e.y - player.y) < e.size/2 + player.radius && !e.dashHit) { takeDamage(e.dmg * 2); e.dashHit = true; }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 2.0; }
        }
    },
    'boss_beastmaster': (e, dt, curSpd, edx, edy, edist, i) => {
        e.stateTimer -= dt; let enrageMult = (e.hp < e.maxHp * 0.5) ? 0.6 : 1.0; 
        if (e.state === 'idle' || !e.state) {
            if (edist > 150) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size/2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
                e.attackIndex = (e.attackIndex || 0) + 1; const nextAtk = e.attackIndex % 3;
                if (nextAtk === 1) { e.state = 'bolas'; e.stateTimer = 0.5 * enrageMult; }
                else if (nextAtk === 2) { e.state = 'hounds'; e.stateTimer = 1.0 * enrageMult; }
                else { e.state = 'joust_prep'; e.stateTimer = 1.0 * enrageMult; e.joustCount = 0; }
            }
        } else if (e.state === 'bolas') {
            if (e.stateTimer <= 0) {
                const baseAngle = Math.atan2(edy, edx);
                for(let r=-1; r<=1; r++) { const angle = baseAngle + (r*0.2); projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*700, vy: Math.sin(angle)*700, radius: 15, color: '#795548', life: 2.0, isEnemy: true, damage: e.dmg, type: 'bolas' }); }
                e.state = 'idle'; e.stateTimer = 2.5 * enrageMult;
            }
        } else if (e.state === 'hounds') {
            if (e.stateTimer <= 0) {
                const baseAngle = Math.atan2(edy, edx);
                projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle - 0.5)*400, vy: Math.sin(baseAngle - 0.5)*400, speed: 450, radius: 12, color: '#d7ccc8', life: 4.0, isEnemy: true, damage: e.dmg, type: 'hound', trackTimer: 1.5 });
                projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle + 0.5)*400, vy: Math.sin(baseAngle + 0.5)*400, speed: 450, radius: 12, color: '#d7ccc8', life: 4.0, isEnemy: true, damage: e.dmg, type: 'hound', trackTimer: 1.5 });
                e.state = 'idle'; e.stateTimer = 3.0 * enrageMult;
            }
        } else if (e.state === 'joust_prep') {
            effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size, color: 'rgba(255, 87, 34, 0.3)', life: 0.1, maxLife: 0.1 });
            if (e.stateTimer <= 0) { e.state = 'jousting'; e.stateTimer = 0.5; e.dashHit = false; e.joustCount++; e.dashVx = (edx/edist) * curSpd * 5.0; e.dashVy = (edy/edist) * curSpd * 5.0; }
        } else if (e.state === 'jousting') {
            e.x += e.dashVx * dt; e.y += e.dashVy * dt;
            if (Math.random() < 0.1) effects.push({ type: 'bear_trap', x: e.x, y: e.y, radius: 10, color: '#795548', life: 5.0, maxLife: 5.0, dmg: e.dmg });
            if (Math.hypot(e.x - player.x, e.y - player.y) < e.size/2 + player.radius && !e.dashHit) { takeDamage(e.dmg * 2); e.dashHit = true; buffs.rooted = 0.5; }
            if (e.stateTimer <= 0) { if (e.joustCount < 3) { e.state = 'joust_prep'; e.stateTimer = 0.4 * enrageMult; } else { e.state = 'idle'; e.stateTimer = 3.0 * enrageMult; } }
        }
    },
    'boss_valerius': (e, dt, curSpd, edx, edy, edist, i) => {
        let hpPercent = e.hp / e.maxHp;

        if (e.state === 'jump_in') {
            e.stateTimer -= dt;
            e.y += ((e.targetY - e.y) * 10 * dt);
            if (e.stateTimer <= 0) {
                e.y = e.targetY; e.state = 'idle'; e.stateTimer = 2.0;
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 100, color: '#4e342e', life: 0.5, maxLife: 0.5 });
            }
            return;
        }

        if (e.isStaggered) {
            e.renderColor = '#ffeb3b'; e.staggerTimer -= dt;
            if (e.staggerTimer <= 0) {
                e.isStaggered = false; e.shieldHp = 0;
            }
            return;
        }
        e.renderColor = e.color;

        let phase = 1;
        if (hpPercent <= 0.65 && hpPercent > 0.3) phase = 2;
        if (hpPercent <= 0.3) phase = 3;

        e.stateTimer -= dt;

        if (!e.state || e.state === 'idle') {
            if (phase === 1) {
                if (edist > 100) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
                if (e.stateTimer <= 0) {
                    e.state = (edist > 200) ? 'lunge' : (Math.random() < 0.4 ? 'sunder' : 'lunge');
                    e.stateTimer = e.state === 'lunge' ? 1.0 : 1.5;
                    if (e.state === 'lunge') {
                        e.dashVx = (edx/edist) * curSpd * 6.0;
                        e.dashVy = (edy/edist) * curSpd * 6.0;
                    }
                }
            } else if (phase === 2) {
                let cx = (currentMap.left + currentMap.right)/2;
                let cy = (currentMap.top + currentMap.bottom)/2;
                let [cdx, cdy, cdist] = getVector(e.x, e.y, cx, cy);
                if (cdist > 10) { e.x += (cdx/cdist)*curSpd*3*dt; e.y += (cdy/cdist)*curSpd*3*dt; }

                if (!e.archersSpawned) {
                    e.archersSpawned = true; e.shieldHp = 2000; e.facingAngle = Math.PI; 
                    enemies.push({ x: currentMap.left + 50, y: cy - 100, size: 24, color: '#8d6e63', speed: 0, hp: 300, maxHp: 300, type: 'valerius_archer', dmg: e.dmg*0.6, xp: 0, attackTimer: 0.5, ammo: 999, isValeriusMinion: true, frozenTimer: 0 });
                    enemies.push({ x: currentMap.right - 50, y: cy + 100, size: 24, color: '#8d6e63', speed: 0, hp: 300, maxHp: 300, type: 'valerius_archer', dmg: e.dmg*0.6, xp: 0, attackTimer: 0.5, ammo: 999, isValeriusMinion: true, frozenTimer: 0 });
                    activeEnemies += 2;
                }

                if (e.shieldHp <= 0 && !e.phase2Broken) {
                    e.phase2Broken = true; e.isStaggered = true; e.staggerTimer = 3.0; e.state = 'idle'; e.stateTimer = 3.0;
                    for(let j=enemies.length-1; j>=0; j--) {
                        if (enemies[j].isValeriusMinion) { enemies[j].hp = 0; checkEnemyDeath(enemies[j]); }
                    }
                    return;
                }

                if (e.stateTimer <= 0 && !e.isStaggered) {
                    e.state = 'javelin_volley'; e.stateTimer = 2.0; e.volleyAngle = e.facingAngle - 1.0;
                }
            } else if (phase === 3) {
                if (edist > 150) { e.x += (edx/edist)*curSpd*1.5*dt; e.y += (edy/edist)*curSpd*1.5*dt; }
                if (e.stateTimer <= 0) { 
                    let moves = ['chain_hook', 'frenzy_lunge', 'slam'];
                    e.state = moves[Math.floor(Math.random() * moves.length)];
                    if (e.state === 'chain_hook') { e.stateTimer = 1.0; e.hookFired = false; }
                    else if (e.state === 'frenzy_lunge') { 
                        e.stateTimer = 0.8; 
                        e.dashVx = (edx/edist) * curSpd * 8.0; 
                        e.dashVy = (edy/edist) * curSpd * 8.0; 
                    }
                    else if (e.state === 'slam') { e.stateTimer = 1.0; }
                }
            }
        } 
        else if (e.state === 'lunge') {
            if (e.stateTimer > 0.4) {
                e.dashVx = (edx/edist) * curSpd * 10.0;
                e.dashVy = (edy/edist) * curSpd * 10.0;
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.x + e.dashVx*0.4, y2: e.y + e.dashVy*0.4, color: 'rgba(255,0,0,0.5)', life: 0.1, maxLife: 0.1, lineWidth: 8 });
            } else { 
                e.x += e.dashVx * dt; e.y += e.dashVy * dt; 
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size/2 + player.radius) { takeDamage(e.dmg * 2); e.state = 'idle'; e.stateTimer = 1.5; } 
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 1.0; }
        }
        else if (e.state === 'sunder') {
            if (e.stateTimer > 0.5) { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 100, color: 'rgba(93, 64, 55, 0.3)', life: 0.1, maxLife: 0.1 }); }
            else {
                effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 100, color: '#5d4037', life: 4.0, maxLife: 4.0, dmg: e.dmg });
                e.state = 'idle'; e.stateTimer = 1.5;
            }
        }
        else if (e.state === 'javelin_volley') {
            e.volleyAngle += dt * 1.5; 
            if (e.stateTimer > 0 && e.stateTimer % 0.2 < 0.05) {
                projectiles.push({ x: e.x, y: e.y, vx: Math.cos(e.volleyAngle)*600, vy: Math.sin(e.volleyAngle)*600, radius: 8, color: '#ff9800', life: 3.0, isEnemy: true, damage: e.dmg });
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 2.0; e.facingAngle = Math.atan2(player.y - e.y, player.x - e.x); }
        }
        else if (e.state === 'chain_hook') {
            if (e.stateTimer > 0.5) {
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: player.x, y2: player.y, color: 'rgba(117, 117, 117, 0.5)', life: 0.1, maxLife: 0.1 });
                e.hookTargetX = player.x; e.hookTargetY = player.y;
            } else if (!e.hookFired) {
                e.hookFired = true;
                const [hx, hy, hdist] = getVector(e.x, e.y, e.hookTargetX, e.hookTargetY);
                projectiles.push({ x: e.x, y: e.y, vx: (hx/hdist)*1200, vy: (hy/hdist)*1200, radius: 15, color: '#757575', life: 2.0, isEnemy: true, damage: e.dmg, type: 'chain_hook', sourceBoss: e });
            }
            if (e.stateTimer <= 0 && e.hookFired) { e.stateTimer = 0.1; } 
        }
        else if (e.state === 'hook_pull') {
            const [px, py, pdist] = getVector(e.x, e.y, e.pullTargetX, e.pullTargetY);
            if (pdist > 50) { e.x += (px/pdist)*2500*dt; e.y += (py/pdist)*2500*dt; }
            else {
                e.x = e.pullTargetX; e.y = e.pullTargetY;
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 200, color: '#5d4037', life: 0.3, maxLife: 0.3 });
                if (Math.hypot(player.x - e.x, player.y - e.y) <= 200 + player.radius) { takeDamage(e.dmg * 2); buffs.rooted = 1.0; }
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        }
        else if (e.state === 'frenzy_lunge') {
            if (e.stateTimer > 0.4) {
                e.dashVx = (edx/edist) * curSpd * 12.0;
                e.dashVy = (edy/edist) * curSpd * 12.0;
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.x + e.dashVx*0.3, y2: e.y + e.dashVy*0.3, color: 'rgba(255,87,34,0.6)', life: 0.1, maxLife: 0.1, lineWidth: 10 });
            } else { 
                e.x += e.dashVx * dt; e.y += e.dashVy * dt; 
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size/2 + player.radius) { takeDamage(e.dmg * 2.5); e.state = 'idle'; e.stateTimer = 1.0; } 
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 0.5; }
        }
        else if (e.state === 'slam') {
            if (e.stateTimer > 0.4) { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 140, color: 'rgba(78, 52, 46, 0.3)', life: 0.1, maxLife: 0.1 }); }
            else {
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 140, color: '#4e342e', life: 0.3, maxLife: 0.3 });
                if (edist <= 140 + player.radius) takeDamage(e.dmg * 3);
                e.state = 'idle'; e.stateTimer = 1.5;
            }
        }
    },
    'amalgam_minion': (e, dt, curSpd, edx, edy, edist, i) => { 
        const boss = enemies.find(en => en.type === 'boss_amalgam');
        if (boss) {
            const [bx, by, bdist] = getVector(e.x, e.y, boss.x, boss.y);
            if (bdist > boss.size/2) { e.x += (bx/bdist)*curSpd*dt; e.y += (by/bdist)*curSpd*dt; } 
            else { boss.state = 'devastate'; boss.stateTimer = 1.0; boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.1); effects.push({ type: 'text', text: 'ABSORBED!', x: boss.x, y: boss.y - 40, color: '#ff5252', life: 1.0, maxLife: 1.0 }); if (i !== undefined) { enemies.splice(i, 1); activeEnemies--; } }
        } else {
            if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        }
    }
};

var BasicAttackRegistry = {
    'sword': (dmg) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        effects.push({ type: 'cone', x: player.x, y: player.y, radius: 110, angle: attackAngle, spread: Math.PI/1.5, color: '#e0e0e0', life: 0.15, maxLife: 0.15 }); 
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= 110 + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= (Math.PI/1.5)/2) { applyDamage(e, dmg, 'melee_basic'); if (equipment.gloves && equipment.gloves.name === 'Titan Gauntlets') { e.x += Math.cos(attackAngle) * 30; e.y += Math.sin(attackAngle) * 30; clampToBounds(e, e.size/2); } }
            }
        }
    },
    'staff': (dmg, isResonance) => {
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        if (dist > 0) {
            let isPierce = (equipment.armor && equipment.armor.name === 'Robes of the Magi');
            projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*700, vy: (dy/dist)*700, radius: 6, color: isResonance ? '#2196f3' : '#ffca28', life: 1.5, type: isPierce ? 'pierce' : 'basic', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false, resonance: isResonance });
        }
    },
    'bow': (dmg) => {
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        if (dist > 0) {
            let isPierce = (equipment.gloves && equipment.gloves.name === "Sniper's Grips"); let numArrows = (equipment.amulet && equipment.amulet.name === 'Pendant of the Hunt') ? 2 : 1; const baseAngle = Math.atan2(dy, dx);
            for(let i=0; i<numArrows; i++) { let angle = numArrows > 1 ? baseAngle - 0.1 + (i*0.2) : baseAngle; projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*700, vy: Math.sin(angle)*700, radius: 4, color: '#e0e0e0', life: 1.5, type: isPierce ? 'pierce' : 'basic', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false, resonance: false }); }
        }
    },
    'dagger': (dmg, isResonance) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        
        // Proximity check: Don't dash if an enemy is already in our face
        let closest = getNearestEnemyFromPoint(player.x, player.y, 50);
        let dashDist1 = closest ? 0 : 30;
        
        player.x += Math.cos(angle) * dashDist1; player.y += Math.sin(angle) * dashDist1; clampToBounds(player, player.radius);
        
        let startX1 = player.x + Math.cos(angle - 0.5)*15; let startY1 = player.y + Math.sin(angle - 0.5)*15;
        let endX1 = startX1 + Math.cos(angle) * 80; let endY1 = startY1 + Math.sin(angle) * 80;
        effects.push({ type: 'line', x1: startX1, y1: startY1, x2: endX1, y2: endY1, color: '#9c27b0', life: 0.1, maxLife: 0.1, lineWidth: 4 });
        
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (distToSegment(e.x, e.y, startX1, startY1, endX1, endY1) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
        }
        
        setTimeout(() => {
            if (gameState !== STATE.PLAYING) return;
            
            // Second proximity check for the follow-up strike
            closest = getNearestEnemyFromPoint(player.x, player.y, 50);
            let dashDist2 = closest ? 0 : 15;
            
            player.x += Math.cos(angle) * dashDist2; player.y += Math.sin(angle) * dashDist2; clampToBounds(player, player.radius);
            
            let startX2 = player.x + Math.cos(angle + 0.5)*15; let startY2 = player.y + Math.sin(angle + 0.5)*15;
            let endX2 = startX2 + Math.cos(angle) * 80; let endY2 = startY2 + Math.sin(angle) * 80;
            effects.push({ type: 'line', x1: startX2, y1: startY2, x2: endX2, y2: endY2, color: '#e1bee7', life: 0.1, maxLife: 0.1, lineWidth: 4 });
            
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (distToSegment(e.x, e.y, startX2, startY2, endX2, endY2) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
            }
        }, 150);
    },
    'scattergun': (dmg) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let isPierce = buffs.overclockTimer > 0;
        
        // Fires 5 pellets in a spread arc
        for(let i=-2; i<=2; i++) {
            let spreadAngle = angle + (i*0.1);
            projectiles.push({ x: player.x, y: player.y, vx: Math.cos(spreadAngle)*900, vy: Math.sin(spreadAngle)*900, radius: 4, color: '#ffb74d', life: 0.4, type: 'scattergun', damage: dmg, pierce: isPierce, hitList: [], isEnemy: false });
        }
    },
    'phantom_blade': (dmg) => {
        if (!player.blade) return;
        
        // Triggers the blade to fly from its current location to the target location
        player.blade.state = 'flying';
        player.blade.targetX = mouseX;
        player.blade.targetY = mouseY;
        player.blade.hitList = [];
        player.blade.baseDmg = dmg;
    }
};