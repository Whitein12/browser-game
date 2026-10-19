// ==========================================
// save.js - Save slots: named heroes who carry over from dungeon to dungeon (CAMPAIGN.md step 2, first slice)
// ==========================================
// Three slots in localStorage (SAVE_KEY), every access in try/catch: a private window or blocked storage still plays,
// just without saves. A hero holds the class (and the Druid's companion, the Spellweaver's spells), level, XP, the skill
// web, gold, gear and the dungeons cleared, plus `entry`: the hero as they entered the current dungeon.
// Flow: the slot screen (#slots-screen) comes before the map. A new hero gets a name, then picks a dungeon and a class as
// before; a saved hero picks a dungeon and goes straight in (main.js selectDungeon). startGame applies the hero after its
// reset (applyHero) and saves the entry. Death offers a retry: the hero is put back as they entered, and the page reloads
// into the same dungeon (sessionStorage RESUME_KEY carries the slot and the dungeon across the reload). Victory marks the
// dungeon cleared and saves. Quitting mid-dungeon loses that dungeon's progress, as dying does (no stage resume yet).
// Save & Quit on a stage-cleared screen stores `resume` (the next wave); Continue picks it up there, while death still goes
// back to the dungeon's entry. A new hero can take the seasoned start once any hero has cleared the Caves. playTime adds up.
// The hub (Cinderholt): on the map, a saved hero with a class is loaded into the game state (hubLoad) and the panel
// (#hub-panel) opens the skill tree (respec free here), the inventory, the merchant and the smith; each returns to the map and saves.
// The Training Room never saves.

const SAVE_KEY = 'ep_saves_v1', SAVE_SLOTS = 3, RESUME_KEY = 'ep_resume';
let heroSlot = -1, heroData = null, heroClock = 0; // the slot in play (-1: quick play, no saves), its hero, when play time was last counted

function readSaves() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return Array.isArray(s) ? s : []; } catch (e) { return []; } }
function writeSaves(list) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
const deepCopy = o => JSON.parse(JSON.stringify(o || null));

// What carries over: progress, not the run's own state (orbs, gauges, buffs)
function heroSnapshot() {
    return {
        classId: selectedClassId, companion: player.companion || null, spells: player.spells ? { ...player.spells } : null,
        level: player.level, xp: player.xp, maxXp: player.maxXp, skillPoints: player.skillPoints, tree: { ...player.tree },
        gold: player.gold, equipment: deepCopy(equipment), inventory: deepCopy(inventory),
        ...potionsSnapshot(), // potions.js: the flask's upgrades ({ flask: { max, potency } }) and the belt
        charms: charmsSnapshot(), // charms.js: worn, in the pack and the wave charms' pouch (never the active one)
        mats: { ...mats }, found: { ...cacheFound }, // caches.js: the materials in the pack and the caches already opened (a Retry puts back what that run found)
    };
}
function saveHero(extra = {}) {
    if (heroSlot < 0 || !heroData || isTraining()) return;
    const list = readSaves(), now = Date.now();
    heroData = { ...heroData, ...extra, savedAt: now, playTime: (heroData.playTime || 0) + (heroClock ? (now - heroClock) / 1000 : 0) };
    heroClock = now;
    list[heroSlot] = heroData; writeSaves(list);
}

// main.js startGame, after its reset: the saved hero's progress (a new hero has none yet)
function applyHero() {
    if (!heroData || isTraining() || heroData.level === undefined) return false;
    const h = heroData;
    player.level = h.level; player.maxXp = xpToNext(h.level); player.xp = Math.min(h.xp, player.maxXp - 1); player.skillPoints = h.skillPoints; // the curve may have changed since the save (combat.js XP_TABLE)
    player.tree = { ...h.tree }; tree.nodes = null; applyTree();
    player.gold = h.gold; equipment = deepCopy(h.equipment) || { weapon: null, armor: null, amulet: null, boots: null, gloves: null }; inventory = deepCopy(h.inventory) || [];
    for (const t of GEAR_SLOT_LIST) equipment[t] = migrateItem(equipment[t]) || null; // items.js: heroes from before the smith hold tiered items
    if (h.kit === 'seasoned') { equipment.weapon = makeRare('weapon', 3); equipment.armor = makeRare('armor', 1); delete h.kit; } // what a hero has after the Caves (BALANCE.md "The campaign pass"), once the class is known
    inventory = inventory.map(migrateItem).filter(Boolean);
    applyPotions(h); // potions.js: old saves get 3 charges, the base brew and an empty belt
    applyCharms(h); // charms.js: old saves have none
    applyMats(h); // caches.js: old saves have no materials
    recalcStats(); player.hp = player.maxHp;
    return Object.keys(h.tree).some(k => k.endsWith('_learn')); // a skill learned: no first-skill pick
}
// main.js startGame, once the hero is ready: the retry point
function heroEntered() {
    if (heroSlot < 0 || !heroData || isTraining()) return;
    const snap = heroSnapshot();
    if (heroResumeWave()) saveHero({ ...snap, resume: null }); // resumed: the retry point stays the dungeon's entry
    else saveHero({ ...snap, entry: snap, dungeon: activeDungeonId, resume: null });
}
// main.js startGame: the wave a Save & Quit left off at in this dungeon (0: none)
function heroResumeWave() { const r = heroData && heroData.resume; return r && r.dungeon === activeDungeonId && !isTraining() ? r.wave : 0; }
function heroSaveQuit() { // ui.js stage-cleared screen
    saveHero({ ...heroSnapshot(), resume: { dungeon: activeDungeonId, wave: wave + 1 } });
    location.reload();
}
// ---------- Cinderholt as the hub (base2.md): a hero who cleared the Bastion lives in the village ----------
// `heroData.base` ({ seen, built }) lives outside heroSnapshot, so a Retry (heroRestart writes `entry`) never undoes it.
const baseOpen = () => heroSlot >= 0 && !!heroData && (heroData.cleared || []).includes('bandit_bastion');
function heroBase() { if (!heroData) return { seen: {}, built: {} }; const b = heroData.base || (heroData.base = {}); b.seen = b.seen || {}; b.built = b.built || {}; return b; }
function baseSave() { if (isBase() && heroSlot >= 0) saveHero(heroSnapshot()); } // ui.js / skilltree.js: a shop, the smith, the inventory or the web closed back into the village
function heroToDungeon(did) { // the noticeboard: a clean reload into the dungeon, as Retry does (a second startGame would double-run loop())
    saveHero(heroSnapshot());
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ slot: heroSlot, dungeon: did })); } catch (e) {}
    location.reload();
}
let boardOpen = false; // the parchment map (the board's Memories) is open over the paused village
function openBoard() { openBoardScreen(); } // interiors.js: E at the noticeboard -> expeditions.js: the notices first, the memories' map behind one of them
function openMemoriesMap() { // expeditions.js: the "Memories..." notice
    if (boardOpen || heroSlot < 0) return;
    boardOpen = true; gameState = STATE.MENU;
    heroMapLocks(); el('start-screen').classList.remove('hidden'); el('class-selection').classList.add('hidden'); showDungeonMap();
    el('hub-panel').classList.add('hidden'); el('board-back').classList.remove('hidden');
    requestAnimationFrame(menuFrame);
}
function closeBoard() { // the map's Back: to the notices
    if (!boardOpen) return;
    boardOpen = false; el('board-back').classList.add('hidden');
    el('dungeon-selection').classList.add('hidden'); el('start-screen').classList.add('hidden');
    boardScreenShow(true);
}
window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (boardOpen) closeBoard(); else boardScreenEsc(); } });
function changeHero() { if (boardOpen) location.reload(); else showSlots(); } // a plain reload lands on the slot screen (no RESUME_KEY)

function heroToMap() { try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ slot: heroSlot, dungeon: null })); } catch (e) {} location.reload(); } // ui.js victory
function heroCleared() { // ui.js showVictory
    if (heroSlot < 0 || !heroData) return;
    const cleared = [...new Set([...(heroData.cleared || []), activeDungeonId])];
    saveHero({ ...heroSnapshot(), cleared, entry: null, dungeon: null, resume: null });
}

// ---------- death: retry the dungeon, or back to the map ----------

function heroDeathButtons() { // combat.js showDeathScreen
    const box = el('death-btns'); if (!box) return;
    box.innerHTML = heroSlot >= 0 && heroData && heroData.entry
        ? `<button class="btn btn-primary" onclick="heroRestart(true)">${activeExpedition ? 'Retry the expedition' : 'Retry the dungeon'}</button><button class="btn btn-danger" onclick="heroRestart(false)">${baseOpen() ? 'Back to Cinderholt' : 'Back to the map'}</button>`
        : `<button class="btn btn-danger" onclick="location.reload()">Return to Menu</button>`;
}
function heroRestart(retry) { // the hero as they entered; the reload starts clean
    saveHero({ ...heroData.entry, resume: null });
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ slot: heroSlot, dungeon: retry ? activeDungeonId : null })); } catch (e) {}
    location.reload();
}

// ---------- the slot screen ----------

function openHeroMenu() { // main.js, once the data is loaded (in place of the map)
    let r = null; try { r = JSON.parse(sessionStorage.getItem(RESUME_KEY)); sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
    if (r && readSaves()[r.slot]) { // back from a retry or a return: the same hero, straight on
        pickHero(r.slot, !!r.dungeon);
        if (r.dungeon) selectDungeon(r.dungeon);
        return;
    }
    showSlots();
}
function showSlots() {
    el('dungeon-selection').classList.add('hidden'); el('class-selection').classList.add('hidden');
    el('slots-screen').classList.remove('hidden');
    const list = readSaves(), box = el('slot-cards'); box.innerHTML = '';
    for (let i = 0; i < SAVE_SLOTS; i++) {
        const h = list[i], card = document.createElement('div');
        card.className = 'slot-card' + (h ? '' : ' empty');
        if (h) {
            const cls = classDataConfig[h.classId], cleared = (h.cleared || []).map(id => (MAP_SITES.find(s => s.id === id) || {}).name || id);
            card.innerHTML = `<canvas class="slot-portrait" width="300" height="230"></canvas><div class="slot-name">${escapeHtml(h.name)}</div>`
                + `<div class="slot-meta">${cls ? cls.name : 'No class yet'}${h.level ? ` &middot; Lv. ${h.level}` : ''}</div>`
                + `<div class="slot-meta">${cleared.length ? 'Cleared: ' + cleared.join(', ') : 'No dungeon cleared yet'}</div>`
                + `<div class="slot-meta">${h.resume ? `Resumes: ${(MAP_SITES.find(s => s.id === h.resume.dungeon) || {}).name || h.resume.dungeon}, wave ${h.resume.wave} &middot; ` : ''}${fmtPlay(h.playTime)}</div>`
                + `<div class="slot-btns"><button class="btn btn-primary" data-act="play">Continue</button><button class="btn btn-danger" data-act="del">Delete</button></div>`;
            if (h.classId && PORTRAITS[h.classId]) drawPortrait(card.querySelector('canvas'), h.classId, 2.3, 0);
        } else {
            const veteran = list.some(o => o && (o.cleared || []).includes('slime_caves')); // the seasoned start: offered once any hero has cleared the Caves
            card.innerHTML = `<div class="slot-name">Empty slot</div><input class="slot-input" maxlength="18" placeholder="Name your hero">`
                + (veteran ? `<label class="slot-meta"><input type="checkbox" class="slot-seasoned"> Seasoned start: Lv. 10, the Caves cleared, a rare weapon and armor</label>` : '')
                + `<div class="slot-btns"><button class="btn btn-primary" data-act="new">New Hero</button></div>`;
        }
        card.addEventListener('click', e => {
            const act = e.target.dataset && e.target.dataset.act; if (!act) return;
            if (act === 'play') pickHero(i);
            else if (act === 'del') { if (confirm(`Delete ${h.name} for good?`)) { const l = readSaves(); l[i] = null; writeSaves(l); showSlots(); } }
            else if (act === 'new') {
                const name = card.querySelector('input').value.trim() || `Hero ${i + 1}`;
                const seasoned = card.querySelector('.slot-seasoned') && card.querySelector('.slot-seasoned').checked;
                const l = readSaves(); l[i] = { name, cleared: [], createdAt: Date.now(), playTime: 0 };
                if (seasoned) Object.assign(l[i], { cleared: ['slime_caves'], level: 10, xp: 0, maxXp: xpToNext(10), skillPoints: TREE_PTS_PER_LEVEL * 10, tree: {}, gold: 0, equipment: null, inventory: [], kit: 'seasoned' }); // the points of nine level-ups; the gear comes with the class (applyHero)
                if (!writeSaves(l)) { alert('Your browser blocks storage: this hero can\'t be saved. Use Quick Play instead.'); return; }
                pickHero(i);
            }
        });
        box.appendChild(card);
    }
}
function pickHero(i, toDungeon) { // toDungeon: the caller starts a dungeon next, so a base hero doesn't go home first
    heroSlot = i; heroData = readSaves()[i];
    if (heroData.classId) { selectedClassId = heroData.classId; player.companion = heroData.companion; player.spells = heroData.spells ? { ...heroData.spells } : null; }
    el('slots-screen').classList.add('hidden');
    heroClock = Date.now();
    if (baseOpen() && heroData.classId && !heroData.resume && !toDungeon) { heroMapLocks(); selectDungeon(BASE_ID); return; } // map_base.js: home in Cinderholt, no map
    hubLoad(); heroMapLocks(); showDungeonMap();
    if (heroData.resume && heroData.classId) selectDungeon(heroData.resume.dungeon); // Continue: straight back to where they saved
}
function fmtPlay(s) { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min played` : `${m} min played`; }
function quickPlay() { heroSlot = -1; heroData = null; hubReady = false; el('slots-screen').classList.add('hidden'); heroMapLocks(); showDungeonMap(); } // the old flow, no saves
// The story's order: the Bandit Bastion opens once this hero has cleared the Slime Caves (Quick Play opens everything)
function heroMapLocks() {
    renderHub();
    const bb = MAP_SITES.find(s => s.id === 'bandit_bastion'), done = !heroData || (heroData.cleared || []).includes('slime_caves');
    bb.locked = !done; bb.storyLock = done ? null : "Clear the Slime Caves first. The raiders' trail starts where your journey home ends.";
    el('map-hero').innerHTML = heroData ? ` &middot; Playing <b>${escapeHtml(heroData.name)}</b> &middot; <span class="slot-quick" onclick="changeHero()">Change hero</span>`
        : ` &middot; Quick play &middot; <span class="slot-quick" onclick="showSlots()">Heroes</span>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }

// ---------- the hub: Cinderholt, on the map ----------

let hubReady = false; // the hero is loaded into activeClass / player / equipment, with no run going
const inHub = () => hubReady && gameState !== STATE.PLAYING && !el('dungeon-selection').classList.contains('hidden');
function hubLoad() {
    hubReady = false;
    if (!heroData || !heroData.classId || heroData.level === undefined) return;
    activeClass = JSON.parse(JSON.stringify(classDataConfig[heroData.classId]));
    if (activeClass.name === 'Spellweaver') applyLoadout(player.spells || lastLoadout(), true);
    applyHero(); hubReady = true;
}
function renderHub() {
    const box = el('hub-panel'); if (!box) return;
    box.classList.toggle('hidden', !hubReady);
    if (!hubReady) return;
    el('hub-name').innerText = heroData.name;
    el('hub-meta').innerHTML = activeClass.name + ' &middot; Lv. ' + player.level + ' &middot; ' + player.gold + ' gold';
    el('hub-tree').innerHTML = 'Skill Tree' + (player.skillPoints > 0 ? ' <b class="hub-pts">' + player.skillPoints + '</b>' : '');
    drawPortrait(el('hub-portrait'), heroData.classId, 2.3, 0);
}
function hubOpen(what) { // the screens remember they came from the hub (ui.js / skilltree.js) and come back here
    if (!hubReady) return;
    if (what === 'tree') openTree(); else if (what === 'inv') openInventory(); else if (what === 'smith') openSmith(); else if (what === 'apoth') openApothecary(); else openShop();
}
function hubReturn() { // a hub screen closed: save the hero, refresh the panel, the map animates again
    gameState = STATE.MENU;
    saveHero(heroSnapshot()); renderHub();
    requestAnimationFrame(menuFrame);
}
