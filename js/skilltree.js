// ==========================================
// skilltree.js - The skill web: a constellation per class, the hero in the middle and a branch per skill (K)
// ==========================================
// Every class's web has the same shape (WEB), filled with its own content (talents.js TALENT_WEBS): each skill grows
// out of the hero as Learn → Empower → Empower (ranks 1-3), with two twigs and two passives off the trunk, then the
// evolution fork (A or B: rank 4), and under each evolution three nodes and a capstone. Between neighbouring branches a
// bridge (a shared passive) joins the passives of both, so the web closes into a ring.
// A node can be taken when it touches one you have (the Learns touch the hero) and its own needs are met: a twig needs
// its skill's first Empower, a node under an evolution needs that evolution. So a bridge is a shortcut to passives only.
// Levels give points (combat.js gainXP) that wait until they're spent here: a level-up never stops the fight.
// applyTree() writes the web into activeClass.skills (level, selectedUpg, and baseDmg / maxCd for the generic twigs),
// so skill code reads ranks as it always has; a talent with its own effect is checked with hasTalent(id) where it acts.
// player.tree is { nodeId: true }.

const TREE_PTS_PER_LEVEL = 2; // the web is deep: two points a level (the campaign's balance pass may change it)
const NODE_COST = { evo: 2, cap: 3 }; // the big nodes cost more: spend points on the small ones now, or save up for these
const nodeCost = n => NODE_COST[n.kind] || 1;
const ULT_LEVEL = 5, EVO_LEVEL = 6;
const BRANCH_ANGLE = { 1: -135, 2: -45, 3: 135, 4: 45 };   // degrees, y down: Q top-left, E top-right, Space bottom-left, R bottom-right
const BRANCH_COLOR = { 1: '#4fc3f7', 2: '#ff8a50', 3: '#aed581', 4: '#b388ff' }, BRIDGE_COLOR = '#f1d48a';
const BRIDGES = [[1, 2], [2, 4], [4, 3], [3, 1]];           // neighbours round the ring
// One branch: [radius, degrees off the branch's own angle, node radius]. Negative angles are the L / A side.
const WEB = {
    learn: [112, 0, 25], r2: [180, 0, 22], r3: [254, 0, 22], modL: [220, -19, 19], modR: [220, 19, 19],
    passL: [288, -32, 16], passR: [288, 32, 16], evoA: [325, -11, 25], evoB: [325, 11, 25],
    A1: [392, -17, 19], A2: [458, -26, 19], A3: [458, -9, 19], Acap: [526, -17, 27],
    B1: [392, 17, 19], B2: [458, 9, 19], B3: [458, 26, 19], Bcap: [526, 17, 27],
};
const BRIDGE_R = 318, HERO_R = 62, WEB_R = 560;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const EVO_COLOR = { A: '#b39ddb', B: '#ffab91' };

const tree = { first: false, back: null, pending: null, nodes: null, byId: null, cls: null };

// ---------- the nodes ----------

function treeNodes() {
    const cid = activeClassId();
    const key = cid + spellKey(); // spellweaver.js: the web follows the spells on the keys
    if (tree.cls === key && tree.nodes) return tree.nodes;
    const W = TALENT_WEBS[cid] || {}, N = [];
    const place = (slot, key) => { const [r, off, size] = WEB[key], a = (BRANCH_ANGLE[slot] + off) * Math.PI / 180; return { x: Math.cos(a) * r, y: Math.sin(a) * r, size }; };
    for (let s = 1; s <= 4; s++) {
        const sk = treeSkill(s), w = isSpellbook() && player.spells ? spellWeb(s) : W[s] || {}, p = `s${s}_`, color = BRANCH_COLOR[s]; // spellweaver_evo.js: the spell's talents
        const node = (key, o) => { const n = { slot: s, key, color, links: [], needs: [], ...place(s, key), ...o }; N.push(n); return n; };
        node('learn', { id: p + 'learn', kind: 'rank', rank: 1, root: true, lvl: (isSpellbook() ? sk.greater : s === 4) ? ULT_LEVEL : 0 }); // the Spellweaver: a Greater spell, on any key
        node('r2', { id: p + 'r2', kind: 'rank', rank: 2, links: [p + 'learn'], needs: [p + 'learn'] });
        node('r3', { id: p + 'r3', kind: 'rank', rank: 3, links: [p + 'r2'], needs: [p + 'r2'] });
        const twig = (key, t) => t ? node(key, { ...t, kind: 'mod', links: [p + 'r2'], needs: [p + 'r2'] }) : null;
        const tL = twig('modL', w.modL || genericTwig(s, sk, 'quick')), tR = twig('modR', w.modR || genericTwig(s, sk, 'honed'));
        const pass = w.pass || DEFAULT_PASS[s];
        node('passL', { id: p + 'passL', kind: 'pass', passive: pass[0], links: [tL ? tL.id : p + 'r2'] });
        node('passR', { id: p + 'passR', kind: 'pass', passive: pass[1], links: [tR ? tR.id : p + 'r2'] });
        for (const path of sk.upgA ? ['A', 'B'] : []) { // a spell without evolutions yet (spellweaver.js) has no fork
            const evo = node('evo' + path, { id: p + 'evo' + path, kind: 'evo', path, links: [p + 'r3'], needs: [p + 'r3'], lvl: EVO_LEVEL, excl: p + 'evo' + (path === 'A' ? 'B' : 'A') });
            const sub = w[path] || [];
            const n1 = sub[0] && node(path + '1', { ...sub[0], kind: 'path', path, links: [evo.id], needs: [evo.id] });
            const n2 = n1 && sub[1] && node(path + '2', { ...sub[1], kind: 'path', path, links: [n1.id], needs: [n1.id] });
            const n3 = n1 && sub[2] && node(path + '3', { ...sub[2], kind: 'path', path, links: [n1.id], needs: [n1.id] });
            if (sub[3] && (n2 || n3)) node(path + 'cap', { ...sub[3], kind: 'cap', path, links: [n2, n3].filter(Boolean).map(n => n.id), needs: [evo.id] }); // from either node before it
        }
    }
    const bridges = W.bridges || DEFAULT_BRIDGES;
    for (const [a, b] of BRIDGES) { // halfway round the ring between two branches, joining their facing passives
        const diff = ((BRANCH_ANGLE[b] - BRANCH_ANGLE[a]) % 360 + 540) % 360 - 180, ang = (BRANCH_ANGLE[a] + diff / 2) * Math.PI / 180;
        N.push({ id: `b${a}${b}`, kind: 'pass', passive: bridges[`${a}${b}`] || 'vit', color: BRIDGE_COLOR, bridge: [a, b], x: Math.cos(ang) * BRIDGE_R, y: Math.sin(ang) * BRIDGE_R, size: 17,
            links: [`s${a}_pass${diff > 0 ? 'R' : 'L'}`, `s${b}_pass${diff > 0 ? 'L' : 'R'}`], needs: [] });
    }
    const byId = {}; for (const n of N) { byId[n.id] = n; n.adj = []; }
    for (const n of N) for (const l of n.links) if (byId[l]) { n.adj.push(byId[l]); byId[l].adj.push(n); } // links run both ways
    tree.cls = key; tree.nodes = N; tree.byId = byId;
    return N;
}
// A key's skill as the web builds it: the class's own, or the Spellweaver's spell on that key
function treeSkill(s) { return isSpellbook() && player.spells ? spellBase(s) : classDataConfig[activeClassId()].skills[s]; }
const treeNode = id => (treeNodes(), tree.byId[id]);
const hasTalent = id => !!(player.tree && player.tree[id]);
const treeFree = () => isTraining(); // training.js: every talent free, no level gates, respec any time
const treeRespecOk = () => treeFree();

// A new run: an empty web
function treeReset() { player.tree = {}; tree.nodes = null; applyTree(); }

// Talents that lost what they need (training.js changing a rank or an evolution) drop off
function treePrune() {
    for (let again = true; again;) {
        again = false;
        for (const n of treeNodes()) if (hasTalent(n.id) && !n.needs.every(hasTalent)) { delete player.tree[n.id]; again = true; }
    }
}

// The web into the skills and the stats
// A school talent (spellweaver_evo.js, `shared`) taken under one spell counts under every spell of that school on that path:
// player.tree[shared] says it's held, and every other copy whose evolution is taken is filled in for free ('free', no refund)
function syncShared() {
    const N = treeNodes(), held = new Set(N.filter(n => n.shared && player.tree[n.id] === true).map(n => n.shared));
    for (const k in player.tree) if (SCHOOL_IDS.has(k)) delete player.tree[k]; // held only while a copy is paid for in the web as it is now
    for (const id of held) player.tree[id] = true;
    for (const n of N) if (player.tree[n.id] === 'free') delete player.tree[n.id];
    for (let again = true; again;) { again = false; for (const n of N) if (n.shared && !player.tree[n.id] && held.has(n.shared) && n.needs.every(hasTalent)) { player.tree[n.id] = 'free'; again = true; } }
}
function applyTree() {
    if (isSpellbook()) syncShared();
    const taken = treeNodes().filter(n => hasTalent(n.id));
    for (let s = 1; s <= 4; s++) {
        const sk = activeClass.skills[s], p = `s${s}_`, evo = hasTalent(p + 'evoA') ? 'A' : hasTalent(p + 'evoB') ? 'B' : null;
        sk.level = ['learn', 'r2', 'r3'].filter(k => hasTalent(p + k)).length + (evo ? 1 : 0);
        sk.selectedUpg = evo;
        const mods = taken.filter(n => n.slot === s && n.mod);
        const base = treeSkill(s);
        sk.baseDmg = base.baseDmg * mods.reduce((m, n) => m * (n.mod.dmg || 1), 1);
        sk.maxCd = Math.round(base.maxCd * mods.reduce((m, n) => m * (n.mod.cd || 1), 1) * 100) / 100;
    }
    const count = kind => taken.filter(n => n.passive === kind).length;
    player.treeHp = count('vit') * vitHp();
    player.treePower = count('might') * PASSIVES.might.val;
    player.treeCdr = count('focus') * PASSIVES.focus.val;
    player.treeSpeed = count('fleet') * PASSIVES.fleet.val;
    recalcStats();
}

// What a node is right now: taken, open (click to take), ready (needs a point), gated (needs a level), locked (not
// reachable yet), barred (the other evolution was taken)
function nodeState(n) {
    if (hasTalent(n.id)) return 'taken';
    if (n.excl && hasTalent(n.excl)) return 'barred';
    if (!n.needs.every(hasTalent) || !(n.root || n.adj.some(a => hasTalent(a.id)))) return 'locked';
    if (tree.first && !(n.kind === 'rank' && n.rank === 1)) return 'locked';
    if (!treeFree() && player.level < (n.lvl || 0)) return 'gated';
    if (!treeFree() && player.skillPoints < nodeCost(n)) return 'ready';
    return 'open';
}

function takeNode(id) {
    const n = treeNode(id);
    if (!n || nodeState(n) !== 'open') return;
    if (n.kind === 'evo' && tree.pending !== id) { tree.pending = id; renderTree(); return; } // an evolution asks first
    tree.pending = null;
    player.tree[id] = true;
    if (!treeFree()) player.skillPoints -= nodeCost(n);
    applyTree(); updateHUD();
    tv.flash = { n, t: performance.now() }; // a bloom on the node just taken
    if (tree.first) { tree.first = false; closeTree(); startNextWave(); return; } // the first skill: the run begins
    renderTree();
}

function respecTree() {
    if (!treeRespecOk()) return;
    const spent = treeNodes().filter(n => player.tree[n.id] === true).reduce((s, n) => s + nodeCost(n), 0); // a free school-talent copy cost nothing
    player.tree = {}; tree.pending = null;
    if (!treeFree()) player.skillPoints += spent;
    applyTree();
    if (activeClass.name === 'Paladin') resetPaladinState(); // a Q or E unlearned: the hammer back in hand
    updateHUD(); renderTree();
}

// ---------- level-ups ----------

// combat.js gainXP: a banner over the skill bar, a ring on the hero; the fight goes on
function levelUpNotice() {
    const t = el('lvl-toast'), p = player.skillPoints;
    t.innerHTML = `<b>Level ${player.level}</b> &middot; ${p} skill point${p === 1 ? '' : 's'} &middot; <kbd>K</kbd> skill tree`;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    effects.push({ type: 'text', text: 'LEVEL UP', x: player.x, y: player.y - 56, color: '#d1b3ff', life: 1.4, maxLife: 1.4 });
    effects.push({ type: 'circle', x: player.x, y: player.y, radius: 70, color: 'rgba(164, 135, 255, 0.35)', life: 0.5, maxLife: 0.5 });
}

// ---------- the screen: a canvas you can drag and zoom, the hero in the middle ----------

const tv = { zoom: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, hover: null, drag: null, raf: 0, sky: null, imgs: {}, hero: null, flash: null };

function openTree(first = false) {
    if (gameState === STATE.TREE || !activeClass) return;
    tree.first = first; tree.pending = null; tv.hover = null; tv.drag = null;
    tree.back = gameState; gameState = STATE.TREE; uiOpenedAt = performance.now();
    hideTooltip(); el('tree-screen').classList.remove('hidden');
    const tp = el('training-panel'); if (tp) tp.classList.add('hidden'); // training.js: its panel would cover the web
    sizeTree(); fitTree(); renderTree();
    cancelAnimationFrame(tv.raf); tv.raf = requestAnimationFrame(treeFrame);
}
function closeTree() {
    if (gameState !== STATE.TREE || tree.first) return; // the first skill must be learned
    cancelAnimationFrame(tv.raf); tv.raf = 0;
    el('tree-screen').classList.add('hidden');
    gameState = tree.back; lastTime = performance.now();
    if (isTraining()) buildTrainingPanel(); // training.js: back on screen, its rank buttons following the web
    updateHUD();
}
function treeCancel() { tree.pending = null; renderTree(); }

function sizeTree() {
    const cv = el('tree-canvas'); tv.dpr = window.devicePixelRatio || 1; tv.w = window.innerWidth; tv.h = window.innerHeight;
    cv.width = Math.round(tv.w * tv.dpr); cv.height = Math.round(tv.h * tv.dpr); tv.sky = null;
}
function fitTree() { tv.zoom = Math.max(0.45, Math.min(1.1, (tv.w - 740) / 2 / WEB_R, (tv.h - 170) / 2 / WEB_R)); tv.ox = tv.w / 2; tv.oy = tv.h / 2 - 12; } // clear of the info panel and the buttons
const treeWorld = (sx, sy) => [(sx - tv.ox) / tv.zoom, (sy - tv.oy) / tv.zoom];
function nodeAt(sx, sy) {
    const [x, y] = treeWorld(sx, sy);
    let best = null, bd = Infinity;
    for (const n of treeNodes()) { const d = Math.hypot(n.x - x, n.y - y); if (d < n.size + 7 && d < bd) { bd = d; best = n; } }
    return best;
}

// Header, info panel and buttons (DOM); the web itself is painted every frame by treeFrame
function renderTree() {
    const C = activeClass, pts = player.skillPoints;
    el('tree-title').textContent = tree.first ? 'Choose Your First Skill' : 'Skill Tree';
    el('tree-sub').innerHTML = tree.first ? 'Learn the skill you start the run with: click a glowing node next to the hero'
        : treeFree() ? `${C.name} &middot; Training Room: every talent is free`
        : `${C.name} &middot; Level ${player.level} &middot; <b>${pts}</b> point${pts === 1 ? '' : 's'} to spend`;
    renderTreeInfo();
    el('tree-hint').innerHTML = 'Drag to look around &middot; scroll to zoom &middot; click a glowing node to take it' + (treeRespecOk() ? '' : ' &middot; respec is free between dungeons');
    el('tree-buttons').innerHTML = tree.first ? '' : `${treeRespecOk() ? `<button class="btn btn-danger" onclick="respecTree()">Respec</button>` : ''}
        <button class="btn btn-primary" onclick="closeTree()">${tree.back === STATE.PLAYING ? 'Back to the fight' : 'Close'} <kbd>K</kbd></button>`;
}
function renderTreeInfo() {
    const box = el('tree-info'), pend = tree.pending && treeNode(tree.pending);
    if (pend) { // an evolution waits for its confirmation
        const sk = activeClass.skills[pend.slot], u = sk['upg' + pend.path];
        box.innerHTML = `<div class="ti-name" style="color:${EVO_COLOR[pend.path]}">Evolve ${sk.name}?</div><div class="ti-type">into ${u.name}</div>
            <div class="ti-body"><div class="tt-stat">${u.desc}</div></div><div class="ti-foot">${treeFree() ? '' : `${nodeCost(pend)} points. `}The other evolution, and everything under it, closes until you respec.</div>
            <div class="ui-row"><button class="btn btn-primary" onclick="takeNode('${pend.id}')">Evolve <kbd>Enter</kbd></button><button class="btn" onclick="treeCancel()">Cancel <kbd>Esc</kbd></button></div>`;
        return;
    }
    const n = tv.hover;
    if (!n) {
        box.innerHTML = `<div class="ti-name">${activeClass.name}</div><div class="ti-type">Hover a node to read it</div>
            <div class="ti-body"><div class="tt-stat">Each skill is a branch: learn it beside the hero, empower it, then choose one of its two evolutions and grow what lies beneath. The gold nodes between branches are shared passives.${treeFree() ? '' : ' Evolutions cost 2 points and capstones 3: spend now, or save up for them.'}</div></div>`;
        return;
    }
    box.innerHTML = nodeTip(n);
}

function treeFrame(now) {
    if (gameState !== STATE.TREE) return;
    drawWeb(now / 1000);
    tv.raf = requestAnimationFrame(treeFrame);
}

// The night sky behind the web, painted once per size
function treeSky() {
    if (tv.sky) return tv.sky;
    const c = document.createElement('canvas'); c.width = Math.round(tv.w * tv.dpr); c.height = Math.round(tv.h * tv.dpr);
    const g = c.getContext('2d'), rnd = mapRng(41);
    g.scale(tv.dpr, tv.dpr);
    let gr = g.createRadialGradient(tv.w / 2, tv.h / 2, 40, tv.w / 2, tv.h / 2, Math.max(tv.w, tv.h) * 0.75);
    gr.addColorStop(0, '#2a1d45'); gr.addColorStop(0.55, '#140f26'); gr.addColorStop(1, '#07060d');
    g.fillStyle = gr; g.fillRect(0, 0, tv.w, tv.h);
    for (const [x, y, r, col] of [[0.22, 0.3, 0.35, 'rgba(80, 60, 160, 0.16)'], [0.8, 0.7, 0.4, 'rgba(150, 50, 110, 0.12)'], [0.65, 0.2, 0.25, 'rgba(40, 120, 160, 0.1)']]) { // nebulae
        gr = g.createRadialGradient(x * tv.w, y * tv.h, 0, x * tv.w, y * tv.h, r * tv.w); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = gr; g.fillRect(0, 0, tv.w, tv.h);
    }
    for (let i = 0; i < 420; i++) { const s = rnd(); g.fillStyle = `rgba(255, 255, 255, ${0.2 + s * 0.6})`; g.fillRect(rnd() * tv.w, rnd() * tv.h, s > 0.93 ? 2 : 1, s > 0.93 ? 2 : 1); }
    return (tv.sky = c);
}

function treeImg(url) { let im = tv.imgs[url]; if (!im) { im = tv.imgs[url] = new Image(); im.src = url; } return im; }

function drawWeb(t) { // (menu.js has its own drawTree, for the map's trees)
    const cv = el('tree-canvas'), c = cv.getContext('2d'), nodes = treeNodes();
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(treeSky(), 0, 0);
    c.setTransform(tv.dpr * tv.zoom, 0, 0, tv.dpr * tv.zoom, tv.dpr * tv.ox, tv.dpr * tv.oy);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(190, 170, 255, 0.07)'; c.lineWidth = 1.5 / tv.zoom; // faint orbits
    for (const r of [112, 254, 325, 458, 526]) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
    const st = {}; for (const n of nodes) st[n.id] = nodeState(n);
    const live = s => s === 'open' || s === 'ready' || s === 'gated';

    // links: from the hero to each Learn, then every link once
    for (const n of nodes) if (n.root) drawTreeLink(c, { x: 0, y: 0 }, n, st[n.id] === 'taken' ? 'on' : live(st[n.id]) ? 'open' : '', n.color);
    for (const n of nodes) for (const id of n.links) {
        const a = tree.byId[id]; if (!a) continue;
        const ta = st[a.id] === 'taken', tb = st[n.id] === 'taken';
        drawTreeLink(c, a, n, ta && tb ? 'on' : (ta && live(st[n.id])) || (tb && live(st[a.id])) ? 'open' : '', n.bridge || a.bridge ? BRIDGE_COLOR : n.color);
    }
    drawTreeHero(c, t);
    for (const n of nodes) drawTreeNode(c, n, st[n.id], t);
    if (tv.flash) { // the bloom on a node just taken
        const k = (performance.now() - tv.flash.t) / 450, n = tv.flash.n;
        if (k >= 1) tv.flash = null;
        else { c.strokeStyle = n.color; c.globalAlpha = 1 - k; c.lineWidth = 4; c.beginPath(); c.arc(n.x, n.y, n.size + 6 + k * 34, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
    }
}

function drawTreeLink(c, a, b, state, color) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const bend = 0.13 * len * (a.x * b.y - a.y * b.x >= 0 ? 1 : -1); // links curve the way the web turns, like orbits
    const cx = mx - dy / len * bend, cy = my + dx / len * bend;
    c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(cx, cy, b.x, b.y);
    if (state === 'on') { c.strokeStyle = color; c.lineWidth = 5; c.shadowColor = color; c.shadowBlur = 14; c.stroke(); c.shadowBlur = 0; c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1.5; c.stroke(); }
    else if (state === 'open') { c.strokeStyle = color; c.globalAlpha = 0.45; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1; }
    else { c.strokeStyle = 'rgba(200, 190, 255, 0.13)'; c.lineWidth = 2; c.stroke(); }
}

function drawTreeHero(c, t) { // the hero's portrait in a ring at the heart of the web (portraits.js)
    if (!tv.hero) { tv.hero = document.createElement('canvas'); tv.hero.width = PT_W * 2; tv.hero.height = PT_H * 2; }
    drawPortrait(tv.hero, activeClassId(), t, 0.5);
    const s = 160 / PT_W;
    c.save(); c.beginPath(); c.arc(0, 0, HERO_R, 0, Math.PI * 2); c.fillStyle = '#100c18'; c.fill(); c.clip();
    c.drawImage(tv.hero, -PT_W / 2 * s, -6 - 95 * s, PT_W * s, PT_H * s);
    c.restore();
    c.shadowColor = activeClass.color; c.shadowBlur = 22; c.strokeStyle = activeClass.color; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, HERO_R, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(241, 212, 138, 0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, HERO_R + 5, 0, Math.PI * 2); c.stroke();
}

function drawTreeNode(c, n, st, t) {
    const r = n.size, lit = st === 'taken', open = st === 'open', hover = tv.hover === n, pending = tree.pending === n.id;
    const ring = n.kind === 'evo' ? EVO_COLOR[n.path] : n.color;
    c.globalAlpha = lit || open || pending ? 1 : st === 'ready' ? 0.8 : st === 'gated' ? 0.55 : st === 'barred' ? 0.16 : 0.32;
    if (lit) { c.shadowColor = ring; c.shadowBlur = 20; }
    c.fillStyle = lit ? ring : '#120e1c'; c.beginPath(); c.arc(n.x, n.y, r + 4, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    const im = treeImg(talentIcon(n));
    c.save(); c.beginPath(); c.arc(n.x, n.y, r, 0, Math.PI * 2); c.clip();
    if (!lit && !open && !pending) c.filter = 'grayscale(0.85) brightness(0.75)';
    if (im.complete && im.naturalWidth) c.drawImage(im, n.x - r, n.y - r, r * 2, r * 2);
    c.filter = 'none'; c.restore();
    if (open || pending) { // a node you can take breathes in gold
        const k = 0.5 + 0.5 * Math.sin(t * 4 + n.x * 0.01);
        c.strokeStyle = pending ? ring : `rgba(241, 212, 138, ${0.55 + 0.45 * k})`; c.lineWidth = 3;
        c.shadowColor = pending ? ring : '#f1d48a'; c.shadowBlur = 8 + 10 * k;
        c.beginPath(); c.arc(n.x, n.y, r + 4, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0;
    } else { c.strokeStyle = lit ? 'rgba(255, 255, 255, 0.85)' : ring; c.lineWidth = lit ? 2 : 1.5; c.beginPath(); c.arc(n.x, n.y, r + (lit ? 1 : 3), 0, Math.PI * 2); c.stroke(); }
    if (n.kind === 'cap') { c.strokeStyle = lit ? '#fff3c4' : 'rgba(241, 212, 138, 0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(n.x, n.y, r + 9, 0, Math.PI * 2); c.stroke(); } // a capstone wears a second ring
    if (hover) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, r + 8, 0, Math.PI * 2); c.stroke(); }
    const badge = n.kind === 'rank' ? ROMAN[n.rank] : n.kind === 'evo' ? n.path : '';
    if (badge) {
        const bx = n.x + r * 0.72, by = n.y + r * 0.72;
        c.fillStyle = n.kind === 'evo' ? EVO_COLOR[n.path] : '#1a140f'; c.strokeStyle = n.kind === 'evo' ? '#000' : '#c9a86a'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(bx, by, 9, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = n.kind === 'evo' ? '#120e0a' : '#f1d48a'; c.font = 'bold 10px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(badge, bx, by + 0.5);
    }
    if (nodeCost(n) > 1 && !lit && st !== 'barred' && !treeFree()) { // the price of a big node, in a gold diamond at its top left
        const px = n.x - r * 0.72, py = n.y - r * 0.72;
        c.fillStyle = '#1a140f'; c.strokeStyle = '#f1d48a'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(px, py - 10); c.lineTo(px + 10, py); c.lineTo(px, py + 10); c.lineTo(px - 10, py); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#f1d48a'; c.font = 'bold 11px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(nodeCost(n), px, py + 0.5);
    }
    if (st === 'gated') { c.fillStyle = '#d7c9a8'; c.font = '11px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(`Lv. ${n.lvl}`, n.x, n.y + r + 7); }
    c.globalAlpha = 1;
}

// Input: drag to pan, wheel to zoom round the cursor, click to take
(function bindTree() {
    const cv = el('tree-canvas'); if (!cv) return;
    cv.addEventListener('mousedown', e => { if (e.button === 0) tv.drag = { x: e.clientX, y: e.clientY, ox: tv.ox, oy: tv.oy, moved: false }; });
    window.addEventListener('mousemove', e => {
        if (gameState !== STATE.TREE) return;
        const d = tv.drag;
        if (d) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true; if (d.moved) { tv.ox = d.ox + e.clientX - d.x; tv.oy = d.oy + e.clientY - d.y; } }
        const h = d && d.moved ? null : (e.target === cv ? nodeAt(e.clientX, e.clientY) : null);
        if (h !== tv.hover) { tv.hover = h; if (!tree.pending) renderTreeInfo(); }
        cv.style.cursor = d && d.moved ? 'grabbing' : h && nodeState(h) === 'open' ? 'pointer' : 'grab';
    });
    window.addEventListener('mouseup', e => {
        const d = tv.drag; tv.drag = null;
        if (gameState !== STATE.TREE || !d || d.moved || e.button !== 0 || e.target !== cv) return;
        const n = nodeAt(e.clientX, e.clientY);
        if (n) takeNode(n.id); else if (tree.pending) treeCancel();
    });
    cv.addEventListener('wheel', e => {
        e.preventDefault();
        const z = Math.max(0.4, Math.min(2.2, tv.zoom * Math.exp(-e.deltaY * 0.0015)));
        const [wx, wy] = treeWorld(e.clientX, e.clientY);
        tv.zoom = z; tv.ox = e.clientX - wx * z; tv.oy = e.clientY - wy * z;
    }, { passive: false });
    window.addEventListener('resize', () => { if (gameState === STATE.TREE) { sizeTree(); fitTree(); } });
})();

// ---------- the info panel's text ----------

function nodeName(n) {
    const sk = n.slot && activeClass.skills[n.slot];
    if (n.kind === 'rank') return n.rank === 1 ? `Learn ${sk.name}` : `Empower ${sk.name}`;
    if (n.kind === 'evo') return sk['upg' + n.path].name;
    if (n.kind === 'pass') return PASSIVES[n.passive].name;
    return n.name;
}

function nodeTip(n) {
    const st = nodeState(n), sk = n.slot && activeClass.skills[n.slot], key = n.slot && (SLOT_KEYS[n.slot] === 'SPC' ? 'Space' : SLOT_KEYS[n.slot]);
    const lvl = sk ? Math.max(1, sk.level) : 0, taken = st === 'taken';
    let type = '', body = '', color = n.color;
    if (n.kind === 'rank') {
        type = n.rank === 1 ? `${key} · a new skill` : `${key} · ${sk.name}, rank ${n.rank} of 4`;
        body = skillStats(n.slot, sk, taken || n.rank === 1 ? 0 : n.rank - 1, n.rank); // ui.js: what the rank changes, at your Power
    } else if (n.kind === 'evo') {
        const u = sk['upg' + n.path]; color = EVO_COLOR[n.path];
        type = `${key} · ${sk.name}, evolution ${n.path} (rank 4)`;
        body = `<div class="tt-stat">${u.desc}</div>` + skillStats(n.slot, { ...sk, selectedUpg: n.path }, taken ? 0 : 3, 4);
    } else if (n.kind === 'pass') {
        type = n.bridge ? 'Shared passive · joins two branches' : `Passive · ${sk.name} branch`;
        body = `<div class="tt-stat">${PASSIVES[n.passive].text()}</div>`;
    } else {
        const evo = n.path && sk['upg' + n.path].name;
        type = n.kind === 'cap' ? `${key} · ${evo} capstone` : n.kind === 'path' ? `${key} · ${evo}` : `${key} · ${sk.name}`;
        body = `<div class="tt-stat">${n.desc}</div>`;
        const b = treeSkill(n.slot);
        if (n.mod && n.mod.cd) { const raw = rankScalesCooldown(n.slot) ? calcCooldown(b.maxCd, lvl) : b.maxCd; body += `CD ${raw.toFixed(1)}s → <b>${(raw * n.mod.cd).toFixed(1)}s</b>`; }
        if (n.mod && n.mod.dmg) { const hit = m => { const v = hitDmg(b.baseDmg * m, lvl); return v < 10 ? v.toFixed(1) : Math.round(v); }; body += `Hit ${hit(1)} → <b>${hit(n.mod.dmg)}</b>`; }
    }
    const foot = { // only the line for this state is built
        taken: () => n.kind === 'evo' ? 'Chosen' : 'Taken',
        open: () => treeFree() ? 'Click to take it' : `${n.kind === 'evo' ? 'Click to choose this evolution' : 'Click to take it'} · ${nodeCost(n)} point${nodeCost(n) > 1 ? 's' : ''}`,
        ready: () => `Costs ${nodeCost(n)} point${nodeCost(n) > 1 ? 's' : ''}; you have ${player.skillPoints}. The next level brings more`,
        gated: () => `Opens at Lv. ${n.lvl}`,
        locked: () => !n.needs.every(hasTalent) ? `Needs ${n.needs.filter(id => !hasTalent(id)).map(id => nodeName(treeNode(id))).join(', ')}` : tree.first ? 'Learn a skill first' : 'Take a node next to it first',
        barred: () => `You chose ${nodeName(treeNode(n.excl))}; respec to switch`,
    }[st]();
    return `<div class="ti-name" style="color:${color}">${nodeName(n)}</div><div class="ti-type">${type}</div><div class="ti-body">${body}</div><div class="ti-foot">${foot}</div>`;
}
