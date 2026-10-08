// ==========================================
// paladin.js - Paladin: Celestial Anchor mechanic, skills, and visuals
// ==========================================
// The Grand Mace lives in player.hammer and is always in one of four states:
//   'equipped'  - in hand: basic attacks are 120° shockwave smashes
//   'outbound'  - flying to where Q threw it, hitting enemies on the way
//   'deployed'  - stuck in the ground: pulses threat, enables Bastion Dome and Iron Pull
//   'returning' - flying back after a Q recast, dragging enemies along
// Whenever it is not 'equipped', the Paladin fights with a light shield (-15% basic DMG, +15% armor).

const HAMMER_THROW_RANGE = 500;
const HAMMER_HIT_RADIUS = 30;
const HAMMER_COMMIT_DIST = 260; // returning hammer stops homing and flies straight from this far out (~0.19s to react)
const HAMMER_CATCH_REACH = 15;  // how far beyond the Paladin's body the hammer still counts as caught
const HAMMER_PULSE_RADIUS = 200;
const DOME_RADIUS = 200;
const WRATH_RADIUS = 220;
let paladinDomeCounter = 0;

function isPaladin() { return activeClass && activeClass.name === 'Paladin'; }
function hammerAway() { return isPaladin() && player.hammer && player.hammer.state !== 'equipped'; }
function hammerDeployed() { return isPaladin() && player.hammer && player.hammer.state === 'deployed'; }
function hasWorldBreaker() { return equipment.weapon && equipment.weapon.name === 'The World-Breaker Grand Mace'; }
function hasGildedPlate() { return equipment.armor && equipment.armor.name === 'Plate of the Gilded Bastion'; }

// Called on game start and at the start of every wave: the hammer returns to hand, any dome disappears.
function resetPaladinState() {
    player.hammer = { state: 'equipped', x: player.x, y: player.y, spin: 0, hitList: [], dragged: [], pulseTimer: 0, conduitTimer: 0, hurricaneTimer: 0, dmg: 0 };
    player.dome = null;
}

// ---------- Damage-taken hooks (called from takeDamage in combat.js) ----------

function paladinArmorMult() { return hammerAway() ? 1.15 : 1.0; }

// Plate of the Gilded Bastion: 1% DR per 15 units from the deployed hammer, max 25%
function gildedPlateReduction() {
    if (!hammerDeployed() || !hasGildedPlate()) return 0;
    const h = player.hammer;
    return Math.min(0.25, Math.hypot(player.x - h.x, player.y - h.y) / 15 / 100);
}

function paladinDamageTakenMult() {
    let mult = 1.0;
    const d = player.dome;
    if (d && Math.hypot(player.x - d.x, player.y - d.y) <= d.radius) mult *= 0.8; // Bastion Dome: -20% damage taken
    mult *= 1 - gildedPlateReduction();
    return mult;
}

// ---------- Small helpers ----------

function inCone(e, cx, cy, angle, radius, halfArc) {
    if (e.dead || Math.hypot(e.x - cx, e.y - cy) > radius + e.size / 2) return false;
    let diff = Math.atan2(e.y - cy, e.x - cx) - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) <= halfArc;
}

function shove(e, angle, dist) {
    if (e.type.startsWith('boss')) return;
    e.x += Math.cos(angle) * dist; e.y += Math.sin(angle) * dist;
    clampToBounds(e, e.size / 2);
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const cross = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const d1 = cross(cx, cy, dx, dy, ax, ay), d2 = cross(cx, cy, dx, dy, bx, by);
    const d3 = cross(ax, ay, bx, by, cx, cy), d4 = cross(ax, ay, bx, by, dx, dy);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function clampPointToMap(x, y, margin) {
    return [Math.max(currentMap.left + margin, Math.min(currentMap.right - margin, x)),
            Math.max(currentMap.top + margin, Math.min(currentMap.bottom - margin, y))];
}

// ---------- Basic attack ----------

BasicAttackRegistry['mace'] = (dmg) => {
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);

    if (hammerAway()) {
        // Light shield bash while the hammer is away
        dmg *= 0.85;
        const radius = 95, halfArc = Math.PI / 4;
        effects.push({ type: 'slash', x: player.x, y: player.y, radius: radius, angle: angle, color: 'rgba(255, 249, 196, 0.9)', life: 0.15, maxLife: 0.15 });
        for (const e of enemies) {
            if (!inCone(e, player.x, player.y, angle, radius, halfArc)) continue;
            applyDamage(e, dmg, 'melee_basic');
            shove(e, angle, 20);
        }
        return;
    }

    // Grand Mace smash: 120° shockwave cleave that briefly staggers
    const radius = 140, halfArc = Math.PI / 3;
    effects.push({ type: 'pal_shockwave', x: player.x, y: player.y, radius: radius, angle: angle, halfArc: halfArc, life: 0.3, maxLife: 0.3 });
    for (const e of enemies) {
        if (!inCone(e, player.x, player.y, angle, radius, halfArc)) continue;
        applyDamage(e, dmg, 'melee_basic');
        if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.15);
        shove(e, Math.atan2(e.y - player.y, e.x - player.x), 12);
    }
    if (hasWorldBreaker()) spawnFaultLines(angle, radius, halfArc);
};

// World-Breaker: three rune lines running through the shockwave cone
function spawnFaultLines(angle, radius, halfArc) {
    const segments = [];
    for (const offset of [-halfArc * 0.6, 0, halfArc * 0.6]) {
        const a = angle + offset;
        let r = 20;
        let px = player.x + Math.cos(a) * r, py = player.y + Math.sin(a) * r;
        while (r < radius) {
            r = Math.min(radius, r + 25 + Math.random() * 20);
            const ja = a + (Math.random() - 0.5) * 0.5;
            const nx = player.x + Math.cos(ja) * r, ny = player.y + Math.sin(ja) * r;
            segments.push([px, py, nx, ny]);
            px = nx; py = ny;
        }
    }
    effects.push({ type: 'fault_line', segments: segments, life: 2.0, maxLife: 2.0 });
}

// ---------- Skills ----------

SkillRegistry['Paladin'] = {
    // Checked before the cooldown is spent; returning false cancels the cast
    canCast: (i) => {
        const h = player.hammer;
        if (i === 1 && h.state === 'returning') return false;
        if (i === 2 && h.state !== 'deployed') {
            effects.push({ type: 'text', text: 'Hammer not deployed!', x: player.x, y: player.y - 40, color: '#ff5252', life: 0.6, maxLife: 0.6 });
            return false;
        }
        return true;
    },

    1: (sk, dmg) => { // Judgment Hammer: throw / recall
        const h = player.hammer;
        h.dmg = dmg;
        if (h.state === 'equipped') {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const range = Math.min(dist, HAMMER_THROW_RANGE);
            [h.tx, h.ty] = clampPointToMap(player.x + (dx / dist) * range, player.y + (dy / dist) * range, 20);
            h.x = player.x; h.y = player.y; h.startX = player.x; h.startY = player.y;
            h.state = 'outbound'; h.hitList = [];
            // Short lockout only, so the recall is available almost immediately; the full cooldown starts on recall
            cooldowns.s1 = 0.4; cooldownMax.s1 = 0.4;
        } else {
            h.state = 'returning'; h.hitList = []; h.dragged = []; h.hurricaneTimer = 0;
            h.returnMode = 'homing';
        }
    },

    2: (sk, dmg) => { // Bastion Dome (requires deployed hammer, see canCast)
        const h = player.hammer;
        player.dome = { id: ++paladinDomeCounter, x: h.x, y: h.y, radius: DOME_RADIUS, life: 5.0, maxLife: 5.0, upg: sk.selectedUpg };
        effects.push({ type: 'circle_burst', x: h.x, y: h.y, radius: DOME_RADIUS, color: 'rgba(255, 213, 79, 0.5)', life: 0.4, maxLife: 0.4 });
    },

    3: (sk, dmg) => { // Righteous Charge (equipped) / Iron Pull (deployed)
        const h = player.hammer;
        if (h.state === 'deployed') {
            player.grappleTarget = {
                x: h.x, y: h.y, speed: 1800, color: '#ffd54f', kind: 'chain',
                onArrive: () => {
                    const grounding = sk.selectedUpg === 'B';
                    effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 110, life: 0.45, maxLife: 0.45 });
                    if (grounding) effects.push({ type: 'gravity_crush', x: h.x, y: h.y, radius: 150, life: 0.5, maxLife: 0.5 });
                    for (const e of enemies) {
                        if (e.dead || Math.hypot(e.x - h.x, e.y - h.y) > 150 + e.size / 2) continue;
                        applyDamage(e, dmg * 1.2, 'melee');
                        if (grounding) { e.slowTimer = 3.0; e.slowAmount = 0.5; }
                    }
                    if (grounding) effects.push({ type: 'text', text: 'GROUNDED', x: h.x, y: h.y - 50, color: '#ffca28', life: 0.8, maxLife: 0.8 });
                }
            };
            return;
        }

        const juggernaut = sk.selectedUpg === 'A';
        const range = 260 * (juggernaut ? 1.5 : 1.0);
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        const dirX = dx / dist, dirY = dy / dist;
        const [tx, ty] = clampPointToMap(player.x + dirX * range, player.y + dirY * range, player.radius);
        const hitList = [];
        const trail = { type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x, y2: player.y, color: '#ffe082', width: 26, life: 0.45, maxLife: 0.45 };
        effects.push(trail);
        if (juggernaut) player.iFrames = Math.max(player.iFrames, 0.1); // immune from the instant of casting; the dash keeps it refreshed
        player.grappleTarget = {
            x: tx, y: ty, speed: 1300, iFrames: juggernaut, noLine: true,
            kind: 'charge', angle: Math.atan2(dirY, dirX), juggernaut, trail, // drawn by skillfx_space.js
            onArrive: () => dustPuff(player.x, player.y, Math.atan2(dirY, dirX), 1.2, 5),
            onStep: () => {
                for (const e of enemies) {
                    if (e.dead || hitList.includes(e)) continue;
                    if (Math.hypot(e.x - player.x, e.y - player.y) > player.radius + e.size / 2 + 15) continue;
                    hitList.push(e);
                    applyDamage(e, dmg, 'melee');
                    burst(e.x, e.y, Math.atan2(dirY, dirX), 1.4, 8, { kind: 'spark', color: '#ffe082', size: 2.5, life: 0.25, speed: [200, 420], drag: 6 });
                    addShake(2);
                    // Knock enemies forward and off to whichever side of the charge they were on
                    const side = (dirX * (e.y - player.y) - dirY * (e.x - player.x)) >= 0 ? 1 : -1;
                    shove(e, Math.atan2(dirY, dirX), 50);
                    shove(e, Math.atan2(dirX * side, -dirY * side), 70);
                    if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.3);
                }
            }
        };
    },

    4: (sk, dmg) => { // Consecrated Wrath
        const h = player.hammer;
        const deployed = h.state === 'deployed';
        const followPlayer = sk.selectedUpg === 'A';
        const atHammer = deployed && !followPlayer;
        const cx = atHammer ? h.x : player.x, cy = atHammer ? h.y : player.y;
        effects.push({
            type: 'consecrated_ground', x: cx, y: cy, radius: WRATH_RADIUS, color: 'rgba(255, 202, 40, 0.45)', life: 6.0, maxLife: 6.0, dmg: dmg, slow: 0.25,
            customUpdate: followPlayer ? (dt, ef) => { ef.x = player.x; ef.y = player.y; } : null
        });
        effects.push({ type: 'holy_impact', x: cx, y: cy, radius: 140, life: 0.5, maxLife: 0.5 });
        if (sk.selectedUpg === 'B' && deployed) {
            h.hurricaneTimer = 6.0;
            effects.push({ type: 'text', text: 'IRON HURRICANE', x: h.x, y: h.y - 60, color: '#ffd54f', life: 1.0, maxLife: 1.0 });
        }
    }
};

// ---------- Per-frame update (called from update in main.js) ----------

function updatePaladin(dt) {
    buffs.shieldDecayPaused = false;
    if (!isPaladin() || !player.hammer) return;
    const h = player.hammer;
    if (h.purityCd > 0) h.purityCd -= dt;

    if (h.state === 'outbound') {
        h.spin += dt * 18;
        const [dx, dy, dist] = getVector(h.x, h.y, h.tx, h.ty);
        const step = 1100 * dt;
        if (dist <= step) { h.x = h.tx; h.y = h.ty; }
        else { h.x += (dx / dist) * step; h.y += (dy / dist) * step; }
        hammerSweep(h, false);
        if (dist <= step) landHammer(h);
    } else if (h.state === 'returning') {
        // Return flight in three phases:
        //   'homing'   - steers toward the Paladin, so moving around while it comes back is free
        //   'straight' - within HAMMER_COMMIT_DIST it locks its heading; stay on that line to catch it (Q resets)
        //   'chase'    - it overshot (you dodged off the line): it turns around and chases you, Q keeps its full cooldown
        h.spin -= dt * 18;
        const step = (h.returnMode === 'chase' ? 1000 : 1400) * dt;
        const reach = player.radius + HAMMER_CATCH_REACH;
        if (h.returnMode === 'homing' && Math.hypot(player.x - h.x, player.y - h.y) <= HAMMER_COMMIT_DIST) {
            const [cx, cy, cd] = getVector(h.x, h.y, player.x, player.y);
            h.returnMode = 'straight'; h.dirX = cx / cd; h.dirY = cy / cd; h.straightDist = 0;
        }
        let mx, my;
        if (h.returnMode === 'straight') { mx = h.dirX * step; my = h.dirY * step; h.straightDist += step; }
        else { const [dx, dy, dist] = getVector(h.x, h.y, player.x, player.y); mx = (dx / dist) * step; my = (dy / dist) * step; }
        const prevX = h.x, prevY = h.y;
        h.x += mx; h.y += my;

        // Checked along the whole step so a fast hammer can't skip past the Paladin between frames
        if (distToSegment(player.x, player.y, prevX, prevY, h.x, h.y) <= reach) { catchHammer(h, h.returnMode !== 'chase'); }
        else {
            if (h.returnMode === 'straight') {
                const along = (player.x - h.x) * h.dirX + (player.y - h.y) * h.dirY; // < 0 once the Paladin is behind the hammer
                if (along < -reach || h.straightDist > HAMMER_COMMIT_DIST + 300) {
                    h.returnMode = 'chase';
                    effects.push({ type: 'text', text: 'Missed catch', x: h.x, y: h.y - 30, color: '#b0bec5', life: 0.6, maxLife: 0.6 });
                }
            }
            hammerSweep(h, true);
            for (const d of h.dragged) {
                if (d.e.dead) continue;
                d.e.x = h.x + d.ox; d.e.y = h.y + d.oy;
                clampToBounds(d.e, d.e.size / 2);
            }
        }
    } else if (h.state === 'deployed') {
        updateDeployedHammer(h, dt);
    }

    updateBastionDome(dt);
}

// Damage everything the flying hammer touches (once per flight); on the way back, drag non-bosses along
function hammerSweep(h, drag) {
    for (const e of enemies) {
        if (e.dead || h.hitList.includes(e)) continue;
        if (Math.hypot(e.x - h.x, e.y - h.y) > HAMMER_HIT_RADIUS + e.size / 2) continue;
        h.hitList.push(e);
        applyDamage(e, h.dmg, 'melee');
        if (drag && !e.type.startsWith('boss')) {
            const a = Math.random() * Math.PI * 2;
            h.dragged.push({ e: e, ox: Math.cos(a) * 20, oy: Math.sin(a) * 20 });
        }
    }
}

function landHammer(h) {
    h.state = 'deployed';
    h.pulseTimer = 0.5; h.conduitTimer = 0.5;
    h.sealAt = fxTime; // the holy seal under the hammer grows in from here
    effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 70, life: 0.45, maxLife: 0.45 });
    if (hasWorldBreaker()) triggerMagneticPulse(h);
}

// World-Breaker: if the throw crossed or landed on a fault line, pull every enemy standing on that fracture to the hammer
function triggerMagneticPulse(h) {
    const touched = effects.filter(ef => ef.type === 'fault_line' && ef.life > 0 && ef.segments.some(s =>
        segmentsIntersect(h.startX, h.startY, h.x, h.y, s[0], s[1], s[2], s[3]) || distToSegment(h.x, h.y, s[0], s[1], s[2], s[3]) < 40));
    if (touched.length === 0) return;
    let pulled = 0;
    for (const e of enemies) {
        if (e.dead || e.type.startsWith('boss')) continue;
        const onFracture = touched.some(ef => ef.segments.some(s => distToSegment(e.x, e.y, s[0], s[1], s[2], s[3]) < 30 + e.size / 2));
        if (!onFracture) continue;
        effects.push({ type: 'rune_chain', x1: e.x, y1: e.y, x2: h.x, y2: h.y, life: 0.45, maxLife: 0.45 }); // runes link into a chain
        const a = Math.random() * Math.PI * 2;
        e.x = h.x + Math.cos(a) * 40; e.y = h.y + Math.sin(a) * 40;
        clampToBounds(e, e.size / 2);
        pulled++;
    }
    for (const ef of touched) ef.life = 0;
    effects.push({ type: 'holy_nova', x: h.x, y: h.y, radius: 120, life: 0.45, maxLife: 0.45 });
    if (pulled > 0) effects.push({ type: 'text', text: 'MAGNETIC PULSE', x: h.x, y: h.y - 50, color: '#ffd54f', life: 1.0, maxLife: 1.0 });
}

function catchHammer(h, perfect) {
    h.state = 'equipped'; h.dragged = []; h.hurricaneTimer = 0; h.returnMode = null;
    h.x = player.x; h.y = player.y;
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 50, color: 'rgba(255, 248, 225, 0.8)', life: 0.25, maxLife: 0.25 });
    burst(player.x, player.y, 0, Math.PI * 2, perfect ? 14 : 7, { kind: 'spark', color: '#ffe082', size: 2, life: 0.25, speed: [150, 340], drag: 6 });
    if (perfect) {
        cooldowns.s1 = 0;
        effects.push({ type: 'text', text: 'CAUGHT!', x: player.x, y: player.y - 40, color: '#ffd54f', life: 0.7, maxLife: 0.7 });
    }
    const sk = activeClass.skills[1];
    if (sk.selectedUpg === 'A' && !(h.purityCd > 0)) { // Handheld Purity: seismic shockwave, at most once per normal Q cooldown
        h.purityCd = sk.maxCd * getCDR();
        effects.push({ type: 'holy_impact', x: player.x, y: player.y, radius: 110, life: 0.5, maxLife: 0.5 });
        effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 180, color: 'rgba(255, 236, 179, 0.6)', life: 0.4, maxLife: 0.4 });
        for (const e of enemies) {
            if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > 180 + e.size / 2) continue;
            applyDamage(e, h.dmg, 'melee');
            e.stunTimer = 1.5;
        }
    }
}

function updateDeployedHammer(h, dt) {
    // Threat pulse: light holy damage, and nearby enemies are briefly drawn to the hammer instead of you
    h.pulseTimer -= dt;
    if (h.pulseTimer <= 0) {
        h.pulseTimer = 1.0;
        effects.push({ type: 'circle_burst', x: h.x, y: h.y, radius: HAMMER_PULSE_RADIUS, color: 'rgba(255, 248, 225, 0.3)', life: 0.5, maxLife: 0.5 });
        for (const e of enemies) {
            if (e.dead || Math.hypot(e.x - h.x, e.y - h.y) > HAMMER_PULSE_RADIUS + e.size / 2) continue;
            applyDamage(e, h.dmg * 0.25, 'magic');
            if (!e.type.startsWith('boss') && (!e.state || e.state === 'idle')) { e.tauntTimer = 0.5; e.tauntX = h.x; e.tauntY = h.y; }
        }
    }

    // Conduit Shock: lightning forks at the 2 nearest enemies
    if (activeClass.skills[1].selectedUpg === 'B') {
        h.conduitTimer -= dt;
        if (h.conduitTimer <= 0) {
            h.conduitTimer = 0.5;
            const targets = enemies
                .filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= 200 + e.size / 2)
                .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
                .slice(0, 2);
            for (const e of targets) {
                effects.push({ type: 'lightning', x1: h.x, y1: h.y, x2: e.x, y2: e.y, color: '#fff59d', life: 0.15, maxLife: 0.15 });
                applyDamage(e, h.dmg * 0.4, 'magic');
            }
        }
    }

    // Hammer of the Gods: iron hurricane pulls enemies toward the hammer
    if (h.hurricaneTimer > 0) {
        h.hurricaneTimer -= dt;
        h.spin += dt * 25;
        for (const e of enemies) {
            if (e.dead || e.type.startsWith('boss')) continue;
            const [dx, dy, dist] = getVector(e.x, e.y, h.x, h.y);
            if (dist > WRATH_RADIUS + 60 || dist < 30 + e.size / 2) continue;
            const pull = Math.min(dist - (30 + e.size / 2), 240 * dt);
            e.x += (dx / dist) * pull; e.y += (dy / dist) * pull;
        }
    }
}

function updateBastionDome(dt) {
    const d = player.dome;
    if (!d) return;
    d.life -= dt;
    if (d.life <= 0) { player.dome = null; return; }

    const inside = Math.hypot(player.x - d.x, player.y - d.y) <= d.radius;
    if (inside && d.upg === 'A') { // Holy Sanctuary
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.03 * dt);
        buffs.shieldDecayPaused = true;
    }

    // Block enemy projectiles that cross the dome wall from outside (ones fired from inside pass through)
    for (const p of projectiles) {
        if (!p.isEnemy || p.life <= 0) continue;
        const pin = Math.hypot(p.x - d.x, p.y - d.y) <= d.radius + (p.radius || 0);
        if (p.domeId !== d.id) { p.domeId = d.id; p.domeInside = pin; continue; }
        if (pin && !p.domeInside) {
            p.life = 0; // expires this frame, so its normal on-expire behavior still runs
            effects.push({ type: 'dome_ripple', x: p.x, y: p.y, life: 0.3, maxLife: 0.3 });
            if (d.upg === 'B') fireRetributionBolt(p.x, p.y, p.owner || p.sourceBoss);
        }
        p.domeInside = pin;
    }
}

// Retribution Barrier: homing holy bolt back at whoever fired the blocked projectile
function fireRetributionBolt(x, y, attacker) {
    projectiles.push({
        x: x, y: y, vx: 0, vy: 0, radius: 6, color: '#fff59d', life: 2.0, type: 'basic', shape: 'fireball', isRetribution: true,
        damage: calcDmg(15, activeClass.skills[2].level), pierce: false, hitList: [], isEnemy: false, target: attacker,
        customUpdate: function(dt, p) {
            if (!p.target || p.target.dead) p.target = getNearestEnemyFromPoint(p.x, p.y, 600);
            if (!p.target) return;
            const [dx, dy, dist] = getVector(p.x, p.y, p.target.x, p.target.y);
            p.vx = (dx / dist) * 700; p.vy = (dy / dist) * 700;
        }
    });
}

// ---------- Drawing ----------

// Top-down Grand Mace: handle along -x, flanged steel head at +x
function drawMace(x, y, angle, scale) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 6;
    for (const gx of [-24, -12]) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + 3, 0); ctx.stroke(); }
    ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(-32, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    // Flanges
    ctx.fillStyle = '#b0bec5';
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.moveTo(12 + Math.cos(a - 0.35) * 10, Math.sin(a - 0.35) * 10);
        ctx.lineTo(12 + Math.cos(a) * 17, Math.sin(a) * 17);
        ctx.lineTo(12 + Math.cos(a + 0.35) * 10, Math.sin(a + 0.35) * 10);
        ctx.closePath(); ctx.fill();
    }
    // Head
    ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(12, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.stroke();
    if (isRareWeapon()) { // holy light pulsing through the head
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 14; ctx.shadowColor = '#ffd54f'; ctx.globalAlpha = rarePulse();
        ctx.fillStyle = '#fff59d';
        ctx.beginPath(); ctx.arc(12, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
        drawRunes(-26, -6, 0, '#ffe082', 1.3);
    }
    ctx.restore();
}

// 0 at the start of a basic attack, 1 when it is ready again
function swingProgress() { return cooldownMax.basic > 0 ? Math.max(0, Math.min(1, 1 - cooldowns.basic / cooldownMax.basic)) : 1; }

// The weapon in the Paladin's hands (called from draw in main.js)
function drawPaladinWeapon(aimAngle) {
    if (hammerAway()) {
        // Light shield
        let push = 0;
        if (cooldowns.basic > 0) push = Math.sin(Math.min(1, swingProgress() * 3) * Math.PI) * 8;
        const sx = player.x + Math.cos(aimAngle) * push, sy = player.y + Math.sin(aimAngle) * push;
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = '#fff59d';
        ctx.strokeStyle = 'rgba(255, 249, 196, 0.9)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(sx, sy, player.radius + 10, aimAngle - 0.8, aimAngle + 0.8); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, player.radius + 15, aimAngle - 0.7, aimAngle + 0.7); ctx.stroke();
        ctx.restore();
        return;
    }
    // Overhead smash: rests on the shoulder; on attack it comes down straight onto the aim (drawn larger while
    // raised toward the camera), stays planted for a beat, then is hauled back up onto the shoulder
    const p = attackProgress(0.4), rest = aimAngle - Math.PI / 3;
    let ang = rest, dist = 48, scale = 1.0;
    if (weaponAnim.swing > 0 && p < 1) {
        if (p < 0.1) { const q = easeInOut(p / 0.1); ang = lerp(aimAngle - 0.5, aimAngle, q); scale = lerp(1.3, 1.0, q); dist = lerp(50, 56, q); }
        else if (p < 0.4) { ang = aimAngle; dist = 56; }
        else { const q = easeInOut((p - 0.4) / 0.6); ang = lerp(aimAngle, rest, q); dist = lerp(56, 48, q); scale = 1 + 0.15 * Math.sin(q * Math.PI); }
    }
    drawMace(player.x + Math.cos(ang) * dist, player.y + Math.sin(ang) * dist, ang, scale);
    drawHand(player.x + Math.cos(ang) * dist * 0.5, player.y + Math.sin(ang) * dist * 0.5);
    drawHand(player.x + Math.cos(ang) * dist * 0.69, player.y + Math.sin(ang) * dist * 0.69);
}

// The planted hammer's holy seal: rune rings turning on the ground that flare with each threat pulse
function drawHolySeal(h) {
    const grow = easeOut((fxTime - (h.sealAt || 0)) / 0.4), flare = Math.max(0, h.pulseTimer);
    const R = 46 * grow, gilded = hasGildedPlate();
    if (R < 1) return;
    ctx.save();
    ctx.translate(h.x, h.y);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
    glow.addColorStop(0, `rgba(255, 213, 79, ${0.16 + 0.14 * flare + (gilded ? 0.08 : 0)})`); glow.addColorStop(1, 'rgba(255, 213, 79, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffd54f';
    ctx.strokeStyle = `rgba(255, 213, 79, ${0.55 + 0.35 * flare})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    // Inner dashed ring turning one way, the rune band the other
    ctx.save();
    ctx.rotate(fxTime * 0.6);
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.rotate(-fxTime * 0.35);
    ctx.strokeStyle = `rgba(255, 248, 225, ${0.5 + 0.4 * flare})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { // small cross-shaped runes
        const a = i * Math.PI / 3, x = Math.cos(a) * R * 0.81, y = Math.sin(a) * R * 0.81;
        ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 3);
    }
    // Faint six-pointed star joining the runes
    for (let i = 0; i < 2; i++) for (let j = 0; j <= 3; j++) {
        const a = (j * 2 + i) * Math.PI / 3, x = Math.cos(a) * R * 0.62, y = Math.sin(a) * R * 0.62;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

// World-space visuals: fault lines, shockwaves, the thrown hammer, its chain, and the dome (consecrated ground: skillfx_ult.js)
function drawPaladinWorld() {
    for (const ef of effects) {
        const a = Math.max(0, ef.life / ef.maxLife);
        if (ef.type === 'fault_line') {
            drawRuneFault(ef, a); // skillfx_rmb.js: rows of golden runes
        } else if (ef.type === 'pal_shockwave') {
            // Ground smash: light and a dust ring burst out from where the mace head lands (no sweeping arc)
            const p = 1 - a, R = ef.radius * 0.62 * easeOut(p);
            const ix = ef.x + Math.cos(ef.angle) * 56, iy = ef.y + Math.sin(ef.angle) * 56;
            ctx.save();
            const flash = ctx.createRadialGradient(ix, iy, 0, ix, iy, 34);
            flash.addColorStop(0, `rgba(255, 255, 255, ${a})`); flash.addColorStop(1, 'rgba(255, 236, 179, 0)');
            ctx.fillStyle = flash; ctx.beginPath(); ctx.arc(ix, iy, 34, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(215, 204, 200, ${0.8 * a})`; ctx.lineWidth = 8 * a + 2;
            ctx.beginPath(); ctx.arc(ix, iy, R, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 202, 40, ${a})`; ctx.lineWidth = 3 * a + 0.5;
            ctx.beginPath(); ctx.arc(ix, iy, R * 0.72, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 248, 225, ${a})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) { const ra = i * Math.PI / 4 + 0.4; ctx.moveTo(ix + Math.cos(ra) * R * 0.3, iy + Math.sin(ra) * R * 0.3); ctx.lineTo(ix + Math.cos(ra) * R * 0.6, iy + Math.sin(ra) * R * 0.6); }
            ctx.stroke();
            ctx.restore();
        }
    }

    if (!isPaladin() || !player.hammer) return;
    const h = player.hammer;

    if (h.state !== 'equipped') {
        if (h.state === 'deployed') {
            // Celestial chain back to the Paladin (brighter while the Gilded Plate is drawing on it)
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = hasGildedPlate() ? 'rgba(255, 213, 79, 0.75)' : 'rgba(255, 213, 79, 0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(h.x, h.y); ctx.stroke();
            ctx.restore();
            drawHolySeal(h);
        }
        if (h.state === 'returning' && h.returnMode === 'straight') {
            // Committed path: stand on this line to catch the hammer
            ctx.save();
            ctx.setLineDash([10, 8]);
            ctx.strokeStyle = 'rgba(255, 213, 79, 0.5)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + h.dirX * 320, h.y + h.dirY * 320); ctx.stroke();
            ctx.restore();
        }
        const spinning = h.state !== 'deployed' || h.hurricaneTimer > 0;
        const scale = h.hurricaneTimer > 0 ? 2.4 : (h.state === 'deployed' ? 1.3 : 1.1);
        if (spinning) { // spin blur disc behind the whirling mace
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const blur = ctx.createRadialGradient(h.x, h.y, 4 * scale, h.x, h.y, 32 * scale);
            blur.addColorStop(0, 'rgba(255, 245, 157, 0)'); blur.addColorStop(0.8, 'rgba(255, 245, 157, 0.22)'); blur.addColorStop(1, 'rgba(255, 245, 157, 0)');
            ctx.fillStyle = blur; ctx.beginPath(); ctx.arc(h.x, h.y, 32 * scale, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (h.hurricaneTimer > 0) drawHammerStorm(h); // skillfx_ult.js
        drawMace(h.x, h.y, spinning ? h.spin : -Math.PI / 2 - 0.3, scale);
    }

    const d = player.dome;
    if (d) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, d.life / 0.5, (d.maxLife - d.life) / 0.2 + 0.2);
        const grad = ctx.createRadialGradient(d.x, d.y, d.radius * 0.3, d.x, d.y, d.radius);
        grad.addColorStop(0, 'rgba(255, 213, 79, 0.03)');
        grad.addColorStop(1, 'rgba(255, 213, 79, 0.25)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
        ctx.stroke();
        drawDomeLattice(d, ctx.globalAlpha); // skillfx_e.js
        const shimmer = (d.maxLife - d.life) * 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const a0 = shimmer + (Math.PI * 2 / 3) * i;
            ctx.beginPath(); ctx.arc(d.x, d.y, d.radius - 4, a0, a0 + 0.5); ctx.stroke();
        }
        ctx.restore();
    }
}
