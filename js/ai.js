// ==========================================
// ai.js - Enemy and Boss Logic
// ==========================================

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
        let projShape = e.type === 'archer' ? 'arrow' : 'slime_blob';
        projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*350, vy: (edy/edist)*350, radius: 6, color: e.type==='archer' ? '#8d6e63' : '#ba68c8', life: 3.0, isEnemy: true, damage: e.dmg, shape: projShape });
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
            projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*400, vy: (edy/edist)*400, radius: 6, color: '#ff5722', life: 5.0, isEnemy: true, damage: e.dmg, shape: 'arrow' });
            e.attackTimer = 1.2; 
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
                for(let r=-2; r<=2; r++) { projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle+(r*0.15))*500, vy: Math.sin(baseAngle+(r*0.15))*500, radius: 6, color: '#ff9800', life: 2.0, isEnemy: true, damage: e.dmg, shape: 'knife' }); }
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
                    e.stateTimer = e.state === 'lunge' ? 0.6 : 1.5;
                    if (e.state === 'lunge') {
                        let px = player.x; let py = player.y;
                        if (player.isMoving) {
                            px += (keys.d ? 1 : (keys.a ? -1 : 0)) * player.speed * 0.4;
                            py += (keys.s ? 1 : (keys.w ? -1 : 0)) * player.speed * 0.4;
                        }
                        let [pdx, pdy, pdist] = getVector(e.x, e.y, px, py);
                        e.dashVx = (pdx/pdist) * curSpd * 14.0;
                        e.dashVy = (pdy/pdist) * curSpd * 14.0;
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
            if (e.stateTimer > 0.2) {
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.x + e.dashVx*0.4, y2: e.y + e.dashVy*0.4, color: 'rgba(255,0,0,0.5)', life: 0.1, maxLife: 0.1, lineWidth: 24 });
            } else { 
                e.x += e.dashVx * dt; e.y += e.dashVy * dt; 
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size/2 + player.radius + 15) { takeDamage(e.dmg * 2); e.state = 'idle'; e.stateTimer = 1.5; } 
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 0.8; }
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
                // ADDED shape: 'spear' to the end of this projectile push
                projectiles.push({ x: e.x, y: e.y, vx: Math.cos(e.volleyAngle)*600, vy: Math.sin(e.volleyAngle)*600, radius: 8, color: '#ff9800', life: 3.0, isEnemy: true, damage: e.dmg, shape: 'spear' });
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