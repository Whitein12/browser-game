// ==========================================
// skills.js - Class Abilities & Attacks
// ==========================================

function castBasic() {
    const ANIM_LOCK = 0.15;
    let gloveBonus = equipment.gloves ? equipment.gloves.val : 0; 
    if (activeClass && activeClass.name === 'Swordsaint' && equipment.gloves && equipment.gloves.name === 'Aether Grips') {
        gloveBonus = 0.3; // +30% attack speed (replaces the generic glove value, which would otherwise stack to +55%)
    }
    let stanceBonus = (activeClass && activeClass.name === 'Swordsaint' && player.stance === 'airborne') ? (player.flow / player.maxFlow) * 0.5 : 0; // up to +50% atk speed in airborne

    cooldowns.basic = devNoCooldowns ? 0 : ANIM_LOCK + ((activeClass.basicAttackCD * getCDR()) / (1.0 + gloveBonus + stanceBonus));
    cooldownMax.basic = cooldowns.basic;
    let dmg = calcDmg(activeClass.basicDmg, 1);
    
    let isResonance = false;
    if (activeClass.name === 'Spellweaver' && player.arcaneResonance) { 
        isResonance = true; 
        player.arcaneResonance = false; 
        dmg *= 1.5; 
    }

    window.BasicAttackRegistry[activeClass.weapon](dmg, isResonance);
    onBasicAttack(); // weapons.js: swing animation and firing effects
    if (typeof updateHUD === "function") updateHUD();
}

// Machinist Sentry Turret. upg: 'A' = Laser Optics, 'B' = Volatile Casing
function spawnTurret(x, y, upg, dmg) {
    projectiles.push({
        x: x, y: y, vx: 0, vy: 0, radius: 12, color: '#ff9800', life: 10.0, type: 'turret', damage: dmg, isEnemy: false, volatile: upg === 'B', isLaser: upg === 'A', attackTimer: 0, angle: 0,
        customUpdate: function(dt, p) {
            this.attackTimer -= dt * (buffs.overclockTimer > 0 ? 2.0 : 1.0);
            let target = getNearestEnemyFromPoint(this.x, this.y, 500);
            if (target) {
                this.angle = Math.atan2(target.y - this.y, target.x - this.x);
                if (this.attackTimer <= 0) {
                    if (this.isLaser) {
                        effects.push({ type: 'laser_beam', x1: this.x + Math.cos(this.angle) * 18, y1: this.y + Math.sin(this.angle) * 18, x2: target.x, y2: target.y, life: 0.2, maxLife: 0.2 });
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
}

var SkillRegistry = {
    'Cleric': {
        1: (sk, dmg) => { // Divine Ray
            const aimAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            
            // Check available zeal for thresholds
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let zealSpent = 10;
            let width = 20;
            let length = 600;
            
            if (availableZeal >= 100) {
                zealSpent = 100; width = 80; length = 2500;
            } else if (availableZeal >= 50) {
                zealSpent = 50; width = 45; length = 600;
            } else if (availableZeal < 10) {
                zealSpent = availableZeal; dmg *= 0.5;
            }
            
            let finalDmg = dmg;
            if (!buffs.zealLocked) player.zeal = Math.max(0, player.zeal - zealSpent);
            
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';

            let localDuration = 1.5;
            let localTickRate = 0.1;
            let maxTicks = Math.floor(localDuration / localTickRate);

            if (isShadow) {
                // Void Spike
                let spikeDmg = finalDmg * 2.5;
                if (player.hp < player.maxHp * 0.5) spikeDmg *= 1.4;
                if (availableZeal < 10) {
                    player.hp -= player.hp * 0.05; // drain HP
                    spikeDmg *= 2.0; 
                }
                
                effects.push({ 
                    type: 'divine_ray_channel', x: player.x, y: player.y, angle: aimAngle, 
                    length: length, width: width, color: '#9c27b0', life: localDuration, maxLife: localDuration,
                    customUpdate: function(dt, ef) { ef.x = player.x; ef.y = player.y; ef.angle = Math.atan2(mouseY - player.y, mouseX - player.x); }
                });
                
                let ticks = 0;
                every(localTickRate, maxTicks, () => {
                    ticks++;
                    let currentAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                    for (let e of enemies) {
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        if (dist < length) {
                            let diff = Math.atan2(dy, dx) - currentAngle;
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            let limit = Math.atan2(width, dist);
                            if (Math.abs(diff) < limit || Math.abs(diff) < 0.15) {
                                applyDamage(e, spikeDmg * 0.4, 'magic');
                                if (ticks % 2 === 0) effects.push({ type: 'sparkle_poof', x: e.x, y: e.y, color: '#9c27b0' });
                            }
                        }
                    }
                });
                buffs.lastSpellClass = 'shadow';
            } else {
                // Base & Holy
                let rayColor = isHoly ? '#fff59d' : '#fbc02d'; // Holy is whiter
                effects.push({ 
                    type: 'divine_ray_channel', x: player.x, y: player.y, angle: aimAngle, 
                    length: length, width: width, color: rayColor, life: localDuration, maxLife: localDuration,
                    customUpdate: function(dt, ef) { ef.x = player.x; ef.y = player.y; ef.angle = Math.atan2(mouseY - player.y, mouseX - player.x); }
                });
                
                let ticks = 0;
                every(localTickRate, maxTicks, () => {
                    ticks++;
                    let currentAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                    for (let e of enemies) {
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        if (dist < length) {
                            let diff = Math.atan2(dy, dx) - currentAngle;
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            let limit = Math.atan2(width, dist) * 1.5; // Slightly forgiving hitbox at close range
                            if (Math.abs(diff) < Math.max(limit, 0.15)) {
                                applyDamage(e, finalDmg * 0.8, 'magic');
                                if (isHoly) e.blindTimer = 1.0; // Stacks up!
                                if (ticks % 2 === 0) effects.push({ type: 'sparkle_poof', x: e.x, y: e.y, color: rayColor });
                            }
                        }
                    }
                });
                if (isHoly) buffs.lastSpellClass = 'holy';
            }
        },
        2: (sk, dmg) => { // Hallowed Ground
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let zealSpent = 30;
            let healMult = 1.0;
            let doDamageAndSlow = false;

            if (availableZeal >= 100) {
                zealSpent = 100;
                healMult = 2.0;
                doDamageAndSlow = true;
            } else if (availableZeal >= 50) {
                zealSpent = 50;
                healMult = 2.0;
            } else if (availableZeal < 30) {
                zealSpent = availableZeal;
                healMult = 0.5;
            }
            
            if (!buffs.zealLocked) player.zeal = Math.max(0, player.zeal - zealSpent);
            
            let radius = healMult > 0.5 ? 160 : 80;
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            let tX = mouseX; let tY = mouseY;
            let life = 4.0;

            if (isHoly) {
                buffs.lastSpellClass = 'holy';
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(251, 192, 45, 0.3)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, isHoly: true, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            // Heal Player
                            if (Math.hypot(player.x - p.x, player.y - p.y) <= p.radius) {
                                let healAmount = (5 + (player.maxHp * 0.05)) * healMult;
                                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                                effects.push({ type: 'text', x: player.x, y: player.y - 30, text: `+${Math.floor(healAmount)}`, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
                                effects.push({ type: 'sparkle_poof', x: player.x, y: player.y, color: '#ffca28' });
                            }
                            for(let e of enemies) {
                                if (Math.hypot(e.x - p.x, e.y - p.y) > p.radius + e.size/2) continue;
                                if (doDamageAndSlow) {
                                    applyDamage(e, (dmg || 15) * 0.5, 'magic');
                                    e.slowTimer = 0.6; e.slowAmount = 0.4;
                                }
                                // Sanctuary knocks non-boss enemies back out of the circle
                                if (!e.type.startsWith('boss')) {
                                    let [kx, ky, kd] = getVector(p.x, p.y, e.x, e.y);
                                    if (kd > 0) { e.x += (kx/kd) * 60; e.y += (ky/kd) * 60; clampToBounds(e, e.size/2); }
                                }
                            }
                        }
                    }
                });
            } else if (isShadow) {
                buffs.lastSpellClass = 'shadow';
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(156, 39, 176, 0.3)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, isShadow: true, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            let dtDamage = (dmg || 15) * 1.5; // Tick damage
                            if (doDamageAndSlow) dtDamage *= 1.5;
                            for (let e of enemies) {
                                if (Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size/2) {
                                    if (e.shieldHp > 0) { e.shieldHp = 0; effects.push({ type: 'text', text: 'SHIELD BROKEN', x: e.x, y: e.y - 30, color: '#9c27b0', life: 1.0, maxLife: 1.0 }); }
                                    applyDamage(e, dtDamage, 'magic');
                                    e.slowTimer = 0.6; e.slowAmount = 0.4;
                                }
                            }
                        }
                    }
                });
            } else {
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(255, 235, 59, 0.2)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            // Moderate Heal, no damage
                            if (Math.hypot(player.x - p.x, player.y - p.y) <= p.radius) {
                                let healAmount = (5 + (player.maxHp * 0.02)) * healMult;
                                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                                effects.push({ type: 'text', x: player.x, y: player.y - 30, text: `+${Math.floor(healAmount)}`, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
                                effects.push({ type: 'sparkle_poof', x: player.x, y: player.y, color: '#ffca28' });
                            }
                            if (doDamageAndSlow) {
                                for(let e of enemies) {
                                    if (Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size/2) {
                                        applyDamage(e, (dmg || 10) * 0.5, 'magic');
                                        e.slowTimer = 0.6; e.slowAmount = 0.4;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        },
        3: (sk, dmg) => { // Phase Shift
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let dashBonusDist = 0;
            let applyAoeStun = false;
            let isUpgradedCast = false;
            
            if (availableZeal >= 100) {
                dashBonusDist = 300;
                applyAoeStun = true;
                isUpgradedCast = true;
            } else if (availableZeal >= 50) {
                dashBonusDist = 150;
                isUpgradedCast = true;
            }

            let resolveZeal = () => {
                let cost = isUpgradedCast ? (applyAoeStun ? 100 : 50) : (isShadow ? 20 : 0);
                if (!buffs.zealLocked) {
                    if (isShadow) {
                        if (player.zeal >= cost) player.zeal -= cost;
                        else player.hp -= player.maxHp * 0.1;
                    } else {
                        if (isUpgradedCast) player.zeal = Math.max(0, player.zeal - cost);
                        else player.zeal = Math.min(player.maxZeal, player.zeal + 20); // Generate if base
                    }
                }
            };

            if (isHoly) { // Divine Transposition
                let nearest = null; let minDist = Infinity;
                for (let e of enemies) {
                    let dist = Math.hypot(player.x - e.x, player.y - e.y);
                    if (dist < 400 + dashBonusDist && dist < minDist) { minDist = dist; nearest = e; }
                }
                if (nearest) {
                    resolveZeal();
                    let px = player.x; let py = player.y;
                    player.x = nearest.x; player.y = nearest.y;
                    nearest.x = px; nearest.y = py;
                    
                    spawnDashGhost('#ffd54f', true, 0.4, Math.atan2(player.y - py, player.x - px), px, py, 0);
                    effects.push({ type: 'transposition', x0: px, y0: py, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
                    effects.push({ type: 'phase_light', x: px, y: py, radius: 46, life: 0.45, maxLife: 0.45 });
                    effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 46, life: 0.45, maxLife: 0.45 });
                    if (applyAoeStun) {
                        effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 400, life: 0.5, maxLife: 0.5 });
                    }
                    
                    for (let e of enemies) {
                        if (Math.hypot(e.x - player.x, e.y - player.y) < (applyAoeStun ? 400 : 200)) {
                            e.stunTimer = 2.0;
                            burst(e.x, e.y, 0, Math.PI * 2, 5, { kind: 'dot', color: '#ffe082', size: 2, life: 0.4, speed: [40, 120] });
                        }
                    }
                    buffs.lastSpellClass = 'holy';
                }
            } else if (isShadow) { // Raven Flight
                resolveZeal();
                let [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let dashDist = Math.min(dist, 400 + dashBonusDist);
                let tX = player.x + (dx/dist)*dashDist;
                let tY = player.y + (dy/dist)*dashDist;
                
                effects.push({ type: 'raven_flight', x0: player.x, y0: player.y, x1: tX, y1: tY, life: 0.5, maxLife: 0.5 });
                spawnDashGhost('#7b1fa2', true, 0.3, Math.atan2(tY - player.y, tX - player.x));
                if (applyAoeStun) effects.push({ type: 'holy_nova', x: tX, y: tY, radius: 150, color: '#ce93d8', life: 0.5, maxLife: 0.5 });
                
                for (let e of enemies) {
                    if (distToSegment(e.x, e.y, player.x, player.y, tX, tY) < e.size + (applyAoeStun ? 150 : 60)) {
                        e.blindTimer = 2.5; 
                        applyDamage(e, (dmg || 20) * 2.0, 'magic');
                        player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.05));
                        effects.push({ type: 'text', text: 'SIPHON', x: e.x, y: e.y - 20, color: '#9c27b0', life: 0.8, maxLife: 0.8 });
                        burst(e.x, e.y, Math.atan2(tY - e.y, tX - e.x), 0.8, 6, { kind: 'dot', color: '#ce93d8', size: 2, life: 0.45, speed: [150, 300], drag: 2 }); // life drained toward the cleric
                        if (applyAoeStun) e.stunTimer = 1.0;
                    }
                }
                player.x = tX; player.y = tY;
                buffs.lastSpellClass = 'shadow';
            } else { // Base Phase Shift
                resolveZeal();
                let [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let dashDist = Math.max(50, Math.min(dist, 300 + dashBonusDist));
                let tX = player.x + (dx/dist)*dashDist;
                let tY = player.y + (dy/dist)*dashDist;
                
                spawnDashGhost('#ffd54f', true, 0.4, Math.atan2(tY - player.y, tX - player.x));
                effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 40, depart: true, life: 0.35, maxLife: 0.35 });
                for (let i = 0; i <= 10; i++) { const t = i / 10; spawnParticle({ kind: 'dot', color: '#ffe082', x: lerp(player.x, tX, t) + jitter(10), y: lerp(player.y, tY, t) + jitter(10), vx: jitter(20), vy: -20 - Math.random() * 20, size: 1.8, life: 0.3 + t * 0.3, drag: 1, grow: 0, spin: 0, rot: 0 }); }
                player.iFrames = applyAoeStun ? 1.0 : 0.5;
                if (applyAoeStun) {
                    effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 200, life: 0.5, maxLife: 0.5 });
                    effects.push({ type: 'holy_nova', x: tX, y: tY, radius: 200, life: 0.5, maxLife: 0.5 });
                    for(let e of enemies) {
                        if(Math.hypot(e.x - tX, e.y - tY) < 200) { e.stunTimer = 1.5; applyDamage(e, dmg, 'magic'); }
                        if(Math.hypot(e.x - player.x, e.y - player.y) < 200) { e.stunTimer = 1.5; applyDamage(e, dmg, 'magic'); }
                    }
                }
                player.x = tX; player.y = tY;
                effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 46, life: 0.45, maxLife: 0.45 });
            }
        },
        4: (sk, dmg) => { // Ascension
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            
            if (isHoly) { // Avatar of Renewal
                buffs.avatarOfRenewal = 8.0; 
                buffs.lastSpellClass = 'holy';
                effects.push({ type: 'ascend_burst', variant: 'holy', radius: 250, life: 0.7, maxLife: 0.7 });
                
                // Homings light bolts
                let bolts = 6;
                for(let i=0; i<bolts; i++) {
                    let angle = (Math.PI*2 / bolts) * i;
                    projectiles.push({
                        x: player.x, y: player.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400,
                        radius: 8, color: '#fff', life: 3.0, type: 'basic', shape: 'light_spear', damage: dmg * 1.5, pierce: false, isEnemy: false,
                        customUpdate: function(dt, p) {
                            let nearest = getNearestEnemyFromPoint(p.x, p.y, 300);
                            if (nearest) {
                                let [dx, dy, dist] = getVector(p.x, p.y, nearest.x, nearest.y);
                                p.vx += (dx/dist)*800 * dt;
                                p.vy += (dy/dist)*800 * dt;
                                // velocity limit
                                let vDist = Math.hypot(p.vx, p.vy);
                                if (vDist > 600) { p.vx = (p.vx/vDist)*600; p.vy = (p.vy/vDist)*600; }
                            }
                        }
                    });
                }
            } else if (isShadow) { // Aspect of the Reaper
                buffs.aspectOfReaper = 8.0;
                buffs.lastSpellClass = 'shadow';
                effects.push({ type: 'ascend_burst', variant: 'shadow', radius: 250, life: 0.7, maxLife: 0.7 });
            } else { // Base Ascension
                buffs.ascension = 6.0; 
                effects.push({ type: 'ascend_burst', variant: 'base', radius: 150, life: 0.7, maxLife: 0.7 });
            }
            if (!buffs.zealLocked) player.zeal = player.maxZeal;
        },
        'rmb': () => {
            // Twilight Repulse
            if (equipment.weapon && equipment.weapon.name === 'Censer of the Twilight Horizon') {
                let radius = 180;
                effects.push({ type: 'eclipse_wave', x: player.x, y: player.y, radius: radius, life: 0.5, maxLife: 0.5 });
                
                for(let i=enemies.length-1; i>=0; i--) {
                    const e = enemies[i];
                    if (!e.type.startsWith('boss') && Math.hypot(player.x - e.x, player.y - e.y) <= radius + e.size/2) {
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        // Repulse distance
                        if (dist > 0) {
                            e.x += (dx/dist) * 120;
                            e.y += (dy/dist) * 120;
                            clampToBounds(e, e.size/2);
                        }
                        applyDamage(e, 30, 'magic');
                        e.stunTimer = 1.0;
                    }
                }
            }
        }
    },
    'Swordsaint': {
        1: (sk, dmg) => { // Blade Sweep / Blade Surge
            if (player.stance === 'handheld') {
                const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                effects.push({ type: 'precision_slash', x: player.x, y: player.y, radius: 180, angle: attackAngle, color: '#18ffff', life: 0.25, maxLife: 0.25 }); 
                player.qAnimTimer = 0.25;
                player.parryTimer = 0.3; // Parry window: hits taken at the start of the sweep are parried (see takeDamage)
                
                // Destroy Enemy Projectiles
                for(let i = projectiles.length - 1; i >= 0; i--) {
                    let p = projectiles[i];
                    if (p.isEnemy) {
                        if (Math.hypot(player.x - p.x, player.y - p.y) <= 180) {
                            let diff = Math.atan2(p.y-player.y, p.x-player.x) - attackAngle; 
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            if (Math.abs(diff) <= Math.PI/3) { // inside slash cone
                                effects.push({ type: 'sparkle_poof', x: p.x, y: p.y, color: '#00e5ff' });
                                p.life = 0; 
                            }
                        }
                    }
                }
                
                let hitAnything = false;
                for(let e of enemies) {
                    if (Math.hypot(player.x-e.x, player.y-e.y) <= 180 + e.size/2) {
                        let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; 
                        while(diff < -Math.PI) diff += Math.PI*2; 
                        while(diff > Math.PI) diff -= Math.PI*2;
                        if (Math.abs(diff) <= (Math.PI/3)) { 
                            applyDamage(e, dmg * 2.5, 'slash'); 
                            hitAnything = true;
                        }
                    }
                }
                
                if (hitAnything) {
                    player.flow = Math.min(player.maxFlow, player.flow + 30); 
                    player.flowGainTimer = 0;
                }
            } else {
                let ab = player.airborneBlade;
                // Devastating epic spin on current location
                ab.flyTimer = 0.6; // Lock the AI out of flying away while it spins
                
                effects.push({ type: 'text', text: 'Blade Surge!', x: ab.x, y: ab.y - 40, color: '#00e5ff', life: 0.6, maxLife: 0.6 });
                
                let isDeflectingStorm = sk.selectedUpg === 'B';
                let spinRadius = isDeflectingStorm ? 250 : 180;
                let finalRadius = isDeflectingStorm ? 280 : 200;
                
                let spinCount = 0;
                every(0.1, 6, () => {
                    let spinAngle = (Math.PI * 2 / 5) * spinCount + ab.angle;
                    ab.angle += 0.5; // visibly rotate the blade fast
                    
                    effects.push({ type: 'storm_cyclone', x: ab.x, y: ab.y, radius: spinRadius, angle: spinAngle, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                    
                    if (isDeflectingStorm) {
                        for (let i = projectiles.length - 1; i >= 0; i--) {
                            let p = projectiles[i];
                            if (p.isEnemy && Math.hypot(p.x - ab.x, p.y - ab.y) <= spinRadius + p.radius) {
                                projectiles.splice(i, 1);
                                player.flow = Math.min(player.maxFlow, (player.flow || 0) + (player.maxFlow * 0.05));
                                player.flowGainTimer = 0;
                                effects.push({ type: 'circle', x: p.x, y: p.y, radius: 15, color: '#84ffff', life: 0.2, maxLife: 0.2 });
                            }
                        }
                    }

                    for (let e of enemies) {
                        if (Math.hypot(e.x - ab.x, e.y - ab.y) <= spinRadius + e.size/2) {
                            applyDamage(e, dmg * 0.3, 'slash'); // 6 hits of 0.3 dmg
                        }
                    }
                    
                    spinCount++;
                    if (spinCount >= 6) {
                        // Final explosion blast
                        effects.push({ type: 'surge_burst', x: ab.x, y: ab.y, radius: finalRadius, life: 0.35, maxLife: 0.35 });
                        for (let e of enemies) {
                            if (Math.hypot(e.x - ab.x, e.y - ab.y) <= finalRadius + e.size/2) {
                                applyDamage(e, dmg * 0.8, 'slash');
                            }
                        }
                    }
                });
            }
        },
        2: (sk, dmg) => { // Deploy / Recall (Toggle)
            if (player.stance === 'handheld') {
                if (player.flow >= player.maxFlow) player.empoweredAirborne = true;
                player.stance = 'airborne';
                effects.push({ type: 'blade_launch', x: player.x, y: player.y, flow: sk.selectedUpg === 'B', life: 0.35, maxLife: 0.35 });
                if (sk.selectedUpg === 'B') {
                    player.flow = Math.min(player.maxFlow, player.flow + (player.maxFlow * 0.30));
                    player.flowGainTimer = 0;
                }
            } else {
                effects.push({ type: 'blade_recall', x1: player.airborneBlade.x, y1: player.airborneBlade.y, x2: player.x, y2: player.y, life: 0.3, maxLife: 0.3 });
                effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 40, color: 'rgba(0, 229, 255, 0.8)', life: 0.3, maxLife: 0.3 });
                player.stance = 'handheld';
                player.flow = 0;
                player.empoweredAirborne = false;
                player.airborneBlade.x = player.x; player.airborneBlade.y = player.y;
                if (sk.selectedUpg === 'A') player.iFrames = 0.5;
            }
        },
        3: (sk, dmg) => { // Shadow Step / Spatial Swap
            if (player.stance === 'handheld') {
                const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let moveDist = Math.min(dist, equipment.boots && equipment.boots.name === 'Windwalker Steps' ? 400 : 300);
                const dashAngle = Math.atan2(dy, dx), dur = 0.1 + moveDist / 4000;
                const startX = player.x, startY = player.y;

                if (sk.selectedUpg === 'A') {
                    // Path of Blades - a phantom blade rides along with the dash, piercing everything on the way
                    projectiles.push({
                        x: startX, y: startY,
                        vx: Math.cos(dashAngle) * moveDist / dur, vy: Math.sin(dashAngle) * moveDist / dur,
                        radius: 85, color: '#00e5ff',
                        life: dur, // keeps pace with the swordsaint for exactly the length of the dash
                        type: 'pierce',
                        shape: 'phantom_blade_proj',
                        damage: dmg * 2.0,
                        pierce: true,
                        hitList: [],
                        isEnemy: false
                    });
                }

                player.iFrames = 0.3;
                const trail = { type: 'dash_trail', x1: startX, y1: startY, x2: startX, y2: startY, color: '#00e5ff', width: 14, life: dur + 0.2, maxLife: dur + 0.2 };
                effects.push(trail);
                startDash({
                    x: startX + (dx/dist)*moveDist, y: startY + (dy/dist)*moveDist, dur, kind: 'shadow_step', trail,
                    ghost: { color: '#00e5ff', glow: true, every: 0.012, life: 0.2 },
                    onArrive: () => {
                        player.iFrames = Math.max(player.iFrames, 0.15);
                        effects.push({ type: 'iai_flash', x1: startX, y1: startY, x2: player.x, y2: player.y, life: 0.35, maxLife: 0.35 });
                    }
                });

            } else {
                // Swap places with Airborne Blade
                let tmpX = player.x; let tmpY = player.y;
                player.x = player.airborneBlade.x; player.y = player.airborneBlade.y;
                player.airborneBlade.x = tmpX; player.airborneBlade.y = tmpY;
                
                // Add a more dramatic spatial swap effect
                effects.push({ type: 'spatial_swap', x0: tmpX, y0: tmpY, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
                spawnDashGhost('#00e5ff', true, 0.35, Math.atan2(player.y - tmpY, player.x - tmpX), tmpX, tmpY, 0);
                
                if (sk.selectedUpg === 'B') cooldowns.s1 = 0; // Reset Q (Blade Surge)
            }
        },
        4: (sk, dmg) => { // Blade Whirlwind / Shatter Storm
            if (player.stance === 'handheld') {
                // Creates a visually stunning vortex of blades
                effects.push({ type: 'katana_tornado', x: player.x, y: player.y, radius: 250, vortex: sk.selectedUpg === 'A', startAngle: Math.atan2(mouseY - player.y, mouseX - player.x), life: 0.8, maxLife: 0.8 });
                addShake(2.5);
                for(let i=enemies.length-1; i>=0; i--) {
                    let e = enemies[i];
                    if (Math.hypot(player.x - e.x, player.y - e.y) < 250 + e.size/2) {
                        applyDamage(e, dmg * 1.5, 'slash');
                        if (sk.selectedUpg === 'A') {
                            let [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
                            let pull = Math.max(0, Math.min(edist - (player.radius + e.size/2), 150)); // stop at contact range, not on top of the player
                            e.x += (edx/edist) * pull; e.y += (edy/edist) * pull;
                        }
                    }
                }
            } else {
                let ab = player.airborneBlade;
                let isPierce = sk.selectedUpg === 'B';
                
                // Visual explosion of the main blade
                effects.push({ type: 'shatter_burst', x: ab.x, y: ab.y, life: 0.4, maxLife: 0.4 });
                
                if (!player.miniBlades) player.miniBlades = [];
                for(let i=0; i<6; i++) {
                    let ang = (Math.PI*2 / 6) * i;
                    player.miniBlades.push({ 
                        x: ab.x, y: ab.y, 
                        angle: ang, 
                        life: 6.0, 
                        maxLife: 6.0,
                        attackTimer: 0,
                        pierce: isPierce
                    });
                }
            }
        },
        'rmb': () => {
            // "Phantom Wind" - Wide sweeping crowd-control slash to generate massive Flow when surrounded
            const slashAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            
            // Dash slightly into the strike
            spawnDashGhost('#84ffff', true, 0.25, slashAngle);
            player.x += Math.cos(slashAngle) * 60; 
            player.y += Math.sin(slashAngle) * 60; 
            clampToBounds(player, player.radius);
            player.iFrames = 0.4; // Safety during the emergency sweep

            effects.push({ type: 'gale_crescent', x: player.x, y: player.y, radius: 250, angle: slashAngle, life: 0.4, maxLife: 0.4 });
            
            let enemiesHit = 0;
            for (let i = enemies.length - 1; i >= 0; i--) {
                let e = enemies[i];
                if (Math.hypot(e.x - player.x, e.y - player.y) < 250 + e.size/2) {
                    let diff = Math.atan2(e.y - player.y, e.x - player.x) - slashAngle;
                    while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    
                    if (Math.abs(diff) <= Math.PI/2) { // 180 degree cone
                        applyDamage(e, activeClass.basicDmg * 2 + (player.bonusDmg || 0), 'slash');
                        e.x += Math.cos(slashAngle) * 100; // Strong knockback
                        e.y += Math.sin(slashAngle) * 100;
                        clampToBounds(e, e.size/2);
                        e.stunTimer = 1.0; // Stun to relieve pressure
                        enemiesHit++;
                        for (let m = 0; m < 4; m++) spawnParticle({ kind: 'dot', color: '#84ffff', x: e.x + jitter(16), y: e.y + jitter(16), vx: (player.x - e.x) / 0.45, vy: (player.y - e.y) / 0.45, size: 2, life: 0.45, drag: 0, grow: 0, spin: 0, rot: 0 }); // Flow streams back
                    }
                }
            }
            
            if (enemiesHit > 0) {
                // Restore flow to get them back into the fight
                let flowGained = enemiesHit * 10;
                if (equipment.gloves && equipment.gloves.name === 'Aether Grips') flowGained *= 1.1;
                player.flow = Math.min(player.maxFlow, player.flow + flowGained);
                
                effects.push({ type: 'text', text: '+' + Math.floor(flowGained) + ' FLOW', x: player.x, y: player.y - 40, color: '#00e5ff', life: 1.0, maxLife: 1.0 });
            }
        }
    },
    'Dragonknight': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*600, vy: (dy/dist)*600, radius: 14, color: '#e0e0e0', life: 2.0, type: 'shield_throw', shape: 'shield', damage: dmg, pierce: true, hitList: [], isEnemy: false, returning: false, sourceSkill: sk, startX: player.x, startY: player.y });
        },
        2: (sk, dmg) => {
            player.shield += calcUtility(50, sk.level); player.shieldTimer = calcUtility(5.0, sk.level);
            effects.push({ type: 'iron_bulwark', x: player.x, y: player.y, radius: 120, color: '#78909c', life: 0.5, maxLife: 0.5, upg: sk.selectedUpg });
            if (sk.selectedUpg === 'A') {
                for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 120 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'melee');
            }
            if (sk.selectedUpg === 'B') { buffs.msBoost = calcUtility(2.0, sk.level); player.frenzyStacks = Math.min(10, player.frenzyStacks + 3); }
        },
        3: (sk, dmg) => { // Thunder Leap: an arcing jump that comes down with a thunderclap
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 400);
            dustPuff(player.x, player.y, Math.atan2(dy, dx) + Math.PI, 2.4, 5);
            startDash({
                x: player.x + (dx / dist) * moveDist, y: player.y + (dy / dist) * moveDist,
                dur: 0.2 + moveDist / 2700, arc: 25 + moveDist * 0.12, kind: 'thunder_leap',
                ghost: { color: '#ff7043', glow: false, every: 0.035 },
                onArrive: () => {
                    if (sk.selectedUpg === 'A') {
                        const tx = player.x; const ty = player.y;
                        effects.push({ type: 'aftershock_zone', x: tx, y: ty, radius: 100, life: 1.0, maxLife: 1.0 });
                        after(1.0, () => {
                            effects.push({ type: 'thunder_slam', x: tx, y: ty, radius: 100, color: '#e53935', big: true, life: 0.5, maxLife: 0.5 });
                            for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 100 + enemies[i].size/2) applyDamage(enemies[i], dmg*1.5, 'melee');
                        });
                    } else if (sk.selectedUpg === 'B') {
                        for(let r=0; r<4; r++) { const angle = (Math.PI*2/4) * r; projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*500, vy: Math.sin(angle)*500, radius: 8, color: '#ffca28', life: 1.0, type: 'basic', shape: 'shrapnel', damage: dmg, pierce: false, isEnemy: false }); }
                    }
                    effects.push({ type: 'thunder_slam', x: player.x, y: player.y, radius: 80, color: '#ff7043', life: 0.5, maxLife: 0.5 });
                    for(let i=enemies.length-1; i>=0; i--) if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'melee');
                }
            });
        },
        4: (sk, dmg) => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let color = sk.selectedUpg === 'A' ? '#2196f3' : '#ff5722';
            const breath = sk.selectedUpg === 'A' ? 'frost' : sk.selectedUpg === 'B' ? 'shatter' : 'fire';
            const head = { type: 'dragon_head', angle: attackAngle, breath, tracking: true, life: 1.25, maxLife: 1.25 };
            effects.push(head); // skillfx_ult.js: the head turns to follow the cursor, and the flames go where it faces
            every(0.05, 21, () => {
                let spread = head.angle + (Math.random() - 0.5) * 0.8;
                projectiles.push({ x: player.x + Math.cos(spread)*20, y: player.y + Math.sin(spread)*20, vx: Math.cos(spread)*700, vy: Math.sin(spread)*700, radius: 15 + Math.random()*15, color: color, life: 0.6, type: 'pierce', shape: 'breath', breath, damage: dmg * 0.25, pierce: true, hitList: [], isEnemy: false });
            });
            
            if (sk.selectedUpg === 'A') {
                for(let i=enemies.length-1; i>=0; i--) {
                    if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 400 + enemies[i].size/2) {
                        let diff = Math.atan2(enemies[i].y-player.y, enemies[i].x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                        if (Math.abs(diff) <= 0.4) { enemies[i].slowTimer = 3.0; enemies[i].slowAmount = 0.7; }
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
            effects.push({ type: 'wyrm_rake', x: player.x, y: player.y, angle: attackAngle, life: 0.35, maxLife: 0.35 });
            effects.push({ type: 'dragon_head', angle: attackAngle, breath: 'fire', snap: true, life: 0.35, maxLife: 0.35 }); // the wyrm snaps forward
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
            if (sk.selectedUpg === 'B') { player.shield += calcUtility(40, sk.level); player.shieldTimer = calcUtility(5.0, sk.level); }
            for(let i=enemies.length-1; i>=0; i--) {
                if (Math.hypot(player.x-enemies[i].x, player.y-enemies[i].y) <= 180 + enemies[i].size/2) {
                    applyDamage(enemies[i], dmg, 'magic');
                    // Base nova chills (60% slow); Deep Freeze freezes solid
                    if (sk.selectedUpg === 'A') enemies[i].frozenTimer = 3.0;
                    else { enemies[i].slowTimer = 3.0; enemies[i].slowAmount = 0.6; }
                }
            }
        },
        3: (sk, dmg) => {
            player.arcaneResonance = true; const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, 350); const startX = player.x; const startY = player.y;
            spawnDashGhost('#82b1ff', true, 0.4, Math.atan2(dy, dx));
            player.x += (dx / dist) * moveDist; player.y += (dy / dist) * moveDist; clampToBounds(player, player.radius);
            effects.push({ type: 'blink', x0: startX, y0: startY, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
            if (sk.selectedUpg === 'A') {
                let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                if (target) {
                    const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                    projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*700, vy: (ty/td)*700, radius: 8, color: '#e040fb', life: 1.5, type: 'basic', shape: 'arcane_missile', damage: calcDmg(30), pierce: false, isEnemy: false });
                }
            }
            if (sk.selectedUpg === 'B') {
                effects.push({ type: 'random_ice_spikes', x: startX, y: startY, radius: 100, color: '#81d4fa', life: 0.4, maxLife: 0.4, spikes: [{xOffset: 0, yOffset: 0, size: 25}, {xOffset: 20, yOffset: 20, size: 15}, {xOffset: -20, yOffset: -20, size: 15}] });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(startX-enemies[i].x, startY-enemies[i].y) <= 100 + enemies[i].size/2) { applyDamage(enemies[i], dmg, 'magic'); enemies[i].slowTimer = 2.0; enemies[i].slowAmount = 0.6; } }
            }
        },
        4: (sk, dmg) => {
            player.arcaneResonance = true;
            const tx = Math.max(currentMap.left, Math.min(currentMap.right, mouseX)); 
            const ty = Math.max(currentMap.top, Math.min(currentMap.bottom, mouseY)); 
            let delay = sk.selectedUpg === 'A' ? 0.75 : 1.0;
            effects.push({ type: 'meteor_fall', x: tx, y: ty, radius: 150, life: delay, maxLife: delay }); // skillfx_ult.js
            
            after(delay, () => {
                effects.push({ type: 'fiery_explosion', x: tx, y: ty, radius: 150, life: 0.5, maxLife: 0.5 });
                effects.push({ type: 'molten_scorch', x: tx, y: ty, radius: 120, life: 3.0, maxLife: 3.0 });
                burst(tx, ty, 0, Math.PI * 2, 14, { kind: 'debris', color: '#4e342e', size: 5, life: 0.7, speed: [150, 380], drag: 4 });
                for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 150 + enemies[i].size/2) applyDamage(enemies[i], dmg, 'magic'); }
                if (sk.selectedUpg === 'B') {
                    effects.push({ type: 'echo_charge', x: tx, y: ty, radius: 80, life: 1.5, maxLife: 1.5 });
                    after(1.5, () => {
                        effects.push({ type: 'fiery_explosion', x: tx, y: ty, radius: 80, life: 0.5, maxLife: 0.5 });
                        effects.push({ type: 'molten_scorch', x: tx, y: ty, radius: 70, life: 2.0, maxLife: 2.0 });
                        for(let i=enemies.length-1; i>=0; i--) { if (Math.hypot(tx-enemies[i].x, ty-enemies[i].y) <= 80 + enemies[i].size/2) applyDamage(enemies[i], dmg*0.5, 'magic'); }
                    });
                }
            });
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x); const endX = player.x + Math.cos(angle) * 500; const endY = player.y + Math.sin(angle) * 500;
            effects.push({ type: 'arcane_beam', x1: player.x + Math.cos(angle) * 45, y1: player.y + Math.sin(angle) * 45, x2: endX, y2: endY, life: 0.45, maxLife: 0.45 });
            const l2 = 500*500;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i]; let t = ((e.x - player.x) * (endX - player.x) + (e.y - player.y) * (endY - player.y)) / l2; t = Math.max(0, Math.min(1, t));
                const projX = player.x + t * (endX - player.x); const projY = player.y + t * (endY - player.y);
                if (Math.hypot(e.x - projX, e.y - projY) < e.size/2 + 20) {
                    applyDamage(e, calcDmg(120), 'magic');
                    burst(e.x, e.y, angle, 1.4, 8, { kind: 'spark', color: '#b388ff', size: 2.2, life: 0.25, speed: [150, 350], drag: 5 });
                }
            }
        }
    },
    'Ranger': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY); let bounces = sk.selectedUpg === 'A' ? 5 : 3; 
            if(dist>0) projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*900, vy: (dy/dist)*900, radius: 6, color: '#ffeb3b', life: 3.0, type: 'ricochet', shape: 'arrow', damage: dmg, pierce: false, isEnemy: false, bounces: bounces, hitList: [], sourceSkill: sk });
        },
        2: (sk, dmg) => {
            let healAmt = sk.selectedUpg === 'A' ? 30 : 15; player.hp = Math.min(player.maxHp, player.hp + calcUtility(healAmt, sk.level)); buffs.msBoost = sk.selectedUpg === 'B' ? calcUtility(4.0, sk.level) : calcUtility(2.0, sk.level);
            effects.push({ type: 'wind_swirl', x: player.x, y: player.y, radius: 60, color: '#4caf50', life: 0.6, maxLife: 0.6 }); updateHUD();
        },
        3: (sk, dmg) => { // Vault: a quick hop through the air; Parting Shot fires from the top of the jump
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const moveDist = Math.min(dist, sk.selectedUpg === 'B' ? 500 : 300);
            const ang = Math.atan2(dy, dx);
            dustPuff(player.x, player.y, ang + Math.PI, 1.8, 4);
            burst(player.x, player.y, ang + Math.PI, 1.6, 5, { kind: 'leaf', color: '#81c784', size: 6, life: 0.5, speed: [80, 180], drag: 4 });
            startDash({
                x: player.x + (dx / dist) * moveDist, y: player.y + (dy / dist) * moveDist,
                dur: 0.2 + moveDist / 3000, arc: 20 + moveDist * 0.08, kind: 'vault',
                ghost: { color: '#a5d6a7', glow: false, every: 0.04 },
                onApex: () => {
                    if (sk.selectedUpg !== 'A') return;
                    let target = getNearestEnemyFromPoint(player.x, player.y, 400);
                    if (target) {
                        const [tx, ty, td] = getVector(player.x, player.y, target.x, target.y);
                        projectiles.push({ x: player.x, y: player.y, vx: (tx/td)*1200, vy: (ty/td)*1200, radius: 8, color: '#00e676', life: 1.5, type: 'basic', shape: 'arrow', damage: dmg, pierce: false, isEnemy: false });
                        burst(player.x, player.y - player.z, Math.atan2(ty, tx), 0.8, 6, { kind: 'spark', color: '#b9f6ca', size: 2, life: 0.2, speed: [150, 300], drag: 5 });
                    }
                },
                onArrive: () => effects.push({ type: 'vault_land', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 })
            });
        },
        4: (sk, dmg) => { // Volley: arrows loosed into the sky rain down on the target area
            const heavy = sk.selectedUpg === 'A', rain = sk.selectedUpg === 'B';
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const reach = Math.min(dist, 500);
            const [tx, ty] = clampPointToMap(player.x + (dx/dist)*reach, player.y + (dy/dist)*reach, 20);
            const radius = rain ? 150 : 110, count = rain ? 18 : 10, hitR = heavy ? 36 : 24;
            const delay = 0.45, spread = 0.35;
            const arrows = [];
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt((i + Math.random()) / count) * radius; // even coverage of the circle
                const ax = tx + Math.cos(a) * r, ay = ty + Math.sin(a) * r, t = delay + Math.random() * spread;
                arrows.push({ x: ax, y: ay, t });
                after(t, () => {
                    arrowImpactFx(ax, ay, heavy); // skillfx_ult.js
                    for (let k = enemies.length - 1; k >= 0; k--) {
                        const e = enemies[k];
                        if (e.dead || Math.hypot(e.x - ax, e.y - ay) > hitR + e.size / 2) continue;
                        applyDamage(e, dmg, 'ranged');
                        if (heavy) { // Heavy Shafts: the impact staggers
                            if (!(e.slowTimer > 0) || e.slowAmount < 0.5) e.slowAmount = 0.5;
                            e.slowTimer = Math.max(e.slowTimer || 0, 1.0);
                        }
                    }
                });
            }
            effects.push({ type: 'arrow_rain', x: tx, y: ty, sx: player.x, sy: player.y, radius, arrows, heavy, life: delay + spread + 1.6, maxLife: delay + spread + 1.6 });
        },
        'rmb': () => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            effects.push({ type: 'thunderclap', x: player.x + Math.cos(baseAngle) * 20, y: player.y + Math.sin(baseAngle) * 20, angle: baseAngle, life: 0.25, maxLife: 0.25 });
            for(let i = -1; i <= 1; i++) projectiles.push({ x: player.x, y: player.y, vx: Math.cos(baseAngle+(i*0.2))*1500, vy: Math.sin(baseAngle+(i*0.2))*1500, radius: 8, color: '#2196f3', life: 1.5, type: 'pierce', shape: 'storm_arrow', damage: calcDmg(60), pierce: true, hitList: [], isEnemy: false });
        }
    },
    'Nightblade': {
        1: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let count = 5; let pierce = sk.selectedUpg === 'A'; let returnDmg = sk.selectedUpg === 'B';
            effects.push({ type: 'knife_fan', x: player.x, y: player.y, angle: baseAngle, life: 0.2, maxLife: 0.2 });
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
            let duration = calcUtility(5.0, sk.level);
            effects.push({ type: 'smoke_bomb', x: player.x, y: player.y, radius: radius, color: smokeColor, life: duration, maxLife: duration, poison: poison, dmg: dmg, particles: particles });
            if (sk.selectedUpg === 'B') { buffs.slowed = 0; buffs.rooted = 0; }
        },
        3: (sk, dmg) => { // Phantom Dash: a blur of shadow that cuts everything it passes through
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let moveDist = sk.selectedUpg === 'A' ? Math.min(dist, 600) : Math.min(dist, 300);
            let pDashAngle = Math.atan2(dy, dx);
            const hitList = [];
            const trail = { type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x, y2: player.y, color: '#9c27b0', width: 18, life: 0.35, maxLife: 0.35 };
            effects.push(trail);
            burst(player.x, player.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#311b92', size: 6, grow: 26, life: 0.5, speed: [30, 90], drag: 3 });
            player.iFrames = 0.4;
            startDash({
                x: player.x + (dx/dist)*moveDist, y: player.y + (dy/dist)*moveDist,
                dur: 0.08 + moveDist / 6000, ease: 'out', kind: 'phantom_dash', trail,
                ghost: { color: '#b388ff', glow: true, every: 0.012, life: 0.22 },
                onStep: (x0, y0, x1, y1) => { // hits whatever the dash passes through this frame
                    for(let i=enemies.length-1; i>=0; i--) {
                        const e = enemies[i];
                        if (e.dead || hitList.includes(e) || distToSegment(e.x, e.y, x0, y0, x1, y1) >= e.size/2 + 20) continue;
                        hitList.push(e);
                        applyDamage(e, dmg, 'phantom_dash', pDashAngle);
                        effects.push({ type: 'shadow_cut', x: e.x, y: e.y, angle: pDashAngle, radius: e.size * 0.6 + 16, life: 0.3, maxLife: 0.3 });
                    }
                }
            });
            if (sk.selectedUpg === 'B') {
                if (!player.phantomChargeUsed) { player.phantomChargeUsed = true; cooldowns.s3 = 0.5; }
                else { player.phantomChargeUsed = false; }
            }
        },
        4: (sk, dmg) => {
            effects.push({ type: 'death_mark_wave', x: player.x, y: player.y, radius: 600, life: 0.6, maxLife: 0.6 });
            let targets = enemies.filter(e => Math.hypot(player.x - e.x, player.y - e.y) <= 600);
            targets.forEach(e => e.markAngle = Math.random() * Math.PI * 2);
            buffs.deathMarkActive = calcUtility(5.0, sk.level);
            targets.forEach((target, index) => {
                let delay = Math.min(index * 80, 1500); 
                after(delay / 1000, () => {
                    if (target.hp <= 0 || target.dead) return;
                    let markAng = target.markAngle !== undefined ? target.markAngle : Math.random() * Math.PI * 2;
                    let startX = target.x + Math.cos(markAng) * 200;
                    let startY = target.y + Math.sin(markAng) * 200;
                    let dashAngle = Math.atan2(target.y - startY, target.x - startX);
                    // a shadow clone blinks in on the weak side and stabs straight through
                    effects.push({ type: 'clone_strike', x0: startX, y0: startY, x1: target.x + Math.cos(dashAngle) * 40, y1: target.y + Math.sin(dashAngle) * 40, angle: dashAngle, life: 0.4, maxLife: 0.4 });
                    effects.push({ type: 'shadow_cut', x: target.x, y: target.y, angle: dashAngle, radius: target.size * 0.6 + 18, life: 0.3, maxLife: 0.3 });
                    let ultDmg = dmg * 3; 
                    if (sk.selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.05);
                    applyDamage(target, ultDmg, 'assassin_skill', dashAngle);
                });
            });
        },
        'rmb': () => {
            let target = getNearestEnemyFromPoint(mouseX, mouseY, 150);
            if (!target) target = getNearestEnemyFromPoint(player.x, player.y, 400);
            if (target) {
                let execAngle = Math.atan2(target.y - player.y, target.x - player.x);
                effects.push({ type: 'dagger_flash', x1: player.x, y1: player.y, x2: target.x, y2: target.y, life: 0.15, maxLife: 0.15 });
                burst(player.x, player.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#311b92', size: 5, grow: 22, life: 0.45, speed: [20, 70], drag: 3 });
                
                // Teleport behind target based on strike angle
                player.x = target.x + Math.cos(execAngle) * 30; 
                player.y = target.y + Math.sin(execAngle) * 30; 
                clampToBounds(player, player.radius);
                
                burst(player.x, player.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#311b92', size: 5, grow: 22, life: 0.45, speed: [20, 70], drag: 3 });
                // Small stab damage for teleporting
                applyDamage(target, calcDmg(15), 'assassin_skill', execAngle);

                // Only deal execute damage if hitting the weakpoint side
                if (target.markAngle !== undefined) {
                    // Check angle between weakpoint side and the angle from target to player
                    let hitAngle = Math.atan2(player.y - target.y, player.x - target.x);
                    let diff = target.markAngle - hitAngle;
                    while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    
                    if (Math.abs(diff) <= Math.PI/3) { // 60-degree window to hit the weakpoint
                        applyDamage(target, calcDmg(150), 'execute', execAngle);
                        effects.push({ type: 'text', text: 'WEAKPOINT!', x: target.x, y: target.y - 30, color: '#f44336', life: 0.8, maxLife: 0.8 });
                        burst(target.x, target.y, execAngle, 2.6, 12, { kind: 'spark', color: '#ea80fc', size: 3, life: 0.35, speed: [150, 380], drag: 5 }); // the mark shatters
                        if (target.hp <= 0 || target.dead) cooldowns.rmb = 0;
                        target.markAngle = undefined; // consume mark
                    }
                }
            }
        }
    },
    'Machinist': {
        1: (sk, dmg) => spawnTurret(mouseX, mouseY, sk.selectedUpg, dmg),
        2: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let tx = player.x + (dx/dist)*Math.min(dist, 400); let ty = player.y + (dy/dist)*Math.min(dist, 400);
            let isRoot = sk.selectedUpg === 'A'; let isNetwork = sk.selectedUpg === 'B';
            projectiles.push({
                x: tx, y: ty, vx: 0, vy: 0, radius: 15, color: '#00e5ff', life: 8.0, type: 'tesla_coil_trap', damage: dmg, isEnemy: false, tickTimer: 0, rootedList: [], fieldRadius: isRoot ? 200 : 150,
                customUpdate: function(dt, p) {
                    this.tickTimer -= dt;
                    if (this.tickTimer <= 0) {
                        effects.push({ type: 'tesla_pulse', x: this.x, y: this.y, radius: isRoot ? 200 : 150, life: 0.3, maxLife: 0.3 });
                        let zaps = 0;
                        for (let i = enemies.length - 1; i >= 0; i--) {
                            let e = enemies[i];
                            if (Math.hypot(e.x - this.x, e.y - this.y) < (isRoot ? 200 : 150) + e.size/2) {
                                if (zaps++ < 5) effects.push({ type: 'lightning', x1: this.x, y1: this.y, x2: e.x, y2: e.y, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                                applyDamage(e, this.damage, 'magic');
                                e.shockTimer = 0.6;
                                // High Voltage: root each enemy once per coil, when it first enters the field
                                if (isRoot && !this.rootedList.includes(e)) { e.rootedTimer = 1.0; this.rootedList.push(e); }
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
            
            if (sk.selectedUpg === 'A') { player.shield += calcUtility(100, sk.level); player.shieldTimer = calcUtility(4.0, sk.level); }
            if (sk.selectedUpg === 'B') {
                // Hologram absorbs one enemy projectile and briefly draws nearby enemies toward it
                let decoyX = player.x; let decoyY = player.y;
                player.phantomDecoy = { x: decoyX, y: decoyY, life: 2.0 };
                for(let e of enemies) {
                    if (Math.hypot(e.x - decoyX, e.y - decoyY) < 300 && !e.type.startsWith('boss')) { e.x += (decoyX - e.x)*0.05; e.y += (decoyY - e.y)*0.05; }
                }
            }
            
            let [dx, dy, ddist] = getVector(player.x, player.y, targetX, targetY);
            if (ddist > 10) {
                player.grappleTarget = { x: targetX, y: targetY, kind: 'magnet', onArrive: () => magClank(targetX, targetY) };
                burst(player.x, player.y, Math.atan2(dy, dx), 0.6, 6, { kind: 'spark', color: '#80d8ff', size: 2, life: 0.2, speed: [200, 400], drag: 5 });
            }
        },
        4: (sk, dmg) => {
            const duration = calcUtility(6.0, sk.level);
            buffs.overclockTimer = duration; buffs.overclockMax = duration;
            effects.push({ type: 'overclock_burst', life: 0.6, maxLife: 0.6 });
            for(let p of projectiles) { if (p.type === 'turret' || p.type === 'tesla_coil_trap') p.life = p.type === 'turret' ? 10.0 : 8.0; }
            if (sk.selectedUpg === 'B') {
                const turretSkill = activeClass.skills[1];
                const turretDmg = calcDmg(turretSkill.baseDmg, Math.max(1, turretSkill.level));
                // the two turrets drop in from the sky, one after the other
                spawnTurret(player.x - 30, player.y, turretSkill.selectedUpg, turretDmg); projectiles[projectiles.length - 1].dropIn = 0.35;
                spawnTurret(player.x + 30, player.y, turretSkill.selectedUpg, turretDmg); projectiles[projectiles.length - 1].dropIn = 0.5;
            }
            if (sk.selectedUpg === 'A') {
                // Nuclear Payload: when Overclock ends, every turret detonates (volatile turrets explode for 3x their damage on expiry)
                after(duration, () => {
                    for (let p of projectiles) {
                        if (p.type === 'turret') { p.life = 0; p.volatile = true; }
                    }
                });
            }
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            projectiles.push({ 
                x: player.x, y: player.y, 
                vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700, 
                radius: 25, color: '#b0bec5', life: 1.5, 
                type: 'net_throw', shape: 'net', damage: calcDmg(10), 
                pierce: false, hitList: [], isEnemy: false 
            });
        }
    },
    'Druid': {
        1: (sk, dmg) => { // Bramble Core / Vine Whip
            if (buffs.wildFormTimer > 0) {
                // Vine Whip
                const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
                effects.push({ type: 'vine_whip', x: player.x, y: player.y, radius: 250, angle: angle, life: 0.3, maxLife: 0.3 });
                let hitInThorns = false;
                for(let i=enemies.length-1; i>=0; i--) {
                    const e = enemies[i];
                    if (Math.hypot(player.x-e.x, player.y-e.y) <= 250 + e.size/2) {
                        let diff = Math.atan2(e.y-player.y, e.x-player.x) - angle;
                        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                        if (Math.abs(diff) <= Math.PI/4) {
                            if (effects.some(ef => ef.type === 'thorn_patch' && Math.hypot(e.x - ef.x, e.y - ef.y) <= ef.radius + e.size/2)) hitInThorns = true;
                            applyDamage(e, dmg, 'magic');
                            e.x -= Math.cos(angle) * 30; e.y -= Math.sin(angle) * 30; // Pull
                        }
                    }
                }
                if (sk.selectedUpg === 'B' && hitInThorns) {
                    cooldowns.s1 = 0;
                    effects.push({ type: 'text', text: 'RESET!', x: player.x, y: player.y - 40, color: '#8bc34a', life: 0.6, maxLife: 0.6 });
                }
            } else {
                // Bramble Core
                const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*500, vy: (dy/dist)*500, radius: 8, color: '#8bc34a', life: 1.0, type: 'bramble_core', shape: 'circle', damage: dmg, pierce: false, hitList: [], isEnemy: false, targetX: mouseX, targetY: mouseY });
            }
        },
        2: (sk, dmg) => { // Barkskin Shift
            player.shield = 100 + (sk.level * 20);
            player.shieldTimer = 5.0;
            buffs.barkskin = true; // ends when the shield breaks or expires (see update)
            buffs.barkskinDmg = calcDmg(60, sk.level); // Splintering Shell explosion
            // Break slow/root
            buffs.slowed = 0; buffs.rooted = 0;
            effects.push({ type: 'bark_form', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 });
        },
        3: (sk, dmg) => { // Spore Burst / Feral Pounce
            if (buffs.wildFormTimer > 0) {
                // Feral Pounce
                // Predatory Momentum: spend the stored extra charge so the next pounce is ready almost immediately
                if (sk.selectedUpg === 'B' && player.pounceCharges > 0) {
                    player.pounceCharges--;
                    player.pounceRecharge = cooldownMax.s3 || sk.maxCd;
                    cooldowns.s3 = 0.3; cooldownMax.s3 = 0.3;
                }
                // Gnarled Heartwood Totem stacks: +10% DMG each, consumed by this pounce
                let pounceMult = 2.0 * (1 + buffs.pounceStacks * 0.1);
                buffs.pounceStacks = 0;

                let dashDist = 250;
                const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
                dustPuff(player.x, player.y, angle + Math.PI, 1.6, 4, '#6d5d4b');
                startDash({
                    x: player.x + Math.cos(angle) * dashDist, y: player.y + Math.sin(angle) * dashDist,
                    dur: 0.17, arc: 18, ease: 'out', kind: 'pounce',
                    ghost: { color: '#a1887f', glow: false, every: 0.03, life: 0.2 },
                    onArrive: () => {
                        effects.push({ type: 'pounce_rake', x: player.x, y: player.y, angle, radius: 100, life: 0.4, maxLife: 0.4 });
                        for(let i=enemies.length-1; i>=0; i--) {
                            const e = enemies[i];
                            if (Math.hypot(e.x - player.x, e.y - player.y) <= 100) { applyDamage(e, dmg * pounceMult, 'physical'); }
                        }
                    }
                });
            } else {
                // Spore Burst
                effects.push({ type: 'spore_burst', x: player.x, y: player.y, radius: 150, life: 0.5, maxLife: 0.5 });
                let hits = 0;
                for(let i=enemies.length-1; i>=0; i--) {
                    const e = enemies[i];
                    if (Math.hypot(e.x - player.x, e.y - player.y) <= 150) {
                        hits++;
                        applyDamage(e, dmg, 'magic');
                        // Apply baseline spores
                        let maxStacks = 3;
                        let dpsPerStack = dmg * 0.25;
                        if (!e.sporeStacks) e.sporeStacks = 0;
                        e.sporeStacks = Math.min(maxStacks, e.sporeStacks + 1);
                        e.sporeTimer = 5.0;
                        e.sporeDps = dpsPerStack * e.sporeStacks;
                        
                        const pushAngle = Math.atan2(e.y - player.y, e.x - player.x);
                        e.x += Math.cos(pushAngle) * 50; e.y += Math.sin(pushAngle) * 50;
                    }
                }
                // Spore Surge: +15% move speed per enemy hit for 3s (capped at +75%)
                if (sk.selectedUpg === 'A' && hits > 0) {
                    buffs.sporeSurgeTimer = 3.0;
                    buffs.sporeSurgeBonus = Math.min(0.75, hits * 0.15);
                }
            }
        },
        4: (sk, dmg) => { // Aspect of the Wild
            if (buffs.wildFormTimer > 0) {
                wildRevertFx(); // skillfx_ult.js: the wolf crumbles into leaves
                buffs.wildFormTimer = 0; // Revert Toggle
            } else {
                // Feral Beast transformation toggle
                buffs.wildFormTimer = Infinity;
                // Predatory Momentum: transforming instantly readies a Feral Pounce
                if (activeClass.skills[3].level > 0 && activeClass.skills[3].selectedUpg === 'B') cooldowns.s3 = 0;
                
                effects.push({ type: 'wild_shift', x: player.x, y: player.y, radius: 200, life: 0.7, maxLife: 0.7 }); // vine cocoon, then the roar
                
                for(let i=enemies.length-1; i>=0; i--) {
                    const e = enemies[i];
                    if (Math.hypot(e.x - player.x, e.y - player.y) <= 200) { applyDamage(e, dmg, 'magic'); e.stunTimer = 1.0; }
                }
                
                if (sk.selectedUpg === 'A') {
                    effects.push({ type: 'spore_cloud', x: player.x, y: player.y, radius: 200, color: 'rgba(205, 220, 57, 0.4)', life: 10.0, maxLife: 10.0, isFriendly: true, dmg: sk.baseDmg });
                }
            }
        },
        'rmb': () => {
            // Thistle-Grip Claws (Gnarled Heartwood Totem): thorny claws rake a wide cone, seeding a Spore stack and briefly rooting everything hit
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const dmg = calcDmg(40);
            effects.push({ type: 'spirit_paw', x: player.x, y: player.y, angle: angle, life: 0.4, maxLife: 0.4 });
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) > 180 + e.size/2) continue;
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - angle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                if (Math.abs(diff) > Math.PI/3) continue;
                applyDamage(e, dmg, 'physical');
                e.sporeStacks = Math.min(3, (e.sporeStacks || 0) + 1);
                e.sporeTimer = 5.0;
                e.sporeDps = dmg * 0.25 * e.sporeStacks;
                if (!e.type.startsWith('boss')) e.rootedTimer = 0.75;
                burst(e.x, e.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#9ccc65', size: 4, grow: 20, life: 0.5, speed: [20, 70], drag: 3 }); // seeded spores
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

            let step = player.comboStep || 0;
            player.lastAttackStep = step;
            player.comboStep = (step + 1) % 3;
            player.comboTimer = 1.0; // Wait 1s max before resetting back to 1st hit

            let hitRadius = (step === 2) ? 170 : 130; 
            let effectType = (step === 2) ? 'precision_thrust' : 'precision_slash';
            let angleThreshold = (step === 2) ? (Math.PI/6) : (Math.PI/3); 
            
            // On step 1, we flip the rendering visually for alternate swipe in main.js, but here logic is symmetrical
            effects.push({ type: effectType, x: player.x, y: player.y, radius: hitRadius, angle: attackAngle, color: '#00e5ff', life: 0.15, maxLife: 0.15 }); 
            
            let hitAnything = false;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= hitRadius + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; 
                    while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    
                    if (Math.abs(diff) <= angleThreshold) { 
                        let mult = (step === 2) ? 1.5 : 1.0; // 3rd hit deals 50% more dmg
                        applyDamage(e, dmg * mult, 'slash'); 
                        hitAnything = true;
                    }
                }
            }
            if (hitAnything) {
                let flowGain = (step === 2) ? 20 : 10;
                if (equipment.gloves && equipment.gloves.name === 'Aether Grips') flowGain *= 1.1; // +10% more Flow
                player.flow = Math.min(player.maxFlow, player.flow + flowGain);
                player.flowGainTimer = 0;
            }
        } else if (player.stance === 'airborne') {
            // In airborne mode, basic attack doesn't strictly fire a one-off projectile anymore.
            // The AI companion loop handles continuous damage and following mouse smoothly.
        }
    },
    'censer': (dmg) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        projectiles.push({
            x: player.x, y: player.y, vx: Math.cos(attackAngle) * 500, vy: Math.sin(attackAngle) * 500, radius: 12,
            color: buffs.lastSpellClass === 'shadow' ? '#9c27b0' : '#fbc02d', life: 0.8, type: 'censer_pulse', shape: 'circle',
            damage: dmg, pierce: true, hitList: [], isEnemy: false,
            isInSanctuary: buffs.inSanctuary // doubles zeal gained if fired from inside a Sanctuary
        });
    },
    'sword': (dmg) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        effects.push({ type: 'slash', x: player.x, y: player.y, radius: 110, angle: attackAngle, color: '#e0e0e0', life: 0.15, maxLife: 0.15 }); 
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= 110 + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= (Math.PI/1.5)/2) applyDamage(e, dmg, 'melee_basic');
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
            projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*700, vy: (dy/dist)*700, radius: 4, color: '#e0e0e0', life: 1.5, type: 'basic', shape: 'arrow', damage: dmg, pierce: false, hitList: [], isEnemy: false, resonance: false });
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
        
        after(0.15, () => {
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
        });
    },
    'totem': (dmg) => {
        if (buffs.wildFormTimer > 0) {
            // Wild Form combo: left claw rake, right claw rake, then a lunging Bite
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            const step = player.wolfComboStep || 0;
            player.lastWolfStep = step;
            player.wolfComboStep = (step + 1) % 3;
            player.wolfComboTimer = 1.0; // the combo resets after 1s without attacking
            const isBite = step === 2;
            let reach = 100, halfArc = (Math.PI/1.5)/2;

            if (isBite) {
                // Lunge toward the aim, stopping short of the first enemy in the way
                const target = getNearestEnemyFromPoint(player.x, player.y, 60);
                const lunge = target ? 0 : 40;
                player.x += Math.cos(attackAngle) * lunge; player.y += Math.sin(attackAngle) * lunge; clampToBounds(player, player.radius);
                dmg *= 1.75; reach = 110; halfArc = Math.PI / 6;
            } else {
                const side = step === 0 ? -1 : 1;
                effects.push({ type: 'claw_swipe', x: player.x, y: player.y, radius: 100, angle: attackAngle + side * 0.25, color: '#d84315', life: 0.15, maxLife: 0.15 });
            }

            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= reach + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle;
                    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

                    if (Math.abs(diff) <= halfArc) {
                        applyDamage(e, dmg, 'melee_basic');
                        if (isBite) {
                            if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.25);
                            effects.push({ type: 'wolf_bite', x: e.x, y: e.y, angle: attackAngle, radius: Math.max(14, e.size * 0.6), life: 0.35, maxLife: 0.35 });
                        }
                        
                        // Popping Spores logic
                        if (e.sporeTimer && e.sporeTimer > 0) {
                            let popDmg = e.sporeTimer * e.sporeDps; // Massive instantaneous rupture
                            // Safely apply damage without modifying e while iterating (though safe, checkEnemyDeath protects)
                            applyDamage(e, popDmg * 1.5, 'physical');
                            e.sporeTimer = 0; // Clear infection
                            e.sporeDps = 0;
                            effects.push({ type: 'text', text: 'POP!', x: e.x, y: e.y - e.size, color: '#4caf50', life: 0.8, maxLife: 0.8 });
                            effects.push({ type: 'circle', x: e.x, y: e.y, radius: e.size * 1.5, color: 'rgba(76, 175, 80, 0.4)', life: 0.2, maxLife: 0.2 });
                            
                            // Check R Path B (Apex Predator) safely
                            if (activeClass && activeClass.skills && activeClass.skills['4'] && activeClass.skills['4'].selectedUpg === 'B') {
                                player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02);
                            }
                        }
                    }
                }
            }
        } else {
            // Caster Form: Ranged Spore/Totem Bolt
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if (dist > 0) {
                projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*600, vy: (dy/dist)*600, radius: 5, color: '#4caf50', life: 1.5, type: 'druid_spore', shape: 'circle', damage: dmg, pierce: false, hitList: [], isEnemy: false });
            }
        }
    },
    'scattergun': (dmg) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let isPierce = buffs.overclockTimer > 0;
        const count = 9;
        const spread = 0.5;
        for(let i=0; i<count; i++) {
            let offset = (Math.random() * spread) - (spread / 2);
            let speedMod = 800 + Math.random() * 400;
            projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle + offset)*speedMod, vy: Math.sin(angle + offset)*speedMod, radius: 4, color: '#ffb74d', life: 0.35 + Math.random() * 0.15, type: 'scattergun', shape: 'bullet', damage: dmg * 0.7, pierce: isPierce, hitList: [], isEnemy: false });
        }
        player.x -= Math.cos(angle) * 8; player.y -= Math.sin(angle) * 8; clampToBounds(player, player.radius);
    }
};