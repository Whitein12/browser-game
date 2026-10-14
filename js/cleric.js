// ==========================================
// cleric.js - The Cleric's web talents (CLASS_WEBS.md; data in talents.js TALENT_WEBS.cleric)
// ==========================================
// The Holy (A) / Shadow (B) evolutions stay in skills.js; this file holds what the talents add and is called from there
// and from main.js / combat.js. Divine Ray: Radiant Flash (Searing Light, Zealous Gaze, Judgment, Dawnbreak) / Void Spike
// (Hunger, Leech, Grasping Dark, Void Collapse). Hallowed Ground: Sanctuary / Desecration. Phase Shift: Divine Transposition
// (cl.swap: a second swap back) / Raven Flight (cl.ravens: Raven Swarm). Ascension: Avatar of Renewal / Aspect of the Reaper
// (cl.drained feeds Last Rite).

const cl = { swap: null, ravens: null, drained: 0, censer: 0, reaperWas: false, avatarWas: false };
function resetCleric() { cl.swap = cl.ravens = null; cl.drained = 0; cl.censer = 0; cl.reaperWas = cl.avatarWas = false; }

// Righteous Exchange: the swapped enemy takes x2 from the next ray that reaches it (one ray claims the mark)
function clJudge(e, ray) {
    if (!e.clJudged) return 1;
    if (!e.clJudgeRay) e.clJudgeRay = ray;
    return e.clJudgeRay === ray ? 2 : 1;
}
function clRayEnd(ray) { for (const e of enemies) if (e.clJudgeRay === ray) { e.clJudged = false; e.clJudgeRay = null; } }

// A Void Spike tick landed: Leech heals, Grasping Dark slows, Void Collapse bursts the kills
function clVoidHit(e, amt, wasDead) {
    if (hasTalent('cl_void_leech')) player.hp = Math.min(player.maxHp, player.hp + amt * HIT_SCALE * 0.15);
    if (e.dead) {
        if (wasDead || !hasTalent('cl_void_collapse')) return;
        effects.push({ type: 'holy_nova', x: e.x, y: e.y, radius: 120, color: '#ce93d8', life: 0.4, maxLife: 0.4 });
        for (const o of enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) <= 120 + o.size / 2) applyDamage(o, amt * 3, 'magic');
        if (buffs.aspectOfReaper > 0) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.03);
        else if (!buffs.zealLocked) player.zeal = Math.min(player.maxZeal, player.zeal + 10);
        return;
    }
    if (hasTalent('cl_void_grasp') && (!(e.slowTimer > 0) || e.slowAmount <= 0.4)) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = 0.4; }
}
// Dawnbreak: a 100-Zeal Radiant Flash ends in a nova that stuns
function clDawnbreak() {
    effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 150, life: 0.5, maxLife: 0.5 });
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= 150 + e.size / 2) e.stunTimer = Math.max(e.stunTimer || 0, 1);
    addShake(2.5);
}

// Hallowed Ground, each frame / each tick (skills.js customUpdate)
function clSanctFrame(p) { // Hallowed Ward: enemy shots that enter are destroyed
    if (!hasTalent('cl_sanct_ward')) return;
    for (let i = projectiles.length - 1; i >= 0; i--) { const q = projectiles[i]; if (q.isEnemy && Math.hypot(q.x - p.x, q.y - p.y) < p.radius) { effects.push({ type: 'sparkle_poof', x: q.x, y: q.y, color: '#ffe082' }); projectiles.splice(i, 1); } }
}
function clSanctTick(p) { // Aegis: a little shield per tick inside
    if (hasTalent('cl_sanct_aegis') && Math.hypot(player.x - p.x, player.y - p.y) <= p.radius) addShield(player.maxHp * 0.03, 1.0);
}
function clGroundEnd(p) { // Holy Pillar: the Sanctuary ends in a pillar of light
    if (!p.isHoly || !hasTalent('cl_sanct_pillar') || p.pillarDone) return;
    p.pillarDone = true;
    effects.push({ type: 'holy_nova', x: p.x, y: p.y, radius: p.radius, life: 0.6, maxLife: 0.6 });
    if (Math.hypot(player.x - p.x, player.y - p.y) <= p.radius + 40) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.15);
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size / 2) e.blindTimer = Math.max(e.blindTimer || 0, 2);
}
function clDesecTick(p, dmg) { // Desecration: Creeping Dark grows, Siphon heals, Wither marks
    if (hasTalent('cl_desec_creep')) p.radius = p.baseR * (1 + 0.5 * (1 - p.life / p.maxLife));
    let hits = 0;
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size / 2) { e.clWitherUntil = fxTime + 0.6; hits++; }
    if (hits && hasTalent('cl_desec_siphon')) player.hp = Math.min(player.maxHp, player.hp + dmg * HIT_SCALE * 0.3 * hits);
}

// Phase Shift: Second Swap, Raven Swarm, Dread
function clRavenDread(e, x0, y0) { // non-bosses on the path flee for 1.5 s
    if (!hasTalent('cl_raven_dread') || e.type.startsWith('boss') || e.prop) return;
    const a = Math.atan2(e.y - y0, e.x - x0);
    e.tauntTimer = 1.5; e.tauntX = e.x + Math.cos(a) * 400; e.tauntY = e.y + Math.sin(a) * 400;
}

function clSwapBack() { // Second Swap: trade places with the same enemy again
    const e = cl.swap.e; cl.swap = null;
    if (!e || e.dead) return;
    const px = player.x, py = player.y;
    player.x = e.x; player.y = e.y; e.x = px; e.y = py; clampToBounds(player, player.radius); clampToBounds(e, e.size / 2);
    effects.push({ type: 'transposition', x0: px, y0: py, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
    effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 46, life: 0.45, maxLife: 0.45 });
}

// Ascension
function clAvatarBolt(p, e) { applyDamage(e, p.damage, 'magic'); if (hasTalent('cl_avatar_heal')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.01); } // main.js spellHit: Renewal
function clScythe(dmg) { // the censer under the Reaper: every 3rd pulse reaps an arc
    if (!(buffs.aspectOfReaper > 0) || !hasTalent('cl_reaper_scythe') || ++cl.censer % 3) return;
    const a = Math.atan2(mouseY - player.y, mouseX - player.x);
    effects.push({ type: 'sw_cone', x: player.x, y: player.y, angle: a, radius: 160, half: 1.05, color: '#9c27b0', life: 0.3, maxLife: 0.3 });
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > 160 + e.size / 2) continue;
        if (Math.abs(Math.atan2(Math.sin(Math.atan2(e.y - player.y, e.x - player.x) - a), Math.cos(Math.atan2(e.y - player.y, e.x - player.x) - a))) <= 1.05) applyDamage(e, dmg * 2, 'magic');
    }
}
function clPower() { return (buffs.avatarOfRenewal > 0 || buffs.aspectOfReaper > 0 || buffs.ascension > 0) && hasTalent('cl_asc_power') ? 0.1 : 0; } // combat.js powerParts: Exaltation
const clMoveMult = () => activeClass.name === 'Cleric' && buffs.inSanctuary && hasTalent('cl_sanct_haste') ? 1.2 : 1; // main.js: Blessed Steps
function clDmgMult(e) { // talents.js talentDmgMult: Judgment (blinded), Wither (in the Desecration)
    return (hasTalent('cl_flash_judge') && e.blindTimer > 0 ? 1.2 : 1) * (hasTalent('cl_desec_wither') && e.clWitherUntil > fxTime ? 1.15 : 1);
}
function clOnKill(e) { // talents.js talentsOnKill: Rot leaves a patch of desecration
    if (!hasTalent('cl_desec_rot') || !(e.clWitherUntil > fxTime)) return;
    const dmg = calcDmg(activeClass.skills[2].baseDmg, activeClass.skills[2].level);
    effects.push({ type: 'fire_puddle', x: e.x, y: e.y, radius: 60, color: 'rgba(106, 27, 154, 0.35)', life: 2, maxLife: 2, dmg: dmg * 1.4, slow: 0.4 });
}

function updateCleric(dt) { // main.js update
    if (activeClass.name !== 'Cleric') return;
    if (cl.swap && (cl.swap.t -= dt) <= 0) { cl.swap = null; cooldowns.s3 = cooldownMax.s3 = devNoCooldowns ? 0 : skillBaseCd(3, activeClass.skills[3].level) * getCDR(); } // the chance to swap back passed
    const R = cl.ravens;
    if (R) { // Raven Swarm: ravens circle the landing, pecking and blinding
        if ((R.tick -= dt) <= 0) {
            R.tick = 0.4;
            for (const e of enemies) if (!e.dead && Math.hypot(e.x - R.x, e.y - R.y) <= 130 + e.size / 2) { applyDamage(e, R.dmg * 0.4, 'magic'); if (!e.dead) e.blindTimer = Math.max(e.blindTimer || 0, 0.5); }
        }
        for (let k = 0; k < 2; k++) { const a = Math.random() * Math.PI * 2; spawnParticle({ kind: 'dot', color: '#4a148c', x: R.x + Math.cos(a) * 110, y: R.y + Math.sin(a) * 110, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, size: 3, life: 0.35, drag: 0, grow: 0, spin: 0, rot: 0 }); }
        if ((R.t -= dt) <= 0) cl.ravens = null;
    }
    // the ends of the two Ascensions: Seraph and Last Rite
    if (cl.avatarWas && !(buffs.avatarOfRenewal > 0) && hasTalent('cl_avatar_seraph')) {
        effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 250, life: 0.6, maxLife: 0.6 });
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.2);
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= 250 + e.size / 2) e.stunTimer = Math.max(e.stunTimer || 0, 1.5);
        addShake(3);
    }
    if (cl.reaperWas && !(buffs.aspectOfReaper > 0)) {
        if (hasTalent('cl_reaper_rite') && cl.drained > 0) {
            effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 300, color: '#ce93d8', life: 0.6, maxLife: 0.6 });
            for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= 300 + e.size / 2) applyDamage(e, cl.drained * 0.2 / HIT_SCALE, 'magic');
            addShake(3);
        }
        cl.drained = 0;
    }
    cl.avatarWas = buffs.avatarOfRenewal > 0; cl.reaperWas = buffs.aspectOfReaper > 0;
}
function drawCleric() { // main.js draw: the raven swarm's ring
    if (activeClass.name !== 'Cleric' || !cl.ravens) return;
    const R = cl.ravens; ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.lineDashOffset = fxTime * 40;
    ctx.beginPath(); ctx.arc(R.x, R.y, 120, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
