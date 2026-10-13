// ==========================================
// map_bridge.js - Bandit Bastion stage 3: the bridge to the castle (wave 11), the duel with Valerius
// ==========================================
// The stone bridge the Beastmaster guarded, carried on to the Bastion: it starts as the trail's narrow bridgehead (his
// barrier lying open), broadens into a grand span over a misty gorge, with statues of bandit captains in alcoves, braziers,
// crimson banners and a round landing in the middle, and ends at the castle's gatehouse (its portcullis shut).
// Nothing stands on it. Walking up to the gate (BR_TRIGGER) plays valerius_intro: Valerius drops off the battlements onto
// the landing behind you, hooks you back with his chained spear and kicks you to the bridgehead (a quarter of your max HP).
// The duel is ai.js ValeriusAI; in its second phase the castle's archers loose volleys from the battlements (brgVolley).
// He can't die here: at 0 HP valerius_escape kneels him, he speaks (dialogue.js), then hauls himself up onto the wall on
// his chain and is gone. Then the portcullis grinds up (bridge_gate) and the exit leads into the castle (map_castle.js).
// buildBridge() lays the terrain grid out and paints one ground layer; braziers, banners, mist, archers and the portcullis are live.

STAGE_MAPS.bridge = {
    w: 4400, h: 1400, cell: 25,
    bounds: { left: 40, top: 215, right: 3990, bottom: 1185 }, // a leap off the side can't land further out than the gorge's near edge
    start: { x: 230, y: 700 },
    exit: { x: 3960, y: 700 }, exitTo: { x: 4200, y: 700 }, exitR: 80, arrow: '#ffab40', // the gatehouse: open once he's fled
    prompt: 'Cross the bridge to the Bastion',
    cleared: { title: 'Stage Cleared', sub: 'The Bridge · Bandit Bastion', next: 'The Bastion' },
    obstacles: [], grid: null,
};

const BR = { y: 700, hw: 260, head: 380, headEnd: 820, gate: 4000, plaza: { x: 2200, r: 330 } };
const BR_TRIGGER = 3300;         // the hero passing this x calls Valerius down
const BR_STATUES = [1150, 1650, 2750, 3250]; // alcoves on both parapets
const BR_BRAZIERS = [[2200 - 201, 700 - 201], [2200 + 201, 700 - 201], [2200 - 201, 700 + 201], [2200 + 201, 700 + 201], [1400, 700 - 225], [1400, 700 + 225], [3000, 700 - 225], [3000, 700 + 225], [3900, 700 - 200], [3900, 700 + 200]];
const BR_BANNERS = [[900, -1], [1400, 1], [1900, -1], [2500, 1], [3000, -1], [3500, 1], [3820, -1], [3820, 1]]; // [x, side]
const BR_TOWERS = [[4110, 700 - 290], [4110, 700 + 290]];
const BR_ARCHERS = [455, 505, 555, 845, 895, 945]; // where the castle's archers stand on the wall walk (y), phase 2
const BR_VOLLEY = { every: 4.5, marks: 5, spread: 160, r: 34, warn: 1.0, dmg: 0.55 };
const brEaseIn = x => { x = clamp01(x); return x * x * x; };
const brg = { built: false, ground: null, grid: null, triggered: false, archK: 0, archOn: false, volleys: [], volleyT: 0, archerSpr: null, flare: 0, sigil: 0, gateK: 0 }; // flare: the braziers leap up; sigil: the landing's brass blazes; gateK: the portcullis raised

// The deck's half-width at x: the trail's narrow bridgehead (70) broadening into the span (260), bulging round the landing
function bridgeHalf(x) {
    const head = 70 + (BR.hw - 70) * trSmooth(clamp01((x - BR.head) / (BR.headEnd - BR.head))); // map_trail.js
    const dx = x - BR.plaza.x, plaza = Math.abs(dx) < BR.plaza.r ? Math.sqrt(BR.plaza.r * BR.plaza.r - dx * dx) : 0;
    return Math.max(head, plaza);
}

function buildBridge() {
    if (brg.built) return;
    const D = STAGE_MAPS.bridge;
    D.grid = brg.grid = brGenerate(D);
    D.obstacles.length = 0;
    for (const [x, y] of BR_BRAZIERS) D.obstacles.push({ x, y, r: 18, kind: 'brazier' });
    brPaint(D);
    brg.built = true;
}

// Every visit: nobody on the bridge yet, the archers off the wall
function resetBridge() {
    brg.triggered = false; brg.archK = 0; brg.archOn = false; brg.volleys.length = 0; brg.volleyT = 0; brg.flare = 0; brg.sigil = 0; brg.gateK = 0; camera.speed = 0;
    showStagePrompt(true);
}

// ---------- generation ----------

function brGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i % cols + 0.5) * cs, y = (Math.floor(i / cols) + 0.5) * cs, dy = Math.abs(y - BR.y);
        if (x < 40 || x >= BR.gate || BR_TOWERS.some(([tx, ty]) => Math.hypot(x - tx, y - ty) < 135)) { data[i] = T_WALL; continue; } // the map's west edge, the gatehouse
        const hw = bridgeHalf(x);
        data[i] = dy < hw ? T_FLOOR : dy < hw + 25 ? T_FENCE : T_RAVINE; // the deck, the parapet (shots and leaps pass), the gorge
    }
    for (const sx of BR_STATUES) for (const s of [-1, 1]) { // the alcoves bulge out of the parapet
        const cy = BR.y + s * (BR.hw + 12);
        for (let i = 0; i < n; i++) {
            const x = (i % cols + 0.5) * cs, y = (Math.floor(i / cols) + 0.5) * cs;
            if (Math.hypot(x - sx, y - cy) < 46 && Math.abs(y - BR.y) >= BR.hw) data[i] = T_FENCE;
        }
    }
    return { cols, rows, cell: cs, data };
}

// ---------- the cached ground ----------

function brPaint(D) {
    const W = D.w, H = D.h, rnd = clrRng(9311), N = cavNoise(4471);
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const edge = s => { const pts = []; for (let x = 0; x <= BR.gate; x += 5) pts.push([x, BR.y + s * bridgeHalf(x)]); return pts; };
    const top = edge(-1), bot = edge(1);
    const deckPath = (grow = 0) => {
        c.beginPath(); c.moveTo(0, top[0][1] - grow);
        for (const [x, y] of top) c.lineTo(x, y - grow);
        c.lineTo(BR.gate + 20, top[top.length - 1][1] - grow); c.lineTo(BR.gate + 20, bot[bot.length - 1][1] + grow);
        for (let i = bot.length - 1; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1] + grow);
        c.closePath();
    };

    // --- the gorge: a river far below, through haze; the near bank in the west, rock under the castle in the east ---
    c.fillStyle = '#16303a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 260, gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rnd() < 0.5 ? 'rgba(40, 80, 88, 0.35)' : 'rgba(8, 20, 26, 0.4)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.strokeStyle = 'rgba(190, 230, 220, 0.1)'; c.lineWidth = 2;
    for (let i = 0; i < 260; i++) { const x = rnd() * W, y = rnd() * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8 + rnd() * 6, y + 22 + rnd() * 14); c.stroke(); } // the current runs south
    const bankW = y => 300 + (N(40, y) - 0.5) * 90, bankE = y => 3930 + (N(900, y) - 0.5) * 80;
    c.fillStyle = '#4a6230'; c.beginPath(); c.moveTo(0, 0); for (let y = 0; y <= H; y += 20) c.lineTo(bankW(y), y); c.lineTo(0, H); c.closePath(); c.fill(); // the near bank: the trail's meadow
    c.strokeStyle = '#3a3226'; c.lineWidth = 10; c.beginPath(); for (let y = 0; y <= H; y += 20) c.lineTo(bankW(y), y); c.stroke(); // its earth edge
    for (let y = 0; y < H; y += 26) for (let k = 0; k < 2; k++) { const x = bankW(y) - 6 - rnd() * 16, h = 12 + rnd() * 12, l = (rnd() - 0.5) * 6; c.strokeStyle = rnd() < 0.5 ? '#7d8c3a' : '#8f9a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y - h); c.stroke(); } // reeds
    c.fillStyle = '#3b3733'; c.beginPath(); c.moveTo(W, 0); for (let y = 0; y <= H; y += 20) c.lineTo(bankE(y), y); c.lineTo(W, H); c.closePath(); c.fill(); // the castle's rock
    for (let i = 0; i < 40; i++) { const y = rnd() * H; cavRock(c, bankE(y) + 20 + rnd() * 50, y, 10 + rnd() * 14, rnd, '#55504a'); }
    c.fillStyle = 'rgba(150, 160, 170, 0.18)'; c.fillRect(0, 0, W, H); // the haze between the bridge and the water

    // --- the bridge's shadow on the water far below, and its piers ---
    c.save(); c.filter = 'blur(14px)'; c.translate(70, 120); deckPath(30); c.fillStyle = 'rgba(4, 10, 14, 0.45)'; c.fill(); c.restore();
    for (let px = 700; px < 3800; px += 620) for (const s of [-1, 1]) { // the cutwaters, seen beside the deck: stone wedges going down into the mist
        const y0 = BR.y + s * (bridgeHalf(px) + 20), y1 = y0 + s * 85;
        c.beginPath(); c.moveTo(px - 60, y0); c.lineTo(px - 60, y0 + s * 50); c.lineTo(px, y1); c.lineTo(px + 60, y0 + s * 50); c.lineTo(px + 60, y0); c.closePath();
        c.fillStyle = '#4a463f'; c.fill(); c.strokeStyle = '#2b2824'; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(255, 236, 210, 0.08)'; c.fillRect(px - 60, y0 + (s < 0 ? -50 : 0), 10, 50); // a lit west face
        const mg = c.createLinearGradient(0, y0, 0, y1); mg.addColorStop(0, 'rgba(160, 170, 180, 0)'); mg.addColorStop(1, 'rgba(160, 170, 180, 0.45)'); // sinking into the mist
        c.fillStyle = mg; c.fill();
    }

    // --- the deck: rows of big slabs, a red runner inlaid with brass down the middle ---
    deckPath(); c.fillStyle = '#57524a'; c.fill();
    c.save(); deckPath(); c.clip();
    const slabs = ['#8d8579', '#7f786d', '#948c80', '#776f64', '#88806f'];
    for (let row = 0, y = BR.y - 352; y < BR.y + 352; y += 32, row++) for (let x = BR.head - 56 - ((row % 2) * 28); x < BR.gate + 20; x += 56) {
        c.fillStyle = slabs[(rnd() * slabs.length) | 0]; c.fillRect(x, y, 56, 32);
        c.fillStyle = 'rgba(255, 245, 225, 0.08)'; c.fillRect(x, y, 56, 3); // lit top edge
        c.strokeStyle = '#4e4a42'; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y + 0.5, 55, 31);
    }
    for (let row = 0, y = BR.y - 70 + 5; y < BR.y + 70; y += 25, row++) for (let x = -((row % 2) * 18); x < BR.head + 20; x += 36) { // the trail's small slabs on the narrow bridgehead
        c.fillStyle = rnd() < 0.5 ? '#8a857a' : '#6f6a60'; c.fillRect(x, y, 36, 25);
        c.fillStyle = 'rgba(255, 250, 235, 0.09)'; c.fillRect(x, y, 36, 3);
        c.strokeStyle = '#4e4a42'; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y + 0.5, 35, 24);
    }
    const RUN = 46; // the runner
    c.save(); c.beginPath(); c.rect(BR.headEnd, BR.y - RUN, BR.gate - BR.headEnd, RUN * 2); c.moveTo(BR.plaza.x + BR.plaza.r - 30, BR.y); c.arc(BR.plaza.x, BR.plaza.y || BR.y, BR.plaza.r - 30, 0, Math.PI * 2, true); c.clip('evenodd');
    c.fillStyle = '#5b3a2f'; c.fillRect(BR.headEnd, BR.y - RUN, BR.gate - BR.headEnd, RUN * 2);
    for (let x = BR.headEnd; x < BR.gate; x += 60) { c.fillStyle = rnd() < 0.5 ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 220, 190, 0.05)'; c.fillRect(x, BR.y - RUN, 60, RUN * 2); c.strokeStyle = 'rgba(30, 16, 12, 0.6)'; c.lineWidth = 1; c.strokeRect(x + 0.5, BR.y - RUN + 0.5, 59, RUN * 2 - 1); }
    c.strokeStyle = '#b08d4a'; c.lineWidth = 2.4;
    for (const o of [-RUN + 4, RUN - 4]) { c.beginPath(); c.moveTo(BR.headEnd, BR.y + o); c.lineTo(BR.gate, BR.y + o); c.stroke(); } // brass borders
    c.lineWidth = 1.6;
    for (let x = BR.headEnd + 60; x < BR.gate; x += 120) { c.beginPath(); c.moveTo(x - 22, BR.y); c.lineTo(x, BR.y - 22); c.lineTo(x + 22, BR.y); c.lineTo(x, BR.y + 22); c.closePath(); c.stroke(); c.beginPath(); c.arc(x, BR.y, 4, 0, Math.PI * 2); c.stroke(); } // brass diamonds
    c.restore();
    // the landing: rings of fan-cut slabs round a dark disc with his sigil in brass
    const P = BR.plaza;
    c.save(); c.beginPath(); c.arc(P.x, BR.y, P.r, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#6f675c'; c.fillRect(P.x - P.r, BR.y - P.r, P.r * 2, P.r * 2);
    for (let r0 = 90; r0 < P.r; r0 += 48) {
        const nSeg = Math.max(8, Math.round(Math.PI * 2 * (r0 + 24) / 70)), off = rnd() * 6;
        for (let k = 0; k < nSeg; k++) {
            const a0 = off + k / nSeg * Math.PI * 2, a1 = off + (k + 1) / nSeg * Math.PI * 2;
            c.beginPath(); c.arc(P.x, BR.y, r0 + 48, a0, a1); c.arc(P.x, BR.y, r0, a1, a0, true); c.closePath();
            c.fillStyle = slabs[(rnd() * slabs.length) | 0]; c.fill(); c.strokeStyle = '#4e4a42'; c.lineWidth = 1.2; c.stroke();
        }
    }
    c.restore();
    c.beginPath(); c.arc(P.x, BR.y, 90, 0, Math.PI * 2); c.fillStyle = '#6a4a38'; c.fill(); // warm stone under the brass, so he doesn't vanish into it
    c.strokeStyle = '#b08d4a'; c.lineWidth = 3; c.beginPath(); c.arc(P.x, BR.y, 86, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.arc(P.x, BR.y, 74, 0, Math.PI * 2); c.stroke();
    brSigil(c, P.x, BR.y, 1);
    c.restore();
    // wear: moss in the joints, chips, soot by the braziers
    for (let i = 0; i < 900; i++) {
        const x = BR.headEnd + rnd() * (BR.gate - BR.headEnd), y = BR.y + (rnd() - 0.5) * 2 * bridgeHalf(x) * 0.96;
        c.fillStyle = rnd() < 0.5 ? 'rgba(70, 90, 50, 0.22)' : 'rgba(30, 26, 22, 0.25)'; c.beginPath(); c.ellipse(x, y, 2 + rnd() * 5, 1 + rnd() * 2.5, rnd() * 3, 0, Math.PI * 2); c.fill();
    }

    // --- the parapets: a balustrade with posts, the alcoves bulging out with a statue in each ---
    for (const s of [-1, 1]) {
        c.beginPath(); for (let x = 0; x <= BR.gate; x += 5) { const y = BR.y + s * (bridgeHalf(x) + 12.5); if (x) c.lineTo(x, y); else c.moveTo(x, y); }
        c.strokeStyle = '#2f2b26'; c.lineWidth = 29; c.stroke(); c.strokeStyle = '#8e877b'; c.lineWidth = 23; c.stroke();
        c.strokeStyle = 'rgba(255, 245, 225, 0.14)'; c.lineWidth = 4; c.stroke(); // the capstone's lit line
        for (const sx of BR_STATUES) { const y = BR.y + s * (BR.hw + 12); c.beginPath(); c.arc(sx, y, 48, 0, Math.PI * 2); c.fillStyle = '#2f2b26'; c.fill(); c.beginPath(); c.arc(sx, y, 45, 0, Math.PI * 2); c.fillStyle = '#8e877b'; c.fill(); c.beginPath(); c.rect(sx - 30, y - 30, 60, 60); c.fillStyle = '#a39b8e'; c.fill(); c.strokeStyle = '#4e4a42'; c.lineWidth = 2; c.stroke(); }
        for (let x = 20; x < BR.gate; x += 60) { const y = BR.y + s * (bridgeHalf(x) + 12.5); if (BR_STATUES.some(sx => Math.abs(sx - x) < 52)) continue; c.fillStyle = '#9c9488'; c.fillRect(x - 13, y - 15, 26, 30); c.strokeStyle = '#3e3a34'; c.lineWidth = 1.6; c.strokeRect(x - 13, y - 15, 26, 30); c.fillStyle = 'rgba(255, 245, 225, 0.12)'; c.fillRect(x - 13, y - 15, 26, 4); } // posts
    }
    // statues: bandit captains in stone, looking down onto the deck (bandits.js paints them; greyed into stone)
    const statueKinds = ['boss_warlord', 'shield', 'archer', 'thief'], pose = { t: 0, walk: 0, move: 0, trail: { x: 0, y: 0 }, stab: 0.3, draw: 0, shield: 1, bash: 0, throwK: 0, torchK: 0, kegK: 0, crouch: 0, lunge: 0, hurt: false };
    BR_STATUES.forEach((sx, k) => [-1, 1].forEach((s, j) => {
        const kind = statueKinds[(k * 2 + j) % statueKinds.length], sc = 1.75, E = banditExtent(kind, sc), img = cavCanvas(E * 2, E * 2), y = BR.y + s * (BR.hw + 12);
        stampBandit(null, 0, 0, s < 0 ? Math.PI / 2 : -Math.PI / 2, sc, pose, 0, 1, 0, kind, img); // bandits.js
        c.save(); c.fillStyle = 'rgba(10, 8, 6, 0.4)'; c.beginPath(); c.ellipse(sx + 10, y + 14, 30, 22, 0, 0, Math.PI * 2); c.fill(); // its shadow, long in the low sun
        c.filter = 'grayscale(1) brightness(1.25) contrast(0.85)'; c.drawImage(img, sx - E, y - E); c.restore();
    }));
    // brazier stands: an iron bowl on three legs, full of coals (the flames are live)
    for (const [x, y] of BR_BRAZIERS) {
        c.fillStyle = 'rgba(10, 8, 6, 0.35)'; c.beginPath(); c.ellipse(x + 6, y + 8, 22, 16, 0, 0, Math.PI * 2); c.fill();
        for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; sprStroke(c, '#2b2b2b', 3, () => { c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); }); }
        c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fillStyle = '#262626'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke();
        for (let k = 0; k < 9; k++) { c.fillStyle = rnd() < 0.5 ? '#5d1a08' : '#a33c10'; c.beginPath(); c.arc(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18, 3 + rnd() * 2, 0, Math.PI * 2); c.fill(); }
    }
    // the bridgehead: two pillars where it starts to broaden, and the Beastmaster's barrier lying open with its snapped chain
    for (const s of [-1, 1]) { c.fillStyle = 'rgba(8, 6, 4, 0.4)'; c.beginPath(); c.ellipse(BR.head + 8, BR.y + s * 92 + 6, 22, 18, 0, 0, Math.PI * 2); c.fill(); cavRock(c, BR.head, BR.y + s * 90, 17, rnd, '#8a857a'); }
    c.save(); c.translate(110, BR.y - 72); c.rotate(Math.PI / 2 - 0.12);
    c.fillStyle = '#4e3626'; c.strokeStyle = '#1a110a'; c.lineWidth = 2; c.fillRect(-7, 0, 14, 144); c.strokeRect(-7, 0, 14, 144);
    c.fillStyle = '#263238'; c.fillRect(-7, 20, 14, 3); c.fillRect(-7, 118, 14, 3); c.fillStyle = '#8e1b1b'; c.fillRect(7, 52, 16, 40);
    c.restore();
    c.strokeStyle = '#37474f'; c.lineWidth = 2.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(96 + i * 7, BR.y + 66 - i * 2, 2.4, 0, Math.PI * 2); c.stroke(); }

    // --- the gatehouse: the curtain wall, two round towers with slate roofs, the portcullis down ---
    c.fillStyle = 'rgba(8, 6, 4, 0.5)'; c.fillRect(BR.gate - 30, 0, 30, H); // the wall's shadow on the deck end
    c.fillStyle = '#5a554d'; c.fillRect(BR.gate, 0, 100, H); // the wall top
    c.fillStyle = '#3f3b35'; c.fillRect(BR.gate + 26, 0, 48, H); // the wall walk
    for (let y = 0; y < H; y += 30) { c.fillStyle = '#6e685e'; c.fillRect(BR.gate, y, 22, 20); c.strokeStyle = '#2b2824'; c.lineWidth = 1.5; c.strokeRect(BR.gate + 0.5, y + 0.5, 21, 19); } // merlons on the outer edge
    for (let y = 0; y < H; y += 40) { c.strokeStyle = 'rgba(30, 26, 22, 0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(BR.gate + 26, y); c.lineTo(BR.gate + 74, y); c.stroke(); }
    c.fillStyle = '#1a1512'; c.fillRect(BR.gate, BR.y - 80, 20, 160); // the gate's mouth, dark (the wall walk runs on over the passage)
    c.fillStyle = '#4a453e'; c.fillRect(BR.gate + 26, BR.y - 84, 48, 168); c.strokeStyle = '#2b2824'; c.lineWidth = 2; c.strokeRect(BR.gate + 26, BR.y - 84, 48, 168); // the gatehouse roof over it
    c.strokeStyle = '#4a4f55'; c.lineWidth = 3.2; // the portcullis: an iron grid across the passage
    for (let y = BR.y - 76; y <= BR.y + 76; y += 14) { c.beginPath(); c.moveTo(BR.gate + 4, y); c.lineTo(BR.gate + 18, y); c.stroke(); }
    for (const x of [BR.gate + 6, BR.gate + 16]) { c.beginPath(); c.moveTo(x, BR.y - 80); c.lineTo(x, BR.y + 80); c.stroke(); }
    c.fillStyle = '#90a4ae'; for (let y = BR.y - 76; y <= BR.y + 76; y += 14) { c.beginPath(); c.arc(BR.gate + 6, y, 1.6, 0, Math.PI * 2); c.arc(BR.gate + 16, y, 1.6, 0, Math.PI * 2); c.fill(); }
    for (const [tx, ty] of BR_TOWERS) { // round towers: a ring of wall, a conical slate roof in radial courses
        c.fillStyle = 'rgba(8, 6, 4, 0.45)'; c.beginPath(); c.arc(tx - 14, ty + 18, 132, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(tx, ty, 128, 0, Math.PI * 2); c.fillStyle = '#5a554d'; c.fill(); c.strokeStyle = '#2b2824'; c.lineWidth = 3; c.stroke();
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; c.fillStyle = '#6e685e'; c.beginPath(); c.arc(tx + Math.cos(a) * 118, ty + Math.sin(a) * 118, 11, 0, Math.PI * 2); c.fill(); } // merlons round the top
        c.beginPath(); c.arc(tx, ty, 104, 0, Math.PI * 2); c.fillStyle = '#34383f'; c.fill();
        for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; c.strokeStyle = k % 2 ? '#2a2d33' : '#40454d'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(a) * 104, ty + Math.sin(a) * 104); c.stroke(); }
        for (let r = 20; r < 104; r += 16) { c.strokeStyle = 'rgba(15, 16, 20, 0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.stroke(); }
        const lg = c.createLinearGradient(tx - 104, ty - 104, tx + 104, ty + 104); lg.addColorStop(0, 'rgba(255, 220, 180, 0.22)'); lg.addColorStop(0.5, 'rgba(0, 0, 0, 0)'); lg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        c.fillStyle = lg; c.beginPath(); c.arc(tx, ty, 104, 0, Math.PI * 2); c.fill(); // the low sun on one side of the cone
        c.fillStyle = '#20232a'; c.beginPath(); c.arc(tx, ty, 7, 0, Math.PI * 2); c.fill(); // the finial
    }
    // --- evening: the low sun from the west, dusk falling toward the castle ---
    const ev = c.createLinearGradient(0, 0, W, 0); ev.addColorStop(0, 'rgba(255, 160, 80, 0.12)'); ev.addColorStop(0.6, 'rgba(120, 60, 80, 0.06)'); ev.addColorStop(1, 'rgba(40, 30, 80, 0.2)');
    c.fillStyle = ev; c.fillRect(0, 0, W, H);
    brg.ground = g;
}

// His sigil: a ring with a spear through it and a chain wound round the ring (the landing's inlay, his tabard, the banners)
function brSigil(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = '#c9a227'; c.fillStyle = '#c9a227'; c.lineCap = 'round';
    c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(-52, 40); c.lineTo(40, -32); c.stroke(); // the shaft, corner to corner
    c.beginPath(); c.moveTo(38, -42); c.quadraticCurveTo(50, -40, 58, -50); c.quadraticCurveTo(52, -36, 48, -28); c.closePath(); c.fill(); // the blade
    c.lineWidth = 2.2; for (let k = 0; k < 10; k++) { const a = -2.2 + k * 0.32; c.beginPath(); c.ellipse(Math.cos(a) * 52, Math.sin(a) * 52, 5, 3, a + Math.PI / 2, 0, Math.PI * 2); c.stroke(); } // the chain round the ring
    c.restore();
}

// ---------- per-frame gameplay ----------

function updateBridge(dt) {
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius);
    player.wallHit = null; for (const e of enemies) e.wallHit = null;
    if (!brg.triggered && !stageEvent && player.x > BR_TRIGGER && wave === 11 && !isEndlessMode) startValeriusIntro();
    brg.flare = Math.max(0, brg.flare - dt * 0.7); brg.sigil = Math.max(0, brg.sigil - dt * 0.5);
    const v = enemies.find(e => e.type === 'boss_valerius' && !e.dead);
    brg.archOn = !!(v && v.phase === 2 && !v.escaping);
    brg.archK = clamp01(brg.archK + (brg.archOn ? 1 : -1) * dt / 0.8); // the archers step up to the merlons, or back
    if (brg.archOn && brg.archK >= 1 && !stageEvent && (brg.volleyT -= dt) <= 0) { brg.volleyT = BR_VOLLEY.every; brgVolley(v); }
    for (let i = brg.volleys.length - 1; i >= 0; i--) { // arrows coming down on their marks
        const m = brg.volleys[i]; m.t += dt;
        if (!m.hit && m.t >= BR_VOLLEY.warn) {
            m.hit = true;
            if (player.z <= 4 && Math.hypot(player.x - m.x, player.y - m.y) < BR_VOLLEY.r + player.radius) takeDamage(m.dmg); // the marker is the hit: touching it is being hit
            burst(m.x, m.y, -Math.PI / 2, 2.4, 5, { kind: 'debris', color: '#8d8579', size: 2.5, speed: [50, 150], life: 0.4, drag: 4 });
        }
        if (m.t > BR_VOLLEY.warn + 1.6) brg.volleys.splice(i, 1);
    }
}

// The castle's archers: a volley of marks round the hero (one right on them), arrows landing a second later
function brgVolley(v) {
    const ang = Math.random() * Math.PI * 2;
    for (let k = 0; k < BR_VOLLEY.marks; k++) {
        const a = ang + k / (BR_VOLLEY.marks - 1) * Math.PI * 2, d = k ? BR_VOLLEY.spread * (0.5 + 0.5 * Math.random()) : 0;
        let x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
        y = Math.max(BR.y - bridgeHalf(x) + 10, Math.min(BR.y + bridgeHalf(x) - 10, y)); // on the deck
        brg.volleys.push({ x, y, t: 0, hit: false, dmg: v.dmg * BR_VOLLEY.dmg, seed: Math.random() * 10 });
        effects.push({ type: 'slam_warn', x, y, radius: BR_VOLLEY.r, color: '#ff7043', life: BR_VOLLEY.warn, maxLife: BR_VOLLEY.warn });
    }
}

// ---------- the intro: he climbs onto the battlements, leaps over the hero onto the landing, hooks them back and kicks them away ----------

const VI = { horn: 0.3, crouch: 1.0, leap: 1.35, land: 2.5, rise: 3.1, throw: 3.35, hook: 3.7, haul: 4.15, kick: 4.3, flight: 0.9, end: 6.0, peak: 300 };
const VI_WALL = { x: BR.gate + 45, y: BR.y }; // the wall walk above the gate
function startValeriusIntro() {
    brg.triggered = true; showStagePrompt(false);
    const b = pushBoss(activeDungeon.stage3_boss, wave, VI_WALL.x + 40, VI_WALL.y); // main.js
    b.state = 'v_wall'; b.airborne = true; b.liftZ = 34; b.fadeK = 1; b.facingAngle = Math.PI; b.phase = 1;
    activeEnemies++; bossSpawned = true;
    player.dash = null; player.grappleTarget = null; player.charge = null; player.heavy = null;
    stageEvent = { type: 'valerius_intro', t: 0, boss: b, blocking: true, hx: player.x, hy: player.y };
    camera.speed = 7; // stage.js: this scene keeps up with him
}

function updateValeriusIntro(ev, dt) {
    const b = ev.boss, t = ev.t, L = { x: BR.plaza.x, y: BR.y };
    brg.flare = Math.max(0, brg.flare - dt * 0.7); brg.sigil = Math.max(0, brg.sigil - dt * 0.5);
    if (t < VI.leap) { // up onto the merlons out of the dark behind them, a horn from the towers, a crouch
        const k = easeOut(t / 0.7);
        b.x = lerp(VI_WALL.x + 40, VI_WALL.x, k); b.y = VI_WALL.y; b.fadeK = 1 - k; b.liftZ = 34; b.facingAngle = Math.PI;
        b.kneelK = t > VI.crouch ? easeOut((t - VI.crouch) / (VI.leap - VI.crouch)) * 0.7 : 0;
        camera.tx = lerp(ev.hx, VI_WALL.x - 250, easeOut(t / 0.9)); camera.ty = BR.y;
        if (!ev.horn && t > VI.horn) { ev.horn = true; addShake(3); for (const [tx, ty] of BR_TOWERS) effects.push({ type: 'slime_shock', x: tx, y: ty, radius: 260, color: '#c9a227', life: 0.8, maxLife: 0.8 }); }
    }
    if (t >= VI.leap && !ev.pushed) { ev.pushed = true; b.kneelK = 0; valImpact(VI_WALL.x, VI_WALL.y, 3); burst(VI_WALL.x, VI_WALL.y, Math.PI, 2.4, 10, { kind: 'debris', color: '#6e685e', size: 3.5, speed: [100, 260], life: 0.6, drag: 3 }); } // ai.js; chips off the merlons
    if (t >= VI.leap && t < VI.land) { // the leap: high over the hero's head, looming as he rises, his shadow racing along the deck
        const k = (t - VI.leap) / (VI.land - VI.leap), e = k * k * (3 - 2 * k);
        b.x = lerp(VI_WALL.x, L.x, e); b.y = L.y; b.liftZ = 34 * (1 - k) + Math.sin(Math.PI * k) * VI.peak; b.facingAngle = Math.PI;
        camera.tx = b.x; camera.ty = BR.y - b.liftZ * 0.6; // the camera rises with him
    }
    if (t >= VI.land && !ev.landed) { // the landing: the bridge shakes, dust and chips everywhere, every flame leaps, his sigil blazes
        ev.landed = true; b.x = L.x; b.y = L.y; b.liftZ = 0; b.airborne = false; b.kneelK = 1;
        valImpact(L.x, L.y, 14); hitStopTimer = Math.max(hitStopTimer, 0.16);
        for (const [r, col, life] of [[160, '#ffffff', 0.35], [300, '#c9a227', 0.6], [520, '#8d8579', 0.9]]) effects.push({ type: 'slime_shock', x: L.x, y: L.y, radius: r, color: col, life, maxLife: life });
        burst(L.x, L.y, 0, Math.PI * 2, 30, { kind: 'debris', color: '#8d8579', size: 4.5, speed: [160, 520], life: 0.9, drag: 2.5 });
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; spawnParticle({ kind: 'smoke', color: 'rgba(160, 150, 135, 0.55)', x: L.x + Math.cos(a) * 40, y: L.y + Math.sin(a) * 40, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, size: 26, grow: 50, life: 1.3, drag: 2.2, spin: 0, rot: 0 }); } // a ring of dust rolling out
        effects.push({ type: 'scorch', x: L.x, y: L.y, r: 110, life: 8, maxLife: 8 }); // bandits.js
        brg.flare = 1; brg.sigil = 1;
        showBossCard(BOSS_NAMES[b.type] || 'Valerius the Vanguard', 'Lord of the Bastion');
    }
    if (t >= VI.land && t < VI.rise) { b.kneelK = 1 - easeOut((t - VI.land) / (VI.rise - VI.land)); camera.tx = L.x + 150; camera.ty = BR.y; }
    if (t >= VI.land) b.facingAngle = Math.atan2(ev.hy - b.y, ev.hx - b.x);
    if (t >= VI.rise && t < VI.throw) { b.kneelK = 0; b.state = 'hook_prep'; b.prepLen = VI.throw - VI.rise; b.stateTimer = VI.throw - t; } // bandits.js: the arm drawn back
    if (t >= VI.rise && t < VI.kick) { camera.tx = (ev.hx + b.x) / 2; camera.ty = BR.y; } // both in frame for the hook
    if (t >= VI.kick + VI.flight) { camera.tx = player.x; camera.ty = BR.y; }
    // the hook: the spear flies out on its chain and bites
    if (t >= VI.throw && t < VI.hook) { const k = (t - VI.throw) / (VI.hook - VI.throw); b.spear = { x: lerp(b.x, ev.hx, k), y: lerp(b.y, ev.hy, k), a: Math.atan2(ev.hy - b.y, ev.hx - b.x) }; b.state = 'intro_throw'; }
    if (t >= VI.hook && !ev.hooked) { ev.hooked = true; addShake(5); hitStopTimer = Math.max(hitStopTimer, 0.08); burst(player.x, player.y, Math.atan2(b.y - player.y, b.x - player.x), 1.6, 14, { kind: 'spark', color: '#ffcc80', size: 2.4, speed: [120, 320], life: 0.35, drag: 5 }); }
    // the haul: dragged along the deck to his feet
    if (t >= VI.hook && t < VI.haul) {
        const k = brEaseIn((t - VI.hook) / (VI.haul - VI.hook)), tx = b.x + 70, ty = b.y;
        player.x = lerp(ev.hx, tx, k); player.y = lerp(ev.hy, ty, k);
        b.spear = { x: player.x, y: player.y, a: Math.atan2(player.y - b.y, player.x - b.x) };
        if (Math.random() < 0.7) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.5)', x: player.x + jitter(10), y: player.y + jitter(10), vx: jitter(40), vy: jitter(40), size: 11, grow: 22, life: 0.5, drag: 2, spin: 0, rot: 0 });
    }
    if (t >= VI.haul && !ev.hauled) { ev.hauled = true; b.spear = null; b.state = 'v_intro'; ev.kx = player.x; ev.ky = player.y; }
    // the kick: off his boot, back down the bridge in a long arc
    if (t >= VI.kick && !ev.kicked) {
        ev.kicked = true; b.kickAt = fxTime; valImpact(player.x, player.y, 7); hitStopTimer = Math.max(hitStopTimer, 0.12);
        burst(player.x, player.y, Math.PI, 1.4, 16, { kind: 'spark', color: '#fff3e0', size: 2.6, speed: [160, 380], life: 0.35, drag: 5 });
    }
    if (t >= VI.kick && t < VI.kick + VI.flight) {
        const k = (t - VI.kick) / VI.flight, S = STAGE_MAPS.bridge.start;
        player.x = lerp(ev.kx, S.x + 40, easeOut(k)); player.y = lerp(ev.ky, S.y, easeOut(k)); player.z = Math.sin(Math.PI * k) * 140;
        camera.tx = S.x + 40; camera.ty = BR.y; // the camera leads to where they'll land
    }
    if (t >= VI.kick + VI.flight && !ev.down) { // the landing hurts: a quarter of the hero's max HP, never the last of it
        ev.down = true; player.z = 0; valImpact(player.x, player.y, 5);
        const loss = Math.min(player.hp - 1, player.maxHp * 0.25);
        if (loss > 0) { player.hp -= loss; effects.push({ type: 'text', text: '-' + Math.round(loss), x: player.x, y: player.y - 34, color: '#ff5252', life: 1.0, maxLife: 1.0 }); }
        updateHUD();
    }
    if (t >= VI.end - 0.4) { camera.tx = camera.ty = null; camera.speed = 0; }
    if (t >= VI.end) { b.state = 'idle'; b.stateTimer = 0.6; stageEvent = null; }
}

// ---------- the escape: at 0 HP he kneels, speaks, and hauls himself up onto the wall on his chain ----------

const VE = { kneel: 0.5, talk: 0.9, rise: 0.4, throw: 0.35, haul: 0.9, fade: 0.8 };
function startValeriusEscape(b) { // combat.js valeriusLastStand
    b.state = 'escape'; b.spear = null; b.liftZ = 0; b.airborne = false; b.kneelK = 0; b.fadeK = 0;
    for (let i = effects.length - 1; i >= 0; i--) if (String(effects[i].type).startsWith('val_') || effects[i].type === 'slam_warn') effects.splice(i, 1);
    brg.volleys.length = 0; player.dash = null; player.grappleTarget = null; player.charge = null;
    stageEvent = { type: 'valerius_escape', t: 0, t2: 0, boss: b, blocking: true, talked: false };
}

function updateValeriusEscape(ev, dt) {
    const b = ev.boss, W = { x: BR.gate + 40, y: BR.y - 140 }; // the battlement he hooks onto
    camera.tx = lerp(player.x, b.x, 0.7); camera.ty = b.y;
    if (!ev.talked) {
        b.kneelK = easeOut(ev.t / VE.kneel); b.facingAngle = Math.atan2(player.y - b.y, player.x - b.x);
        if (ev.t >= VE.talk && !ev.opened) { ev.opened = true; openDialogue({ name: 'Valerius the Vanguard', title: 'Lord of the Bastion', portrait: 'valerius', lines: VALERIUS_ESCAPE_LINES, onClose: () => { ev.talked = true; } }); } // dialogue.js: the game waits
        return;
    }
    const t = ev.t2 += dt;
    b.kneelK = 1 - easeOut(t / VE.rise);
    const t1 = VE.rise, t2 = t1 + VE.throw, t3 = t2 + VE.haul;
    if (t >= t1 && t < t2) { const k = (t - t1) / VE.throw; b.facingAngle = Math.atan2(W.y - b.y, W.x - b.x); b.spear = { x: lerp(b.x, W.x, k), y: lerp(b.y, W.y, k), a: Math.atan2(W.y - b.y, W.x - b.x) }; b.state = 'escape_throw'; }
    if (t >= t2 && !ev.caught) { ev.caught = true; ev.x0 = b.x; ev.y0 = b.y; b.spear = { x: W.x, y: W.y, a: Math.atan2(W.y - b.y, W.x - b.x) }; addShake(3); burst(W.x, W.y, Math.PI, 1.6, 8, { kind: 'debris', color: '#6e685e', size: 3, speed: [60, 180], life: 0.5, drag: 3 }); }
    if (t >= t2 && t < t3) { // hauled up the chain onto the wall
        const k = brEaseIn((t - t2) / VE.haul);
        b.x = lerp(ev.x0, W.x, k); b.y = lerp(ev.y0, W.y, k); b.liftZ = Math.sin(Math.PI * k) * 120; b.airborne = true;
        b.spear = { x: W.x, y: W.y, a: Math.atan2(W.y - b.y, W.x - b.x) };
    }
    if (t >= t3) { b.spear = null; b.liftZ = 0; b.x = W.x; b.y = W.y; b.facingAngle = Math.PI; b.fadeK = clamp01((t - t3) / VE.fade); } // a last look back, and he drops behind the wall
    if (t >= t3 + VE.fade + 0.4) { // he's gone: what he dropped as he knelt is yours, and the gate grinds open
        b.dead = true; activeEnemies = Math.max(0, activeEnemies - 1); camera.tx = camera.ty = null;
        drops.push({ x: ev.x0 + 20, y: ev.y0, type: 'item', itemData: generateItem(wave + 2), radius: 10, life: 30.0 });
        for (let i = 0; i < 5; i++) drops.push({ x: ev.x0 - 20 + i * 10, y: ev.y0 + i * 10, type: 'gold', val: 20 + wave * 2, radius: 8, life: 30.0 });
        startBridgeGate(b.xp);
    }
}

// ---------- the gate: after his escape the portcullis grinds up and the way into the Bastion is open ----------

function startBridgeGate(xp) { stageEvent = { type: 'bridge_gate', t: 0, blocking: true, rattle: 0, xp }; }

function updateBridgeGate(ev, dt) {
    const t = ev.t, gx = BR.gate + 10;
    camera.tx = gx - 260; camera.ty = BR.y;
    if (t > 0.5 && t < 2.3 && t - ev.rattle > 0.16) { // the chains rattle over the winch, dust off the gatehouse
        ev.rattle = t; addShake(1.4);
        burst(gx, BR.y + jitter(150), Math.PI, 1.4, 3, { kind: 'debris', color: '#6e685e', size: 2.5, speed: [40, 130], life: 0.5, drag: 3 });
    }
    brg.gateK = easeOut(clamp01((t - 0.5) / 1.8)); // drawBridgeGround lifts it
    if (t > 2.3 && !ev.open) {
        ev.open = true; collectAllDrops(); // combat.js
        openStageExit('#ffab40'); showStagePrompt(true, 'The gate is open &middot; enter the Bastion');
    }
    if (t > 2.8) camera.tx = camera.ty = null;
    if (t > 3.1) { stageEvent = null; gainXP(ev.xp || 0); } // combat.js: after the scene, so a level-up doesn't cover the gate going up
}

const VALERIUS_ESCAPE_LINES = [
    'Enough!',
    'You crawled out of the ashes of Cinderholt, cut down my Warchief, gutted my Beastmaster... and still you come after me like a cur.',
    'Curse you, and curse the day I left you breathing in Cinderholt.',
    'This bridge is yours. Enjoy it. Behind those walls the Bastion waits, and so do I. This isn\'t over. Not by half.',
];

// ---------- drawing (world space; the camera transform is already applied) ----------

function drawBridgeGround() {
    const G = brg.ground, W = G.width, H = G.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, Math.ceil(viewW()) + 42), sh = Math.min(H - sy, Math.ceil(viewH()) + 42);
    ctx.drawImage(G, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(200);
    for (const [x, y] of BR_BRAZIERS) if (cavIn(x, y, V)) { // the braziers burn
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 120 * (1 + brg.flare), '#ff8f00', 0.28 + 0.06 * Math.sin(t * 9 + x) + 0.3 * brg.flare); ctx.restore();
        drawFlame(ctx, x, y, 17 * (1 + brg.flare * 0.8), t, x * 0.01, 1); // bandits.js
    }
    if (brg.sigil > 0 && cavIn(BR.plaza.x, BR.y, V)) { // his sigil blazing up in the brass as he lands
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, BR.plaza.x, BR.y, 200, '#ffb300', 0.55 * brg.sigil); ctx.globalAlpha = brg.sigil; brSigil(ctx, BR.plaza.x, BR.y, 1); ctx.restore();
    }
    if (brg.gateK > 0 && cavIn(BR.gate, BR.y, V)) drawBridgePortcullis(brg.gateK);
    if (currentMap.caveOpen && cavIn(BR.gate, BR.y, V)) { // chevrons leading into the gate
        const E = STAGE_MAPS.bridge.exit;
        ctx.save(); ctx.strokeStyle = '#ffd180'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 12; ctx.shadowColor = '#ff9100';
        for (let i = 0; i < 3; i++) {
            const a = Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5, x = E.x - 190 + i * 34 + Math.sin(t * 3) * 6;
            ctx.globalAlpha = 0.3 + 0.7 * a; ctx.beginPath(); ctx.moveTo(x - 10, E.y - 16); ctx.lineTo(x + 6, E.y); ctx.lineTo(x - 10, E.y + 16); ctx.stroke();
        }
        ctx.restore();
    }
    for (const m of brg.volleys) if (m.t >= BR_VOLLEY.warn && cavIn(m.x, m.y, V)) { // arrows standing in the deck where a volley came down, fading
        const a = clamp01(1 - (m.t - BR_VOLLEY.warn - 0.8) / 0.8);
        ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) { const ox = Math.cos(m.seed + k * 1.7) * 18, oy = Math.sin(m.seed + k * 2.3) * 14, x = m.x + ox, y = m.y + oy;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 6); ctx.stroke(); // its shadow
            ctx.strokeStyle = '#3e2a1a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 9); ctx.stroke();
            ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(x - 5, y - 9, 2.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
}

// The portcullis going up (k 0 shut, 1 raised): painted over the cached one, the grid sliding up out of the gate's mouth
// with the torchlit passage showing behind it
function drawBridgePortcullis(k) {
    const c = ctx, x = BR.gate, y0 = BR.y - 80;
    c.save(); c.beginPath(); c.rect(x, y0, 20, 160); c.clip();
    c.fillStyle = '#3a2e24'; c.fillRect(x, y0, 20, 160); // the passage floor
    c.fillStyle = 'rgba(255, 170, 80, 0.12)'; for (let y = y0; y < y0 + 160; y += 16) c.fillRect(x, y + 1, 20, 14); // flagstones in the torchlight
    c.globalCompositeOperation = 'lighter'; glow(c, x + 20, BR.y, 120, '#ff9100', 0.45 * k); c.globalCompositeOperation = 'source-over'; // bandits.js
    const lift = k * 172; // the grid slides up and out
    c.strokeStyle = '#4a4f55'; c.lineWidth = 3.2;
    for (let y = y0 + 4; y <= y0 + 156; y += 14) { c.beginPath(); c.moveTo(x + 4, y - lift); c.lineTo(x + 18, y - lift); c.stroke(); }
    for (const bx of [x + 6, x + 16]) { c.beginPath(); c.moveTo(bx, y0 - lift); c.lineTo(bx, y0 + 160 - lift); c.stroke(); }
    c.fillStyle = '#263238'; for (const bx of [x + 6, x + 16]) { c.beginPath(); c.moveTo(bx - 2.5, y0 + 160 - lift); c.lineTo(bx, y0 + 168 - lift); c.lineTo(bx + 2.5, y0 + 160 - lift); c.fill(); } // the spiked foot
    c.restore();
}

// Above the fighters: the banners on their poles, the castle's archers on the wall, arrows coming down, mist off the gorge
function drawBridgeAbove() {
    const c = ctx, t = fxTime, V = cavView(160);
    for (const [x, s] of BR_BANNERS) {
        const y = BR.y + s * (bridgeHalf(x) + 12.5); if (!cavIn(x, y, V)) continue;
        const L = 74, w = 24, a0 = Math.atan2(WIND_Y * 0.4, WIND_X) + Math.sin(t * 1.3 + x) * 0.12; // streaming downwind
        c.save(); c.translate(x, y); c.rotate(a0);
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(14, 22, L * 0.5, w * 0.35, 0, 0, Math.PI * 2); c.fill(); // its shadow on the deck below
        c.beginPath(); c.moveTo(0, -w / 2);
        for (let k = 1; k <= 8; k++) { const u = k / 8; c.lineTo(u * L, -w / 2 + Math.sin(t * 6 - u * 5 + x) * 5 * u); }
        for (let k = 8; k >= 0; k--) { const u = k / 8; c.lineTo(u * L - (k === 8 ? 8 : 0), w / 2 + Math.sin(t * 6 - u * 5 + x) * 5 * u); }
        c.closePath(); sprFill(c, '#8e1b1b');
        c.strokeStyle = '#c9a227'; c.lineWidth = 1.4; c.beginPath(); c.arc(L * 0.45, Math.sin(t * 6 - 2.2 + x) * 2.2, 6, 0, Math.PI * 2); c.stroke(); // the sigil's ring
        c.restore();
        sprEllipse(c, x, y, 4.5, 4.5, '#3e2a1a'); sprEllipse(c, x, y, 2.2, 2.2, '#c9a227', false); // the pole's gilded cap
    }
    if (brg.archK > 0 && cavIn(BR.gate + 50, BR.y, cavView(300))) { // the castle's archers at the merlons
        if (!brg.archerSpr) brg.archerSpr = [0, 1].map(d => { const E = banditExtent('archer', 0.95), cv = cavCanvas(E * 2, E * 2); stampBandit(null, 0, 0, Math.PI, 0.95, { t: 0, walk: 0, move: 0, trail: { x: 0, y: 0 }, stab: 0, draw: d }, 0, 1, 0.15, 'archer', cv); return cv; });
        const drawn = brg.volleyT < 0.8 ? 1 : 0;
        c.save(); c.globalAlpha = brg.archK;
        for (const y of BR_ARCHERS) { const img = brg.archerSpr[drawn]; c.drawImage(img, BR.gate + 50 - img.width / 2 + (1 - brg.archK) * 14, y - img.height / 2); }
        c.restore();
    }
    for (const m of brg.volleys) { // arrows dropping onto their marks in the last moments
        const k = (m.t - (BR_VOLLEY.warn - 0.3)) / 0.3; if (k < 0 || k >= 1) continue;
        c.save(); c.strokeStyle = '#3e2a1a'; c.lineWidth = 2.2; c.lineCap = 'round';
        for (let j = 0; j < 4; j++) { const ox = Math.cos(m.seed + j * 1.7) * 18, oy = Math.sin(m.seed + j * 2.3) * 14, h = (1 - k) * 160, x = m.x + ox + h * 0.5, y = m.y + oy - h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y - 12); c.stroke(); }
        c.restore();
    }
    // mist rising out of the gorge along both sides of the bridge
    c.save(); c.globalCompositeOperation = 'screen';
    for (let k = 0; k < 14; k++) {
        const x = ((k * 397 + t * 18) % 4600) - 100, s = k % 2 ? 1 : -1, y = BR.y + s * (bridgeHalf(Math.max(0, Math.min(BR.gate, x))) + 120 + (k % 3) * 40);
        if (cavIn(x, y, V)) glow(c, x, y, 150 + (k % 4) * 30, '#9fb0bf', 0.16);
    }
    c.restore();
}
