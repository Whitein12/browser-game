// ==========================================
// paladin.js - Paladin: Celestial Anchor mechanic, skills, and visuals
// ==========================================
// The Grand Mace lives in player.hammer and is always in one of four states:
//   'equipped'  - in hand: basic attacks are 120° shockwave smashes
//   'outbound'  - flying to where Q threw it, hitting enemies on the way
//   'deployed'  - stuck in the ground: pulses threat, enables Iron Pull and anchors Divine Tether's chain
//   'returning' - flying back after a Q recast, dragging enemies along
// Whenever it is not 'equipped', the Paladin fights with a light shield (-15% basic DMG, +15% armor).

const HAMMER_THROW_RANGE = 500;
const HAMMER_HIT_RADIUS = 30;
const HAMMER_COMMIT_DIST = 260; // returning hammer stops homing and flies straight from this far out (~0.19s to react)
const HAMMER_CATCH_REACH = 15;  // how far beyond the Paladin's body the hammer still counts as caught
const HAMMER_CATCH_CD = 1.2;    // Q cooldown left after a clean catch (a miss keeps the full cooldown)
const HAMMER_PULSE_RADIUS = 200;
const WRATH_RADIUS = 220;
// Divine Tether (E): a chain of light from the Paladin to the planted hammer (5 s), or to a shackled enemy (4 s).
// Every 0.25 s whatever touches the chain takes 0.5x the skill's damage and is slowed 40%, and each enemy on it heals
// the Paladin 0.5% max HP (at most 1.5% per pulse): the melee tank's sustain.
const TETHER_HAMMER_TIME = 5.0, TETHER_SHACKLE_TIME = 4.0, TETHER_TICK = 0.25, TETHER_TICK_MULT = 0.5, TETHER_WIDTH = 18; // x0.5 (was x0.4)
const TETHER_HEAL = 0.005, TETHER_HEAL_CAP = 0.015;
const SHACKLE_RANGE = 500, SHACKLE_LEASH = 150, SHACKLE_VULN = 1.2, TETHER_SNAP = 700;
// Judgment Smash (the Space finisher, combos.js): an overhead smash around the impact that stuns
const JUDGMENT_MULT = 3, JUDGMENT_RADIUS = 160, JUDGMENT_STUN = 1.5;
// Round-two combos (combos.js lists them; the Paladin's own code lives here): Flail Sweep, Ring the Hammer, Zealous Charge
const FLAIL_SPINS = 2, FLAIL_TIME = 0.8, FLAIL_REEL = 0.12, FLAIL_MIN = 120, FLAIL_MAX = 300, FLAIL_MULT = 1.75, FLAIL_CHAIN_MULT = 0.5, FLAIL_WIDTH = 50, FLAIL_KNOCK = 110, FLAIL_STUN = 0.6;
const RING_MULT = 3, RING_CD = 3, RING_STUN = 0.5;
const ZEAL_TRAIL_TIME = 3, ZEAL_TRAIL_WIDTH = 45, ZEAL_TRAIL_MULT = 0.5;

function isPaladin() { return activeClass && activeClass.name === 'Paladin'; }
function hammerAway() { return isPaladin() && player.hammer && player.hammer.state !== 'equipped'; }
function hammerDeployed() { return isPaladin() && player.hammer && player.hammer.state === 'deployed'; }
function hasWorldBreaker() { return equipment.weapon && equipment.weapon.name === 'The World-Breaker Grand Mace'; }
function hasGildedPlate() { return equipment.armor && equipment.armor.name === 'Plate of the Gilded Bastion'; }

// Called on game start and at the start of every wave: the hammer returns to hand, any tether breaks.
function resetPaladinState() {
    player.hammer = { state: 'equipped', x: player.x, y: player.y, spin: 0, hitList: [], dragged: [], pulseTimer: 0, conduitTimer: 0, hurricaneTimer: 0, dmg: 0 };
    player.tether = null;
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
    mult *= 1 - gildedPlateReduction();
    if (player.paAura && hasTalent('pa_aura_bulwark')) mult *= 0.85; // Bulwark Aura
    if (thunderThrone()) mult *= 0.8; // Thunder Throne
    return mult;
}

// ---------- The web's talents (talents.js TALENT_WEBS.paladin) ----------

// Thunder Throne: within 150 px of the planted hammer (Conduit Shock)
function thunderThrone() { return hasTalent('pa_conduit_throne') && activeClass.skills[1].selectedUpg === 'B' && hammerDeployed() && Math.hypot(player.hammer.x - player.x, player.hammer.y - player.y) <= 150; }
function throneChain(e, dmg) { // a bash's lightning leaps from what it struck to 2 more
    const hit = [e]; let from = e;
    for (let k = 0; k < 2; k++) {
        const o = getNearestEnemyFromPoint(from.x, from.y, 250, hit); if (!o) break;
        effects.push({ type: 'lightning', x1: from.x, y1: from.y, x2: o.x, y2: o.y, color: '#fff59d', life: 0.15, maxLife: 0.15 });
        applyDamage(o, dmg, 'magic'); hit.push(o); from = o;
    }
}
// Bulldozer: the carried pile is slammed at the charge's end (2 s and, with Crush, x2 into a wall); Earthshaker smashes the ground
function bulldozerSlam(carried, dirX, dirY, dmg, edge) {
    const wall = edge || !!(currentMap.grid && clipToWalls(player.x, player.y, player.x + dirX * 70, player.y + dirY * 70, player.radius, false));
    for (const e of carried) {
        if (e.dead) continue;
        applyDamage(e, dmg * 0.5 * (wall && hasTalent('pa_dozer_crush') ? 2 : 1), 'melee');
        if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, wall ? 2 : 1);
    }
    if (carried.length) { effects.push({ type: 'holy_impact', x: player.x + dirX * 50, y: player.y + dirY * 50, radius: 90, life: 0.4, maxLife: 0.4 }); addShake(wall ? 4 : 2.5); if (wall) effects.push({ type: 'text', text: 'CRUSHED', x: player.x, y: player.y - 50, color: '#ffd54f', life: 0.8, maxLife: 0.8 }); }
    if (hasTalent('pa_dozer_quake')) {
        effects.push({ type: 'holy_impact', x: player.x, y: player.y, radius: 160, life: 0.5, maxLife: 0.5 });
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= 160 + e.size / 2) applyDamage(e, dmg * 1.5, 'melee');
    }
}
// Divine Aura's talents, each frame (updatePaladin): Blessed Aura heals, Wrath Flare flares every 3 s
function updateAura(dt) {
    const A = player.paAura; if (!A) return;
    if (A.ef.life <= 0 || !effects.includes(A.ef)) { player.paAura = null; return; }
    if (hasTalent('pa_aura_bless')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.01 * dt);
    if (hasTalent('pa_aura_flare') && (A.flare -= dt) <= 0) {
        A.flare = 3;
        effects.push({ type: 'holy_impact', x: player.x, y: player.y, radius: A.ef.radius, life: 0.45, maxLife: 0.45 });
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= A.ef.radius + e.size / 2) { applyDamage(e, A.dmg * 2, 'magic'); if (!e.dead && !e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.5); }
    }
}
const paMoveMult = () => isPaladin() && hasTalent('pa_grace_lift') && player.shield > 0 ? 1.15 : 1; // main.js movement: Lifted

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
        const radius = 95, halfArc = Math.PI / 4, throne = thunderThrone(); // Thunder Throne: by the planted hammer the bash chains on
        effects.push({ type: 'slash', x: player.x, y: player.y, radius: radius, angle: angle, color: 'rgba(255, 249, 196, 0.9)', life: 0.15, maxLife: 0.15 });
        for (const e of enemies) {
            if (!inCone(e, player.x, player.y, angle, radius, halfArc)) continue;
            applyDamage(e, dmg, 'melee_basic');
            shove(e, angle, 20);
            if (throne) throneChain(e, dmg);
        }
        ringHammer(angle, radius, halfArc); // Ring the Hammer: the bash struck your own planted hammer
        return;
    }

    // Grand Mace smash: 120° shockwave cleave that briefly staggers
    if (hasItem('Gauntlets of Devotion')) dmg *= 1.3; // items.js: the gauntlets put weight behind the hammer in hand
    const radius = 140, halfArc = Math.PI / 3;
    effects.push({ type: 'pal_shockwave', x: player.x, y: player.y, radius: radius, angle: angle, halfArc: halfArc, life: 0.3, maxLife: 0.3 });
    let hits = 0;
    for (const e of enemies) {
        if (!inCone(e, player.x, player.y, angle, radius, halfArc)) continue;
        applyDamage(e, dmg, 'melee_basic'); hits++;
        if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.15);
        shove(e, Math.atan2(e.y - player.y, e.x - player.x), 12);
    }
    if (hasItem('Gauntlets of Devotion')) basicHitHeal(hits); // items.js
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
        if (i === 2 && h.state !== 'deployed' && !shackleTarget()) { // the shackle needs someone to bind (the hammer chain never does)
            effects.push({ type: 'text', text: 'No one to bind', x: player.x, y: player.y - 40, color: '#ff5252', life: 0.6, maxLife: 0.6 });
            return false;
        }
        return true;
    },

    1: (sk, dmg) => { // Judgment Hammer: throw / recall
        const h = player.hammer;
        h.dmg = dmg;
        if (h.state === 'equipped') {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const range = Math.min(dist, HAMMER_THROW_RANGE + (hasTalent('pa_hammer_far') ? 150 : 0)); // talents.js Long Throw
            [h.tx, h.ty] = clampPointToMap(player.x + (dx / dist) * range, player.y + (dy / dist) * range, 20);
            h.x = player.x; h.y = player.y; h.startX = player.x; h.startY = player.y;
            h.state = 'outbound'; h.hitList = [];
            // Short lockout only, so the recall is available almost immediately; the full cooldown starts on recall
            cooldowns.s1 = 0.4; cooldownMax.s1 = 0.4;
        } else if (player.tether && player.tether.mode === 'hammer' && h.state === 'deployed') {
            startFlail(h); // Flail Sweep: chained to it, the hammer whips round you on the chain instead
        } else {
            h.state = 'returning'; h.hitList = []; h.dragged = []; h.hurricaneTimer = 0;
            h.returnMode = 'homing';
        }
    },

    2: (sk, dmg) => { // Divine Tether: chain yourself to the planted hammer, or shackle an enemy to you
        const h = player.hammer;
        if (h.state === 'deployed') {
            const T = TETHER_HAMMER_TIME + (hasTalent('pa_tether_long') ? 2 : 0); // Long Chain
            player.tether = { mode: 'hammer', life: T, maxLife: T, tick: 0, ax: h.x, ay: h.y };
            effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 70, life: 0.4, maxLife: 0.4 });
        } else {
            const e = shackleTarget(); // canCast made sure there is one
            const T = TETHER_SHACKLE_TIME + (hasTalent('pa_tether_long') ? 2 : 0);
            player.tether = { mode: 'shackle', target: e, life: T, maxLife: T, tick: 0, ax: e.x, ay: e.y };
            effects.push({ type: 'holy_impact', x: e.x, y: e.y, radius: 60, life: 0.4, maxLife: 0.4 });
            effects.push({ type: 'text', text: 'BOUND', x: e.x, y: e.y - 40, color: '#ffd54f', life: 0.8, maxLife: 0.8 });
        }
        player.tether.castAt = fxTime; // the chain shoots out from the Paladin (drawn in drawPaladinWorld)
        player.tether.judge = 2;
        if (sk.selectedUpg === 'A' && hasTalent('pa_grace_absolve')) { buffs.slowed = 0; buffs.rooted = 0; buffs.weakened = 0; } // Absolution
    },

    3: (sk, dmg) => { // Righteous Charge (equipped) / Iron Pull (deployed)
        const h = player.hammer;
        const zeal = zealousStart(), zx = player.x, zy = player.y; // Zealous Charge: charging out of your Consecrated Wrath
        if (h.state === 'deployed') {
            player.grappleTarget = {
                x: h.x, y: h.y, speed: 1800, color: '#ffd54f', kind: 'chain',
                onArrive: () => {
                    if (zeal) zealousTrail(zeal, zx, zy);
                    const grounding = sk.selectedUpg === 'B', R = grounding && hasTalent('pa_grav_wide') ? 220 : 150;
                    effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 110, life: 0.45, maxLife: 0.45 });
                    if (grounding) effects.push({ type: 'gravity_crush', x: h.x, y: h.y, radius: R, life: 0.5, maxLife: 0.5 });
                    if (grounding && hasTalent('pa_grav_anchor')) h.anchorPull = 3; // Gravity Anchor
                    for (const e of enemies) {
                        if (e.dead || Math.hypot(e.x - h.x, e.y - h.y) > R + e.size / 2) continue;
                        applyDamage(e, dmg * 1.2 * (grounding && hasTalent('pa_grav_crater') ? 2 : 1), 'melee'); // Crater
                        if (grounding) { e.slowTimer = 3.0; e.slowAmount = 0.5; if (hasTalent('pa_grav_root') && !e.dead) e.rootedTimer = Math.max(e.rootedTimer || 0, 1); } // Heavy
                        if (hasItem('Crusader Sabatons') && !e.type.startsWith('boss') && !e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 0.5); // items.js
                    }
                    if (grounding) effects.push({ type: 'text', text: 'GROUNDED', x: h.x, y: h.y - 50, color: '#ffca28', life: 0.8, maxLife: 0.8 });
                }
            };
            return;
        }

        // Bulldozer (A): what the charge hits is carried to its end and slammed together; Shield Wall makes you immune meanwhile
        const dozer = sk.selectedUpg === 'A', guard = dozer && hasTalent('pa_dozer_guard');
        const sealed = player.sealCharge; player.sealCharge = false; // Seal of Judgment: the charge a catch readied hits +50%
        const range = (260 + (hasTalent('pa_charge_far') ? 60 : 0)) * (dozer && hasTalent('pa_dozer_far') ? 1.5 : 1); // Long Charge, Momentum
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        const dirX = dx / dist, dirY = dy / dist;
        const [tx, ty] = clampPointToMap(player.x + dirX * range, player.y + dirY * range, player.radius);
        const edge = Math.hypot(tx - (player.x + dirX * range), ty - (player.y + dirY * range)) > 5; // the map's edge cuts it short: a wall to slam into
        const hitList = [], carried = [];
        const trail = { type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x, y2: player.y, color: '#ffe082', width: 26, life: 0.45, maxLife: 0.45 };
        effects.push(trail);
        if (guard) player.iFrames = Math.max(player.iFrames, 0.1); // immune from the instant of casting; the dash keeps it refreshed
        player.grappleTarget = {
            x: tx, y: ty, speed: 1300, iFrames: guard, noLine: true,
            kind: 'charge', angle: Math.atan2(dirY, dirX), juggernaut: guard, trail, // drawn by skillfx_space.js
            onArrive: () => { dustPuff(player.x, player.y, Math.atan2(dirY, dirX), 1.2, 5); if (zeal) zealousTrail(zeal, zx, zy); if (dozer) bulldozerSlam(carried, dirX, dirY, dmg, edge); },
            onStep: () => {
                for (const e of enemies) {
                    if (e.dead || hitList.includes(e)) continue;
                    if (Math.hypot(e.x - player.x, e.y - player.y) > player.radius + e.size / 2 + 15) continue;
                    hitList.push(e);
                    applyDamage(e, dmg * (sealed ? 1.5 : 1), 'melee');
                    burst(e.x, e.y, Math.atan2(dirY, dirX), 1.4, 8, { kind: 'spark', color: '#ffe082', size: 2.5, life: 0.25, speed: [200, 420], drag: 6 });
                    addShake(2);
                    if (dozer && !e.dead && !e.prop && !e.type.startsWith('boss')) { carried.push(e); continue; } // swept up in front of you
                    // Knock enemies forward and off to whichever side of the charge they were on
                    const side = (dirX * (e.y - player.y) - dirY * (e.x - player.x)) >= 0 ? 1 : -1;
                    shove(e, Math.atan2(dirY, dirX), 50);
                    shove(e, Math.atan2(dirX * side, -dirY * side), 70);
                    if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.3 + (hasItem('Crusader Sabatons') ? 0.5 : 0)); // items.js
                }
                carried.forEach((e, k) => { // the pile rides the shield
                    if (e.dead) return;
                    const lat = (k - (carried.length - 1) / 2) * 26, fwd = player.radius + e.size / 2 + 6;
                    e.x = player.x + dirX * fwd - dirY * lat; e.y = player.y + dirY * fwd + dirX * lat; clampToBounds(e, e.size / 2);
                });
            }
        };
    },

    4: (sk, dmg) => { // Consecrated Wrath
        const h = player.hammer;
        const deployed = h.state === 'deployed';
        const followPlayer = sk.selectedUpg === 'A';
        const atHammer = deployed && !followPlayer;
        const cx = atHammer ? h.x : player.x, cy = atHammer ? h.y : player.y;
        const R = WRATH_RADIUS * (hasTalent('pa_wrath_wide') ? 1.25 : 1), life = 6 + (hasTalent('pa_wrath_long') ? 2 : 0); // Broad Wrath, Long Wrath
        const ground = {
            type: 'consecrated_ground', wrath: true, x: cx, y: cy, radius: R, color: 'rgba(255, 202, 40, 0.45)', life, maxLife: life, dmg: dmg, slow: followPlayer && hasTalent('pa_aura_judge') ? 0.5 : 0.25, // Judgment Aura
            customUpdate: followPlayer ? (dt, ef) => { ef.x = player.x; ef.y = player.y; } : null
        };
        effects.push(ground);
        if (followPlayer) player.paAura = { ef: ground, flare: 3, dmg };
        effects.push({ type: 'holy_impact', x: cx, y: cy, radius: 140, life: 0.5, maxLife: 0.5 });
        if (sk.selectedUpg === 'B' && deployed) {
            h.hurricaneTimer = hasTalent('pa_gods_long') ? 8 : 6; h.godsDmg = dmg; // Endless Storm
            effects.push({ type: 'text', text: 'IRON HURRICANE', x: h.x, y: h.y - 60, color: '#ffd54f', life: 1.0, maxLife: 1.0 });
        }
    }
};

// ---------- Per-frame update (called from update in main.js) ----------

function updatePaladin(dt) {
    if (!isPaladin() || !player.hammer) return;
    const h = player.hammer;
    if (h.purityCd > 0) h.purityCd -= dt;
    updateAura(dt);

    if (h.state === 'outbound') {
        h.spin += dt * 18;
        const [dx, dy, dist] = getVector(h.x, h.y, h.tx, h.ty);
        const step = 1100 * dt;
        if (dist <= step) { h.x = h.tx; h.y = h.ty; }
        else { h.x += (dx / dist) * step; h.y += (dy / dist) * step; }
        hammerSweep(h, false);
        if (dist <= step) landHammer(h);
    } else if (h.state === 'returning' && h.returnMode === 'flail') {
        updateFlail(h, dt);
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

    updateTether(dt);
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
        if (!devNoCooldowns) cooldowns.s1 = cooldownMax.s1 = HAMMER_CATCH_CD;
        if (hasItem('Seal of Judgment')) { cooldowns.s3 = 0; player.sealCharge = true; } // items.js: a clean catch readies the charge, and it hits +50%
        effects.push({ type: 'text', text: 'CAUGHT!', x: player.x, y: player.y - 40, color: '#ffd54f', life: 0.7, maxLife: 0.7 });
    }
    const sk = activeClass.skills[1];
    if (sk.selectedUpg === 'A' && !(h.purityCd > 0)) { // Handheld Purity: seismic shockwave, at most once per normal Q cooldown (Ever Ready: half)
        h.purityCd = sk.maxCd * getCDR() * (hasTalent('pa_purity_ready') ? 0.5 : 1);
        purityWave(h.dmg, 1);
        if (hasTalent('pa_purity_quake')) after(0.4, () => purityWave(h.dmg * 1.5, 1.15)); // Twin Quake
    }
}
function purityWave(dmg, grow) { // Seismic Catch widens it, Purifying Wave heals per enemy
    const R = (hasTalent('pa_purity_wide') ? 260 : 180) * grow; let n = 0;
    effects.push({ type: 'holy_impact', x: player.x, y: player.y, radius: 110 * grow, life: 0.5, maxLife: 0.5 });
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: R, color: 'rgba(255, 236, 179, 0.6)', life: 0.4, maxLife: 0.4 });
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        applyDamage(e, dmg, 'melee'); n++;
        e.stunTimer = 1.5;
    }
    if (n && hasTalent('pa_purity_heal')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.01 * n);
    addShake(grow > 1 ? 3 : 2);
}

function updateDeployedHammer(h, dt) {
    // Threat pulse: light holy damage, and nearby enemies are briefly drawn to the hammer instead of you
    h.pulseTimer -= dt;
    if (h.pulseTimer <= 0) {
        h.pulseTimer = 1.0;
        effects.push({ type: 'circle_burst', x: h.x, y: h.y, radius: HAMMER_PULSE_RADIUS, color: 'rgba(255, 248, 225, 0.3)', life: 0.5, maxLife: 0.5 });
        for (const e of enemies) {
            if (e.dead || Math.hypot(e.x - h.x, e.y - h.y) > HAMMER_PULSE_RADIUS + e.size / 2) continue;
            applyDamage(e, h.dmg * 0.25 * (hasTalent('pa_hammer_pulse') ? 1.5 : 1), 'magic'); // Resonant Head
            if (!e.type.startsWith('boss') && (!e.state || e.state === 'idle')) { e.tauntTimer = 0.5; e.tauntX = h.x; e.tauntY = h.y; }
        }
    }

    // Conduit Shock: lightning forks at the 2 nearest enemies
    if (activeClass.skills[1].selectedUpg === 'B') {
        h.conduitTimer -= dt;
        if (h.conduitTimer <= 0) {
            h.conduitTimer = 0.5;
            const R = hasTalent('pa_conduit_rod') ? 320 : 200; // Lightning Rod
            const targets = enemies
                .filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= R + e.size / 2)
                .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
                .slice(0, hasTalent('pa_conduit_branch') ? 4 : 2); // Branching
            for (const e of targets) {
                effects.push({ type: 'lightning', x1: h.x, y1: h.y, x2: e.x, y2: e.y, color: '#fff59d', life: 0.15, maxLife: 0.15 });
                applyDamage(e, h.dmg * 0.4, 'magic');
                h.zaps = (h.zaps || 0) + 1;
                if (hasTalent('pa_conduit_shock') && h.zaps % 4 === 0 && !e.dead && !e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.5); // Shock
            }
        }
    }

    // Hammer of the Gods: iron hurricane pulls enemies toward the hammer
    if (h.hurricaneTimer > 0) {
        h.hurricaneTimer -= dt;
        h.spin += dt * 25;
        const R = hasTalent('pa_gods_wide') ? 380 : WRATH_RADIUS + 60;
        for (const e of enemies) {
            if (e.dead || e.type.startsWith('boss')) continue;
            const [dx, dy, dist] = getVector(e.x, e.y, h.x, h.y);
            if (dist > R || dist < 30 + e.size / 2) continue;
            const pull = Math.min(dist - (30 + e.size / 2), 240 * dt);
            e.x += (dx / dist) * pull; e.y += (dy / dist) * pull;
            if (hasTalent('pa_gods_gale')) applyDamage(e, (h.godsDmg || h.dmg) * 0.5 * dt, 'dot'); // Iron Gale
        }
        if (h.hurricaneTimer <= 0 && hasTalent('pa_gods_fall')) { // Fall of Heaven: it ends in a slam
            effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 250, life: 0.6, maxLife: 0.6 });
            for (const e of enemies) if (!e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= 250 + e.size / 2) { applyDamage(e, (h.godsDmg || h.dmg) * 3, 'melee'); if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1.5); }
            addShake(5);
        }
    }
    if (h.anchorPull > 0) { // Gravity Anchor: the planted hammer keeps drawing enemies in
        h.anchorPull -= dt;
        for (const e of enemies) {
            if (e.dead || e.pod || e.prop || e.type.startsWith('boss')) continue;
            const [dx, dy, dist] = getVector(e.x, e.y, h.x, h.y);
            if (dist > 260 || dist < 30 + e.size / 2) continue;
            const pull = Math.min(dist - (30 + e.size / 2), 130 * dt);
            e.x += (dx / dist) * pull; e.y += (dy / dist) * pull;
        }
    }
}

// Divine Tether with the hammer in hand: the enemy nearest the cursor (within 120 px of it), else the one nearest you
function shackleTarget() {
    const ok = e => !e.dead && !e.pod && !e.submerged && !(e.spawnT > 0) && !(e.flyUntil > fxTime) && Math.hypot(e.x - player.x, e.y - player.y) <= SHACKLE_RANGE + e.size / 2;
    let best = null, bd = 120;
    for (const e of enemies) { if (!ok(e)) continue; const d = Math.hypot(e.x - mouseX, e.y - mouseY) - e.size / 2; if (d < bd) { bd = d; best = e; } }
    if (best) return best;
    bd = Infinity;
    for (const e of enemies) { if (!ok(e)) continue; const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; best = e; } }
    return best;
}

// The chain runs from the Paladin to its anchor (the planted hammer, or the shackled enemy). It burns and slows
// whatever touches it; a shackled non-boss can't get more than SHACKLE_LEASH away and is dragged back in.
function updateTether(dt) {
    const t = player.tether;
    if (!t) { if (player.paTetherOn) { player.paTetherOn = false; tetherEnded(); } return; }
    player.paTetherOn = true;
    const h = player.hammer, sk = activeClass.skills[2];
    if (t.mode === 'hammer') {
        if (h.state !== 'deployed' && h.returnMode !== 'flail') { player.tether = null; return; } // recalled or picked up: the chain goes with it (a Flail Sweep swings it)
        t.ax = h.x; t.ay = h.y;
    } else {
        const e = t.target;
        if (!e || e.dead || e.submerged) { player.tether = null; return; }
        const [dx, dy, d] = getVector(e.x, e.y, player.x, player.y);
        if (d > SHACKLE_LEASH && !e.type.startsWith('boss')) { // reeled back in
            const pull = Math.min(d - SHACKLE_LEASH, 500 * dt);
            e.x += (dx / d) * pull; e.y += (dy / d) * pull; clampToBounds(e, e.size / 2);
        }
        t.ax = e.x; t.ay = e.y;
    }
    if ((t.life -= dt) <= 0 || Math.hypot(t.ax - player.x, t.ay - player.y) > TETHER_SNAP) { player.tether = null; return; }

    if ((t.tick -= dt) <= 0) {
        t.tick += TETHER_TICK;
        const dmg = calcDmg(sk.baseDmg, sk.level) * TETHER_TICK_MULT;
        let touched = 0;
        for (const e of enemies) {
            if (e.dead || e.pod || e.submerged || distToSegment(e.x, e.y, player.x, player.y, t.ax, t.ay) > TETHER_WIDTH + e.size / 2) continue;
            applyDamage(e, dmg, 'magic'); touched++;
            if (!(e.slowTimer > 0) || (e.slowAmount || 0) < 0.4) e.slowAmount = 0.4;
            e.slowTimer = Math.max(e.slowTimer || 0, 0.5);
        }
        t.healing = touched > 0; // skillfx_e.js: the healing light
        if (touched) { // the chain feeds holy light back to you; Overflowing Grace turns what overflows full HP into a shield
            const heal = player.maxHp * Math.min(TETHER_HEAL_CAP, TETHER_HEAL * touched) * (hasTalent('pa_tether_mend') ? 1.5 : 1), room = player.maxHp - player.hp; // Mending Chain
            player.hp = Math.min(player.maxHp, player.hp + heal);
            if (sk.selectedUpg === 'A' && heal > room) addShield(heal - room, 3.0, hasTalent('pa_grace_cap') ? 0.7 : SHIELD_CAP); // combat.js: capped at half max HP (Abundant: 70%)
        }
    }

    if (sk.selectedUpg === 'B') { // Chain of Retribution: enemy shots that cross the chain break on it and fly back as holy bolts
        for (const p of projectiles) {
            if (!p.isEnemy || p.life <= 0 || distToSegment(p.x, p.y, player.x, player.y, t.ax, t.ay) > (hasTalent('pa_retri_heavy') ? 40 : TETHER_WIDTH) + (p.radius || 0)) continue; // Heavy Links
            p.life = 0; // expires this frame, so its normal on-expire behavior still runs
            effects.push({ type: 'dome_ripple', x: p.x, y: p.y, life: 0.3, maxLife: 0.3 });
            fireRetributionBolt(p.x, p.y, p.owner || p.sourceBoss);
            if (hasTalent('pa_retri_absorb')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.01); // Absorb
        }
        if (hasTalent('pa_retri_judge') && (t.judge -= dt) <= 0) { // Judgment Chain: the chain strikes everything along it
            t.judge = 2;
            effects.push({ type: 'lightning', x1: player.x, y1: player.y, x2: t.ax, y2: t.ay, color: '#fff59d', lineWidth: 6, life: 0.25, maxLife: 0.25 });
            for (const e of enemies) if (!e.dead && !e.pod && distToSegment(e.x, e.y, player.x, player.y, t.ax, t.ay) <= 30 + e.size / 2) applyDamage(e, calcDmg(sk.baseDmg, sk.level) * 1.5, 'magic');
        }
    }
}
function tetherEnded() { // Radiant Release: the shield the chain built bursts as a holy wave
    if (activeClass.skills[2].selectedUpg !== 'A' || !hasTalent('pa_grace_release') || !(player.shield > 0)) return;
    const amt = player.shield; player.shield = 0;
    effects.push({ type: 'holy_impact', x: player.x, y: player.y, radius: 180, life: 0.5, maxLife: 0.5 });
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= 180 + e.size / 2) applyDamage(e, amt / HIT_SCALE, 'magic');
    addShake(2.5);
}

// Flail Sweep (Q recall while chained to the planted hammer by Divine Tether): the hammer tears out and whips round you on the
// chain twice in 0.8 s, at the chain's length (120-300 px). Each pass the head hits x1.75 the hammer (x3.5 over both) and
// throws non-bosses 110 px outward with a 0.6 s stun; the chain hits everything inside the circle for x0.5 a pass. Then it's
// reeled into your hand as a clean catch (Q at 1.2 s). It ends the tether early, so it has to be worth more than the chain's
// last seconds. (First version: one pass, x1.5, only a thin ring at the chain's end. Playtest: "too weak, doesn't really
// do anything".) (combos.js)
function startFlail(h) {
    const r = Math.max(FLAIL_MIN, Math.min(FLAIL_MAX, Math.hypot(h.x - player.x, h.y - player.y)));
    h.state = 'returning'; h.returnMode = 'flail'; h.hitList = []; h.dragged = []; h.hurricaneTimer = 0;
    h.flail = { a: Math.atan2(h.y - player.y, h.x - player.x), r, t: 0, swept: 0, pass: 0, hit: new Set() };
    effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 90, life: 0.45, maxLife: 0.45 });
    burst(h.x, h.y, 0, Math.PI * 2, 12, { kind: 'debris', color: '#6d4c41', size: 4, life: 0.5, speed: [120, 300], drag: 5 }); // torn out of the ground
    comboText(); addShake(2.5);
}
function updateFlail(h, dt) {
    const f = h.flail, prev = f.a;
    f.t += dt; h.spin += dt * 30;
    if (f.t <= FLAIL_TIME) {
        const step = Math.PI * 2 * FLAIL_SPINS * dt / FLAIL_TIME;
        f.a += step; f.swept += step;
        if (f.swept >= Math.PI * 2 * (f.pass + 1)) { f.pass++; f.hit.clear(); addShake(2); } // a new pass: everything can be hit again
        for (const e of enemies) { // what the hammer and chain swept over since the last frame
            if (e.dead || e.pod || e.submerged || f.hit.has(e)) continue;
            const d = Math.hypot(e.x - player.x, e.y - player.y), rel = ((Math.atan2(e.y - player.y, e.x - player.x) - prev) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            if (rel > step + 0.15 || d - e.size / 2 > f.r + FLAIL_WIDTH) continue;
            f.hit.add(e);
            const head = Math.abs(d - f.r) <= FLAIL_WIDTH + e.size / 2;
            applyDamage(e, h.dmg * (head ? FLAIL_MULT : FLAIL_CHAIN_MULT), 'melee');
            if (!head || e.dead) continue;
            burst(e.x, e.y, f.a + Math.PI / 2, 1.2, 10, { kind: 'spark', color: '#ffe082', size: 2.8, life: 0.3, speed: [220, 480], drag: 6 });
            effects.push({ type: 'holy_impact', x: e.x, y: e.y, radius: 40, life: 0.3, maxLife: 0.3 });
            if (!e.type.startsWith('boss')) { shove(e, Math.atan2(e.y - player.y, e.x - player.x), FLAIL_KNOCK); e.stunTimer = Math.max(e.stunTimer || 0, FLAIL_STUN); }
        }
    } else f.r = Math.max(0, f.r - (f.r + 60) * dt / FLAIL_REEL); // reeled in
    h.x = player.x + Math.cos(f.a) * f.r; h.y = player.y + Math.sin(f.a) * f.r;
    if (f.t >= FLAIL_TIME + FLAIL_REEL) { h.flail = null; catchHammer(h, true); }
}
// The swept arc behind the whirling hammer (drawPaladinWorld)
function drawFlailArc(h) {
    const f = h.flail;
    if (!f || f.t > FLAIL_TIME) return;
    const len = 1.6; // radians of trail behind the head
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let s = 0; s < 10; s++) { // a band that thins and fades toward its tail
        const k = 1 - s / 10, a1 = f.a - s * len / 10, a0 = a1 - len / 10 - 0.02;
        ctx.strokeStyle = `rgba(255, 213, 79, ${0.45 * k})`; ctx.lineWidth = 6 + 30 * k;
        ctx.beginPath(); ctx.arc(player.x, player.y, f.r, a0, a1); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 248, 225, ${0.7 * k})`; ctx.lineWidth = 2 + 8 * k;
        ctx.beginPath(); ctx.arc(player.x, player.y, f.r, a0, a1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 236, 179, 0.12)'; ctx.lineWidth = f.r - 10; // the disc the chain sweeps, faintly lit (a ring at r/2, r wide)
    ctx.beginPath(); ctx.arc(player.x, player.y, f.r / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

// Ring the Hammer (a shield bash that strikes your own planted hammer): it rings like a bell and fires its pulse at once,
// x3 a pulse with a 0.5 s stun on non-bosses, at most every 3 s. The planted hammer becomes an instrument; you fight beside it. (combos.js)
function ringHammer(angle, radius, halfArc) {
    const h = player.hammer;
    if (!hammerDeployed() || (h.ringCd || 0) > fxTime || !inCone({ x: h.x, y: h.y, size: 40 }, player.x, player.y, angle, radius, halfArc)) return;
    h.ringCd = fxTime + RING_CD; h.pulseTimer = 1.0;
    for (let i = 0; i < 3; i++) effects.push({ type: 'circle_burst', x: h.x, y: h.y, radius: HAMMER_PULSE_RADIUS * (0.55 + 0.25 * i), color: `rgba(255, 236, 179, ${0.85 - 0.2 * i})`, life: 0.35 + 0.12 * i, maxLife: 0.35 + 0.12 * i }); // the bell's peal
    effects.push({ type: 'holy_impact', x: h.x, y: h.y, radius: 90, life: 0.45, maxLife: 0.45 });
    burst(h.x, h.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#fff8e1', size: 2.5, life: 0.4, speed: [200, 450], drag: 5 });
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - h.x, e.y - h.y) > HAMMER_PULSE_RADIUS + e.size / 2) continue;
        applyDamage(e, h.dmg * 0.25 * RING_MULT, 'magic');
        if (!e.type.startsWith('boss') && !e.dead) e.stunTimer = Math.max(e.stunTimer || 0, RING_STUN);
    }
    comboText(); addShake(2.5);
}

// Zealous Charge (R → Space): Righteous Charge or Iron Pull starting inside your Consecrated Wrath drags holy fire along its
// path, a 3 s burning strip (45 px each side, x0.5 of the Wrath's damage per second) that spreads the zone to where you went. (combos.js)
function zealousStart() {
    return effects.find(ef => ef.type === 'consecrated_ground' && ef.wrath && ef.life > 0 && Math.hypot(player.x - ef.x, player.y - ef.y) <= ef.radius) || null;
}
function zealousTrail(zone, x0, y0) {
    const x1 = player.x, y1 = player.y;
    if (Math.hypot(x1 - x0, y1 - y0) < 30) return;
    const L = Math.hypot(x1 - x0, y1 - y0), tongues = [], sigils = [];
    for (let i = 0, n = Math.round(L / 9); i < n; i++) tongues.push({ t: Math.random(), off: (Math.random() * 2 - 1) * ZEAL_TRAIL_WIDTH * 0.8, s: 0.6 + Math.random() * 0.6, ph: Math.random() * 6 });
    tongues.sort((a, b) => a.off - b.off); // far side first, so the flames overlap the right way
    for (let d = 40; d < L - 20; d += 70) sigils.push(d / L);
    effects.push({ type: 'zealous_trail', x1: x0, y1: y0, x2: x1, y2: y1, L, tongues, sigils, dmg: zone.dmg * ZEAL_TRAIL_MULT, life: ZEAL_TRAIL_TIME, maxLife: ZEAL_TRAIL_TIME,
        customUpdate: (dt, ef) => {
            if (ef.life > 0.4) emit(ef.L / 7, dt, () => { // white-gold motes rising off it, like the Wrath they came from
                const t = Math.random(), off = (Math.random() * 2 - 1) * ZEAL_TRAIL_WIDTH, nx = -(ef.y2 - ef.y1) / ef.L, ny = (ef.x2 - ef.x1) / ef.L;
                spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#fff8e1' : '#ffca28', x: lerp(ef.x1, ef.x2, t) + nx * off, y: lerp(ef.y1, ef.y2, t) + ny * off, vx: jitter(14), vy: -50 - Math.random() * 40, size: 1.7, life: 0.7, drag: 0.5, grow: 0, spin: 0, rot: 0 });
            });
            for (const e of enemies) {
                if (e.dead || e.pod || e.submerged || distToSegment(e.x, e.y, ef.x1, ef.y1, ef.x2, ef.y2) > ZEAL_TRAIL_WIDTH + e.size / 2) continue;
                applyDamage(e, ef.dmg * dt, 'dot');
            }
        } });
    comboText();
}

// Judgment Smash (combos.js, the Space finisher): an overhead smash that stuns everything around the impact.
// After Iron Pull the Paladin stands on the planted hammer and rips it out of the ground into the smash (back in hand).
// Returns false while the hammer is still flying, so that basic stays a normal shield bash.
function judgmentSmash(dmg) {
    const h = player.hammer;
    if (h.state === 'deployed' && Math.hypot(h.x - player.x, h.y - player.y) <= 90) {
        h.state = 'equipped'; h.x = player.x; h.y = player.y; h.dragged = []; h.hurricaneTimer = 0; h.returnMode = null;
        if (!devNoCooldowns) cooldowns.s1 = cooldownMax.s1 = HAMMER_CATCH_CD; // as after a clean catch
        burst(player.x, player.y, -Math.PI / 2, 2.4, 12, { kind: 'debris', color: '#8d6e63', size: 4, life: 0.4, speed: [120, 280], drag: 5 });
    }
    if (h.state !== 'equipped') return false;
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    const ix = player.x + Math.cos(angle) * 60, iy = player.y + Math.sin(angle) * 60;
    dmg *= JUDGMENT_MULT * (hasItem('Gauntlets of Devotion') ? 1.3 : 1);
    effects.push({ type: 'holy_impact', x: ix, y: iy, radius: JUDGMENT_RADIUS, life: 0.55, maxLife: 0.55 });
    effects.push({ type: 'judgment_smash', x: ix, y: iy, radius: JUDGMENT_RADIUS, life: 0.6, maxLife: 0.6 }); // skillfx.js
    addShake(5);
    let hits = 0;
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - ix, e.y - iy) > JUDGMENT_RADIUS + e.size / 2) continue;
        applyDamage(e, dmg, 'melee_basic'); hits++;
        e.stunTimer = Math.max(e.stunTimer || 0, JUDGMENT_STUN); // bosses shake it off 3x as fast (~0.5 s)
    }
    if (hasItem('Gauntlets of Devotion')) basicHitHeal(hits); // items.js
    if (hasWorldBreaker()) spawnFaultLines(angle, JUDGMENT_RADIUS + 40, Math.PI / 2);
    return true;
}

// Chain of Retribution: homing holy bolt back at whoever fired the blocked projectile
function fireRetributionBolt(x, y, attacker) {
    projectiles.push({
        x: x, y: y, vx: 0, vy: 0, radius: 6, color: '#fff59d', life: 2.0, type: 'basic', shape: 'fireball', isRetribution: true,
        damage: calcDmg(15, activeClass.skills[2].level) * (hasTalent('pa_retri_wrath') ? 2 : 1), pierce: false, // Wrathful Bolts hitList: [], isEnemy: false, target: attacker,
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

// World-space visuals: fault lines, shockwaves, the thrown hammer, its chain, and Divine Tether (consecrated ground: skillfx_ult.js)
function drawPaladinWorld() {
    for (const ef of effects) {
        const a = Math.max(0, ef.life / ef.maxLife);
        if (ef.type === 'zealous_trail') { // Zealous Charge: Consecrated Wrath's holy fire, laid along the charge
            const el = ef.maxLife - ef.life, a = Math.min(1, ef.life / 0.6), lit = Math.min(1, el / 0.25); // it catches from the start of the charge to the end
            const ux = (ef.x2 - ef.x1) / ef.L, uy = (ef.y2 - ef.y1) / ef.L, nx = -uy, ny = ux, W = ZEAL_TRAIL_WIDTH;
            ctx.save();
            for (let d = 0; d <= ef.L * lit; d += 30) { // soft glowing ground, no hard edge
                const x = ef.x1 + ux * d, y = ef.y1 + uy * d, g = ctx.createRadialGradient(x, y, 0, x, y, W * 1.25);
                g.addColorStop(0, `rgba(255, 236, 179, ${0.13 * a})`); g.addColorStop(0.6, `rgba(255, 179, 0, ${0.1 * a})`); g.addColorStop(1, 'rgba(255, 143, 0, 0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, W * 1.25, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalCompositeOperation = 'lighter';
            for (const t of ef.sigils) { // holy sigils burned into it, pulsing
                if (t > lit) continue;
                const x = lerp(ef.x1, ef.x2, t), y = lerp(ef.y1, ef.y2, t), pa = a * (0.45 + 0.25 * Math.sin(fxTime * 5 + t * 9));
                ctx.strokeStyle = `rgba(255, 224, 130, ${pa})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x - ux * 8, y - uy * 8); ctx.lineTo(x + ux * 8, y + uy * 8); ctx.moveTo(x - nx * 8, y - ny * 8); ctx.lineTo(x + nx * 8, y + ny * 8); ctx.stroke();
            }
            for (const t of ef.tongues) { // flickering flame tongues, licking upward (as in the Wrath zone)
                if (t.t > lit) continue;
                const grow = Math.min(1, (lit - t.t) * 5), x = lerp(ef.x1, ef.x2, t.t) + nx * t.off, y = lerp(ef.y1, ef.y2, t.t) + ny * t.off;
                const h = (22 + 10 * Math.sin(fxTime * 11 + t.ph)) * t.s * grow, w = 7 * t.s, sway = Math.sin(fxTime * 7 + t.ph) * 4;
                const bg = ctx.createRadialGradient(x, y, 0, x, y, w * 2.2);
                bg.addColorStop(0, `rgba(255, 213, 79, ${0.3 * a})`); bg.addColorStop(1, 'rgba(255, 213, 79, 0)');
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, w * 2.2, 0, Math.PI * 2); ctx.fill();
                const fg = ctx.createLinearGradient(x, y, x, y - h);
                fg.addColorStop(0, `rgba(255, 193, 7, ${0.55 * a})`); fg.addColorStop(0.5, `rgba(255, 248, 225, ${0.6 * a})`); fg.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = fg;
                ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 0.5, x + sway, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.5, x + w, y); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        } else if (ef.type === 'fault_line') {
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
        const scale = h.hurricaneTimer > 0 ? 2.4 : h.returnMode === 'flail' ? 1.7 : (h.state === 'deployed' ? 1.3 : 1.1);
        if (spinning) { // spin blur disc behind the whirling mace
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const blur = ctx.createRadialGradient(h.x, h.y, 4 * scale, h.x, h.y, 32 * scale);
            blur.addColorStop(0, 'rgba(255, 245, 157, 0)'); blur.addColorStop(0.8, 'rgba(255, 245, 157, 0.22)'); blur.addColorStop(1, 'rgba(255, 245, 157, 0)');
            ctx.fillStyle = blur; ctx.beginPath(); ctx.arc(h.x, h.y, 32 * scale, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (h.hurricaneTimer > 0) drawHammerStorm(h); // skillfx_ult.js
        if (h.returnMode === 'flail') drawFlailArc(h);
        drawMace(h.x, h.y, spinning ? h.spin : -Math.PI / 2 - 0.3, scale);
    }

    if (player.tether) drawTether(player.tether);
}

// Divine Tether: a chain of golden links in a glow, shooting out from the Paladin on cast and fading as it runs out.
// Each tick a pulse of light runs down it.
function drawTether(t) {
    const out = clamp01((fxTime - t.castAt) / 0.12), x0 = player.x, y0 = player.y;
    const x1 = lerp(x0, t.ax, out), y1 = lerp(y0, t.ay, out), L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 2) return;
    const a = Math.atan2(y1 - y0, x1 - x0), fade = Math.min(1, t.life / 0.5), pulse = 1 - clamp01(t.tick / TETHER_TICK);
    ctx.save();
    ctx.globalAlpha = fade; ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 213, 79, ${0.25 + 0.15 * pulse})`; ctx.lineWidth = TETHER_WIDTH * 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const px = lerp(x0, x1, pulse), py = lerp(y0, y1, pulse); // the pulse running down the chain
    ctx.fillStyle = 'rgba(255, 248, 225, 0.7)'; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x0, y0); ctx.rotate(a);
    ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2.5;
    for (let s = 10, i = 0; s < L - 4; s += 13, i++) { // links alternate flat and edge-on
        ctx.beginPath();
        if (i % 2) ctx.ellipse(s, 0, 7, 4, 0, 0, Math.PI * 2); else { ctx.moveTo(s - 7, 0); ctx.lineTo(s + 7, 0); }
        ctx.stroke();
    }
    ctx.restore();
}
