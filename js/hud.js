// ==========================================
// hud.js - In-run HUD: health orb, class gauge orb, skill bar, XP bar, buff chips, wave plaque, boss bar, wave banner, Tab sheet
// ==========================================
// updateHUD() refreshes numbers and the skill bar (cheap, called often); drawHudOrbs() repaints the orbs and checks
// which HUD pieces have something behind them, once per frame from draw().

const BOSS_NAMES = {
    boss_slime: 'The Slime King', boss_amalgam: 'The Amalgam', boss_slime_queen: 'The Hive Queen',
    boss_warlord: 'The Bandit Warchief', boss_beastmaster: 'The Beastmaster', boss_valerius: 'Valerius the Vanguard',
};
const SLOT_KEYS = { 1: 'Q', 2: 'E', 3: 'SPC', 4: 'R', rmb: 'RMB' };
const hud = { sig: null, slots: {}, chipSig: '', hpGhost: 1, lastFx: 0, lastGold: 0, gaugeF: 0, gaugeSig: '', tab: false, tabAt: 0, rects: null, rectsAt: 0 };

const hasRmbSkill = () => equipment.weapon && equipment.weapon.rarity === 'rare' && activeClass.rareWeapon.rmbSkill && activeClass.rareWeapon.rmbSkill !== 'None';

// (Re)build the skill bar when the class or the rare-weapon slot changes
function buildSkillBar() {
    const cid = activeClassId(), bar = el('skill-bar'), rmb = hasRmbSkill();
    hud.sig = cid + (rmb ? ':rmb' : '') + spellKey(); hud.slots = {}; bar.innerHTML = '';
    const make = (slot) => {
        const w = document.createElement('div'); w.className = 'slot-wrap';
        w.innerHTML = `<div class="slot${slot === 'rmb' ? ' slot-rmb' : ''}"><img src="${skillIcon(cid, slot)}"><div class="cd"></div><div class="cd-num"></div><div class="key">${SLOT_KEYS[slot]}</div></div>`
            + `<div class="pips">${slot === 'rmb' ? '' : '<i></i><i></i><i></i><i></i>'}</div>`; // rank pips under the slot
        bar.appendChild(w);
        const d = w.querySelector('.slot');
        hud.slots[slot] = { el: d, cd: d.querySelector('.cd'), num: d.querySelector('.cd-num'), pips: [...w.querySelectorAll('.pips i')], state: '' };
    };
    [1, 2, 3, 4].forEach(make);
    if (rmb) { const sep = document.createElement('div'); sep.className = 'slot-sep'; bar.appendChild(sep); make('rmb'); }
}
function setSlot(s, cd, maxCd, locked, level) {
    const ready = !locked && cd <= 0, state = locked ? 'locked' : ready ? 'ready' : 'cooling';
    if (state !== s.state) {
        if (state === 'ready' && s.state === 'cooling') { s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash'); } // pulse when a skill comes back
        s.el.classList.toggle('locked', locked); s.el.classList.toggle('ready', ready); s.el.classList.toggle('cooling', state === 'cooling');
        s.state = state;
    }
    const frac = state === 'cooling' ? Math.min(1, cd / maxCd) : 0;
    s.cd.style.background = frac > 0 ? `conic-gradient(transparent ${(1 - frac) * 360}deg, rgba(0, 0, 0, 0.72) 0)` : 'none';
    s.num.textContent = state === 'cooling' ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) : '';
    s.pips.forEach((p, k) => p.classList.toggle('on', k < level));
}

function hudChips() {
    const c = [], n = activeClass.name;
    // Class stacks (Frenzy, Momentum, Flow...) live in the gauge orb; chips are for extra buffs and dangers
    if (player.orbDmg > 0) c.push(['#ffb74d', 'Power orbs', `+${Math.round(player.orbDmg * 100)} Power${player.orbDmg >= ORB_DMG_CAP ? ' (max)' : ''}`]);
    if (n === 'Paladin' && player.hammer) {
        const st = player.hammer.state;
        if (st !== 'equipped') c.push(['#b0bec5', 'Light Shield', '+15% Armor']); // paladin.js paladinArmorMult: on while the hammer is anywhere but in hand
        if (player.tether) c.push(['#ffd54f', player.tether.mode === 'hammer' ? 'Tether' : 'Shackled', `${player.tether.life.toFixed(1)}s`]); // paladin.js Divine Tether
        if (gildedPlateReduction() > 0) c.push(['#ffd54f', 'Bastion DR', `${Math.round(gildedPlateReduction() * 100)}%`]);
    }
    if (buffs.dragonfire > 0) c.push(['#ff7043', 'Dragonfire Blade', `+${Math.round(dragonfireBonus() * 100)}% basics · ${Math.ceil(buffs.dragonfire)}s`]); // skills.js
    if (n === 'Machinist' && activeClass.skills[1].level > 0) c.push(['#ffb74d', 'Turrets', `${projectiles.filter(p => p.type === 'turret').length} / ${turretCap()}`]); // skills.js
    if (n === 'Machinist' && buffs.overclockTimer > 0) c.push(['#ffb74d', 'Overclock', `${buffs.overclockTimer.toFixed(1)}s`]); // the gauge orb shows Scrap now
    if (n === 'Ranger' && buffs.windwalk > 0) c.push(['#e0f7fa', 'Windwalk', `${buffs.windwalk.toFixed(1)}s`]); // skills.js evolutions
    if (n === 'Ranger' && buffs.focus > 0) c.push(['#b2ff59', 'Hunter\'s Focus', `${buffs.focus.toFixed(1)}s`]);
    if (n === 'Ranger' && activeClass.skills[3].selectedUpg === 'B') c.push(['#a5d6a7', 'Vault', `${player.vaultCharges === undefined ? vaultMax() : player.vaultCharges} / ${vaultMax()}`]);
    if (n === 'Ranger' && preyTarget()) c.push(['#b2ff59', 'Prey', `${(player.prey.huntMarkUntil - fxTime).toFixed(1)}s`]);
    if (n === 'Druid' && buffs.feralSurge > 0) c.push(['#b2ff59', 'Feral Surge', `${buffs.feralSurge.toFixed(1)}s`]);
    if (n === 'Druid' && buffs.direWolf > 0) c.push(['#ffab40', companion().big, `${buffs.direWolf.toFixed(1)}s`]);
    if (n === 'Druid' && player.wolves && player.wolves.length > 1) c.push(['#76ff03', companion().spirits, `${player.wolves.length - 1} · ${Math.max(...player.wolves.slice(1).map(w => w.life)).toFixed(1)}s`]); // druid.js; the gauge orb shows Bond
    let html = c.map(([col, label, val]) => `<span class="chip" style="--cc:${col}">${label} <b>${val}</b></span>`).join('');
    if (buffs.weakened > 0) html += '<span class="chip warn">Weakened</span>';
    if (player.wading) html += '<span class="chip" style="--cc:#69f0ae">Wading <b>Slowed · Poisoned</b></span>'; // map_cavern.js
    return html;
}

function updateHUD() {
    if (!activeClass) return;
    if (hud.sig !== activeClassId() + (hasRmbSkill() ? ':rmb' : '') + spellKey()) buildSkillBar(); // spellweaver.js: a new loadout

    el('hp-text').textContent = `${Math.ceil(player.hp)} / ${Math.round(player.maxHp)}`;
    el('shield-text').textContent = player.shield > 0 ? `+${Math.ceil(player.shield)} shield` : '';
    el('xp-level').textContent = player.level;
    el('xp-text').textContent = `${Math.floor(player.xp)} / ${player.maxXp}`;
    el('xp-fill').style.width = Math.max(0, Math.min(100, player.xp / player.maxXp * 100)) + '%';
    const pts = el('xp-points'), unspent = player.skillPoints > 0 && !isTraining(); // skilltree.js: points waiting for K
    pts.classList.toggle('hidden', !unspent); if (unspent) pts.textContent = `+${player.skillPoints}`;

    // Class gauge captions (the orb itself is painted in drawHudOrbs)
    const g = classGauge(), sig = `${g.name}|${g.big}|${g.small}|${g.warn}`;
    if (sig !== hud.gaugeSig) {
        hud.gaugeSig = sig;
        const big = el('gauge-big'); big.textContent = g.big; big.classList.toggle('word', String(g.big).length > 3);
        el('gauge-small').textContent = g.small; el('gauge-small').classList.toggle('warn', !!g.warn);
        el('gauge-name').textContent = g.name;
    }
    if (hud.tab && performance.now() - hud.tabAt > 200) renderTabSheet();

    for (let i = 1; i <= 4; i++) {
        const sk = activeClass.skills[i], cd = Math.max(0, cooldowns[`s${i}`] || 0);
        setSlot(hud.slots[i], cd, cooldownMax[`s${i}`] || sk.maxCd || 1, sk.level === 0, sk.level);
    }
    if (hud.slots.rmb) setSlot(hud.slots.rmb, Math.max(0, cooldowns.rmb || 0), 4.0 * getCDR(), false, 0);

    const chips = hudChips();
    if (chips !== hud.chipSig) { el('hud-chips').innerHTML = chips; hud.chipSig = chips; }

    // Wave plaque: progress against the most enemies this wave has had left at once
    const left = enemiesToSpawn + activeEnemies;
    waveStats.peak = Math.max(waveStats.peak || 0, left);
    el('wave-display').textContent = isTraining() ? 'Training' : wave > 0 ? `Wave ${wave}` : 'Prepare';
    el('wave-subtext').textContent = isTraining() ? `${enemies.filter(e => e.dummy && !e.dead).length} dummies · T: panel` : wave === 0 ? 'Choose your first skill' : waveBreak > 0 ? `Next wave in ${Math.ceil(waveBreak)}` : currentMap.caveOpen ? (currentMap.type === 'hive' || currentMap.type === 'castle' ? 'Claim the crown' : 'The way is open') : left === 1 ? '1 enemy left' : `${left} enemies left`;
    el('wave-prog').style.width = (waveBreak > 0 ? 100 : waveStats.peak ? (1 - left / waveStats.peak) * 100 : 0) + '%';
    if (player.gold !== hud.lastGold) {
        el('gold-display').textContent = player.gold;
        if (player.gold > hud.lastGold) { const g = el('gold-display'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
        hud.lastGold = player.gold;
    }

    const boss = enemies.find(e => !e.dead && e.type.startsWith('boss') && !e.champion);
    const guard = boss ? [] : enemies.filter(e => e.champion && !e.dead); // map_castle.js: the Royal Guard share one bar
    const showBoss = (boss && boss.state !== 'death_throes') || guard.length > 0;
    el('boss-bar').style.display = showBoss ? 'block' : 'none';
    if (showBoss) {
        const hp = boss ? boss.hp : guard.reduce((s, e) => s + Math.max(0, e.hp), 0), max = boss ? boss.maxHp : cst.guardMax || 1;
        const pct = Math.max(0, hp / max * 100) + '%';
        el('boss-name').textContent = boss ? (boss.king ? 'Valerius, King of Thieves' : BOSS_NAMES[boss.type] || `Wave ${wave} Boss`) : 'The Royal Guard';
        el('boss-fill').style.width = pct; el('boss-ghost').style.width = pct;
    }
}

// ---------- class gauge (right orb): each class's own resource or signature mechanic ----------
// Each entry returns { name, f (0..1 fill), big, small, light, dark, glow?, warn? }
const GAUGES = {
    Kensei: () => ({ name: 'Flow', f: player.flow / player.maxFlow, big: Math.floor(player.flow), small: player.stance === 'airborne' ? 'Airborne' : 'Handheld', light: '#4dd0e1', dark: '#003640' }),
    Cleric: () => { // the small line is what the next Divine Ray would hit for (skills.js RAY_ZEAL_MULT)
        const z = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : (player.zeal || 0);
        let tier = z >= 100 ? 3 : z >= 50 ? 2 : z >= 10 ? 1 : 0, blood = false;
        if (!tier && activeClass.skills[1].selectedUpg === 'B') { tier = buffs.aspectOfReaper > 0 ? 2 : 3; blood = true; } // Void Spike: a blood ray
        if (!tier && buffs.aspectOfReaper > 0) tier = 1;
        return { name: 'Zeal', f: z / (player.maxZeal || 100), big: Math.floor(z), small: tier ? `${blood ? 'blood ' : ''}ray x${RAY_ZEAL_MULT[tier]}` : 'empty: half power', warn: !tier, glow: tier === 3, light: '#ffd54f', dark: '#4d3200' };
    },
    Dragonknight: () => { const s = player.frenzyStacks || 0, max = frenzyMax(); return { name: 'Frenzy', f: s / max, big: s, small: `+${s * 2} Power/+${s * 2}% spd`, light: '#ffa040', dark: '#5a1e00', glow: s >= max }; },
    Spellweaver: () => { const r = player.arcaneResonance || 0; return { name: 'Resonance', f: r / resonanceMax(), big: r, small: r ? `next bolt x${RESONANCE_MULT}` : 'cast a spell', light: '#64b5f6', dark: '#0b2350', glow: r >= resonanceMax() }; },
    Ranger: () => ({ name: 'Momentum', f: (player.momentum || 0) / 0.2, big: `+${Math.round((player.momentum || 0) * 100)}%`, small: 'dmg & speed', light: '#aed581', dark: '#1e3a0b', glow: player.momentum >= 0.2 }),
    Nightblade: () => { const m = enemies.filter(e => !e.dead && e.markAngle !== undefined).length; return { name: 'Expose', f: 1 - Math.max(0, player.markTimer || 0) / 3, big: m, small: m === 1 ? 'enemy marked' : 'enemies marked', light: '#ce93d8', dark: '#2b0a3a', glow: m > 0 }; },
    Machinist: () => { // Scrap: holding Q spends 5 for a Heavy Turret, 10 for a Siege Turret (skills.js TURRET_TIERS)
        const sc = player.scrap || 0, next = TURRET_TIERS.find(t => sc >= t.cost);
        return { name: 'Scrap', f: sc / SCRAP_MAX, big: sc, small: next ? `hold Q: ${next.name.toLowerCase()}` : `${5 - sc} to heavy turret`, light: '#ffb74d', dark: '#4a1f00', glow: sc >= 10 };
    },
    Druid: () => { // Bond (druid.js): the wolf's bites on prey you've hit fill it; when full, its next bite is a Maul
        const b = player.bond || 0, full = b >= BOND_MAX;
        return full ? { name: 'Bond', f: 1, big: 'Maul', small: 'next bite', light: '#ffab40', dark: '#4a1f00', glow: true }
            : { name: 'Bond', f: b / BOND_MAX, big: Math.floor(b), small: 'hit its prey', light: '#9ccc65', dark: '#1a3a0a' };
    },
    Paladin: () => { // follows the hammer's trip (paladin.js): the fill tracks the flight, the pulse, or the way home
        const h = player.hammer, st = h ? h.state : 'equipped', g = { name: 'Hammer', light: '#ffe082', dark: '#4a3a00' };
        if (st === 'equipped') return { ...g, f: 1, big: 'In Hand', small: 'Q: throw' };
        if (st === 'outbound') {
            const total = Math.hypot(h.tx - h.startX, h.ty - h.startY) || 1;
            return { ...g, f: Math.hypot(h.x - h.startX, h.y - h.startY) / total, big: 'Flying', small: 'Q: recall' };
        }
        if (st === 'deployed') return { ...g, f: 1 - Math.max(0, h.pulseTimer), big: 'Planted', small: 'Q: recall', glow: h.pulseTimer < 0.15 };
        if (h.returnMode === 'chase') return { ...g, f: 0.15, big: 'Missed', small: 'no Q reset', warn: true };
        const near = 1 - Math.min(1, Math.hypot(player.x - h.x, player.y - h.y) / HAMMER_THROW_RANGE);
        return h.returnMode === 'straight' ? { ...g, f: near, big: 'Catch!', small: 'stay on its line', glow: true }
            : { ...g, f: near, big: 'Returning', small: 'catch it!' };
    },
};
const classGauge = () => (GAUGES[activeClass.name] || (() => ({ name: activeClass.name, f: 0, big: '', small: '', light: '#999', dark: '#222' })))();

// ---------- orbs ----------

function drawOrb(cv, frac, ghost, light, dark, t, opts = {}) {
    const dpr = window.devicePixelRatio || 1, S = 150;
    if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
    const cx = 75, cy = 72, R = 54;

    if (opts.danger) { const p = 0.5 + 0.5 * Math.sin(t * 7); ptGlow(c, cx, cy, R + 22, '#ff1744', 0.25 + 0.35 * p); }
    else if (opts.glow) { const p = 0.5 + 0.5 * Math.sin(t * 4); ptGlow(c, cx, cy, R + 22, opts.glow, 0.2 + 0.25 * p); } // a gauge at its peak
    const sock = c.createRadialGradient(cx, cy + 4, R, cx, cy + 4, R + 16); sock.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); sock.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = sock; c.beginPath(); c.arc(cx, cy + 4, R + 16, 0, Math.PI * 2); c.fill();

    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#070505'; c.fillRect(0, 0, S, S);
    const level = f => cy + R - 2 * R * Math.max(0, Math.min(1, f));
    const surface = (y0, amp, phase) => {
        c.beginPath(); c.moveTo(cx - R, S);
        for (let x = cx - R; x <= cx + R; x += 3) c.lineTo(x, y0 + Math.sin(x * 0.09 + t * 2.2 + phase) * amp + Math.sin(x * 0.15 - t * 1.4 + phase) * amp * 0.5);
        c.lineTo(cx + R, S); c.closePath();
    };
    if (ghost > frac + 0.002) { surface(level(ghost), 1.5, 1); c.fillStyle = 'rgba(255, 236, 200, 0.45)'; c.fill(); } // recent loss, draining away
    if (frac > 0) {
        const y0 = level(frac), g = c.createLinearGradient(0, y0 - 4, 0, cy + R);
        g.addColorStop(0, light); g.addColorStop(1, dark);
        surface(y0 + 2, 2.2, 2.4); c.fillStyle = dark; c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1; // back wave
        surface(y0, 2.2, 0); c.fillStyle = g; c.fill();
        for (let i = 0; i < 6; i++) { // bubbles drifting up through the liquid
            const k = (t * (0.18 + ptRand(i) * 0.2) + ptRand(i + 9)) % 1, by = cy + R - k * (cy + R - y0), bx = cx + (ptRand(i + 4) - 0.5) * R * 1.4 + Math.sin(t * 2 + i) * 3;
            if (by > y0 + 4) { c.fillStyle = 'rgba(255, 255, 255, 0.22)'; c.beginPath(); c.arc(bx, by, 1.2 + ptRand(i + 2) * 2, 0, Math.PI * 2); c.fill(); }
        }
    }
    const shade = c.createRadialGradient(cx - 10, cy - 14, R * 0.2, cx, cy, R); // spherical shading
    shade.addColorStop(0, 'rgba(255, 255, 255, 0.06)'); shade.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)'); shade.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    c.fillStyle = shade; c.fillRect(0, 0, S, S);
    const hl = c.createLinearGradient(cx - R, cy - R, cx, cy); hl.addColorStop(0, 'rgba(255, 255, 255, 0.32)'); hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = hl; c.beginPath(); c.ellipse(cx - 16, cy - 24, 26, 16, -0.6, 0, Math.PI * 2); c.fill();
    c.restore();

    // Gold frame
    const fg = c.createLinearGradient(0, cy - R, 0, cy + R); fg.addColorStop(0, '#f1d48a'); fg.addColorStop(0.5, '#8a6a35'); fg.addColorStop(1, '#c9a86a');
    c.strokeStyle = '#000'; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, R + 3, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = fg; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R + 3, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(0, 0, 0, 0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R + 1, 0, Math.PI * 2); c.stroke();
    for (const a of [-Math.PI / 2, Math.PI * 0.15, Math.PI * 0.85]) { // studs
        const x = cx + Math.cos(a) * (R + 3), y = cy + Math.sin(a) * (R + 3);
        c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#000'; c.fillRect(-5, -5, 10, 10); c.fillStyle = '#f1d48a'; c.fillRect(-3.5, -3.5, 7, 7); c.restore();
    }
    if (opts.shield > 0) { // shield wraps the orb as a silver arc
        const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * Math.min(1, opts.shield);
        c.save(); c.shadowBlur = 10; c.shadowColor = '#b3e5fc';
        c.strokeStyle = '#000'; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, R + 10, a0, a1); c.stroke();
        c.strokeStyle = '#cfe8f5'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, R + 10, a0, a1); c.stroke(); c.restore();
    }
}

// Called once per frame from draw()
function drawHudOrbs() {
    if (!activeClass || el('hud').classList.contains('hidden')) return;
    const now = performance.now();
    if (now - (hud.orbAt || 0) < 33) return; // 30 repaints a second is plenty for slow liquid
    hud.orbAt = now;
    const dt = Math.max(0, fxTime - hud.lastFx); hud.lastFx = fxTime;
    const hpF = Math.max(0, player.hp / player.maxHp);
    hud.hpGhost = hud.hpGhost < hpF ? hpF : Math.max(hpF, hud.hpGhost - dt * 0.35);
    drawOrb(el('orb-hp'), hpF, hud.hpGhost, '#ff5a4f', '#5e0909', fxTime, { shield: player.shield / player.maxHp, danger: hpF < 0.3 && player.hp > 0 });
    const g = classGauge(), gf = Math.max(0, Math.min(1, g.f || 0));
    hud.gaugeF += (gf - hud.gaugeF) * Math.min(1, dt * 10); // the liquid sloshes up and down instead of snapping
    drawOrb(el('orb-gauge'), hud.gaugeF, 0, g.light, g.dark, fxTime + 3, { glow: g.glow ? g.light : null });
    updateHudCover();
}

// Fade any HUD piece that has the hero or an enemy behind it
function updateHudCover() {
    const now = performance.now();
    if (!hud.rects || now - hud.rectsAt > 500) {
        hud.rectsAt = now;
        hud.rects = ['hp-wrap', 'hud-center', 'gauge-wrap', 'wave-plaque', 'boss-bar', 'gold-plaque'].map(id => { const e = el(id), r = e.getBoundingClientRect(); return { e, r, on: r.width > 0 && r.height > 0, cov: e.classList.contains('hud-covered') }; });
    }
    const pts = [[player.x, player.y, 30]];
    for (const e of enemies) if (!e.dead && !e.pod) pts.push([e.x, e.y, e.size * 0.7]); // pods line the walls; they'd keep the HUD faded
    for (const h of hud.rects) {
        let cov = false;
        if (h.on) for (const [x, y, r] of pts) { const sx = (x - camera.x) * camZoom(), sy = (y - camera.y) * camZoom(); if (sx + r > h.r.left && sx - r < h.r.right && sy + r > h.r.top && sy - r < h.r.bottom) { cov = true; break; } }
        if (cov !== h.cov) { h.cov = cov; h.e.classList.toggle('hud-covered', cov); }
    }
}

// ---------- wave announcement ----------

function showWaveBanner() {
    const b = el('wave-banner'), s = siteById(activeDungeonId);
    b.classList.toggle('boss', isBossWave);
    b.querySelector('.wb-kicker').textContent = isEndlessMode ? 'Limitless' : (s ? s.name : '');
    b.querySelector('.wb-title').textContent = `Wave ${wave}`;
    b.querySelector('.wb-sub').textContent = isBossWave ? 'A powerful foe approaches' : wave === 1 ? 'Survive' : 'They keep coming';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- character sheet (hold Tab) ----------

window.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault(); // Tab would otherwise move focus around the page
    if (activeClass && (gameState === STATE.PLAYING || gameState === STATE.PAUSED) && !hud.tab) { hud.tab = true; renderTabSheet(); el('tab-sheet').classList.remove('hidden'); }
});
window.addEventListener('keyup', e => { if (e.key === 'Tab') closeTabSheet(); });
window.addEventListener('blur', () => closeTabSheet());
function closeTabSheet() { hud.tab = false; el('tab-sheet').classList.add('hidden'); }

function renderTabSheet() {
    hud.tabAt = performance.now();
    const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`, n = activeClass.name, W = equipment.weapon;
    const row = (k, v, cls = '') => `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;
    let h = `<div class="ts-head"><b>${n}</b><span>Level ${player.level} &middot; ${Math.floor(player.xp)} / ${player.maxXp} XP</span></div>`;

    // Offense: Power and every part of it (combat.js powerParts), so it always says where it comes from
    h += `<h4>Offense</h4>` + row('Power', playerPower()) + `<div class="note">every hit deals its base &times; Power / 100</div>`;
    for (const [k, v, temp] of powerParts()) h += row(k, k === 'Class base' ? Math.round(v * 100) : `+${Math.round(v * 100)}`, temp ? 'sub temp' : 'sub');
    if (buffs.weakened > 0) h += row('Weakened', '-30% damage', 'sub bad');
    const glove = equipment.gloves ? equipment.gloves.val : 0;
    const stance = n === 'Kensei' && player.stance === 'airborne' ? (player.flow / player.maxFlow) * 0.5 : 0;
    const frenzy = n === 'Dragonknight' ? player.frenzyStacks * 0.02 : 0;
    const interval = 0.15 + activeClass.basicAttackCD / (1 + attackSpeedBonus()); // skills.js
    h += row('Basic attack', `${Math.round(hitDmg(activeClass.basicDmg))} dmg &middot; ${(1 / interval).toFixed(1)}/s`);
    if (glove) h += row(equipment.gloves.name, `${pct(glove)} speed`, 'sub');
    if (stance) h += row('Airborne stance', `${pct(stance)} speed`, 'sub temp');
    if (frenzy) h += row(`Frenzy &times;${player.frenzyStacks}`, `${pct(frenzy)} speed`, 'sub temp');
    h += row('Cooldown reduction', `${Math.round((1 - getCDR()) * 100)}%`);
    if (equipment.amulet) h += row(equipment.amulet.name, pct(equipment.amulet.val), 'sub');
    if (player.treeCdr) h += row('Talents', pct(player.treeCdr), 'sub'); // skilltree.js: Focus

    // Defense
    const gearHp = equipment.armor ? equipment.armor.val : 0;
    h += `<h4>Defense</h4>` + row('Max health', Math.round(player.maxHp));
    h += row('Class base', activeClass.baseMaxHp, 'sub');
    if (gearHp) h += row(equipment.armor.name, `+${Math.round(gearHp)}`, 'sub');
    if (player.treeHp) h += row('Talents', `+${player.treeHp}`, 'sub'); // skilltree.js: Vitality
    const armorNow = player.armor * (typeof paladinArmorMult === 'function' && n === 'Paladin' ? paladinArmorMult() : 1);
    h += row('Armor', Math.round(armorNow * 10) / 10) + `<div class="note">blocks ${Math.round(armorReduction(armorNow) * 100)}% of every hit</div>`;
    if (player.shield > 0) h += row('Shield', Math.ceil(player.shield), 'sub temp');
    h += row('Move speed', Math.round(player.speed));
    if (equipment.boots) h += row(equipment.boots.name, `+${Math.round(equipment.boots.val)}`, 'sub');
    if (player.treeSpeed) h += row('Talents', `+${player.treeSpeed}`, 'sub'); // skilltree.js: Fleetness
    if (n === 'Ranger' && player.momentum > 0) h += row('Momentum', `${pct(player.momentum)} speed`, 'sub temp');

    // Skills: rank, evolution and what they do now
    h += `<h4>Skills</h4>`;
    const cid = activeClassId();
    for (let i = 1; i <= 4; i++) {
        const sk = activeClass.skills[i], talents = treeNodes().filter(n => n.slot === i && n.name && hasTalent(n.id)).length, evo = [sk.selectedUpg ? sk['upg' + sk.selectedUpg].name : null, talents ? `${talents} talent${talents > 1 ? 's' : ''}` : null].filter(Boolean).join(' &middot; '); // skilltree.js
        const v = sk.level ? [sk.baseDmg > 0 ? `${Math.round(hitDmg(sk.baseDmg, sk.level))} dmg` : '', sk.maxCd ? `${(skillBaseCd(i, sk.level) * getCDR()).toFixed(1)}s cd` : ''].filter(Boolean).join('<br>') : 'locked';
        h += `<div class="sk"><img class="${sk.level ? '' : 'off'}" src="${skillIcon(cid, i)}"><div class="n">${SLOT_KEYS[i]} &middot; ${sk.name}<i>${sk.level ? `Rank ${sk.level}` : 'Not learned'}${evo ? ` &middot; ${evo}` : ''}</i></div><div class="v">${v}</div></div>`;
    }
    h += `<h4>Passive</h4><div class="passive">${activeClass.passive || ''}</div>`;
    el('tab-sheet').innerHTML = h;
}

// Fresh HUD for a new run
function resetHUD() {
    hud.sig = null; hud.chipSig = ''; hud.hpGhost = 1; hud.lastFx = fxTime; hud.lastGold = -1; hud.gaugeF = 0; hud.gaugeSig = ''; hud.rects = null;
    const s = siteById(activeDungeonId);
    el('wave-dungeon').textContent = s ? s.name : '';
}
