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

// ---------- Gear: bought at the merchant, raised at the smith (CAMPAIGN.md step 3) ----------
// An item is { id, name, type, rarity, up, base, val, desc, price, spent }: `up` is its +N, `base` its stat at +0 and
// `val` the stat now (itemVal), kept on the item so every reader of item.val works as before. The step per +1 and the
// commons' catalogue are in items.json ("gear"). The name never changes (hasItem checks it); itemName adds the +N.
const GEAR_SLOT_LIST = ['weapon', 'armor', 'amulet', 'boots', 'gloves'];
const gearCfg = (type, rarity) => itemDataConfig.gear[type][rarity === 'rare' ? 'rare' : 'common'];
function itemStep(item) { return gearCfg(item.type, item.rarity).step * (item.type === 'armor' ? armorHpMult() : 1); } // combat.js: armor scales with the class's HP
function itemVal(item) { return Math.round((item.base + item.up * itemStep(item)) * 1000) / 1000; }
function itemName(item) { return item.name + (item.up > 0 ? ` +${item.up}` : ''); }
function rareOf(type) { return activeClass[{ weapon: 'rareWeapon', armor: 'rareArmor', amulet: 'rareAmulet', boots: 'rareBoots', gloves: 'rareGloves' }[type]]; }
function rareFx(item) { // a rare's effect text, read from the class (the Druid's swaps wolf for jaguar there); its first segment is the stat, which we show ourselves
    const r = rareOf(item.type); if (!r || r.name !== item.name) return '';
    if (item.type === 'weapon') return r.desc;
    const parts = r.desc.split(' | '), c = parts[0].indexOf(',');
    return (c >= 0 ? parts[0].slice(c + 2) + ' | ' : '') + parts.slice(1).join(' | ');
}
function itemDesc(item) { const fx = item.rarity === 'rare' ? rareFx(item) : ''; return fmtStat(item.type, item.val) + (fx ? ' | ' + fx : ''); } // ui.js fmtStat
function refreshItem(item) { item.val = itemVal(item); item.desc = itemDesc(item); return item; }
const commonName = type => { const g = gearCfg(type, 'common'); return (g.names && activeClass && g.names[activeClass.weapon]) || g.name; }; // the weapon follows the class (a Witch's staff, not an Iron Sword)
function makeCommon(type) {
    const g = gearCfg(type, 'common'), base = type === 'armor' ? Math.round(g.base * armorHpMult()) : g.base;
    return refreshItem({ id: Math.random().toString(36).substr(2, 9), name: commonName(type), type, rarity: 'common', up: 0, base, val: base, desc: '', price: g.price, spent: g.price });
}
function makeRare(type, up = 0) { // the class's own rare (its stat can be overridden in classes.json "val")
    const r = rareOf(type), g = gearCfg(type, 'rare');
    const base = type === 'armor' ? Math.round(g.base * armorHpMult()) : (r.val || g.base);
    return refreshItem({ id: 'rare_' + type.slice(0, 3), name: r.name, type, rarity: 'rare', up, base, val: base, desc: '', price: g.price, spent: g.price });
}
// The rare weapon's awakening is retired: its +50 -> +90 Power is the upgrade path (+0 to +10)

// Upgrades: +5 until the Slime Caves are cleared, +10 after (Quick Play: +10 once in the Bandit Bastion)
function upgradeCap() {
    const u = itemDataConfig.upgrade;
    if (heroData) return (heroData.cleared || []).includes('slime_caves') ? u.capCaves : u.capStart; // save.js
    return activeDungeonId === 'bandit_bastion' ? u.capCaves : u.capStart;
}
function upgradeCost(item) { return Math.max(5, Math.round(item.price * itemDataConfig.upgrade.costRate * (item.up + 1) * smithRate() / 5) * 5); } // sidequests.js: the smith's favour (x0.85); upgradeItem adds the price paid to `spent`, so selling stays half of it
function upgradeItem(item) { // the smith: one +1 for gold; false when capped or too poor
    if (item.up >= upgradeCap() || player.gold < upgradeCost(item)) return false;
    const c = upgradeCost(item); player.gold -= c; item.spent = (item.spent || item.price) + c; item.up++;
    refreshItem(item); recalcStats(); return true;
}
function sellPrice(item) { return Math.floor((item.spent || item.price || 0) * 0.5); } // half of everything put into it

// save.js applyHero: an item from before the smith (tiered names, no `up`) becomes +0 of its slot's common, or of the class rare it was
function migrateItem(it) {
    if (!it) return it;
    if (it.up !== undefined && it.base !== undefined) { if (it.rarity !== 'rare' && it.type === 'weapon') it.name = commonName('weapon'); return refreshItem(it); } // saves from when every common weapon was an Iron Sword
    const r = it.type && rareOf(it.type);
    if (!GEAR_SLOT_LIST.includes(it.type)) return null;
    if (it.rarity === 'rare' && r && r.name === it.name) return makeRare(it.type, it.type === 'weapon' && it.val > 0.5 ? Math.min(10, Math.round((it.val - 0.5) / 0.04)) : 0); // a half-awakened weapon keeps its Power
    return makeCommon(it.type);
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
    if (n === 'Nightblade' && hasItem('Shadowstep Boots')) shadowPuff(before.x, before.y);
    else if (n === 'Cleric' && hasItem("Pilgrim's Sandals")) pilgrimLight(before.x, before.y);
    else if (n === 'Ranger' && hasItem('Trailblazer Boots')) player.momentum = 0.20; // Vault fills Momentum
    else if (n === 'Machinist' && hasItem('Mag-Lock Boots') && before.anchor) magLock(before.anchor);
}

// Blinkstep Slippers: an arcane echo is left where any movement spell took the Spellweaver from (spellweaver.js swMoved), and bursts a moment later
function blinkEcho(x, y, dmg) {
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
