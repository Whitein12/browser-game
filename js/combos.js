// ==========================================
// combos.js - Space → basic finishers
// ==========================================
// A Space dash opens a short window when it lands; the first basic attack inside it becomes the class's finisher.
// main.js castSkill opens it (at once, or when the dash arrives), skills.js castBasic spends it.
// COMBO_FINISHERS[className](dmg, heavy, combo) runs the finisher and returns true if it replaced the basic attack.
// Finishers are a real payoff (~+10-15% damage when you combo on every dash), so tune them with the class.

const COMBO_WINDOW = 0.75;
let comboOpen = null; // { t, x0, y0, x1, y1 }: time left, and the path of the dash that opened it

function hasCombo() { return !!COMBO_FINISHERS[activeClass.name]; }
// path: the dash's start and end (a dash that hasn't moved, or no dash at all, uses where the hero stands)
function openCombo(path) {
    if (!hasCombo()) return;
    comboOpen = Object.assign({ t: COMBO_WINDOW, castAt: comboCastAt, x0: player.x, y0: player.y, x1: player.x, y1: player.y }, path || {});
}
// Only a press made after Space counts: holding LMB through the dash gives a plain attack (playtest: holding the button
// fired every finisher with no skill at all). skills.js castBasic checks it before spending the window.
let lmbPressedAt = -1, comboCastAt = -1; // main.js: the last LMB mousedown, and the last Space cast, in game time
function comboPressOk(c) { return lmbPressedAt >= c.castAt; }
function takeCombo() { const c = comboOpen; comboOpen = null; return c; }
function updateCombo(dt) {
    if (comboOpen && (comboOpen.t -= dt) <= 0) comboOpen = null;
    if (!comboOpen && !comboInFlight()) comboQueued = false;
}
// A Space dash or pull that will open the window is still moving. A basic pressed now waits for the landing (main.js) and
// becomes the finisher: clicking mid-dash is natural, and it used to fire a plain attack too early and lose the combo.
let comboQueued = false;
function comboInFlight() { return !!((player.dash && player.dash.combo) || (player.grappleTarget && player.grappleTarget.combo)); }

// Nightblade, Shadow Daggers: the thrust after Phantom Dash becomes three daggers thrown in a fan toward the cursor, each 2x a
// thrust (a thrust is half a basic). They're Fan of Knives daggers, so they pop a weak point only if they hit its marked
// side (combat.js weakPointDamage): dash out to the right angle, then throw back. Nothing happens on the dash itself.
const DAGGER_COUNT = 3, DAGGER_SPREAD = 0.08, DAGGER_MULT = 2 * 0.5; // a tight fan: a slime at 200 px still takes all three
function shadowDaggers(dmg) {
    const base = Math.atan2(mouseY - player.y, mouseX - player.x);
    effects.push({ type: 'knife_fan', x: player.x, y: player.y, angle: base, life: 0.2, maxLife: 0.2 }); // skillfx.js (Fan of Knives' throw)
    for (let i = 0; i < DAGGER_COUNT; i++) {
        const a = base + (i - (DAGGER_COUNT - 1) / 2) * DAGGER_SPREAD;
        projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, radius: 6, color: '#b388ff', life: 0.8, type: 'fan_of_knives', shape: 'knife',
            damage: dmg * DAGGER_MULT, pierce: false, hitList: [], isEnemy: false, source: 'fan_of_knives' });
    }
    burst(player.x, player.y, base, 0.8, 6, { kind: 'smoke', color: '#4527a0', size: 4, grow: 14, life: 0.35, speed: [60, 160], drag: 4 });
    return true;
}

// Dragonknight, Wyrm Whirl: the swing after Thunder Leap spins all the way round you (the 'sword' basic in skills.js)
const WHIRL_MULT = 2.2, WHIRL_REACH = 20;
// Ranger, Arrow Trail: arrows rain down along the path just vaulted, each a double basic arrow
const TRAIL_ARROWS = 8, TRAIL_MULT = 2.0, TRAIL_HIT = 45;

// Second combos, skill into skill (round two: every class has its finisher, now each gets a second pair)
// Dragonknight, Skyfall Catch (Q → Space): a Thunder Leap that meets its own flying Shield Throw snatches it out of the air
// (main.js shield update; only shields already flying when you leapt, so a Q pressed mid-leap can't catch itself), and the
// landing becomes a slam: x2.5 in 160 px (not x1 in 120) and a 1 s stun, on top of the catch shield. Leap at a moving shield.
// On the way out it runs from the leap (600 px/s), so a leap aimed at it (cursor within 100 px) stops it in mid-air, and it
// drifts to where you land (playtest: "I jump to catch the shield but the jump finishes without a slam").
const SKYFALL_REACH = 30, SKYFALL_MULT = 2.5, SKYFALL_RADIUS = 160, SKYFALL_STUN = 1.0, SKYFALL_AIM = 100, SKYFALL_HOLD = 220;
function skyfallHold(leap) { // skills.js Thunder Leap, right after the leap starts
    for (const p of leap.shields) {
        if (p.returning || Math.hypot(p.x - mouseX, p.y - mouseY) > SKYFALL_AIM || Math.hypot(p.x - leap.x1, p.y - leap.y1) > SKYFALL_HOLD) continue;
        p.hold = leap; p.vx = p.vy = 0;
    }
}
function updateShieldHold(p, dt) { // main.js shield update: it hangs where the leap comes down, then goes home if it wasn't caught
    if (p.hold !== player.dash) { p.hold = null; p.returning = true; p.hitList = []; return; }
    p.life += dt; // its flight time doesn't run out while it waits
    const [dx, dy, d] = getVector(p.x, p.y, p.hold.x1, p.hold.y1), m = Math.min(d, 700 * dt);
    if (d > 0.5) { p.x += dx / d * m; p.y += dy / d * m; }
}

// Dragonknight, Rebound (Q → E → held LMB; the user's design): a full Dragonfire slam that meets the returning Shield Throw
// inside its reach and arc bats it back out, burning and faster: it ricochets between enemies for 4 hits (off a lone boss it
// glances away and comes back), then flies home as usual. Strict timing: the shield crosses the slam's 200 px reach in ~0.2 s,
// so you hold a full charge and release as it comes in (the slam waits for the release). The 'sword' basic calls batShield.
const BAT_HITS = 4, BAT_MULT = 1, BAT_SPEED = 1100, BAT_AWAY = 0.12, BAT_SEEK = 450, BAT_MARGIN = 0.25;
function batShield(angle, reach, half, burn) {
    let batted = false;
    for (const p of projectiles) {
        if (p.type !== 'shield_throw' || !p.returning || p.batted) continue;
        const d = Math.hypot(p.x - player.x, p.y - player.y), diff = Math.atan2(p.y - player.y, p.x - player.x) - angle;
        if (d > reach + p.radius || Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) > half + BAT_MARGIN) continue;
        p.returning = false; p.hitList = []; p.hold = null;
        p.batted = { hits: BAT_HITS, away: BAT_AWAY, target: null, last: null, burn };
        p.vx = Math.cos(angle) * BAT_SPEED; p.vy = Math.sin(angle) * BAT_SPEED; // out along the swing first, then it seeks
        effects.push({ type: 'shield_blast', x: p.x, y: p.y, radius: 60, life: 0.3, maxLife: 0.3 });
        burst(p.x, p.y, angle, 1.2, 12, { kind: 'spark', color: '#ffab40', size: 2.5, life: 0.35, speed: [200, 500], drag: 5 });
        batted = true;
    }
    if (batted) { comboText(); addShake(3); }
}
function batTarget(p, last) { // the nearest enemy that isn't the one it just glanced off; a lone one gets hit again
    let best = null, bd = BAT_SEEK;
    for (const e of enemies) {
        if (e.dead || e.pod || e.submerged || e === last || (e.spawnT > 0)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; }
    }
    return best || (last && !last.dead && Math.hypot(last.x - p.x, last.y - p.y) < BAT_SEEK ? last : null);
}
// main.js shield update: steers and hits for itself while batted (true = skip the usual shield hits this frame)
function updateBattedShield(p, dt) {
    const b = p.batted;
    if (p.x <= currentMap.left + 20 || p.x >= currentMap.right - 20 || p.y <= currentMap.top + 20 || p.y >= currentMap.bottom - 20) b.hits = 0; // the map edge ends the round
    if (p.returning || b.hits <= 0) { p.batted = null; p.returning = true; p.hitList = []; return false; } // spent, or a wall sent it home
    p.life = Math.max(p.life, 1.5);
    if ((b.away -= dt) <= 0) {
        if (!b.target || b.target.dead) b.target = batTarget(p, b.last);
        if (!b.target) { b.hits = 0; return true; } // nothing left in reach: home
        const a = Math.atan2(b.target.y - p.y, b.target.x - p.x); p.vx = Math.cos(a) * BAT_SPEED; p.vy = Math.sin(a) * BAT_SPEED;
    }
    for (const e of enemies) {
        if (e.dead || e.pod || e.submerged || (e === b.last && b.away > 0) || Math.hypot(e.x - p.x, e.y - p.y) > e.size / 2 + p.radius) continue;
        applyDamage(e, p.damage * BAT_MULT, 'melee');
        if (!e.dead) igniteEnemy(e, b.burn);
        burst(p.x, p.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ff7043', size: 2.5, life: 0.3, speed: [150, 380], drag: 5 });
        addShake(1.5);
        b.hits--; b.last = e; b.target = null; b.away = BAT_AWAY;
        const a = Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - 0.5) * 1.2; // glances off
        p.vx = Math.cos(a) * BAT_SPEED; p.vy = Math.sin(a) * BAT_SPEED;
        break;
    }
    return true;
}
// Ranger, Skyline Shot (Space → Q): Q pressed during Vault, or in the window after it, looses Storm Arrow fully drawn at once,
// x1.25 (skills.js). It spends the window: Arrow Trail for a pack you jumped over, or Skyline for a line from the air, never both.
const SKYLINE_MULT = 1.25;

// Dragonknight, Wyrmfall (Space → R, mid-leap only): Dragon Breath cast in the air is breathed straight down when Thunder Leap
// lands: a column of fire slams onto the knight, then 3 rings of fire roll out over the ground 0.35 s apart (300 px, each hits
// an enemy once as it passes: x0.45 and the breath's burn), and the ground burns 140 px wide for 3 s (x0.3/s). All round
// rather than a cone, so a pack around you takes more and a boss far less: a choice. Frost breath slows instead of burning
// the ground; Sundering Breath Sunders all round. Wyrm Whirl still follows. (First a spinning head breathing a spiral: "goofy".)
const WYRMFALL_RINGS = 3, WYRMFALL_GAP = 0.35, WYRMFALL_RING_TIME = 0.45, WYRMFALL_MULT = 0.45, WYRMFALL_GROUND = 140, WYRMFALL_BURN = 0.3, WYRMFALL_TIME = 3, WYRMFALL_REACH = 300;
function wyrmfall(sk, dmg, breath, color) { // skills.js Thunder Leap's landing runs it
    const x = player.x, y = player.y, frost = breath === 'frost';
    effects.push({ type: 'wyrmfall_pillar', x, y, frost, life: 0.4, maxLife: 0.4 }); // skillfx_ult.js
    if (!frost) effects.push({ type: 'fire_puddle', x, y, radius: WYRMFALL_GROUND, scorch: true, life: WYRMFALL_TIME, maxLife: WYRMFALL_TIME, dmg: dmg * WYRMFALL_BURN }); // main.js burns what stands in it
    effects.push({ type: 'breath_scorch', x, y, radius: WYRMFALL_GROUND + 10, breath, life: WYRMFALL_TIME + 0.5, maxLife: WYRMFALL_TIME + 0.5 }); // skillfx_ult.js: the ground it was breathed onto
    for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 80; effects.push({ type: 'breath_scorch', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, radius: 28 + Math.random() * 18, breath, life: WYRMFALL_TIME, maxLife: WYRMFALL_TIME }); }
    addShake(3.5);
    for (let r = 0; r < WYRMFALL_RINGS; r++) after(r * WYRMFALL_GAP, () => effects.push({ type: 'wyrmfall_ring', x, y, radius: WYRMFALL_REACH, frost, hit: [], life: WYRMFALL_RING_TIME, maxLife: WYRMFALL_RING_TIME,
        customUpdate: (dt, ef) => { // the ring's front hits what it passes, once
            const R = WYRMFALL_REACH * easeOut(1 - ef.life / ef.maxLife); // the same front the ring is drawn at
            for (const e of enemies) {
                if (e.dead || e.pod || e.submerged || ef.hit.includes(e) || Math.hypot(e.x - x, e.y - y) - e.size / 2 > R) continue;
                ef.hit.push(e);
                applyDamage(e, dmg * WYRMFALL_MULT, 'magic');
                if (e.dead) continue;
                if (frost) { e.slowTimer = 3.0; e.slowAmount = 0.7; }
                else { e.burnTimer = 3.0; e.burnDps = dmg * 0.2; e.burnColor = color; if (breath === 'shatter') sunderEnemy(e); } // the breath's own burn (main.js); Sundering Breath (skills.js)
            }
        } }));
}

// Ranger, Volley combos: Volley's arrows are loosed skyward for 0.3 s, then fall (each lands 0.45-0.8 s after the cast).
// A combo changes only the arrows still coming down, so the earlier in that window, the more arrows it catches.
// Volley is ~23% of the Ranger's damage (in-engine, late), so each adds ~+5% used on every Volley, ~+11% both at once.
// Gale Volley (R → E): Nature's Stride cast while they fall: the gust drives each one in again 0.3 s after it lands, for a
// quarter of what it dealt. Thunderstorm (R → Q): a fully drawn Storm Arrow whose line crosses the circle while they fall:
// every arrow still coming down is a lightning bolt, x1.2 and a 0.5 s stun on non-bosses. Draw, cast R, release on time
// (playtest: a tapped arrow into the rain took no skill); a Skyline Shot counts, it's fully drawn. Both on one Volley stack.
const VOLLEY_DOWN = 0.3, GALE_DELAY = 0.3, GALE_MULT = 0.25, THUNDERSTORM_MULT = 1.2, THUNDERSTORM_STUN = 0.5;
function fallingVolleys() { // skills.js Volley's rain effects with arrows still in the air
    return effects.filter(ef => ef.volley && fxTime - ef.castAt >= VOLLEY_DOWN && ef.arrows.some(a => fxTime - ef.castAt < a.t));
}
function galeVolley() { // skills.js Nature's Stride
    let n = 0;
    for (const ef of fallingVolleys()) {
        if (ef.gale) continue;
        ef.gale = true; n++;
        const left = Math.max(...ef.arrows.map(a => a.t)) - (fxTime - ef.castAt) + GALE_DELAY + 0.2; // until the last second strike
        effects.push({ type: 'gale_gust', x: ef.x, y: ef.y, radius: ef.radius, life: left, maxLife: left }); // skillfx_ult.js: wind ribbons whirl round it
        const a = Math.atan2(ef.y - player.y, ef.x - player.x); // (a line from the Ranger to the circle was cut after the playtest)
        burst(player.x, player.y, a, 0.5, 12, { kind: 'dot', color: '#f1f8e9', size: 2.5, life: 0.5, speed: [400, 750], drag: 2 }); // wind motes
        burst(ef.x, ef.y, 0, Math.PI * 2, 16, { kind: 'dot', color: '#e8f5e9', size: 2.5, life: 0.7, speed: [120, 300], drag: 2 });
    }
    if (n) { comboText(); addShake(1.5); }
}
function thunderstormVolley(x1, y1, x2, y2) { // skills.js Storm Arrow, with its line
    let n = 0;
    for (const ef of fallingVolleys()) {
        if (ef.storm || distToSegment(ef.x, ef.y, x1, y1, x2, y2) > ef.radius) continue;
        ef.storm = true; n++;
        effects.push({ type: 'circle_burst', x: ef.x, y: ef.y, radius: ef.radius, color: 'rgba(128, 216, 255, 0.6)', life: 0.35, maxLife: 0.35 });
        for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; effects.push({ type: 'lightning', x1: ef.x, y1: ef.y, x2: ef.x + Math.cos(a) * ef.radius, y2: ef.y + Math.sin(a) * ef.radius, color: '#80d8ff', life: 0.25, maxLife: 0.25 }); }
    }
    if (n) { comboText(); addShake(2); }
}
function thunderstormFx(x, y) { // an arrow that comes down as lightning, leaning the way the arrows fall
    effects.push({ type: 'lightning', x1: x + 30, y1: y - 200, x2: x, y2: y, color: '#80d8ff', life: 0.22, maxLife: 0.22 });
    effects.push({ type: 'circle_burst', x, y, radius: 30, color: 'rgba(179, 229, 252, 0.8)', life: 0.2, maxLife: 0.2 });
    burst(x, y, 0, Math.PI * 2, 6, { kind: 'spark', color: '#e1f5fe', size: 2, life: 0.25, speed: [120, 300], drag: 5 });
}
function galeStrikeFx(x, y, rain) { // the gust drives a landed arrow in again: a white streak down, a ring of wind, another arrow stuck
    effects.push({ type: 'flash_line', x1: x + 30, y1: y - 170, x2: x, y2: y, color: '#ffffff', lineWidth: 4, life: 0.18, maxLife: 0.18 });
    effects.push({ type: 'circle_burst', x, y, radius: 34, color: 'rgba(224, 242, 241, 0.85)', life: 0.25, maxLife: 0.25 });
    arrowImpactFx(x, y, false); // skillfx_ult.js
    burst(x, y, 0, Math.PI * 2, 8, { kind: 'dot', color: '#f1f8e9', size: 2.2, life: 0.4, speed: [120, 280], drag: 4 });
    rain.arrows.push({ x, y, t: fxTime - rain.castAt }); // skillfx_ult.js draws it stuck beside the first
}

// Spellweaver, Frostfire (R → E): Frost Nova cast within 0.25 s of your Meteor landing (before or after), with the impact inside
// the Nova's 180 px, turns the impact to frostfire: x0.3 more of the Meteor's damage to everything in the blast and a 1 s freeze
// (bosses shake it off 3x as fast, combat.js). Timing and risk: you stand at your own impact. The Spellweaver is at the top,
// so the gain is small; the freeze is the prize.
const FROSTFIRE_WINDOW = 0.25, FROSTFIRE_MULT = 0.3, FROSTFIRE_FREEZE = 1.0, FROSTFIRE_REACH = 180;
let meteors = []; // { x, y, at, radius, dmg, landed, frost }: Meteors falling or just landed
function trackMeteor(x, y, at, radius, dmg) { // skills.js Meteor, when cast
    meteors = meteors.filter(m => m.at - fxTime > -FROSTFIRE_WINDOW && m.at - fxTime < 5);
    const m = { x, y, at, radius, dmg, landed: false, frost: false };
    meteors.push(m);
    return m;
}
function meteorLanded(m) { m.landed = true; if (m.frost) frostfire(m); } // skills.js Meteor, at the impact
function frostfireNova() { // skills.js Frost Nova
    for (const m of meteors) {
        if (m.frost || Math.abs(fxTime - m.at) > FROSTFIRE_WINDOW || Math.hypot(m.x - player.x, m.y - player.y) > FROSTFIRE_REACH) continue;
        m.frost = true;
        if (m.landed) frostfire(m); // a beat late: it still catches the blast
    }
}
function frostfire(m) {
    effects.push({ type: 'random_ice_spikes', x: m.x, y: m.y, radius: m.radius, color: '#b3e5fc', life: 0.7, maxLife: 0.7,
        spikes: Array.from({ length: 18 }, () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * m.radius; return { xOffset: Math.cos(a) * r, yOffset: Math.sin(a) * r, size: 12 + Math.random() * 16 }; }) }); // skillfx_e.js
    effects.push({ type: 'circle_burst', x: m.x, y: m.y, radius: m.radius, color: 'rgba(179, 229, 252, 0.8)', life: 0.4, maxLife: 0.4 });
    burst(m.x, m.y, 0, Math.PI * 2, 16, { kind: 'smoke', color: '#eceff1', size: 9, grow: 34, life: 0.8, speed: [60, 200], drag: 3 }); // steam
    burst(m.x, m.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#e1f5fe', size: 2.5, life: 0.4, speed: [180, 420], drag: 5 });
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - m.x, e.y - m.y) > m.radius + e.size / 2) continue;
        applyDamage(e, m.dmg * FROSTFIRE_MULT, 'magic');
        if (!e.dead) e.frozenTimer = Math.max(e.frozenTimer || 0, FROSTFIRE_FREEZE);
    }
    comboText(); addShake(3);
}

// Spellweaver, Ice Wall (RMB → E; the user's pick, on the rare weapon's Arcane Beam so the Archmagus Staff unlocks it):
// Frost Nova cast within 0.75 s of the beam freezes the beam's line into a wall of ice for 3 s. Enemies can't walk through
// it (the hero can) and touching it chills them; enemy shots shatter on it, but 12 of them break it (a bullet hell gets a
// moment's cover, not 3 s of it); a boss smashes straight through and ends it, so it can't break their attack patterns.
// Utility, no damage: blink or beam across a pack's path, then Nova, and they're walled off.
const ICE_WALL_WINDOW = 0.75, ICE_WALL_TIME = 3, ICE_WALL_THICK = 26, ICE_WALL_HP = 12, ICE_WALL_GROW = 0.25;
let arcaneBeamLine = null; // the last Arcane Beam: { x1, y1, x2, y2, at }
function beamCast(x1, y1, x2, y2) { arcaneBeamLine = { x1, y1, x2, y2, at: fxTime }; } // skills.js Spellweaver RMB
function iceWallNova() { // skills.js Frost Nova
    const b = arcaneBeamLine;
    if (!b || fxTime - b.at > ICE_WALL_WINDOW || fxTime < b.at) return;
    arcaneBeamLine = null;
    const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), n = Math.max(2, Math.floor(L / 17));
    const crystals = Array.from({ length: n }, (_, i) => ({ t: (i + 0.5) / n, off: jitter(5), size: 11 + Math.random() * 8, rot: Math.random() * Math.PI, sides: 5 + (i % 2) }));
    effects.push({ type: 'ice_wall', x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, crystals, hp: ICE_WALL_HP, life: ICE_WALL_TIME, maxLife: ICE_WALL_TIME, customUpdate: updateIceWall }); // skillfx_e.js
    comboText(); addShake(2);
}
function updateIceWall(dt, ef) { // main.js effect loop
    if (ef.life <= 0.3) return; // cracking apart: it no longer holds anything
    const reach = Math.min(1, (ef.maxLife - ef.life) / ICE_WALL_GROW); // it grows out from the staff
    const x2 = lerp(ef.x1, ef.x2, reach), y2 = lerp(ef.y1, ef.y2, reach), dx = x2 - ef.x1, dy = y2 - ef.y1, L2 = dx * dx + dy * dy || 1;
    for (const e of enemies) {
        if (e.dead || e.pod || e.submerged || e.airborne || e.flyUntil > fxTime || e.spawnT > 0) continue;
        const t = Math.max(0, Math.min(1, ((e.x - ef.x1) * dx + (e.y - ef.y1) * dy) / L2)), nx = ef.x1 + dx * t, ny = ef.y1 + dy * t;
        const d = Math.hypot(e.x - nx, e.y - ny), min = ICE_WALL_THICK / 2 + e.size / 2;
        if (d >= min) continue;
        if (isBossE(e)) { ef.life = 0.3; burst(nx, ny, 0, Math.PI * 2, 16, { kind: 'spark', color: '#e1f5fe', size: 3, life: 0.5, speed: [150, 400], drag: 4 }); addShake(2); return; } // smashed through
        const side = d > 0.5 ? null : ((e.x - ef.x1) * dy - (e.y - ef.y1) * dx >= 0 ? 1 : -1);
        const ux = side === null ? (e.x - nx) / d : -dy / Math.sqrt(L2) * side, uy = side === null ? (e.y - ny) / d : dx / Math.sqrt(L2) * side;
        e.x = nx + ux * min; e.y = ny + uy * min; // held on its own side
        e.slowTimer = Math.max(e.slowTimer || 0, 1.0); e.slowAmount = Math.max(e.slowAmount || 0, 0.6); // the ice bites
    }
    for (const p of projectiles) {
        if (!p.isEnemy || p.life <= 0 || distToSegment(p.x, p.y, ef.x1, ef.y1, x2, y2) > ICE_WALL_THICK / 2 + (p.radius || 4)) continue;
        p.life = 0;
        burst(p.x, p.y, 0, Math.PI * 2, 4, { kind: 'spark', color: '#b3e5fc', size: 2, life: 0.25, speed: [80, 200], drag: 5 });
        if (--ef.hp <= 0) { ef.life = 0.3; addShake(1.5); return; } // too many shots: it cracks apart
    }
}

// Machinist, round two (the user's picks; "not really comboable skills" otherwise). Turrets and coils stand still while
// bosses move, so two of these make a deployable follow or reach further:
// Tesla Turret (Q + E): a Tesla Coil placed within 60 px of a turret, either order, electrifies it while the coil lasts:
//   its shots hit x1.15 and arc on to one more enemy within 250 px of the target for half a shot.
// Conductive Net (RMB → E): a coil thrown within 80 px of an enemy your Net Shot hit in the last 1.5 s latches onto the net and rides on that
//   enemy for the rest of its life (bosses too), pulsing round it; if the enemy dies, it stays where it fell.
// Lightning Rod (E → R): Overclock cast standing inside your own coil's field absorbs the coil (it's gone): until Overclock
//   ends, every scattergun blast also throws chain lightning at the nearest enemy ahead (350 px), x0.6 a basic, jumping
//   to 2 more. Roughly even with the coil's lost pulses on a lone boss, clearly better on a pack.
const TESLA_LINK = 60, TESLA_MULT = 1.15, TESLA_CHAIN = 0.5, TESLA_CHAIN_RANGE = 250, NET_LATCH = 80, NET_WINDOW = 1.5;
const ROD_MULT = 0.6, ROD_JUMPS = 2, ROD_RANGE = 350, ROD_JUMP_RANGE = 200, ROD_CONE = 0.6;
function liveCoil(c) { return !!c && c.life > 0 && projectiles.includes(c); }
function teslaLinkFx(t, c) {
    effects.push({ type: 'lightning', x1: c.x, y1: c.y, x2: t.x, y2: t.y, color: '#84ffff', life: 0.3, maxLife: 0.3 });
    burst(t.x, t.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#84ffff', size: 2.2, life: 0.3, speed: [100, 260], drag: 5 });
}
function coilPlaced(c) { // skills.js Tesla Coil, right after it lands
    let rider = null, best = Infinity;
    for (const e of enemies) {
        if (e.dead || !(fxTime - (e.nettedAt ?? -99) < NET_WINDOW)) continue; // not netTimer: a boss shakes the net off 3x as fast
        const d = Math.hypot(e.x - c.x, e.y - c.y) - e.size / 2;
        if (d < NET_LATCH && d < best) { best = d; rider = e; }
    }
    if (rider) { // Conductive Net
        c.rider = rider; c.x = rider.x; c.y = rider.y;
        effects.push({ type: 'circle_burst', x: c.x, y: c.y, radius: rider.size / 2 + 30, color: 'rgba(132, 255, 255, 0.7)', life: 0.35, maxLife: 0.35 });
        comboText(); return;
    }
    let linked = false;
    for (const t of projectiles) if (t.type === 'turret' && Math.hypot(t.x - c.x, t.y - c.y) < TESLA_LINK + t.radius) { t.tesla = c; teslaLinkFx(t, c); linked = true; }
    if (linked) comboText();
}
function turretPlaced(t) { // skills.js spawnTurret
    const c = projectiles.find(p => p.type === 'tesla_coil_trap' && p.life > 0 && !p.rider && Math.hypot(p.x - t.x, p.y - t.y) < TESLA_LINK + t.radius);
    if (c) { t.tesla = c; teslaLinkFx(t, c); comboText(); }
}
function rideCoil(c) { // the coil's update: it rides the netted enemy
    if (!c.rider) return;
    if (c.rider.dead) { c.rider = null; return; }
    c.x = c.rider.x; c.y = c.rider.y;
}
// A turret shot (skills.js spawnTurret): the multiplier for it, and the arc on to the next enemy once it lands
function teslaShot(t, target, delay) {
    if (!t.tesla) return 1;
    if (!liveCoil(t.tesla)) { t.tesla = null; return 1; }
    const dmg = t.damage * TESLA_CHAIN;
    after(delay, () => {
        if (target.dead && !enemies.includes(target)) return;
        let next = null, bd = TESLA_CHAIN_RANGE;
        for (const e of enemies) {
            if (e === target || e.dead || e.pod || e.submerged) continue;
            const d = Math.hypot(e.x - target.x, e.y - target.y); if (d < bd) { bd = d; next = e; }
        }
        if (!next) return;
        effects.push({ type: 'lightning', x1: target.x, y1: target.y, x2: next.x, y2: next.y, color: '#84ffff', life: 0.18, maxLife: 0.18 });
        applyDamage(next, dmg, 'magic'); next.shockTimer = 0.6;
    });
    return TESLA_MULT;
}
function teslaCrackle(t, dt) { // the link shows: a small arc between the turret and its coil now and then
    if (!t.tesla) return;
    if (!liveCoil(t.tesla)) { t.tesla = null; return; }
    if ((t.crackleT = (t.crackleT || 0) - dt) <= 0) { t.crackleT = 0.25 + Math.random() * 0.2; effects.push({ type: 'lightning', x1: t.tesla.x, y1: t.tesla.y, x2: t.x, y2: t.y, color: '#84ffff', life: 0.12, maxLife: 0.12 }); }
}
function lightningRod() { // skills.js Overclock
    const c = projectiles.find(p => p.type === 'tesla_coil_trap' && p.life > 0 && Math.hypot(p.x - player.x, p.y - player.y) < (p.fieldRadius || 150));
    if (!c) return;
    for (let i = 0; i < 3; i++) effects.push({ type: 'lightning', x1: c.x, y1: c.y, x2: player.x + jitter(10), y2: player.y + jitter(10), color: '#e0f7fa', life: 0.35, maxLife: 0.35 });
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 60, color: 'rgba(132, 255, 255, 0.8)', life: 0.35, maxLife: 0.35 });
    c.life = 0; c.rider = null; // absorbed
    buffs.lightningRod = true;
    comboText(); addShake(2.5);
}
function rodBlast(dmg, angle) { // skills.js scattergun, after each blast
    if (!buffs.lightningRod) return;
    if (!(buffs.overclockTimer > 0)) { buffs.lightningRod = false; return; }
    let from = { x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20 }, target = null, bd = ROD_RANGE;
    for (const e of enemies) { // the first: the nearest enemy ahead
        if (e.dead || e.pod || e.submerged) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y), diff = Math.atan2(e.y - player.y, e.x - player.x) - angle;
        if (d - e.size / 2 < bd && Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) < ROD_CONE) { bd = d - e.size / 2; target = e; }
    }
    const hit = [];
    for (let j = 0; target && j <= ROD_JUMPS; j++) {
        effects.push({ type: 'lightning', x1: from.x, y1: from.y, x2: target.x, y2: target.y, color: '#84ffff', life: 0.15, maxLife: 0.15 });
        applyDamage(target, dmg * ROD_MULT, 'magic'); target.shockTimer = 0.6; hit.push(target);
        from = target; target = null; let nd = ROD_JUMP_RANGE;
        for (const e of enemies) {
            if (e.dead || e.pod || e.submerged || hit.includes(e)) continue;
            const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < nd) { nd = d; target = e; }
        }
    }
}

// Cleric, round two (the user's picks: Prism, Sanctified Arrival, Twilight Eclipse; Ascendant Descent was passed over):
// Prism (E → Q): Divine Ray crossing your own Hallowed Ground refracts where it leaves the zone: two beams fan out from that
//   point, ±30° off the ray, 450 px, half a tick each (Holy beams blind, Shadow beams slow, like their rays). They start at the
//   far edge, not the centre, so a boss standing in the zone doesn't simply take double. Available from the first level.
// Sanctified Arrival (E → Space): Phase Shift landing inside your own Hallowed Ground makes it erupt, once per zone. Holy (and
//   the plain zone): heals 10% max HP and throws non-bosses out of it. Shadow (Desecration): a nova for x2 the zone's tick
//   that blinds for 1 s.
// Twilight Eclipse (RMB → Q): enemies Twilight Repulse stunned take x1.5 from Divine Ray for 1.6 s, so a ray cast right
//   after it is eclipsed for its whole 1.5 s channel (the 1 s stun alone covered two thirds of it, ~+19%). Bosses aren't
//   stunned by the Repulse, so they don't count.
const PRISM_SPREAD = Math.PI / 6, PRISM_MULT = 0.5, PRISM_LENGTH = 450, ARRIVAL_HEAL = 0.1, ARRIVAL_NOVA = 2, ECLIPSE_MULT = 1.5, ECLIPSE_TIME = 1.6;
function prismTick(angle, length, width, tickDmg, color, ray) { // skills.js Divine Ray, every tick (color: the ray's)
    const ux = Math.cos(angle), uy = Math.sin(angle), shadow = color === '#9c27b0';
    ray.beams = ray.beams || new Map();
    for (const z of projectiles) {
        if (z.type !== 'hallowed_ground' || z.life <= 0) continue;
        const t = (z.x - player.x) * ux + (z.y - player.y) * uy, d = Math.abs((z.x - player.x) * uy - (z.y - player.y) * ux);
        if (t < 0 || d > z.radius) continue;
        const tExit = t + Math.sqrt(z.radius * z.radius - d * d);
        if (tExit > length) continue;
        const ex = player.x + ux * tExit, ey = player.y + uy * tExit;
        for (const side of [-1, 1]) {
            const a = angle + side * PRISM_SPREAD, x2 = ex + Math.cos(a) * PRISM_LENGTH, y2 = ey + Math.sin(a) * PRISM_LENGTH;
            const key = z.x + ',' + z.y + side; let beam = ray.beams.get(key); // a smaller copy of the ray itself (skillfx.js drawDivineRay), kept alive while the ray crosses the zone
            if (!beam || beam.life <= 0) { beam = { type: 'divine_ray_channel', length: PRISM_LENGTH, width: width * 0.6, color, life: 0.3, maxLife: 0.42 }; ray.beams.set(key, beam); effects.push(beam); }
            Object.assign(beam, { x: ex, y: ey, angle: a, life: 0.3 });
            for (const e of enemies) {
                if (e.dead || e.pod || e.submerged || distToSegment(e.x, e.y, ex, ey, x2, y2) > width / 2 + e.size / 2) continue;
                applyDamage(e, tickDmg * PRISM_MULT, 'magic');
                if (e.dead) continue;
                if (shadow) { e.slowTimer = Math.max(e.slowTimer || 0, 0.6); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); } else e.blindTimer = Math.max(e.blindTimer || 0, 1.0);
            }
        }
        if (Math.random() < 0.5) effects.push({ type: 'sparkle_poof', x: ex, y: ey, color: shadow ? '#ce93d8' : '#fff59d' }); // the refraction point
        if (!ray.prism) { ray.prism = true; comboText(); }
    }
}
function sanctifiedArrival() { // skills.js Phase Shift, after the blink
    const z = projectiles.find(p => p.type === 'hallowed_ground' && p.life > 0 && !p.erupted && Math.hypot(player.x - p.x, player.y - p.y) <= p.radius);
    if (!z) return;
    z.erupted = true;
    if (z.isShadow) {
        effects.push({ type: 'holy_nova', x: z.x, y: z.y, radius: z.radius, color: '#ce93d8', life: 0.5, maxLife: 0.5 });
        burst(z.x, z.y, 0, Math.PI * 2, 18, { kind: 'smoke', color: '#4a148c', size: 7, grow: 30, life: 0.6, speed: [80, 220], drag: 3 });
        for (const e of enemies) {
            if (e.dead || e.pod || Math.hypot(e.x - z.x, e.y - z.y) > z.radius + e.size / 2) continue;
            applyDamage(e, (z.zoneDmg || 0) * 1.4 * ARRIVAL_NOVA, 'magic'); // x2 a Desecration tick
            if (!e.dead) e.blindTimer = Math.max(e.blindTimer || 0, 1.0);
        }
    } else {
        const heal = player.maxHp * ARRIVAL_HEAL;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        effects.push({ type: 'text', text: '+' + Math.round(heal), x: player.x, y: player.y - 30, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
        effects.push({ type: 'holy_nova', x: z.x, y: z.y, radius: z.radius, life: 0.5, maxLife: 0.5 });
        burst(player.x, player.y, 0, Math.PI * 2, 16, { kind: 'dot', color: '#fff8e1', size: 2.5, life: 0.6, speed: [120, 300], drag: 3 });
        for (const e of enemies) { // thrown out of the holy ground
            if (e.dead || e.pod || isBossE(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.radius + e.size / 2) continue;
            const [dx, dy, d] = getVector(z.x, z.y, e.x, e.y), to = z.radius + e.size / 2 + 20;
            if (d > 0) { e.x = z.x + dx / d * to; e.y = z.y + dy / d * to; clampToBounds(e, e.size / 2); }
        }
        updateHUD();
    }
    comboText(); addShake(2.5);
}
function eclipseMult(e, ray) { // skills.js Divine Ray, per enemy per tick
    if (!(e.eclipseUntil > fxTime)) return 1;
    if (!ray.eclipse) { ray.eclipse = true; comboText(); }
    if (Math.random() < 0.3) effects.push({ type: 'sparkle_poof', x: e.x, y: e.y, color: '#ffb300' });
    return ECLIPSE_MULT;
}

// Nightblade and Kensei, round two: both already ask a lot of skill, so these deepen what's there instead of adding a layer.
// Nightblade, Shadow Strike (R + Space): while Mark for Death runs, a Phantom Dash straight through the marked target is an
//   extra clone strike (x0.6 the Mark from a fresh weak side, facing where you came from, so it always pops), up to twice
//   per Mark. You weave your own strikes between the clones', and you pass through the boss to do it.
// Nightblade, Smoke Step (E → Space): a Phantom Dash that starts inside your Smoke Bomb carries the cloud to where you land.
//   Swarm survival, no damage: the boss-killer stays a boss-killer.
const SHADOW_STRIKES = 2, SMOKE_GLIDE = 1400;
function shadowStrike(e, angle) { // skills.js Phantom Dash, for each enemy it cuts
    if (!(buffs.deathMarkActive > 0) || e !== buffs.markTarget || e.dead || (buffs.shadowStrikes || 0) >= SHADOW_STRIKES) return;
    buffs.shadowStrikes = (buffs.shadowStrikes || 0) + 1;
    e.markAngle = angle + Math.PI; // a fresh weak side, facing the way you came in (combat.js weakPointDamage)
    effects.push({ type: 'death_mark_wave', x: e.x, y: e.y, radius: e.size / 2 + 50, life: 0.45, maxLife: 0.45 }); // skillfx_ult.js
    effects.push({ type: 'shadow_cut', x: e.x, y: e.y, angle, radius: e.size * 0.6 + 30, life: 0.35, maxLife: 0.35 });
    if (activeClass.skills[4].selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02); // Bloodlust, as a clone's strike
    applyDamage(e, buffs.markDmg * MFD_MULT, 'death_mark', angle);
    comboText();
}
function smokeStepStart() { // skills.js Phantom Dash, at the cast: the Smoke Bomb you're standing in
    return effects.find(ef => ef.type === 'smoke_bomb' && ef.life > 0 && Math.hypot(player.x - ef.x, player.y - ef.y) <= ef.radius) || null;
}
function smokeStep(smoke) { // and at the landing: the cloud follows
    if (!smoke || smoke.life <= 0) return;
    smoke.glideX = player.x; smoke.glideY = player.y;
    smoke.customUpdate = (dt, ef) => {
        const [dx, dy, d] = getVector(ef.x, ef.y, ef.glideX, ef.glideY), m = Math.min(d, SMOKE_GLIDE * dt);
        if (d > 0.5) { ef.x += dx / d * m; ef.y += dy / d * m; if (Math.random() < 0.6) burst(ef.x, ef.y, Math.atan2(dy, dx) + Math.PI, 1.2, 1, { kind: 'smoke', color: '#424242', size: 8, grow: 30, life: 0.5, speed: [20, 60], drag: 3 }); }
    };
    comboText();
}

// Kensei, Counter Step (parry → Space → LMB; it was going to be "Riposte Step", but the E evolution is Riposte Recall):
//   a successful parry readies Shadow Step at once, and a Shadow Step within 1.5 s makes its Iaido cut x1.5.
// Kensei, Return Cut (Airborne E, the recall): the blade cuts back through everything between it and you, for x3 a
//   basic times the Flow the recall spends (nothing at empty, full at 100). Riposte Recall (E-A) cuts as if Flow were full
//   and keeps 30%. (Riposte Recall used to be the only recall that cut, a flat x2 basic.)
// Kensei, Whirling Orbit (Guardian Orbit → Q): Q during the orbit spins it twice as fast for the rest of it (twice the cuts),
//   and 0.3 s longer, instead of Blade Surge, so press it early. The user's idea. Measured on a boss: a Blade Surge 264; the
//   whirl adds about as much (+0.6 s made it ~+70% more than a Surge, no extension ~30% less).
// Kensei, Gale Orbit (Guardian Orbit → RMB): Phantom Wind during the orbit flings it wide: the circle grows to 250 px for
//   the rest of the orbit and cuts a ring, not the disc (the user's pick over Hammer & Anvil and Wind Step).
const COUNTER_WINDOW = 1.5, COUNTER_IAIDO = 1.5, RETURN_MULT = 3, WHIRL_ORBIT_SPIN = 2, WHIRL_ORBIT_EXTRA = 0.3, GALE_ORBIT_RADIUS = 250, GALE_ORBIT_GROW = 900;
function counterParry() { // combat.js takeDamage, on a parry
    if (activeClass.name !== 'Kensei' || player.stance !== 'handheld' || !(activeClass.skills[3].level > 0)) return;
    cooldowns.s3 = 0; buffs.counterUntil = fxTime + COUNTER_WINDOW;
    effects.push({ type: 'text', text: 'COUNTER', x: player.x, y: player.y - 52, color: '#84ffff', life: 0.7, maxLife: 0.7 });
}
function counterStep() { // skills.js Shadow Step: was it a counter?
    const counter = buffs.counterUntil > fxTime;
    buffs.counterUntil = 0; buffs.counterIaido = counter;
    if (counter) comboText();
}
function returnCut(x, y, k) { // skills.js Recall, before the blade is back in hand
    if (k < 0.05) return;
    const cut = calcDmg(activeClass.basicDmg) * RETURN_MULT * k, ang = Math.atan2(player.y - y, player.x - x);
    let n = 0;
    for (const e of enemies) {
        if (e.dead || e.pod || e.submerged || distToSegment(e.x, e.y, x, y, player.x, player.y) > e.size / 2 + 30) continue;
        applyDamage(e, cut, 'slash', ang); n++;
        effects.push({ type: 'slash', x: e.x, y: e.y, angle: ang, color: '#e0f7fa', life: 0.2, maxLife: 0.2, radius: e.size / 2 + 30 });
    }
    effects.push({ type: 'iai_flash', x1: x, y1: y, x2: player.x, y2: player.y, big: k > 0.5, life: 0.4, maxLife: 0.4 }); // skillfx_space.js
    if (n) { comboText(); addShake(1 + 2 * k); }
}
function whirlOrbit(ab) { // skills.js airborne Q, during Guardian Orbit
    if (ab.orbit.whirl) return false;
    ab.orbit.whirl = true; ab.orbit.extra = WHIRL_ORBIT_EXTRA;
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: (ab.orbit.r || ORBIT_RADIUS) + ORBIT_REACH, color: 'rgba(132, 255, 255, 0.6)', life: 0.3, maxLife: 0.3 });
    comboText();
    return true;
}
function galeOrbit() { // skills.js Phantom Wind
    const ab = player.airborneBlade;
    if (player.stance !== 'airborne' || !ab || !ab.orbit || ab.orbit.wide) return;
    ab.orbit.wide = true;
    comboText();
}

// Kensei, Gathering Gale (Shadow Step → R → Q, in hand; the user's design): R cast in Shadow Step's window doesn't storm
// round you: the blades gather in front of you. Q within 1 s releases them: you dash forward 260 px and a hurricane flies on
// ahead down that line (650 px), cutting what it passes every 0.15 s for x0.5 the R, carrying non-bosses along, +10 Flow per
// enemy it catches, and bursting at the end (x0.8 in 160 px). No Q in time: the storm breaks round you as a plain Blade
// Whirlwind. A boss in its path takes ~x2.3 (the storm round you is x1.5), but the Q's Parry Thrust is spent on it.
const GALE_HOLD = 1.0, GALE_DASH = 260, HURRICANE_RANGE = 650, HURRICANE_SPEED = 900, HURRICANE_RADIUS = 110, HURRICANE_TICK = 0.15,
    HURRICANE_MULT = 0.5, HURRICANE_BURST = 0.8, HURRICANE_BURST_R = 160, HURRICANE_FLOW = 10;
function gatherGale(sk, dmg) { // skills.js Blade Whirlwind, cast in the window
    buffs.gale = { until: fxTime + GALE_HOLD, sk, dmg };
    effects.push({ type: 'gale_gather', life: GALE_HOLD, maxLife: GALE_HOLD, customUpdate: (dt, ef) => { // skillfx_ult.js
        const g = buffs.gale;
        if (!g) { ef.life = 0; return; } // released
        if (fxTime >= g.until || player.stance !== 'handheld') { buffs.gale = null; ef.life = 0; SkillRegistry.Kensei[4](g.sk, g.dmg); } // no Q in time: a plain whirlwind
    } });
    comboText();
}
function galeReady() { return !!buffs.gale && fxTime < buffs.gale.until && player.stance === 'handheld'; }
function releaseHurricane() { // skills.js Parry Thrust, while the blades are gathered
    const g = buffs.gale; buffs.gale = null;
    const ang = Math.atan2(mouseY - player.y, mouseX - player.x), ux = Math.cos(ang), uy = Math.sin(ang);
    const hx = player.x + ux * 50, hy = player.y + uy * 50, hit = new Map(), life = HURRICANE_RANGE / HURRICANE_SPEED;
    startDash({ x: player.x + ux * GALE_DASH, y: player.y + uy * GALE_DASH, dur: 0.22, ease: 'out', kind: 'gale_dash', ghost: { color: '#84ffff', glow: true, every: 0.015, life: 0.25 } });
    effects.push({ type: 'katana_tornado', hurricane: true, x: hx, y: hy, radius: HURRICANE_RADIUS, vortex: g.sk.selectedUpg === 'A', startAngle: ang, life, maxLife: life,
        customUpdate: (dt, ef) => {
            ef.x += ux * HURRICANE_SPEED * dt; ef.y += uy * HURRICANE_SPEED * dt;
            if (ef.x < currentMap.left || ef.x > currentMap.right || ef.y < currentMap.top || ef.y > currentMap.bottom || (currentMap.grid && terrainAt(ef.x, ef.y) === T_WALL)) ef.life = Math.min(ef.life, dt); // breaks on rock or the edge
            for (const e of enemies) {
                if (e.dead || e.pod || e.submerged || Math.hypot(e.x - ef.x, e.y - ef.y) > HURRICANE_RADIUS + e.size / 2) continue;
                const last = hit.get(e);
                if (last === undefined || fxTime - last >= HURRICANE_TICK) {
                    if (last === undefined) { player.flow = Math.min(player.maxFlow, player.flow + HURRICANE_FLOW); player.flowGainTimer = 0; }
                    hit.set(e, fxTime);
                    applyDamage(e, g.dmg * HURRICANE_MULT, 'slash', ang);
                }
                if (!e.dead && !isBossE(e)) { // swept up and carried along
                    e.x += ux * HURRICANE_SPEED * 0.85 * dt + (ef.x - e.x) * Math.min(1, dt * 5); e.y += uy * HURRICANE_SPEED * 0.85 * dt + (ef.y - e.y) * Math.min(1, dt * 5);
                    clampToBounds(e, e.size / 2);
                }
            }
            if (!ef.burst && ef.life <= dt * 1.5) { // it bursts where it ends
                ef.burst = true;
                effects.push({ type: 'surge_burst', x: ef.x, y: ef.y, radius: HURRICANE_BURST_R, life: 0.35, maxLife: 0.35 }); // skillfx (Blade Surge's)
                for (const e of enemies) if (!e.dead && !e.pod && Math.hypot(e.x - ef.x, e.y - ef.y) <= HURRICANE_BURST_R + e.size / 2) applyDamage(e, g.dmg * HURRICANE_BURST, 'slash');
                addShake(3);
            }
        } });
    addShake(2.5);
}

// COMBO_SKILLS[className][slot]: a skill pressed in the window, or while the dash that opens it is still in the air, runs `cast`
// instead of its own cast (main.js keydown, before hold-to-charge starts). The cooldown check has already passed.
// air: only while the dash is still in the air; keep: the dash's finisher window still opens (otherwise this spends it);
// when: an extra condition (the Kensei's only in hand).
const COMBO_SKILLS = {
    Ranger: { 1: { cast: () => castSkill(1, 1, { skyline: true }) } },
    Dragonknight: { 4: { cast: () => castSkill(4, undefined, { wyrmfall: true }), air: true, keep: true } },
    Kensei: { 4: { cast: () => castSkill(4, undefined, { gather: true }), when: () => player.stance === 'handheld' } },
};
function comboSkill(slot) {
    const c = (COMBO_SKILLS[activeClass.name] || {})[slot];
    const air = (player.dash && player.dash.combo) || player.hang; // skills.js Meteor Dive: hanging counts as the air
    if (!c || (c.when && !c.when()) || !(air || (comboOpen && !c.air))) return false;
    if (!c.keep) { if (air && player.dash) player.dash.combo = false; else takeCombo(); comboQueued = false; } // spent: no finisher window after this one
    c.cast();
    comboText();
    return true;
}
function comboText() { effects.push({ type: 'text', text: 'COMBO!', x: player.x, y: player.y - 44, color: '#ffe082', life: 0.7, maxLife: 0.7 }); }

// Paladin, Judgment Smash: after Righteous Charge or Iron Pull, an overhead smash that stuns (paladin.js judgmentSmash)
// Machinist, Overload: what the shot after Magnetic Grapple does depends on what the grapple latched onto.
//   a turret: it runs 3x as fast for 2 s (skills.js spawnTurret); a Tesla Coil: it dumps its charge in a 250 px nova
//   (3x a pulse, 0.5 s stun); open ground: Point Blank, a tight double-damage blast that knocks enemies back.
const OVERLOAD_RATE = 3, OVERLOAD_TIME = 2.0, NOVA_RADIUS = 250, NOVA_MULT = 3, NOVA_STUN = 0.5, POINT_BLANK_MULT = 2;

function machinistOverload(dmg, c) {
    const a = c.anchor && projectiles.includes(c.anchor) && c.anchor.life > 0 ? c.anchor : null;
    if (a && a.type === 'turret') {
        a.overload = OVERLOAD_TIME;
        effects.push({ type: 'overload_glow', target: a, life: OVERLOAD_TIME, maxLife: OVERLOAD_TIME }); // skillfx.js
        effects.push({ type: 'text', text: 'OVERLOAD', x: a.x, y: a.y - 64, color: '#ffb74d', life: 0.8, maxLife: 0.8 }); // above "COMBO!" (you're standing on it)
        return false; // the shot still fires
    }
    if (a && a.type === 'tesla_coil_trap') {
        effects.push({ type: 'tesla_pulse', x: a.x, y: a.y, radius: NOVA_RADIUS, life: 0.45, maxLife: 0.45 });
        effects.push({ type: 'circle_burst', x: a.x, y: a.y, radius: NOVA_RADIUS, color: 'rgba(128, 222, 234, 0.6)', life: 0.35, maxLife: 0.35 });
        addShake(3);
        let zaps = 0;
        for (const e of enemies) {
            if (e.dead || e.pod || Math.hypot(e.x - a.x, e.y - a.y) > NOVA_RADIUS + e.size / 2) continue;
            if (zaps++ < 8) effects.push({ type: 'lightning', x1: a.x, y1: a.y, x2: e.x, y2: e.y, color: '#e0f7fa', life: 0.25, maxLife: 0.25 });
            applyDamage(e, a.damage * NOVA_MULT, 'magic');
            e.shockTimer = 0.6; e.stunTimer = Math.max(e.stunTimer || 0, NOVA_STUN);
        }
        return false;
    }
    // Point Blank: the pellets bunch up, hit twice as hard and throw enemies back
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    for (let i = 0; i < 9; i++) {
        const off = (Math.random() - 0.5) * 0.18, sp = 900 + Math.random() * 300;
        projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle + off) * sp, vy: Math.sin(angle + off) * sp, radius: 5, color: '#fff3e0', life: 0.3, type: 'scattergun', shape: 'bullet',
            damage: dmg * 0.3 * POINT_BLANK_MULT, pierce: buffs.overclockTimer > 0, hitList: [], isEnemy: false, knock: 45 });
    }
    effects.push({ type: 'circle_burst', x: player.x + Math.cos(angle) * 30, y: player.y + Math.sin(angle) * 30, radius: 40, color: 'rgba(255, 224, 178, 0.8)', life: 0.2, maxLife: 0.2 });
    addShake(2.5);
    player.x -= Math.cos(angle) * 18; player.y -= Math.sin(angle) * 18; clampToBounds(player, player.radius); // a heavier kick
    return true;
}

// Spellweaver, Blink Lance: the bolt after Blink becomes an instant arcane lance along the line you just blinked,
// x3 to everything you passed through. A Resonance charge it spent makes it a charged lance (and it gives the refund).
const LANCE_MULT = 3, LANCE_WIDTH = 30;
function blinkLance(dmg, c, charged) {
    const L = Math.hypot(c.x1 - c.x0, c.y1 - c.y0);
    if (L < 20) return false; // blinked nowhere (a wall right ahead): just a bolt
    effects.push({ type: 'blink_lance', x1: c.x0, y1: c.y0, x2: c.x1, y2: c.y1, charged, life: 0.35, maxLife: 0.35 }); // skillfx.js
    let hits = 0;
    for (const e of enemies) {
        if (e.dead || e.pod || distToSegment(e.x, e.y, c.x0, c.y0, c.x1, c.y1) > LANCE_WIDTH + e.size / 2) continue;
        applyDamage(e, dmg * LANCE_MULT, 'magic'); hits++;
    }
    if (hits && charged) weaveRefund(); // skills.js: like a charged bolt that lands
    addShake(hits ? 2.5 : 1);
    return true;
}

// Cleric, Radiant Burst: the censer pulse after Phase Shift becomes a ring of light around you, x5 to everything in 160 px
// and double Zeal per enemy, so Space → basic → Divine Ray is the Cleric's chain. Gold after a Holy spell, violet after a Shadow one.
const BURST_MULT = 5, BURST_RADIUS = 160, BURST_ZEAL = 2; // x5 (was x2.5, which the dummy test showed adding ~0%)
function radiantBurst(dmg) {
    const shadow = buffs.lastSpellClass === 'shadow';
    effects.push({ type: 'radiant_burst', x: player.x, y: player.y, radius: BURST_RADIUS, shadow, life: 0.45, maxLife: 0.45 }); // skillfx.js
    let hits = 0;
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - player.x, e.y - player.y) > BURST_RADIUS + e.size / 2) continue;
        applyDamage(e, dmg * BURST_MULT, 'magic'); hits++;
    }
    if (hits && shadow) { // Shadow: the blood ray wants an empty Zeal bar (Void Spike), so the violet ring siphons HP instead
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02 * Math.min(3, hits));
    } else if (hits && !buffs.zealLocked) { // Holy: the same Zeal a censer pulse gives per enemy (main.js), doubled
        const per = (hasItem('Thurible Chains') ? 20 : 15) * BURST_ZEAL * (buffs.inSanctuary ? 2 : 1);
        player.zeal = Math.min(player.maxZeal, player.zeal + per * hits);
    }
    addShake(hits ? 2 : 1);
    return true;
}

// Druid, Pounce Strike: the seed bolt after Spirit Leap is a calling bolt (amber); whatever it hits, the companion springs
// onto it for a heavy bite (druid.js pounceCall). A miss calls nothing.
function callingBolt(dmg) {
    BasicAttackRegistry.totem(dmg);
    const p = projectiles[projectiles.length - 1];
    if (p && p.type === 'druid_spore') { p.call = true; p.radius = 7; }
    return true;
}

// Kensei: one finisher per stance.
// Handheld, Iaido: the slash after Shadow Step is a draw-cut. A beat later a line of light splits everything you dashed through,
// 2x a slash (with the Flow bonus), and each enemy cut gives +20 Flow. Rewards dashing through enemies, not past them.
// Airborne, Guardian Orbit: the click after Spatial Swap pulls the blade into a tight circle around you for 1.2 s. It cuts
// everything within reach as fast as steering does, at 1.5x a steered hit, nudges non-bosses away and shreds enemy shots
// entering the circle; then you steer again (main.js runs ab.orbit first). A defensive buzzsaw after swapping into danger;
// not the airborne Q's spin (that's at the blade, for damage) and it beats plain steering when enemies are close.
// (Blade Rush and Impale came before it: one fired by itself, the other cut slower than steering.)
const IAIDO_MULT = 2, IAIDO_WIDTH = 30, IAIDO_FLOW = 20, IAIDO_DELAY = 0.15;
const ORBIT_TIME = 1.2, ORBIT_RADIUS = 70, ORBIT_REACH = 45, ORBIT_SPIN = 14, ORBIT_MULT = 1.5, ORBIT_PUSH = 18; // x1.5 (x2 gave +29% on the dummy)
function kenseiFinisher(dmg, c) {
    const flowK = 1 + BLADE_FLOW_BONUS * player.flow / Math.max(1, player.maxFlow); // the same Flow bonus the slashes and the blade get
    if (player.stance === 'airborne') {
        const ab = player.airborneBlade;
        ab.orbit = { t: 0, a: Math.atan2(ab.y - player.y, ab.x - player.x), timer: 0, time: calcUtility(ORBIT_TIME, activeClass.skills[3].level) }; // Space ranks: longer
        effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: ORBIT_RADIUS + ORBIT_REACH, color: 'rgba(0, 229, 255, 0.5)', life: 0.3, maxLife: 0.3 });
        return true;
    }
    const counter = buffs.counterIaido ? COUNTER_IAIDO : 1; buffs.counterIaido = false; // Counter Step: the step came off a parry
    if (Math.hypot(c.x1 - c.x0, c.y1 - c.y0) >= 20) after(IAIDO_DELAY, () => { // the draw-cut lands a beat after the slash
        effects.push({ type: 'iai_flash', x1: c.x0, y1: c.y0, x2: c.x1, y2: c.y1, big: true, life: 0.45, maxLife: 0.45 }); // skillfx_space.js: twice the dash's own flash
        let n = 0;
        for (const e of enemies) {
            if (e.dead || e.pod || distToSegment(e.x, e.y, c.x0, c.y0, c.x1, c.y1) > IAIDO_WIDTH + e.size / 2) continue;
            applyDamage(e, dmg * flowK * IAIDO_MULT * counter, 'slash');
            effects.push({ type: 'slash', x: e.x, y: e.y, angle: Math.atan2(c.y1 - c.y0, c.x1 - c.x0), color: '#e0f7fa', life: 0.2, maxLife: 0.2, radius: e.size / 2 + 30 });
            n++;
        }
        if (n) { player.flow = Math.min(player.maxFlow, player.flow + IAIDO_FLOW * n); player.flowGainTimer = 0; addShake(2.5); }
    });
    return false; // the slash itself still happens
}
// main.js (airborne stance): the blade whirls round the hero, cutting what's close as fast as steering would, and shreds shots
function updateOrbit(ab, dt) {
    const o = ab.orbit, px = ab.x, py = ab.y;
    o.r = o.r || ORBIT_RADIUS;
    if (o.wide) o.r = Math.min(GALE_ORBIT_RADIUS, o.r + GALE_ORBIT_GROW * dt); // Gale Orbit: flung wide
    o.t += dt; o.a += ORBIT_SPIN * (o.whirl ? WHIRL_ORBIT_SPIN : 1) * dt; // Whirling Orbit: twice as fast
    ab.x = player.x + Math.cos(o.a) * o.r; ab.y = player.y + Math.sin(o.a) * o.r; ab.angle = o.a + Math.PI / 2;
    effects.push({ type: 'flash_line', x1: px, y1: py, x2: ab.x, y2: ab.y, color: o.whirl || o.wide ? '#e0ffff' : '#80deea', life: 0.2, maxLife: 0.2, lineWidth: o.whirl ? 9 : 6 });
    if ((o.timer -= dt) <= 0) { // the steering rate (main.js): faster with Flow, Empowered and the Aether Grips
        o.timer = (player.empoweredAirborne ? 0.1 : 0.2) / (1 + 0.5 * player.flow / Math.max(1, player.maxFlow)) / bladeAttackSpeed() / (o.whirl ? WHIRL_ORBIT_SPIN : 1);
        const reach = o.r + ORBIT_REACH, ring = o.r > ORBIT_RADIUS + 1; // flung wide, it cuts a ring, not the whole disc
        for (const e of enemies) {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (e.dead || e.pod || e.submerged || d > reach + e.size / 2 || (ring && d < o.r - ORBIT_REACH - e.size / 2)) continue;
            const a = Math.atan2(e.y - player.y, e.x - player.x);
            applyDamage(e, bladeHitDmg(BLADE_STEER_MULT * ORBIT_MULT), 'slash', a);
            if (!isBossE(e) && !e.dead) { e.x += Math.cos(a) * ORBIT_PUSH; e.y += Math.sin(a) * ORBIT_PUSH; clampToBounds(e, e.size / 2); }
        }
    }
    for (const p of projectiles) { // enemy shots coming into the circle are cut down
        if (!p.isEnemy || p.life <= 0 || Math.hypot(p.x - player.x, p.y - player.y) > o.r + 15) continue;
        p.life = 0;
        burst(p.x, p.y, 0, Math.PI * 2, 4, { kind: 'spark', color: '#84ffff', size: 2, life: 0.2, speed: [80, 200], drag: 5 });
    }
    if (o.t >= (o.time || ORBIT_TIME) + (o.extra || 0)) { ab.orbit = null; ab.attackTimer = 0.1; }
}

// The Witch has no entry: her finisher, the toxic trail, is a fresh LMB press during Broom Flight (witch.js witchBroomClick), the one
// finisher that acts during the movement (the user's design, 2026-10-15). It still needs a deliberate press after the cast.
const COMBO_FINISHERS = {
    Monk: (dmg, heavy, c) => craneKick(dmg), // monk.js: keeps the flurry charge
    Swordsaint: (dmg, heavy, c) => crosscut(dmg), // swordsaint.js: an X of two cuts, a burst where they cross
    Kensei: (dmg, heavy, c) => kenseiFinisher(dmg, c),
    Druid: (dmg, heavy, c) => callingBolt(dmg),
    Nightblade: (dmg, heavy, c) => shadowDaggers(dmg),
    Cleric: (dmg, heavy, c) => radiantBurst(dmg),
    Spellweaver: (dmg, heavy, c, charged) => blinkLance(dmg, c, charged),
    Paladin: (dmg, heavy, c) => judgmentSmash(dmg),
    Machinist: (dmg, heavy, c) => machinistOverload(dmg, c),
    Dragonknight: (dmg, heavy, c) => { BasicAttackRegistry.sword(dmg, false, heavy, true); return true; },
    Ranger: (dmg, heavy, c) => {
        const L = Math.hypot(c.x1 - c.x0, c.y1 - c.y0), arrows = [], delay = 0.15;
        for (let i = 0; i < TRAIL_ARROWS; i++) {
            const f = L > 1 ? (i + 0.5) / TRAIL_ARROWS : 0, a = Math.random() * Math.PI * 2, r = L > 1 ? Math.random() * 18 : Math.sqrt(Math.random()) * 80;
            const arrow = { x: lerp(c.x0, c.x1, f) + Math.cos(a) * r, y: lerp(c.y0, c.y1, f) + Math.sin(a) * r, t: delay + i * 0.06 };
            arrows.push(arrow);
            after(arrow.t, () => {
                arrowImpactFx(arrow.x, arrow.y, false); // skillfx_ult.js
                for (const e of enemies) if (!e.dead && Math.hypot(e.x - arrow.x, e.y - arrow.y) <= TRAIL_HIT + e.size / 2) applyDamage(e, dmg * TRAIL_MULT, 'ranged');
            });
        }
        effects.push({ type: 'arrow_rain', trail: true, x: c.x1, y: c.y1, sx: player.x, sy: player.y, radius: 0, arrows, life: delay + TRAIL_ARROWS * 0.06 + 1.4, maxLife: delay + TRAIL_ARROWS * 0.06 + 1.4 });
        return false; // the shot itself still flies
    },
};

// The open window: a quick bright ring that tightens around the hero as it runs out (main.js draw, after the shield)
function drawComboWindow() {
    if (!comboOpen) return;
    const k = Math.min(1, comboOpen.t / COMBO_WINDOW), R = player.radius + 10 + 14 * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 236, 179, ${0.35 + 0.45 * k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, R, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) { // four sparks chasing round it
        const a = fxTime * 9 + i * Math.PI / 2;
        ctx.fillStyle = `rgba(255, 245, 200, ${0.5 + 0.5 * k})`;
        ctx.beginPath(); ctx.arc(player.x + Math.cos(a) * R, player.y + Math.sin(a) * R, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}
