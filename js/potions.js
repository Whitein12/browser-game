// ==========================================
// potions.js - The healing flask (F) and the elixir belt (1 / 2), CAMPAIGN.md step 4
// ==========================================
// The flask heals a share of Max HP over 1.5 s (so dodging still matters), refills every wave and can drop from kills.
// Elixirs are bought at the Apothecary (ui.js openApothecary), stacked up to 3 on a two-slot belt and used up; their timers
// live in `buffs` (elixirMight / elixirSwift / elixirIron): Might in combat.js powerParts, Swiftness in main.js (move) and
// skills.js attackSpeedBonus, Iron Skin in combat.js takeDamage. save.js keeps the flask's upgrades and the belt on the hero.

const FLASK_POTENCY = [0.40, 0.50, 0.60];   // share of Max HP per drink, by Stronger brew level
const FLASK_MAX = 5, FLASK_HEAL_T = 1.5, FLASK_LOCK = 0.5; // charges at most, heal time, lockout after the heal ends
const FLASK_CHARGE_COST = [150, 300];       // More charges: 3 -> 4, 4 -> 5
const FLASK_POTENCY_COST = [120, 240];      // Stronger brew: 40 -> 50 -> 60%
const ELIXIR_PRICE = 30, BELT_STACK = 3;
const ELIXIRS = {
    might: { name: 'Elixir of Might', buff: 'elixirMight', dur: 20, col: '#ef5350', desc: '+30 Power for 20 s' },
    swift: { name: 'Elixir of Swiftness', buff: 'elixirSwift', dur: 20, col: '#c6e04a', desc: '+25% move and attack speed for 20 s' },
    iron: { name: 'Iron Skin Draught', buff: 'elixirIron', dur: 12, col: '#b0bec5', desc: '-35% damage taken for 12 s' },
};
const ELIXIR_MIGHT = 0.30, ELIXIR_SWIFT = 0.25, ELIXIR_IRON = 0.35;

const newFlask = () => ({ charges: 3, max: 3, potency: 0, healLeft: 0, healT: 0, lockT: 0, rate: 0, swirlT: 0 });
const potions = { flask: newFlask(), belt: [null, null] };

function clearElixirs() { for (const id in ELIXIRS) buffs[ELIXIRS[id].buff] = 0; }
// main.js startGame, before applyHero: a new run starts from the defaults (a saved hero's upgrades and belt come back in applyPotions)
function resetPotions() { potions.flask = newFlask(); potions.belt = [null, null]; clearElixirs(); }
// save.js heroSnapshot / applyHero: the hero keeps the flask's upgrades and the belt, never the run's charges or timers
function potionsSnapshot() { return { flask: { max: potions.flask.max, potency: potions.flask.potency }, belt: JSON.parse(JSON.stringify(potions.belt)) }; }
function applyPotions(h) {
    resetPotions();
    const f = h.flask || {}, F = potions.flask;
    F.max = Math.max(3, Math.min(FLASK_MAX, f.max | 0 || 3)); F.potency = Math.max(0, Math.min(FLASK_POTENCY.length - 1, f.potency | 0)); F.charges = F.max;
    potions.belt = [0, 1].map(i => { const s = h.belt && h.belt[i]; return s && ELIXIRS[s.id] && s.n > 0 ? { id: s.id, n: Math.min(BELT_STACK, s.n | 0) } : null; });
}
function refillFlask() { const f = potions.flask; f.charges = f.max; } // main.js startNextWave

const potionReady = () => gameState === STATE.PLAYING && player.hp > 0 && !(stageEvent && stageEvent.blocking);
const potionCue = (text, color) => effects.push({ type: 'text', text, x: player.x, y: player.y - 40, color, life: 0.8, maxLife: 0.8 });

// ---------- the flask ----------
function drinkFlask() { // main.js keydown F
    const f = potions.flask;
    if (!potionReady() || f.healT > 0 || f.lockT > 0) return false;
    if (f.charges <= 0) { potionCue('No flask', '#9e9e9e'); return false; }
    if (player.hp >= player.maxHp) { potionCue('Full health', '#9e9e9e'); return false; } // no wasted charge
    f.charges--; f.healLeft = player.maxHp * FLASK_POTENCY[f.potency] * flaskBonus(); // sidequests.js: the Herb Pouch
    f.rate = f.healLeft / FLASK_HEAL_T; f.healT = FLASK_HEAL_T; f.swirlT = 0;
    potionCue('+HP', '#69f0ae');
    return true;
}
function pickUpFlask() { // a 'flask' drop (combat.js, main.js)
    const f = potions.flask;
    if (f.charges < f.max) { f.charges++; potionCue('+Flask', '#69f0ae'); } else potionCue('Flask full', '#9e9e9e');
}
function drawFlaskDrop(d) { // flat fills only: drops can pile up
    const x = d.x, y = d.y;
    ctx.fillStyle = 'rgba(105, 240, 174, 0.28)'; ctx.beginPath(); ctx.arc(x, y, d.radius + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#37474f'; ctx.fillRect(x - 2.5, y - 11, 5, 6); // neck
    ctx.fillStyle = '#8a6a35'; ctx.fillRect(x - 3.5, y - 12, 7, 2.5); // cork band
    ctx.fillStyle = '#1b5e20'; ctx.beginPath(); ctx.arc(x, y + 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#69f0ae'; ctx.beginPath(); ctx.arc(x, y + 2.5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.beginPath(); ctx.arc(x - 2.5, y - 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
}

// ---------- the belt ----------
function useElixir(slot) { // main.js keydown 1 / 2 (not in the Training Room: those keys place dummies)
    const s = potions.belt[slot];
    if (!s || !potionReady()) return false;
    const x = ELIXIRS[s.id];
    buffs[x.buff] = x.dur; // the same elixir again refreshes the timer, it never stacks
    if (--s.n <= 0) potions.belt[slot] = null;
    potionCue(x.name, x.col);
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2; spawnParticle({ kind: 'dot', color: x.col, x: player.x, y: player.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30, size: 3, life: 0.5, drag: 3, grow: 0, spin: 0, rot: 0 }); }
    return true;
}
function beltTarget(id) { // the slot a bought elixir goes into: the one already holding it (room left), else the first empty one; -1 = belt full
    const own = potions.belt.findIndex(s => s && s.id === id && s.n < BELT_STACK);
    return own >= 0 ? own : potions.belt.findIndex(s => !s);
}
function buyElixir(id) { // ui.js Apothecary
    const t = beltTarget(id);
    if (t < 0 || player.gold < elixirPrice()) return false;
    player.gold -= elixirPrice(); // sidequests.js: the apothecary's favour
    if (potions.belt[t]) potions.belt[t].n++; else potions.belt[t] = { id, n: 1 };
    return true;
}
function upgradeFlask(what) { // ui.js Apothecary: 'chg' (More charges) / 'pot' (Stronger brew)
    const f = potions.flask, cost = what === 'chg' ? FLASK_CHARGE_COST[f.max - 3] : FLASK_POTENCY_COST[f.potency];
    if (cost === undefined || player.gold < cost) return false;
    player.gold -= cost;
    if (what === 'chg') { f.max++; f.charges++; } else f.potency++;
    return true;
}

// ---------- per frame (main.js update; stage events skip it, so timers pause with the scene) ----------
function updatePotions(dt) {
    const f = potions.flask;
    if (isTraining() && f.healT <= 0 && f.charges < f.max) f.charges = f.max; // the Training Room: free refills
    for (const id in ELIXIRS) { const b = ELIXIRS[id].buff; if (buffs[b] > 0) buffs[b] = Math.max(0, buffs[b] - dt); }
    if (player.hp <= 0) { f.healT = f.healLeft = f.lockT = 0; return; }
    if (f.healT > 0) {
        const step = Math.min(f.healLeft, f.rate * dt);
        player.hp = Math.min(player.maxHp, player.hp + step); f.healLeft -= step;
        if ((f.healT -= dt) <= 0) { f.healT = f.healLeft = 0; f.lockT = FLASK_LOCK; }
        if ((f.swirlT -= dt) <= 0) { // a green swirl round the hero
            f.swirlT = 0.03; const a = (FLASK_HEAL_T - f.healT) * 9;
            for (let k = 0; k < 2; k++) {
                const aa = a + k * Math.PI, r = player.radius + 10;
                spawnParticle({ kind: 'dot', color: k ? '#b9f6ca' : '#69f0ae', x: player.x + Math.cos(aa) * r, y: player.y + Math.sin(aa) * r * 0.8, vx: 0, vy: -45, size: 3, life: 0.5, drag: 1, grow: 0, spin: 0, rot: 0 });
            }
        }
    } else if (f.lockT > 0) f.lockT -= dt;
}

// ---------- HUD: next to the health orb (hud.js updateHUD calls updatePotionHud) ----------
const vialSvg = (col, w = 26) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}"><path d="M9 2h6v2h-1v4l5 9a3 3 0 0 1-2.6 4.5H7.6A3 3 0 0 1 5 17l5-9V4H9z" fill="rgba(20,16,12,0.85)" stroke="#8a6a35" stroke-width="1.2"/><path d="M7 15h10l2 3a2 2 0 0 1-1.7 3H6.7A2 2 0 0 1 5 18z" fill="${col}"/></svg>`;
const pth = { built: false, sig: ['', '', ''], cells: [] };
function updatePotionHud() {
    if (!pth.built) {
        const bar = el('potion-bar'); if (!bar) return;
        bar.innerHTML = ['F', '1', '2'].map((k, i) => `<div class="pt-slot${i ? '' : ' pt-flask'}"><div class="pt-fill"></div><div class="pt-ico"></div><div class="pt-key">${k}</div><div class="pt-n"></div></div>`).join('');
        pth.cells = [...bar.children].map(c => ({ box: c, fill: c.querySelector('.pt-fill'), ico: c.querySelector('.pt-ico'), n: c.querySelector('.pt-n') }));
        pth.cells[0].ico.innerHTML = vialSvg('#69f0ae'); pth.built = true;
    }
    const f = potions.flask, c = pth.cells, tr = isTraining();
    const fs = `${f.charges}|${f.max}|${f.healT > 0 ? Math.round((1 - f.healT / FLASK_HEAL_T) * 20) : f.lockT > 0 ? 'l' : 0}`;
    if (fs !== pth.sig[0]) {
        pth.sig[0] = fs; c[0].n.textContent = `${f.charges}/${f.max}`;
        c[0].fill.style.height = f.healT > 0 ? Math.round(f.healT / FLASK_HEAL_T * 100) + '%' : '0'; // the brew drains as it heals
        c[0].box.classList.toggle('empty', f.charges <= 0); c[0].box.classList.toggle('healing', f.healT > 0);
    }
    for (let i = 0; i < 2; i++) {
        const s = potions.belt[i], g = tr ? 'x' : s ? s.id + s.n : '-';
        if (g === pth.sig[i + 1]) continue;
        pth.sig[i + 1] = g; const cell = c[i + 1];
        cell.box.style.display = tr ? 'none' : ''; // the Training Room's 1 / 2 place dummies
        cell.box.classList.toggle('empty', !s); cell.ico.innerHTML = s ? vialSvg(ELIXIRS[s.id].col) : ''; cell.n.textContent = s ? 'x' + s.n : '';
        cell.box.title = s ? `${ELIXIRS[s.id].name}: ${ELIXIRS[s.id].desc}` : 'Empty belt slot';
    }
}

// ---------- the Apothecary screen (ui.js openApothecary / closeApothecary) ----------
function renderApothecary() {
    const f = potions.flask, gold = player.gold;
    el('apo-gold-display').textContent = gold;
    const pot = FLASK_POTENCY, chgCost = FLASK_CHARGE_COST[f.max - 3], potCost = FLASK_POTENCY_COST[f.potency];
    const btn = (id, label, cost) => cost === undefined ? `<button class="btn" disabled>${label} (maxed)</button>` : `<button class="btn btn-gold" id="${id}"${gold < cost ? ' disabled' : ''}>${label} &middot; ${cost} gold</button>`;
    const pct = v => Math.round(v * 100) + '%';
    const beltCells = potions.belt.map((s, i) => `<div class="apo-slot${s ? '' : ' empty'}" data-slot="${i}" title="${s ? 'Click to empty this slot (no refund)' : 'Empty'}"><div class="apo-key">${i + 1}</div>${s ? vialSvg(ELIXIRS[s.id].col, 34) + `<b>x${s.n}</b><span>${ELIXIRS[s.id].name}</span>` : '<span>Empty</span>'}</div>`).join('');
    const rows = Object.keys(ELIXIRS).map(id => {
        const x = ELIXIRS[id], full = beltTarget(id) < 0, poor = gold < elixirPrice();
        return `<div class="apo-row"><div class="apo-vial">${vialSvg(x.col, 32)}</div><div class="apo-txt"><b style="color:${x.col}">${x.name}</b><span>${x.desc}</span></div>`
            + `<button class="btn btn-gold apo-buy" data-id="${id}"${full || poor ? ' disabled' : ''}>${full ? 'Belt full' : `Buy &middot; ${elixirPrice()}`}</button></div>`;
    }).join('');
    el('apo-body').innerHTML = `<div class="apo-card"><div class="tt-name">The Healing Flask <kbd>F</kbd></div>
        <div class="sm-stat">Charges <b>${f.max}</b>${f.max < FLASK_MAX ? ` <span class="sm-arrow">&rarr;</span> <b>${f.max + 1}</b>` : ''}</div>
        <div class="sm-stat">Heals <b>${pct(pot[f.potency])}</b> of Max HP${f.potency < pot.length - 1 ? ` <span class="sm-arrow">&rarr;</span> <b>${pct(pot[f.potency + 1])}</b>` : ''} over ${FLASK_HEAL_T} s</div>
        ${btn('apo-up-chg', 'More charges', chgCost)}${btn('apo-up-pot', 'Stronger brew', potCost)}
        <div class="ui-hint" style="text-align:left">Refills at the start of every wave. Kills sometimes drop a charge.</div></div>
        <div class="apo-card"><div class="tt-name">Elixirs</div>${rows}
        <div class="backpack-head" style="margin-top:6px"><span class="ui-label">Belt</span><span class="ui-hint" style="margin:0">Keys 1 and 2 &middot; stacks of ${BELT_STACK}</span></div>
        <div class="apo-belt">${beltCells}</div></div>`;
    const redo = () => { renderApothecary(); updateHUD(); };
    const up = (id, what) => { const b = el(id); if (b) b.onclick = () => { if (upgradeFlask(what)) redo(); }; };
    up('apo-up-chg', 'chg'); up('apo-up-pot', 'pot');
    el('apo-body').querySelectorAll('.apo-buy').forEach(b => { b.onclick = () => { if (buyElixir(b.dataset.id)) redo(); }; });
    el('apo-body').querySelectorAll('.apo-slot').forEach(c => { c.onclick = () => { potions.belt[+c.dataset.slot] = null; redo(); }; });
}
