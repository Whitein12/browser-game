// ==========================================
// items.js - Class rare items: the effects that aren't tied to one skill's code
// ==========================================
// Every class has its own five rares (classes.json rareWeapon / rareArmor / rareAmulet / rareBoots / rareGloves).
// Base stats are generic: amulets give their `val` as CDR (combat.js getCDR), boots move speed, gloves attack speed.
// The pattern: the amulet feeds the class gauge or a spell, the boots upgrade the Space skill, the gloves the basics.
// Hooks: itemsOnCast (main.js castSkill), itemsDamageTaken (combat.js takeDamage), itemsOnHit (combat.js applyDamage).
// Effects that live inside one skill (Thunder Leap's reach, Overclock, Storm Arrow...) sit in that skill's code and
// check `hasItem(name)` there; the Druid's are in druid.js.

function hasItem(name) {
    for (const slot of ['weapon', 'armor', 'amulet', 'boots', 'gloves']) if (equipment[slot] && equipment[slot].name === name) return true;
    return false;
}

// ---------- Rare weapon: it awakens ----------
// Bought at +50 Power, it grows +4 for every wave cleared while worn, up to +90. So the first shop is a real choice
// (a T4 common is +45), and the rare still ends above the late commons (T7 +75, T8 +85).
const AWAKEN_START = 0.5, AWAKEN_STEP = 0.04, AWAKEN_MAX = 0.9;
function rareWeaponDesc(val) {
    const pw = Math.round(val * 100);
    const grow = val >= AWAKEN_MAX - 1e-9 ? ' (fully awakened)' : `, awakens +${Math.round(AWAKEN_STEP * 100)} per wave cleared (max +${Math.round(AWAKEN_MAX * 100)})`;
    return `+${pw} Power${grow} | ${activeClass.rareWeapon.desc}`;
}
function rareWeaponItem() {
    return { id: 'rare_wep', name: activeClass.rareWeapon.name, type: 'weapon', val: AWAKEN_START, awaken: wave, desc: rareWeaponDesc(AWAKEN_START), price: 250, rarity: 'rare' }; // awaken: the wave it was bought after
}
// main.js startNextWave: the wave before (wave - 1) was cleared; it counts if the weapon was already bought by then
function awakenWeapon() {
    const w = equipment.weapon;
    if (!w || w.awaken === undefined || wave - 1 <= w.awaken || w.val >= AWAKEN_MAX - 1e-9) return;
    w.val = Math.min(AWAKEN_MAX, w.val + AWAKEN_STEP); w.desc = rareWeaponDesc(w.val);
    effects.push({ type: 'text', text: `${w.name} awakens: +${Math.round(w.val * 100)} Power`, x: player.x, y: player.y - 50, color: '#ffca28', life: 1.6, maxLife: 1.6 });
}

// ---------- On cast (after the skill ran; `before` is where the hero stood and the Zeal they had) ----------

function itemsOnCast(i, before) {
    const n = activeClass.name;
    if (n === 'Dragonknight' && hasItem('Wyrmheart Pendant')) { // each skill cast stokes the Frenzy
        addFrenzy(2);
    }
    if (n === 'Cleric' && hasItem('Reliquary of Dawn and Dusk') && before.zeal >= 100 && !buffs.zealLocked && player.zeal < 25) {
        player.zeal = 25; // a spell cast at full Zeal keeps a quarter of it
        effects.push({ type: 'text', text: '+25 Zeal', x: player.x, y: player.y - 40, color: '#ffd54f', life: 0.7, maxLife: 0.7 });
    }
    if (i !== 3) return;
    if (n === 'Spellweaver' && hasItem('Blinkstep Slippers')) blinkEcho(before.x, before.y);
    else if (n === 'Nightblade' && hasItem('Shadowstep Boots')) shadowPuff(before.x, before.y);
    else if (n === 'Cleric' && hasItem("Pilgrim's Sandals")) pilgrimLight(before.x, before.y);
    else if (n === 'Ranger' && hasItem('Trailblazer Boots')) player.momentum = 0.20; // Vault fills Momentum
    else if (n === 'Machinist' && hasItem('Mag-Lock Boots') && before.anchor) magLock(before.anchor);
}

// Blinkstep Slippers: an arcane echo is left where the Spellweaver blinked from, and bursts a moment later
function blinkEcho(x, y) {
    const sk = activeClass.skills[3], dmg = calcDmg(sk.baseDmg, sk.level);
    effects.push({ type: 'circle_burst', x, y, radius: 40, color: 'rgba(179, 136, 255, 0.6)', life: 0.5, maxLife: 0.5 });
    after(0.5, () => {
        effects.push({ type: 'circle_burst', x, y, radius: 100, color: 'rgba(124, 77, 255, 0.85)', life: 0.35, maxLife: 0.35 });
        burst(x, y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#b388ff', size: 2.2, life: 0.3, speed: [150, 360], drag: 5 });
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= 100 + e.size / 2) applyDamage(e, dmg, 'magic');
    });
}

// Shadowstep Boots: a small Smoke Bomb where the Phantom Dash began (50% evade inside, enemies lose you)
function shadowPuff(x, y) {
    const particles = Array.from({ length: 8 }, () => ({ xOffset: (Math.random() - 0.5) * 60, yOffset: (Math.random() - 0.5) * 60, r: 24 + Math.random() * 20, rotSpeed: (Math.random() - 0.5) * 1.5, startAng: Math.random() * Math.PI * 2 }));
    effects.push({ type: 'smoke_bomb', x, y, radius: 80, color: 'rgba(80, 80, 80, 0.7)', life: 1.5, maxLife: 1.5, poison: false, dmg: 0, particles });
}

// Pilgrim's Sandals: a small Hallowed Ground (80 px, 2 s) where the Cleric phased from; heals like the base zone
function pilgrimLight(x, y) {
    const lvl = activeClass.skills[2].level || 1;
    projectiles.push({
        x, y, vx: 0, vy: 0, radius: 80, color: 'rgba(255, 235, 59, 0.2)', life: 2.0, type: 'hallowed_ground', shape: 'aura', damage: 0, pierce: true, hitList: [], isEnemy: false, tickTimer: 0,
        customUpdate: function(dt, p) {
            p.tickTimer += dt;
            if (p.tickTimer < 0.5) return;
            p.tickTimer = 0;
            if (Math.hypot(player.x - p.x, player.y - p.y) > p.radius) return;
            const heal = calcUtility(5 + player.maxHp * 0.02, lvl);
            player.hp = Math.min(player.maxHp, player.hp + heal);
            effects.push({ type: 'text', x: player.x, y: player.y - 30, text: `+${Math.floor(heal)}`, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
        }
    });
}

// Mag-Lock Boots: grappling onto a turret or coil refreshes it and locks a shield on the Machinist
function magLock(p) {
    if (!projectiles.includes(p)) return;
    p.life = p.type === 'turret' ? (p.maxLife || 10.0) : 8.0;
    addShield(40, 3.0); // combat.js: capped
    effects.push({ type: 'text', text: 'MAG-LOCK', x: p.x, y: p.y - 30, color: '#80d8ff', life: 0.7, maxLife: 0.7 });
}

// ---------- Damage taken (after evades, before armor): returns the new amount, or 0 for a dodge ----------

function itemsDamageTaken(amount, isContinuous) {
    const n = activeClass.name;
    if (n === 'Dragonknight' && hasItem('Dragon Scale Plate') && player.shield > 0) { // the scales hold while a shield does
        amount *= 0.85;
        if (!isContinuous) addFrenzy(1);
    }
    if (n === 'Spellweaver' && hasItem('Robes of the Magi') && player.arcaneResonance > 0) { // mana ward
        if (!isContinuous && amount > 15) player.arcaneResonance--; // a heavy hit breaks a charge on the ward
        amount *= 0.75;
    }
    if (n === 'Ranger' && hasItem('Windrunner Tunic') && !isContinuous && player.momentum >= 0.2 && !(player.windGuardCd > 0)) {
        player.windGuardCd = 4.0; // at full Momentum the wind turns one hit aside
        effects.push({ type: 'text', text: 'Dodged!', x: player.x, y: player.y - 30, color: '#c5e1a5', life: 0.6, maxLife: 0.6 });
        effects.push({ type: 'wind_swirl', x: player.x, y: player.y, radius: 50, color: '#c5e1a5', life: 0.4, maxLife: 0.4 });
        return 0;
    }
    return amount;
}

// ---------- On hit (every hit that landed, from applyDamage) ----------

function itemsOnHit(e, source) {
    if (source === 'melee_basic' && activeClass.name === 'Nightblade' && hasItem('Serrated Grips') && !e.dead) {
        e.bleedTimer = 3.0; e.bleedDmg = calcDmg(activeClass.basicDmg); // a basic's damage per second; refreshes, doesn't stack
    }
}

// ---------- Basic-attack items ----------

// Berserker Gauntlets (Dragonknight) / Gauntlets of Devotion (Paladin): basics heal 1% max HP per enemy hit, 3% at most
function basicHitHeal(hits) {
    if (hits <= 0) return;
    const heal = player.maxHp * 0.01 * Math.min(3, hits);
    player.hp = Math.min(player.maxHp, player.hp + heal);
}

// Dragonknight Frenzy: 10 stacks, 15 with the Wyrmheart Pendant
function frenzyMax() { return hasItem('Wyrmheart Pendant') ? 15 : 10; }
function addFrenzy(n) { player.frenzyStacks = Math.min(frenzyMax(), player.frenzyStacks + n); player.frenzyTimer = 3.0; }

// Spellthread Gloves: every 5th bolt is charged without spending Resonance
function spellthreadCharge() {
    if (!hasItem('Spellthread Gloves')) return false;
    player.spellthread = ((player.spellthread || 0) + 1) % 5;
    return player.spellthread === 0;
}

// Salvager's Gauntlets: every 25 pellets that hit give 1 Scrap
function salvagePellet() {
    if (!hasItem("Salvager's Gauntlets")) return;
    player.salvage = (player.salvage || 0) + 1;
    if (player.salvage < 25) return;
    player.salvage = 0;
    player.scrap = Math.min(SCRAP_MAX, (player.scrap || 0) + 1);
    effects.push({ type: 'text', text: '+1 Scrap', x: player.x, y: player.y - 40, color: '#ffb74d', life: 0.7, maxLife: 0.7 });
}

// Orb of Echoes (Spellweaver): a fourth Resonance charge, and charged bolts explode wider
function resonanceMax() { return hasItem('Orb of Echoes') ? 4 : RESONANCE_MAX; }
function resonanceRadius() { return hasItem('Orb of Echoes') ? RESONANCE_RADIUS * 1.5 : RESONANCE_RADIUS; }
