// ==========================================
// combat.js - Damage, XP, and Loot Logic
// ==========================================

// Core balance knobs (see BALANCE.md)
const RANK_SCALE = 0.2;                  // each skill rank past 1 adds 20% of the base (rank 4 = x1.6)
const ORB_DMG = 0.04, ORB_DMG_CAP = 0.8; // power orbs: +4 Power each, +80 at most (Power adds up, so they're worth twice the old multiplier)
const MAX_CDR = 0.6;                     // cooldowns never drop below 40%
const ARMOR_K = 20;                      // armor blocks armor / (armor + 20) of every hit
const BOSS_CC_RATE = 3;                  // bosses shake off stun, root, freeze and blind 3x as fast
const BOSS_WEAK_MULT = 1.5;              // Nightblade weak points on a boss deal x1.5 (an assassin's specialty is the big target)
const WARDEN_ORB_GAP = 0.25, WARDEN_ORB_REGROW = 6; // Slime Warden: one orb pops per 0.25 s; a lost orb regrows every 6 s

function armorReduction(armor) { return armor > 0 ? armor / (armor + ARMOR_K) : 0; }

// Power: one additive number for everything that raises damage (100 Power = x1). Every hit deals base x rank x Power / 100.
// The parts, so the Tab sheet can list where it comes from: [label, amount as a fraction, temporary?]
function powerParts() {
    const n = activeClass.name, P = [['Class base', activeClass.dmgMult]];
    if (equipment.weapon) P.push([equipment.weapon.name, equipment.weapon.val]);
    if (n === 'Dragonknight' && player.frenzyStacks > 0) P.push([`Frenzy &times;${player.frenzyStacks}`, player.frenzyStacks * 0.02, true]);
    if (n === 'Ranger' && player.momentum > 0) P.push(['Momentum', player.momentum, true]);
    if (n === 'Cleric' && buffs.aspectOfReaper > 0) P.push(['Aspect of the Reaper', 0.50, true]);
    if (n === 'Cleric' && buffs.ascension > 0) P.push(['Ascension', 0.25, true]);
    if (player.orbDmg > 0) P.push([`Power orbs${player.orbDmg >= ORB_DMG_CAP ? ' (max)' : ''}`, player.orbDmg]);
    if (player.bonusDmg > 0) P.push(['Blessings', player.bonusDmg]);
    return P;
}
function powerMult() { return powerParts().reduce((s, p) => s + p[1], 0); }
function playerPower() { return Math.round(powerMult() * 100); }

function calcDmg(baseAmount, skillLevel = 1) {
    let finalDmg = calcUtility(baseAmount, skillLevel) * powerMult();
    if (buffs.weakened > 0) finalDmg *= 0.7;
    return finalDmg;
}
// What a hit really deals (applyDamage scales every player hit by HIT_SCALE): for tooltips, cards and the Tab sheet
const HIT_SCALE = 0.6;
function hitDmg(baseAmount, skillLevel = 1) { return calcDmg(baseAmount, skillLevel) * HIT_SCALE; }

function calcUtility(baseAmount, skillLevel = 1) {
    return baseAmount + (skillLevel > 1 ? (skillLevel - 1) * (baseAmount * RANK_SCALE) : 0);
}

// Shield breakers (Shatter Breath, Desecration): break a Bandit frontal shield, or pop every Slime Warden orb at once
// (it's stunned as if the last orb popped; the orbs regrow as usual)
function shatterShields(e) {
    let broke = false;
    if (e.shieldHp > 0) { e.shieldHp = 0; broke = true; }
    if (e.type === 'slime_warden' && e.orbs > 0) { e.orbs = 0; e.orbRegrow = 0; e.invulnTimer = 0; e.stunTimer = Math.max(e.stunTimer || 0, 2.0); broke = true; }
    if (broke) effects.push({ type: 'text', text: 'SHIELD BROKEN', x: e.x, y: e.y - 30, color: '#9c27b0', life: 1.0, maxLife: 1.0 });
    return broke;
}

// Every shield goes through here: stacked shields stop at half the max HP (one big shield still lands whole)
const SHIELD_CAP = 0.5;
function addShield(amount, time) {
    const cap = Math.max(player.maxHp * SHIELD_CAP, amount);
    if (player.shield < cap) player.shield = Math.min(cap, player.shield + amount);
    player.shieldTimer = Math.max(player.shieldTimer, time);
}

function pickUpDmgOrb() { player.orbDmg = Math.min(ORB_DMG_CAP, (player.orbDmg || 0) + ORB_DMG); }

function calcCooldown(baseCd, skillLevel = 1) {
    // Reduces cooldowns by 15% to 30% dynamically based on skill level.
    return baseCd * Math.max(0.4, (1 - ((skillLevel > 1 ? skillLevel - 1 : 0) * 0.15)));
}

// Only dashes (Space) and the Kensei's stance toggle get shorter with rank; every other skill keeps its base cooldown
function rankScalesCooldown(slot) { return slot === 3 || (activeClass.name === 'Kensei' && slot === 2); }
function skillBaseCd(slot, level) {
    const sk = activeClass.skills[slot];
    return rankScalesCooldown(slot) ? calcCooldown(sk.maxCd, level) : sk.maxCd;
}

function getCDR() {
    let cdr = 1.0;
    if (equipment.amulet) cdr -= equipment.amulet.val; // every amulet's val is its CDR (class rares: 20%)
    if (activeClass && activeClass.name === 'Cleric' && buffs.aspectOfReaper > 0) cdr -= 0.50; // Aspect of the Reaper -50% CD
    return Math.max(1 - MAX_CDR, cdr);
}

// Armor HP scales with the class's own base HP, so fragile classes stay fragile when geared; the tanks' 240 is the cap
// (Nightblade x0.62, Spellweaver/Kensei x0.77, Ranger/Cleric/Druid x0.92, Machinist/Paladin/Dragonknight x1)
const ARMOR_HP_REF = 130;
function armorHpMult() { return Math.min(1, activeClass.baseMaxHp / ARMOR_HP_REF); }

function generateItem(tierLevel) {
    const types = itemDataConfig.slots;
    const type = types[Math.floor(Math.random() * types.length)];
    const tier = Math.max(1, Math.ceil(tierLevel / 2));
    const slotData = itemDataConfig.slotData[type];
    let val = (slotData.valBase || 0) + tier * slotData.valMult; // T8 roughly matches the class rare's stat
    if (type === 'armor') val = Math.round(val * armorHpMult());
    let displayVal = (type === 'weapon' || type === 'gloves' || type === 'amulet') ? Math.round(val * 100) : Math.round(val);
    return { id: Math.random().toString(36).substr(2, 9), name: `T${tier} ${slotData.namePrefix}`, type, val, desc: slotData.descTemplate.replace('{VAL}', displayVal), price: tier * 25, rarity: 'common' };
}

function applyDamage(enemy, amount, source = 'player', projAngle = null) {
    if (enemy.dead || enemy.submerged) return; // the Amalgam's Undertow: nothing reaches it under the floor (no IMMUNE spam)
    amount *= HIT_SCALE; // Global player damage reduction

    if (source === 'melee_basic') hitStopTimer = 0.04;
    if (enemy.isStaggered) amount *= 2.0;
    if (player.tether && player.tether.target === enemy) amount *= SHACKLE_VULN; // paladin.js Divine Tether: a shackled enemy takes +20% from you

    if (enemy.invulnerable) { // immune phases stop everything, weak points included (and the mark isn't wasted)
        effects.push({ type: 'text', text: 'IMMUNE', x: enemy.x, y: enemy.y - 20, color: '#03a9f4', life: 0.6, maxLife: 0.6 });
        return;
    }

    const weak = weakPointDamage(enemy, source, projAngle); // Nightblade: true damage on top, and the hit goes through blocks
    if (queenLastStand(enemy, amount + weak) || valeriusLastStand(enemy, amount + weak) || kingLastStand(enemy, amount + weak)) return;

    if (!weak) {
        if (enemy.type === 'slime_warden' && enemy.orbs > 0) {
            if (enemy.invulnTimer > 0) return; // an orb just popped: the rest still shield, so a multi-hit can't strip them all at once
            enemy.orbs--; enemy.invulnTimer = WARDEN_ORB_GAP; enemy.orbRegrow = 0;
            effects.push({ type: 'text', text: 'SHIELDED', x: enemy.x, y: enemy.y - 20, color: '#ffca28', life: 0.6, maxLife: 0.6 });
            if (enemy.orbs === 0) {
                enemy.stunTimer = 2.0;
                effects.push({ type: 'text', text: 'STUNNED', x: enemy.x, y: enemy.y - 30, color: '#ffeb3b', life: 1.0, maxLife: 1.0 });
            }
            return;
        }

        if (enemy.type === 'boss_valerius' && source !== 'dot' && valDodge(enemy)) return; // ai.js: he reads the blow and steps aside
        if (enemy.type === 'boss_champ_warden' && source !== 'dot') amount = wardenBulwark(enemy, amount); // ai.js: the tower shield turns blows from the front
        if (enemy.type === 'thief' && Math.random() < 0.20) {
            enemy.dodgeAt = fxTime; enemy.dodgeSide = Math.random() < 0.5 ? -1 : 1; // bandits.js draws the sidestep
            effects.push({ type: 'text', text: 'Evaded!', x: enemy.x, y: enemy.y - 20, color: '#fff', life: 0.6, maxLife: 0.6 }); return;
        }

        if (enemy.type === 'shield' && enemy.shieldHp > 0) {
            const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            let diff = enemy.facingAngle - angleToPlayer;
            while(diff < -Math.PI) diff += Math.PI*2;
            while(diff > Math.PI) diff -= Math.PI*2;
            if (Math.abs(diff) < Math.PI / 2.5) {
                enemy.shieldHp -= amount;
                effects.push({ type: 'text', text: 'Blocked', x: enemy.x, y: enemy.y - 20, color: '#78909c', life: 0.6, maxLife: 0.6 });
                if (enemy.shieldHp <= 0) effects.push({ type: 'text', text: 'SHIELD BROKEN', x: enemy.x, y: enemy.y - 30, color: '#ffeb3b', life: 1.0, maxLife: 1.0 });
                return;
            }
        }
    }

    if (enemy.reflective) takeDamage(amount * 0.5);

    enemy.hp -= amount + weak;
    spawnHitFx(enemy, source, projAngle);
    if (activeClass.name === 'Druid') druidOnHit(enemy, source); // druid.js: what you hit carries your Scent
    itemsOnHit(enemy, source); // items.js


    if (activeClass.name === 'Dragonknight' && (source === 'melee' || source === 'melee_basic')) {
        addFrenzy(1); // items.js
    }

    checkEnemyDeath(enemy);
}

// The Hive Queen can't be killed outright: the hit that would finish her starts her last stand instead
function queenLastStand(enemy, dmg) {
    if (enemy.type !== 'boss_slime_queen' || enemy.hp - dmg > 0 || enemy.state === 'death_throes') return false;
    enemy.hp = 1; enemy.state = 'death_throes'; enemy.stateTimer = 5.0; enemy.invulnerable = true;
    enemy.originalSize = enemy.size; enemy.bulletAngle = 0;
    enemy.airborne = false; enemy.leapK = undefined; enemy.throesT = 0;
    if (currentMap.type === 'hive') startQueenThroes(enemy); // map_hive.js: she leaps back onto her throne for her last stand
    else { enemy.x = canvas.width / 2; enemy.y = canvas.height / 2; effects.push({ type: 'text', text: 'CORE COLLAPSE!', x: enemy.x, y: enemy.y - 60, color: '#ff5252', life: 2.0, maxLife: 2.0 }); }
    return true;
}

// Valerius can't die on the bridge: the blow that would kill him leaves him at 1 HP and he escapes (map_bridge.js)
function valeriusLastStand(enemy, dmg) {
    if (enemy.type !== 'boss_valerius' || isEndlessMode || currentMap.type !== 'bridge' || enemy.hp - dmg > 0 || enemy.escaping) return false;
    enemy.hp = 1; enemy.invulnerable = true; enemy.escaping = true;
    startValeriusEscape(enemy);
    return true;
}

// Valerius, King of Thieves (wave 17): the killing blow drops him to one knee for his last words (map_castle.js valerius_fall)
function kingLastStand(enemy, dmg) {
    if (enemy.type !== 'boss_valerius' || !enemy.king || isEndlessMode || enemy.hp - dmg > 0 || enemy.escaping) return false;
    enemy.hp = 1; enemy.invulnerable = true; enemy.escaping = true;
    startValeriusFall(enemy);
    return true;
}

// Nightblade weak point: a hit from the marked side consumes the mark for true damage (no x0.6), and that hit
// ignores blocks (Warden orbs, frontal shields, dodges). Returns the true damage, or 0 if this wasn't a weak-point hit.
function weakPointDamage(enemy, source, projAngle) {
    if (enemy.markAngle === undefined || !(source === 'melee_basic' || source === 'phantom_dash' || source === 'assassin_skill' || source === 'death_mark')) return 0;
    const hitAngle = projAngle !== null ? projAngle + Math.PI : Math.atan2(player.y - enemy.y, player.x - enemy.x);
    if (Math.abs(Math.atan2(Math.sin(enemy.markAngle - hitAngle), Math.cos(enemy.markAngle - hitAngle))) > Math.PI / 3) return 0;
    const isNightblade = activeClass.name === 'Nightblade';
    enemy.markAngle = undefined;
    let trueDmg = calcDmg(activeClass.basicDmg * 3) * (hasItem('Sigil of the Hunt') ? 1.25 : 1); // grows with gear and orbs; the Sigil sharpens it
    if (isNightblade && activeClass.skills[3].selectedUpg === 'A' && source === 'phantom_dash') trueDmg *= 3;
    if (isNightblade && enemy.type.startsWith('boss')) trueDmg *= BOSS_WEAK_MULT; // the assassin's specialty is the big target
    buffs.msBoost = 1.0;
    addShake(4);
    burst(enemy.x, enemy.y, hitAngle + Math.PI, 2.2, 14, { kind: 'spark', color: '#ea80fc', size: 3, life: 0.35, speed: [200, 520], drag: 5 });
    effects.push({ type: 'text', text: 'WEAKPOINT!', x: enemy.x, y: enemy.y - 40, color: '#e1bee7', life: 0.8, maxLife: 0.8 });

    if (isNightblade && activeClass.skills[3].level > 0 && source === 'phantom_dash') {
        cooldowns.s3 = Math.max(0, cooldowns.s3 - (activeClass.skills[3].maxCd * getCDR() * 0.5));
    }

    if (buffs.deathMarkActive > 0) {
        if (isNightblade && activeClass.skills[4].selectedUpg === 'A' && source !== 'death_mark') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1); // Bloodlust: your own pops (the clones heal 2% each, skills.js)
        effects.push({ type: 'holy_nova', x: enemy.x, y: enemy.y, radius: 100, color: '#ce93d8', life: 0.35, maxLife: 0.35 }); // skillfx_space.js
        for (let k = enemies.length - 1; k >= 0; k--) {
            const et = enemies[k];
            if (et === enemy || et.dead || et.invulnerable || Math.hypot(enemy.x - et.x, enemy.y - et.y) > 100 + et.size/2) continue;
            et.aoeResistStacks = (et.aoeResistStacks || 0) + 1;
            et.aoeResistTimer = 2.0;
            const splashDmg = (trueDmg * 0.5) / et.aoeResistStacks;
            if (queenLastStand(et, splashDmg) || valeriusLastStand(et, splashDmg)) continue;
            et.hp -= splashDmg;
            checkEnemyDeath(et);
        }
    }
    return trueDmg;
}

// Kensei: a successful parry, a hit taken in Parry Thrust's window or shots its sweep cuts out of the air (skills.js)
function parrySuccess(sourceObj) {
    effects.push({ type: 'text', text: 'Parried!', x: player.x, y: player.y - 30, color: '#00e5ff', life: 0.6, maxLife: 0.6 });
    onParry(sourceObj);
    counterParry(); // combos.js Counter Step: Shadow Step is ready at once
    let flowGain = player.maxFlow * 0.2; // Base parry flow gain
    if (activeClass && activeClass.skills[1] && activeClass.skills[1].selectedUpg === 'A') { // Flawless Execution: full Flow and Q ready again
        flowGain = player.maxFlow;
        cooldowns.s1 = 0;
    }
    player.flow = Math.min(player.maxFlow, (player.flow || 0) + flowGain);
    player.flowGainTimer = 0;
}

function takeDamage(amount, isContinuous = false, sourceObj = null) {
    amount *= 0.6; // Global enemy damage reduction to player

    if (player.parryTimer > 0 && !isContinuous) { parrySuccess(sourceObj); return; } // Mitigate all damage

    if (player.iFrames > 0) return;
    if (buffs.evade100 > 0) {
        if (!isContinuous) effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
        return;
    }
    if (player.inSmoke && Math.random() < 0.5) {
        if (!isContinuous) effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
        return;
    }

    if (equipment.armor && equipment.armor.name === 'Hazard Suit' && (isContinuous || amount < 5)) return;
    amount = itemsDamageTaken(amount, isContinuous); // items.js: class armors (0 = dodged)
    if (amount <= 0) return;
    
    // Cleric Vestments of the Fractured Soul interaction
    if (activeClass && activeClass.name === 'Cleric' && equipment.armor && equipment.armor.name === 'Vestments of the Fractured Soul') {
        let isShadow = activeClass.skills[1].selectedUpg === 'B';
        let isHoly = activeClass.skills[1].selectedUpg === 'A';
        
        if (isShadow && player.hp / player.maxHp < 0.25) { // Free Desecration < 25% HP
            // Ensure no infinity loop by adding a small tiny cooldown check on `cowlCooldown`
            if ((player.vestmentCD || 0) <= 0) {
                window.SkillRegistry['Cleric'][2]({ selectedUpg: 'B', level: activeClass.skills[2].level }, calcDmg(activeClass.skills[2].baseDmg, activeClass.skills[2].level));
                player.vestmentCD = 2.0; // max once every 2 seconds
            }
        }
        if (isHoly && sourceObj && sourceObj.isProjectile) { // Reflect 15% projectile DMG
            amount *= 0.85; // take 15% less
            let nearest = typeof getNearestEnemyFromPoint === 'function' ? getNearestEnemyFromPoint(player.x, player.y, 400) : null;
            if (nearest) {
                let dx = nearest.x - player.x, dy = nearest.y - player.y, dist = Math.hypot(dx,dy) || 1;
                projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*500, vy: (dy/dist)*500, radius: 8, color: '#fbc02d', life: 1.0, type: 'fireball', shape: 'fireball', damage: amount * 0.15 * 5, pierce: false, hitList: [], isEnemy: false });
            }
        }
    }

    let armor = player.armor;
    if (activeClass && activeClass.name === 'Paladin') {
        amount *= paladinDamageTakenMult(); // Plate of the Gilded Bastion
        armor *= paladinArmorMult();       // light shield while the hammer is away
    }
    const pierce = sourceObj && sourceObj.proj && sourceObj.proj.pierceArmor; // ai.js: the crossbowman's bolt goes through armour
    if (!isContinuous) amount = Math.max(1, amount * (1 - armorReduction(pierce ? 0 : armor)));
    
    if (player.shield > 0) {
        if (player.shield >= amount) { player.shield -= amount; return; }
        else { amount -= player.shield; player.shield = 0; player.shieldTimer = 0; }
    }
    
    // Kensei, Razor's Edge (skills.js): a hit that gets through costs Flow. The Ronin's Silk Shroud softens it, and Airborne
    // it dodges 10% of hits outright. Continuous damage (puddles, wading) doesn't cost Flow.
    if (activeClass && activeClass.name === 'Kensei' && !isContinuous) {
        const shroud = equipment.armor && equipment.armor.name === "Ronin's Silk Shroud";
        if (shroud && player.stance === 'airborne' && Math.random() < 0.10) {
            effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e1bee7', life: 0.6, maxLife: 0.6 });
            return;
        }
        if (player.flow > 0) {
            player.flow = Math.max(0, player.flow - (shroud ? EDGE_SHROUD_LOSS : EDGE_FLOW_LOSS));
            effects.push({ type: 'text', text: `-${shroud ? EDGE_SHROUD_LOSS : EDGE_FLOW_LOSS} Flow`, x: player.x, y: player.y - 44, color: '#4dd0e1', life: 0.6, maxLife: 0.6 });
        }
    }

    player.hp -= amount; waveStats.dmgTaken += amount;
    if (!isContinuous && amount >= player.maxHp * 0.12 && currentMap.type === 'castle' && player.hp > 0) throneBark('hit'); // map_castle.js: he enjoys that from his throne
    if (!isContinuous) player.hurtFlash = 0.2; // sprite hit flash
    if (!isContinuous && amount >= player.maxHp * 0.08) addShake(3);

    if (equipment.armor && equipment.armor.name === "Nightblade's Cowl" && player.hp / player.maxHp < 0.3 && (player.cowlCooldown || 0) <= 0) {
        buffs.evade100 = 2.0; player.cowlCooldown = 15.0; 
        effects.push({ type: 'text', text: 'ELUSIVE!', x: player.x, y: player.y - 50, color: '#e1bee7', life: 1.0, maxLife: 1.0 });
    }

    if (player.hp <= 0 && trainingGod()) player.hp = 1; // training.js: god mode
    if (player.hp <= 0) playerDied();
    updateHUD();
}

// The hero falls. If Valerius is there to see it, he has a word first (dialogue.js), then the death screen.
function playerDied() {
    player.hp = 0; player.fallen = true; // main.js draws the hero dimmed where they fell
    const taunt = valeriusTaunt(); // dialogue.js
    if (taunt) openDialogue({ ...taunt, onClose: showDeathScreen });
    else showDeathScreen();
}
function showDeathScreen() { gameState = STATE.DEAD; el('death-wave').innerText = wave; el('death-screen').classList.remove('hidden'); }

function gainXP(amount) {
    player.xp += amount; let leveledUp = false;
    while (player.xp >= player.maxXp) { player.level++; player.xp -= player.maxXp; player.maxXp = Math.floor(player.maxXp * 1.5); player.skillPoints++; leveledUp = true; }
    if (leveledUp && gameState === STATE.PLAYING) triggerLevelUp();
    updateHUD();
}

function checkEnemyDeath(e) {
    if (e.pod && e.hp <= 0 && !e.dead) { if (e.type === 'powder_keg') kegBlown(e); else podPopped(e); return; } // bandits.js / map_hive.js: a keg or a brood pod; neither counts toward the wave
    if (e.hp <= 0 && !e.dead) {
        e.dead = true;
        enemyDeathFx(e); // enemysprites.js
        if (e.dummy) { trainingDummyDied(e); return; } // training.js: no loot, no XP, no wave; it's back on its post soon
        if (e.loot > 0) cutpurseLoot(e); // ai.js: a cutpurse killed with your gold drops it x1.5

        if (e.markAngle !== undefined && activeClass.name === 'Nightblade' && activeClass.skills[4].selectedUpg === 'B') {
            effects.push({ type: 'circle', x: e.x, y: e.y, radius: 150, color: 'rgba(156, 39, 176, 0.3)', life: 0.3, maxLife: 0.3 });
            for(let k=enemies.length-1; k>=0; k--) {
                if (Math.hypot(e.x - enemies[k].x, e.y - enemies[k].y) <= 150 + enemies[k].size/2) applyDamage(enemies[k], calcDmg(50, activeClass.skills[4].level), 'magic');
            }
            let nearest = getNearestEnemyFromPoint(e.x, e.y, 300, [e]);
            if (nearest) nearest.markAngle = Math.random() * Math.PI * 2;
        }

        if ((e.type === 'boss_slime_queen' || e.type === 'boss_valerius') && !isEndlessMode) {
            if (currentMap.type === 'hive') { queenDefeated(e); return; } // map_hive.js: her crown must be claimed first
            if (currentMap.type === 'castle') { valeriusFall(e); return; } // map_castle.js: his last words, then his crown
            showVictory(); // ui.js
            return; 
        }

        if (e.type === 'spore_slime') effects.push({ type: 'spore_cloud', x: e.x, y: e.y, radius: 100, color: 'rgba(205, 220, 57, 0.4)', life: 3.0, maxLife: 3.0 });
        
        if (activeClass && activeClass.name === 'Cleric' && buffs.aspectOfReaper > 0) {
            let missingHp = player.maxHp - player.hp;
            player.hp += missingHp * 0.25;
            effects.push({ type: 'text', text: '+HP', x: player.x, y: player.y - 30, color: '#69f0ae', life: 0.8, maxLife: 0.8 });
        }


        const rates = itemDataConfig.dropChances;
        if (e.type.startsWith('boss')) {
            if (!e.champion || !enemies.some(o => o.champion && !o.dead)) drops.push({ x: e.x + 20, y: e.y, type: 'item', itemData: generateItem(wave + 2), radius: 10, life: 30.0 }); // the Royal Guard: one item, from the last to fall
            const purse = e.champion && enemies.some(o => o.champion && !o.dead) ? 2 : 5; // the Royal Guard: a little gold each, the full purse from the last
            for(let i=0; i<purse; i++) drops.push({ x: e.x - 20 + (i*10), y: e.y + (i*10), type: 'gold', val: 20 + wave*2, radius: 8, life: 30.0 });
            if (e.type === 'boss_warlord' && currentMap.type === 'village' && !isEndlessMode) { // his war chest: stage 1 alone pays for the first rare weapon (BALANCE.md section 7)
                for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6, d = 45 + (i % 2) * 20; drops.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, type: 'gold', val: 20, radius: 8, life: 30.0 }); }
                effects.push({ type: 'text', text: 'The war chest!', x: e.x, y: e.y - 50, color: '#ffd54f', life: 1.6, maxLife: 1.6 });
            }
        } else {
            const roll = Math.random();
            if (roll < rates.item) drops.push({ x: e.x, y: e.y, type: 'item', itemData: generateItem(wave), radius: 10, life: 15.0 });
            else if (roll < rates.item + rates.orb) drops.push({ x: e.x, y: e.y, type: Math.random() > 0.5 ? 'hp' : 'dmg', radius: 12, life: 10.0 });
            else if (roll < rates.item + rates.orb + rates.gold) drops.push({ x: e.x, y: e.y, type: 'gold', val: 5 + wave, radius: 8, life: 10.0 });
        }
        
        if (activeClass.name === 'Machinist' && Math.random() < 0.25) {
            drops.push({ x: e.x, y: e.y, type: 'scrap', radius: 10, life: 15.0 });
        }
        
        if (e.champion) championFell(e); // map_castle.js: Valerius has a word, the others rally
        gainXP(e.xp); // the corpse is removed from `enemies` by removeDeadEnemies()
        activeEnemies--; score++; waveStats.kills++; updateHUD();

        if (enemiesToSpawn <= 0 && activeEnemies <= 0) {
            collectAllDrops();
            if (gameState === STATE.PLAYING) onWaveCleared(); // stage.js: may open the cave instead
        }
    }
}

function collectAllDrops() {
    for (const d of drops) {
        if (d.type === 'hp') { player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.25)); } 
        else if (d.type === 'dmg') { pickUpDmgOrb(); }
        else if (d.type === 'gold') { player.gold += d.val; } 
        else if (d.type === 'item') { inventory.push(d.itemData); }
        else if (d.type === 'scrap') { pickUpScrap(); }
    } drops.length = 0; updateHUD();
}