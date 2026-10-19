// ==========================================
// sidequests.js - Cinderholt's talk menu, quest state, markers, tracker, keepsakes and favours (BASE.md step 5)
// ==========================================
// The content is quests.js (QUESTS, KEEPSAKES, PERKS, TALK); this file runs it. Talking to a friend (npcs.js talkTo) opens
// `talkMenu`: their greeting, then a list inside the dialogue box (dialogue.js `choices`): Chat, the service, the quest (New: /
// In progress: / Hand in:), Deliver when the hero carries something for them, Leave. After a chat or a quest exchange the menu
// comes back with "Anything else?".
// State lives in heroBase().quests (save.js; outside heroSnapshot, so a death Retry never undoes progress: the forgiving choice):
//   { <id>: { state: 'active' | 'ready' | 'done', step, n, carrying, got } }, plus heroBase().keepsakes / .perks ({ id: true }).
// 'ready' means the task is done and the giver waits; the reward is paid on hand-in. A saved hero only (Quick Play has none).
// Triggers per kind:
//   ambush  - updateSidequests: walking within QS_AMBUSH_R of the lot springs real bandits (questFoe, stats from enemies.json
//             stage1 at QS_FOE_WAVE, flagged `questFoe`: combat.js checkEnemyDeath hands them to questFoeDied, so they never touch the
//             wave counters, XP or drops). All down: a stash (a supply_cache entity with pod.quest) appears; opening it, by E or a hit,
//             makes the quest ready. Dying in Cinderholt (combat.js playerDied -> baseDeath): no death screen, a fade, awake at the gate.
//   wares   - `count` walk-over bundles at WARES_SPOTS, the picked ones kept in state.got.
//   fetch   - a quest cache on the dungeon map (QUEST_SPOTS; placeQuestCaches, from stage.js setStageMap and main.js startNextWave
//             next to caches.js placeCaches); breaking it (caches.js cacheBroken -> questCacheBroken) makes the quest ready.
//   bounty  - combat.js checkEnemyDeath -> questOnKill: a kill of the type counts in any run; saved on each count.
//   deliver - accepting gives the item; talking to `to` offers Deliver.
// Keepsakes and favours (hasKeepsake / hasPerk) are read where they matter: combat.js (gold), potions.js (flask, elixir price),
// main.js recalcStats (speed), ui.js shopPrice, items.js upgradeCost.

const QS_AMBUSH_R = 140, QS_WARE_R = 34, QS_FOE_WAVE = 13, QS_FOE_HP = 1.5;
// Where things stand (all checked against the grids): the dungeon quest caches (map, near, kind for the placeholder art), the
// wares round the village (by the well, the road, the palisade, behind the hall, the apothecary's, the south), the ruins' stash.
const QUEST_SPOTS = {
    strongbox: { x: 4190, y: 905, kind: 'iron' }, // the castle's treasury, east end between the pillars
    hammer: { x: 1668, y: 552, kind: 'iron' }, // the castle's smithy yard, south of the forge and beside the anvil
    herbs: { x: 2838, y: 690, kind: 'wood' }, // the trail camp, a few steps from the fire and its log seats
};
const WARES_SPOTS = [[1418, 968], [858, 978], [2498, 962], [1480, 372], [655, 478], [1655, 1395]];
const RUINS_STASH = [580, 700];
const RUINS_FOES = [[60, -60], [-80, -40], [-20, 80]]; // where the three step out, from the lot's centre

const devQuestBase = { seen: {}, built: {} }; // a dev visit with no saved hero (no saves, no effects)
const sqs = { foes: [], bark: null, sprung: false, wares: [], defs: {}, lastChat: {}, closedSeen: {}, reviving: false, wakeAt: 0, nudge: null, later: [] };

const questsOn = () => heroSlot >= 0 && !!heroData && !isTraining();
const qBase = () => heroData ? heroBase() : devQuestBase; // save.js
const qTable = () => { const b = qBase(); return b.quests || (b.quests = {}); };
const qGet = id => qTable()[id] || null;
const questDone = id => { const s = qGet(id); return !!s && s.state === 'done'; };
const hasKeepsake = id => !!(heroData && heroData.base && heroData.base.keepsakes && heroData.base.keepsakes[id]);
const hasPerk = id => !!(heroData && heroData.base && heroData.base.perks && heroData.base.perks[id]);
const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

function saveQuests() { if (questsOn()) saveHero({ base: heroData.base }); } // cheap and rare: on a count, a pickup, a hand-in (not per frame)

// ---------- effects of keepsakes and favours ----------
const goldBonus = v => Math.round(v * (hasKeepsake('lucky_coin') ? 1.15 : 1) * charmGoldMult()); // combat.js: gold from kills
const moveBonus = () => hasKeepsake('hound_tooth') ? 1.05 : 1; // main.js recalcStats
const flaskBonus = () => hasKeepsake('herb_pouch') ? 1.1 : 1; // potions.js drinkFlask
const elixirPrice = () => hasPerk('apoth_elixir') ? 20 : ELIXIR_PRICE; // potions.js
const roundTo5 = v => Math.max(5, Math.round(v / 5) * 5);
const shopPrice = item => hasPerk('merchant_discount') ? roundTo5(item.price * 0.85) : item.price; // ui.js renderShop
const smithRate = () => hasPerk('smith_discount') ? 0.85 : 1; // items.js upgradeCost

// ---------- availability ----------
const giverQuests = giver => Object.keys(QUESTS).filter(id => QUESTS[id].giver === giver).sort((a, b) => QUESTS[a].order - QUESTS[b].order);
function questNeedsHold(id) {
    const n = QUESTS[id].needs || {};
    if (n.quest && !questDone(n.quest)) return false;
    if (n.built && !isBuilt(n.built === true ? QUESTS[id].giver : n.built)) return false;
    return true;
}
const questActiveOf = giver => giverQuests(giver).find(id => { const s = qGet(id); return s && s.state !== 'done'; }) || null; // one at a time per friend
function questOfferOf(giver) { // the lowest-order quest not yet started, if its needs hold
    if (questActiveOf(giver)) return null;
    const next = giverQuests(giver).find(id => !qGet(id));
    return next && questNeedsHold(next) ? next : null;
}
const deliverTargets = to => Object.keys(QUESTS).filter(id => { const s = qGet(id), Q = QUESTS[id]; return Q.kind === 'deliver' && Q.to === to && s && s.state === 'active' && s.carrying; });

function stepText(id) {
    const Q = QUESTS[id], s = qGet(id), i = s.state === 'ready' ? Q.steps.length - 1 : Math.min(s.step || 0, Q.steps.length - 2);
    return Q.steps[Math.max(0, i)].replace('{n}', s.n || 0).replace('{count}', Q.count || 0);
}

// ---------- the talk menu ----------
function whenHolds(id, w) {
    if (!w) return true;
    if (w === 'built') return !BUILDINGS[id] || isBuilt(id);
    if (w.startsWith('quest:')) return questDone(w.slice(6));
    if (w.startsWith('cleared:')) return !!heroData && (heroData.cleared || []).includes(w.slice(8));
    return false;
}

function talkMenu(id, again) { // npcs.js talkTo
    const f = FRIENDS[id], T = TALK[id], b = BUILDINGS[id], built = !b || isBuilt(id);
    const lines = again ? ['Anything else?'] : [(T.greet.find(g => whenHolds(id, g.when)) || T.greet[T.greet.length - 1]).line];
    if (!built && !again && !sqs.closedSeen[id]) { sqs.closedSeen[id] = true; lines.push(...f.closed); } // why the shop is shut, once a visit
    const choices = [{ label: 'Chat', act: () => chat(id) }];
    choices.push(built ? { label: T.service, act: () => f.service() } : { label: T.service, disabled: true, note: 'Rebuild ' + b.name + ' first' });
    if (questsOn()) {
        const cur = questActiveOf(id), off = cur ? null : questOfferOf(id);
        if (cur) choices.push(qGet(cur).state === 'ready' ? { label: 'Hand in: ' + QUESTS[cur].title, act: () => handIn(id, cur) } : { label: 'In progress: ' + QUESTS[cur].title, act: () => remind(id, cur) });
        else if (off) choices.push({ label: 'New: ' + QUESTS[off].title, act: () => offerQuest(id, off) });
        for (const q of deliverTargets(id)) choices.push({ label: 'Deliver: ' + QUESTS[q].item, act: () => deliver(id, q) });
    }
    choices.push({ label: 'Leave', leave: true });
    openDialogue({ name: f.name, title: f.title, portrait: id, lines, choices });
}

// Plays lines as the friend, then back to the menu
const talkThen = (id, lines, then) => openDialogue({ name: FRIENDS[id].name, title: FRIENDS[id].title, portrait: id, lines, onClose: then || (() => talkMenu(id, true)) });

function chat(id) { // one convo from the first pool whose `when` holds, not the one just heard
    const pool = (TALK[id].chat.find(c => whenHolds(id, c.when)) || TALK[id].chat[TALK[id].chat.length - 1]).convo;
    let pick = pool[0];
    if (pool.length > 1) do pick = pool[(Math.random() * pool.length) | 0]; while (pick === sqs.lastChat[id]);
    sqs.lastChat[id] = pick;
    talkThen(id, pick);
}

function offerQuest(id, q) {
    const Q = QUESTS[q];
    openDialogue({
        name: FRIENDS[id].name, title: FRIENDS[id].title, portrait: id, lines: Q.offer,
        choices: [
            { label: 'Accept', act: () => talkThen(id, [Q.accept], () => { questAccept(q); talkMenu(id, true); }) },
            { label: 'Not now', leave: true, act: () => talkMenu(id, true) },
        ],
    });
}
function remind(id, q) { talkThen(id, ['Any news? Remember: ' + lowerFirst(stepText(q)).replace(/\.$/, '') + '.']); }
function deliver(id, q) { talkThen(id, QUESTS[q].deliver, () => { const s = qGet(q); s.carrying = false; questReady(q); talkMenu(id, true); }); }
function handIn(id, q) { talkThen(id, QUESTS[q].done, () => { questFinish(q); talkMenu(id, true); }); }

// ---------- state changes ----------
function questAccept(q) {
    const Q = QUESTS[q];
    qTable()[q] = { state: 'active', step: 0, n: 0, carrying: Q.kind === 'deliver', got: [] };
    if (Q.kind === 'deliver') questLine('Received: ' + Q.item, '#ffe9a8', 0);
    questWorldRefresh();
    whenFree(() => questBanner('New quest', Q.title, stepText(q)));
    baseSave(); saveQuests(); updateHUD();
}
function questReady(q) { // the task is done: the giver waits
    const Q = QUESTS[q], s = qGet(q); if (!s || s.state !== 'active') return;
    s.state = 'ready'; s.step = Q.steps.length - 1;
    if (Q.kind === 'fetch') s.carrying = true;
    saveQuests(); updateHUD();
}
function questFinish(q) { // the hand-in: the reward, a banner and its lines
    const Q = QUESTS[q], s = qGet(q), R = Q.reward || {}, b = qBase(); if (!s || s.state !== 'ready') return;
    s.state = 'done'; s.carrying = false;
    const lines = [];
    if (R.keepsake) { (b.keepsakes || (b.keepsakes = {}))[R.keepsake] = true; lines.push(['Keepsake: ' + KEEPSAKES[R.keepsake].name, '#e1bee7', R.keepsake]); }
    if (R.perk) { (b.perks || (b.perks = {}))[R.perk] = true; lines.push(['Favour: ' + PERKS[R.perk].name, '#a7e0d8', 'seal_' + Q.giver]); }
    if (R.gold) { player.gold += R.gold; lines.push([`+${R.gold} Gold`, '#ffd54f', 'coin']); }
    MAT_KEYS.forEach(k => { if (R[k]) { mats[k] += R[k]; lines.push([`+${R[k]} ${MAT_NAMES[k]}`, MAT_COLORS[k], k]); } });
    lines.forEach((l, i) => questLine(l[0], l[1], lines.length - 1 - i, l[2])); // the keepsake or favour on top
    recalcStats(); // the Hound-Tooth Charm
    const what = R.keepsake ? KEEPSAKES[R.keepsake].name : R.perk ? PERKS[R.perk].name : R.gold ? `${R.gold} gold` : '';
    whenFree(() => questBanner('Quest complete', Q.title, what)); // after the talk: the game is paused under it
    baseSave(); saveQuests(); updateHUD();
}

// A pickup line over the hero, in caches.js MAT_FX's style: a material's icon, or `ic` from sidequests_fx.js qsIcon (default a scroll)
function questLine(text, color, i = 0, ic) {
    const f = { text, x: player.x, y: player.y - 40 - i * 21, t0: fxTime + i * 0.2 }; // on fxTime: lines from a talk wait for it to end
    if (MAT_KEYS.includes(ic)) f.k = ic; else { f.icon = qsIcon(ic || 'quest'); f.color = color; }
    MAT_FX.push(f);
}

// Banners wait until the game runs again (a hand-in reopens the talk menu), then play one at a time
const whenFree = fn => sqs.later.push(fn);
function questBanner(kicker, title, sub) { // rebuild.js baseBanner's banner, in the quest dress (ui.css #wave-banner.quest)
    const b = el('wave-banner'); if (!b) return;
    b.classList.remove('boss'); b.classList.add('quest');
    b.querySelector('.wb-kicker').textContent = kicker; b.querySelector('.wb-title').textContent = title; b.querySelector('.wb-sub').textContent = sub || '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- the world: caches, wares, the stash ----------
function spawnQuestCache(key, x, y, kind, quest) { // a supply_cache entity (caches.js) that gives no materials, only moves its quest on
    const old = sqs.defs[key]; if (old && cacheAlive(old)) return old;
    const c = sqs.defs[key] = { id: 'q_' + key, x, y, kind, give: {}, quest, ent: null };
    const e = { type: 'supply_cache', pod: c, prop: true, x, y, size: 28, color: MAT_COLORS[kind], hp: 1, maxHp: 1, xp: 0, dmg: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: 0, seed: Math.random() * 10, bornAt: fxTime };
    c.ent = e; enemies.push(e);
    const obs = { x, y, r: CACHE_R, kind: 'cache' };
    currentMap.obstacles.push(obs); cacheObs.push({ list: currentMap.obstacles, obs, def: c });
    return c;
}

function placeQuestCaches(type) { // expeditions.js: a fetch quest's cache stands only in its own expedition (never a memory, never Cinderholt) // stage.js setStageMap / main.js startNextWave, after caches.js placeCaches
    if (!questsOn() || isEndlessMode || isInterior(type) || !currentMap.obstacles) return;
    for (const id in QUESTS) {
        const Q = QUESTS[id], s = qGet(id);
        if (Q.kind === 'fetch' && Q.map === type && Q.exp === activeExpedition && activeExpedition && s && s.state === 'active' && !isBase()) { const p = QUEST_SPOTS[id]; spawnQuestCache(id, p.x, p.y, p.kind, id); }
    }
    if (type === 'base' && isBase()) {
        const r = qGet('ruins');
        if (r && r.state === 'active' && r.step >= 1) spawnQuestCache('ruins', RUINS_STASH[0], RUINS_STASH[1], 'iron', 'ruins');
        sqs.wares = [];
        const w = qGet('wares');
        if (w && w.state === 'active') WARES_SPOTS.slice(0, QUESTS.wares.count).forEach((p, i) => { if (!(w.got || []).includes(i)) sqs.wares.push({ i, x: p[0], y: p[1] }); });
    }
}
const questWorldRefresh = () => { if (currentMap) placeQuestCaches(currentMap.type); };

// stage.js setStageMap (the map changed): the ambushers belong to the village; the caches go in after the map's own reset
function questMapChanged(type) {
    clearFoes(); sqs.sprung = false;
    placeQuestCaches(type);
}
function clearFoes() { for (const e of sqs.foes) e.dead = true; sqs.foes = []; sqs.bark = null; endNudge(); }

// caches.js cacheBroken, for a cache with pod.quest: the stash opened, or the item found
function questCacheBroken(c) {
    const q = c.quest, Q = QUESTS[q], s = qGet(q); if (!s || s.state !== 'active') return;
    if (Q.kind === 'ambush') whenFree(() => questBanner('Stash found', Q.title, Q.stashFound));
    else { questLine('Found: ' + Q.item, '#ffe9a8', 0, 'item_' + q); expNoteItem(Q.item); }
    questReady(q);
}

// ---------- the ambush ----------
function questFoe(type, x, y) {
    const m = enemyDataConfig.bandit_bastion.stage1_minions.find(t => t.type === type), w = QS_FOE_WAVE; // Cinderholt has no activeDungeon: the Bastion's stats, explicitly
    const hp = Math.round((m.baseHp + w * m.hpScale) * QS_FOE_HP);
    const e = { x, y, size: m.size, color: m.color, speed: m.baseSpeed + Math.random() * m.speedVar + w * 2.5, hp, maxHp: hp, type: m.type, dmg: m.baseDmg + w * m.dmgScale, xp: 0, attackTimer: m.attackTimer || 0, meleeTimer: 0, ammo: m.ammo || 0, frozenTimer: 0, facingAngle: 0, shieldHp: m.shieldHp, shieldMax: m.shieldMax, puddleTimer: m.puddleTimer || 0, bleedTimer: 0, bleedDmg: 0, orbs: 0, maxOrbs: 0, questFoe: true };
    clampToBounds(e, e.size / 2);
    enemies.push(e); sqs.foes.push(e);
    dustPuff(x, y, 0, Math.PI * 2, 6, '#8d8478'); // skillfx_space.js
    return e;
}

function springAmbush(q) {
    const Q = QUESTS[q], h = bse.houses[Q.spot.house]; sqs.sprung = true;
    Q.foes.forEach((t, i) => { const o = RUINS_FOES[i % RUINS_FOES.length]; questFoe(t, h.cx + o[0], h.cy + o[1]); });
    sqs.bark = { e: sqs.foes[0], name: Q.spring.name, text: Q.spring.lines[0], t0: fxTime, life: 3.6 }; // a bark over the leader
    const heap = currentMap.obstacles.find(o => o.kind === 'timber' && Math.hypot(o.x - h.cx, o.y - h.cy) < 170) || { x: h.cx, y: h.cy }; // map_base.js: the lot's charred timber
    ambushFx(heap, sqs.foes); // sidequests_fx.js: out of the heap and the ash
    addShake(3); hitStopTimer = Math.max(hitStopTimer, 0.07);
    const fx = sqs.foes.reduce((s, e) => s + e.x, 0) / sqs.foes.length, fy = sqs.foes.reduce((s, e) => s + e.y, 0) / sqs.foes.length;
    if (camera.tx === null) sqs.nudge = { t0: fxTime, x: fx, y: fy }; // the camera leans their way a moment (updateNudge)
}
const QS_NUDGE = 1.1;
function updateNudge() {
    const n = sqs.nudge; if (!n) return;
    const u = (fxTime - n.t0) / QS_NUDGE;
    if (u >= 1 || (stageEvent && stageEvent.blocking)) { endNudge(); return; }
    const k = 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4); // out quickly, back softly
    camera.tx = player.x + (n.x - player.x) * k; camera.ty = player.y + (n.y - player.y) * k; camera.speed = 6;
}
function endNudge() { if (!sqs.nudge) return; sqs.nudge = null; camera.tx = camera.ty = null; camera.speed = 0; }

function questFoeDied(e) { // combat.js checkEnemyDeath: no XP, no drops, no wave
    sqs.foes = sqs.foes.filter(o => o !== e);
    if (sqs.foes.length) return;
    sqs.bark = null;
    const s = qGet('ruins'); if (!s || s.state !== 'active') return;
    s.step = 1; saveQuests(); questWorldRefresh();
    const c = sqs.defs.ruins; if (c && c.ent) stashRevealFx(c.ent.x, c.ent.y); // sidequests_fx.js: it shows with a puff and its glint
    questLine('The way to the stash is clear', '#ffe9a8', 0, 'item_ruins');
}

// ---------- Cinderholt: death is only a setback ----------
// The world holds still where they fell (update() doesn't run at 0 HP), greys, goes black; they wake at the gate with a line in the dark
function baseDeath() { // combat.js playerDied
    if (sqs.reviving) return;
    sqs.reviving = true; player.hp = 0; player.fallen = true; player.iFrames = 4; buffs.rooted = 1.6; keys.w = keys.a = keys.s = keys.d = false; isMouseDown = false;
    sqs.bark = null; endNudge();
    sqs.reviveT = 0; sqs.wakeAt = 0;
    updateHUD(); // the orb showed the killing blow's overkill (-271 / 120) while the world stood still
}
// main.js loop, while at 0 HP: the fall's own clock (sidequests_fx.js drawReviveScreen paints it)
function reviveTick(dt) {
    sqs.reviveT += dt;
    updateDoorFade(dt); // a door's fade caught mid-way finishes
    if (sqs.reviveT < QS_FALL_BLACK) return;
    clearFoes(); sqs.sprung = false; // in the dark: the ruins are quiet again
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].isEnemy) projectiles.splice(i, 1);
    const st = STAGE_MAPS.base.start;
    player.x = st.x; player.y = st.y; player.hp = player.maxHp; player.fallen = false; player.fallAngle = undefined;
    player.iFrames = QS_WAKE_HOLD + QS_WAKE_IN + 1; buffs.rooted = QS_WAKE_HOLD + QS_WAKE_IN * 0.6; // they get up as the light comes back
    player.dash = null; player.grappleTarget = null; player.z = 0; resetDruidState(true); updateCamera(0, true); updateHUD();
    sqs.wakeAt = performance.now(); // the game runs again from here; updateSidequests ends the fall once the light is back
}

// ---------- per frame (main.js update) ----------
function updateSidequests(dt) {
    if (sqs.later.length && gameState === STATE.PLAYING && !dlg) { const l = sqs.later; sqs.later = []; l.forEach((f, i) => i ? after(i * 2.3, f) : f()); } // banners held through a talk
    if (sqs.wakeAt && performance.now() - sqs.wakeAt > (QS_WAKE_HOLD + QS_WAKE_IN) * 1000) { sqs.wakeAt = 0; sqs.reviving = false; }
    updateNudge();
    if (!questsOn() || gameState !== STATE.PLAYING || !isBase() || currentMap.type !== 'base' || player.hp <= 0) return;
    const r = qGet('ruins');
    if (r && r.state === 'active' && r.step === 0 && !sqs.sprung && bse.houses.length) {
        const h = bse.houses[QUESTS.ruins.spot.house];
        if (Math.hypot(player.x - h.cx, player.y - h.cy) < QS_AMBUSH_R) springAmbush('ruins');
    }
    for (let i = sqs.wares.length - 1; i >= 0; i--) { // the wares: walk over them
        const w = sqs.wares[i];
        if (Math.hypot(player.x - w.x, player.y - w.y) > QS_WARE_R) continue;
        sqs.wares.splice(i, 1);
        const s = qGet('wares'); if (!s || s.state !== 'active') continue;
        (s.got || (s.got = [])).push(w.i); s.n = s.got.length;
        questLine(`Wares ${s.n}/${QUESTS.wares.count}`, '#ffe9a8', 0, 'ware' + w.i);
        wareFx(w); // sidequests_fx.js: a pop, the bundle hops into the pack
        if (s.n >= QUESTS.wares.count) questReady('wares'); else saveQuests();
    }
}

// combat.js checkEnemyDeath, a real enemy fell: bounties count in any run
function questOnKill(e) {
    if (!questsOn() || e.dummy || e.questFoe || e.pod) return;
    for (const id in QUESTS) {
        const Q = QUESTS[id], s = qGet(id);
        if (Q.kind !== 'bounty' || !s || s.state !== 'active' || e.type !== Q.enemy || !activeExpedition || Q.exp !== activeExpedition) continue; // only in its expedition
        s.n = Math.min(Q.count, (s.n || 0) + 1); expNoteBounty(id, s.n, Q.count);
        questLine(`${Q.title} ${s.n}/${Q.count}`, '#ffe9a8', 0, 'quest');
        if (s.n >= Q.count) questReady(id); else saveQuests();
    }
}

// ---------- E: the stash and the friends' markers ----------
function questInteractables() { // interiors.js interactables
    const out = [];
    for (const key in sqs.defs) {
        const c = sqs.defs[key];
        if (!cacheAlive(c) || !c.ent) continue;
        out.push({ x: c.ent.x, y: c.ent.y, r: 70, label: QUESTS[c.quest].kind === 'ambush' ? 'Open the stash' : 'Take ' + QUESTS[c.quest].item, act: () => { c.ent.hp = 0; checkEnemyDeath(c.ent); } });
    }
    return out;
}

function friendMarker(id) { // '?' something to hand in or deliver, '!' something to offer
    if (!questsOn()) return '';
    const cur = questActiveOf(id);
    if ((cur && qGet(cur).state === 'ready') || deliverTargets(id).length) return '?';
    return !cur && questOfferOf(id) ? '!' : '';
}

// ---------- drawing: sidequests_fx.js (the badges, the wares, the items, the shout, the fall) ----------

// ---------- the HUD: tracker and the Tab sheet ----------
function activeQuests() { return questsOn() ? Object.keys(QUESTS).filter(id => { const s = qGet(id); return s && s.state !== 'done'; }) : []; }
const QT_MAX = 3;
const qCounted = id => { const Q = QUESTS[id], s = qGet(id); return (Q.kind === 'wares' || Q.kind === 'bounty') && s.state === 'active' ? [s.n || 0, Q.count] : null; };
const qStepShort = id => stepText(id).replace(/\s*\(\d+\/\d+\)/, ''); // the count goes on its bar
function qRank(id) { // what the tracker lists first: a hand-in, then what can be done on this map, then the rest
    const Q = QUESTS[id], s = qGet(id), here = currentMap && currentMap.type;
    if (s.state === 'ready') return 0;
    if ((Q.kind === 'fetch' && Q.map === here) || ((Q.kind === 'ambush' || Q.kind === 'wares') && here === 'base')) return 1;
    return 2;
}
// The tracker's short form of "... (noticeboard: The Fallen Bastion)": the step, and the expedition as a pinned tag under it (the Tab sheet keeps the full line)
const qtWhere = step => { const m = step.match(/\s*\(noticeboard: ([^)]+)\)/); return m ? [step.replace(m[0], ''), m[1]] : [step, '']; };
function updateQuestTracker(low) { // hud.js updateHUD; `low`: the boss bar is up (on a narrow window the tracker steps down under it, ui.css)
    const box = el('quest-tracker'); if (!box) return;
    const list = activeQuests(), hide = !list.length || gameState === STATE.DIALOGUE;
    box.classList.toggle('hidden', hide); box.classList.toggle('low', !!low);
    if (hide) return;
    const order = list.map((id, i) => [id, qRank(id) * 100 + i]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
    let html = '<div class="qt-head">Quests</div>';
    for (const id of order.slice(0, QT_MAX)) {
        const ready = qGet(id).state === 'ready', n = qCounted(id);
        const [step, where] = qtWhere(qStepShort(id));
        html += `<div class="qt-q${ready ? ' ready' : ''}"><b>${ready ? '<i class="qt-ck">&#10003;</i>' : ''}${QUESTS[id].title}</b><span>${step}</span>${where ? `<em class="qt-where"><i class="qt-pin"></i>${where}</em>` : ''}`;
        if (n) html += `<div class="qt-bar"><div><i style="width:${Math.round(n[0] / n[1] * 100)}%"></i></div><em>${n[0]}/${n[1]}</em></div>`;
        html += '</div>';
    }
    if (order.length > QT_MAX) html += `<div class="qt-more">+${order.length - QT_MAX} more &middot; <kbd>Tab</kbd></div>`;
    if (html !== box._html) { box.innerHTML = html; box._html = html; }
}
function questSheetHtml() { // hud.js renderTabSheet: its own column beside the stats
    if (!questsOn()) return '';
    const ids = Object.keys(QUESTS).filter(id => qGet(id));
    let h = '';
    if (ids.length) {
        h += '<h4>Quests</h4>';
        const open = ids.filter(id => qGet(id).state !== 'done');
        for (const id of open) {
            const ready = qGet(id).state === 'ready', n = qCounted(id);
            h += `<div class="r qs-q"><span>${QUESTS[id].title}</span><b class="${ready ? 'qs-ready' : ''}">${ready ? '&#10003; Hand in' : n ? `${n[0]}/${n[1]}` : ''}</b></div><div class="note">${qStepShort(id)}</div>`;
        }
        if (!open.length) h += '<div class="note">Nothing in hand. Ask round Cinderholt.</div>';
        const done = ids.filter(id => qGet(id).state === 'done');
        if (done.length) h += `<div class="qs-done">${done.map(id => `<span>&#10003; ${QUESTS[id].title}</span>`).join('')}</div>`;
    }
    const b = qBase(), ks = Object.keys(b.keepsakes || {}), ps = Object.keys(b.perks || {});
    if (ks.length) h += '<h4>Keepsakes</h4>' + ks.map(k => `<div class="qs-k">${qsIconImg(k)}<div><span>${KEEPSAKES[k].name}</span><i>${KEEPSAKES[k].desc}</i></div></div>`).join(''); // sidequests_fx.js
    const seal = k => { const q = Object.keys(QUESTS).find(id => (QUESTS[id].reward || {}).perk === k); return 'seal_' + (q ? QUESTS[q].giver : 'merchant'); };
    if (ps.length) h += '<h4>Favours</h4>' + ps.map(k => `<div class="qs-k">${qsIconImg(seal(k))}<div><span>${PERKS[k].name}</span><i>${PERKS[k].desc}</i></div></div>`).join('');
    return h;
}

// ---------- dev console ----------
window.devQuestsComplete = function() { // every active quest's task done: the giver is waiting
    closeDevMenu();
    for (const id in QUESTS) {
        const s = qGet(id), Q = QUESTS[id]; if (!s || s.state !== 'active') continue;
        if (Q.kind === 'bounty') s.n = Q.count;
        if (Q.kind === 'wares') { s.got = WARES_SPOTS.slice(0, Q.count).map((_, i) => i); s.n = Q.count; sqs.wares = []; }
        if (Q.kind === 'deliver') s.carrying = false;
        if (Q.kind === 'ambush') clearFoes();
        questReady(id);
    }
    questWorldRefresh();
};
window.devQuestsReset = function() { // no quests, keepsakes or favours; the world forgets them too
    closeDevMenu();
    const b = qBase(); b.quests = {}; b.keepsakes = {}; b.perks = {};
    clearFoes(); sqs.sprung = false; sqs.wares = []; sqs.lastChat = {}; sqs.closedSeen = {};
    for (const key in sqs.defs) { const c = sqs.defs[key]; if (c.ent) c.ent.dead = true; c.ent = null; }
    recalcStats(); saveQuests(); baseSave(); updateHUD();
};
