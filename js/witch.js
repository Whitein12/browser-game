// ==========================================
// witch.js - The Witch: poison, souls and the dead (design and numbers in WITCH.md)
// ==========================================
// The basic is a poison spray: a short cone that hits everything in it and stacks poison (wtPoison). Contagion (the passive): a
// poisoned enemy that dies hands its stacks to its neighbours. Kills leave souls (wt.souls; a Hexed or toad enemy always does,
// a boss sheds one per 10% of its HP); E raises the souls near her as minions (wt.zombies: zombies, or with E's evolutions Grave
// Knights / Skeleton Archers) that fight, draw enemies in with the usual taunt, decay, and can be killed (enemies can only hurt
// the hero, so updateWitch lets them bite minions, and their shots stop on one, witchSoakShot). Q Grave Hex (poison x1.3, a sure
// soul). Space Broom Flight (player.broom: she follows the cursor, airborne, enemy melee can't reach her; the recast lands her).
// An LMB pressed mid-flight leaves a toxic trail (her Space finisher, during the flight, not after it). R Hex of the Toad
// (e.toadT: no AI, +25% damage taken; bosses shrink and slow). RMB Dark Pact (a minion bursts in poison, she heals for its HP).
// The web (talents.js TALENT_WEBS.witch, ids wt_; WITCH.md Step 2): Q Grave Pull / Soul Leech, E Grave Knights / Skeleton
// Archers, Space Swoop / Soul Sweep, R Toad Plague / Familiar Toads. Drawn by witch_fx.js (the state below is its contract).

const WT_SPRAY_RANGE = 150, WT_SPRAY_HALF = Math.PI * 50 / 360, WT_SPRAY_HIT = 0.4; // the cone; 40% of a basic at once, per 0.45 s of spraying
const WT_SPRAY_TICK = 0.1, WT_SPRAY_SHARE = WT_SPRAY_TICK / 0.45; // a steady stream: a tick every 0.1 s, each the share of a 0.45 s spray (the same damage a second)
const WT_POISON_TIME = 3, WT_POISON_MAX = 5, WT_POISON_GLOVES = 8; // a stack: one basic over 3 s; a new stack refreshes the timer
const WT_CONTAGION_R = 120, WT_CONTAGION_N = 3;
const WT_SOUL_CHANCE = 0.35, WT_SOUL_AMULET = 1.5, WT_SOUL_LIFE = 15, WT_SOUL_REACH = 450, WT_SOUL_FAR = 650, WT_SOUL_MIN = 2, WT_BOSS_SHED = 0.1;
const WT_HEX_R = 110, WT_HEX_WIDE = 150, WT_HEX_RANGE = 500, WT_HEX_TIME = 6, WT_HEX_LONG = 9, WT_HEX_POISON = 1.3;
const WT_ZOMBIE_MAX = 6, WT_ZOMBIE_HP = 0.3, WT_ZOMBIE_DECAY = 0.05, WT_ZOMBIE_R = 13;
const WT_ZOMBIE_SEEK = 420, WT_ZOMBIE_RISE = 0.6, WT_BITE_GAP = 1;
const WT_BROOM_TIME = 1.8, WT_BROOM_RANK_TIME = 0.2, WT_BROOM_BOOTS = 0.7, WT_BROOM_SPEED = 500, WT_BROOM_RANK_SPEED = 0.06; // each rank: +0.2 s, +6% speed
const WT_BROOM_TURN = 8, WT_BROOM_Z = 22, WT_BROOM_GAP = 0.2; // the turn rate grows with the speed, so the turning circle stays the same
const WT_TRAIL_LINGER = 3, WT_TRAIL_DPS = 1.2, WT_TRAIL_W = 26, WT_TRAIL_STACK = 0.5;
const WT_TOAD_R = 180, WT_TOAD_WIDE = 230, WT_TOAD_RANGE = 600, WT_TOAD_TIME = 4, WT_TOAD_LONG = 5.5, WT_TOAD_VULN = 1.25, WT_TOAD_SPEED = 0.4, WT_BOSS_SLOW = 0.4, WT_BOSS_SHRINK = 3;
const WT_PACT_R = 140, WT_PACT_MULT = 3, WT_PACT_CD = 6;

// The minions E raises: zombies, or with its evolutions armed Grave Knights (A, the front line) or Skeleton Archers (B, damage
// from behind her). hp / dmg multiply the zombie's (30% of her Max HP, E's base a swing); gap is the swing or shot interval.
const WT_KINDS = {
    zombie: { name: 'Zombies', hp: 1, dmg: 1, gap: 0.9, taunt: 180, speed: 110 },
    knight: { name: 'Grave Knights', hp: 1.5, dmg: 1.8, gap: 0.9, taunt: 260, speed: 115 },
    archer: { name: 'Skeletons', hp: 0.7, dmg: 1.6, gap: 1.1, taunt: 0, speed: 130, range: 450 },
};
const WT_ARROW_SPEED = 700, WT_RAIN_EVERY = 6, WT_RAIN_R = 120, WT_RAIN_DELAY = 0.6;
const WT_CLEAVE_HALF = Math.PI / 3, WT_KNIGHT_GUARD = 0.65, WT_CHARGE_SPEED = 520, WT_CHARGE_STUN = 0.8;

const wt = { souls: [], zombies: [], arrows: [], moves: [], sprayAt: -9, sprayAng: 0, rainT: WT_RAIN_EVERY, leech: 0 };
function resetWitch() {
    wt.souls = []; wt.zombies = []; wt.arrows = []; wt.moves = []; wt.rainT = WT_RAIN_EVERY;
    if (player.broom) { player.broom = null; player.z = 0; }
    player.wtSwoop = false;
}
const wtAim = () => Math.atan2(mouseY - player.y, mouseX - player.x);
const wtTargetable = e => !e.dead && !e.submerged && !(e.spawnT > 0) && !(e.flyUntil > fxTime);
const wtLiving = e => wtTargetable(e) && !e.pod && !e.prop; // what minions hunt and what the Hex takes
const wtIsBoss = e => isBossE(e);
const wtHexed = e => e.wtHex > fxTime || e.toadT > 0;
const wtUpg = slot => activeClass.skills[slot].selectedUpg;
function wtText(text, x, y, color) { effects.push({ type: 'text', text, x, y, color, life: 0.8, maxLife: 0.8 }); }
function wtCursor(range) { // the cursor, pulled in to the spell's reach
    const [dx, dy, d] = getVector(player.x, player.y, mouseX, mouseY), k = Math.min(1, range / d);
    return clampPointToMap(player.x + dx * k, player.y + dy * k, 10);
}
function wtInCone(e, ang, range, half, ox = player.x, oy = player.y) { // widened by the body's own angular size, so big enemies are easy to hit
    const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy), r = e.size / 2;
    if (d > range + r) return false;
    if (d <= r + 12) return true;
    let diff = Math.atan2(dy, dx) - ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) <= half + Math.asin(Math.min(1, r / d));
}
function wtShove(e, ang, dist, time = 0.2) { // a short knockback (bosses barely move, props not at all)
    if (e.dead || e.pod || e.prop || e.airborne) return;
    if (wtIsBoss(e)) dist *= 0.25;
    wt.moves.push({ e, vx: Math.cos(ang) * dist / time, vy: Math.sin(ang) * dist / time, t: time });
}
function wtStun(e, t) { if (!wtIsBoss(e) && !e.pod && !e.prop) e.stunTimer = Math.max(e.stunTimer || 0, t); }
function wtSlow(e, amt, t = 0.2) { if (!(e.slowTimer > 0) || (e.slowAmount || 0) <= amt) { e.slowAmount = amt; e.slowTimer = Math.max(e.slowTimer || 0, t); } }

// ---------- poison ----------

const wtPoisonMax = () => hasItem('Blightweaver Gloves') ? WT_POISON_GLOVES : WT_POISON_MAX;
// n stacks of a basic's poison (dmg: a basic's calcDmg); ticked in updateWitch
function wtPoison(e, dmg, n = 1) {
    if (e.dead || e.pod || e.prop) return;
    const p = e.wtPoison || (e.wtPoison = { n: 0, t: 0, per: 0 });
    p.n = Math.min(wtPoisonMax(), p.n + n); p.t = WT_POISON_TIME; p.per = Math.max(p.per, dmg / WT_POISON_TIME); // n can be a fraction: the stream builds stacks gradually
}
const wtBasic = () => calcDmg(activeClass.basicDmg);

// ---------- the basic: Poison Spray ----------

BasicAttackRegistry['blightstaff'] = (dmg) => witchSpray(dmg);
// Held LMB: a steady stream (main.js repeats the basic as its cooldown runs out; this sets the tick, attack speed shortens it, as
// machinist.js maMinigun does). Each tick is a fraction of the old 0.45 s spray: a fraction of the hit and of a poison stack.
function witchSpray(dmg) {
    const a = wtAim();
    cooldowns.basic = cooldownMax.basic = WT_SPRAY_TICK / (1 + attackSpeedBonus()); // even with no cooldowns: a stream every frame would be 6x the damage
    wt.sprayAt = fxTime; wt.sprayAng = a; // witch_fx.js draws the stream while it flows
    for (const e of enemies.slice()) if (wtTargetable(e) && wtInCone(e, a, WT_SPRAY_RANGE, WT_SPRAY_HALF)) {
        applyDamage(e, dmg * WT_SPRAY_HIT * WT_SPRAY_SHARE, 'spray', a); wtPoison(e, dmg, WT_SPRAY_SHARE);
    }
}

// ---------- souls ----------

function dropSoul(x, y) { wt.souls.push({ x: x + jitter(10), y: y + jitter(10), t: 0, life: WT_SOUL_LIFE, seed: Math.random() * 6.28 }); }
const soulReach = () => hasTalent('wt_raise_far') ? WT_SOUL_FAR : WT_SOUL_REACH;
const soulsNear = () => wt.souls.filter(s => Math.hypot(s.x - player.x, s.y - player.y) <= soulReach());

// combat.js checkEnemyDeath (before a dummy's early return, so the Training Room's dummies leave souls too): Contagion and a soul
function witchOnKill(e) {
    if (activeClass.name !== 'Witch' || e.pod || e.prop) return;
    const p = e.wtPoison;
    if (p && p.n > 0) { // Contagion: the stacks jump to the nearest neighbours, each with a fresh timer
        const near = enemies.filter(o => o !== e && wtLiving(o) && Math.hypot(o.x - e.x, o.y - e.y) <= WT_CONTAGION_R + o.size / 2)
            .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, WT_CONTAGION_N);
        for (const o of near) {
            const q = o.wtPoison || (o.wtPoison = { n: 0, t: 0, per: 0 });
            q.n = Math.min(wtPoisonMax(), q.n + p.n); q.t = WT_POISON_TIME; q.per = Math.max(q.per, p.per);
            effects.push({ type: 'wt_contagion', x: e.x, y: e.y, x2: o.x, y2: o.y, life: 0.35, maxLife: 0.35 });
        }
        e.wtPoison = null;
    }
    if (e.toadT > 0 && e.wtToadKind === 'plague') toadBurst(e); // Toad Plague: a toad killed bursts at once
    if (wtIsBoss(e) || e.wtNoSoul) return; // a boss sheds its souls while it's hurt (witchOnDamage); Forever Yours raises it instead
    if (wtHexed(e) && wtUpg(1) === 'B' && hasTalent('wt_leech_siphon')) { // Soul Siphon
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.05); dropSoul(e.x, e.y); dropSoul(e.x, e.y);
        effects.push({ type: 'wt_leech', x: e.x, y: e.y, life: 0.5, maxLife: 0.5 });
        return;
    }
    const grave = effects.find(g => g.type === 'wt_grave' && Math.hypot(e.x - g.x, e.y - g.y) <= g.r + e.size / 2);
    if (grave && raiseMinion(e.x, e.y)) return; // Open Grave: it rises at once, no soul needed
    if (wtHexed(e) || e.wtReaped || Math.random() < WT_SOUL_CHANCE * (hasItem('Bone Phylactery') ? WT_SOUL_AMULET : 1)) dropSoul(e.x, e.y);
}

// combat.js applyDamage, after the HP comes off: a boss sheds a soul for every 10% of its HP it loses
function witchOnDamage(e, dealt) {
    if (!wtIsBoss(e) || e.pod || e.prop || dealt <= 0) return;
    e.wtShed = (e.wtShed || 0) + dealt;
    while (e.wtShed >= e.maxHp * WT_BOSS_SHED) { e.wtShed -= e.maxHp * WT_BOSS_SHED; const a = Math.random() * Math.PI * 2; dropSoul(e.x + Math.cos(a) * (e.size / 2 + 20), e.y + Math.sin(a) * (e.size / 2 + 20)); }
}
// talents.js talentDmgMult: a toad takes +25% from everything you do
function witchDmgMult(e) { return e.toadT > 0 ? WT_TOAD_VULN : 1; }

// ---------- Q: Grave Hex (A Grave Pull, B Soul Leech) ----------

const hexRadius = () => hasTalent('wt_hex_wide') ? WT_HEX_WIDE : WT_HEX_R;
function witchQ(sk, dmg) {
    const [x, y] = wtCursor(WT_HEX_RANGE), R = hexRadius(), pull = wtUpg(1) === 'A', time = hasTalent('wt_hex_long') ? WT_HEX_LONG : WT_HEX_TIME;
    effects.push({ type: 'wt_hex', x, y, r: R, pull, leech: wtUpg(1) === 'B', life: 0.9, maxLife: 0.9 });
    const caught = [];
    for (const e of enemies.slice()) if (wtLiving(e) && Math.hypot(e.x - x, e.y - y) <= R + e.size / 2) {
        e.wtHex = fxTime + time;
        applyDamage(e, dmg, 'spell', Math.atan2(e.y - y, e.x - x));
        if (!e.dead) caught.push(e);
    }
    if (pull) gravePull(x, y, caught, dmg);
    addShake(1.5);
}
// Grave Pull: hands out of the ground drag everything caught to the circle's centre (bosses are only tugged)
function gravePull(x, y, caught, dmg) {
    for (const e of caught) {
        const [dx, dy, d] = getVector(e.x, e.y, x, y), stop = e.size / 2 + 6, go = wtIsBoss(e) ? Math.min(40, d) : Math.max(0, d - stop - Math.random() * 14);
        if (go > 1 && !e.pod && !e.prop && !e.airborne) wt.moves.push({ e, vx: dx / d * go / 0.3, vy: dy / d * go / 0.3, t: 0.3 });
        if (hasTalent('wt_pull_root')) { if (!wtIsBoss(e)) e.rootedTimer = Math.max(e.rootedTimer || 0, 1.5); } // Grasping Hands
        if (hasTalent('wt_pull_miasma')) wtPoison(e, wtBasic(), 2); // Choking Miasma
    }
    if (hasTalent('wt_pull_crush')) after(0.3, () => { // Crushing Grip
        effects.push({ type: 'wt_crush', x, y, r: hexRadius() * 0.6, life: 0.4, maxLife: 0.4 });
        for (const e of caught) if (wtLiving(e)) applyDamage(e, dmg, 'spell', Math.atan2(e.y - y, e.x - x));
        addShake(2.5);
    });
    if (hasTalent('wt_pull_grave')) effects.push({ type: 'wt_grave', x, y, r: 90, life: 4, maxLife: 4, // Open Grave
        customUpdate: (dt, g) => { for (const e of enemies) if (wtLiving(e) && Math.hypot(e.x - g.x, e.y - g.y) <= g.r + e.size / 2) wtSlow(e, 0.5); } });
}
// Soul Leech: poison on a hexed enemy heals her (at most 3% Max HP a second); Shared Feast mends the minions, Hoarded Life banks the rest
function soulLeech(dealt) {
    const pct = hasTalent('wt_leech_deep') ? 0.25 : 0.15;
    const heal = Math.min(dealt * pct, wt.leech); if (heal <= 0) return;
    wt.leech -= heal;
    const room = player.maxHp - player.hp;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    if (heal > room && hasTalent('wt_leech_hoard')) addShield(heal - room, 4, 0.15); // combat.js: capped at 15% of Max HP
    if (hasTalent('wt_leech_feast')) for (const z of wt.zombies) if (z.rise <= 0 && Math.hypot(z.x - player.x, z.y - player.y) <= 300) z.hp = Math.min(z.max, z.hp + heal);
}

// ---------- E: Raise Dead (A Grave Knights, B Skeleton Archers) ----------

const minionKind = () => wtUpg(2) === 'A' ? 'knight' : wtUpg(2) === 'B' ? 'archer' : 'zombie';
const minionHp = (r = Math.max(1, activeClass.skills[2].level), kind = minionKind()) => player.maxHp * WT_ZOMBIE_HP * calcUtility(1, r) * WT_KINDS[kind].hp * (hasTalent('wt_raise_tough') ? 1.3 : 1);
const minionHit = (r = Math.max(1, activeClass.skills[2].level), kind = minionKind()) => calcDmg(activeClass.skills[2].baseDmg, r) * WT_KINDS[kind].dmg;
// One minion rising at (x, y); null when the horde is full. Every raise goes through here (E, Soul Sweep, Open Grave, Forever Yours)
function raiseMinion(x, y) {
    if (wt.zombies.length >= WT_ZOMBIE_MAX) return null;
    const kind = minionKind(), hp = minionHp(undefined, kind);
    const z = { kind, x, y, hp, max: hp, rise: WT_ZOMBIE_RISE, swingT: 0.3, swingAt: -9, hitAt: -9, tauntT: 0, ang: Math.atan2(y - player.y, x - player.x), walk: Math.random() * 6,
        target: null, seed: Math.random() * 6.28, lives: kind === 'knight' && hasTalent('wt_knight_undying') ? 1 : 0, charged: false, shots: 0 };
    wt.zombies.push(z);
    effects.push({ type: 'wt_raise', x, y, kind, life: 0.7, maxLife: 0.7 });
    return z;
}
function witchE(sk, dmg) {
    const room = WT_ZOMBIE_MAX - wt.zombies.length;
    const souls = soulsNear().sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, room);
    for (const s of souls) { wt.souls.splice(wt.souls.indexOf(s), 1); raiseMinion(s.x, s.y); }
    effects.push({ type: 'wt_call', x: player.x, y: player.y, r: soulReach(), life: 0.5, maxLife: 0.5 });
}
function zombieFalls(z, burst_) {
    if (!burst_ && z.lives > 0) { // Undying Legion: a knight gets back up once
        z.lives--; z.hp = z.max / 2; z.rise = WT_ZOMBIE_RISE; z.target = null;
        effects.push({ type: 'wt_raise', x: z.x, y: z.y, kind: z.kind, life: 0.7, maxLife: 0.7 });
        return;
    }
    wt.zombies.splice(wt.zombies.indexOf(z), 1);
    effects.push({ type: 'wt_zombie_fall', x: z.x, y: z.y, angle: z.ang, kind: z.kind, burst: !!burst_, life: burst_ ? 0.5 : 0.9, maxLife: burst_ ? 0.5 : 0.9 });
}
function hurtMinion(z, amount) { // an enemy's bite or shot (the hero's 0.6 damage cut applies to minions too)
    z.hp -= amount * 0.6 * (z.kind === 'knight' && hasTalent('wt_knight_guard') ? WT_KNIGHT_GUARD : 1); z.hitAt = fxTime;
    if (z.hp <= 0) zombieFalls(z);
}

function updateZombies(dt) {
    const hit = minionHit();
    for (const z of wt.zombies.slice()) {
        if (z.rise > 0) { z.rise -= dt; continue; } // still clawing its way out
        const K = WT_KINDS[z.kind], archer = z.kind === 'archer';
        z.hp -= z.max * WT_ZOMBIE_DECAY * dt;
        if (z.hp <= 0) { zombieFalls(z); continue; }
        const seek = archer ? K.range : WT_ZOMBIE_SEEK;
        if (!z.target || !wtLiving(z.target) || Math.hypot(z.target.x - z.x, z.target.y - z.y) > seek * 1.3) {
            z.target = null; let bd = seek;
            for (const e of enemies) if (wtLiving(e)) { const d = Math.hypot(e.x - z.x, e.y - z.y) - e.size / 2; if (d < bd) { bd = d; z.target = e; } }
        }
        const t = z.target;
        let tx = player.x, ty = player.y, stop = 70, sp = K.speed; // nothing to fight: shamble after her
        if (archer) { // archers keep their own spot round her, a little behind, and shoot from there
            const a = z.seed + fxTime * 0.15, r = 70 + (z.seed % 1) * 30;
            tx = player.x + Math.cos(a) * r; ty = player.y + Math.sin(a) * r; stop = 12;
        } else if (!t) z.charging = false;
        else {
            tx = t.x; ty = t.y; stop = t.size / 2 + WT_ZOMBIE_R + 4;
            const d0 = Math.hypot(t.x - z.x, t.y - z.y);
            if (z.kind === 'knight' && hasTalent('wt_knight_charge') && !z.charged && d0 > 60 && d0 < 260) z.charging = true; // Charge
            if (z.charging) sp = WT_CHARGE_SPEED;
        }
        const [dx, dy, d] = getVector(z.x, z.y, tx, ty);
        z.moving = d > stop;
        if (z.moving) { const s = Math.min(d - stop, sp * dt); z.x += dx / d * s; z.y += dy / d * s; z.walk += s * 0.08; }
        else if (z.charging && t) { z.charging = false; z.charged = true; wtStun(t, WT_CHARGE_STUN); applyDamage(t, hit, 'minion', z.ang); z.swingT = K.gap; z.swingAt = fxTime; effects.push({ type: 'wt_charge_hit', x: t.x, y: t.y, angle: z.ang, life: 0.3, maxLife: 0.3 }); }
        if (t) z.ang = Math.atan2(t.y - z.y, t.x - z.x); else if (z.moving) z.ang = Math.atan2(dy, dx);
        for (const o of wt.zombies) if (o !== z && o.rise <= 0) { // the horde spreads out a little
            const [ox, oy, od] = getVector(o.x, o.y, z.x, z.y), min = WT_ZOMBIE_R * 2;
            if (od < min) { z.x += ox / od * (min - od) * 0.5; z.y += oy / od * (min - od) * 0.5; }
        }
        for (const e of enemies) if (!e.dead && !e.pod && !e.submerged && !e.airborne) { // never inside a body
            const [ox, oy, od] = getVector(e.x, e.y, z.x, z.y), min = e.size / 2 + WT_ZOMBIE_R;
            if (od < min) { z.x += ox / od * (min - od); z.y += oy / od * (min - od); }
        }
        clampToBounds(z, WT_ZOMBIE_R);
        if ((z.swingT -= dt) <= 0 && t) {
            if (archer) { if (Math.hypot(t.x - z.x, t.y - z.y) <= K.range + t.size / 2) { z.swingT = K.gap; z.swingAt = fxTime; skeletonShot(z, t, hit); } }
            else if (Math.hypot(t.x - z.x, t.y - z.y) <= t.size / 2 + WT_ZOMBIE_R + 10) {
                z.swingT = K.gap; z.swingAt = fxTime;
                if (z.kind === 'knight' && hasTalent('wt_knight_cleave')) { // Cleave: the swing takes everything in its arc
                    for (const e of enemies.slice()) if (wtTargetable(e) && wtInCone(e, z.ang, WT_ZOMBIE_R + 34, WT_CLEAVE_HALF, z.x, z.y)) applyDamage(e, hit, 'minion', z.ang);
                } else applyDamage(t, hit, 'minion', z.ang);
            }
        }
        if (K.taunt && (z.tauntT -= dt) <= 0) { // it draws the non-bosses near it (main.js: a taunted enemy walks to it and holds its attack)
            z.tauntT = 0.5;
            for (const e of enemies) {
                if (!wtLiving(e) || wtIsBoss(e) || e.toadT > 0 || (e.state && e.state !== 'idle' && !e.dummy)) continue;
                const d2 = Math.hypot(e.x - z.x, e.y - z.y);
                if (d2 > K.taunt + e.size / 2) continue;
                if (e.tauntTimer > 0 && e.wtTaunt && e.wtTaunt !== z && wt.zombies.includes(e.wtTaunt) && Math.hypot(e.x - e.wtTaunt.x, e.y - e.wtTaunt.y) < d2) continue; // the nearer one keeps it
                e.tauntTimer = 0.6; e.tauntX = z.x; e.tauntY = z.y; e.wtTaunt = z;
            }
        }
    }
    // Enemies touching a minion bite it (bosses too), once a second each
    for (const e of enemies) {
        if (e.wtBite > 0) { e.wtBite -= dt; continue; }
        if (e.dead || e.pod || e.prop || e.submerged || e.toadT > 0 || !(e.dmg > 0) || e.stunTimer > 0 || e.frozenTimer > 0 || e.spawnT > 0) continue;
        for (const z of wt.zombies) {
            if (z.rise > 0 || Math.hypot(e.x - z.x, e.y - z.y) > e.size / 2 + WT_ZOMBIE_R + 14) continue;
            e.wtBite = WT_BITE_GAP; hurtMinion(z, e.dmg);
            break;
        }
    }
    updateArrows(dt);
    // Bone Rain: every 6 s the archers loose together into the sky, and it all comes down on their target's ground
    if (wtUpg(2) === 'B' && hasTalent('wt_skel_rain') && (wt.rainT -= dt) <= 0) {
        const archers = wt.zombies.filter(z => z.kind === 'archer' && z.rise <= 0 && z.target && wtLiving(z.target));
        if (archers.length) {
            wt.rainT = WT_RAIN_EVERY;
            const t = archers[0].target, x = t.x, y = t.y, dmg = hit * 2 * archers.length;
            effects.push({ type: 'wt_bone_rain', x, y, r: WT_RAIN_R, n: archers.length, life: WT_RAIN_DELAY + 0.3, maxLife: WT_RAIN_DELAY + 0.3 });
            after(WT_RAIN_DELAY, () => { for (const e of enemies.slice()) if (wtTargetable(e) && Math.hypot(e.x - x, e.y - y) <= WT_RAIN_R + e.size / 2) applyDamage(e, dmg, 'minion'); addShake(2); });
        } else wt.rainT = 0.5;
    }
}
// A skeleton's arrow (its own little list: it flies, sticks in the first enemy, or pierces one with Bodkin)
function skeletonShot(z, t, hit) {
    const lead = Math.hypot(t.x - z.x, t.y - z.y) / WT_ARROW_SPEED, tx = t.x + (t.vx || 0) * lead, ty = t.y + (t.vy || 0) * lead;
    const a = Math.atan2(ty - z.y, tx - z.x), volley = hasTalent('wt_skel_volley') && ++z.shots % 3 === 0; // Split Shot: every third shot is three
    for (const off of volley ? [-0.16, 0, 0.16] : [0]) wt.arrows.push({ x: z.x, y: z.y, vx: Math.cos(a + off) * WT_ARROW_SPEED, vy: Math.sin(a + off) * WT_ARROW_SPEED, life: (WT_KINDS.archer.range + 60) / WT_ARROW_SPEED, dmg: hit, pierce: hasTalent('wt_skel_pierce') ? 1 : 0, hit: [] });
}
function updateArrows(dt) {
    for (let i = wt.arrows.length - 1; i >= 0; i--) {
        const p = wt.arrows[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if ((p.life -= dt) <= 0 || (currentMap.grid && shotHitsWall(p))) { wt.arrows.splice(i, 1); continue; }
        for (const e of enemies) {
            if (!wtTargetable(e) || p.hit.includes(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.size / 2 + 4) continue;
            p.hit.push(e); applyDamage(e, p.dmg, 'minion', Math.atan2(p.vy, p.vx));
            if (hasTalent('wt_skel_venom')) wtPoison(e, wtBasic(), 0.5); // Venom Tips
            if (p.pierce-- <= 0) { p.life = 0; break; }
        }
        if (p.life <= 0) wt.arrows.splice(i, 1);
    }
}
// main.js enemy shots: one that crosses a minion stops on it (ground-landing throws don't count, as for the hero)
function witchSoakShot(p) {
    if (!wt.zombies.length || p.type === 'trap_throw' || p.type === 'spore' || p.type === 'sling_stone' || p.type === 'firepot') return false;
    for (const z of wt.zombies) {
        if (z.rise > 0 || Math.hypot(p.x - z.x, p.y - z.y) > WT_ZOMBIE_R + (p.radius || 4)) continue;
        hurtMinion(z, p.damage || 0);
        return true;
    }
    return false;
}

// ---------- Space: Broom Flight (A Swoop, B Soul Sweep) ----------

const broomLevel = () => Math.max(1, activeClass.skills[3].level);
const broomTime = (r = broomLevel()) => WT_BROOM_TIME + WT_BROOM_RANK_TIME * (r - 1) + (hasItem('Midnight Broom') ? WT_BROOM_BOOTS : 0); // ui.js RANK_STATS
const broomSpeed = (r = broomLevel()) => WT_BROOM_SPEED * (1 + WT_BROOM_RANK_SPEED * (r - 1));
const swoopRadius = () => hasTalent('wt_swoop_wide') ? 180 : 130;
function witchSpace(sk, dmg) {
    if (player.broom) return wtUpg(3) === 'A' ? witchSwoop(dmg) : witchLand(); // the recast lands her early (Swoop: dives)
    player.dash = null; player.grappleTarget = null; player.charge = null;
    player.broom = { t: 0, max: broomTime(), speed: broomSpeed(), ang: wtAim(), castAt: fxTime, trail: null, bank: 0, gathered: 0 };
    cooldowns.s3 = cooldownMax.s3 = devNoCooldowns ? 0 : WT_BROOM_GAP; // the full cooldown starts when she lands
    effects.push({ type: 'wt_takeoff', x: player.x, y: player.y, life: 0.45, maxLife: 0.45 });
}
// main.js movement, in place of WASD: she flies on, turning toward the cursor
function witchFly(dt) {
    const b = player.broom;
    b.t += dt;
    let diff = wtAim() - b.ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const rate = WT_BROOM_TURN * b.speed / WT_BROOM_SPEED, turn = Math.max(-rate * dt, Math.min(rate * dt, diff));
    b.ang += turn; b.bank += ((dt > 0 ? turn / dt / rate : 0) - b.bank) * Math.min(1, dt * 8); // leaning into the turn (witch_fx.js)
    player.x += Math.cos(b.ang) * b.speed * dt; player.y += Math.sin(b.ang) * b.speed * dt;
    const up = Math.min(1, b.t / 0.15, Math.max(0, b.max - b.t) / 0.15);
    player.z = 5 + (WT_BROOM_Z - 5) * up; // above 4 from the first frame: airborne over ravines, lakes, boulders and traps
    clampToBounds(player, player.radius);
    if (b.trail) { const tr = b.trail, last = tr.pts[tr.pts.length - 1]; if (!last || Math.hypot(player.x - last.x, player.y - last.y) >= 24) tr.pts.push({ x: player.x, y: player.y, t: fxTime }); }
    if (wtUpg(3) === 'B') soulSweep(b);
    if (b.t >= b.max) witchLand();
}
function endFlight(b) { // what any end of a flight does: the trail stops growing, the cooldown starts
    player.broom = null;
    if (b.trail) { b.trail.pts.push({ x: player.x, y: player.y, t: fxTime }); b.trail.flying = false; }
    cooldowns.s3 = cooldownMax.s3 = devNoCooldowns ? 0 : skillBaseCd(3, activeClass.skills[3].level) * getCDR();
}
function witchLand() {
    const b = player.broom; if (!b) return;
    endFlight(b); player.z = 0;
    clearLanding({ angle: b.ang }); // skillfx_space.js: never down inside a body
    clampToBounds(player, player.radius);
    effects.push({ type: 'wt_land', x: player.x, y: player.y, life: 0.4, maxLife: 0.4 });
    landed(b);
}
function landed(b) { // after a landing or a Swoop's crash
    if (hasTalent('wt_broom_after')) buffs.msBoost = Math.max(buffs.msBoost || 0, 2); // Afterglide: +50% move speed (main.js)
    if (b.gathered > 0) { // Soul Sweep: the souls she gathered rise round her at once
        for (let i = 0; i < b.gathered; i++) {
            const a = b.ang + Math.PI + (i - (b.gathered - 1) / 2) * 0.7, x = player.x + Math.cos(a) * 45, y = player.y + Math.sin(a) * 45;
            if (!raiseMinion(x, y)) dropSoul(x, y); // the horde is full: they wait on the ground
        }
        effects.push({ type: 'wt_call', x: player.x, y: player.y, r: 120, life: 0.5, maxLife: 0.5 });
    }
    if (wtUpg(3) === 'B' && hasTalent('wt_sweep_fresh')) for (const z of wt.zombies) if (z.rise <= 0) z.hp = z.max; // Fresh Recruits
}
const witchAloft = () => !!player.broom; // main.js: no body push; combat.js takeDamage: only shots reach her up there

// Swoop: the recast dives her at the cursor (250 px at most) and she crashes down: a hit and two poison stacks round her, a shove
function witchSwoop(dmg) {
    const b = player.broom, [tx, ty] = (() => { const [dx, dy, d] = getVector(player.x, player.y, mouseX, mouseY), k = Math.min(1, 250 / d); return [player.x + dx * k, player.y + dy * k]; })();
    endFlight(b); player.wtSwoop = true; // sprites.js keeps the side view through the dive
    startDash({ x: tx, y: ty, dur: 0.28, z0: player.z, arc: 26, ease: 'out', kind: 'wt_swoop', // no dash ghosts: they'd be the top-down sprite
        onArrive: () => { player.wtSwoop = false; swoopCrash(dmg); landed(b); } });
}
function swoopCrash(dmg) {
    const R = swoopRadius(), basic = wtBasic(); let hits = 0;
    effects.push({ type: 'wt_swoop_crash', x: player.x, y: player.y, r: R, life: 0.5, maxLife: 0.5 });
    for (const e of enemies.slice()) if (wtTargetable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= R + e.size / 2) {
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        applyDamage(e, dmg, 'spell', a); wtPoison(e, basic, 2); wtShove(e, a, 80);
        if (hasTalent('wt_swoop_stun')) wtStun(e, 0.8); // Brutal Landing
        if (!e.pod && !e.prop) hits++;
    }
    if (hasTalent('wt_swoop_saddle') && hits) cooldowns.s3 = Math.max(0, cooldowns.s3 - Math.min(3, hits * 0.5)); // Back in the Saddle
    if (hasTalent('wt_swoop_crater')) wtPool(player.x, player.y, 150, 4, 0); // Toxic Crater
    addShake(5);
}
// Soul Sweep: the broom gathers the souls it passes; Soul Warmth heals for each, Reaper's Ride reaps the nearly dead below her
function soulSweep(b) {
    const reach = hasTalent('wt_sweep_wide') ? 120 : 60;
    for (let i = wt.souls.length - 1; i >= 0; i--) {
        const s = wt.souls[i]; if (Math.hypot(s.x - player.x, s.y - player.y) > reach) continue;
        wt.souls.splice(i, 1); b.gathered++;
        effects.push({ type: 'wt_soul_gather', x: s.x, y: s.y, life: 0.35, maxLife: 0.35 });
        if (hasTalent('wt_sweep_warm')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02);
    }
    if (hasTalent('wt_sweep_reap')) for (const e of enemies.slice()) {
        if (!wtLiving(e) || wtIsBoss(e) || e.dummy && training.immortal || e.hp > e.maxHp * 0.15 || Math.hypot(e.x - player.x, e.y - player.y) > e.size / 2 + 30) continue;
        e.wtReaped = true; effects.push({ type: 'wt_reap', x: e.x, y: e.y, angle: b.ang, life: 0.4, maxLife: 0.4 });
        e.hp = 0; checkEnemyDeath(e);
    }
}

// The Space finisher (main.js, in place of the basic while she flies): a fresh LMB press after take-off pours a toxic trail out
// behind her for the rest of the flight. Holding the button from before the cast does nothing (combos.js comboPressOk's rule).
function witchBroomClick() {
    const b = player.broom;
    if (!isMouseDown || b.trail || lmbPressedAt < b.castAt) return;
    const dmg = wtBasic(), fumes = hasTalent('wt_broom_fumes'); // Lasting Fumes
    b.trail = { type: 'wt_trail', pts: [{ x: player.x, y: player.y, t: fxTime }], flying: true, life: 99, maxLife: 99, w: WT_TRAIL_W * (fumes ? 1.4 : 1), linger: fumes ? 5 : WT_TRAIL_LINGER, dps: dmg * WT_TRAIL_DPS, dmg,
        customUpdate: (dt, ef) => {
            while (ef.pts.length && fxTime - ef.pts[0].t > ef.linger) ef.pts.shift();
            ef.life = ef.flying || ef.pts.length ? 99 : 0;
            if (ef.pts.length < 2) return;
            for (const e of enemies) {
                if (e.dead || e.pod || e.prop || e.submerged || e.airborne) continue;
                let inside = false;
                for (let i = 1; i < ef.pts.length && !inside; i++) inside = distToSegment(e.x, e.y, ef.pts[i - 1].x, ef.pts[i - 1].y, ef.pts[i].x, ef.pts[i].y) <= ef.w + e.size / 2;
                if (!inside) continue;
                applyDamage(e, ef.dps * dt, 'dot');
                if (!e.dead && fxTime - (e.wtTrailAt || -9) >= WT_TRAIL_STACK) { e.wtTrailAt = fxTime; wtPoison(e, ef.dmg); }
            }
        } };
    effects.push(b.trail);
    comboText(); // combos.js
}

// A poison pool on the ground (Toxic Crater, Plague Pond): a poison stack every 0.5 s to everything in it, and a slow
function wtPool(x, y, r, time, slow) {
    const dmg = wtBasic();
    effects.push({ type: 'wt_pool', x, y, r, life: time, maxLife: time, tick: 0, slow,
        customUpdate: (dt, ef) => {
            const tick = (ef.tick -= dt) <= 0; if (tick) ef.tick = 0.5;
            for (const e of enemies) if (wtLiving(e) && !e.airborne && Math.hypot(e.x - ef.x, e.y - ef.y) <= ef.r + e.size / 2) {
                if (tick) wtPoison(e, dmg);
                if (ef.slow) wtSlow(e, ef.slow);
            }
        } });
}

// ---------- R: Hex of the Toad (A Toad Plague, B Familiar Toads) ----------

const toadRadius = () => hasTalent('wt_toad_wide') ? WT_TOAD_WIDE : WT_TOAD_R;
function witchR(sk, dmg) {
    const [x, y] = wtCursor(WT_TOAD_RANGE), R = toadRadius(), kind = wtUpg(4) === 'A' ? 'plague' : wtUpg(4) === 'B' ? 'fam' : null;
    const time = (hasTalent('wt_toad_long') ? WT_TOAD_LONG : WT_TOAD_TIME) + (kind === 'fam' && hasTalent('wt_fam_loyal') ? 2 : 0); // Loyal
    effects.push({ type: 'wt_toad_hex', x, y, r: R, kind, life: 0.8, maxLife: 0.8 });
    for (const e of enemies.slice()) {
        if (!wtLiving(e) || e.airborne || Math.hypot(e.x - x, e.y - y) > R + e.size / 2) continue;
        if (wtIsBoss(e)) { e.wtShrinkT = WT_BOSS_SHRINK; wtText('SHRUNK', e.x, e.y - e.size / 2 - 14, '#b2ff59'); } // too strong a will: it shrinks and slows (the boss dummy too)
        else toadify(e, time, kind, dmg);
        applyDamage(e, dmg, 'spell', Math.atan2(e.y - y, e.x - x));
    }
    addShake(2.5);
}
function toadify(e, time, kind, dmg) {
    e.toadT = time; e.wtHop = null; e.tauntTimer = 0; e.wtToadKind = kind; e.wtToadDmg = dmg; e.wtBiteT = 0.4;
    effects.push({ type: 'wt_poof', x: e.x, y: e.y, r: e.size, life: 0.45, maxLife: 0.45 });
}
// main.js enemy loop, after the DoTs: a toad does nothing but hop about (no AI, no attacks, no body push); a familiar hunts its old allies
function witchToad(e, dt) {
    if (!(e.toadT > 0)) return false;
    if ((e.toadT -= dt) <= 0) { toadEnds(e); return e.dead; }
    const fam = e.wtToadKind === 'fam';
    let prey = null;
    if (fam) { // Familiar Toads: it hops at the nearest of its old allies and bites
        let bd = 400;
        for (const o of enemies) if (o !== e && wtLiving(o) && !(o.toadT > 0)) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; prey = o; } }
        if (prey && bd <= prey.size / 2 + e.size / 2 + 30 && (e.wtBiteT -= dt) <= 0) { // its tongue reaches 30 px past the bodies
            e.wtBiteT = 0.8; e.wtBiteAt = fxTime; e.wtBiteTo = prey;
            applyDamage(prey, e.wtToadDmg * 0.15, 'minion', Math.atan2(prey.y - e.y, prey.x - e.x));
            if (hasTalent('wt_fam_venom')) wtPoison(prey, wtBasic()); // Venomous Bite
        }
        if (hasTalent('wt_fam_lure') && (e.wtLureT = (e.wtLureT || 0) - dt) <= 0) { // Croaking Lure
            e.wtLureT = 0.5;
            for (const o of enemies) if (o !== e && wtLiving(o) && !wtIsBoss(o) && !(o.toadT > 0) && Math.hypot(o.x - e.x, o.y - e.y) <= 200 + o.size / 2 && (!o.state || o.state === 'idle' || o.dummy)) { o.tauntTimer = 0.6; o.tauntX = e.x; o.tauntY = e.y; }
        }
    }
    const h = e.wtHop;
    if (!h || (h.t -= dt) <= -0.4) e.wtHop = { ang: prey ? Math.atan2(prey.y - e.y, prey.x - e.x) : Math.random() * Math.PI * 2, t: 0.35 }; // a hop, then a sit
    else if (h.t > 0 && !(prey && Math.hypot(prey.x - e.x, prey.y - e.y) <= prey.size / 2 + e.size / 2 + 14)) {
        const s = (e.speed || 60) * (fam ? 0.9 : WT_TOAD_SPEED) * 2.1 * dt; e.x += Math.cos(h.ang) * s; e.y += Math.sin(h.ang) * s;
    }
    clampToBounds(e, e.size / 2);
    return true;
}
function toadEnds(e) {
    e.toadT = 0; e.wtHop = null;
    effects.push({ type: 'wt_poof', x: e.x, y: e.y, r: e.size, life: 0.45, maxLife: 0.45 });
    if (e.wtToadKind === 'plague') toadBurst(e);
    else if (e.wtToadKind === 'fam' && hasTalent('wt_fam_forever') && wt.zombies.length < WT_ZOMBIE_MAX && !(e.dummy && training.immortal)) { // Forever Yours
        const x = e.x, y = e.y; e.wtNoSoul = true; e.hp = 0; checkEnemyDeath(e); raiseMinion(x, y);
    }
    e.wtToadKind = null;
}
// Toad Plague: a toad bursts in a poison cloud when the hex ends (or it dies): R's hit x0.5 and poison round it
function toadBurst(e) {
    if (e.wtBurst === fxTime) return; e.wtBurst = fxTime;
    const R = hasTalent('wt_plague_big') ? 130 : 90, stacks = hasTalent('wt_plague_virulent') ? 4 : 2, basic = wtBasic(), dmg = (e.wtToadDmg || 0) * 0.5;
    effects.push({ type: 'wt_toad_burst', x: e.x, y: e.y, r: R, life: 0.5, maxLife: 0.5 });
    for (const o of enemies.slice()) {
        if (!wtTargetable(o) || Math.hypot(o.x - e.x, o.y - e.y) > R + o.size / 2) continue;
        if (o !== e) applyDamage(o, dmg, 'spell', Math.atan2(o.y - e.y, o.x - e.x));
        wtPoison(o, basic, stacks);
        if (hasTalent('wt_plague_chain') && o !== e && !o.dead && !(o.toadT > 0) && !o.wtChained && !wtIsBoss(o) && !o.pod && !o.prop && !o.airborne) { o.wtChained = true; toadify(o, 2, 'plague', e.wtToadDmg); } // Chain Croak
    }
    if (hasTalent('wt_plague_pond')) wtPool(e.x, e.y, 70, 4, 0.3); // Plague Pond
}
// main.js enemy draw: a shrunk boss is drawn smaller (1 = as usual)
function witchShrink(e) { return e.wtShrinkT > 0 ? 1 - 0.3 * Math.min(1, e.wtShrinkT / 0.3, (WT_BOSS_SHRINK - e.wtShrinkT) / 0.2) : 1; } // shrinks fast, grows back at the end

// ---------- RMB: Dark Pact ----------

function witchRmb() {
    let z = null, bd = 1e9;
    for (const o of wt.zombies) if (o.rise <= 0) { const d = Math.hypot(o.x - mouseX, o.y - mouseY); if (d < bd) { bd = d; z = o; } }
    if (!z) { cooldowns.rmb = 0; wtText('No minion', player.x, player.y - 40, '#ff5252'); return; }
    cooldowns.rmb = cooldownMax.rmb = devNoCooldowns ? 0 : WT_PACT_CD * getCDR();
    const dmg = wtBasic(), heal = Math.max(0, z.hp);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    zombieFalls(z, true);
    effects.push({ type: 'wt_pact', x: z.x, y: z.y, r: WT_PACT_R, x2: player.x, y2: player.y, life: 0.6, maxLife: 0.6 });
    if (heal >= 1) wtText(`+${Math.round(heal)}`, player.x, player.y - 36, '#69f0ae');
    for (const e of enemies.slice()) if (wtTargetable(e) && Math.hypot(e.x - z.x, e.y - z.y) <= WT_PACT_R + e.size / 2) {
        applyDamage(e, dmg * WT_PACT_MULT, 'spell', Math.atan2(e.y - z.y, e.x - z.x)); wtPoison(e, dmg, 2);
    }
    addShake(3);
}

// combat.js takeDamage: up on the broom only shots reach her; the Shroud of the Coven thins every hit by her living dead
function witchDamageTaken(amount, isContinuous, sourceObj) {
    if (player.broom && !isContinuous && !(sourceObj && sourceObj.isProjectile)) return 0;
    if (hasItem('Shroud of the Coven')) amount *= 1 - Math.min(0.2, 0.04 * wt.zombies.length);
    return amount;
}

// ---------- every frame (main.js update) ----------

function updateWitch(dt) {
    if (activeClass.name !== 'Witch') return;
    for (let i = wt.souls.length - 1; i >= 0; i--) { const s = wt.souls[i]; s.t += dt; if ((s.life -= dt) <= 0) wt.souls.splice(i, 1); }
    const leech = wtUpg(1) === 'B';
    if (leech) wt.leech = Math.min(player.maxHp * 0.03, wt.leech + player.maxHp * 0.03 * dt); // Soul Leech heals at most 3% Max HP a second
    for (const e of enemies) {
        const p = e.wtPoison;
        if (p && p.n > 0 && !e.dead) {
            if ((p.t -= dt) <= 0) e.wtPoison = null;
            else {
                const hexed = wtHexed(e), amt = p.n * p.per * dt * (hexed ? WT_HEX_POISON : 1);
                applyDamage(e, amt, 'dot');
                if (leech && hexed) soulLeech(amt * HIT_SCALE);
            }
        }
        if (e.wtShrinkT > 0 && !e.dead) { // the toad's curse on a boss: slowed while it shrinks
            wtSlow(e, WT_BOSS_SLOW, dt * 2 + 0.02);
            e.wtShrinkT = Math.max(0, e.wtShrinkT - dt);
        }
    }
    for (let i = wt.moves.length - 1; i >= 0; i--) { // shoves and the Grave Pull's drag
        const m = wt.moves[i];
        if (m.e.dead || (m.t -= dt) < 0) { wt.moves.splice(i, 1); continue; }
        m.e.x += m.vx * dt; m.e.y += m.vy * dt; clampToBounds(m.e, m.e.size / 2);
    }
    updateZombies(dt);
}

window.SkillRegistry.Witch = { 1: witchQ, 2: witchE, 3: witchSpace, 4: witchR, rmb: witchRmb,
    canCast: slot => { // Raise Dead needs souls near her and room in the horde (the cooldown stays unspent)
        if (slot !== 2) return true;
        if (wt.zombies.length >= WT_ZOMBIE_MAX) { wtText('The horde is full', player.x, player.y - 40, '#ff5252'); return false; }
        if (soulsNear().length >= WT_SOUL_MIN) return true;
        wtText('Not enough souls', player.x, player.y - 40, '#ff5252'); return false;
    } };
