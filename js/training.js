// ==========================================
// training.js - The Training Room: a yard with target dummies to practise combos and chase bugs
// ==========================================
// Picked from the "Training Room" box on the dungeon map (menu.js), then a class as usual. No waves, no loot, no XP:
// the hero starts with every skill at rank 1 and a panel (T) to set ranks, evolutions, gear and cheats, and to place dummies.
// The skill tree (K, skilltree.js) is free here: no points, no level gates, respec any time.
//   1 / 2 / 3 at the cursor: a target dummy, a boss dummy (counts as a boss: boss bar, CC shaken off faster, weak points x1.5),
//   a sparring dummy (a telegraphed swing in reach, a slow bolt from further away: parries, Counter Step, Razor's Edge).
//   0 clears them, G fills the class gauge. Each dummy shows the damage it took over the last 5 s and in total.
// Dummies stand on a post: knocked away, they slide back to it. Immortal ones refill below half HP; mortal ones die
// (kill effects, Chain Reaction) and are back on their post 2 s later.

const TRAINING_ID = 'training', DUMMY_HP = 100000, DUMMY_MORTAL_HP = { target: 800, boss: 8000, spar: 1500 };
const DPS_WINDOW = 5, DUMMY_IDLE = 4, DUMMY_RETURN = 260, SPAR_PERIOD = 2.4, SPAR_WINDUP = 0.7, SPAR_REACH = 120, SPAR_DMG = 12;
const training = { god: true, immortal: true, panel: true, place: null, kit: false };

function isTraining() { return activeDungeonId === TRAINING_ID; }
function trainingGod() { return isTraining() && training.god; } // combat.js takeDamage: the hero can't fall below 1 HP

// The yard: a sand ring inside a plank fence, as big as two screens (stage.js reads STAGE_MAPS)
STAGE_MAPS.training = {
    w: 2200, h: 1400,
    bounds: { left: 90, top: 90, right: 2110, bottom: 1310 },
    start: { x: 1100, y: 760 },
    obstacles: [], grid: null,
};
BOSS_NAMES.boss_dummy = 'Training Dummy'; // hud.js boss bar

// ---------- the run ----------

function startTraining() { // main.js startGame, in place of the starting-skill pick and the first wave
    for (let i = 1; i <= 4; i++) player.tree[`s${i}_learn`] = true; // skilltree.js: every skill learned; the tree (K) is free here
    applyTree(); player.skillPoints = 0; wave = 1; isBossWave = false; enemiesToSpawn = 0; activeEnemies = 0; enemySpawnTimer = 1e9; waveBreak = 0;
    waveStats = { kills: 0, gold0: 0, time: 0, dmgTaken: 0, peak: 0 };
    training.place = null;
    buildTrainingPanel();
    spawnDummy('target', 1400, 640); spawnDummy('boss', 1500, 900); // something to hit straight away
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD();
}

function updateTraining(dt) { // main.js update
    if (!isTraining()) return;
    if (training.god) player.hp = player.maxHp;
    for (const e of enemies) if (e.dummy && !e.dead) trackDummy(e, dt);
}

// ---------- dummies ----------

function spawnDummy(kind, x, y) {
    const big = kind === 'boss', hp = training.immortal ? DUMMY_HP : DUMMY_MORTAL_HP[kind];
    [x, y] = clampPointToMap(x, y, big ? 60 : 30);
    const e = {
        x, y, homeX: x, homeY: y, size: big ? 110 : 46, color: '#c9a66b', speed: 0, hp, maxHp: hp,
        type: big ? 'boss_dummy' : 'training_dummy', dmg: kind === 'spar' ? SPAR_DMG : 0, xp: 0,
        attackTimer: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: Math.PI / 2, bleedTimer: 0, bleedDmg: 0, orbs: 0, maxOrbs: 0,
        state: 'idle', stateTimer: 0, dummy: kind, spar: 0, wob: 0,
        meter: { lastHp: hp, log: [], total: 0, start: 0, lastHit: -99 },
    };
    enemies.push(e);
    burst(x, y, 0, Math.PI * 2, 10, { kind: 'debris', color: '#8d6e63', size: 3, life: 0.4, speed: [80, 200], drag: 5 });
    return e;
}
function clearDummies() { for (const e of enemies) if (e.dummy) e.dead = true; removeDeadEnemies(); }
function trainingDummyDied(e) { // combat.js checkEnemyDeath: no loot, no XP, no wave; back on its post in 2 s
    const { dummy, homeX, homeY } = e;
    after(2, () => { if (isTraining()) spawnDummy(dummy, homeX, homeY); });
}

// Damage taken (read from HP, so DoTs, splashes and every source count), the refill, and the slide back to the post
function trackDummy(e, dt) {
    const m = e.meter, lost = Math.max(0, m.lastHp - e.hp);
    if (lost > 0) {
        if (fxTime - m.lastHit > DUMMY_IDLE) { m.total = 0; m.start = fxTime; m.log.length = 0; } // a fresh round of hits
        m.log.push([fxTime, lost]); m.total += lost; m.lastHit = fxTime;
        e.wob = Math.min(1, e.wob + 0.5);
    }
    while (m.log.length && fxTime - m.log[0][0] > DPS_WINDOW) m.log.shift();
    if (training.immortal && e.hp < e.maxHp * 0.5) e.hp = e.maxHp;
    m.lastHp = e.hp;
    e.wob = Math.max(0, e.wob - dt * 2.5);
    if (!(e.stunTimer > 0) && !(e.rootedTimer > 0) && !(e.frozenTimer > 0)) { // knocked off its post: it slides back
        const [dx, dy, d] = getVector(e.x, e.y, e.homeX, e.homeY);
        if (d > 2) { const s = Math.min(d, DUMMY_RETURN * dt); e.x += dx / d * s; e.y += dy / d * s; }
    }
}
function dummyDps(e) {
    const m = e.meter, span = Math.min(DPS_WINDOW, Math.max(1, fxTime - m.start));
    return m.log.reduce((s, [, v]) => s + v, 0) / span;
}

// AI (main.js enemy loop): stand still; a sparring dummy winds up and swings or throws a bolt every 2.4 s
function dummyAI(e, dt) {
    if (e.dummy !== 'spar' || e.stunTimer > 0 || e.frozenTimer > 0) return;
    e.spar += dt;
    if (e.spar < SPAR_PERIOD) return;
    e.spar = 0;
    const [dx, dy, d] = getVector(e.x, e.y, player.x, player.y), ang = Math.atan2(dy, dx);
    if (d <= SPAR_REACH + player.radius + e.size / 2) { // a swing at the hero
        effects.push({ type: 'slash', x: e.x, y: e.y, radius: SPAR_REACH, angle: ang, color: '#ff8a65', life: 0.2, maxLife: 0.2 });
        takeDamage(e.dmg, false, { enemy: e });
    } else { // too far: a slow bolt
        projectiles.push({ x: e.x + dx / d * 30, y: e.y + dy / d * 30, vx: dx / d * 320, vy: dy / d * 320, radius: 8, color: '#ff8a65', life: 3, type: 'dummy_bolt', damage: e.dmg, isEnemy: true });
    }
}
EnemyAI.training_dummy = dummyAI;
EnemyAI.boss_dummy = dummyAI;

// ---------- the look: a straw dummy on a post, seen from above ----------

function drawTrainingDummy(e) { // enemysprites.js drawEnemySprite
    const r = e.size / 2, sway = Math.sin(fxTime * 22) * 0.25 * e.wob, flash = e.hitFlash > 0;
    const wind = e.dummy === 'spar' ? Math.max(0, (e.spar - (SPAR_PERIOD - SPAR_WINDUP)) / SPAR_WINDUP) : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.beginPath(); ctx.ellipse(e.x + 4, e.y + r * 0.35, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    if (wind > 0) { // the sparring dummy's wind-up: a ring closing in on it
        ctx.strokeStyle = `rgba(255, 87, 34, ${0.4 + 0.6 * wind})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 8 + (1 - wind) * 40, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.translate(e.x, e.y); ctx.rotate(sway);
    // crossbar (the arms), then the padded straw body with a painted target, then the burlap head on top
    const bar = e.dummy === 'boss' ? '#4e342e' : '#6d4c41';
    ctx.fillStyle = bar; ctx.strokeStyle = '#2b1a12'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-r * 1.25, -r * 0.14, r * 2.5, r * 0.28, r * 0.1); ctx.fill(); ctx.stroke();
    if (e.dummy === 'spar') { // a wooden practice sword strapped to the right arm
        ctx.save(); ctx.rotate(-0.5 - wind * 1.2);
        ctx.fillStyle = '#a1887f'; ctx.fillRect(r * 0.9, -3, r * 1.2, 6); ctx.strokeRect(r * 0.9, -3, r * 1.2, 6);
        ctx.restore();
    }
    ctx.fillStyle = flash ? '#fff8e1' : '#d9b46a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(122, 90, 42, 0.55)'; ctx.lineWidth = 1; ctx.beginPath(); // straw sticking out
    for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14 + 0.2; ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); }
    ctx.stroke();
    for (const [k, col] of [[0.62, '#c62828'], [0.44, '#f5f0e1'], [0.26, '#c62828']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, r * 0.08, r * k * 0.7, 0, Math.PI * 2); ctx.fill(); }
    if (e.dummy === 'boss') { ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke(); } // iron bands
    ctx.fillStyle = flash ? '#fff8e1' : '#bfa07a'; ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6d5636'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.3); ctx.lineTo(r * 0.12, -r * 0.06); ctx.moveTo(r * 0.12, -r * 0.3); ctx.lineTo(-r * 0.12, -r * 0.06); ctx.stroke(); // stitched X
    ctx.restore();
    // the meter: the last 5 s and the whole round of hits
    const m = e.meter, recent = fxTime - m.lastHit < DUMMY_IDLE;
    if (m.total > 0) {
        ctx.save(); ctx.font = `bold 13px Georgia, serif`; ctx.textAlign = 'center';
        ctx.globalAlpha = recent ? 1 : 0.55;
        const txt = `${Math.round(dummyDps(e))} DPS · ${m.total >= 10000 ? (m.total / 1000).toFixed(1) + 'k' : Math.round(m.total)}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillText(txt, e.x + 1, e.y + r + 19);
        ctx.fillStyle = '#ffe9b0'; ctx.fillText(txt, e.x, e.y + r + 18);
        ctx.restore();
    }
    if (!training.immortal && e.dummy !== 'boss') { // a mortal dummy shows its HP
        ctx.fillStyle = '#000'; ctx.fillRect(e.x - r, e.y - r - 12, e.size, 4);
        ctx.fillStyle = '#4caf50'; ctx.fillRect(e.x - r, e.y - r - 12, e.size * Math.max(0, e.hp / e.maxHp), 4);
    }
    return true;
}

// The yard, painted once: packed sand, a darker ring, a plank fence
let trainingGround = null;
function drawTrainingGround() { // main.js draw
    const d = STAGE_MAPS.training;
    if (!trainingGround) {
        const c = document.createElement('canvas'); c.width = d.w; c.height = d.h;
        const g = c.getContext('2d'), rnd = mapRng(7);
        g.fillStyle = '#3a4a2a'; g.fillRect(0, 0, d.w, d.h); // grass beyond the fence
        const b = d.bounds;
        const sand = g.createRadialGradient(d.w / 2, d.h / 2, 100, d.w / 2, d.h / 2, d.w * 0.6);
        sand.addColorStop(0, '#c8ad7f'); sand.addColorStop(1, '#a98d61');
        g.fillStyle = sand; g.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
        for (let i = 0; i < 2600; i++) { // grit
            g.fillStyle = rnd() < 0.5 ? 'rgba(90, 66, 36, 0.18)' : 'rgba(255, 240, 210, 0.12)';
            g.fillRect(b.left + rnd() * (b.right - b.left), b.top + rnd() * (b.bottom - b.top), 2 + rnd() * 3, 1 + rnd() * 2);
        }
        g.strokeStyle = 'rgba(110, 80, 45, 0.35)'; g.lineWidth = 10; // the sparring ring raked into the sand
        g.beginPath(); g.ellipse(d.w / 2, d.h / 2, 520, 360, 0, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.ellipse(d.w / 2, d.h / 2, 545, 385, 0, 0, Math.PI * 2); g.stroke();
        for (let x = b.left - 20; x <= b.right + 20; x += 34) { fencePost(g, x, b.top - 26); fencePost(g, x, b.bottom + 14); }
        for (let y = b.top - 20; y <= b.bottom + 20; y += 34) { fencePost(g, b.left - 26, y); fencePost(g, b.right + 14, y); }
        g.fillStyle = '#7a5532'; // rails
        g.fillRect(b.left - 30, b.top - 22, b.right - b.left + 60, 6); g.fillRect(b.left - 30, b.bottom + 18, b.right - b.left + 60, 6);
        g.fillRect(b.left - 22, b.top - 30, 6, b.bottom - b.top + 60); g.fillRect(b.right + 18, b.top - 30, 6, b.bottom - b.top + 60);
        trainingGround = c;
    }
    ctx.drawImage(trainingGround, 0, 0);
}
function fencePost(g, x, y) { g.fillStyle = '#5d3f23'; g.fillRect(x, y, 12, 12); g.strokeStyle = '#2e1d0e'; g.lineWidth = 1.5; g.strokeRect(x, y, 12, 12); }

// ---------- kit and cheats ----------

function fillGauge() {
    player.flow = player.maxFlow; player.flowGainTimer = 0;
    player.zeal = player.maxZeal || 100;
    player.bond = BOND_MAX; player.scrap = SCRAP_MAX; player.momentum = 0.2;
    player.arcaneResonance = resonanceMax(); player.frenzyStacks = frenzyMax();
    mk.chi = MK_CHI_MAX; mk.flurry = MK_FLURRY_MAX; mk.combatT = fxTime; // monk.js
    if (activeClass.name === 'Swordsaint') { ss.style = SS_MAX; ss.hitT = fxTime; ss.charges = ssMaxCharges(); } // swordsaint.js: S rank
    if (activeClass.name === 'Witch') for (let i = wt.souls.length; i < WT_ZOMBIE_MAX; i++) { const a = i / WT_ZOMBIE_MAX * Math.PI * 2; dropSoul(player.x + Math.cos(a) * 90, player.y + Math.sin(a) * 90); } // witch.js: souls round her
    updateHUD();
}
function setTrainingKit(on) { // the late-game kit of the DPS tests: the class's five rares (the weapon at +10), +80 orb Power
    training.kit = on;
    equipment = on ? Object.fromEntries(GEAR_SLOT_LIST.map(t => [t, makeRare(t, t === 'weapon' ? 10 : 0)])) : { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; // items.js: the rare weapon at +10 (90 Power)
    player.orbDmg = on ? 0.8 : 0;
    if (on) charmsGiveAll(); // charms.js: every charm in the pack, the pouch full (the Training Room never saves)
    recalcStats(); player.hp = player.maxHp; hud.sig = null; updateHUD();
}
// The panel's rank and evolution buttons write the skill's branch of the tree (skilltree.js): rank 4 is an evolution,
// so picking A or B means rank 4, and a lower rank drops the evolution and whatever grew from it
function setSkill(slot, level, upg) {
    const sk = activeClass.skills[slot], p = `s${slot}_`, T = player.tree;
    if (level === undefined) level = upg ? 4 : Math.min(sk.level, 3);
    if (!sk.upgA) { level = Math.min(level, 3); upg = null; } // spellweaver.js: spells have no evolutions yet
    if (level === 4 && !upg) upg = sk.selectedUpg || 'A';
    ['learn', 'r2', 'r3', 'evoA', 'evoB'].forEach(k => delete T[p + k]);
    ['learn', 'r2', 'r3'].slice(0, Math.min(level, 3)).forEach(k => T[p + k] = true);
    if (level === 4) T[p + 'evo' + upg] = true;
    treePrune(); applyTree(); // skilltree.js: the twigs and the nodes under an evolution go with what they grew from
    if (activeClass.name === 'Paladin') resetPaladinState(); // a changed Q or E: the hammer back in hand
    renderTrainingPanel(); updateHUD();
}

// ---------- the panel ----------

function buildTrainingPanel() {
    let p = el('training-panel');
    if (!p) {
        p = document.createElement('div'); p.id = 'training-panel'; p.className = 'panel';
        document.body.appendChild(p);
        p.addEventListener('mousedown', e => e.stopPropagation()); // a click on the panel isn't an attack
        p.addEventListener('click', onTrainingClick);
    }
    p.classList.toggle('hidden', !training.panel);
    renderTrainingPanel();
}
function renderTrainingPanel() {
    const p = el('training-panel'); if (!p) return;
    const keys = { 1: 'Q', 2: 'E', 3: 'Spc', 4: 'R' };
    const tog = (id, on, label) => `<button class="tr-btn ${on ? 'on' : ''}" data-act="${id}">${label}</button>`;
    const skills = [1, 2, 3, 4].map(i => {
        const sk = activeClass.skills[i];
        const ranks = (sk.upgA ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map(r => `<button class="tr-rank ${sk.level === r ? 'on' : ''}" data-act="rank" data-slot="${i}" data-v="${r}">${r}</button>`).join('');
        const evo = !sk.upgA ? '' : [[null, 'Base'], ['A', sk.upgA.name], ['B', sk.upgB.name]].map(([v, n]) =>
            `<button class="tr-evo ${(sk.selectedUpg || null) === v ? 'on' : ''}" data-act="evo" data-slot="${i}" data-v="${v || ''}" title="${v ? (v === 'A' ? sk.upgA.desc : sk.upgB.desc).replace(/"/g, '&quot;') : 'No evolution'}">${v ? n : 'Base'}</button>`).join('');
        return `<div class="tr-skill"><span class="tr-key">${keys[i]}</span><span class="tr-name">${sk.name}</span><div class="tr-row">${ranks}</div>${evo ? `<div class="tr-row">${evo}</div>` : ''}</div>`;
    }).join('');
    p.innerHTML = `<div class="ui-label">Training Room</div>
        <div class="tr-hint"><kbd>T</kbd> hide this · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> dummy at the cursor · <kbd>0</kbd> clear · <kbd>G</kbd> fill gauge · <kbd>K</kbd> skill tree (free here)</div>
        <div class="tr-sec">Dummies</div>
        <div class="tr-row">${tog('place-target', training.place === 'target', 'Target')}${tog('place-boss', training.place === 'boss', 'Boss')}${tog('place-spar', training.place === 'spar', 'Sparring')}<button class="tr-btn" data-act="clear">Clear</button></div>
        <div class="tr-row">${tog('immortal', training.immortal, 'Immortal dummies')}${tog('god', training.god, 'God mode')}</div>
        <div class="tr-sec">Cheats</div>
        <div class="tr-row">${tog('cds', devNoCooldowns, 'No cooldowns')}<button class="tr-btn" data-act="gauge">Fill gauge</button><button class="tr-btn" data-act="reset">Reset cooldowns</button></div>
        <div class="tr-row">${tog('kit', training.kit, 'Late-game kit (rare set, +80 Power)')}</div>
        ${activeClass.name === 'Swordsaint' ? `<div class="tr-sec">Sword (to compare)</div><div class="tr-row">${tog('blade-og', ssBlade === 'og', 'Original: 110 px')}${tog('blade-long', ssBlade === 'long', 'Long: 120 px')}</div>` : ''}
        <div class="tr-sec">Skills: rank · evolution</div>${isSpellbook() ? '<div class="tr-row"><button class="tr-btn" data-act="spellbook">Spellbook: change spells</button></div>' : ''}${skills}
        <div class="tr-row" style="margin-top:10px"><button class="tr-btn tr-exit" data-act="exit">Leave the Training Room</button></div>`;
}
function onTrainingClick(ev) {
    const b = ev.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act.startsWith('place-')) { const k = act.slice(6); training.place = training.place === k ? null : k; }
    else if (act === 'clear') clearDummies();
    else if (act === 'immortal') { training.immortal = !training.immortal; const ds = enemies.filter(e => e.dummy && !e.dead).map(e => [e.dummy, e.homeX, e.homeY]); clearDummies(); ds.forEach(d => spawnDummy(...d)); }
    else if (act === 'god') training.god = !training.god;
    else if (act === 'cds') devNoCooldowns = !devNoCooldowns;
    else if (act === 'gauge') fillGauge();
    else if (act === 'reset') { for (const k in cooldowns) cooldowns[k] = 0; }
    else if (act === 'kit') setTrainingKit(!training.kit);
    else if (act === 'blade-og' || act === 'blade-long') ssBlade = act.slice(6); // swordsaint.js: the two swords side by side
    else if (act === 'rank') { setSkill(+b.dataset.slot, +b.dataset.v); return; }
    else if (act === 'evo') { setSkill(+b.dataset.slot, undefined, b.dataset.v || null); return; }
    else if (act === 'spellbook') { b.blur(); showSpellbook(null, true); return; } // spellweaver.js: any spell on any key, free here
    else if (act === 'exit') { location.reload(); return; } // as End Run does
    b.blur(); renderTrainingPanel(); updateHUD();
}

// Keys and the placing click (capture phase, so a placing click never reaches the attack handler)
window.addEventListener('keydown', e => {
    if (!isTraining() || gameState !== STATE.PLAYING) return;
    const k = e.key.toLowerCase();
    if (k === 't') { training.panel = !training.panel; buildTrainingPanel(); }
    else if (k === '1' || k === '2' || k === '3') spawnDummy({ 1: 'target', 2: 'boss', 3: 'spar' }[k], mouseX, mouseY);
    else if (k === '0') clearDummies();
    else if (k === 'g') fillGauge();
});
window.addEventListener('mousedown', e => {
    if (!isTraining() || !training.place || e.button !== 0 || gameState !== STATE.PLAYING || e.target !== canvas) return;
    spawnDummy(training.place, mouseX, mouseY);
    e.stopImmediatePropagation();
}, true);
