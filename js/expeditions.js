// ==========================================
// expeditions.js - Expeditions (short repeatable trips from the noticeboard) and Memories (the full dungeons replayed)
// ==========================================
// The content is in quests.js (EXPEDITIONS, MEMORIES); this is the mechanics. After the story (Valerius dead) a base hero
// (save.js baseOpen) takes a notice off Cinderholt's board and goes to an existing map as it is NOW: its story scenes off,
// every part open, three waves of what lives there, a named chief (an existing enemy type, scaled and tinted), a purse and the
// road home. Quest items and bounty kills count only here (sidequests.js: Q.exp === activeExpedition). The full dungeons stay
// replayable behind the board's "Memories" notice: gold, XP and caches as before, no quest progress, a card first.
//
// How an expedition is told apart: its dungeon id is 'exp_<key>' (heroToDungeon -> RESUME_KEY -> openHeroMenu -> selectDungeon
// -> expSelect), so every `activeDungeonId === 'bandit_bastion'` story branch (waves 10 / 11 / 12+, the Beastmaster, CS_COUNT,
// bastionScale's rebasing, DUNGEON_XP) is dead by construction; `activeExpedition` is the key, `activeDungeon` the real
// dungeon's enemy data (EXPEDITIONS[x].dungeon). mapTypeForWave answers the expedition's map for every wave.
// Strength: `statWave()` answers EXP_STAT_WAVE (the castle's wave 13) wherever enemy stats / gold / fire / kegs read `wave`;
// bastionScale answers the expedition's own { hp, dmg } (expTune) and dungeonXp its `xp`.
// The chief keeps its base type (its AI and sprite work) and carries `e.chief` (the EXPEDITIONS entry) and `e.isBoss`;
// utils.js isBossE() is the boss test everywhere `type.startsWith('boss')` used to be.
//
// The art is in expeditions_fx.js (the chiefs, their wind-ups, the road home, a memory's tint); the board, the memory card and
// the end panel are HTML here, styled in ui.css ("expeditions").

let activeExpedition = null; // the EXPEDITIONS key, or null
let activeMemory = false;    // a story dungeon replayed by a base hero
const EXP_WAVES = 3, EXP_COUNTS = [10, 14, 18], EXP_STAT_WAVE = 13, EXP_SPAWN_GAP = 1.1; // wave sizes; the strength = the castle's wave 13; seconds between spawns
// Per expedition: stage (which stageN_minions has its foes), xp (dungeonXp), scale (hp / dmg of every enemy), the chief's HP,
// damage x, XP, the move's numbers. Castle waves 12-15 at wave 13: thief 109 HP / 33 dmg, halberd 289 / 31, crossbow 126 / 43; a champion
// of the Royal Guard has 5300-7400 HP. The hive's slimes are rebased from the Caves' Lv. 1-10 numbers (crystal 303 HP / 64 dmg at 13).
const EXP_TUNE = {
    fallen_bastion: { stage: 4, xp: 7.3, scale: { hp: 1, dmg: 1 }, chiefHp: 7000, chiefDmg: 1.5, chiefXp: 350, at: [0.5, 0.25], n: [4, 3], call: 'To me, lads!' },
    raiders_camp: { stage: 2, xp: 7.3, scale: { hp: 1, dmg: 1 }, chiefHp: 7000, chiefDmg: 1.6, chiefXp: 350, at: [0.66, 0.33], n: [3, 3] },
    silent_hive: { stage: 3, xp: 5, scale: { hp: 0.9, dmg: 0.5 }, chiefHp: 7000, chiefDmg: 1.5, chiefXp: 350, every: 6, shards: 14 },
};
const expTune = () => EXP_TUNE[activeExpedition];
const expIdOf = did => typeof did === 'string' && did.indexOf('exp_') === 0 && EXPEDITIONS[did.slice(4)] ? did.slice(4) : null;
const statWave = w => activeExpedition ? EXP_STAT_WAVE : w === undefined ? wave : w; // main.js newMinion / pushBoss, combat.js gold, bandits.js fire and kegs
const expSite = id => { const x = expIdOf(id); return x ? { id, name: EXPEDITIONS[x].name, expedition: true } : undefined; }; // menu.js siteById
const expMapOf = x => STAGE_MAPS[EXPEDITIONS[x].map];
const expExit = () => { const s = expMapOf(activeExpedition).start; return { x: s.x, y: s.y, r: 90 }; }; // stage.js stageExit: the road home is back where you came in

// The run's tally (the end panel) and the chief's state
let expd = null;
function expReset() { expd = { kills: 0, gold0: 0, mats0: null, items: [], bounty: {}, chiefE: null, chiefAt: 0, entered: false, enterAt: 0, fired: {}, nextShatter: 0, done: false, panel: false, started: false }; }
expReset();
function expBegin() { expd.started = true; expd.gold0 = player.gold; expd.mats0 = { ...mats }; }

// main.js selectDungeon: sets the whole dungeon state from an id (a story dungeon, an expedition's 'exp_<key>', the base, the Training Room)
function expSelect(did) {
    activeExpedition = expIdOf(did);
    activeMemory = !activeExpedition && !!MEMORIES[did] && baseOpen(); // a base hero replaying a story dungeon
    activeDungeonId = did; activeDungeon = enemyDataConfig[activeExpedition ? EXPEDITIONS[activeExpedition].dungeon : did];
    expReset();
}

// ---------- the map as it is now (map_castle.js resetCastle / map_trail.js resetTrail / map_hive.js resetHive call this last) ----------
function expOpenMap(type) {
    if (type === 'castle') { // the keep's doors blown, the throne room's open, nobody on the throne; the portcullis stays up (no scene)
        const G = cst.grid; cartWreck(true);
        for (const i of cst.keepCells) G.data[i] = T_FLOOR;
        for (const i of cst.throneCells) G.data[i] = T_FLOOR;
        cst.breachAt = fxTime - 30; cst.brazierDown = true; cst.fuseK = 1; cst.throneK = 1; cst.open = 2;
        cst.dropped = true; cst.dropAt = 1e9; cst.portK = 0; cst.promptAt = 0; showStagePrompt(false);
    } else if (type === 'trail') { // both logjams and the bridgehead gate open, no Beastmaster
        const G = trl.grid;
        for (let j = 0; j < 2; j++) { for (const i of trl.jamCells[j]) G.data[i] = T_FLOOR; trl.jam[j].k = 1; }
        for (const i of trl.gateCells) G.data[i] = T_FLOOR;
        trl.open = 2; trl.gateOpen = true; trl.gateK = 1; trl.promptAt = 0; trl.guard = null;
    } else if (type === 'hive') hive.awake = true; // the Queen is gone: no sleeper on the throne, nothing stirs, no wake at the end
}

// ---------- foes ----------
function expMinionDef(type) { // the entry in the expedition's stage list first, then any stage of its dungeon
    const D = activeDungeon, first = D['stage' + expTune().stage + '_minions'] || [];
    let m = first.find(f => f.type === type);
    for (let s = 1; !m && s <= 4; s++) m = (D['stage' + s + '_minions'] || []).find(f => f.type === type);
    return m;
}
function expMinions() { // spawnEnemy's list: the foes by how often each is named
    const cnt = {}; for (const t of EXPEDITIONS[activeExpedition].foes) cnt[t] = (cnt[t] || 0) + 1;
    return Object.keys(cnt).map(t => ({ ...expMinionDef(t), weight: cnt[t] })).filter(m => m.type);
}
// Where one steps in: any open part, near the hero but out of view (stage.js pickSpawnPoint; the hive keeps its pods)
function expPoint(far) { return currentMap.type === 'hive' ? hiveSpawnPoint() : expSpawnPoint(far); }
function expSpawnPoint(far) {
    const list = currentMap.type === 'castle' ? cst.spawns : trl.spawns, G = currentMap.grid;
    const reach = p => !nav.dist || nav.dist[Math.floor(p.y / G.cell) * G.cols + Math.floor(p.x / G.cell)] >= 0;
    const d = p => Math.hypot(p.x - player.x, p.y - player.y), hw = viewW() / 2 + 80, hh = viewH() / 2 + 80;
    const seen = p => Math.abs(p.x - camera.x - viewW() / 2) < hw && Math.abs(p.y - camera.y - viewH() / 2) < hh;
    const lo = far ? 650 : 430, hi = far ? 1500 : 1100;
    let cand = list.filter(p => reach(p) && d(p) > lo && d(p) < hi && !seen(p));
    if (!cand.length) cand = list.filter(p => reach(p) && d(p) > 300 && d(p) < 1700);
    if (!cand.length) cand = list.filter(reach).sort((a, b) => d(a) - d(b)).slice(0, 3);
    const c = cand[(Math.random() * cand.length) | 0] || { x: expExit().x + 500, y: expExit().y, ox: expExit().x + 470, oy: expExit().y, from: 'door' };
    if (currentMap.type === 'castle') cst.lastSpawn = c; else trl.lastSpawn = c; // castleOnSpawn / trailOnSpawn read it
    return { x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16, from: c.from };
}
const expSpeed = m => m.baseSpeed + Math.random() * m.speedVar + EXP_STAT_WAVE * 2.5;
function expSummon(type, n, spread) { // wave enemies stepping in mid-fight (they count toward the wave)
    const m = expMinionDef(type); if (!m) return;
    for (let k = 0; k < n; k++) { const sp = expPoint(false); activeEnemies++; newMinion(m, sp.x, sp.y + (spread ? (k - n / 2) * 24 : 0), sp.from, expSpeed(m)); }
    updateHUD();
}

// ---------- waves ----------
// main.js startNextWave, before the map is set: three waves of foes, then the chief alone
function expWaveSetup() {
    if (!expd.started) expBegin();
    if (wave > EXP_WAVES) { isBossWave = true; enemiesToSpawn = 1; enemySpawnTimer = 0; } // the chief: spawnEnemy brings him (expSpawnChief)
    else { isBossWave = false; enemiesToSpawn = EXP_COUNTS[wave - 1]; }
}
const expPlaque = () => expd.done ? 'Homeward' : wave > EXP_WAVES ? 'The Chief' : `Wave ${wave} of ${EXP_WAVES}`; // hud.js (its line under it: "The road home is open")
function expBanner(b) { // hud.js showWaveBanner: the expedition's name over the wave; true = no banner (the chief's comes when he shows, expEntrance)
    if (isBossWave) return true;
    b.querySelector('.wb-kicker').textContent = EXPEDITIONS[activeExpedition].name;
    return false;
}
// stage.js onWaveCleared: a regular wave rolls on after the breather; the chief's wave (with whatever his move summoned) ends it
function expWaveCleared() {
    if (isBossWave) {
        if (!bossSpawned) { gameState = STATE.PLAYING; lastTime = performance.now(); return; }
        expFinish(); return;
    }
    if (waveBreak > 0) return;
    gameState = STATE.PLAYING; lastTime = performance.now();
    waveBreak = WAVE_BREAK;
}

// ---------- the chief ----------
function expSpawnChief() { // main.js spawnEnemy, on the chief's wave (enemiesToSpawn / activeEnemies are already counted)
    const X = EXPEDITIONS[activeExpedition], C = X.chief, T = expTune(), m = expMinionDef(C.type), sp = expPoint(true);
    const e = newMinion(m, sp.x, sp.y, sp.from, expSpeed(m) * 0.95);
    e.hp = e.maxHp = T.chiefHp; e.dmg *= T.chiefDmg; e.size = Math.round(e.size * C.scale); e.xp = T.chiefXp * T.xp;
    e.chief = C; e.isBoss = true; e.tint = C.tint; // isBoss: utils.js isBossE (knockback / CC immunity, the boss bar, the Nightblade's weak point)
    expd.chiefE = e; expd.fired = {}; expd.nextShatter = fxTime + 3; expd.chiefAt = fxTime; expd.entered = false;
}
// He steps into view (or 3 s have gone): the boss card (stage.js), a jolt and a flare (expeditions_fx.js), his line
function expEntrance(e) {
    const C = e.chief; expd.entered = true; expd.enterAt = fxTime;
    el('wave-banner').classList.remove('quest'); showBossCard(C.name, C.title);
    chiefEntranceFx(e);
    if (C.bark) sqs.bark = { e, name: C.name, text: C.bark, t0: fxTime, life: 3.6 }; // sidequests_fx.js drawQuestBark
}
const expInView = (e, m) => e.x > camera.x + m && e.x < camera.x + viewW() - m && e.y > camera.y + m && e.y < camera.y + viewH() - m;
// The move's wind-up (expeditions_fx.js drawExpTell): `e` it follows, `kind` its look; e.expTellAt drives the chief's own pose for it
function expRing(e, r, color, life, kind) { e.expTellAt = fxTime; effects.push({ type: 'exp_ring', x: e.x, y: e.y, e, kind, radius: r, color, life, maxLife: life }); }
function expBark(e, text) { sqs.bark = { e, name: e.chief.name, text, t0: fxTime, life: 2.4 }; }

// main.js update: the chief's moves, by his move key. Rally / howl fire at a share of his HP; shatter is a clock.
function updateExpedition(dt) {
    if (!activeExpedition) return;
    const e = expd.chiefE; if (!e || e.dead || e.spawnT > 0) return;
    if (!expd.entered && (expInView(e, 40) || fxTime - expd.chiefAt > 3)) expEntrance(e);
    const T = expTune(), C = e.chief, hpf = e.hp / e.maxHp;
    if (C.move === 'rally' || C.move === 'howl') {
        T.at.forEach((th, i) => {
            if (expd.fired[th] || hpf > th) return;
            expd.fired[th] = true;
            const n = T.n[i];
            if (C.move === 'rally') { // Harrow barks and the garrison steps out of the doorways
                expBark(e, T.call); expRing(e, 240, '#ff8a65', 0.8, 'rally');
                after(0.8, () => { if (!e.dead) { const foes = EXPEDITIONS[activeExpedition].foes.filter(t => t !== C.type); for (let k = 0; k < n; k++) expSummon(foes[(Math.random() * foes.length) | 0], 1, false); } });
            } else { // Old Scar howls and feral hounds burst from the treeline and the kennels
                expRing(e, 320, '#bcaaa4', 0.8, 'howl'); addShake(2);
                after(0.8, () => { if (!e.dead) expSummon('hound', n, true); });
            }
        });
    } else if (C.move === 'shatter' && fxTime >= expd.nextShatter && Math.hypot(player.x - e.x, player.y - e.y) < 800) {
        expd.nextShatter = fxTime + T.every;
        expRing(e, 170, C.tint, 0.8, 'shatter');
        after(0.8, () => { // flat shards, the crystal slime's own look (enemysprites.js: owner.type crystal_slime)
            if (e.dead) return;
            const a0 = Math.random() * 6.283;
            for (let k = 0; k < T.shards; k++) { const a = a0 + k / T.shards * 6.283; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, radius: 6, color: C.tint, life: 2.4, isEnemy: true, owner: e, damage: e.dmg * 0.55 }); }
        });
    }
}

// combat.js checkEnemyDeath, a real enemy fell (before activeEnemies is counted down)
function expOnKill(e) {
    if (!activeExpedition || e.dummy) return;
    expd.kills++;
    if (!e.chief) return;
    const X = EXPEDITIONS[activeExpedition], T = expTune();
    for (let i = 0; i < 8; i++) drops.push({ x: e.x - 24 + i * 7, y: e.y + (i % 3) * 9, type: 'gold', val: goldBonus(Math.round(X.purse / 8)), radius: 8, life: 30.0 }); // the purse; collectAllDrops banks it when the wave ends
    effects.push({ type: 'text', text: X.chief.name + ' falls', x: e.x, y: e.y - 50, color: '#ffd54f', life: 1.8, maxLife: 1.8 });
    chiefFellFx(e); // expeditions_fx.js: a gold flash; the Prism bursts
    if (X.chief.move === 'shatter') { // the Prism splits in three; the expedition ends when they're dead too (activeEnemies)
        const m = expMinionDef(X.chief.type);
        for (let k = 0; k < 3; k++) {
            const a = k / 3 * 6.283 + 0.5, kid = newMinion(m, e.x + Math.cos(a) * 36, e.y + Math.sin(a) * 36, 'burst', expSpeed(m));
            activeEnemies++; kid.hp = kid.maxHp = Math.round(kid.hp * 0.6); kid.size = Math.round(kid.size * 1.05); kid.spawnT = kid.spawnMax = 0.4; kid.splitKid = true;
            burst(kid.x, kid.y, a, 1.2, 8, { kind: 'debris', color: '#d9c6ff', size: 4, speed: [100, 300], life: 0.5, drag: 3 });
        }
        updateHUD();
    }
}
function expNoteItem(name) { if (activeExpedition && expd) expd.items.push(name); } // sidequests.js questCacheBroken
function expNoteBounty(id, n, total) { if (activeExpedition && expd) expd.bounty[id] = { n, total }; } // sidequests.js questOnKill

// ---------- the end ----------
function expFinish() { // the chief (and what he summoned or split into) is down
    if (expd.done) return;
    expd.done = true; expd.endGold = player.gold - expd.gold0;
    if (heroSlot >= 0) saveHero({ ...heroSnapshot(), entry: null, dungeon: null, resume: null }); // gold, XP and materials are kept; no retry point any more
    currentMap.caveOpen = true; showStagePrompt(true, 'The road home is open &middot; walk back to where you started');
    const x = expExit(); effects.push({ type: 'cave_open_flash', x: x.x, y: x.y, color: '#ffd54f', life: 1.2, maxLife: 1.2 });
    gameState = STATE.PLAYING; lastTime = performance.now(); updateHUD(); // the plaque: "Homeward"
}
function expReturn() { // stage.js updateStage: the hero stands on the road home
    if (expd.panel) return;
    expd.panel = true; showStagePrompt(false);
    const X = EXPEDITIONS[activeExpedition], gold = player.gold - expd.gold0;
    const mt = MAT_KEYS.map(k => [k, mats[k] - (expd.mats0 ? expd.mats0[k] : 0)]).filter(a => a[1] > 0);
    const matHtml = mt.length ? mt.map(([k, n]) => `<span class="ex-chip">${matImg(k)}<b>+${n}</b> ${MAT_NAMES[k]}</span>`).join('') : '<i class="ex-none">Nothing salvaged this time</i>'; // icons.js
    const itemId = name => Object.keys(QUESTS).find(id => QUESTS[id].item === name); // sidequests.js notes the item's name; its icon is the quest's
    const finds = expd.items.map(n => `<div class="ex-find">${itemId(n) ? qsIconImg('item_' + itemId(n), 'ex-ic') : qsIconImg('quest', 'ex-ic')}<span>${escapeHtml(n)}</span><em class="ex-done">Found</em></div>`) // sidequests_fx.js
        .concat(Object.keys(expd.bounty).map(id => { const b = expd.bounty[id];
            return `<div class="ex-find">${qsIconImg('quest', 'ex-ic')}<span>${QUESTS[id].title}</span><em class="${b.n >= b.total ? 'ex-done' : ''}">${b.n}/${b.total}</em><div class="ex-bar"><i style="width:${Math.round(b.n / b.total * 100)}%"></i></div></div>`; }));
    el('expedition-panel').innerHTML = `
        <div class="ex-kicker">${escapeHtml(X.chief.name)} is down</div>
        <h1 class="ui-title">Expedition complete</h1>
        <div class="ui-sub">${X.name}</div>
        <div class="ui-divider"><span></span></div>
        <div class="ex-stats"><div class="stat-box"><div class="sv">${expd.kills}</div><div class="sl">Kills</div></div><div class="stat-box"><div class="sv">${qsIconImg('coin', 'ex-coin')}+${gold}</div><div class="sl">Gold</div></div></div>
        <div class="ex-sect"><div class="ui-label">Materials</div><div class="ex-chips">${matHtml}</div></div>
        ${finds.length ? `<div class="ex-sect"><div class="ui-label">Quest finds</div><div class="ex-finds">${finds.join('')}</div></div>` : ''}
        <div class="ui-row" style="margin-top:20px"><button class="btn btn-primary" id="exp-home" onclick="expHome()">${heroSlot >= 0 ? 'Return to Cinderholt' : 'End run'} <kbd>Enter</kbd></button></div>`;
    el('expedition-end').classList.remove('hidden'); gameState = STATE.INTERMISSION; uiOpenedAt = performance.now();
}
window.expHome = function() { if (heroSlot >= 0) heroToMap(); else location.reload(); };
window.addEventListener('keydown', e => { if (expd && expd.panel && !el('expedition-end').classList.contains('hidden') && e.key === 'Enter' && performance.now() - uiOpenedAt > 350) expHome(); });

// ---------- the noticeboard screen (save.js openBoard / closeBoard; the parchment map is the "Memories" notice) ----------
let boardScreenOpen = false;
function openBoardScreen() { // interiors.js: E at the noticeboard
    if (boardScreenOpen || boardOpen || heroSlot < 0 || gameState !== STATE.PLAYING) return;
    boardScreenOpen = true; gameState = STATE.MENU;
    if (!heroBase().seen.board) { heroBase().seen.board = true; baseSave(); } // map_base.js: the board stops shimmering once it's been read
    boardScreenShow(true);
}
function boardScreenShow(on) { // also the map's Back (save.js closeBoard)
    boardScreenOpen = on;
    if (on) renderBoardScreen();
    el('board-screen').classList.toggle('hidden', !on);
}
function closeBoardScreen() { boardScreenShow(false); gameState = STATE.PLAYING; lastTime = performance.now(); }
function boardScreenEsc() { if (boardScreenOpen && !boardOpen) closeBoardScreen(); }
// quests whose task is waiting in this expedition: their titles
const boardQuestsFor = x => questsOn() ? Object.keys(QUESTS).filter(id => QUESTS[id].exp === x && qGet(id) && qGet(id).state === 'active') : [];
// Each notice is a parchment pinned to the cork (ui.css .bd-note): a tilt, a ragged edge of its own (a clip-path from a seed,
// so it tears the same way every time), a red ribbon on one an active quest points to; the memories are an old map
const BOARD_TILT = [-1.6, 1.1, -0.7, 1.9];
function tornClip(seed) {
    const r = clrRng(seed), pts = [], f = v => v.toFixed(1); // map_clearing.js
    for (let i = 0; i <= 14; i++) pts.push(`${f(i / 14 * 100)}% ${f(r() * 5)}px`);
    for (let i = 1; i < 8; i++) pts.push(`calc(100% - ${f(r() * 4)}px) ${f(i / 8 * 100)}%`);
    for (let i = 14; i >= 0; i--) pts.push(`${f(i / 14 * 100)}% calc(100% - ${f(1 + r() * 6)}px)`);
    for (let i = 7; i > 0; i--) pts.push(`${f(r() * 4)}px ${f(i / 8 * 100)}%`);
    return `polygon(${pts.join(', ')})`;
}
const BOARD_MAP_ART = '<svg class="bd-mapart" viewBox="0 0 200 130" aria-hidden="true">' // the old map's drawing, faded under the text
    + '<path d="M8 96 C30 70 44 92 62 74 S96 40 118 52 152 30 192 20" fill="none" stroke="#6b4a26" stroke-width="2" stroke-dasharray="5 4"/>'
    + '<path d="M120 112 l8 -14 8 14 M134 114 l7 -12 7 12 M24 30 l7 -12 7 12 M38 32 l6 -10 6 10" fill="none" stroke="#5a3f22" stroke-width="1.6"/>'
    + '<circle cx="62" cy="74" r="5" fill="none" stroke="#5a3f22" stroke-width="1.6"/><path d="M186 14 l10 12 M196 14 l-10 12" stroke="#8e1f1f" stroke-width="2.4"/>'
    + '<path d="M150 70 q10 -6 20 0 t20 0 M150 80 q10 -6 20 0 t20 0" fill="none" stroke="#6b4a26" stroke-width="1.2"/></svg>';
function renderBoardScreen() {
    let h = `<div class="bd-plank"><h1 class="bd-title">The Noticeboard</h1><div class="bd-sub">At Cinderholt's gate</div></div><div class="bd-cork"><div id="board-notices">`;
    Object.keys(EXPEDITIONS).forEach((x, i) => {
        const X = EXPEDITIONS[x], qs = boardQuestsFor(x);
        h += `<div class="bd-note${qs.length ? ' bd-for' : ''}" style="--rot:${BOARD_TILT[i % 4]}deg"><div class="bd-paper" style="clip-path:${tornClip(17 + i * 31)}">`
            + `<div class="bd-head">${escapeHtml(X.notice[0])}</div><div class="bd-text">${escapeHtml(X.notice[1])}</div><div class="bd-sign">&mdash; ${escapeHtml(X.poster)}</div>`
            + (qs.length ? `<div class="bd-tag"><b>!</b>For: ${qs.map(id => escapeHtml(QUESTS[id].title)).join(', ')}</div>` : '')
            + `<div class="bd-foot"><span class="bd-name">${escapeHtml(X.name)}</span><button class="bd-stamp" onclick="boardSetOut('${x}')">Set out</button></div></div>`
            + `<i class="bd-pin"></i>${qs.length ? '<i class="bd-ribbon" title="A quest of yours leads here">!</i>' : ''}</div>`;
    });
    h += `<div class="bd-note bd-memories" style="--rot:${BOARD_TILT[3]}deg"><div class="bd-paper bd-map" style="clip-path:${tornClip(5)}">${BOARD_MAP_ART}`
        + `<div class="bd-head">Memories&hellip;</div><div class="bd-text">The old roads are still in your head: the Slime Caves, the Bandit Bastion. You could walk them again.</div>`
        + `<div class="bd-foot"><span class="bd-name">An old map</span><button class="bd-stamp bd-sepia" onclick="boardMemories()">Remember</button></div></div><i class="bd-pin bd-brass"></i></div></div></div>`
        + `<div class="bd-back"><button class="btn btn-danger" onclick="closeBoardScreen()">Back to Cinderholt <kbd>Esc</kbd></button></div>`;
    el('board-panel').innerHTML = h;
}
window.boardSetOut = x => { if (baseOpen()) heroToDungeon('exp_' + x); }; // save.js: a clean reload into the expedition
window.boardMemories = () => { boardScreenShow(false); openMemoriesMap(); }; // save.js: the parchment map; picking a dungeon there is a memory

// ---------- the memory card (main.js startGame, for a replayed dungeon) ----------
// A sepia card with dust drifting through the light (ui.css #memory-card); it fades out over the run starting under it
let memCb = null, memTimer = 0, memAt = 0;
function showMemoryCard(go) {
    const M = MEMORIES[activeDungeonId]; if (!M) { go(); return; }
    const cut = M.title.indexOf(': '); // "A memory: the Slime Caves": a kicker over the place's name
    el('memory-kicker').textContent = cut > 0 ? M.title.slice(0, cut) : ''; el('memory-title').textContent = cut > 0 ? M.title.slice(cut + 2) : M.title; el('memory-line').textContent = M.line;
    const dust = el('memory-dust');
    if (!dust.children.length) for (let i = 0; i < 26; i++) { // motes, each on its own slow loop
        const d = document.createElement('i'), sz = 1.5 + Math.random() * 3;
        d.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;animation-duration:${(7 + Math.random() * 8).toFixed(1)}s;animation-delay:-${(Math.random() * 12).toFixed(1)}s;--dx:${(Math.random() * 60 - 30).toFixed(0)}px`;
        dust.appendChild(d);
    }
    const card = el('memory-card'); card.classList.remove('hidden', 'out'); memCb = go; memAt = performance.now();
    memTimer = setTimeout(memoryCardDone, 4200);
}
window.memoryCardDone = function() {
    if (!memCb) return;
    clearTimeout(memTimer); const go = memCb; memCb = null;
    const card = el('memory-card'); card.classList.add('out'); go(); // the run starts under it as it fades
    setTimeout(() => { if (!memCb) { card.classList.add('hidden'); card.classList.remove('out'); } }, 1400);
};
window.addEventListener('keydown', () => { if (memCb && performance.now() - memAt > 400) memoryCardDone(); });

// ---------- dev console: start an expedition ----------
window.devExpedition = function(x) {
    closeDevMenu();
    if (heroSlot >= 0 && baseOpen()) { heroToDungeon('exp_' + x); return; } // the hero's own path: save, reload, in
    // Quick Play (or a hero not yet home): switch in place, as the wave jump does. No retry point is saved
    expSelect('exp_' + x);
    enemies.length = 0; projectiles.length = 0; effects.length = 0; drops.length = 0; gameTimers.length = 0;
    activeEnemies = 0; enemiesToSpawn = 0; wave = 0; waveBreak = 0; stageEvent = null; currentMap.type = null;
    resetHUD(); startNextWave();
};
