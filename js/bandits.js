// ==========================================
// bandits.js - Bandit Bastion enemies: sprites, their shots, fire on the ground and powder kegs
// ==========================================
// Bandits are drawn like the heroes (sprites.js): top-down in a local frame where +x is where they face and +y their
// right side, rendered through an offscreen canvas so the light from the top-left and the hit flash tint each one as a
// single image. Fallen bandits stay on the ground for a few seconds as a 'bandit_corpse' effect.
// Fire and kegs work on any map: the Warchief throws torches and kicks kegs in Endless too. The village's own kegs
// (map_village.js) are props: enemies of type 'powder_keg' with `pod` and `prop` set, so any hit sets one off but
// nothing aims at them, and they never count toward the wave (combat.js hands their death to kegBlown).

const BANDIT_TYPES = { thief: 1, archer: 1, shield: 1, horse: 1, trapper: 1, bannerman: 1, hound: 1, slinger: 1, boss_warlord: 1, boss_beastmaster: 1, boss_valerius: 1, powder_keg: 1 };
const BANDIT_CANVAS = 360; // the mounted Beastmaster is long: his lance and his warhorse
const banditCanvas = document.createElement('canvas'); banditCanvas.width = banditCanvas.height = BANDIT_CANVAS;
const banditCtx = banditCanvas.getContext('2d');
const BANDIT_SKIN = '#c9956f';
const WIND_X = 0.8, WIND_Y = -0.6; // smoke, flames and embers all drift north-east

// Fire and powder (numbers in one place)
const FIRE_DPS = w => 10 + w * 1.5;           // to the hero standing in it (before the global ×0.6)
const FIRE_DPS_ENEMY = w => 20 + w * 5;       // to bandits in it (the Warchief walks through his own fire)
const KEG_RADIUS = 115, KEG_CHAIN = 150;      // blast radius; other kegs this close catch and go off a moment later
const KEG_DMG = w => 14 + w * 3;              // to the hero
const KEG_DMG_ENEMY = w => 50 + w * 12;       // to enemies (a stagger on the Warchief too)
const KEG_RESPAWN = 28;                       // seconds until a blown keg's spot is restocked (map_village.js)
const TORCH_FLIGHT = 0.75, TORCH_FIRE_R = 75, TORCH_FIRE_LIFE = 5;

// ---------- cached glows and flames ----------
// The village can have a dozen fires on screen. A fresh gradient or a curved path per fire per frame was the lag on
// slower PCs, so every glow is one soft sprite per colour, and flames are 12 frames painted once and stretched.

const GLOW_SPR = new Map();
function glow(c, x, y, r, color, a) { // same look as ptGlow (portraits.js): colour at the centre fading to nothing at r
    let g = GLOW_SPR.get(color);
    if (!g) { g = cavCanvas(128, 128); const k = g.getContext('2d'), gr = k.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, ptRgba(color, 1)); gr.addColorStop(1, ptRgba(color, 0)); k.fillStyle = gr; k.fillRect(0, 0, 128, 128); GLOW_SPR.set(color, g); }
    if (a <= 0.005 || r <= 0) return;
    const a0 = c.globalAlpha; c.globalAlpha = a0 * Math.min(1, a); c.drawImage(g, x - r, y - r, r * 2, r * 2); c.globalAlpha = a0;
}

const FLAME_FRAMES = 12, FLAME_R = 40;
let FLAME_SPR = null;
// A fire seen from above: a ring of flickering tongues around a white-hot core, the longest leaning downwind. k scales it.
function drawFlame(c, x, y, r, t, seed, k = 1) {
    if (k <= 0.03 || r <= 0) return;
    if (!FLAME_SPR) FLAME_SPR = Array.from({ length: FLAME_FRAMES }, (_, f) => {
        const cv = cavCanvas(FLAME_R * 4, FLAME_R * 4); paintFlame(cv.getContext('2d'), FLAME_R * 2, FLAME_R * 2, FLAME_R, f / FLAME_FRAMES * Math.PI * 2); return cv;
    });
    const f = ((Math.floor(t * 12 + seed * 5.3) % FLAME_FRAMES) + FLAME_FRAMES) % FLAME_FRAMES, h = 2 * FLAME_R * r * k / FLAME_R;
    c.drawImage(FLAME_SPR[f], x - h, y - h, h * 2, h * 2);
}
function paintFlame(c, x, y, r, ph) { // one frame; ph runs once round the loop, so the frames cycle seamlessly
    const wa = Math.atan2(WIND_Y, WIND_X), n = 7, pts = [];
    for (const [col, s] of [['rgba(176, 38, 8, 0.8)', 1], ['rgba(250, 112, 0, 0.9)', 0.72], ['rgba(255, 204, 80, 0.95)', 0.46], ['rgba(255, 248, 215, 0.9)', 0.2]]) {
        pts.length = 0;
        for (let i = 0; i < n * 2; i++) {
            const a = wa + i / (n * 2) * Math.PI * 2 + Math.sin(ph + i) * 0.12, lean = 0.5 + 0.5 * Math.cos(a - wa);
            const fl = 0.7 + 0.3 * Math.sin(ph * (1 + (i % 3)) + i * 1.9);
            const rr = r * s * (i % 2 ? 0.4 : 0.5 + 0.8 * lean * fl);
            pts.push([x + Math.cos(a) * rr + WIND_X * r * s * 0.18, y + Math.sin(a) * rr * 0.85 + WIND_Y * r * s * 0.18]);
        }
        c.fillStyle = col; c.beginPath();
        const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
        c.moveTo(...m(pts[pts.length - 1], pts[0]));
        for (let i = 0; i < pts.length; i++) c.quadraticCurveTo(...pts[i], ...m(pts[i], pts[(i + 1) % pts.length]));
        c.fill();
    }
}

// ---------- drawing a bandit ----------

function drawBandit(e) {
    if (e.type === 'powder_keg') { drawKeg(e); return true; }
    animMotion(e); // enemysprites.js: hop (walk cycle), movement direction, how much it's moving
    const scale = e.size / 26, boss = e.type === 'boss_warlord';
    let x = e.x, y = e.y, alpha = 1, z = 0;
    if (e.spawnT > 0) { // stepping out of a doorway, out of the trees or vaulting the barricade (map_village.js)
        const k = 1 - e.spawnT / e.spawnMax;
        alpha = Math.min(1, k * 1.8);
        if (e.spawnOX !== undefined) { x = lerp(e.spawnOX, e.x, easeOut(k)); y = lerp(e.spawnOY, e.y, easeOut(k)); }
        if (e.spawnFrom === 'gate') z = Math.sin(Math.PI * k) * 55;
    }
    z += e.liftZ > 0 ? e.liftZ : 0; // Valerius's leaps (ai.js, map_bridge.js)
    alpha *= 1 - (e.fadeK || 0); // ...and his last drop behind the castle wall
    const face = e.state === 'intro' ? Math.PI / 2 : (e.facingAngle || 0);
    // the thief's sidestep when it evades a hit (combat.js sets dodgeAt)
    if (e.dodgeAt !== undefined && fxTime - e.dodgeAt < 0.3) {
        const q = (fxTime - e.dodgeAt) / 0.3, off = Math.sin(q * Math.PI) * 18 * e.dodgeSide;
        stampBandit(e, x, y, face, scale, banditPose(e, face), 0, 0.25 * (1 - q));
        x += -Math.sin(face) * off; y += Math.cos(face) * off;
    }
    if (e.state === 'dash_execute' || e.state === 'lunge' || e.ghosting) { // afterimages along a charge or a thrust (and Valerius's fast moves, ai.js)
        (e.ghosts = e.ghosts || []).push([e.x, e.y]); if (e.ghosts.length > (boss ? 4 : 3)) e.ghosts.shift();
        e.ghosts.forEach(([gx, gy], i) => stampBandit(e, gx, gy, face, scale, banditPose(e, face), 0, 0.12 + i * 0.06));
    } else e.ghosts = null;

    if (e.type === 'shield' && e.state === 'bash_windup') { // the bash's reach: a wedge in front, its edge sweeping out
        const k = clamp01(1 - e.stateTimer / BASH_WINDUP), R = e.size / 2 + 78;
        ctx.save(); ctx.globalAlpha = 0.16 + 0.24 * k; ctx.fillStyle = '#ff5722';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, R, face - 1.2, face + 1.2); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffccbc'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.size / 2 + (R - e.size / 2) * k, face - 1.2, face + 1.2); ctx.stroke();
        ctx.restore();
    }
    if (e.type === 'bannerman') drawRallyAura(e);
    if (e.type === 'boss_beastmaster' && e.state === 'bolas') drawBolasAim(e);
    const sh = 1 - Math.min(0.5, z / 120); // the shadow shrinks and fades as the body rises
    if (e.liftZ > 0) { ctx.save(); ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + 4, y + 6, e.size * 0.75 * (1 - Math.min(0.55, e.liftZ / 700)), e.size * 0.5 * (1 - Math.min(0.55, e.liftZ / 700)), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } // a leap's shadow stays dark: you can see where he'll come down
    ctx.save(); ctx.globalAlpha = alpha * 0.32 * sh; ctx.fillStyle = '#000'; // shadow
    const longBody = e.type === 'horse' || (e.type === 'boss_beastmaster' && (e.state === 'joust_prep' || e.state === 'jousting'));
    ctx.beginPath(); ctx.ellipse(x + 3, y + 6 * scale, (longBody ? 30 : 14) * scale * sh, (longBody ? 12 : 11) * scale * sh, longBody ? face : 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (e.type === 'shield' && e.shieldMax > 0 && !(e.shieldHp > 0) && !e.shieldGone) { // the shield splinters
        e.shieldGone = true; addShake(2);
        burst(e.x + Math.cos(face) * 14, e.y + Math.sin(face) * 14, face, 2.2, 12, { kind: 'debris', color: '#8d6e63', size: 4, speed: [80, 260], life: 0.6, drag: 3 });
        burst(e.x + Math.cos(face) * 14, e.y + Math.sin(face) * 14, face, 1.6, 6, { kind: 'spark', color: '#cfd8dc', size: 2, speed: [120, 300], life: 0.25, drag: 5 });
    }
    const lift = e.liftZ > 0 ? 1 + e.liftZ / 380 : 1; // high in a leap, he looms larger (closer to the eye)
    if (lift !== 1) { ctx.save(); ctx.translate(x, y - z); ctx.scale(lift, lift); ctx.translate(-x, -(y - z)); }
    stampBandit(e, x, y - z, face, scale, banditPose(e, face), e.hitFlash > 0 ? 1 : 0, alpha, e.type === 'hound' ? 0.3 : 0); // hounds run darker
    if (lift !== 1) ctx.restore();
    if (e.rallyT > 0) { // a red pennant over a rallied bandit (ai.js: the bannerman's rally)
        const py = y - z - e.size * 0.9;
        ctx.save(); ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py - 10); ctx.stroke();
        ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(x, py - 10); ctx.lineTo(x + 7, py - 7.5); ctx.lineTo(x, py - 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (e.type === 'thief' && e.state === 'windup') { // a glint off both blades as it draws them back
        const k = clamp01(1 - e.stateTimer / THIEF_WINDUP), c = Math.cos(face), sn = Math.sin(face);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const sd of [-1, 1]) { const lx = 14 * scale, ly = sd * 7 * scale, gx = x + lx * c - ly * sn, gy = y + lx * sn + ly * c, r = 3 + 3.5 * k;
            glow(ctx, gx, gy, r * 1.8, '#ffffff', 0.22 + 0.2 * k); ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r); ctx.stroke(); }
        ctx.restore();
    }
    if (boss) { // his torch lights him up
        const k = e.state === 'torch_toss' ? clamp01(1 - e.stateTimer / 0.55) : 0, [tx, ty] = warchiefTorchTip(e, face, scale, k);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, tx, ty, 70 + Math.sin(fxTime * 13) * 6, '#ff8f00', 0.42); ctx.restore();
        if (Math.random() < 0.25) spawnParticle({ kind: 'dot', color: '#ffb74d', x: tx, y: ty, vx: WIND_X * 40 + jitter(30), vy: WIND_Y * 40 + jitter(30), size: 2, life: 0.6, drag: 1, grow: 0, spin: 0, rot: 0 });
    }
    if (!e.type.startsWith('boss') && e.hp < e.maxHp && !(e.spawnT > 0)) { // bosses have the HUD bar // a small health bar once it's hurt, like the slimes'
        const w = e.size, bx = e.x - w / 2, by = e.y - e.size / 2 - 16;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(bx - 1, by - 1, w + 2, 5);
        ctx.fillStyle = '#8bc34a'; ctx.fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 3);
    }
    return true;
}

// A bannerman's rally zone (ai.js RALLY_RADIUS): 12 red arcs turning slowly in one stroke. No fill and no line dash:
// a 300 px translucent disc and a dashed ring per bannerman every frame were the stage 2 lag on weaker PCs
function drawRallyAura(e) {
    const R = RALLY_RADIUS, a0 = fxTime * 0.12, step = Math.PI * 2 / 12;
    ctx.save(); ctx.strokeStyle = 'rgba(229, 57, 53, 0.4)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < 12; k++) { const a = a0 + k * step; ctx.moveTo(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R); ctx.arc(e.x, e.y, R, a, a + step * 0.6); }
    ctx.stroke(); ctx.restore();
}

// The Beastmaster's bolas wind-up: three lanes fanned along his aim (ai.js e.bolasA), growing as the cord spins up,
// bright and still once the aim locks (the last 0.25 s), so the throw can be read and stepped out of
function drawBolasAim(e) {
    const k = e.bolasK || 0, a0 = e.bolasA === undefined ? e.facingAngle : e.bolasA, locked = e.stateTimer <= 0.25, L = 170 + 260 * k;
    ctx.save(); ctx.lineCap = 'round';
    for (let r = -1; r <= 1; r++) {
        const a = a0 + r * 0.2, c = Math.cos(a), sn = Math.sin(a), x0 = e.x + c * 34, y0 = e.y + sn * 34, x1 = e.x + c * L, y1 = e.y + sn * L;
        ctx.globalAlpha = locked ? 0.55 : 0.18 + 0.25 * k; ctx.strokeStyle = '#ffb74d'; ctx.lineWidth = locked ? 5 : 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalAlpha = locked ? 0.9 : 0.4 * k; ctx.fillStyle = '#fff3e0'; // a stone marker at the tip
        ctx.beginPath(); ctx.arc(x1, y1, locked ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// What the body is doing this frame: walk cycle, cloth drag and the attack wind-ups
function banditPose(e, face) {
    const cos = Math.cos(face), sin = Math.sin(face), vx = Math.cos(e.face || 0) * (e.mv || 0), vy = Math.sin(e.face || 0) * (e.mv || 0);
    const p = { t: fxTime + (e.seed || 0), walk: (e.hop || 0) * 0.7, move: e.mv || 0, trail: { x: -(vx * cos + vy * sin) * 9, y: -(-vx * sin + vy * cos) * 9 } };
    p.stab = 0;
    if (e.type === 'thief') p.stab = e.state === 'windup' ? -0.6 * clamp01(1 - e.stateTimer / THIEF_WINDUP) : e.state === 'lunge' ? 1 : e.state === 'recover' ? clamp01(e.stateTimer / 0.35) : 0; // daggers drawn back, thrust, eased back
    if (e.type === 'archer') p.draw = clamp01(1 - e.attackTimer / 0.45);
    if (e.type === 'shield') {
        p.shield = e.shieldMax > 0 ? Math.max(0, e.shieldHp) / e.shieldMax : 0;
        p.bash = e.state === 'bash_windup' ? -clamp01(1 - e.stateTimer / BASH_WINDUP) : e.state === 'bash' ? 1 : e.state === 'bash_recover' ? clamp01(e.stateTimer / 0.5) : 0; // pulled in, shoved out
        if (!(p.shield > 0)) p.stab = Math.max(0, p.bash); // no shield left: it chops with the axe instead
    }
    if (e.type === 'boss_warlord') {
        p.throwK = e.state === 'knife_volley' ? clamp01(1 - e.stateTimer / 0.5) : 0;
        p.torchK = e.state === 'torch_toss' ? clamp01(1 - e.stateTimer / 0.55) : 0;
        p.kegK = e.state === 'keg_kick' ? clamp01(1 - e.stateTimer / 0.7) : 0;
        p.crouch = e.state === 'dash_telegraph' ? 1 : e.state === 'dash_recover' ? 0.5 : 0; // head down for the charge, winded after it
        p.lunge = e.state === 'dash_execute' ? 1 : 0;
        p.hurt = e.hp < e.maxHp * 0.5;
    }
    if (e.type === 'horse') { // the lance couches while it aims and charges, eases off as it wheels away; the legs gallop with the clock
        p.charging = e.state === 'charge';
        p.couch = p.charging ? 1 : e.state === 'lance_aim' ? clamp01(1 - e.stateTimer / RIDER_AIM) : e.state === 'wheel' ? clamp01(e.stateTimer) : 0;
        p.walk = p.t * (p.charging ? 22 : 13);
    }
    if (e.type === 'boss_beastmaster') {
        p.mounted = e.state === 'joust_prep' || e.state === 'jousting' || (e.dismountAt !== undefined && fxTime - e.dismountAt < 0.5); // in the saddle for the joust and a moment after
        p.couch = e.state === 'jousting' ? 1 : e.state === 'joust_prep' ? clamp01(1 - e.stateTimer / (e.prepLen || 1)) : 0; // the lance comes down through the prep
        p.charging = e.state === 'jousting';
        if (p.mounted) { p.walk = p.t * (p.charging ? 22 : 13); p.move = p.charging ? 1 : 0; } // the warhorse gallops under the charge
        p.lash = e.lashAt !== undefined && fxTime - e.lashAt < 0.3 ? Math.sin(Math.PI * (fxTime - e.lashAt) / 0.3) : 0; // the arm flung forward as the whip cracks
        p.whipK = e.state === 'whip' ? clamp01(1 - e.stateTimer / (e.whipLen || 0.5)) : 0; // the whip drawn back over his shoulder
        if (e.state === 'winded') p.trail = { x: 0, y: Math.sin(fxTime * 9) * 2 }; // heaving for breath
        p.bolas = e.state === 'bolas' ? (e.bolasK || 0) : 0; // the bola cord spins up in the wind-up
        p.hurt = e.hp < e.maxHp * 0.5; // a torn pelt edge
        p.pet = e.petK || 0; p.horn = e.hornK || 0; // map_trail.js: crouched stroking a hound at the bridgehead; the war horn at his mouth
    }
    if (e.type === 'boss_valerius') { // ai.js ValeriusAI's states drive the spear (see drawValeriusBody)
        const st = e.state, k = e.prepLen ? clamp01(1 - e.stateTimer / e.prepLen) : 0;
        p.thrust = st === 'lunge_prep' ? -0.7 * k : st === 'lunge' ? 1 : st === 'lunge_rec' && e.lastMove === 'lunge' ? clamp01(e.stateTimer / 0.45) : 0;
        p.throwK = st === 'hook_prep' || st === 'toss_prep' ? k : 0;
        p.spearOut = !!e.spear;
        p.sweep = st === 'arc_prep' ? 1.4 * k : st === 'arc_strike' ? lerp(1.4, -1.4, clamp01((fxTime - e.sweepAt) / 0.12)) : undefined;
        p.whirl = st === 'lasso_prep' || st === 'cyc_prep' || st === 'rally' ? fxTime * 16 : undefined;
        p.plant = st === 'skewer' || st === 'escape' || st === 'vault_prep';
        p.kneel = Math.max(e.kneelK || 0, st === 'leap_prep' ? 0.5 * k : st === 'skewer' ? 0.4 : 0);
        p.kick = e.kickAt !== undefined && fxTime - e.kickAt < 0.3 ? Math.sin(Math.PI * (fxTime - e.kickAt) / 0.3) : 0;
    }
    if (e.type === 'slinger') p.sling = e.state === 'windup' ? clamp01(1 - e.stateTimer / (typeof SLING_WINDUP !== 'undefined' ? SLING_WINDUP : 0.6)) : 0; // ai.js: the sling whirls up through the wind-up
    if (e.type === 'trapper') p.throwK = clamp01(1 - e.attackTimer / 0.5); // the arm winds back for a throw
    if (e.type === 'bannerman') p.raise = e.rallyAt === undefined ? 0 : clamp01(1 - (fxTime - e.rallyAt) / 0.6); // the banner goes up at the rally, down over 0.6 s
    if (e.type === 'hound') {
        p.swipe = null; p.bite = e.biteAt !== undefined && fxTime - e.biteAt < 0.22 ? fxTime - e.biteAt : null; // sprWolf's jaws
        p.rest = e.restK || 0; p.lean = e.petted && e.master ? e.master.petK || 0 : 0; // lying at the Beastmaster's feet, leaning into his hand
    }
    return p;
}

// Half-size of the stamp box in local units (default 50): a horse with its lance out needs more room
const BANDIT_EXTENT = { horse: 72, hound: 48, boss_beastmaster: 60, boss_valerius: 62 }; // a hound's wolf body spans about x -40..+33; the mounted Beastmaster's lance reaches about +50
function banditExtent(kind, scale) { return Math.min(BANDIT_CANVAS / 2, Math.ceil((BANDIT_EXTENT[kind] || 50) * scale)); }

// Render through the offscreen canvas: light from the top-left, a white hit flash, darkened when fallen
const BANDIT_LIGHT = new Map();
function stampBandit(e, x, y, face, scale, pose, flash, alpha, dark = 0, kind = e.type, into = null) {
    const E = banditExtent(kind, scale);
    if (e && !into) { // a live bandit keeps its own canvas, repainted at most 30 times a second: one shared canvas
        let S = e.sprC;   // repainted a dozen times a frame was the stage 2 lag on weaker PCs (the GPU stalls on each reuse)
        if (!S || S.cv.width !== E * 2) { S = e.sprC = { cv: cavCanvas(E * 2, E * 2), t: -1, k: -1 }; S.c = S.cv.getContext('2d'); }
        const k = flash * 10 + dark;
        if (fxTime - S.t >= 1 / 30 || fxTime < S.t || S.k !== k) { paintBandit(S.c, E, E, face, scale, pose, flash, dark, kind); S.t = fxTime; S.k = k; }
        ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(S.cv, x - E, y - E); ctx.restore(); return;
    }
    const H = BANDIT_CANVAS / 2, B = [H - E, H - E, E * 2, E * 2];
    paintBandit(banditCtx, H, E, face, scale, pose, flash, dark, kind);
    if (into) { into.getContext('2d').drawImage(banditCanvas, ...B, 0, 0, E * 2, E * 2); return; } // baked (a fallen body)
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(banditCanvas, ...B, x - E, y - E, E * 2, E * 2); ctx.restore();
}

// Paint one bandit centred at (H, H) of a canvas, in a box of half-size E
function paintBandit(c, H, E, face, scale, pose, flash, dark, kind) {
    const B = [H - E, H - E, E * 2, E * 2];
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(...B);
    c.translate(H, H); c.rotate(face); c.scale(scale, scale); c.lineJoin = 'round';
    const breathe = 1 + Math.sin(pose.t * 2.5) * 0.015 * (1 - pose.move);
    if (!pose.dead) c.scale(breathe, breathe);
    (BANDIT_SPRITES[kind] || BANDIT_SPRITES.thief)(c, pose);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    const key = Math.round(scale * 20) + '|' + H; let g = BANDIT_LIGHT.get(key);
    if (!g) { const r = 1.5 * Math.round(scale * 20); g = c.createLinearGradient(H - r, H - r, H + r, H + r); g.addColorStop(0, 'rgba(255, 255, 255, 0.18)'); g.addColorStop(0.5, 'rgba(255, 255, 255, 0)'); g.addColorStop(1, 'rgba(0, 0, 0, 0.3)'); BANDIT_LIGHT.set(key, g); }
    c.fillStyle = g; c.fillRect(...B);
    if (dark) { c.fillStyle = `rgba(30, 22, 18, ${dark})`; c.fillRect(...B); }
    if (flash) { c.fillStyle = 'rgba(255, 255, 255, 0.75)'; c.fillRect(...B); }
    c.restore();
}

// Feet while standing, legs stretched out behind when fallen
function banditFeet(c, p, col) {
    if (!p.dead) { sprFeet(c, p, col); return; }
    for (const s of [-1, 1]) sprStroke(c, sprShade(col, 0.25), 5, () => { c.moveTo(-8, s * 4); c.lineTo(-24, s * 8); });
    for (const s of [-1, 1]) sprEllipse(c, -25, s * 8.5, 4, 3, col);
}
// An arm from the shoulder to the hand, with a gloved fist
function banditArm(c, s, hx, hy, sleeve, glove) {
    sprStroke(c, sleeve, 4, () => { c.moveTo(-1, s * 10.5); c.lineTo(hx, hy); });
    sprEllipse(c, hx, hy, 2.6, 2.6, glove);
}

// An iron bear trap seen from above: a base ring, a pressure plate and two jaws, each with teeth pointing in. Open, the
// jaws stand apart on the rim; shut, they meet and the teeth interlock. `a` turns it (it spins as it flies).
function drawBearTrap(c, x, y, a, r, shut) {
    c.save(); c.translate(x, y); c.rotate(a); c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.78, 0, Math.PI * 2); c.strokeStyle = '#263238'; c.lineWidth = r * 0.36; c.stroke(); // dark rim under the ring
    c.beginPath(); c.arc(0, 0, r * 0.78, 0, Math.PI * 2); c.strokeStyle = '#455a64'; c.lineWidth = r * 0.26; c.stroke(); // base ring
    c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fillStyle = '#37474f'; c.fill(); // pressure plate
    for (const sd of [-1, 1]) {
        const dir = sd * (Math.PI / 2 + (shut ? 0 : 0.45)), hw = shut ? 1.05 : 0.5, rr = r * 0.9, tipR = shut ? r * 0.2 : r * 0.55;
        c.beginPath(); c.arc(0, 0, rr, dir - hw, dir + hw); c.strokeStyle = '#263238'; c.lineWidth = 4; c.stroke();
        c.beginPath(); c.arc(0, 0, rr, dir - hw, dir + hw); c.strokeStyle = '#90a4ae'; c.lineWidth = 2.2; c.stroke();
        for (let i = 0; i < 3; i++) { // teeth on the rim pointing in; shut, the other jaw's teeth fall between these
            const t = dir + (i - 1) * hw * 0.7 + (shut && sd > 0 ? hw * 0.35 : 0), ct = Math.cos(t), st = Math.sin(t);
            c.beginPath(); c.moveTo(ct * rr - st * 2, st * rr + ct * 2); c.lineTo(ct * tipR, st * tipR); c.lineTo(ct * rr + st * 2, st * rr - ct * 2); c.closePath();
            c.fillStyle = '#90a4ae'; c.fill(); c.strokeStyle = '#263238'; c.lineWidth = 0.8; c.stroke();
        }
    }
    c.restore();
}

// The horse, seen from straight above: a long body (chest, barrel, hips, a rounded rump), a neck tapering to a long
// head with the ears at the poll and the mane falling to one side, a streaming tail. In a gallop the legs reach out past
// the chest and the rump in turn; standing, only the hooves peek out. The rider's mount and the Beastmaster's warhorse
// share it; `coat` sets the colours.
const BAY_HORSE = { body: '#7a4a2e', dark: '#4a2c1a', light: '#a06a44', mane: '#22150e', muzzle: '#3a2418', hoof: '#1e130c' };
const WAR_HORSE = { body: '#2f2420', dark: '#1d1512', light: '#4e3e35', mane: '#120c0a', muzzle: '#1a1310', hoof: '#0e0907' };
function horseOutline(c) { // chest → shoulder → barrel → hip → rump, both sides (the neck and head are drawn separately)
    c.beginPath(); c.moveTo(17, 0);
    c.bezierCurveTo(16, -6, 13, -9.5, 8, -10.5); c.bezierCurveTo(1, -11.8, -9, -11.8, -16, -10.8);
    c.bezierCurveTo(-23, -10, -29, -7, -29.5, 0); c.bezierCurveTo(-29, 7, -23, 10, -16, 10.8);
    c.bezierCurveTo(-9, 11.8, 1, 11.8, 8, 10.5); c.bezierCurveTo(13, 9.5, 16, 6, 17, 0); c.closePath();
}
function drawHorseBody(c, p, coat) {
    const ne = p.charging ? 3 : 0, g = p.dead ? 0 : clamp01(p.move * 2.5), w = p.walk;
    if (p.dead) { drawFallenHorse(c, coat); return; }
    // the tail: a few strands streaming back from the rump, swinging with the stride
    if (!p.dead) for (let k = -1; k <= 1; k++) {
        const sw = Math.sin(w * 0.5 + k) * (2 + 3 * g) + p.trail.y * 0.5, L = 15 + 4 * g + k * 1.5;
        sprStroke(c, coat.mane, 2.4 - Math.abs(k) * 0.6, () => { c.moveTo(-28, k * 1.6); c.quadraticCurveTo(-34 - L * 0.4, k * 2.5 + sw * 0.4, -28 - L, k * 3 + sw); });
    }
    // legs: in the gallop the forelegs reach out past the chest and the hind legs past the rump, the pairs alternating
    if (!p.dead) for (const s of [-1, 1]) {
        const fr = g * (6 + 5 * Math.sin(w + (s > 0 ? 0.6 : 0))), hr = g * (6 + 5 * Math.sin(w + Math.PI + (s > 0 ? 0.6 : 0)));
        if (fr > 1) sprStroke(c, coat.dark, 3, () => { c.moveTo(12, s * 7.5); c.lineTo(14 + fr, s * 8); });
        sprEllipse(c, 14 + fr, s * 8, 2.6, 2.1, coat.hoof);
        if (hr > 1) sprStroke(c, coat.dark, 3.2, () => { c.moveTo(-23, s * 7.5); c.lineTo(-25 - hr, s * 8); });
        sprEllipse(c, -25 - hr, s * 8, 2.7, 2.2, coat.hoof);
    }
    // the body, lit along the spine, darker down the flanks, the hips showing as two rounded swells
    horseOutline(c); sprFill(c, coat.body);
    c.save(); horseOutline(c); c.clip();
    c.fillStyle = coat.dark; c.globalAlpha = 0.45; c.beginPath(); c.ellipse(-6, 0, 28, 13.5, 0, 0, Math.PI * 2); c.ellipse(-6, 0, 26, 8, 0, 0, Math.PI * 2, true); c.fill('evenodd'); c.globalAlpha = 1; // shadowed flanks
    c.fillStyle = coat.light; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(-4, -1, 20, 3.6, 0, 0, Math.PI * 2); c.fill(); // the lit back
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(-20, s * 4.5, 6.5, 4.2, 0, 0, Math.PI * 2); c.fill(); } // the hips
    c.globalAlpha = 1; c.restore();
    // the neck and the long head
    const hx = 26 + ne;
    c.beginPath(); c.moveTo(10, -6.5); c.bezierCurveTo(16, -5.5, 21, -4.2, hx - 1, -4.6); c.lineTo(hx + 9, -3.2); c.quadraticCurveTo(hx + 14, -2.2, hx + 14.5, 0);
    c.quadraticCurveTo(hx + 14, 2.2, hx + 9, 3.2); c.lineTo(hx - 1, 4.6); c.bezierCurveTo(21, 4.2, 16, 5.5, 10, 6.5); c.closePath(); sprFill(c, coat.body);
    c.fillStyle = coat.light; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(hx + 4, -0.8, 7, 1.6, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; // the lit face
    sprEllipse(c, hx + 11.5, 0, 3.2, 2.6, coat.muzzle, false); // the muzzle
    for (const s of [-1, 1]) sprEllipse(c, hx + 13.2, s * 1.1, 0.8, 0.6, '#0a0705', false); // nostrils
    // the mane falls to one side of the crest; a forelock between the ears
    c.fillStyle = coat.mane; c.beginPath(); c.moveTo(8, -1);
    for (let k = 0; k <= 6; k++) { const x = 9 + k * (hx - 9) / 6, jag = k % 2 ? 3.6 : 1.8; c.lineTo(x, -jag); }
    c.lineTo(hx, 0.6); c.lineTo(8, 1.4); c.closePath(); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(hx - 1, s * 1.6); c.lineTo(hx - 6, s * 3.6); c.lineTo(hx + 0.5, s * 3.4); c.closePath(); sprFill(c, coat.body); } // the ears, pricked back
    sprEllipse(c, hx + 1.5, 0, 2, 1.2, coat.mane, false); // forelock
}

// A horse lying on its side, seen from above: the barrel rounder (we see its flank), the legs folded at the knees in
// two pairs on the belly side, the neck curled round and the head resting on the ground, the tail lying slack
function drawFallenHorse(c, coat) {
    for (const [hx, hy, kx, ky, fx, fy] of [[12, 7, 18, 14, 15, 21], [5, 9, 9, 17, 4, 23], [-16, 8, -10, 15, -14, 22], [-22, 6, -21, 15, -27, 19]]) { // upper leg, knee, hoof: coat-coloured, folded
        sprStroke(c, coat.body, 4.4, () => { c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); });
        sprEllipse(c, fx, fy, 2.8, 2.2, coat.hoof);
    }
    for (let k = -1; k <= 1; k++) sprStroke(c, coat.mane, 2 - Math.abs(k) * 0.5, () => { c.moveTo(-28, 1 + k); c.quadraticCurveTo(-36, 4 + k * 2, -43, 8 + k * 3); }); // the tail, slack in the grass
    c.beginPath(); c.ellipse(-6, 1, 24, 12.5, 0, 0, Math.PI * 2); sprFill(c, coat.body); // the barrel on its side
    c.fillStyle = coat.light; c.globalAlpha = 0.45; c.beginPath(); c.ellipse(-6, -4, 19, 5, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; // the flank catching the light
    c.fillStyle = coat.dark; c.globalAlpha = 0.45; c.beginPath(); c.ellipse(-6, 8.5, 20, 3.2, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; // the belly in shadow
    c.save(); c.translate(-6, 0); c.rotate(0.06); c.beginPath(); c.rect(-7, -11, 14, 19); sprFill(c, '#5e2a1e'); sprEllipse(c, 0, -3, 6.5, 5, '#3e2a1e'); c.restore(); // the saddle still on it, slipped round
    c.beginPath(); c.moveTo(14, -6); c.bezierCurveTo(24, -7, 30, 1, 28, 10); c.lineTo(21, 11); c.bezierCurveTo(22, 4, 19, 1, 13, 5); c.closePath(); sprFill(c, coat.body); // the neck, curled round
    c.fillStyle = coat.mane; c.beginPath(); c.moveTo(14, -6); c.bezierCurveTo(24, -8, 30, -2, 30, 6); c.lineTo(28, 6); c.bezierCurveTo(27, -1, 22, -4.5, 14, -4); c.closePath(); c.fill(); // the mane along it
    c.save(); c.translate(25, 13); c.rotate(1.75); // the long head resting on the ground
    c.beginPath(); c.moveTo(-3, -4.6); c.lineTo(13, -3.2); c.quadraticCurveTo(18, 0, 13, 3.2); c.lineTo(-3, 4.6); c.closePath(); sprFill(c, coat.body);
    sprEllipse(c, 13, 0, 3.4, 2.7, coat.muzzle, false);
    c.beginPath(); c.moveTo(-1, -4); c.lineTo(-6, -6); c.lineTo(0, -1.5); c.closePath(); sprFill(c, coat.body); // an ear
    c.restore();
}

// The rider's right arm and lance (the horse rider and the Beastmaster share it): couched along the mount's side at lk = 1,
// raised otherwise. `heavy` is the Beastmaster's jousting lance: a thicker shaft and tip.
function riderLance(c, lk, heavy) {
    const hx = lerp(2, -6, lk), hy = lerp(9, 8, lk), tx = lerp(-14, 46, lk), ty = lerp(26, 6, lk), w = heavy ? 1.5 : 1;
    banditArm(c, 1, hx, hy, '#5d4037', '#4e342e'); // right arm: the lance
    const lx = tx - hx, ly = ty - hy, L = Math.hypot(lx, ly) || 1, ux = lx / L, uy = ly / L, qx = -uy, qy = ux;
    sprStroke(c, '#6d4c41', 2.6 * w, () => { c.moveTo(hx, hy); c.lineTo(tx, ty); }); // the shaft
    c.beginPath(); c.moveTo(tx + ux * 5 * w, ty + uy * 5 * w); c.lineTo(tx + qx * 2.2 * w, ty + qy * 2.2 * w); c.lineTo(tx - qx * 2.2 * w, ty - qy * 2.2 * w); c.closePath(); sprFill(c, '#cfd8dc'); // steel tip
    const Qx = tx - ux * 4, Qy = ty - uy * 4; // a red pennant just behind the tip
    c.beginPath(); c.moveTo(Qx, Qy); c.lineTo(Qx - ux * 6, Qy - uy * 6); c.lineTo(Qx - ux * 3 + qx * 4, Qy - uy * 3 + qy * 4); c.closePath(); sprFill(c, '#c62828');
}

// The Beastmaster, a hulking hunter: a shaggy bear-fur mantle over the shoulders, trailing in a ragged hem behind him;
// a wolf's skull for a helm, pale bone with dark sockets and the fangs at the front; bare arms with war-paint stripes and
// iron-studded bracers; a war horn on his chest strap. His right fist holds the coiled whip (drawn back behind his
// shoulder through p.whipK, the lash itself is drawn in the world when it cracks), his left a bola cord (p.bolas).
// Mounted he holds the heavy lance (p.couch). Fallen: lying on the mantle, the skull knocked off beside him.
function bmMantle(c, back, sway) { // the fur mantle's outline: round over the shoulders, a ragged hem behind
    c.beginPath(); c.moveTo(7, -15);
    c.quadraticCurveTo(10, 0, 7, 15);
    const pts = 11;
    for (let k = 0; k <= pts; k++) { // down the right side and along the hem, every other point a tuft
        const q = k / pts, a = Math.PI / 2 + q * Math.PI, r = k % 2 ? 1 : 1.14;
        c.lineTo(-6 + Math.cos(a) * (back * r) + (k > 2 && k < pts - 2 ? sway * Math.sin(q * Math.PI) : 0), Math.sin(a) * 19 * r);
    }
    c.closePath();
}
function drawBeastmasterBody(c, p, mounted) {
    const skin = '#a87850', fur = '#4a3b30', furHi = '#6e5a49', bone = '#ddd3bb';
    const skull = (x, y, rot) => { // the wolf-skull helm: cranium, long muzzle forward, sockets, fangs
        c.save(); c.translate(x, y); c.rotate(rot);
        c.beginPath(); c.moveTo(-6, -6); c.quadraticCurveTo(2, -8.5, 6, -4.2); c.lineTo(15, -2.6); c.quadraticCurveTo(17.5, 0, 15, 2.6); c.lineTo(6, 4.2); c.quadraticCurveTo(2, 8.5, -6, 6); c.quadraticCurveTo(-9, 0, -6, -6); c.closePath(); sprFill(c, bone);
        c.fillStyle = 'rgba(120, 104, 80, 0.45)'; c.beginPath(); c.ellipse(-1, 2.5, 5, 2.4, 0, 0, Math.PI * 2); c.fill(); // shading down the far side
        for (const s of [-1, 1]) { c.fillStyle = '#1a120d'; c.beginPath(); c.ellipse(4.5, s * 3, 2.4, 1.8, s * 0.3, 0, Math.PI * 2); c.fill(); } // eye sockets
        c.fillStyle = '#1a120d'; c.beginPath(); c.ellipse(12, 0, 2.2, 1, 0, 0, Math.PI * 2); c.fill(); // nasal cavity
        c.fillStyle = '#f7f2e6'; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const fx = 9 + k * 2.4; c.beginPath(); c.moveTo(fx, s * 2.6); c.lineTo(fx + 1.2, s * 4.4); c.lineTo(fx + 2.2, s * 2.6); c.closePath(); c.fill(); } // fangs along the jaw
        c.strokeStyle = 'rgba(90, 70, 50, 0.6)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-3, -4); c.lineTo(0, -1.5); c.lineTo(-1.5, 1); c.stroke(); // a crack
        c.restore();
    };
    if (p.dead) {
        banditFeet(c, p, '#2b1d16');
        bmMantle(c, 22, 0); sprFill(c, fur);
        sprEllipse(c, 2, 0, 6.5, 6.5, '#5a3d28'); // his head, bare
        skull(20, 20, 2.2); // the helm knocked off beside him
        sprStroke(c, '#1b1210', 2.4, () => { c.moveTo(4, -22); c.quadraticCurveTo(-8, -30, -20, -24); c.quadraticCurveTo(-26, -20, -20, -16); }); // the whip
        return;
    }
    if (!mounted) banditFeet(c, p, '#2b1d16');
    const pet = p.pet || 0, horn = p.horn || 0; // crouched over a hound (map_trail.js), the war horn raised
    const sway = p.trail.y * 0.25 + Math.sin(p.t * 2.2) * 1.2, back = mounted ? 18 : 24 + Math.min(4, -p.trail.x * 0.3) + pet * 5; // bent over, the mantle spreads
    bmMantle(c, back, sway); sprFill(c, fur); // the bear-fur mantle
    c.save(); bmMantle(c, back, sway); c.clip();
    c.fillStyle = '#33281f'; c.beginPath(); c.ellipse(-8, 0, back * 0.8, 5, 0, 0, Math.PI * 2); c.fill(); // the darker ridge of the back
    c.strokeStyle = furHi; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); // guard hairs combed back along it
    for (let k = 0; k < 11; k++) { const y = -17 + k * 3.4, x0 = 4 - Math.abs(y) * 0.3; c.moveTo(x0, y); c.lineTo(x0 - 9 - (k % 3) * 3, y * 1.1); }
    c.stroke(); c.restore();
    c.strokeStyle = fur; c.lineWidth = 2.2; c.beginPath(); // shaggy tufts all round the edge
    for (let k = 0; k < 22; k++) {
        const a = Math.PI / 2 + k / 21 * Math.PI, ex = -6 + Math.cos(a) * back, ey = Math.sin(a) * 19, ox = Math.cos(a) * 4.5, oy = Math.sin(a) * 4.5;
        c.moveTo(ex - ox * 0.6, ey - oy * 0.6); c.lineTo(ex + ox + (k % 2 ? 1.5 : -1.5), ey + oy);
    }
    c.stroke();
    // the left arm and the bola cord; it reaches down to stroke the hound at his side (pet), or brings the horn up (horn)
    const bl = p.bolas || 0;
    let lhx = lerp(12, 15 + Math.sin(p.t * 2.6) * 6, pet), lhy = lerp(-17.5, -27, pet); // the hand runs from the hound's ears down its back
    lhx = lerp(lhx, 16, horn); lhy = lerp(lhy, -6, horn);
    sprStroke(c, skin, 5, () => { c.moveTo(2, -13); c.lineTo(lhx - 1, lhy + 0.5); }); sprEllipse(c, lerp(2, lhx, 0.66), lerp(-13, lhy, 0.66) + 0.8, 3.4, 2.8, '#2b1d16'); // arm and bracer
    sprEllipse(c, lhx, lhy, 3, 3, skin);
    c.strokeStyle = '#8e1b1b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3.5, -12); c.lineTo(lerp(3.5, lhx, 0.25) + 2, lerp(-12, lhy, 0.25) - 1); c.stroke(); // war paint
    if (bl > 0) { // two stones circling the fist on the cord
        const r = 4 + 7 * bl, a = p.t * 14;
        c.strokeStyle = 'rgba(62, 39, 35, 0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(lhx, lhy, r, 0, Math.PI * 2); c.stroke();
        for (const k of [0, Math.PI]) sprEllipse(c, lhx + Math.cos(a + k) * r, lhy + Math.sin(a + k) * r, 2.6, 2.6, '#5d4037');
    }
    // the right arm: the whip coiled in the fist, drawn back over the shoulder for a crack (p.whipK), flung out when it cracks (p.lash)
    const wk = p.whipK || 0, ls = p.lash || 0, ax = lerp(11, -10, wk) + ls * 6, ay = lerp(17, 20, wk);
    if (!mounted) {
        sprStroke(c, skin, 5, () => { c.moveTo(2, 13); c.lineTo(ax, ay); }); sprEllipse(c, lerp(7.5, -4, wk), lerp(15.5, 17, wk), 3.4, 2.8, '#2b1d16'); // arm and bracer
        c.strokeStyle = '#8e1b1b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3.5, 12); c.lineTo(5, 15); c.stroke();
        if (wk > 0 && !ls) { // the lash trailing out behind him, ready
            c.strokeStyle = '#1b1210'; c.lineCap = 'round'; let px = ax, py = ay;
            for (let k = 1; k <= 8; k++) { const q = k / 8, x = ax - 26 * q * wk, y = ay + 6 * q + Math.sin(q * 5 + p.t * 6) * 2.5; c.lineWidth = 2.4 * (1 - q) + 0.6; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y; }
        } else if (!ls) { c.strokeStyle = '#1b1210'; c.lineWidth = 1.6; for (let r = 0; r < 3; r++) { c.beginPath(); c.arc(ax + 2, ay + 2, 3 + r * 1.7, 0.3 + r, 5.2 + r); c.stroke(); } } // coiled
        sprEllipse(c, ax, ay, 3, 3, skin);
    }
    // the chest strap with the war horn, and the skull helm over a dark mane of braids
    sprStroke(c, '#2b1d16', 2.6, () => { c.moveTo(6, -11); c.lineTo(-6, 12); });
    const hornAt = (x0, y0, x1, y1) => { // the war horn: a curved ox horn from its mouthpiece (x0, y0) to the bell (x1, y1)
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = y1 - y0, ny = x0 - x1, l = Math.hypot(nx, ny) || 1, bw = 3.2;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx + nx / l * 4, my + ny / l * 4, x1 - nx / l * bw, y1 - ny / l * bw);
        c.lineTo(x1 + nx / l * bw, y1 + ny / l * bw); c.quadraticCurveTo(mx + nx / l * 2, my + ny / l * 2, x0, y0); c.closePath(); sprFill(c, '#e6d6ad');
        c.fillStyle = '#3a2a1c'; c.beginPath(); c.ellipse(x1, y1, 1.6, bw * 0.8, Math.atan2(y1 - y0, x1 - x0), 0, Math.PI * 2); c.fill(); // the dark bell
    };
    if (horn < 0.5) hornAt(lerp(1, 13, horn), lerp(-2, -2, horn), lerp(-11, 29, horn), lerp(-9, -11, horn)); // on the strap
    sprEllipse(c, -4 + pet, -2 * pet, 6.5, 8.5, '#2a1f18'); // a dark collar of fur behind the helm
    skull(1 + 2 * pet, -4 * pet, -0.5 * pet); // bowed toward the hound he's stroking
    if (horn >= 0.5) hornAt(lerp(1, 13, horn), -2, lerp(-11, 29, horn), lerp(-9, -11, horn)); // at his mouth, the bell out over the muzzle
    if (p.hurt) { c.strokeStyle = '#2b1d16'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-14, -14); c.lineTo(-9, -10); c.lineTo(-13, -7); c.stroke(); } // a torn edge in the fur
    if (mounted) { banditArm(c, -1, 9, -9, '#a87850', '#2b1d16'); riderLance(c, p.couch || 0, true); }
}

// Valerius the Vanguard: a fallen knight turned bandit lord. Blackened, dented plate under a ragged crimson tabard with his
// sigil in gold, a closed helm with a horse-tail crest streaming behind, a dark cloak. His war spear is fixed by its butt to a
// chain coiled round his left forearm. In hand he carries it low along his right side: p.thrust drives it forward, p.throwK
// draws it back to throw, p.sweep swings it across in front. Thrown or swung out on the chain (p.spearOut) only his left fist
// shows, holding the chain (drawBanditOverlay draws the spear and the chain in the world); p.whirl spins it overhead; p.plant
// has it driven into the deck at his side; p.kneel drops him to one knee; p.kick swings a boot forward.
const VAL_STEEL = '#3b3f46', VAL_PLATE = '#555b64', VAL_RED = '#9a1f1f', VAL_GOLD = '#c9a227', VAL_CLOAK = '#4a1416', VAL_SPEAR_L = 46;
function valSpear(c, L) { // a spear along +x from its butt at the origin: ash shaft with iron bands, a red tassel, lugs and a long leaf blade
    sprStroke(c, '#4a3020', 2.6, () => { c.moveTo(0, 0); c.lineTo(L - 10, 0); });
    c.fillStyle = '#263238'; for (const u of [0.18, 0.55]) c.fillRect(L * u, -1.7, 2.4, 3.4);
    c.fillStyle = '#c62828'; c.beginPath(); c.moveTo(L - 12, 0); c.lineTo(L - 20, -3.4); c.lineTo(L - 18, 0); c.lineTo(L - 20, 3.4); c.closePath(); c.fill(); // the tassel
    c.beginPath(); c.moveTo(L - 11, -4.5); c.lineTo(L - 7, 0); c.lineTo(L - 11, 4.5); c.closePath(); sprFill(c, '#78909c'); // the lugs
    c.beginPath(); c.moveTo(L - 9, 0); c.quadraticCurveTo(L, -4.2, L + 13, 0); c.quadraticCurveTo(L, 4.2, L - 9, 0); c.closePath(); sprFill(c, '#cfd8dc'); // the blade
    c.strokeStyle = 'rgba(255, 255, 255, 0.65)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(L - 6, -0.5); c.lineTo(L + 9, -0.2); c.stroke();
    c.strokeStyle = '#90a4ae'; c.lineWidth = 1.3; c.beginPath(); c.arc(-1.8, 0, 1.9, 0, Math.PI * 2); c.stroke(); // the ring the chain runs from
}
// A chain between two points, gently sagging: face-on ovals and edge-on bars in turn, flat strokes only (lw scales the links)
function drawValChain(c, x0, y0, x1, y1, sag, lw = 1) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 2) return;
    const n = Math.max(2, Math.round(L / (5.5 * lw))), ux = (x1 - x0) / L, uy = (y1 - y0) / L, a = Math.atan2(uy, ux);
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, s = Math.sin(Math.PI * u) * sag, x = x0 + (x1 - x0) * u - uy * s, y = y0 + (y1 - y0) * u + ux * s;
        if (i % 2) { c.strokeStyle = '#263238'; c.lineWidth = 2.2 * lw; c.beginPath(); c.moveTo(x - ux * 2.6 * lw, y - uy * 2.6 * lw); c.lineTo(x + ux * 2.6 * lw, y + uy * 2.6 * lw); c.stroke(); }
        else { c.beginPath(); c.ellipse(x, y, 3.4 * lw, 2 * lw, a, 0, Math.PI * 2); c.strokeStyle = '#263238'; c.lineWidth = 2.6 * lw; c.stroke(); c.strokeStyle = '#90a4ae'; c.lineWidth = 1.2 * lw; c.stroke(); }
    }
    c.restore();
}
// His left fist in the world (the chain runs from it when the spear is out)
function valFist(e) { const sc = e.size / 26, a = e.facingAngle || 0, lx = 16, ly = -6; return { x: e.x + (lx * Math.cos(a) - ly * Math.sin(a)) * sc, y: e.y + (lx * Math.sin(a) + ly * Math.cos(a)) * sc - (e.liftZ > 0 ? e.liftZ : 0) }; }
function drawValeriusBody(c, p) {
    const kneel = p.kneel || 0, th = p.thrust || 0, tk = p.throwK || 0, kick = p.kick || 0;
    if (kneel > 0.05) { sprEllipse(c, 5, 7, 5, 3.5, '#1c1a1a'); sprEllipse(c, -4 - 7 * kneel, -6, 6, 3.6, '#1c1a1a'); } // a knee down behind him
    else { banditFeet(c, p, '#1c1a1a'); if (kick) sprEllipse(c, 6 + kick * 15, 5, 5.5, 3.6, '#1c1a1a'); }
    sprCape(c, p, VAL_CLOAK, 26 + kneel * 4, 15, VAL_GOLD); // a dark crimson cloak with a gold edge: his colours read from above
    const sway = Math.sin(p.t * 3) * 2.5 + p.trail.y * 0.6, tx = -24 + Math.min(4, p.trail.x * 0.5); // the horse-tail crest streaming back
    for (const [col, w, o] of [['#120d0d', 4, 0], ['#5a0f0f', 2.2, 1.2], ['#120d0d', 2, -1.4]]) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, o * 0.6); c.quadraticCurveTo(-13, sway * 0.4 + o, tx, sway + o * 2); c.stroke(); }
    sprEllipse(c, -1, 0, 10, 15.5, VAL_RED); // the crimson surcoat over his plate, seen across the shoulders
    c.strokeStyle = 'rgba(40, 6, 6, 0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -6); c.lineTo(-6, -2); c.lineTo(-9.5, 1); c.lineTo(-6, 5); c.stroke(); // a rent down its back
    c.strokeStyle = VAL_GOLD; c.lineWidth = 1.1; c.beginPath(); c.arc(-3, 0, 3.4, 0, Math.PI * 2); c.moveTo(-6.4, 3.8); c.lineTo(0.4, -3.8); c.stroke(); // his sigil between the shoulders
    for (const s of [-1, 1]) { sprEllipse(c, -0.5, s * 13, 6.5, 5.6, VAL_PLATE); c.fillStyle = '#9aa3ad'; c.beginPath(); c.arc(1.5, s * 13, 1.1, 0, Math.PI * 2); c.fill(); } // pauldrons
    c.strokeStyle = '#22252a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, 9.5); c.lineTo(0, 12); c.lineTo(-2, 15); c.stroke(); // a dent in the right one
    const arm = (s, hx, hy) => banditArm(c, s, hx, hy, VAL_PLATE, '#1c1a1a');
    const coil = (hx, hy) => { const mx = lerp(-1, hx, 0.55), my = lerp(-13, hy, 0.55), a = Math.atan2(hy + 13, hx + 1); c.strokeStyle = '#90a4ae'; c.lineWidth = 1.1; for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(mx + Math.cos(a) * k * 2.2, my + Math.sin(a) * k * 2.2, 1.6, 3.2, a, 0, Math.PI * 2); c.stroke(); } }; // the chain wound round the left forearm
    if (p.spearOut) { // the spear's out on its chain: the left fist holds the chain, the right hangs ready
        arm(1, 6, 15); arm(-1, 16, -6); coil(16, -6);
    } else if (p.whirl !== undefined) { // whirled overhead
        arm(1, 4, 5); arm(-1, 4, -5); coil(4, -5);
        c.save(); c.translate(3, 0); c.rotate(p.whirl); c.translate(-24, 0); valSpear(c, VAL_SPEAR_L - 6); c.restore();
    } else if (p.plant) { // driven into the deck at his side: from above, the butt end and a little of the shaft
        arm(1, 12, 12); arm(-1, 5, -8); coil(5, -8);
        sprStroke(c, '#4a3020', 3, () => { c.moveTo(16, 15); c.lineTo(12, 12.5); }); c.strokeStyle = '#90a4ae'; c.lineWidth = 1.3; c.beginPath(); c.arc(11.5, 12, 2, 0, Math.PI * 2); c.stroke();
        drawValChain(c, 5, -8, 11.5, 12, 3, 0.6);
    } else { // in hand, low along the right side: thrust forward, drawn back to throw, swung across in a sweep
        const A = (p.sweep !== undefined ? -p.sweep : 0) - tk * 0.35, gx = 8 + th * 14 - tk * 12, gy = 10.5 - (p.sweep !== undefined ? 4 : 0);
        const ux = Math.cos(A), uy = Math.sin(A), bx = gx - ux * 22, by = gy - uy * 22, lx = bx + ux * 8, ly = by + uy * 8;
        c.save(); c.translate(bx, by); c.rotate(A); valSpear(c, VAL_SPEAR_L); c.restore();
        arm(1, gx, gy); arm(-1, tk > 0.3 ? 5 : lx, tk > 0.3 ? -6 : ly); coil(tk > 0.3 ? 5 : lx, tk > 0.3 ? -6 : ly);
        drawValChain(c, tk > 0.3 ? 5 : lx, tk > 0.3 ? -6 : ly, bx - 1.8, by, 3, 0.6); // a short slack loop from his fist to the butt ring
    }
    const hx = 2 + kneel * 3; // the closed helm, bowed when he kneels
    sprEllipse(c, hx, 0, 7.6, 7.4, VAL_PLATE);
    c.strokeStyle = '#22252a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx - 6, 0); c.lineTo(hx + 6, 0); c.stroke(); // the ridge
    c.fillStyle = '#0d0d0f'; c.fillRect(hx + 5.2, -4, 1.8, 8); // the eye slit
    c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.beginPath(); c.ellipse(hx - 2, -3, 2.6, 1.6, -0.5, 0, Math.PI * 2); c.fill();
}

const BANDIT_SPRITES = {
    // A quick cutthroat in a brown hood and an orange mask, a dagger in each hand
    thief(c, p) {
        banditFeet(c, p, '#2b1d16');
        if (!p.dead) sprTails(c, p, ['#ff9800', '#e65100'], 3, 20); // the mask's knot trailing behind
        sprTorso(c, '#4e3427', 12.5, 8.5);
        c.strokeStyle = '#ef6c00'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(4, -9); c.lineTo(-5, 9); c.stroke(); // sash
        for (const s of [-1, 1]) {
            const k = p.stab * (s > 0 ? 1 : 0.45), hx = p.dead ? 0 : 7 + k * 8, hy = p.dead ? s * 18 : s * (9.5 - k * 3.5);
            if (!p.dead) { // dagger held forward, edge out
                c.save(); c.translate(hx, hy); c.rotate(-s * 0.18);
                c.beginPath(); c.moveTo(2.5, -1.7); c.lineTo(14, 0); c.lineTo(2.5, 1.7); c.closePath(); sprFill(c, '#cfd8dc');
                c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(3, -0.4); c.lineTo(12, -0.1); c.stroke();
                c.fillStyle = '#8d6e63'; c.fillRect(1.6, -3, 1.6, 6); // guard
                c.restore();
            }
            banditArm(c, s, hx, hy, '#4e3427', '#2b1d16');
        }
        sprHood(c, '#5d4037', '#1a120d');
        c.beginPath(); c.ellipse(8, 0, 2.7, 4.8, 0, -Math.PI / 2, Math.PI / 2); c.fillStyle = '#f57c00'; c.fill(); // mask over the lower face
        if (!p.dead) for (const s of [-1, 1]) sprEllipse(c, 6.8, s * 2, 0.9, 0.9, '#ffe0b2', false);
    },

    // A hunter in a leather cap with a red feather; the longbow comes up and the string back to the chest before each shot
    archer(c, p) {
        banditFeet(c, p, '#3e2723');
        c.save(); c.translate(-10, -5); c.rotate(0.45); // quiver across the back
        for (const fy of [-2.2, 0, 2.2]) { c.beginPath(); c.moveTo(-8, fy); c.lineTo(-13.5, fy - 1.7); c.lineTo(-13.5, fy + 1.7); c.closePath(); c.fillStyle = fy ? '#efebe9' : '#c62828'; c.fill(); }
        c.beginPath(); c.rect(-8, -3.5, 15, 7); sprFill(c, '#5d4037'); c.restore();
        sprTorso(c, '#795548', 12.5, 9);
        sprEllipse(c, -0.5, 0, 6.5, 10, '#6d4c41', false); // leather vest
        c.strokeStyle = '#3e2723'; c.lineWidth = 2; c.beginPath(); c.moveTo(5, 8); c.lineTo(-6, -9); c.stroke(); // quiver strap
        if (p.dead) { banditArm(c, -1, 1, -18, '#795548', '#4e342e'); banditArm(c, 1, 0, 18, '#795548', '#4e342e'); }
        else {
            const d = p.draw, gx = 15, tip = 15, bx = gx - 6 - d * 2.5, nx = gx - 2 - d * 13;
            banditArm(c, -1, gx - 1, -1.5, '#795548', '#4e342e');
            sprStroke(c, '#6d4c41', 2.6, () => { c.moveTo(bx, -tip); c.quadraticCurveTo(gx + 3, -tip * 0.55, gx, 0); c.quadraticCurveTo(gx + 3, tip * 0.55, bx, tip); }); // the bow
            c.strokeStyle = 'rgba(240, 232, 214, 0.9)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(bx, -tip); c.lineTo(nx, 0); c.lineTo(bx, tip); c.stroke(); // the string, drawn back
            if (d > 0.08) { // the nocked arrow
                c.strokeStyle = '#a1887f'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(nx, 0); c.lineTo(gx + 7, 0); c.stroke();
                c.beginPath(); c.moveTo(gx + 11, 0); c.lineTo(gx + 6, -2); c.lineTo(gx + 6, 2); c.closePath(); c.fillStyle = '#cfd8dc'; c.fill();
                c.fillStyle = '#c62828'; c.beginPath(); c.moveTo(nx + 1, 0); c.lineTo(nx + 5, -2.2); c.lineTo(nx + 5, 2.2); c.closePath(); c.fill();
            }
            banditArm(c, 1, nx, 1.5, '#795548', '#4e342e');
        }
        sprEllipse(c, 2, 0, 7, 7, '#8d6e63'); // leather cap
        c.strokeStyle = '#5d4037'; c.lineWidth = 1.2; c.beginPath(); c.arc(2, 0, 4.5, -2.2, 2.2); c.stroke();
        sprLeaf(c, -1, -4.5, Math.PI + 0.6, 7, '#a32222'); // the feather
        sprEllipse(c, 7.6, 0, 2, 3.6, BANDIT_SKIN, false);
    },

    // A heavy in mail and a nasal helmet behind a round wooden shield; the shield cracks as it soaks hits, then it's gone
    shield(c, p) {
        banditFeet(c, p, '#263238');
        sprTorso(c, '#6f7f87', 14, 10);
        c.save(); c.beginPath(); c.ellipse(-1, 0, 9.5, 14, 0, 0, Math.PI * 2); c.clip(); // mail rings
        c.strokeStyle = 'rgba(30, 40, 46, 0.45)'; c.lineWidth = 0.8;
        for (let ry = -13; ry <= 13; ry += 3.2) { c.beginPath(); for (let rx = -10; rx <= 9; rx += 3) c.arc(rx, ry, 1.4, 0, Math.PI); c.stroke(); }
        c.restore();
        sprEllipse(c, -1.5, 0, 5.5, 9.5, '#7b2e1e', false); // a red tabard over the mail
        const k = p.stab, hx = p.dead ? 2 : 6 + k * 7, hy = p.dead ? 19 : 13 - k * 5;
        if (!p.dead) { // a short axe in the right hand
            c.save(); c.translate(hx, hy); c.rotate(-0.15 - k * 0.5);
            sprStroke(c, '#6d4c41', 2.4, () => { c.moveTo(-6, 0); c.lineTo(13, 0); });
            c.beginPath(); c.moveTo(9, 0); c.lineTo(10, -2); c.quadraticCurveTo(15, -1, 16, 5.5); c.lineTo(9, 2); c.closePath(); sprFill(c, '#b0bec5');
            c.restore();
        }
        banditArm(c, 1, hx, hy, '#5f6f77', '#37474f');
        if (p.shield > 0 && !p.dead) { // the round shield, held across the front, the arm behind it; pulled in, then shoved out for a bash
            const bo = (p.bash || 0) > 0 ? p.bash * 7 : (p.bash || 0) * 5;
            banditArm(c, -1, 9 + bo, -4, '#5f6f77', '#37474f');
            c.save(); c.translate(12.5 + bo, -2.5); c.rotate(Math.min(0, p.bash || 0) * 0.25);
            c.beginPath(); c.ellipse(0, 0, 7, 19, 0, 0, Math.PI * 2); sprFill(c, '#8a5a32');
            c.save(); c.clip(); c.strokeStyle = 'rgba(50, 28, 14, 0.6)'; c.lineWidth = 1;
            for (const py of [-12, -6, 0, 6, 12]) { c.beginPath(); c.moveTo(-8, py); c.lineTo(8, py + 0.8); c.stroke(); } // planks
            c.fillStyle = 'rgba(190, 40, 30, 0.75)'; c.fillRect(-8, -3.5, 16, 7); // a red band painted across
            if (p.shield < 0.66) { c.strokeStyle = '#140a06'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -9); c.lineTo(1, -3); c.lineTo(-1, 3); c.stroke(); }
            if (p.shield < 0.33) { c.beginPath(); c.moveTo(2, 6); c.lineTo(-2, 11); c.lineTo(1, 16); c.moveTo(3, -12); c.lineTo(-2, -16); c.stroke(); }
            c.restore();
            c.strokeStyle = '#2f3a40'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, 0, 7, 19, 0, 0, Math.PI * 2); c.stroke(); // iron rim
            sprEllipse(c, 4.5, 0, 3.2, 4, '#90a4ae'); // the boss
            c.fillStyle = 'rgba(255, 255, 255, 0.5)'; c.beginPath(); c.arc(3.6, -1.3, 1.1, 0, Math.PI * 2); c.fill();
            c.restore();
        } else banditArm(c, -1, p.dead ? 0 : 8, p.dead ? -19 : -11, '#5f6f77', '#37474f');
        sprEllipse(c, 1.5, 0, 8.6, 8.6, '#8a979e'); // mail coif around the neck
        sprEllipse(c, 2, 0, 6.6, 6.6, '#aab6bd'); // the helmet's dome...
        c.strokeStyle = '#5f6c73'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-4.6, 0); c.lineTo(8.6, 0); c.moveTo(2, -6.6); c.lineTo(2, 6.6); c.stroke(); // ...its iron bands
        c.fillStyle = '#5f6c73'; c.fillRect(8, -1, 3, 2); // the nasal guard
        c.fillStyle = 'rgba(255, 255, 255, 0.5)'; c.beginPath(); c.ellipse(0, -2.6, 2.2, 1.2, -0.5, 0, Math.PI * 2); c.fill();
    },

    // A rider on a bay horse, the lance in the right hand: couched along the horse's side while it aims and charges,
    // raised and foreshortened the rest of the time. Fallen, the horse lies on its side with the rider beside it.
    horse(c, p) {
        drawHorseBody(c, p, BAY_HORSE);
        if (p.dead) { // the rider, thrown clear on the far side, the lance dropped beside him
            sprStroke(c, '#6d4c41', 2.2, () => { c.moveTo(-30, -24); c.lineTo(12, -30); });
            c.beginPath(); c.moveTo(12, -30); c.lineTo(17, -31); c.lineTo(12, -28); c.closePath(); sprFill(c, '#cfd8dc');
            for (const sy of [-1, 1]) sprStroke(c, '#3e2723', 3, () => { c.moveTo(-10, -18 + sy * 2); c.lineTo(-19, -18 + sy * 5); }); // his legs
            sprEllipse(c, -6, -18, 6.5, 5, '#5d4037'); sprStroke(c, '#c62828', 2, () => { c.moveTo(-1, -21); c.lineTo(-1, -15); });
            sprEllipse(c, 1, -18, 3.8, 3.6, '#8d6e63');
            return;
        }
        const hx = 26 + (p.charging ? 3 : 0), lean = p.charging ? 2.5 : 0; // the head (the neck stretches in a charge); the rider leans in
        c.beginPath(); c.rect(-12, -11, 15, 22); sprFill(c, '#5e2a1e'); // the saddle blanket, hanging over both flanks
        c.fillStyle = '#c9a25a'; for (const y of [-11, 9.6]) for (let x = -11; x < 3; x += 3) c.fillRect(x, y, 1.6, 1.4); // its fringe
        sprEllipse(c, -4, 0, 8, 7, '#3e2a1e'); // the saddle
        for (const s2 of [-1, 1]) sprEllipse(c, -2 + lean * 0.5, s2 * 11.5, 3.4, 2.4, '#2b1d16'); // boots in the stirrups
        c.save(); c.translate(lean, 0);
        sprEllipse(c, -3, 0, 6.2, 8.4, '#5d4037'); // the rider's back and shoulders
        sprStroke(c, '#c62828', 2.4, () => { c.moveTo(1, -6); c.lineTo(1, 6); }); // red scarf
        sprStroke(c, '#c62828', 1.8, () => { c.moveTo(1, -2); c.quadraticCurveTo(-4, -5 + p.trail.y * 0.2, -10 + p.trail.x * 0.3, -4 + p.trail.y * 0.4); }); // its tail flying back
        banditArm(c, -1, 6, -4, '#5d4037', '#4e342e'); // left hand on the reins
        c.strokeStyle = '#2b1d16'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(6, -4); c.lineTo(hx + 1, -2.4); c.moveTo(6, -4); c.lineTo(hx + 1, 2.4); c.stroke(); // the reins
        sprEllipse(c, 0, 0, 5, 5, '#8d6e63'); // leather cap
        c.strokeStyle = '#5d4037'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 3.3, -2.2, 2.2); c.stroke();
        riderLance(c, p.couch || 0, false);
        c.restore();
    },

    // A slinger: a lean poacher in a frayed brown hood and a leather vest, a pouch of stones at the hip. Winding up
    // (p.sling) the sling whirls round its raised right hand, the stone a blur at the end of the cord.
    slinger(c, p) {
        banditFeet(c, p, '#3e2a1e');
        sprEllipse(c, -6, 11, 4.2, 3.4, '#6d4c41'); // the pouch of stones
        for (const [x, y] of [[-6.5, 10.2], [-4.8, 11.8]]) sprEllipse(c, x, y, 1.3, 1.1, '#9e9e9e', false);
        sprTorso(c, '#6a5640', 11.5, 8.5);
        sprEllipse(c, -0.5, 0, 5.5, 9, '#4e3a28', false); // the leather vest
        c.strokeStyle = '#3e2a1e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(4, -8); c.lineTo(-5, 10); c.stroke(); // the pouch strap
        if (p.dead) { banditArm(c, -1, 0, -17, '#6a5640', '#3e2a1e'); banditArm(c, 1, -1, 17, '#6a5640', '#3e2a1e'); sprStroke(c, '#5d4037', 1, () => { c.moveTo(-1, 17); c.lineTo(8, 24); }); }
        else {
            const k = p.sling || 0, hx = lerp(8, 3, k), hy = lerp(10, 8, k);
            banditArm(c, -1, 7, -8, '#6a5640', '#3e2a1e'); // the off hand, held out for balance
            if (k > 0) { // the sling whirling round the raised hand: the cord a blurred ring, the stone racing round it
                const R = 7 + 6 * k, a = p.t * (14 + 10 * k);
                c.strokeStyle = `rgba(90, 70, 50, ${0.25 + 0.3 * k})`; c.lineWidth = 1.2; c.beginPath(); c.arc(hx, hy, R, 0, Math.PI * 2); c.stroke();
                c.strokeStyle = '#5d4037'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); c.stroke();
                for (let t = 1; t <= 3; t++) { c.fillStyle = `rgba(150, 150, 150, ${0.5 - t * 0.14})`; c.beginPath(); c.arc(hx + Math.cos(a - t * 0.35) * R, hy + Math.sin(a - t * 0.35) * R, 2, 0, Math.PI * 2); c.fill(); } // the stone's blur
                sprEllipse(c, hx + Math.cos(a) * R, hy + Math.sin(a) * R, 2.2, 2.2, '#9e9e9e');
            } else sprStroke(c, '#5d4037', 1, () => { c.moveTo(hx, hy); c.quadraticCurveTo(hx - 4, hy + 6, hx - 1, hy + 9); }); // the sling hanging slack
            banditArm(c, 1, hx, hy, '#6a5640', '#3e2a1e');
        }
        sprHood(c, '#7a5c3e', '#1a120d');
        c.strokeStyle = 'rgba(40, 26, 14, 0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-11, -2); c.lineTo(-13, -4); c.moveTo(-11, 2); c.lineTo(-13.5, 3.5); c.stroke(); // its frayed edge
    },

    // A hooded trapper with a sack of bear traps on his back (iron teeth poking out of it) and an open trap in his right
    // hand; the arm winds back before each throw (p.throwK)
    trapper(c, p) {
        banditFeet(c, p, '#2b2418');
        sprEllipse(c, -12, -2.5, 5.5, 5, '#795548'); // the sack, a few lumps of canvas
        sprEllipse(c, -13.5, 3.5, 5, 4.2, '#6d4c41');
        sprEllipse(c, -9.5, 4.5, 4, 3.4, '#8d6e63');
        sprStroke(c, '#3e2723', 1.4, () => { c.moveTo(-17, -4.5); c.lineTo(-8, 1.5); }); // rope tie
        if (!p.dead) for (const ty of [-3.5, 0, 3.5]) { c.beginPath(); c.moveTo(-16.5, ty - 1.2); c.lineTo(-19.5, ty); c.lineTo(-16.5, ty + 1.2); c.closePath(); sprFill(c, '#90a4ae'); } // trap teeth
        sprTorso(c, '#4e4a32', 12, 9);
        if (p.dead) { banditArm(c, -1, 1, -18, '#4e4a32', '#33301f'); banditArm(c, 1, 0, 18, '#4e4a32', '#33301f'); }
        else {
            const k = p.throwK || 0, hx = 8 - 12 * k, hy = 10 - 4 * k;
            banditArm(c, -1, 4, -9, '#4e4a32', '#33301f'); // left hand on the sack strap
            banditArm(c, 1, hx, hy, '#4e4a32', '#33301f');
            drawBearTrap(c, hx + 1.5, hy, -0.4 - k * 0.8, 4.6, false); // the open trap in his right hand
        }
        sprHood(c, '#556b2f', '#1a120d');
    },

    // A bannerman in a dark red tabard over leather, a steel cap and a cream war horn at the hip. He holds the banner
    // high in both hands at the front-right: the pole, then the cloth streaming back from the crossbar with its trailing
    // edge rippling. p.raise lifts it (the rally: bigger and pushed forward); fallen, the banner lies beside him.
    bannerman(c, p) {
        const dead = !!p.dead, r = dead ? 0 : (p.raise || 0), k = 1 + 0.25 * r, fx = 4 * r;
        banditFeet(c, p, '#3e2723');
        sprTorso(c, '#4e342e', 13, 9.5);
        sprEllipse(c, -1.5, 0, 6, 9, '#b71c1c', false); // the dark red tabard
        c.beginPath(); c.moveTo(-1, -9.5); c.quadraticCurveTo(-8, -12, -10.5, -19); c.quadraticCurveTo(-7, -14, 0, -7.5); c.closePath(); sprFill(c, '#efe0b4'); // the war horn
        const hx = dead ? -2 : 9, hy = dead ? 19 : 12, cx = dead ? 12 : 16 + fx, cy = dead ? 23 : 3; // hand, then the crossbar's middle
        sprStroke(c, '#5d4037', 2.6, () => { c.moveTo(hx, hy); c.lineTo(cx, cy); }); // the pole
        const wave = i => dead ? 0 : Math.sin(p.t * 6 + i) * 2.5 * k;
        c.beginPath(); c.moveTo(cx, cy - 7 * k); c.lineTo(cx - 22 * k, cy - 7 * k);
        for (let i = 0; i <= 4; i++) c.lineTo(cx - 22 * k + wave(i), cy - 7 * k + 14 * k * i / 4); // the trailing edge ripples
        c.lineTo(cx, cy + 7 * k); c.closePath(); sprFill(c, '#8e1b1b');
        sprStroke(c, '#5d4037', 2, () => { c.moveTo(cx, cy - 7 * k); c.lineTo(cx, cy + 7 * k); }); // the crossbar
        const ex = cx - 9 * k; // a bone-white horned skull on the cloth
        c.beginPath(); c.arc(ex, cy, 3.2 * k, 0, Math.PI * 2); c.fillStyle = '#efe8d8'; c.fill();
        c.strokeStyle = '#efe8d8'; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath();
        for (const s of [-1, 1]) { c.moveTo(ex + 1.5 * k, cy + s * 2 * k); c.lineTo(ex - 0.5 * k, cy + s * 6 * k); } c.stroke();
        if (!dead) { banditArm(c, -1, 12 + fx * 0.5, 7, '#4e342e', '#3e2723'); banditArm(c, 1, hx, hy, '#4e342e', '#3e2723'); } // both hands on the pole
        sprEllipse(c, 1.5, 0, 6.8, 6.8, '#90a4ae'); // the steel cap
        c.strokeStyle = '#546e7a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-1, 0); c.lineTo(8, 0); c.stroke();
    },

    // A pack hound: the Druid's wolf (sprites.js sprWolf), darkened, with a spiked collar and red eyes. Fallen, it lies on
    // its side, squashed and turned.
    hound(c, p) {
        const dead = !!p.dead, b = dead ? null : p.bite, lunge = b === null || b === undefined ? 0 : Math.sin(Math.min(1, b * 2) * Math.PI) * 6;
        c.save();
        if (dead) { c.rotate(0.4); c.scale(1, 0.8); }
        sprWolf(c, dead ? { ...p, move: 0, bite: null } : p);
        c.strokeStyle = '#212121'; c.lineWidth = 3; c.beginPath(); c.ellipse(12, 0, 3.2, 10.5, 0, 0, Math.PI * 2); c.stroke(); // leather collar
        c.fillStyle = '#b0bec5'; c.beginPath(); // five iron spikes, pointing out from the collar
        for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) {
            const bx = 12 + 3.2 * Math.cos(a), by = 10.5 * Math.sin(a), nx = Math.cos(a) / 3.2, ny = Math.sin(a) / 10.5, nl = Math.hypot(nx, ny), ux = nx / nl, uy = ny / nl;
            c.moveTo(bx - uy * 1.6, by + ux * 1.6); c.lineTo(bx + ux * 4.5, by + uy * 4.5); c.lineTo(bx + uy * 1.6, by - ux * 1.6);
        }
        c.fill();
        if (p.lean) { c.translate(10, 0); c.rotate(p.lean * 0.35); c.translate(-10, 0); } // sprWolf turns the head into the stroking hand
        if (p.lean > 0.5) for (const s of [-1, 1]) { // eyes shut, content
            sprEllipse(c, 21, s * 4, 2.2, 2.2, '#6d4c41', false);
            c.strokeStyle = '#1a120d'; c.lineWidth = 1; c.beginPath(); c.arc(20.4, s * 4, 1.6, -0.9, 0.9); c.stroke();
        } else { c.fillStyle = '#ff3d00'; for (const s of [-1, 1]) { c.beginPath(); c.arc(21 + lunge, s * 4, 1.2, 0, Math.PI * 2); c.fill(); } } // red eyes over the green
        c.restore();
    },

    // The Beastmaster on foot (drawBeastmasterBody); mounted, his warhorse under him and him in the saddle, scaled down
    boss_beastmaster(c, p) {
        if (!p.mounted) { drawBeastmasterBody(c, p, false); return; }
        c.save(); c.scale(0.82, 0.82);
        drawHorseBody(c, p, WAR_HORSE);
        c.beginPath(); c.rect(-13, -12, 17, 24); sprFill(c, '#7f1d1d'); // red saddle cloth
        c.fillStyle = '#e0c068'; for (const y of [-12, 10.6]) for (let x = -12; x < 4; x += 3) c.fillRect(x, y, 1.6, 1.4);
        c.save(); c.translate(-3, 0); c.scale(0.7, 0.7); drawBeastmasterBody(c, p, true); c.restore();
        c.restore();
    },

    // Valerius the Vanguard (drawValeriusBody, above)
    boss_valerius(c, p) { drawValeriusBody(c, p); },

    // The Warchief: a big brute in a fur mantle and a ragged red cloak, war paint, a cleaver in one hand and a torch
    // in the other, and a bandolier of throwing knives
    boss_warlord(c, p) {
        banditFeet(c, p, '#2d1d14');
        if (!p.dead) {
            const hem = sprCape(c, p, '#8e2a10', 24, 15);
            c.fillStyle = '#3a1206'; // ragged notches in the hem
            for (const s of [-0.6, 0, 0.6]) { const hy = hem.y + s * 14; c.beginPath(); c.moveTo(hem.x + 1, hy - 2.5); c.lineTo(hem.x + 6, hy); c.lineTo(hem.x + 1, hy + 2.5); c.closePath(); c.fill(); }
        }
        if (p.crouch) c.scale(1 - 0.1 * p.crouch, 1 + 0.05 * p.crouch);
        if (p.lunge) c.translate(3, 0);
        sprTorso(c, '#4e342e', 15, 10.5);
        c.strokeStyle = '#2b1b12'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(6, -11); c.lineTo(-7, 11); c.stroke(); // bandolier
        for (let i = 0; i < 4; i++) { const u = 0.15 + i * 0.22, kx = 6 - 13 * u, ky = -11 + 22 * u; c.fillStyle = '#cfd8dc'; c.fillRect(kx - 1, ky - 3, 2, 3.2); c.fillStyle = '#5d4037'; c.fillRect(kx - 1.2, ky, 2.4, 2.5); }
        // fur mantle over the shoulders: shaggy tufts in a ring
        for (let i = 0; i < 16; i++) {
            const a = Math.PI * 0.5 + i / 15 * Math.PI, fx = Math.cos(a) * 7 - 1, fy = Math.sin(a) * 15.5;
            sprEllipse(c, fx, fy, 5.2, 4.2, i % 2 ? '#6d5c4d' : '#8a7764', i % 3 === 0);
        }
        // the torch, left hand: swung out and back for a throw
        const tk = p.torchK, lx = p.dead ? 0 : 9 - tk * 14, ly = p.dead ? -20 : -14 - tk * 8, ta = -0.25 - tk * 2.3;
        if (!p.dead) {
            const tx = lx + Math.cos(ta) * 13, ty = ly + Math.sin(ta) * 13;
            sprStroke(c, '#5d4037', 2.6, () => { c.moveTo(lx - Math.cos(ta) * 3, ly - Math.sin(ta) * 3); c.lineTo(tx, ty); });
            c.fillStyle = '#3e2723'; c.fillRect(tx - 2.5, ty - 2.5, 4, 5); // pitch-soaked wrap
            const f = 1 + 0.15 * Math.sin(p.t * 17) + 0.1 * Math.sin(p.t * 29);
            const fx = tx + Math.cos(ta) * 3, fy = ty + Math.sin(ta) * 3;
            c.fillStyle = '#e65100'; c.beginPath(); c.ellipse(fx, fy, 5.5 * f, 4 * f, ta, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#ffb300'; c.beginPath(); c.ellipse(fx, fy, 3.6 * f, 2.6 * f, ta, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#fff3c4'; c.beginPath(); c.ellipse(fx - Math.cos(ta), fy - Math.sin(ta), 1.6, 1.3, 0, 0, Math.PI * 2); c.fill();
        }
        banditArm(c, -1, lx, ly, '#5d4037', '#2d1d14');
        // the cleaver, right hand: raised back with a fan of knives before a volley
        const th = p.throwK, lg = p.lunge || 0, rx = p.dead ? 0 : 10 - th * 13 + lg * 5, ry = p.dead ? 20 : 15 + th * 8;
        if (!p.dead) {
            c.save(); c.translate(rx, ry); c.rotate(-0.25 - th * 1.1 + lg * 0.3);
            sprStroke(c, '#4e342e', 3, () => { c.moveTo(-4, 0); c.lineTo(8, 0); });
            c.beginPath(); c.moveTo(7, -2); c.lineTo(23, -3); c.lineTo(24, 6); c.quadraticCurveTo(15, 9, 7, 5); c.closePath(); sprFill(c, '#b0bec5');
            c.strokeStyle = '#78909c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(8, -1.5); c.lineTo(23, -2.5); c.stroke(); // the spine
            c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.beginPath(); c.moveTo(10, 5); c.quadraticCurveTo(16, 7, 22, 5); c.lineTo(22, 4); c.quadraticCurveTo(16, 5.5, 10, 4); c.fill(); // honed edge
            c.fillStyle = '#263238'; c.beginPath(); c.arc(20, 1.5, 1.4, 0, Math.PI * 2); c.fill();
            c.restore();
            if (th > 0) for (let i = -1; i <= 1; i++) { // the knives fanned out in his fist
                c.save(); c.translate(rx, ry); c.rotate(Math.PI * 0.75 + i * 0.4);
                c.beginPath(); c.moveTo(0, -1.4); c.lineTo(9, 0); c.lineTo(0, 1.4); c.closePath(); sprFill(c, '#eceff1'); c.restore();
            }
        }
        banditArm(c, 1, rx, ry, '#5d4037', '#2d1d14');
        if (p.kegK > 0) { // a keg set down in front of him, fuse hissing, then his boot
            const kx = 16 + p.kegK * 4;
            c.save(); c.translate(kx, 0); kegShape(c, 7.5); c.restore();
            if (p.kegK > 0.6) sprEllipse(c, 8 + (p.kegK - 0.6) * 25, 5, 5.5, 3.6, '#2d1d14');
        }
        for (const s of [-1, 1]) { // spiked pauldrons
            sprEllipse(c, 0.5, s * 13.5, 6, 5.4, '#4e3b2c');
            for (const a of [-0.7, 0, 0.7]) {
                const bx = 0.5 + Math.sin(a) * 3.5, by = s * (13.5 + Math.cos(a) * 3.5), px = s * Math.cos(a) * 1.7, py = -Math.sin(a) * 1.7;
                c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(0.5 + Math.sin(a) * 9.5, s * (13.5 + Math.cos(a) * 9.5)); c.lineTo(bx - px, by - py); c.closePath(); sprFill(c, '#9e9e9e');
            }
        }
        // head: shaved but for a black topknot, red war paint, a dark beard at the front
        sprEllipse(c, 2, 0, 8, 8, '#b27a55');
        sprEllipse(c, -4.5, 0, 2.6, 2.6, '#1b1411', false);
        c.strokeStyle = '#c62828'; c.lineWidth = 1.8; c.lineCap = 'round';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(6, s * 1.5); c.lineTo(-1, s * 5.5); c.stroke(); }
        c.beginPath(); c.ellipse(8.5, 0, 2.6, 5.4, 0, -Math.PI / 2, Math.PI / 2); c.fillStyle = '#2b1d16'; c.fill(); // beard
        if (p.hurt && !p.dead) { c.strokeStyle = 'rgba(120, 20, 10, 0.8)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-1, -6); c.lineTo(4, -2); c.stroke(); } // a fresh gash
    },
};

// Where the Warchief's torch flame is in the world (for its light and embers)
function warchiefTorchTip(e, face, scale, tk) {
    const ta = -0.25 - tk * 2.3, lx = 9 - tk * 14 + Math.cos(ta) * 16, ly = -14 - tk * 8 + Math.sin(ta) * 16, c = Math.cos(face), s = Math.sin(face);
    return [e.x + (lx * c - ly * s) * scale, e.y + (lx * s + ly * c) * scale];
}

// Death: a puff of dust and the body on the ground for a while, its weapon dropped beside it
function banditDeathFx(e) {
    if (e.type === 'powder_keg') return;
    if (e.type === 'boss_warlord' && currentMap.type === 'village') vil.bossFell = { x: e.x, y: e.y }; // map_village.js: where his letter falls
    const boss = e.type.startsWith('boss'), away = Math.atan2(e.y - player.y, e.x - player.x);
    burst(e.x, e.y, 0, Math.PI * 2, boss ? 14 : 7, { kind: 'smoke', color: 'rgba(120, 104, 88, 0.6)', size: boss ? 14 : 9, speed: [20, 80], life: 0.7, drag: 3, grow: 20 });
    burst(e.x, e.y, away, 1.8, boss ? 12 : 5, { kind: 'debris', color: '#6d5c4d', size: 3, speed: [60, 200], life: 0.45, drag: 4 });
    if (e.type === 'shield' && e.shieldHp > 0) burst(e.x, e.y, away, 1.6, 6, { kind: 'debris', color: '#8d6e63', size: 4, speed: [60, 180], life: 0.5, drag: 3 });
    effects.push({ type: 'bandit_corpse', x: e.x + Math.cos(away) * 6, y: e.y + Math.sin(away) * 6, kind: e.type, face: away + jitter(0.6), scale: e.size / 26, drop: jitter(2), life: boss ? 25 : 7, maxLife: boss ? 25 : 7 });
    if (boss) { addShake(7); effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 150, color: '#ff7043', life: 0.5, maxLife: 0.5 }); }
}

// ---------- powder kegs ----------

// A keg seen from above: the round lid, staves, iron hoops, a powder mark and the fuse
function kegShape(c, r) {
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); sprFill(c, '#7b5233');
    c.strokeStyle = 'rgba(40, 24, 14, 0.7)'; c.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    c.strokeStyle = '#37474f'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, 0, r * 0.86, 0, Math.PI * 2); c.stroke(); // hoop
    c.beginPath(); c.arc(0, 0, r * 0.6, 0, Math.PI * 2); c.fillStyle = '#9c6b43'; c.fill(); // the lid
    c.strokeStyle = '#2b1a10'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(-r * 0.3, -r * 0.3); c.lineTo(r * 0.3, r * 0.3); c.moveTo(r * 0.3, -r * 0.3); c.lineTo(-r * 0.3, r * 0.3); c.stroke(); // powder mark
    c.strokeStyle = '#d7ccc8'; c.lineWidth = 1; c.beginPath(); c.moveTo(r * 0.35, -r * 0.35); c.quadraticCurveTo(r * 0.8, -r * 0.9, r * 1.1, -r * 0.7); c.stroke(); // fuse
}

function drawKeg(e) {
    const lit = e.fuse !== undefined, shake = lit ? jitter(2.5) : 0, r = 13 * (e.hitFlash > 0 ? 1.1 : 1);
    ctx.save(); ctx.globalAlpha = Math.min(1, (fxTime - (e.bornAt || -9)) / 0.4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.beginPath(); ctx.ellipse(e.x + 3, e.y + 5, r * 1.05, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(e.x + shake, e.y); kegShape(ctx, r);
    if (lit || Math.sin(fxTime * 3 + (e.seed || 0)) > 0.7) { // a lit fuse, or the odd glint saying "hit me"
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, r * 1.1, -r * 0.7, lit ? 18 : 9, '#ffd180', lit ? 0.9 : 0.4); ctx.restore();
    }
    ctx.restore();
    if (lit && Math.random() < 0.6) spawnParticle({ kind: 'spark', color: '#ffe082', x: e.x + r * 1.1, y: e.y - r * 0.7, vx: jitter(160), vy: jitter(160), size: 1.6, life: 0.2, drag: 3, grow: 0, spin: 0, rot: 0 });
}

// Spawned by map_village.js at its keg spots: an enemy that never moves or counts toward the wave
function makeKeg(k) {
    const e = { type: 'powder_keg', pod: k, prop: true, x: k.x, y: k.y, size: 28, color: '#7b5233', hp: 1, maxHp: 1, xp: 0, dmg: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: 0, seed: Math.random() * 10, bornAt: fxTime };
    k.ent = e; enemies.push(e);
    k.obs = { x: k.x, y: k.y, r: 15, kind: 'keg' }; if (currentMap.obstacles) currentMap.obstacles.push(k.obs);
}

// combat.js checkEnemyDeath: a keg was hit (or caught from a blast or a fire)
function kegBlown(e) {
    if (e.dead) return;
    e.dead = true;
    const k = e.pod; k.ent = null; k.goneAt = fxTime;
    const obs = currentMap.obstacles, i = obs ? obs.indexOf(k.obs) : -1; if (i >= 0) obs.splice(i, 1);
    powderBlast(e.x, e.y, KEG_DMG(wave), KEG_DMG_ENEMY(wave), e);
}

// Light a keg's fuse: it goes off a moment later (updateBanditFx)
function lightKeg(e, t) { if (!e.dead && e.type === 'powder_keg' && (e.fuse === undefined || e.fuse > t)) e.fuse = t; }

// A powder blast: hurts the hero and every enemy around it, staggers the Warchief, sets the ground alight and sets
// off kegs nearby. `src` is skipped (the keg itself, or the bandit who kicked it while still at his feet).
function powderBlast(x, y, pDmg, eDmg, src) {
    addShake(6);
    effects.push({ type: 'keg_flash', x, y, life: 0.35, maxLife: 0.35 });
    effects.push({ type: 'slime_shock', x, y, radius: KEG_RADIUS * 1.3, color: '#ffab40', life: 0.45, maxLife: 0.45 });
    effects.push({ type: 'scorch', x, y, r: 70, seed: Math.random() * 10, life: 16, maxLife: 16 });
    burst(x, y, 0, Math.PI * 2, 16, { kind: 'debris', color: '#6d4c41', size: 4, speed: [140, 420], life: 0.7, drag: 2.5 });
    burst(x, y, 0, Math.PI * 2, 18, { kind: 'spark', color: '#ffcc80', size: 2.6, speed: [200, 520], life: 0.35, drag: 4 });
    burst(x, y, 0, Math.PI * 2, 10, { kind: 'smoke', color: 'rgba(70, 60, 54, 0.7)', size: 22, speed: [30, 120], life: 1.2, drag: 2, grow: 40 });
    igniteGround(x, y, 70, 3.5, null);
    if (player.z <= 4 && Math.hypot(player.x - x, player.y - y) < KEG_RADIUS + player.radius) takeDamage(pDmg);
    for (const e of enemies) {
        if (e.dead || e === src || e.submerged || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (e.type === 'powder_keg') { if (d < KEG_CHAIN) lightKeg(e, 0.15 + d / 900); continue; } // a chain going off one after another
        if (e.prop || d > KEG_RADIUS + e.size / 2) continue;
        applyDamage(e, eDmg, 'env');
        if (e.type === 'boss_warlord' && !e.dead && e.state !== 'intro') { // knocked off his feet: whatever he was winding up is lost
            e.state = 'idle'; e.stateTimer = Math.max(e.stateTimer, 1.4);
            effects.push({ type: 'text', text: 'Staggered!', x: e.x, y: e.y - 44, color: '#ffab40', life: 0.9, maxLife: 0.9 });
        }
    }
}

// ---------- fire ----------

function igniteGround(x, y, r, life, owner) {
    effects.push({ type: 'ground_fire', x, y, radius: r, owner, seed: Math.random() * 10, life, maxLife: life });
    for (const e of enemies) if (e.type === 'powder_keg' && !e.dead && Math.hypot(e.x - x, e.y - y) < r + 14) lightKeg(e, 0.45);
}

// The Warchief's torch: it sails onto the marked spot and sets it burning (ai.js)
function warchiefTorch(e, tx, ty) {
    if (currentMap.grid) { const cl = clipToWalls(e.x, e.y, tx, ty, 10, true); if (cl) [tx, ty] = cl; }
    const [hx, hy] = warchiefTorchTip(e, e.facingAngle || 0, e.size / 26, 1);
    effects.push({ type: 'torch_arc', x0: hx, y0: hy, x: tx, y: ty, spin: Math.random() * 6, life: TORCH_FLIGHT, maxLife: TORCH_FLIGHT });
    effects.push({ type: 'slam_warn', x: tx, y: ty, radius: TORCH_FIRE_R, color: '#ff7043', life: TORCH_FLIGHT, maxLife: TORCH_FLIGHT });
    const dmg = e.dmg;
    after(TORCH_FLIGHT, () => {
        igniteGround(tx, ty, TORCH_FIRE_R, TORCH_FIRE_LIFE, 'warchief');
        burst(tx, ty, 0, Math.PI * 2, 14, { kind: 'spark', color: '#ffb74d', size: 2.4, speed: [120, 340], life: 0.4, drag: 4 });
        effects.push({ type: 'slime_shock', x: tx, y: ty, radius: TORCH_FIRE_R * 1.4, color: '#ff7043', life: 0.4, maxLife: 0.4 }); addShake(2.5);
        if (player.z <= 4 && Math.hypot(player.x - tx, player.y - ty) < TORCH_FIRE_R + player.radius * 0.5) takeDamage(dmg * 0.8);
    });
}

// Below half health the Warchief kicks a lit keg rolling at the hero. It goes off when it touches anyone (his own men
// included: dodge it into them), rolls into something solid, or its fuse runs out.
function warchiefKegKick(e) {
    const [dx, dy, d] = getVector(e.x, e.y, player.x, player.y), ux = dx / d, uy = dy / d;
    const pDmg = e.dmg * 1.5;
    projectiles.push({ x: e.x + ux * (e.size / 2 + 16), y: e.y + uy * (e.size / 2 + 16), vx: ux * 340, vy: uy * 340, radius: 14, isEnemy: true, owner: e, damage: 0, type: 'keg_roll', life: 3, fuse: 2.2, roll: 0,
        customUpdate(dt, p) {
            p.fuse -= dt; p.roll += 340 * dt / 14;
            if (Math.random() < 0.7) spawnParticle({ kind: 'spark', color: '#ffe082', x: p.x - p.vx / 340 * 12, y: p.y - p.vy / 340 * 12, vx: jitter(140), vy: jitter(140), size: 1.6, life: 0.2, drag: 3, grow: 0, spin: 0, rot: 0 });
            const nx = p.x + p.vx * dt * 2, ny = p.y + p.vy * dt * 2;
            let boom = p.fuse <= 0 || nx < currentMap.left || nx > currentMap.right || ny < currentMap.top || ny > currentMap.bottom;
            if (!boom && currentMap.grid) boom = solidCell(terrainAt(nx, ny), false);
            if (!boom && currentMap.obstacles) boom = currentMap.obstacles.some(o => o.kind !== 'keg' && Math.hypot(nx - o.x, ny - o.y) < o.r + p.radius);
            if (!boom && player.z <= 4) boom = Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.radius;
            if (!boom) boom = enemies.some(o => !o.dead && o !== p.owner && !o.prop && !(o.spawnT > 0) && Math.hypot(o.x - p.x, o.y - p.y) < o.size / 2 + p.radius);
            if (boom) { p.life = 0; powderBlast(p.x, p.y, pDmg, KEG_DMG_ENEMY(wave), null); } // main.js removes it before the touch check
        } });
}

// Every frame (main.js update): fire burns whoever stands in it, lit kegs count down
function updateBanditFx(dt) {
    player.burning = false;
    for (const ef of effects) { // a bear trap sprung by a shot (the hero springing one is in main.js): the jaws snap shut, harmlessly
        if (ef.type !== 'bear_trap') continue;
        if (!projectiles.some(p => !p.isEnemy && p.type !== 'turret' && p.type !== 'tesla_coil_trap' && Math.hypot(p.x - ef.x, p.y - ef.y) < 18)) continue;
        ef.type = 'trap_snapped'; ef.life = ef.maxLife = 1.0;
        burst(ef.x, ef.y, 0, Math.PI * 2, 6, { kind: 'spark', color: '#cfd8dc', size: 2, speed: [80, 220], life: 0.3, drag: 4 });
    }
    for (const ef of effects) {
        if (ef.type !== 'ground_fire') continue;
        const k = Math.min(1, ef.life / 0.6); // the last moments are only embers
        if (k < 0.3) continue;
        if (player.z <= 4 && Math.hypot(player.x - ef.x, player.y - ef.y) < ef.radius + player.radius * 0.4) { takeDamage(FIRE_DPS(wave) * dt, true); player.burning = true; }
        for (const e of enemies) {
            if (e.dead || e.prop || e.airborne || e.spawnT > 0 || e.type === 'boss_warlord' || e.submerged) continue;
            if (Math.hypot(e.x - ef.x, e.y - ef.y) < ef.radius + e.size * 0.3) applyDamage(e, FIRE_DPS_ENEMY(wave) * dt, 'dot');
        }
    }
    for (const e of enemies) {
        if (e.type !== 'powder_keg' || e.dead) continue;
        e.frozenTimer = e.rootedTimer = e.stunTimer = e.slowTimer = 0; // kegs skip the enemy loop, so nothing would ever wear off them
        if (e.fuse !== undefined && (e.fuse -= dt) <= 0) kegBlown(e);
    }
}

// ---------- drawing: shots, ground and overlay ----------

function drawBanditProjectile(p) {
    const c = ctx;
    if (p.type === 'keg_roll') { // a keg on its side, rolling: the staves slide past as it turns
        const a = Math.atan2(p.vy, p.vx);
        c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 6, 15, 11, a, 0, Math.PI * 2); c.fill();
        c.save(); c.translate(p.x, p.y); c.rotate(a + Math.PI / 2);
        c.beginPath(); c.roundRect(-13, -11, 26, 22, 6); sprFill(c, '#7b5233');
        c.save(); c.clip(); c.strokeStyle = 'rgba(40, 24, 14, 0.7)'; c.lineWidth = 1;
        for (let i = 0; i < 5; i++) { const sy = ((p.roll * 5 + i * 5) % 25) - 12.5; c.beginPath(); c.moveTo(-13, sy); c.lineTo(13, sy); c.stroke(); }
        c.restore();
        c.fillStyle = '#37474f'; c.fillRect(-9, -11, 2.6, 22); c.fillRect(6.4, -11, 2.6, 22); // hoops
        c.restore();
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12, 20 + Math.sin(fxTime * 30) * 4, '#ffd180', 0.8); c.restore();
        return true;
    }
    if (p.type === 'trap_throw') { // a bear trap tumbling through the air: its arc peaks mid-flight, its shadow stays on the ground
        const D = Math.hypot(p.targetX - p.ox, p.targetY - p.oy) || 1, k = clamp01(1 - Math.hypot(p.targetX - p.x, p.targetY - p.y) / D);
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(p.x, p.y, 8, 4.5, 0, 0, Math.PI * 2); c.fill();
        drawBearTrap(c, p.x, p.y - Math.sin(Math.PI * k) * 60, k * 16, 7, false);
        return true;
    }
    if (p.type === 'sling_stone') { // a stone lobbed in a low arc at where the hero stood: its shadow on the ground, a streak behind it
        const D = Math.hypot(p.targetX - p.ox, p.targetY - p.oy) || 1, k = clamp01(1 - Math.hypot(p.targetX - p.x, p.targetY - p.y) / D), z = Math.sin(Math.PI * k) * 45;
        const a = Math.atan2(p.targetY - p.oy, p.targetX - p.ox), y = p.y - z;
        c.fillStyle = 'rgba(0, 0, 0, 0.28)'; c.beginPath(); c.ellipse(p.x, p.y, 5, 3, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(220, 210, 190, 0.25)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x - Math.cos(a) * 18, y - Math.sin(a) * 18 + Math.cos(Math.PI * k) * 6); c.lineTo(p.x, y); c.stroke();
        c.beginPath(); c.arc(p.x, y, 4.5, 0, Math.PI * 2); c.fillStyle = '#8d8a84'; c.fill(); c.strokeStyle = '#2b2a28'; c.lineWidth = 1.3; c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.beginPath(); c.arc(p.x - 1.4, y - 1.6, 1.4, 0, Math.PI * 2); c.fill();
        return true;
    }
    if (p.type === 'bolas') { // two heavy stones on a cord, spinning round the shot's centre
        const a = Math.atan2(p.vy, p.vx), sp = fxTime * 14, R = 18, sx = Math.cos(sp) * R, sy = Math.sin(sp) * R;
        c.save(); c.translate(p.x, p.y); c.lineCap = 'round';
        c.strokeStyle = 'rgba(255, 183, 77, 0.3)'; c.lineWidth = 12; c.beginPath(); c.moveTo(-Math.cos(a) * 46, -Math.sin(a) * 46); c.lineTo(0, 0); c.stroke(); // a warm streak behind
        c.fillStyle = 'rgba(255, 224, 178, 0.16)'; c.beginPath(); c.arc(0, 0, R + 8, 0, Math.PI * 2); c.fill(); // the blur of the spin
        c.strokeStyle = 'rgba(255, 243, 224, 0.75)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R + 8, sp, sp + 1.6); c.arc(0, 0, R + 8, sp + Math.PI, sp + Math.PI + 1.6); c.stroke(); // swish arcs
        c.strokeStyle = '#3e2723'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-sx, -sy); c.lineTo(sx, sy); c.stroke(); // the cord
        for (const s of [-1, 1]) { const x = s * sx, y = s * sy;
            c.beginPath(); c.arc(x, y, 7.5, 0, Math.PI * 2); c.fillStyle = '#6d4c41'; c.fill(); c.strokeStyle = '#1f1410'; c.lineWidth = 1.6; c.stroke();
            c.fillStyle = '#bcaaa4'; c.beginPath(); c.arc(x - 2.2, y - 2.2, 2.4, 0, Math.PI * 2); c.fill(); } // highlight
        c.restore(); return true;
    }
    const own = p.owner && p.owner.type;
    if (p.shape === 'arrow' && own === 'archer') { // ash shaft, iron head, red fletching
        const a = Math.atan2(p.vy, p.vx);
        c.save(); c.translate(p.x, p.y); c.rotate(a);
        c.strokeStyle = 'rgba(255, 220, 180, 0.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-26, 0); c.lineTo(-12, 0); c.stroke(); // motion streak
        c.strokeStyle = '#2b1a10'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-12, 0); c.lineTo(10, 0); c.stroke();
        c.strokeStyle = '#bcaaa4'; c.lineWidth = 1.8; c.stroke();
        c.beginPath(); c.moveTo(16, 0); c.lineTo(8, -3.6); c.lineTo(9.5, 0); c.lineTo(8, 3.6); c.closePath(); c.fillStyle = '#cfd8dc'; c.fill(); c.strokeStyle = '#263238'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#c62828'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-6, 0); c.lineTo(-13, s * 4); c.lineTo(-11, 0); c.closePath(); c.fill(); }
        c.restore(); return true;
    }
    if (p.shape === 'knife' && own === 'boss_warlord') { // a throwing knife, point first
        const a = Math.atan2(p.vy, p.vx);
        c.save(); c.translate(p.x, p.y); c.rotate(a);
        c.strokeStyle = 'rgba(255, 236, 210, 0.22)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-28, 0); c.lineTo(-8, 0); c.stroke();
        c.beginPath(); c.moveTo(12, 0); c.lineTo(0, -3); c.lineTo(0, 3); c.closePath(); c.fillStyle = '#eceff1'; c.fill(); c.strokeStyle = '#263238'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#90a4ae'; c.fillRect(-1, -4, 2, 8);
        c.fillStyle = '#5d4037'; c.fillRect(-9, -1.8, 8, 3.6); c.fillStyle = '#ff9800'; c.fillRect(-6, -1.8, 1.5, 3.6);
        c.restore(); return true;
    }
    return false;
}

// Under the fighters: fire on the ground, scorch marks, the fallen
function drawBanditGround(ef) {
    const c = ctx;
    if (ef.type === 'ground_fire') {
        const k = Math.min(1, ef.life / 1.2) * Math.min(1, (ef.maxLife - ef.life) / 0.2), t = fxTime, r = ef.radius;
        c.save();
        c.fillStyle = `rgba(20, 12, 8, ${0.45 * Math.min(1, ef.life / 0.6)})`; c.beginPath(); c.ellipse(ef.x, ef.y, r, r * 0.82, 0, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = 'lighter'; glow(c, ef.x, ef.y, r * 1.5, '#ff6d00', 0.35 * k); c.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 4; i++) { const a = ef.seed + i * 2.1, d = r * (i ? 0.5 : 0); drawFlame(c, ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d * 0.8, r * (i ? 0.4 : 0.5), t, ef.seed + i, k); }
        c.restore();
        if (k > 0.3 && Math.random() < 0.25) spawnParticle({ kind: 'dot', color: '#ffb74d', x: ef.x + jitter(r), y: ef.y + jitter(r * 0.8), vx: WIND_X * 50, vy: WIND_Y * 50 - 20, size: 2, life: 0.8, drag: 0.5, grow: 0, spin: 0, rot: 0 });
        return true;
    }
    if (ef.type === 'scorch') { // soot left by a blast
        const a = Math.min(1, ef.life / 4);
        c.save(); c.globalAlpha = a * 0.6;
        const g = c.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.r); g.addColorStop(0, 'rgba(12, 8, 6, 0.95)'); g.addColorStop(0.6, 'rgba(25, 18, 14, 0.6)'); g.addColorStop(1, 'rgba(25, 18, 14, 0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(ef.x, ef.y, ef.r, ef.r * 0.82, 0, 0, Math.PI * 2); c.fill();
        c.restore(); return true;
    }
    if (ef.type === 'bandit_corpse') {
        const a = Math.min(1, ef.life / 1.5), lay = Math.min(1, (ef.maxLife - ef.life) / 0.25); // falls over, lies there, fades
        const pose = { t: 0, walk: 0, move: 0, trail: { x: 0, y: 0 }, stab: 0, draw: 0, shield: 0, throwK: 0, torchK: 0, kegK: 0, dead: true };
        if (lay < 1) { stampBandit(null, ef.x, ef.y, ef.face, ef.scale * (0.92 + 0.08 * lay), pose, 0, a * 0.95, 0.25 * lay, ef.kind); return true; }
        if (!ef.img) { const E = banditExtent(ef.kind, ef.scale); ef.img = cavCanvas(E * 2, E * 2); stampBandit(null, 0, 0, ef.face, ef.scale, pose, 0, 1, 0.25, ef.kind, ef.img); } // it lies still: painted once
        c.save(); c.globalAlpha = a * 0.95; c.drawImage(ef.img, ef.x - ef.img.width / 2, ef.y - ef.img.height / 2); c.restore();
        return true;
    }
    if (ef.type === 'rally_pulse') { // the bannerman's rally: a thin red ring running out to the rally's edge, no fill
        const k = 1 - ef.life / ef.maxLife;
        c.save(); c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = '#ef5350'; c.lineWidth = 3 - 2 * k;
        c.beginPath(); c.arc(ef.x, ef.y, ef.radius * easeOut(k), 0, Math.PI * 2); c.stroke(); c.restore(); return true;
    }
    if (ef.type === 'lance_lane') { // a horse rider's lance: the lane it'll charge down, thin and red; solid once the lane locks
        const e = ef.e, a = e.laneA, L0 = ef.len || RIDER_RANGE, p = 0.5 + 0.5 * Math.sin(fxTime * 14), w = ef.w;
        if (e.dead) return true;
        let L = L0;
        if (currentMap.grid) { const cl = clipToWalls(e.x, e.y, e.x + Math.cos(a) * L0, e.y + Math.sin(a) * L0, 10, false); if (cl) L = Math.hypot(cl[0] - e.x, cl[1] - e.y); }
        const locked = ef.maxLife - ef.life > (ef.lockAt !== undefined ? ef.lockAt : RIDER_AIM - RIDER_LOCK);
        c.save(); c.translate(e.x, e.y); c.rotate(a);
        c.fillStyle = `rgba(230, 60, 40, ${0.08 + 0.05 * p})`; c.fillRect(0, -w / 2, L, w);
        c.lineWidth = locked ? 2.4 : 1.4; c.setLineDash(locked ? [] : [9, 7]); c.lineDashOffset = -fxTime * 50;
        c.strokeStyle = locked ? 'rgba(255, 225, 215, 0.95)' : `rgba(255, 200, 185, ${0.45 + 0.2 * p})`; c.strokeRect(0, -w / 2, L, w); c.setLineDash([]);
        c.strokeStyle = locked ? 'rgba(255, 235, 225, 0.95)' : 'rgba(255, 210, 195, 0.7)'; c.lineWidth = 2; c.lineCap = 'round';
        for (const f of [0.3, 0.55, 0.8]) { const d = L * f; c.beginPath(); c.moveTo(d - 6, -w * 0.22); c.lineTo(d + 4, 0); c.lineTo(d - 6, w * 0.22); c.stroke(); } // three arrowheads down the lane
        c.restore(); return true;
    }
    if (ef.type === 'whip_lane') { // where the Beastmaster's lash will fall: a narrow wedge, its edge sweeping out, bright once locked
        const e = ef.e; if (e.dead || e.state !== 'whip') return true;
        const k = clamp01(1 - ef.life / ef.maxLife), locked = ef.life < 0.15, a = e.whipA, R = BEAST_WHIP_REACH, A = BEAST_WHIP_ARC;
        c.save(); c.translate(e.x, e.y);
        c.fillStyle = `rgba(200, 40, 30, ${0.1 + 0.16 * k})`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a - A, a + A); c.closePath(); c.fill();
        c.strokeStyle = locked ? 'rgba(255, 230, 220, 0.95)' : 'rgba(255, 170, 150, 0.6)'; c.lineWidth = locked ? 2.6 : 1.6;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - A) * R, Math.sin(a - A) * R); c.arc(0, 0, R, a - A, a + A); c.lineTo(0, 0); c.stroke();
        c.strokeStyle = 'rgba(255, 210, 190, 0.85)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, e.size / 2 + (R - e.size / 2) * k, a - A, a + A); c.stroke(); // the sweep
        c.restore(); return true;
    }
    if (ef.type === 'bear_trap') { // an armed trap: on a patch of turned earth, iron jaws wide open, a rust-red ring breathing round it and a glint, so it reads among the grass
        const pulse = 0.5 + 0.5 * Math.sin(fxTime * 4 + ef.x * 0.1), glint = Math.pow(Math.max(0, Math.sin(fxTime * 2.6 + ef.x * 0.1)), 10), born = clamp01((ef.maxLife - ef.life) / 0.25);
        c.save(); c.globalAlpha = born;
        c.fillStyle = 'rgba(52, 36, 22, 0.85)'; c.beginPath(); c.ellipse(ef.x, ef.y + 1, 19, 15, 0, 0, Math.PI * 2); c.fill(); // turned earth
        c.strokeStyle = `rgba(200, 70, 40, ${0.45 + 0.35 * pulse})`; c.lineWidth = 2; c.beginPath(); c.arc(ef.x, ef.y, 21 + pulse * 2, 0, Math.PI * 2); c.stroke(); // the warning ring
        c.strokeStyle = '#78909c'; c.lineWidth = 1.4; c.setLineDash([2.5, 2]); c.beginPath(); c.moveTo(ef.x + 13, ef.y + 2); c.lineTo(ef.x + 24, ef.y + 6); c.stroke(); c.setLineDash([]); // the chain to its stake
        c.fillStyle = '#5d4037'; c.beginPath(); c.arc(ef.x + 25, ef.y + 6.5, 2.4, 0, Math.PI * 2); c.fill();
        drawBearTrap(c, ef.x, ef.y, 0, 15, false);
        c.restore();
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, ef.x - 5, ef.y - 6, 10 + glint * 8, '#ffffff', 0.1 + 0.9 * glint); c.restore();
        return true;
    }
    if (ef.type === 'trap_snapped') { // the jaws shut on the ground, fading out over the last half second
        c.save(); c.globalAlpha = Math.min(1, ef.life / 0.5) * 0.85; drawBearTrap(c, ef.x, ef.y, 0, 12, true); c.restore();
        return true;
    }
    // Valerius (ai.js ValeriusAI): every shape is exactly the hit, for the hero's body: clear of it is safe
    if (ef.type === 'val_lane') { // a thrust or a throw down a lane from him along his aim; dashed while it follows you, solid once locked
        const e = ef.e; if (e.dead || e.escaping) return true;
        const a = e.aimA, w = ef.w, locked = ef.maxLife - ef.life > ef.lockAt, p = 0.5 + 0.5 * Math.sin(fxTime * 14);
        let L = ef.len; if (currentMap.grid) { const cl = clipToWalls(e.x, e.y, e.x + Math.cos(a) * L, e.y + Math.sin(a) * L, 4, true); if (cl) L = Math.hypot(cl[0] - e.x, cl[1] - e.y); }
        c.save(); c.translate(e.x, e.y); c.rotate(a);
        c.fillStyle = `rgba(230, 60, 40, ${(ef.chain ? 0.14 : 0.1) + 0.05 * p})`; c.fillRect(0, -w / 2, L, w);
        c.lineWidth = locked ? 2.4 : 1.4; c.setLineDash(locked ? [] : [9, 7]); c.lineDashOffset = -fxTime * 50;
        c.strokeStyle = locked ? 'rgba(255, 225, 215, 0.95)' : `rgba(255, 200, 185, ${0.45 + 0.2 * p})`; c.strokeRect(0, -w / 2, L, w); c.setLineDash([]);
        if (ef.chain) { c.fillStyle = locked ? '#fff3e0' : 'rgba(255, 210, 195, 0.8)'; c.beginPath(); c.moveTo(L, 0); c.lineTo(L - 12, -w / 2 - 3); c.lineTo(L - 12, w / 2 + 3); c.closePath(); c.fill(); } // a spearhead at the chain's reach
        else { c.strokeStyle = locked ? 'rgba(255, 235, 225, 0.95)' : 'rgba(255, 210, 195, 0.7)'; c.lineWidth = 2; c.lineCap = 'round'; for (const f of [0.3, 0.55, 0.8]) { const d = L * f; c.beginPath(); c.moveTo(d - 6, -w * 0.22); c.lineTo(d + 4, 0); c.lineTo(d - 6, w * 0.22); c.stroke(); } }
        c.restore(); return true;
    }
    if (ef.type === 'val_wedge') { // the Sweeping Arc: a wide wedge at spear's reach, its edge sweeping out; bright once locked
        const e = ef.e; if (e.dead || e.state !== 'arc_prep') return true;
        const k = clamp01(1 - ef.life / ef.maxLife), locked = ef.maxLife - ef.life > ef.lockAt, a = e.aimA, R = ef.R, A = ef.half;
        c.save(); c.translate(e.x, e.y);
        c.fillStyle = `rgba(200, 40, 30, ${0.1 + 0.16 * k})`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a - A, a + A); c.closePath(); c.fill();
        c.strokeStyle = locked ? 'rgba(255, 230, 220, 0.95)' : 'rgba(255, 170, 150, 0.6)'; c.lineWidth = locked ? 2.6 : 1.6;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - A) * R, Math.sin(a - A) * R); c.arc(0, 0, R, a - A, a + A); c.lineTo(0, 0); c.stroke();
        c.strokeStyle = 'rgba(255, 210, 190, 0.85)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, e.size / 2 + (R - e.size / 2) * k, a - A, a + A); c.stroke();
        c.restore(); return true;
    }
    if (ef.type === 'val_ring') { // the Chain Lasso: a band at the chain's length round him (inside it or beyond it is safe), its edges closing in on the band as the lash comes
        const e = ef.e; if (e.dead || e.state !== 'lasso_prep') return true;
        const k = clamp01(1 - ef.life / ef.maxLife), R = ef.R, w = ef.w;
        c.save(); c.beginPath(); c.arc(e.x, e.y, R + w, 0, Math.PI * 2); c.arc(e.x, e.y, R - w, 0, Math.PI * 2, true);
        c.fillStyle = `rgba(200, 40, 30, ${0.12 + 0.18 * k})`; c.fill('evenodd');
        c.strokeStyle = k > 0.85 ? 'rgba(255, 230, 220, 0.95)' : 'rgba(255, 170, 150, 0.65)'; c.lineWidth = k > 0.85 ? 2.6 : 1.6;
        for (const r of [R - w, R + w]) { c.beginPath(); c.arc(e.x, e.y, r, 0, Math.PI * 2); c.stroke(); }
        c.strokeStyle = 'rgba(255, 210, 190, 0.8)'; c.lineWidth = 1.6; // the two edges sliding in from far out and from his body
        for (const r of [lerp(R + w + 120, R + w, k), lerp(e.size / 2, R - w, k)]) { c.beginPath(); c.arc(e.x, e.y, r, 0, Math.PI * 2); c.stroke(); }
        c.restore(); return true;
    }
    if (ef.type === 'val_cyclone') { // the Chain Cyclone's reach (the arm sweeps everything inside it); before the spin, where the arm starts and which way it turns
        const e = ef.e; if (e.dead || (ef.spin ? e.state !== 'cyclone' : e.state !== 'cyc_prep')) return true;
        const R = ef.R + VAL_CYC_W, p = 0.5 + 0.5 * Math.sin(fxTime * 12);
        c.save(); c.translate(e.x, e.y);
        c.fillStyle = `rgba(200, 40, 30, ${ef.spin ? 0.07 : 0.1 + 0.06 * p})`; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
        c.strokeStyle = ef.spin ? 'rgba(255, 170, 150, 0.55)' : 'rgba(255, 225, 215, 0.9)'; c.lineWidth = ef.spin ? 1.6 : 2.4; c.setLineDash(ef.spin ? [] : [12, 8]); c.lineDashOffset = -fxTime * 40 * ef.dir;
        c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        if (!ef.spin) {
            const a0 = e.cycA === undefined ? 0 : e.cycA;
            c.strokeStyle = 'rgba(255, 235, 225, 0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(a0) * e.size / 2, Math.sin(a0) * e.size / 2); c.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); c.stroke(); // the arm's start
            for (let j = 1; j <= 3; j++) { const a = a0 + ef.dir * j * 0.5, x = Math.cos(a) * (R - 18), y = Math.sin(a) * (R - 18), t = a + ef.dir * Math.PI / 2; // arrowheads round the rim: the way it turns
                c.beginPath(); c.moveTo(x + Math.cos(t) * 9, y + Math.sin(t) * 9); c.lineTo(x + Math.cos(t + 2.5) * 8, y + Math.sin(t + 2.5) * 8); c.moveTo(x + Math.cos(t) * 9, y + Math.sin(t) * 9); c.lineTo(x + Math.cos(t - 2.5) * 8, y + Math.sin(t - 2.5) * 8); c.stroke(); }
        }
        c.restore(); return true;
    }
    if (ef.type === 'val_lash') { // the lasso's lash: the ring of chain cracking out, fading fast
        const k = 1 - ef.life / ef.maxLife;
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = '#cfd8dc'; c.lineWidth = 4 * (1 - k) + 1; c.setLineDash([6, 4]); c.beginPath(); c.arc(ef.x, ef.y, ef.R, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore();
        return true;
    }
    if (ef.type === 'charge_lane') { // the Warchief's Bull Rush: the lane he'll run down, filling up as the charge comes
        const k = 1 - ef.life / ef.maxLife, a = Math.atan2(ef.y1 - ef.y0, ef.x1 - ef.x0), L = Math.hypot(ef.x1 - ef.x0, ef.y1 - ef.y0), w = ef.w, p = 0.5 + 0.5 * Math.sin(fxTime * 16);
        c.save(); c.translate(ef.x0, ef.y0); c.rotate(a);
        c.fillStyle = `rgba(255, 70, 30, ${0.14 + 0.1 * k})`; c.fillRect(0, -w / 2, L, w);
        c.fillStyle = `rgba(255, 120, 40, ${0.28 + 0.12 * p})`; c.fillRect(0, -w / 2, L * k, w);
        c.strokeStyle = `rgba(255, 190, 140, ${0.7 + 0.3 * p})`; c.lineWidth = 3; c.setLineDash([16, 10]); c.lineDashOffset = -fxTime * 80; c.strokeRect(0, -w / 2, L, w); c.setLineDash([]);
        c.strokeStyle = 'rgba(255, 220, 190, 0.9)'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
        for (let d = 60; d < L - 10; d += 70) { const q = ((d / L) - k * 1.2 + 1) % 1; c.globalAlpha = 0.35 + 0.65 * (q < 0.25 ? 1 - q / 0.25 : 0.2); c.beginPath(); c.moveTo(d - 10, -w * 0.28); c.lineTo(d + 6, 0); c.lineTo(d - 10, w * 0.28); c.stroke(); } // chevrons running down the lane
        c.restore(); return true;
    }
    return false;
}

// Above everything: a torch in flight, the flash of a blast
function drawBanditOverlay() {
    const c = ctx;
    for (const e of enemies) { // the Chain Cyclone's smear: a fading band trailing the spear round
        if (e.type !== 'boss_valerius' || e.dead || e.state !== 'cyclone' || e.cycA === undefined) continue;
        const R = VAL_CYC_R, r0 = e.size / 2 + 20;
        c.save();
        for (let k = 0; k < 7; k++) { const a1 = e.cycA - e.cycDir * k * 0.16, a0 = a1 - e.cycDir * 0.16; c.fillStyle = `rgba(255, 238, 215, ${0.6 * (1 - k / 7)})`; c.beginPath(); c.arc(e.x, e.y, R, Math.min(a0, a1), Math.max(a0, a1)); c.arc(e.x, e.y, r0 + (R - r0) * 0.55, Math.max(a0, a1), Math.min(a0, a1), true); c.closePath(); c.fill(); }
        const aT = e.cycA - e.cycDir * 1.12; c.strokeStyle = 'rgba(40, 30, 26, 0.45)'; c.lineWidth = 2.5; c.beginPath(); c.arc(e.x, e.y, R + 2, Math.min(aT, e.cycA), Math.max(aT, e.cycA)); c.stroke(); // a dark rim, so it reads on pale stone
        c.restore();
    }
    for (const ef of effects) { // the Sweeping Arc's crescent, a bright band swept across the wedge
        if (ef.type !== 'val_slash' || ef.e.dead) continue;
        const k = 1 - ef.life / ef.maxLife, e = ef.e, sweep = Math.min(1, k * 2.5), a0 = ef.a + ef.half, a1 = ef.a + ef.half - 2 * ef.half * sweep;
        c.save(); c.globalAlpha = 1 - k;
        c.fillStyle = 'rgba(255, 244, 225, 0.75)'; c.beginPath(); c.arc(e.x, e.y, ef.R, a1, a0); c.arc(e.x, e.y, ef.R * 0.62, a0, a1, true); c.closePath(); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(e.x, e.y, ef.R, a1, a0); c.stroke();
        c.restore();
    }
    for (const e of enemies) { // Valerius's spear out on its chain: thrown, stuck in the deck, swung round, or hooked into the hero
        if (e.type !== 'boss_valerius' || e.dead || !e.spear) continue;
        const sc = e.size / 26, sp = e.spear, ux = Math.cos(sp.a), uy = Math.sin(sp.a), len = (VAL_SPEAR_L + 13) * sc, bx = sp.x - ux * len, by = sp.y - uy * len, f = valFist(e);
        c.save(); c.globalAlpha = 1 - (e.fadeK || 0);
        drawValChain(c, f.x, f.y, bx, by, Math.min(14, Math.hypot(bx - f.x, by - f.y) * 0.04), sc * 0.85);
        c.fillStyle = 'rgba(0, 0, 0, 0.22)'; c.beginPath(); c.ellipse(sp.x - ux * len * 0.5 + 6, sp.y - uy * len * 0.5 + 10, len * 0.5, 4, sp.a, 0, Math.PI * 2); c.fill(); // its shadow
        c.translate(bx, by); c.rotate(sp.a); c.scale(sc, sc); valSpear(c, VAL_SPEAR_L);
        c.restore();
    }
    for (const e of enemies) { // the Beastmaster's lash, cracking out across the wedge
        if (e.type !== 'boss_beastmaster' || e.dead || e.lashAt === undefined || e.whipA === undefined || e.lastAtk !== 'whip') continue;
        const q = (fxTime - e.lashAt) / 0.28; if (q < 0 || q > 1) continue;
        const sc = e.size / 26, a = e.whipA, hx = e.x + (Math.cos(a) * 14 - Math.sin(a) * 16) * sc, hy = e.y + (Math.sin(a) * 14 + Math.cos(a) * 16) * sc;
        const L = BEAST_WHIP_REACH * Math.min(1, q * 2.2), curl = (1 - q) * 30, nx = -Math.sin(a), ny = Math.cos(a);
        c.save(); c.lineCap = 'round'; c.strokeStyle = '#1b1210'; c.globalAlpha = Math.min(1, (1 - q) * 3);
        let px = hx, py = hy;
        for (let k = 1; k <= 14; k++) { const u = k / 14, bend = Math.sin(u * Math.PI) * curl * (u < 0.5 ? 1 : -0.6), x = hx + Math.cos(a) * L * u + nx * bend, y = hy + Math.sin(a) * L * u + ny * bend; c.lineWidth = 4 * (1 - u) + 1; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y; }
        if (q < 0.5) { c.globalCompositeOperation = 'lighter'; glow(c, px, py, 26, '#fff3e0', 0.8 * (1 - q * 2)); }
        c.restore();
    }
    for (const ef of effects) {
        if (ef.type === 'torch_arc') {
            const k = 1 - ef.life / ef.maxLife, x = lerp(ef.x0, ef.x, k), y = lerp(ef.y0, ef.y, k), z = Math.sin(Math.PI * k) * 140, a = ef.spin + k * 14;
            c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2); c.fill();
            c.save(); c.translate(x, y - z); c.rotate(a);
            c.strokeStyle = '#4e342e'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-11, 0); c.lineTo(8, 0); c.stroke();
            c.restore();
            const fx = x + Math.cos(a) * 9, fy = y - z + Math.sin(a) * 9;
            c.save(); c.globalCompositeOperation = 'lighter'; glow(c, fx, fy, 34, '#ff8f00', 0.6); c.restore();
            drawFlame(c, fx, fy, 11, fxTime, ef.spin, 1);
            if (Math.random() < 0.6) spawnParticle({ kind: 'dot', color: '#ffb74d', x: fx, y: fy, vx: jitter(30), vy: jitter(30), size: 2, life: 0.4, drag: 1, grow: 0, spin: 0, rot: 0 });
        } else if (ef.type === 'keg_flash') {
            const k = 1 - ef.life / ef.maxLife;
            c.save(); c.globalCompositeOperation = 'lighter';
            glow(c, ef.x, ef.y, 90 + k * 140, '#ffcc80', 0.9 * (1 - k));
            glow(c, ef.x, ef.y, 40 + k * 40, '#ffffff', 0.8 * (1 - k));
            c.restore();
        }
    }
}
