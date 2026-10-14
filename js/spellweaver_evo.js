// ==========================================
// spellweaver_evo.js - The Spellweaver's evolutions and school talents (SPELLWEAVER.md "Evolutions")
// ==========================================
// Each school has two themes; each lesser spell has its own version of both (SPELLS[id].castA / castB, picked by
// castSpell), and the talents under a theme are the school's (SCHOOL_TALENTS): in the web each branch shows them under
// its spell's evolution with its own node id (s1_sw_range...) and `shared` set, and skilltree.js syncShared counts one
// taken anywhere as taken everywhere (hasTalent('sw_range')). The Greater spells have their own pairs and talents.
//   Evocation: A Artillery (delayed bombardments) / B Point Blank (cones, blasts, knockback)
//   Glyphcraft: A Warden (runes as territory) / B Brander (runes carved onto enemies: e.brands)
//   Translocation: A Echo (afterimages that fight: sw.echoes) / B Displacer (your movement moves enemies)
//   Abjuration: A Aegis (protect yourself) / B Lockdown (hold enemies: swCC)
// Hooks: combat.js applyDamage → swOnDamage (Time Stop's held hits, shatters, shackles, Hex / Brittle / Dislocate);
// talents.js → swDamageTaken / swLethal; main.js → swStill / swShotStill (Time Stop, Stasis, Ward Prison) and swMoveMult.

const swT = id => hasTalent(id);
const SW_TAU = Math.PI * 2;
const isBossE = e => e.type.startsWith('boss');
const swAngDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const BRAND_TIME = { searing: 2, shackle: 4, storm: 4, hex: 2 }, BRAND_COLOR = { searing: '#ff7043', shackle: '#ffd54f', storm: '#80d8ff', hex: '#e040fb' };

// ---------- names, texts and talents ----------

const SPELL_EVOS = {
    fireball: { A: ['Fire Mortar', 'Lobbed onto the cursor: after 0.6 s a 140 px blast that leaves burning ground for 3 s.'], B: ['Flame Burst', 'A short, wide cone of fire in front of you that sets enemies burning and knocks them back.'] },
    magic_missile: { A: ['Missile Rain', 'The darts arc up and come down on the 3 enemies nearest the cursor, anywhere within 900 px, over walls.'], B: ['Arcane Shotgun', '7 darts in a tight spread, x2 point-blank, falling to x0.5 at the end of their short range.'] },
    chain_lightning: { A: ['Thunderhead', 'Mark a circle: 3 bolts strike enemies in it from the sky over 1.5 s, each arcing to 2 more.'], B: ['Arc Field', 'Lightning jumps from you to every enemy within 200 px at once, shocking them.'] },
    arcane_cannon: { A: ['Siege Lance', 'A 2 s charge that fires a beam across the whole screen at x2.'], B: ['Repulsor', 'The charge goes off as a ring around you, hurling enemies away. A full charge stuns them for 1 s.'] },
    meteor: { A: ['Meteor Shower', '5 smaller meteors over 2 s that follow your cursor. You move slower while it rains.'], B: ['Moonfall', 'A 3 s fall, then a 300 px impact at x3. Its shadow drags enemies toward the centre while it falls.'] },
    explosive_rune: { A: ['Rearming Rune', 'After it blows, the rune rearms in 1.5 s: up to 3 blasts.'], B: ['Searing Brand', 'Brands the enemy nearest the cursor. It explodes after 2 s, or at once when a charged bolt hits it.'] },
    rune_of_binding: { A: ['Ward Circle', 'A 120 px circle at the cursor that enemies can\'t enter for 3 s (bosses can). Shots still fly in.'], B: ['Shackle Brand', 'Chains the branded enemy to the 2 nearest for 4 s: a hit on one deals 30% to the others.'] },
    storm_glyph: { A: ['Glyph Network', 'The glyph links to every rune of yours within 300 px with lightning lines that zap enemies crossing them.'], B: ['Storm Brand', 'A walking storm on an enemy: zaps everything within 120 px of it every 0.5 s for 4 s.'] },
    runic_detonation: { A: ['Sanctum', 'Your runes don\'t blow: each pulses, shoving enemies away, and gives you a shield per rune.'], B: ['Contagion', 'Every brand detonates at once, stronger, and leaps to the nearest unbranded enemy as a fresh brand.'] },
    runestorm: { A: ['Rune Wall', 'The 8 runes fall in a line across your aim: a minefield fence that holds a lane.'], B: ['Hex Storm', 'Brands the 8 enemies nearest the cursor; all of them go off together after 2 s.'] },
    blink: { A: ['Mirror Image', 'Leaves an afterimage where you were: it draws non-bosses for 2 s, then bursts.'], B: ['Relocation', 'Everything within 120 px of where you land is flung back to where you left (not bosses).'] },
    flicker: { A: ['Afterimages', 'Each flicker leaves an image that fires a dart at the nearest enemy 0.4 s later.'], B: ['Undertow', 'Each flicker drags the enemies near your start along with you (not bosses).'] },
    ride_lightning: { A: ['Static Trail', 'The path stays charged for 3 s, zapping enemies that cross it.'], B: ['Lightning Tether', 'Enemies you pass through are yanked to your landing spot 0.3 s later and stunned briefly (not bosses).'] },
    arcane_anchor: { A: ['Doppelganger', 'The anchor is an echo of you: while it\'s out, every other spell you cast is cast again from it at 50%.'], B: ['Grapple Anchor', 'Throw the anchor onto the enemy nearest the cursor; recast to yank it to you (a boss pulls you to it).'] },
    time_stop: { A: ['Stasis Field', 'Time stops only inside a 300 px bubble at the cursor, for 5 s; the rest of the world moves. Hits on frozen enemies are held.'], B: ['Rewind', 'Time doesn\'t stop: 3 s later you snap back to where you were with the HP you had, and your other cooldowns reset.'] },
    frost_nova: { A: ['Ice Armor', 'The frost coats you for 4 s: you take 20% less, and enemies that hit you in melee freeze for 1 s.'], B: ['Shatter Nova', 'Chilled enemies freeze solid for 1.5 s; your next hit on a frozen one shatters it for x2.'] },
    arcane_ward: { A: ['Absorption Ward', 'Every 20 damage the ward absorbs stores a Resonance charge, and it heals you for 30% of what it took.'], B: ['Ward Prison', 'Cast on the enemy nearest the cursor: sealed in a bubble, it can\'t move or attack for 2 s (bosses 0.75 s), then the bubble bursts.'] },
    spell_mirror: { A: ['Mirror Shield', 'A 2.5 s mirror facing the cursor, a 120 degree arc you turn, that sends shots back.'], B: ['Counterspell', 'Enemies within 220 px are stunned for 1 s and every enemy shot there is erased.'] },
    gravity_well: { A: ['Singularity Shield', 'The well sits on you for 3 s: enemy shots within 200 px fall into it and vanish.'], B: ['Crushing Well', 'Its damage grows toward the centre, and at the end it collapses: everything inside is slammed together and stunned 1.5 s.'] },
    blizzard: { A: ['Eye of the Storm', 'The storm centres on you and moves with you for 6 s. Enemy shots entering it crawl, and you take 20% less inside.'], B: ['Absolute Zero', 'After 2 s of gathering, everything within 260 px freezes for 3 s (bosses 1 s), then shatters for x2 when it thaws or a big hit lands.'] },
};
const tal = (id, name, icon, desc) => ({ id, name, icon, desc });
const SCHOOL_TALENTS = {
    evocation: {
        A: [tal('sw_range', 'Rangefinder', 'radius', 'Artillery spells cover 30% more area.'), tal('sw_siege', 'Siege Stance', 'damage', 'After 1 s standing still, your Evocation spells deal 20% more.'),
            tal('sw_bombard', 'Bombardier', 'slow', 'Artillery hits slow enemies by 40% for 2 s.'), tal('sw_carpet', 'Carpet Bombing', 'burst', 'Every artillery impact sets off 3 small aftershocks around it.')],
        B: [tal('sw_recoil', 'Recoil', 'range', 'A point-blank spell pushes you back a step: an escape built into the attack.'), tal('sw_concuss', 'Concussive', 'stun', 'Enemies you knock into a wall are stunned for 1 s.'),
            tal('sw_closecall', 'Close Call', 'shield', 'You take 15% less damage for 2 s after a point-blank spell.'), tal('sw_overpressure', 'Overpressure', 'cooldown', 'A point-blank spell that hits 3 or more enemies takes 1 s off every Evocation cooldown.')],
    },
    glyph: {
        A: [tal('sw_etch', 'Deep Etching', 'duration', 'Runes last 40 s, and one more of each kind fits.'), tal('sw_runeward', 'Rune Ward', 'shield', 'Within 100 px of one of your runes you take 15% less damage.'),
            tal('sw_scribe', 'Quick Scribe', 'cooldown', 'Runes arm instantly.'), tal('sw_domain', 'Domain', 'radius', 'With 3 or more of your runes within 250 px, your spells cool down 30% faster and runes trigger from 50% farther.')],
        B: [tal('sw_iron', 'Branding Iron', 'duration', 'Brands last 2 s longer.'), tal('sw_hex', 'Hex', 'damage', 'Branded enemies take 15% more from you.'),
            tal('sw_contagious', 'Contagious', 'count', 'A branded enemy that dies passes its brands to the nearest enemy.'), tal('sw_ruin', 'Mark of Ruin', 'burst', 'An enemy that gets a second, different brand erupts for x3.')],
    },
    trans: {
        A: [tal('sw_lasting', 'Lasting Echoes', 'duration', 'Afterimages last 50% longer.'), tal('sw_echores', 'Echo Resonance', 'lightning', 'An echo\'s hit stores a Resonance charge.'),
            tal('sw_haunt', 'Haunting', 'pull', 'Every echo draws nearby non-bosses for a moment.'), tal('sw_legion', 'Legion', 'count', 'Every movement spell leaves one more echo, which recasts your last spell at 40%.')],
        B: [tal('sw_disorient', 'Disorient', 'stun', 'Displaced enemies are stunned for 0.5 s.'), tal('sw_dislocate', 'Dislocate', 'damage', 'Displaced enemies take 20% more from you for 3 s.'),
            tal('sw_reach', 'Long Reach', 'radius', 'Displacement reaches 50% farther.'), tal('sw_rift', 'Rift Collapse', 'burst', 'Enemies displaced into each other collide for x1.5 and are stunned for 1 s.')],
    },
    abjur: {
        A: [tal('sw_bulwark', 'Bulwark', 'shield', 'Abjuration shields are 25% stronger.'), tal('sw_retaliate', 'Retaliation', 'frost', 'Whatever breaks one of your shields is frozen for 1 s.'),
            tal('sw_resolve', 'Resolve', 'range', '+20% move speed while shielded.'), tal('sw_lastward', 'Last Ward', 'heal', 'Once every 45 s, a lethal hit is absorbed and you get a 2 s ward instead.')],
        B: [tal('sw_deepcold', 'Deep Cold', 'frost', 'Your freezes and stuns last 30% longer.'), tal('sw_brittle', 'Brittle', 'damage', 'Frozen, stunned or rooted enemies take 20% more from you.'),
            tal('sw_lingering', 'Lingering Chill', 'slow', 'Enemies breaking free of your control stay 40% slowed for 2 s.'), tal('sw_permafrost', 'Permafrost', 'frost', 'An enemy you control 3 times within 10 s freezes for 3 s (bosses 1 s) and takes x2 from the next hit.')],
    },
};
const GREATER_TALENTS = {
    meteor: {
        A: [tal('sw_shower_wide', 'Wide Shower', 'radius', 'Shower meteors are 40% wider.'), tal('sw_shower_burn', 'Molten Shards', 'fire', 'Shower impacts set enemies burning.'),
            tal('sw_shower_steady', 'Steady Gaze', 'range', 'You move at full speed while it rains.'), tal('sw_cataclysm', 'Cataclysm', 'burst', 'The last meteor is a full-size one at x3.')],
        B: [tal('sw_moon_pull', 'Event Horizon', 'pull', 'Moonfall\'s shadow drags twice as hard.'), tal('sw_moon_crater', 'Crater', 'slow', 'The impact leaves a crater that slows and burns for 4 s.'),
            tal('sw_moon_tremor', 'Tremor', 'stun', 'The impact stuns survivors for 1.5 s.'), tal('sw_extinction', 'Extinction', 'cooldown', 'If the impact kills, half of Moonfall\'s cooldown comes back.')],
    },
    runestorm: {
        A: [tal('sw_wall_long', 'Long Wall', 'count', 'The wall has 12 runes.'), tal('sw_wall_barbed', 'Barbed Line', 'slow', 'Enemies near the wall are slowed by 40%.'),
            tal('sw_wall_rearm', 'Rearm', 'cooldown', 'Each wall rune rearms once after it blows.'), tal('sw_curtain', 'Iron Curtain', 'shield', 'Enemy shots can\'t cross the wall.')],
        B: [tal('sw_hex_wide', 'Wider Net', 'count', 'Hex Storm brands 12 enemies.'), tal('sw_hex_fuse', 'Short Fuse', 'cooldown', 'The hexes go off after 1 s.'),
            tal('sw_hexfire', 'Hexfire', 'fire', 'The hex blasts set enemies burning.'), tal('sw_doom', 'Doom Sigil', 'burst', 'An enemy a hex kills explodes for x1 in 100 px.')],
    },
    time_stop: {
        A: [tal('sw_stasis_wide', 'Wider Field', 'radius', 'The bubble is 30% wider.'), tal('sw_stasis_long', 'Long Stasis', 'duration', 'The bubble lasts 7 s.'),
            tal('sw_accumulate', 'Accumulate', 'damage', 'Held hits land at +50% instead of +25%.'), tal('sw_shatterpoint', 'Shatter Point', 'stun', 'When it ends, everything inside is stunned for 1.5 s.')],
        B: [tal('sw_second', 'Second Chance', 'heal', 'A lethal hit before the rewind triggers it instead of killing you.'), tal('sw_temporal', 'Temporal Blast', 'burst', 'Your return bursts around the spot.'),
            tal('sw_quickrw', 'Quick Rewind', 'cooldown', 'The rewind comes after 2 s.'), tal('sw_paradox', 'Paradox', 'count', 'The spells you cast in between are cast again from the spot you return to.')],
    },
    blizzard: {
        A: [tal('sw_eye_wide', 'Wider Eye', 'radius', 'The eye is 30% wider.'), tal('sw_eye_long', 'Long Storm', 'duration', 'It lasts 8 s.'),
            tal('sw_whiteout', 'Whiteout', 'slow', 'Non-bosses inside lose track of you, as in smoke.'), tal('sw_hailstorm', 'Hailstorm', 'frost', 'Hail strikes the 3 nearest enemies inside every 0.5 s.')],
        B: [tal('sw_zero_deep', 'Deeper Freeze', 'duration', 'The freeze lasts 4 s.'), tal('sw_zero_snap', 'Cold Snap', 'cooldown', 'It gathers in 1 s.'),
            tal('sw_zero_shards', 'Frost Shards', 'frost', 'Shatters spray shards at enemies within 100 px.'), tal('sw_glacier', 'Glacier', 'burst', 'A shatter refreezes the enemies near it, once.')],
    },
};
const SCHOOL_IDS = new Set(Object.values(SCHOOL_TALENTS).flatMap(T => [...T.A, ...T.B].map(t => t.id))); // skilltree.js syncShared
for (const [id, E] of Object.entries(SPELL_EVOS)) for (const p of ['A', 'B']) SPELLS[id]['upg' + p] = { name: E[p][0], desc: E[p][1] };
SPELLS.blink.dmg = 25; SPELLS.flicker.dmg = 12; SPELLS.time_stop.dmg = 30; // used only by their evolutions (bursts, darts)

// The talents under a key's evolutions (skilltree.js treeNodes): the school's for a lesser spell, its own for a Greater one
function spellWeb(slot) {
    const id = player.spells[slot], S = SPELLS[id];
    if (S.greater) return GREATER_TALENTS[id];
    const T = SCHOOL_TALENTS[S.school], mk = t => ({ ...t, id: `s${slot}_${t.id}`, shared: t.id });
    return { A: T.A.map(mk), B: T.B.map(mk) };
}

// ---------- state ----------

function resetSpellEvos() {
    Object.assign(sw, { echoes: [], branded: [], prisons: [], stasis: null, rewind: null, iceArmor: 0, closeCall: 0, shower: 0, stillT: 0, lastPos: null, lastSpell: null, lastWardAt: -99, echoing: false });
}
resetSpellEvos();

// ---------- shared helpers ----------

function swTargetCursor(range = 650) { // the enemy nearest the cursor (within 160 px of it), else the one nearest you
    let best = null, bd = 160;
    for (const e of enemies) { if (!swOk(e) || Math.hypot(e.x - player.x, e.y - player.y) > range) continue; const d = Math.hypot(e.x - mouseX, e.y - mouseY) - e.size / 2; if (d < bd) { bd = d; best = e; } }
    return best || swNearest(player.x, player.y, Math.min(range, 450));
}
function swText(text, x, y, color) { effects.push({ type: 'text', text, x, y: y - 30, color, life: 0.7, maxLife: 0.7 }); }
function swImpactFx(x, y, r, kind) {
    if (kind === 'fire') effects.push({ type: 'fiery_explosion', x, y, radius: r, life: 0.4, maxLife: 0.4 });
    else effects.push({ type: 'circle_burst', x, y, radius: r, color: kind === 'storm' ? 'rgba(128, 216, 255, 0.7)' : kind === 'frost' ? 'rgba(179, 229, 252, 0.75)' : 'rgba(179, 136, 255, 0.7)', life: 0.35, maxLife: 0.35 });
}
function swShield(amount, time) { addShield(amount * (swT('sw_bulwark') ? 1.25 : 1), time); } // combat.js: capped

// Recast a spell from another spot (Doppelganger, Legion, Paradox): the hero stands there for the length of the cast
const NO_ECHO = ['arcane_ward', 'spell_mirror', 'time_stop', 'runic_detonation'];
function echoable(sk) { const S = SPELLS[sk.spell]; return S && !S.move && !NO_ECHO.includes(sk.spell) && !(sk.selectedUpg === 'A' && ['frost_nova', 'gravity_well', 'blizzard'].includes(sk.spell)); }
function echoCast(slot, x, y, mult) {
    const sk = activeClass.skills[slot]; if (!sk || !sk.level || !echoable(sk)) return;
    const S = SPELLS[sk.spell], fn = (sk.selectedUpg && S['cast' + sk.selectedUpg]) || S.cast, px = player.x, py = player.y;
    player.x = x; player.y = y; sw.echoing = true;
    try { fn(sk, calcDmg(sk.baseDmg, sk.level) * mult, 1, slot); } finally { player.x = px; player.y = py; sw.echoing = false; }
}
// spellweaver.js castSpell, after every cast: the Doppelganger's echo, Legion's memory, Paradox's record
function swAfterCast(slot, sk, dmg, k) {
    if (sw.echoing || !echoable(sk)) return;
    sw.lastSpell = slot;
    const A = sw.anchor;
    if (A && A.dop && A.slot !== slot) { echoCast(slot, A.x, A.y, 0.5); effects.push({ type: 'lightning', x1: player.x, y1: player.y, x2: A.x, y2: A.y, color: '#b388ff', lineWidth: 2, life: 0.15, maxLife: 0.15 }); }
    if (sw.rewind && swT('sw_paradox')) sw.rewind.casts.push(slot);
}

// ---------- Evocation ----------

const evoMult = () => swT('sw_siege') && sw.stillT >= 1 ? 1.2 : 1;
const artyR = r => r * (swT('sw_range') ? 1.3 : 1);
function artyImpact(x, y, r, dmg, kind = 'fire', shocks = true) { // one artillery impact: Bombardier slows, Carpet Bombing's aftershocks
    swImpactFx(x, y, r, kind);
    for (const e of enemies) {
        if (!swHittable(e) || Math.hypot(e.x - x, e.y - y) > r + e.size / 2) continue;
        applyDamage(e, dmg, 'magic');
        if (swT('sw_bombard') && !e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); }
    }
    if (shocks && swT('sw_carpet')) for (let n = 0; n < 3; n++) {
        const a = Math.random() * SW_TAU, d = r * (0.6 + Math.random() * 0.5), ax = x + Math.cos(a) * d, ay = y + Math.sin(a) * d;
        after(0.2 + n * 0.12, () => artyImpact(ax, ay, r * 0.4, dmg * 0.3, kind, false));
    }
}
function swKnock(e, fx, fy, dist) { // shoved away from a point; Concussive stuns what hits a wall
    if (!swOk(e) || isBossE(e)) return;
    const dx = e.x - fx, dy = e.y - fy, d = Math.hypot(dx, dy) || 1;
    let nx = e.x + dx / d * dist, ny = e.y + dy / d * dist;
    const wall = currentMap.grid ? clipToWalls(e.x, e.y, nx, ny, e.size / 2, false) : null;
    if (wall) [nx, ny] = wall;
    e.x = nx; e.y = ny; clampToBounds(e, e.size / 2);
    if ((wall || Math.hypot(e.x - nx, e.y - ny) > 2) && swT('sw_concuss') && !e.dead) { e.stunTimer = Math.max(e.stunTimer || 0, 1); swText('STUNNED', e.x, e.y, '#ffe082'); }
}
function pbCount(R, half) { const a = swAim(); return enemies.filter(e => swOk(e) && Math.hypot(e.x - player.x, e.y - player.y) < R + e.size / 2 && Math.abs(swAngDiff(Math.atan2(e.y - player.y, e.x - player.x), a)) < half).length; }
function pbAfter(n) { // after a point-blank spell: Recoil, Close Call, Overpressure
    if (sw.echoing) return;
    if (swT('sw_recoil') && !player.dash) { const a = swAim() + Math.PI; startDash({ x: player.x + Math.cos(a) * 70, y: player.y + Math.sin(a) * 70, dur: 0.12, iFrames: false }); }
    if (swT('sw_closecall')) sw.closeCall = 2;
    if (swT('sw_overpressure') && n >= 3) for (let i = 1; i <= 4; i++) if (SPELLS[activeClass.skills[i].spell].school === 'evocation') cooldowns[`s${i}`] = Math.max(0, cooldowns[`s${i}`] - 1);
}

SPELLS.fireball.castA = (sk, dmg) => {
    const [x, y] = swPoint(700), r = artyR(140), m = evoMult();
    effects.push({ type: 'sw_lob', x0: player.x, y0: player.y, x1: x, y1: y, h: 150, color: '#ff7043', size: 11, life: 0.6, maxLife: 0.6 });
    effects.push({ type: 'sw_mark', x, y, radius: r, color: '#ff7043', life: 0.6, maxLife: 0.6 });
    after(0.6, () => {
        artyImpact(x, y, r, dmg * m, 'fire'); addShake(2);
        effects.push({ type: 'fire_puddle', x, y, radius: r * 0.8, color: 'rgba(255, 87, 34, 0.3)', life: 3, maxLife: 3, dmg: dmg * 0.25 }); // main.js burns what stands in it
    });
};
SPELLS.fireball.castB = (sk, dmg) => {
    const a = swAim(), R = 190, half = 0.6, m = evoMult(); let n = 0;
    effects.push({ type: 'sw_cone', x: player.x, y: player.y, angle: a, radius: R, half, color: '#ff7043', life: 0.3, maxLife: 0.3 });
    for (const e of enemies) {
        if (!swHittable(e)) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d > R + e.size / 2 || Math.abs(swAngDiff(Math.atan2(e.y - player.y, e.x - player.x), a)) > half + Math.atan2(e.size / 2, Math.max(d, 1))) continue;
        applyDamage(e, dmg * 1.3 * m, 'magic'); if (!e.dead) igniteEnemy(e, dmg * 0.15);
        swKnock(e, player.x, player.y, 90); n++;
    }
    addShake(1.5); pbAfter(n);
};

SPELLS.magic_missile.castA = (sk, dmg) => {
    const m = evoMult(), pool = enemies.filter(e => swOk(e) && Math.hypot(e.x - player.x, e.y - player.y) < 900)
        .sort((a, b) => Math.hypot(a.x - mouseX, a.y - mouseY) - Math.hypot(b.x - mouseX, b.y - mouseY)).slice(0, MISSILES);
    for (let n = 0; n < MISSILES; n++) {
        const t = pool.length ? pool[n % pool.length] : null, [px, py] = swPoint(600), tx = t ? t.x : px + jitter(120), ty = t ? t.y : py + jitter(120), x0 = player.x, y0 = player.y;
        after(n * 0.08, () => effects.push({ type: 'sw_lob', x0, y0, x1: tx, y1: ty, h: 220, color: '#e040fb', size: 6, life: 0.5, maxLife: 0.5 }));
        after(0.5 + n * 0.08, () => { const live = t && !t.dead; artyImpact(live ? t.x : tx, live ? t.y : ty, artyR(45), dmg * 1.1 * m, 'arcane'); });
    }
};
const SHOTGUN_RANGE = 330;
SPELLS.magic_missile.castB = (sk, dmg) => {
    const a0 = swAim(), m = evoMult();
    for (let n = 0; n < 7; n++) {
        const a = a0 + (n - 3) * 0.09;
        projectiles.push({ x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, radius: 6, color: '#e040fb', life: SHOTGUN_RANGE / 950,
            type: 'basic', shape: 'arcane_missile', damage: dmg * 0.45 * m, pierce: false, hitList: [], isEnemy: false, sox: player.x, soy: player.y, spellHit: shotgunHit });
    }
    pbAfter(pbCount(SHOTGUN_RANGE * 0.7, 0.35));
};
function shotgunHit(p, e) { // main.js: point-blank darts hit hardest
    const k = 2 - 1.5 * Math.min(1, Math.hypot(p.x - p.sox, p.y - p.soy) / SHOTGUN_RANGE);
    applyDamage(e, p.damage * k, 'magic', Math.atan2(p.vy, p.vx)); swKnock(e, p.sox, p.soy, 14);
}

SPELLS.chain_lightning.castA = (sk, dmg) => {
    const [x, y] = swPoint(700), r = artyR(130), m = evoMult();
    sw.zones.push({ kind: 'thunder', x, y, r, t: 1.7, max: 1.7 });
    for (let n = 0; n < 3; n++) after(0.35 + n * 0.5, () => {
        const inside = enemies.filter(e => swOk(e) && Math.hypot(e.x - x, e.y - y) <= r + e.size / 2), t = inside.length ? inside[Math.floor(Math.random() * inside.length)] : null;
        const tx = t ? t.x : x + jitter(r), ty = t ? t.y : y + jitter(r);
        effects.push({ type: 'lightning', x1: tx + jitter(60), y1: ty - 340, x2: tx, y2: ty, color: '#80d8ff', lineWidth: 6, life: 0.25, maxLife: 0.25 });
        artyImpact(tx, ty, 55, dmg * 0.9 * m, 'storm');
        const hit = t ? [t] : []; let fx = tx, fy = ty;
        for (let j = 0; j < 2; j++) {
            const o = swNearest(fx, fy, 200, hit); if (!o) break;
            effects.push({ type: 'lightning', x1: fx, y1: fy, x2: o.x, y2: o.y, color: '#80d8ff', life: 0.2, maxLife: 0.2 });
            applyDamage(o, dmg * 0.5 * m, 'magic'); if (!o.dead) o.shockTimer = Math.max(o.shockTimer || 0, 1);
            hit.push(o); fx = o.x; fy = o.y;
        }
        addShake(1.5);
    });
};
SPELLS.chain_lightning.castB = (sk, dmg) => {
    const R = 200, m = evoMult(); let n = 0;
    for (const e of enemies) {
        if (!swHittable(e) || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        if (n < 10) effects.push({ type: 'lightning', x1: player.x, y1: player.y, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.22, maxLife: 0.22 });
        applyDamage(e, dmg * 0.9 * m, 'magic'); if (!e.dead) e.shockTimer = Math.max(e.shockTimer || 0, 1.5); n++;
    }
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: R, color: 'rgba(128, 216, 255, 0.45)', life: 0.3, maxLife: 0.3 });
    addShake(1.2); pbAfter(n);
};

SPELLS.arcane_cannon.chargeA = () => ({ max: 2.0, slow: 0 });
SPELLS.arcane_cannon.castA = (sk, dmg, k = 1) => {
    const q = k === undefined ? 1 : k, a = swAim(), x1 = player.x + Math.cos(a) * 44, y1 = player.y + Math.sin(a) * 44;
    let x2 = player.x + Math.cos(a) * 1600, y2 = player.y + Math.sin(a) * 1600;
    const wall = clipToWalls(x1, y1, x2, y2, 0, true); if (wall) [x2, y2] = wall; // stage.js: rock stops it
    const w = artyR(26) * (0.6 + 0.4 * q), hit = dmg * (0.3 + 0.7 * q) * 2 * evoMult(), hits = [];
    effects.push({ type: 'arcane_beam', x1, y1, x2, y2, life: 0.45, maxLife: 0.45 }); // skillfx_rmb.js
    for (const e of enemies) {
        if (!swHittable(e) || distToSegment(e.x, e.y, x1, y1, x2, y2) > e.size / 2 + w) continue;
        applyDamage(e, hit, 'magic'); hits.push(e);
        if (swT('sw_bombard') && !e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); }
    }
    if (swT('sw_carpet')) hits.slice(0, 3).forEach((e, n) => { const ex = e.x, ey = e.y; after(0.2 + n * 0.1, () => artyImpact(ex, ey, 50, hit * 0.3, 'arcane', false)); });
    addShake(2 + 2 * q);
};
SPELLS.arcane_cannon.castB = (sk, dmg, k = 1) => {
    const q = k === undefined ? 1 : k, R = 170, m = evoMult(); let n = 0;
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: R, color: 'rgba(179, 136, 255, 0.7)', life: 0.4, maxLife: 0.4 });
    burst(player.x, player.y, 0, SW_TAU, 10 + 10 * q, { kind: 'spark', color: '#d1c4e9', size: 2.5, life: 0.35, speed: [200, 480], drag: 5 });
    for (const e of enemies) {
        if (!swHittable(e) || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        applyDamage(e, dmg * (0.3 + 0.7 * q) * m, 'magic'); swKnock(e, player.x, player.y, 60 + 120 * q);
        if (q >= 1 && !e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1); n++;
    }
    addShake(1.5 + 2 * q); pbAfter(n);
};

SPELLS.meteor.castA = sk => { // the dmg is read per meteor, so the ranks and Power at each fall count
    const R = 80 * (swT('sw_shower_wide') ? 1.4 : 1), dmg = calcDmg(sk.baseDmg, sk.level);
    sw.shower = 2.3;
    for (let n = 0; n < 5; n++) after(n * 0.4, () => {
        const last = n === 4 && swT('sw_cataclysm'), r = last ? 150 : R, [cx, cy] = swPoint(750), x = cx + (last ? 0 : jitter(90)), y = cy + (last ? 0 : jitter(90));
        effects.push({ type: 'meteor_fall', x, y, radius: r, life: 0.5, maxLife: 0.5 }); // skillfx_ult.js
        after(0.5, () => {
            effects.push({ type: 'fiery_explosion', x, y, radius: r, life: 0.45, maxLife: 0.45 });
            effects.push({ type: 'molten_scorch', x, y, radius: r * 0.8, life: 2, maxLife: 2 });
            for (const e of enemies) {
                if (!swHittable(e) || Math.hypot(e.x - x, e.y - y) > r + e.size / 2) continue;
                applyDamage(e, dmg * (last ? 1.2 : 0.4), 'magic'); if (swT('sw_shower_burn') && !e.dead) igniteEnemy(e, dmg * 0.05);
            }
            addShake(last ? 3.5 : 1.2);
        });
    });
};
SPELLS.meteor.castB = (sk, dmg, k, slot) => {
    const [x, y] = swPoint(750), R = 300, fall = 3;
    effects.push({ type: 'meteor_fall', x, y, radius: R, life: fall, maxLife: fall });
    sw.zones.push({ kind: 'moon', x, y, r: R, t: fall, max: fall }); // its shadow drags enemies in
    const meteor = trackMeteor(x, y, fxTime + fall, R, dmg); // combos.js Frostfire still works
    after(fall, () => {
        effects.push({ type: 'fiery_explosion', x, y, radius: R, life: 0.6, maxLife: 0.6 });
        effects.push({ type: 'molten_scorch', x, y, radius: R * 0.8, life: 4, maxLife: 4 });
        burst(x, y, 0, SW_TAU, 24, { kind: 'debris', color: '#4e342e', size: 6, life: 0.9, speed: [180, 460], drag: 4 });
        let kills = 0;
        for (const e of enemies) {
            if (!swHittable(e) || Math.hypot(e.x - x, e.y - y) > R + e.size / 2) continue;
            applyDamage(e, dmg * 3, 'magic');
            if (e.dead) kills++; else if (swT('sw_moon_tremor')) e.stunTimer = Math.max(e.stunTimer || 0, 1.5);
        }
        if (swT('sw_moon_crater')) effects.push({ type: 'fire_puddle', x, y, radius: R * 0.7, color: 'rgba(121, 85, 72, 0.25)', life: 4, maxLife: 4, dmg: dmg * 0.1, slow: 0.5 });
        if (kills && swT('sw_extinction')) cooldowns[`s${slot}`] *= 0.5;
        meteorLanded(meteor); addShake(5);
    });
};

// ---------- Glyphcraft ----------

const runeCap = kind => RUNE_CAP[kind] + (swT('sw_etch') ? 1 : 0);
const runeLife = () => swT('sw_etch') ? 40 : RUNE_LIFE;
function swDomain() { return swT('sw_domain') && sw.runes.filter(r => Math.hypot(r.x - player.x, r.y - player.y) < 250).length >= 3; }

SPELLS.explosive_rune.castA = (sk, dmg) => { const [x, y] = swPoint(RUNE_RANGE); placeRune('blast', x, y, dmg, { charges: 3 }); runeDrop(x, y, '#ff7043'); };
SPELLS.rune_of_binding.castA = (sk, dmg) => {
    const [x, y] = swPoint(RUNE_RANGE);
    sw.zones.push({ kind: 'circle', x, y, r: 120, t: calcUtility(3, sk.level), max: calcUtility(3, sk.level) });
    effects.push({ type: 'sw_bind', x, y, radius: 120, life: 0.5, maxLife: 0.5 });
};
SPELLS.storm_glyph.castA = (sk, dmg) => { const [x, y] = swPoint(RUNE_RANGE); sw.zones.push({ kind: 'storm', x, y, r: STORM_R, t: STORM_TIME, max: STORM_TIME, tick: 0.15, dmg, net: true }); };
SPELLS.runic_detonation.castA = (sk, dmg) => {
    if (!sw.runes.length) return SPELLS.runic_detonation.cast(sk, dmg); // nothing out: a rune at your feet, as the base spell
    for (const r of sw.runes) { effects.push({ type: 'circle_burst', x: r.x, y: r.y, radius: 100, color: 'rgba(255, 213, 79, 0.6)', life: 0.35, maxLife: 0.35 }); swShove(r.x, r.y, 100, 110); }
    swShield(calcUtility(15, sk.level) * sw.runes.length, 4);
    swText('SANCTUM', player.x, player.y - 20, '#ffd54f');
};
SPELLS.runestorm.castA = (sk, dmg) => {
    const [cx, cy] = swPoint(650), a = swAim() + Math.PI / 2, n = swT('sw_wall_long') ? 12 : 8, gap = 42;
    for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * gap, [x, y] = clampPointToMap(cx + Math.cos(a) * o, cy + Math.sin(a) * o, 10);
        after(i * 0.03, () => { placeRune('blast', x, y, dmg, { extra: true, wall: true, life: 12, armAt: fxTime + 0.4, charges: swT('sw_wall_rearm') ? 2 : 1 }); runeDrop(x, y, '#ff7043'); });
    }
};

// Brands: e.brands[kind] = { t, dmg, tick, group }. Branded enemies are listed in sw.branded and ticked by updateSpellEvos.
function hasBrand(e) { return !!(e.brands && Object.values(e.brands).some(b => b.t > 0)); }
function brandEnemy(e, kind, dmg, t, extra = {}) {
    if (!swOk(e)) return;
    const had = e.brands ? Object.keys(e.brands).filter(k => e.brands[k].t > 0) : [];
    if (!e.brands) e.brands = {};
    e.brands[kind] = { t: t + (swT('sw_iron') && kind !== 'hex' ? 2 : 0), dmg, tick: 0, ...extra };
    if (!sw.branded.includes(e)) sw.branded.push(e);
    burst(e.x, e.y, 0, SW_TAU, 6, { kind: 'spark', color: BRAND_COLOR[kind], size: 2, life: 0.3, speed: [60, 160], drag: 5 });
    if (swT('sw_ruin') && had.length && !had.includes(kind)) { // Mark of Ruin: two different brands and it erupts
        const brands = e.brands; e.brands = {};
        effects.push({ type: 'circle_burst', x: e.x, y: e.y, radius: 110, color: 'rgba(224, 64, 251, 0.75)', life: 0.4, maxLife: 0.4 });
        swHitCircle(e.x, e.y, 100, Math.max(...Object.values(brands).map(b => b.dmg)) * 3);
        swText('RUIN', e.x, e.y, '#ea80fc'); addShake(2);
    }
}
function brandBlast(e, dmg, hex) { // a searing or hex brand going off
    effects.push({ type: 'fiery_explosion', x: e.x, y: e.y, radius: 90, life: 0.4, maxLife: 0.4 });
    const near = enemies.filter(o => swHittable(o) && Math.hypot(o.x - e.x, o.y - e.y) <= 90 + o.size / 2);
    for (const o of near) {
        applyDamage(o, dmg, 'magic');
        if (hex && swT('sw_hexfire') && !o.dead) igniteEnemy(o, dmg * 0.1);
        if (hex && swT('sw_doom') && o.dead && !o.doomDone) { o.doomDone = true; const ox = o.x, oy = o.y; after(0.1, () => { swImpactFx(ox, oy, 100, 'arcane'); swHitCircle(ox, oy, 100, dmg); }); }
    }
    addShake(1.2);
}
function stormZap(e, dmg) { // a storm brand's pulse round its bearer
    let shown = 0;
    for (const o of enemies) {
        if (!swHittable(o) || Math.hypot(o.x - e.x, o.y - e.y) > 120 + o.size / 2) continue;
        applyDamage(o, dmg, 'magic');
        if (o !== e && shown++ < 3) effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: o.x, y2: o.y, color: '#80d8ff', lineWidth: 2, life: 0.15, maxLife: 0.15 });
    }
}
function brandEnd(e, kind, b, mult = 1) { // its time ran out (or Contagion set it off)
    if (kind === 'searing' || kind === 'hex') brandBlast(e, b.dmg * (kind === 'searing' ? 1.2 : 1) * mult, kind === 'hex');
    else if (kind === 'storm' && mult > 1) stormZap(e, b.dmg * Math.max(1, Math.ceil(b.t / 0.5)) * 0.6 * mult);
    else if (kind === 'shackle' && mult > 1) for (const o of b.group || [e]) if (!o.dead) applyDamage(o, b.dmg * mult, 'magic');
}
function swBoltHit(e) { // main.js: a charged bolt sets a Searing Brand off at once
    const b = e.brands && e.brands.searing;
    if (b && b.t > 0) { b.t = 0; delete e.brands.searing; brandEnd(e, 'searing', b); }
}

SPELLS.explosive_rune.castB = (sk, dmg) => { const e = swTargetCursor(); if (e) brandEnemy(e, 'searing', dmg, BRAND_TIME.searing); else swText('No target', player.x, player.y, '#ffcc80'); };
SPELLS.rune_of_binding.castB = (sk, dmg) => {
    const e = swTargetCursor(); if (!e) { swText('No target', player.x, player.y, '#ffcc80'); return; }
    const group = [e, ...enemies.filter(o => o !== e && swOk(o) && Math.hypot(o.x - e.x, o.y - e.y) < 250).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2)];
    group.forEach(o => brandEnemy(o, 'shackle', dmg, BRAND_TIME.shackle, { group }));
};
SPELLS.storm_glyph.castB = (sk, dmg) => { const e = swTargetCursor(); if (e) brandEnemy(e, 'storm', dmg, BRAND_TIME.storm); else swText('No target', player.x, player.y, '#ffcc80'); };
SPELLS.runic_detonation.castB = (sk, dmg) => {
    const list = sw.branded.filter(e => !e.dead && hasBrand(e));
    if (!list.length) { const e = swTargetCursor(); if (e) brandEnemy(e, 'searing', dmg, BRAND_TIME.searing); return; } // nothing branded: brand one
    const mult = detonateMult(sk.level), spread = [];
    for (const e of list) {
        const brands = e.brands; e.brands = {};
        for (const [kind, b] of Object.entries(brands)) { if (b.t <= 0) continue; brandEnd(e, kind, b, mult); spread.push([e.x, e.y, kind, b.dmg]); }
    }
    for (const [x, y, kind, dmg2] of spread) { // the brand leaps on to a fresh bearer
        let best = null, bd = 250;
        for (const o of enemies) { if (!swOk(o) || hasBrand(o)) continue; const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } }
        if (!best) continue;
        effects.push({ type: 'lightning', x1: x, y1: y, x2: best.x, y2: best.y, color: BRAND_COLOR[kind], life: 0.25, maxLife: 0.25 });
        brandEnemy(best, kind, dmg2, BRAND_TIME[kind], kind === 'shackle' ? { group: [best] } : {});
    }
    swText('CONTAGION', player.x, player.y - 20, '#ea80fc');
};
SPELLS.runestorm.castB = (sk, dmg) => {
    const [cx, cy] = swPoint(650), n = swT('sw_hex_wide') ? 12 : 8, fuse = swT('sw_hex_fuse') ? 1 : 2;
    enemies.filter(e => swOk(e) && Math.hypot(e.x - cx, e.y - cy) < 320).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, n)
        .forEach(e => brandEnemy(e, 'hex', dmg, fuse));
    effects.push({ type: 'circle_burst', x: cx, y: cy, radius: 320, color: 'rgba(224, 64, 251, 0.3)', life: 0.5, maxLife: 0.5 });
};

// ---------- Translocation ----------

const reachMult = () => swT('sw_reach') ? 1.5 : 1;
function tauntAround(x, y, r, t) { for (const e of enemies) if (swOk(e) && !isBossE(e) && Math.hypot(e.x - x, e.y - y) < r) { e.tauntTimer = Math.max(e.tauntTimer || 0, t); e.tauntX = x; e.tauntY = y; } }
function spawnEcho(x, y, kind, o) { // an afterimage (drawn as a dash ghost): it taunts, fires, bursts or recasts on its own clock
    const t = o.t * (swT('sw_lasting') ? 1.5 : 1), ec = { x, y, kind, age: 0, ...o, t, max: t };
    sw.echoes.push(ec);
    spawnDashGhost('#b388ff', true, t, swAim(), x, y, 0);
    if (swT('sw_haunt')) tauntAround(x, y, 300, Math.min(t, 1));
    return ec;
}
function echoHit(p, e) { applyDamage(e, p.damage, 'magic', Math.atan2(p.vy, p.vx)); if (swT('sw_echores')) addResonance(1); } // main.js spellHit
function swDisplaced(e) {
    if (swT('sw_disorient')) e.stunTimer = Math.max(e.stunTimer || 0, 0.5);
    if (swT('sw_dislocate')) e.swDislocUntil = fxTime + 3;
}
function riftCollapse(list, dmg) { // Rift Collapse: displaced enemies that end up on top of each other crash together
    if (!swT('sw_rift')) return;
    for (const e of list) {
        if (e.dead || !list.some(o => o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < (o.size + e.size) / 2 + 10)) continue;
        applyDamage(e, dmg * 1.5, 'magic'); if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1);
        burst(e.x, e.y, 0, SW_TAU, 6, { kind: 'spark', color: '#b388ff', size: 2.2, life: 0.3, speed: [100, 260], drag: 5 });
    }
}
// Legion (spellweaver.js swMoved): an echo where you left that recasts your last spell
function swLegion(x0, y0) { if (swT('sw_legion') && sw.lastSpell && !sw.echoing) spawnEcho(x0, y0, 'legion', { t: 0.6, castAt: 0.3, slot: sw.lastSpell }); }

SPELLS.blink.castA = (sk, dmg) => {
    const x0 = player.x, y0 = player.y; swTeleport(sk, blinkReach(sk.level));
    spawnEcho(x0, y0, 'mirror', { t: 2, dmg }); tauntAround(x0, y0, 350, 2);
};
SPELLS.blink.castB = (sk, dmg) => {
    const x0 = player.x, y0 = player.y; swTeleport(sk, blinkReach(sk.level));
    const R = 120 * reachMult(), moved = [];
    for (const e of enemies) {
        if (!swOk(e) || isBossE(e) || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        spawnDashGhost('#80d8ff', true, 0.3, 0, e.x, e.y, 0);
        e.x = x0 + jitter(110); e.y = y0 + jitter(110); clampToBounds(e, e.size / 2); swDisplaced(e); moved.push(e);
    }
    if (moved.length) effects.push({ type: 'circle_burst', x: x0, y: y0, radius: 90, color: 'rgba(128, 216, 255, 0.6)', life: 0.35, maxLife: 0.35 });
    riftCollapse(moved, dmg);
};
SPELLS.flicker.castA = (sk, dmg, k, slot) => { const x0 = player.x, y0 = player.y; SPELLS.flicker.cast(sk, dmg, k, slot); spawnEcho(x0, y0, 'image', { t: 0.6, fireAt: 0.4, dmg: dmg * 1.5 }); };
SPELLS.flicker.castB = (sk, dmg, k, slot) => {
    const x0 = player.x, y0 = player.y, R = 110 * reachMult();
    const caught = enemies.filter(e => swOk(e) && !isBossE(e) && Math.hypot(e.x - x0, e.y - y0) < R + e.size / 2);
    SPELLS.flicker.cast(sk, dmg, k, slot);
    const dx = player.x - x0, dy = player.y - y0;
    for (const e of caught) { e.x += dx + jitter(30); e.y += dy + jitter(30); clampToBounds(e, e.size / 2); swDisplaced(e); }
    riftCollapse(caught, dmg);
};
SPELLS.ride_lightning.castA = (sk, dmg) => rideLightning(sk, dmg, (hits, x0, y0) => sw.zones.push({ kind: 'trail', x: x0, y: y0, x1: player.x, y1: player.y, r: 0, t: 3, max: 3, tick: 0.2, dmg }));
SPELLS.ride_lightning.castB = (sk, dmg) => rideLightning(sk, dmg, hits => after(0.3, () => {
    const moved = [];
    for (const e of hits) {
        if (!swOk(e) || isBossE(e)) continue;
        const a = Math.random() * SW_TAU, ex = e.x, ey = e.y;
        e.x = player.x + Math.cos(a) * (player.radius + e.size / 2 + 14); e.y = player.y + Math.sin(a) * (player.radius + e.size / 2 + 14); clampToBounds(e, e.size / 2);
        effects.push({ type: 'lightning', x1: ex, y1: ey, x2: e.x, y2: e.y, color: '#80d8ff', lineWidth: 2, life: 0.2, maxLife: 0.2 });
        e.stunTimer = Math.max(e.stunTimer || 0, 0.4); swDisplaced(e); moved.push(e);
    }
    riftCollapse(moved, dmg);
}));
SPELLS.arcane_anchor.castA = (sk, dmg, k, slot) => {
    const dropping = !sw.anchor; SPELLS.arcane_anchor.cast(sk, dmg, k, slot);
    if (dropping && sw.anchor) { sw.anchor.dop = true; spawnDashGhost('#b388ff', true, ANCHOR_TIME, swAim(), player.x, player.y, 0); }
};
SPELLS.arcane_anchor.castB = (sk, dmg, k, slot) => {
    if (!sw.anchor) {
        const e = swTargetCursor(600);
        cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = devNoCooldowns ? 0 : e ? 0.4 : 0.3;
        if (!e) { swText('No target', player.x, player.y, '#80d8ff'); return; }
        sw.anchor = { e, x: e.x, y: e.y, t: ANCHOR_TIME, slot, born: fxTime };
        effects.push({ type: 'lightning', x1: player.x, y1: player.y, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.2, maxLife: 0.2 });
        return;
    }
    const A = sw.anchor, e = A.e; sw.anchor = null;
    if (!e || e.dead) return;
    if (isBossE(e)) { // too heavy: it pulls you instead
        const x0 = player.x, y0 = player.y, a = Math.atan2(e.y - y0, e.x - x0), d = Math.max(0, Math.hypot(e.x - x0, e.y - y0) - e.size / 2 - player.radius - 12);
        startDash({ x: x0 + Math.cos(a) * d, y: y0 + Math.sin(a) * d, dur: 0.2, ghost: { color: '#80d8ff', glow: true, every: 0.03, life: 0.22 }, onArrive: () => applyDamage(e, dmg, 'magic') });
        swMoved(sk, x0, y0); return;
    }
    const a = Math.atan2(e.y - player.y, e.x - player.x), ex = e.x, ey = e.y;
    e.x = player.x + Math.cos(a) * (player.radius + e.size / 2 + 20); e.y = player.y + Math.sin(a) * (player.radius + e.size / 2 + 20); clampToBounds(e, e.size / 2);
    effects.push({ type: 'lightning', x1: ex, y1: ey, x2: e.x, y2: e.y, color: '#80d8ff', lineWidth: 4, life: 0.25, maxLife: 0.25 });
    applyDamage(e, dmg, 'magic'); if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 0.5); swDisplaced(e);
};

// Time Stop's evolutions. Stasis: the world stops inside the bubble only. Rewind: a snapshot you snap back to.
const inStasis = e => sw.stasis && Math.hypot(e.x - sw.stasis.x, e.y - sw.stasis.y) < sw.stasis.r + (e.size || 0) / 2;
function swHolds(e) { return !!sw.timeStop || !!inStasis(e); }
function swStill(e) { return isSpellbook() && (swHolds(e) || e.swPrisonT > 0 || e.swStillT > 0); }       // main.js enemy loop
function swShotStill(p) { return isSpellbook() && (!!sw.timeStop || !!inStasis(p)); }                    // main.js enemy shots
function releaseHeld(e) {
    const held = e.tsHeld; e.tsHeld = null;
    if (e.dead || !held) return;
    const bonus = swT('sw_accumulate') ? 1.5 : TIMESTOP_BONUS;
    for (const [a, s, ang] of held) applyDamage(e, a * bonus, s, ang);
    burst(e.x, e.y, 0, SW_TAU, Math.min(14, 4 + held.length), { kind: 'spark', color: '#eceff1', size: 2.2, life: 0.35, speed: [100, 300], drag: 5 });
}
SPELLS.time_stop.castA = sk => {
    const [x, y] = swPoint(700), r = 300 * (swT('sw_stasis_wide') ? 1.3 : 1), t = (swT('sw_stasis_long') ? 7 : 5) + 0.25 * (sk.level - 1);
    sw.stasis = { x, y, r, t, max: t };
    effects.push({ type: 'circle_burst', x, y, radius: r, color: 'rgba(176, 190, 197, 0.35)', life: 0.5, maxLife: 0.5 });
};
SPELLS.time_stop.castB = (sk, dmg, k, slot) => {
    const t = swT('sw_quickrw') ? 2 : 3;
    sw.rewind = { x: player.x, y: player.y, hp: player.hp, t, max: t, slot, casts: [], dmg };
    spawnDashGhost('#eceff1', true, t, swAim(), player.x, player.y, 0);
};
function doRewind() {
    const R = sw.rewind; sw.rewind = null; if (!R) return;
    const x0 = player.x, y0 = player.y;
    player.x = R.x; player.y = R.y; player.dash = null; player.z = 0; clampToBounds(player, player.radius);
    player.hp = Math.max(player.hp, R.hp);
    for (let i = 1; i <= 4; i++) if (i !== R.slot) cooldowns[`s${i}`] = 0;
    effects.push({ type: 'blink', x0, y0, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
    if (swT('sw_temporal')) { swImpactFx(player.x, player.y, 150, 'arcane'); swHitCircle(player.x, player.y, 150, R.dmg * 1.5); }
    R.casts.forEach((s, n) => after(0.12 * (n + 1), () => echoCast(s, player.x, player.y, 0.6)));
    swText('REWIND', player.x, player.y - 20, '#eceff1'); addShake(2);
}

// ---------- Abjuration ----------

function swCC(e, kind, t) { // Lockdown's control: Deep Cold, Permafrost's count, and the flag Lingering Chill watches
    if (!swHittable(e) || e.prop) return;
    t *= swT('sw_deepcold') ? 1.3 : 1;
    const key = kind === 'freeze' ? 'frozenTimer' : kind === 'stun' ? 'stunTimer' : 'rootedTimer';
    e[key] = Math.max(e[key] || 0, t); e.swCC = true;
    if (swT('sw_permafrost')) {
        e.swCCLog = (e.swCCLog || []).filter(x => x > fxTime - 10); e.swCCLog.push(fxTime);
        if (e.swCCLog.length >= 3) { e.swCCLog = []; e.frozenTimer = Math.max(e.frozenTimer || 0, isBossE(e) ? 1 : 3); e.swPerma = true; swText('PERMAFROST', e.x, e.y, '#b3e5fc'); }
    }
}
SPELLS.frost_nova.castA = (sk, dmg) => { SPELLS.frost_nova.cast(sk, dmg); sw.iceArmor = 4; };
SPELLS.frost_nova.castB = (sk, dmg) => frostNova(sk, dmg, e => { swCC(e, 'freeze', 1.5); e.swShatter = true; });

SPELLS.arcane_ward.castA = (sk, dmg) => { SPELLS.arcane_ward.cast(sk, dmg); Object.assign(sw.ward, { absorb: 0, res: 0, prev: player.shield }); };
SPELLS.arcane_ward.castB = (sk, dmg) => {
    const e = swTargetCursor(); if (!e) { swText('No target', player.x, player.y, '#b388ff'); return; }
    const t = (isBossE(e) ? 0.75 : 2) * (swT('sw_deepcold') ? 1.3 : 1);
    e.swPrisonT = t; swCC(e, 'stun', 0.05); // the bubble holds it (swStill); this only counts the control
    sw.prisons.push({ e, t, max: t, dmg });
};
SPELLS.spell_mirror.castA = (sk, dmg) => { sw.mirror = { t: 2.5, max: 2.5, dmg, arc: true }; };
SPELLS.spell_mirror.castB = (sk, dmg) => {
    const R = 220;
    for (const e of enemies) {
        if (!swOk(e) || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        if (isBossE(e)) e.swStillT = 0.4 * (swT('sw_deepcold') ? 1.3 : 1); else swCC(e, 'stun', 1);
    }
    for (let i = projectiles.length - 1; i >= 0; i--) { const p = projectiles[i]; if (p.isEnemy && Math.hypot(p.x - player.x, p.y - player.y) < R) { burst(p.x, p.y, 0, SW_TAU, 3, { kind: 'spark', color: '#e1bee7', size: 2, life: 0.2, speed: [60, 140], drag: 5 }); projectiles.splice(i, 1); } }
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: R, color: 'rgba(225, 190, 231, 0.6)', life: 0.35, maxLife: 0.35 });
    swText('COUNTERSPELL', player.x, player.y - 20, '#e1bee7');
};
SPELLS.gravity_well.castA = (sk, dmg) => { sw.zones.push({ kind: 'sing', x: player.x, y: player.y, r: 200, t: 3, max: 3, dmg }); };
SPELLS.gravity_well.castB = (sk, dmg) => { const [x, y] = swPoint(600); sw.zones.push({ kind: 'crush', x, y, r: WELL_R, t: WELL_TIME, max: WELL_TIME, dmg }); };
SPELLS.blizzard.castA = (sk, dmg) => {
    const t = swT('sw_eye_long') ? 8 : 6;
    sw.zones.push({ kind: 'blizzard', x: player.x, y: player.y, r: BLIZZ_R * (swT('sw_eye_wide') ? 1.3 : 1), t, max: t, dmg, chill: new Map(), eye: true, hail: 0.5 });
};
SPELLS.blizzard.castB = (sk, dmg) => { const [x, y] = swPoint(650), t = swT('sw_zero_snap') ? 1 : 2; sw.zones.push({ kind: 'zero', x, y, r: 260, t, max: t, dmg }); };
function zeroShatter(e) { // Absolute Zero: the ice breaks
    const z = e.swZero; e.swZero = null; if (!z || e.dead) return;
    e.frozenTimer = 0;
    effects.push({ type: 'random_ice_spikes', x: e.x, y: e.y, radius: 60, color: '#81d4fa', life: 0.4, maxLife: 0.4, spikes: [{ xOffset: 0, yOffset: 0, size: 22 }, { xOffset: 14, yOffset: -10, size: 14 }, { xOffset: -12, yOffset: 12, size: 14 }] });
    applyDamage(e, z.dmg * 2, 'shatter');
    for (const o of enemies) {
        if (o === e || !swHittable(o) || Math.hypot(o.x - e.x, o.y - e.y) > 100 + o.size / 2) continue;
        if (swT('sw_zero_shards')) applyDamage(o, z.dmg * 0.5, 'magic');
        if (swT('sw_glacier') && !z.refrozen && !o.dead) swCC(o, 'freeze', 1.5);
    }
}

// ---------- hooks from the rest of the game ----------

// combat.js applyDamage, first thing: returns the (raw) amount to deal, or -1 when the hit is held (Time Stop / Stasis)
function swOnDamage(e, amount, source, ang) {
    if (!isSpellbook()) return amount;
    if (swHolds(e) && source !== 'released') { (e.tsHeld || (e.tsHeld = [])).push([amount, source, ang]); e.hitFlash = 0.08; return -1; }
    const dot = source === 'dot' || source === 'shackle';
    if (e.swShatter && e.frozenTimer > 0 && !dot && source !== 'shatter') { // Shatter Nova
        e.swShatter = false; e.frozenTimer = 0; amount *= 2;
        effects.push({ type: 'random_ice_spikes', x: e.x, y: e.y, radius: 50, color: '#81d4fa', life: 0.35, maxLife: 0.35, spikes: [{ xOffset: 0, yOffset: 0, size: 20 }, { xOffset: 12, yOffset: 8, size: 12 }] });
        swText('SHATTER', e.x, e.y, '#b3e5fc');
    }
    if (e.swZero && !dot && source !== 'shatter' && amount >= e.swZero.dmg) after(0, () => zeroShatter(e));
    if (swT('sw_hex') && hasBrand(e)) amount *= 1.15;
    if (swT('sw_brittle') && (e.frozenTimer > 0 || e.stunTimer > 0 || e.rootedTimer > 0 || e.swPrisonT > 0)) amount *= 1.2;
    if (e.swDislocUntil > fxTime) amount *= 1.2;
    if (e.swPerma && !dot) { e.swPerma = false; amount *= 2; }
    const sh = e.brands && e.brands.shackle;
    if (sh && sh.t > 0 && !dot && source !== 'shatter') for (const o of sh.group || []) if (o !== e && !o.dead && o.brands && o.brands.shackle && o.brands.shackle.t > 0) applyDamage(o, amount * 0.3, 'shackle');
    return amount;
}
// talents.js talentsDamageTaken
function swDamageTaken(amount, isContinuous, src) {
    if (!isSpellbook()) return amount;
    if (sw.closeCall > 0) amount *= 0.85;
    if (sw.iceArmor > 0) {
        amount *= 0.8;
        if (!isContinuous && !(src && src.isProjectile)) for (const e of enemies) if (swOk(e) && !isBossE(e) && Math.hypot(e.x - player.x, e.y - player.y) < player.radius + e.size / 2 + 50) e.frozenTimer = Math.max(e.frozenTimer || 0, 1);
    }
    if (swT('sw_runeward') && sw.runes.some(r => Math.hypot(r.x - player.x, r.y - player.y) < 100)) amount *= 0.85;
    if (sw.zones.some(z => z.eye)) amount *= 0.8;
    if (swT('sw_retaliate') && player.shield > 0 && amount >= player.shield && !isContinuous) { // the shield breaks: what broke it freezes
        for (const e of enemies) if (swOk(e) && Math.hypot(e.x - player.x, e.y - player.y) < 160) e.frozenTimer = Math.max(e.frozenTimer || 0, isBossE(e) ? 0.4 : 1);
        effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 160, color: 'rgba(179, 229, 252, 0.6)', life: 0.35, maxLife: 0.35 });
    }
    return amount;
}
// talents.js talentsLethal: Second Chance, then Last Ward
function swLethal() {
    if (!isSpellbook()) return false;
    if (sw.rewind && swT('sw_second')) { player.hp = 1; doRewind(); player.iFrames = Math.max(player.iFrames, 0.5); return true; }
    if (swT('sw_lastward') && fxTime >= sw.lastWardAt + 45) {
        sw.lastWardAt = fxTime; player.hp = 1; player.iFrames = Math.max(player.iFrames, 0.5); swShield(player.maxHp * 0.3, 2);
        swText('LAST WARD', player.x, player.y - 20, '#b388ff'); addShake(3); return true;
    }
    return false;
}
// main.js movement
function swMoveMult() {
    if (!isSpellbook()) return 1;
    let m = 1;
    if (sw.shower > 0 && !swT('sw_shower_steady')) m *= 0.6; // Meteor Shower: you hold the rain
    if (swT('sw_resolve') && player.shield > 0) m *= 1.2;
    return m;
}

// ---------- every frame (spellweaver.js updateSpellweaver, first thing) ----------

function updateSpellEvos(dt) {
    const lp = sw.lastPos; sw.stillT = lp && Math.hypot(player.x - lp.x, player.y - lp.y) < 0.5 ? sw.stillT + dt : 0; sw.lastPos = { x: player.x, y: player.y };
    sw.closeCall = Math.max(0, sw.closeCall - dt); sw.iceArmor = Math.max(0, sw.iceArmor - dt); sw.shower = Math.max(0, sw.shower - dt);
    for (const e of enemies) if (e.tsHeld && !swHolds(e)) releaseHeld(e); // time moves again for them
    if (sw.stasis && (sw.stasis.t -= dt) <= 0) {
        const S = sw.stasis;
        if (swT('sw_shatterpoint')) for (const e of enemies) if (swOk(e) && Math.hypot(e.x - S.x, e.y - S.y) < S.r + e.size / 2) e.stunTimer = Math.max(e.stunTimer || 0, 1.5);
        sw.stasis = null;
    }
    if (sw.rewind && (sw.rewind.t -= dt) <= 0) doRewind();
    if (swDomain()) for (let i = 1; i <= 4; i++) cooldowns[`s${i}`] = Math.max(0, cooldowns[`s${i}`] - dt * 0.3); // Domain: 30% faster
    for (const e of enemies) { // Lockdown: the stillness and the chill after it
        if (e.swStillT > 0) e.swStillT -= dt;
        if (e.swCC && !(e.frozenTimer > 0 || e.stunTimer > 0 || e.rootedTimer > 0)) { e.swCC = false; if (swT('sw_lingering') && !e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); } }
        if (e.swZero && !(e.frozenTimer > 0)) zeroShatter(e);
    }
    for (let i = sw.prisons.length - 1; i >= 0; i--) {
        const P = sw.prisons[i];
        if ((P.t -= dt) > 0 && !P.e.dead) { P.e.swPrisonT = P.t; continue; }
        sw.prisons.splice(i, 1); P.e.swPrisonT = 0;
        if (!P.e.dead) { effects.push({ type: 'circle_burst', x: P.e.x, y: P.e.y, radius: 120, color: 'rgba(179, 136, 255, 0.75)', life: 0.35, maxLife: 0.35 }); swHitCircle(P.e.x, P.e.y, 120, P.dmg); }
    }
    for (let i = sw.echoes.length - 1; i >= 0; i--) {
        const ec = sw.echoes[i]; ec.age += dt;
        if (ec.kind === 'mirror') tauntAround(ec.x, ec.y, 350, 0.2);
        if (ec.kind === 'image' && !ec.fired && ec.age >= ec.fireAt) {
            ec.fired = true; const t = swNearest(ec.x, ec.y, 500);
            if (t) { const a = Math.atan2(t.y - ec.y, t.x - ec.x); projectiles.push({ x: ec.x, y: ec.y, vx: Math.cos(a) * MISSILE_SPEED, vy: Math.sin(a) * MISSILE_SPEED, radius: 7, color: '#e040fb', life: 1.5, type: 'basic', shape: 'arcane_missile', damage: ec.dmg, pierce: false, hitList: [], isEnemy: false, seek: t, customUpdate: missileSeek, spellHit: echoHit }); }
        }
        if (ec.kind === 'legion' && !ec.fired && ec.age >= ec.castAt) { ec.fired = true; echoCast(ec.slot, ec.x, ec.y, 0.4); }
        if (ec.age < ec.t) continue;
        sw.echoes.splice(i, 1);
        if (ec.kind === 'mirror') { swImpactFx(ec.x, ec.y, 110, 'arcane'); if (swHitCircle(ec.x, ec.y, 110, ec.dmg) && swT('sw_echores')) addResonance(1); }
    }
    for (let i = sw.branded.length - 1; i >= 0; i--) {
        const e = sw.branded[i];
        if (!e.brands) { sw.branded.splice(i, 1); continue; }
        if (e.dead) { // Contagious: the brands pass on
            if (swT('sw_contagious')) for (const [kind, b] of Object.entries(e.brands)) {
                if (b.t <= 0) continue;
                let best = null, bd = 250; for (const o of enemies) { if (!swOk(o) || o === e) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
                if (best) { effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: best.x, y2: best.y, color: BRAND_COLOR[kind], life: 0.2, maxLife: 0.2 }); brandEnemy(best, kind, b.dmg, BRAND_TIME[kind], kind === 'shackle' ? { group: [best] } : {}); }
            }
            e.brands = null; sw.branded.splice(i, 1); continue;
        }
        if (swStill(e)) continue; // brands wait with their bearer
        for (const [kind, b] of Object.entries(e.brands)) {
            if (kind === 'storm' && (b.tick -= dt) <= 0) { b.tick += 0.5; stormZap(e, b.dmg); }
            if ((b.t -= dt) <= 0) { delete e.brands[kind]; brandEnd(e, kind, b); }
        }
        if (!Object.keys(e.brands).length) { e.brands = null; sw.branded.splice(i, 1); }
    }
    const w = sw.ward; // Absorption Ward: what the shield soaks up
    if (w && w.absorb !== undefined) {
        const lost = w.prev - player.shield;
        if (lost > 0 && w.t > 0.05) { w.absorb += lost; while (w.absorb >= (w.res + 1) * 20) { w.res++; addResonance(1); } }
        w.prev = player.shield;
    }
    const wall = sw.runes.filter(r => r.wall);
    if (wall.length && swT('sw_wall_barbed')) for (const e of enemies) if (swOk(e) && wall.some(r => Math.hypot(r.x - e.x, r.y - e.y) < 50 + e.size / 2)) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); }
    if (wall.length && swT('sw_curtain')) for (let i = projectiles.length - 1; i >= 0; i--) { const p = projectiles[i]; if (p.isEnemy && wall.some(r => Math.hypot(r.x - p.x, r.y - p.y) < 30)) projectiles.splice(i, 1); }
}

// The zones the evolutions add (spellweaver.js zone loop): true when handled here
function zoneTick(z, dt) {
    if (z.kind === 'thunder' || z.kind === 'zero') return true; // timed by their casts / their end
    if (z.kind === 'circle') { // Ward Circle: enemies can't step in
        for (const e of enemies) { if (!swOk(e) || isBossE(e)) continue; const dx = e.x - z.x, dy = e.y - z.y, d = Math.hypot(dx, dy) || 1, R = z.r + e.size / 2; if (d < R) { e.x = z.x + dx / d * R; e.y = z.y + dy / d * R; clampToBounds(e, e.size / 2); } }
        return true;
    }
    if (z.kind === 'moon') { // Moonfall's shadow
        const pull = swT('sw_moon_pull') ? 140 : 70;
        for (const e of enemies) { if (!swOk(e) || isBossE(e)) continue; const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy); if (d > z.r + e.size / 2 || d < 15) continue; e.x += dx / d * pull * dt; e.y += dy / d * pull * dt; clampToBounds(e, e.size / 2); }
        return true;
    }
    if (z.kind === 'trail') { // Static Trail
        if ((z.tick -= dt) > 0) return true; z.tick += 0.4;
        for (const e of enemies) if (swHittable(e) && distToSegment(e.x, e.y, z.x, z.y, z.x1, z.y1) < e.size / 2 + 24) { applyDamage(e, z.dmg * 0.35, 'magic'); if (!e.dead) e.shockTimer = Math.max(e.shockTimer || 0, 0.5); }
        return true;
    }
    if (z.kind === 'sing') { // Singularity Shield: shots fall in
        z.x = player.x; z.y = player.y;
        for (let i = projectiles.length - 1; i >= 0; i--) { const p = projectiles[i]; if (!p.isEnemy || Math.hypot(p.x - z.x, p.y - z.y) > z.r) continue; burst(p.x, p.y, Math.atan2(z.y - p.y, z.x - p.x), 0.6, 3, { kind: 'spark', color: '#b388ff', size: 2, life: 0.25, speed: [80, 200], drag: 5 }); projectiles.splice(i, 1); }
        return true;
    }
    if (z.kind === 'crush') { // Crushing Well: slow, drag, and more damage toward the centre
        for (const e of enemies) {
            if (!swHittable(e)) continue;
            const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy); if (d > z.r + e.size / 2) continue;
            applyDamage(e, z.dmg * (1 + 2 * Math.max(0, 1 - d / z.r)) * dt, 'dot');
            if (!(e.slowTimer > 0) || e.slowAmount <= 0.4) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = 0.4; }
            if (d > 12 && swOk(e) && !isBossE(e)) { const s = Math.min(d - 10, WELL_PULL * dt); e.x += dx / d * s; e.y += dy / d * s; clampToBounds(e, e.size / 2); }
        }
        return true;
    }
    if (z.kind === 'blizzard' && z.eye) { // Eye of the Storm: it walks with you; shots crawl, hail, whiteout
        z.x = player.x; z.y = player.y;
        for (const p of projectiles) if (p.isEnemy && !p.swSlowed && Math.hypot(p.x - z.x, p.y - z.y) < z.r) { p.swSlowed = true; p.vx *= 0.35; p.vy *= 0.35; if (p.speed) p.speed *= 0.35; p.life *= 2.5; }
        if (swT('sw_whiteout')) for (const e of enemies) if (swOk(e) && !isBossE(e) && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.size / 2) e.blindTimer = Math.max(e.blindTimer || 0, 0.3);
        if (swT('sw_hailstorm') && (z.hail -= dt) <= 0) {
            z.hail += 0.5;
            enemies.filter(e => swOk(e) && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.size / 2).sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y)).slice(0, 3)
                .forEach(e => { applyDamage(e, z.dmg, 'magic'); effects.push({ type: 'random_ice_spikes', x: e.x, y: e.y, radius: 30, color: '#81d4fa', life: 0.3, maxLife: 0.3, spikes: [{ xOffset: 0, yOffset: 0, size: 14 }] }); });
        }
    }
    return false; // the base storm / well / blizzard code runs too
}
function zoneEnd(z) {
    if (z.kind === 'crush') { // the well collapses
        effects.push({ type: 'circle_burst', x: z.x, y: z.y, radius: z.r, color: 'rgba(124, 77, 255, 0.75)', life: 0.4, maxLife: 0.4 });
        for (const e of enemies) {
            if (!swHittable(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.size / 2) continue;
            if (swOk(e) && !isBossE(e)) { e.x = z.x + jitter(50); e.y = z.y + jitter(50); clampToBounds(e, e.size / 2); swCC(e, 'stun', 1.5); }
            applyDamage(e, z.dmg * 1.5, 'magic');
        }
        addShake(2.5);
    } else if (z.kind === 'zero') { // Absolute Zero: everything inside freezes
        effects.push({ type: 'random_ice_spikes', x: z.x, y: z.y, radius: z.r, color: '#81d4fa', life: 0.7, maxLife: 0.7, spikes: Array.from({ length: 22 }, () => { const a = Math.random() * SW_TAU, d = Math.random() * z.r; return { xOffset: Math.cos(a) * d, yOffset: Math.sin(a) * d, size: 10 + Math.random() * 16 }; }) });
        const t = swT('sw_zero_deep') ? 4 : 3;
        for (const e of enemies) {
            if (!swOk(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.size / 2) continue;
            swCC(e, 'freeze', isBossE(e) ? 1 : t); e.swZero = { dmg: z.dmg };
        }
        addShake(3);
    }
}

// ---------- drawing ----------

function drawEvoEffect(ef, p, k) { // spellweaver.js drawSpellEffect
    const c = ctx;
    if (ef.type === 'sw_lob') { // a shot arcing through the air (a fake height: up the screen)
        const x = lerp(ef.x0, ef.x1, p), y = lerp(ef.y0, ef.y1, p) - ef.h * Math.sin(p * Math.PI);
        c.fillStyle = ef.color; c.beginPath(); c.arc(x, y, ef.size, 0, SW_TAU); c.fill();
        c.fillStyle = '#fff3e0'; c.beginPath(); c.arc(x, y, ef.size * 0.45, 0, SW_TAU); c.fill();
        c.fillStyle = 'rgba(0, 0, 0, 0.2)'; c.beginPath(); c.ellipse(lerp(ef.x0, ef.x1, p), lerp(ef.y0, ef.y1, p), ef.size, ef.size * 0.5, 0, 0, SW_TAU); c.fill();
        return true;
    }
    if (ef.type === 'sw_mark') { // where it will land
        c.save(); c.strokeStyle = ef.color; c.globalAlpha = 0.4 + 0.5 * p; c.lineWidth = 2;
        c.beginPath(); c.arc(ef.x, ef.y, ef.radius, 0, SW_TAU); c.stroke();
        c.beginPath(); c.arc(ef.x, ef.y, ef.radius * p, 0, SW_TAU); c.stroke(); c.restore();
        return true;
    }
    if (ef.type === 'sw_cone') { // Flame Burst
        c.save(); c.globalAlpha = k * 0.8; c.fillStyle = ef.color;
        c.beginPath(); c.moveTo(ef.x, ef.y); c.arc(ef.x, ef.y, ef.radius * (0.5 + 0.5 * p), ef.angle - ef.half, ef.angle + ef.half); c.closePath(); c.fill();
        c.fillStyle = '#ffe082'; c.globalAlpha = k * 0.7;
        c.beginPath(); c.moveTo(ef.x, ef.y); c.arc(ef.x, ef.y, ef.radius * (0.3 + 0.4 * p), ef.angle - ef.half * 0.6, ef.angle + ef.half * 0.6); c.closePath(); c.fill(); c.restore();
        return true;
    }
    return false;
}
function drawSpellEvosGround() { // spellweaver.js drawSpellweaverGround
    const c = ctx;
    for (const z of sw.zones) {
        const fade = Math.min(1, (z.max - z.t) / 0.25, z.t / 0.3);
        c.save(); c.globalAlpha = fade;
        if (z.kind === 'thunder') { c.fillStyle = 'rgba(38, 50, 56, 0.3)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.fill(); c.strokeStyle = '#80d8ff'; c.lineWidth = 2; c.stroke(); }
        else if (z.kind === 'circle') { c.fillStyle = 'rgba(255, 213, 79, 0.1)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.fill(); swRuneGlyph(c, z.x, z.y, z.r, '#ffd54f', true, fxTime * 0.5); }
        else if (z.kind === 'moon') { const q = 1 - z.t / z.max; c.fillStyle = `rgba(20, 10, 40, ${0.15 + 0.35 * q})`; c.beginPath(); c.arc(z.x, z.y, z.r * (0.4 + 0.6 * q), 0, SW_TAU); c.fill(); c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.stroke(); }
        else if (z.kind === 'trail') { c.strokeStyle = `rgba(128, 216, 255, ${0.35 + 0.25 * Math.sin(fxTime * 30)})`; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(z.x, z.y); c.lineTo(z.x1, z.y1); c.stroke(); c.strokeStyle = '#e1f5fe'; c.lineWidth = 2; c.stroke(); }
        else if (z.kind === 'sing') { c.fillStyle = 'rgba(49, 27, 146, 0.16)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.fill(); c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.setLineDash([12, 10]); c.lineDashOffset = fxTime * 40; c.stroke(); c.setLineDash([]); }
        else if (z.kind === 'crush') { c.fillStyle = 'rgba(49, 27, 146, 0.25)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.fill(); c.fillStyle = 'rgba(124, 77, 255, 0.3)'; c.beginPath(); c.arc(z.x, z.y, z.r * 0.4, 0, SW_TAU); c.fill(); c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.beginPath(); c.arc(z.x, z.y, z.r * (z.t / z.max), 0, SW_TAU); c.stroke(); }
        else if (z.kind === 'zero') { const q = 1 - z.t / z.max; c.fillStyle = `rgba(179, 229, 252, ${0.1 + 0.25 * q})`; c.beginPath(); c.arc(z.x, z.y, z.r, 0, SW_TAU); c.fill(); c.strokeStyle = '#e1f5fe'; c.lineWidth = 2; c.beginPath(); c.arc(z.x, z.y, z.r * (1 - q), 0, SW_TAU); c.stroke(); }
        else if (z.kind === 'storm' && z.net) { c.strokeStyle = 'rgba(128, 216, 255, 0.55)'; c.lineWidth = 2; for (const r of sw.runes) if (Math.hypot(r.x - z.x, r.y - z.y) < 300) { c.beginPath(); c.moveTo(z.x, z.y); c.lineTo(r.x + jitter(4), r.y + jitter(4)); c.stroke(); } }
        c.restore();
    }
    for (const e of sw.branded) { // the brands under their bearers
        if (!e.brands || e.dead) continue;
        let n = 0;
        for (const [kind, b] of Object.entries(e.brands)) {
            if (b.t <= 0) continue;
            swRuneGlyph(c, e.x, e.y, e.size / 2 + 8 + n * 6, BRAND_COLOR[kind], true, fxTime * (n % 2 ? -2 : 2)); n++;
            if (kind === 'shackle' && b.group) { c.strokeStyle = 'rgba(255, 213, 79, 0.6)'; c.lineWidth = 2; c.setLineDash([5, 4]); for (const o of b.group) if (o !== e && !o.dead) { c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(o.x, o.y); c.stroke(); } c.setLineDash([]); }
        }
    }
    if (sw.stasis) { const S = sw.stasis; c.save(); c.fillStyle = 'rgba(176, 190, 197, 0.18)'; c.beginPath(); c.arc(S.x, S.y, S.r, 0, SW_TAU); c.fill(); c.strokeStyle = 'rgba(236, 239, 241, 0.7)'; c.lineWidth = 2; c.stroke(); c.restore(); }
    if (sw.rewind) { const R = sw.rewind; c.save(); c.strokeStyle = 'rgba(236, 239, 241, 0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(R.x, R.y, 30, -Math.PI / 2, -Math.PI / 2 + SW_TAU * R.t / R.max); c.stroke(); c.restore(); }
}
function drawSpellEvosWorld() { // spellweaver.js drawSpellweaverWorld
    const c = ctx;
    for (const P of sw.prisons) { if (P.e.dead) continue; c.save(); c.globalAlpha = 0.5; c.fillStyle = 'rgba(179, 136, 255, 0.25)'; c.strokeStyle = '#d1c4e9'; c.lineWidth = 2; c.beginPath(); c.arc(P.e.x, P.e.y, P.e.size / 2 + 14, 0, SW_TAU); c.fill(); c.stroke(); c.restore(); }
    if (sw.iceArmor > 0) { c.save(); c.globalAlpha = Math.min(1, sw.iceArmor) * 0.7; c.strokeStyle = '#b3e5fc'; c.lineWidth = 3; c.beginPath(); for (let n = 0; n <= 8; n++) { const a = n * SW_TAU / 8, r = player.radius + (n % 2 ? 10 : 16); c[n ? 'lineTo' : 'moveTo'](player.x + Math.cos(a) * r, player.y + Math.sin(a) * r); } c.stroke(); c.restore(); }
}
