// ==========================================
// sidequests_fx.js - The sidequests' art (BASE.md step 5): the friends' !/? badges, the quest items, the wares, the ambush
// ==========================================
// sidequests.js runs the quests and calls in here to draw them. Everything drawn often is baked once (qsBake: a canvas at
// QS_S times, origin at its centre) and stamped; the live parts are glows (bandits.js glow), a slow ray burst, a ring and
// a twinkle, all on fxTime so they pause with the game.
//   drawQuestGround  - main.js, with the friends: the wares lying about
//   drawQuestAbove   - main.js, above the canopies: the badges over the friends, the straggler's shout
//   drawQuestScreen  - main.js, screen space: chips at the view's edge pointing to a friend waiting with a '?', the fall in Cinderholt
//   drawQuestItem    - caches.js drawCache, for a cache with pod.quest: the strongbox, the hammer, the herb chest, the stash
// Icons (qsIcon / qsIconImg) are the same sprites, for the pickup lines (caches.js MAT_FX) and the Tab sheet.

const QS_S = 3, QFX = {}, QFX_URL = {};
function qsBake(key, w, h, fn) {
    if (QFX[key]) return QFX[key];
    const cv = cavCanvas(w * QS_S, h * QS_S), c = cv.getContext('2d'); // map_cavern.js
    c.scale(QS_S, QS_S); c.translate(w / 2, h / 2); c.lineJoin = 'round'; c.lineCap = 'round';
    fn(c, clrRng(key.length * 131 + key.charCodeAt(0))); // map_clearing.js
    cv.hw = w / 2; cv.hh = h / 2;
    return (QFX[key] = cv);
}
const qsStamp = (c, cv, x, y, s = 1) => c.drawImage(cv, x - cv.hw * s, y - cv.hh * s, cv.hw * 2 * s, cv.hh * 2 * s);
const qsShadow = (c, x, y, rx, ry, a = 0.4) => { c.save(); c.filter = 'blur(2px)'; c.fillStyle = `rgba(6, 4, 2, ${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore(); };
const QS_OUT = '#1d130b';

// A four-point star, the twinkle the caches have
function qsStar(c, x, y, r, a, rot = 0.3) {
    if (a <= 0.01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, x, y, r * 1.6 + 2, '#fff1c8', 0.55 * a); // bandits.js
    c.translate(x, y); c.rotate(rot); c.fillStyle = `rgba(255, 250, 230, ${0.95 * a})`;
    c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r); c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r); c.fill();
    c.restore();
}

// ---------- the badges over the friends ----------
const QS_BADGE = {
    '!': { plate: ['#fff4c4', '#f0c24e', '#b07a1c'], glyph: '#3a2206', glow: '#ffd76b' }, // a quest to offer: gold
    '?': { plate: ['#ffffff', '#b9dcf6', '#5f8db3'], glyph: '#13283f', glow: '#9fd4ff' }, // something to hand in or deliver: silver-blue
};
function qsBadge(m) { // a map pin: a bright plate, the glyph struck dark into it, its point down to the friend's head
    return qsBake('badge' + m, 38, 46, c => {
        const P = QS_BADGE[m];
        const pin = () => { c.beginPath(); c.arc(0, -6, 14, Math.PI * 0.66, Math.PI * 2.34); c.lineTo(0, 17); c.closePath(); };
        pin(); c.strokeStyle = 'rgba(8, 5, 3, 0.95)'; c.lineWidth = 5; c.stroke(); // the dark outline that reads on grass and floorboards alike
        const g = c.createRadialGradient(-4, -11, 1, 0, -4, 20); g.addColorStop(0, P.plate[0]); g.addColorStop(0.45, P.plate[1]); g.addColorStop(1, P.plate[2]);
        pin(); c.fillStyle = g; c.fill();
        pin(); c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1; c.stroke(); // its bright edge
        c.strokeStyle = 'rgba(0, 0, 0, 0.25)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -6, 10.5, Math.PI * 0.1, Math.PI * 0.9); c.stroke(); // a rim pressed into the plate
        c.font = 'bold 22px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.fillText(m, 0.6, -4.2); // struck in: lit on its lower edge
        c.fillStyle = P.glyph; c.fillText(m, 0, -5);
    });
}

function qsChip(m) { // the same plate, round, for the view's edge
    return qsBake('chip' + m, 34, 34, c => {
        const P = QS_BADGE[m];
        c.beginPath(); c.arc(0, 0, 13.5, 0, Math.PI * 2); c.strokeStyle = 'rgba(8, 5, 3, 0.95)'; c.lineWidth = 5; c.stroke();
        const g = c.createRadialGradient(-4, -5, 1, 0, 1, 17); g.addColorStop(0, P.plate[0]); g.addColorStop(0.45, P.plate[1]); g.addColorStop(1, P.plate[2]);
        c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1; c.stroke();
        c.font = 'bold 20px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.fillText(m, 0.6, 1.8); c.fillStyle = P.glyph; c.fillText(m, 0, 1);
    });
}

function drawFriendBadge(c, x, y, m, seed) {
    const P = QS_BADGE[m], bob = Math.sin(fxTime * 2.6 + seed) * 3, k = 0.5 + 0.5 * Math.sin(fxTime * 3.2 + seed);
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y - 6 + bob, 40, P.glow, 0.24 + 0.12 * k); c.restore();
    qsStamp(c, qsBadge(m), x, y + bob, 1.05 + 0.03 * k);
}

// ---------- the quest items (caches with pod.quest) ----------
const QS_ITEM_ART = {
    strongbox(c) { // iron, brass corners, a dent in the lid, his mark
        qsShadow(c, 4, 5, 21, 15);
        c.rotate(-0.12);
        const W = 18, H = 13;
        const b = c.createLinearGradient(-W, -H, W, H); b.addColorStop(0, '#6b747c'); b.addColorStop(1, '#3c4248');
        c.fillStyle = b; c.strokeStyle = '#121518'; c.lineWidth = 1.6; c.beginPath(); c.roundRect(-W, -H, W * 2, H * 2, 2.5); c.fill(); c.stroke();
        c.fillStyle = '#58616a'; c.fillRect(-W + 2.5, -H + 2.5, W * 2 - 5, H * 2 - 5); // the lid's plate
        c.fillStyle = 'rgba(230, 240, 248, 0.22)'; c.fillRect(-W + 2.5, -H + 2.5, W * 2 - 5, 1.2); c.fillRect(-W + 2.5, -H + 2.5, 1.2, H * 2 - 5);
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.fillRect(-W + 2.5, H - 3.7, W * 2 - 5, 1.2);
        for (const x of [-10, 10]) { // iron straps, riveted
            c.fillStyle = '#353b40'; c.fillRect(x - 2.2, -H, 4.4, H * 2); c.fillStyle = '#7d878f'; c.fillRect(x - 2.2, -H, 1, H * 2);
            c.fillStyle = '#c3cbd1'; for (const y of [-9, -3, 3, 9]) { c.beginPath(); c.arc(x, y, 0.8, 0, Math.PI * 2); c.fill(); }
        }
        c.save(); c.translate(5.5, -5.5); c.rotate(0.5); // the dent: a dark hollow, lit on its far lip
        c.fillStyle = 'rgba(14, 16, 18, 0.45)'; c.beginPath(); c.ellipse(0, 0, 4.2, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(235, 242, 248, 0.45)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 4.2, 2.6, 0, 0.2, 1.9); c.stroke(); c.restore();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // brass corner caps
            c.beginPath(); c.moveTo(sx * W, sy * H); c.lineTo(sx * (W - 8), sy * H); c.lineTo(sx * W, sy * (H - 8)); c.closePath();
            c.fillStyle = '#c99a3c'; c.fill(); c.strokeStyle = '#4e3410'; c.lineWidth = 0.9; c.stroke();
            c.fillStyle = '#f4d98c'; c.beginPath(); c.arc(sx * (W - 2.6), sy * (H - 2.6), 0.9, 0, Math.PI * 2); c.fill();
        }
        const m = c.createRadialGradient(-1, -1, 0.5, 0, 0, 5); m.addColorStop(0, '#f6dd94'); m.addColorStop(1, '#a87a24'); // his mark: a brass boss stamped with a pair of scales
        c.fillStyle = m; c.strokeStyle = '#4e3410'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 4.6, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = '#5a3c0e'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -3); c.lineTo(0, 2.6); c.moveTo(-2.8, -1.8); c.lineTo(2.8, -1.8); c.moveTo(-1.8, 2.6); c.lineTo(1.8, 2.6); c.stroke();
        c.beginPath(); c.arc(-2.8, -0.6, 1.2, 0, Math.PI); c.arc(2.8, -0.6, 1.2, 0, Math.PI); c.stroke();
        c.fillStyle = '#c99a3c'; c.strokeStyle = '#4e3410'; c.lineWidth = 0.9; c.beginPath(); c.roundRect(-3, H - 1.5, 6, 5, 1); c.fill(); c.stroke(); // the hasp and its lock
        c.fillStyle = '#2a1c08'; c.beginPath(); c.arc(0, H + 0.8, 0.8, 0, Math.PI * 2); c.fill(); c.fillRect(-0.35, H + 0.8, 0.7, 1.6);
    },
    hammer(c) { // his father's sledge lying in the dirt: a hickory haft, a lion stamped on the cheek
        c.rotate(-0.62);
        c.save(); c.filter = 'blur(2px)'; c.fillStyle = 'rgba(6, 4, 2, 0.4)'; c.beginPath(); c.roundRect(-24, 0, 42, 8, 4); c.roundRect(14, -8, 14, 24, 3); c.fill(); c.restore(); // the shadow, down and right
        const h = c.createLinearGradient(0, -2.6, 0, 2.6); h.addColorStop(0, '#e3bd84'); h.addColorStop(0.5, '#c4955a'); h.addColorStop(1, '#8e6434');
        c.fillStyle = h; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.roundRect(-26, -2.6, 44, 5.2, 2.4); c.fill(); c.stroke(); // the haft
        c.strokeStyle = 'rgba(92, 58, 24, 0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-12, -0.6); c.quadraticCurveTo(0, -1.4, 14, -0.4); c.moveTo(-10, 1.1); c.quadraticCurveTo(2, 0.4, 13, 1.3); c.stroke(); // grain
        c.fillStyle = '#5a3a22'; c.fillRect(-26, -2.8, 11, 5.6); // the grip's leather wrap
        c.strokeStyle = '#2e1c0e'; c.lineWidth = 0.7; c.beginPath(); for (let x = -25; x < -15; x += 2) { c.moveTo(x, -2.8); c.lineTo(x + 1.6, 2.8); } c.stroke();
        c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.strokeRect(-26, -2.8, 11, 5.6);
        const ir = c.createLinearGradient(14, 0, 26, 0); ir.addColorStop(0, '#9aa4ac'); ir.addColorStop(0.45, '#6c757d'); ir.addColorStop(1, '#4a5258');
        c.fillStyle = ir; c.strokeStyle = '#121518'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(14, -12, 12, 24, 2); c.fill(); c.stroke(); // the head, across the haft
        c.fillStyle = '#b9c2c8'; c.fillRect(14.8, -12, 10.4, 2.2); c.fillRect(14.8, 9.8, 10.4, 2.2); // the striking faces, bright from use
        c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.fillRect(15, -9.5, 1.2, 19);
        c.fillStyle = '#8a5c2e'; c.fillRect(18.2, -2, 3.6, 4); c.fillStyle = '#c7ced3'; c.fillRect(19.5, -2, 1, 4); // the haft's end through the eye, its steel wedge
        c.save(); c.translate(20, -6.4); // the lion on the cheek: a worn roundel, a mane round a face
        c.strokeStyle = 'rgba(30, 34, 38, 0.75)'; c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, 2.9, 0, Math.PI * 2); c.stroke();
        c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; c.moveTo(Math.cos(a) * 1.3, Math.sin(a) * 1.3); c.lineTo(Math.cos(a) * 2.3, Math.sin(a) * 2.3); } c.stroke();
        c.fillStyle = 'rgba(30, 34, 38, 0.7)'; c.beginPath(); c.arc(0, 0, 0.8, 0, Math.PI * 2); c.fill(); c.restore();
        c.save(); c.translate(20, 6.4); c.strokeStyle = 'rgba(30, 34, 38, 0.4)'; c.lineWidth = 0.5; c.beginPath(); c.arc(0, 0, 2.6, 0, Math.PI * 2); c.stroke(); c.restore(); // and its twin, half rubbed off
    },
    herbs(c, rnd) { // a wooden chest strapped shut, a drawer pulled out, herbs poking from under the lid
        qsShadow(c, 4, 5, 20, 15);
        c.rotate(0.1);
        const sprig = (x, y, a, len, col) => { // a stem with paired leaves
            c.save(); c.translate(x, y); c.rotate(a);
            c.strokeStyle = '#3f6a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke();
            for (let i = 1; i <= 3; i++) { const lx = len * i / 3.4; for (const s of [-1, 1]) { c.fillStyle = col; c.strokeStyle = '#26401a'; c.lineWidth = 0.5; c.beginPath(); c.ellipse(lx, s * 1.9, 2.4, 1.1, s * 0.6, 0, Math.PI * 2); c.fill(); c.stroke(); } }
            c.restore();
        };
        sprig(-12, -10, -2.3, 11, '#7cb24f'); sprig(-6, -12, -1.9, 9, '#5f9a3e'); sprig(10, -11, -0.95, 10, '#8cbf5c'); // under the chest: they poke out past its rim
        c.fillStyle = '#b07cc6'; for (const [x, y] of [[2, -17], [4, -18.5], [3, -15.5], [0.5, -16.5]]) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); } // mireflower
        c.strokeStyle = '#3f6a2a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(1, -11); c.lineTo(2.6, -16); c.stroke();
        c.strokeStyle = '#d9793a'; c.lineWidth = 2; c.beginPath(); c.moveTo(16, 2); c.quadraticCurveTo(20, 0, 22, 4); c.stroke(); // ember-root
        c.strokeStyle = '#8a3f14'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(21.5, 3.5); c.lineTo(23.5, 6); c.moveTo(19, 1.4); c.lineTo(20, -1); c.stroke();
        const W = 17, H = 12;
        c.fillStyle = '#7a4c28'; c.strokeStyle = QS_OUT; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-W, -H, W * 2, H * 2, 2); c.fill(); c.stroke(); // the lid
        for (let i = 0; i < 3; i++) { const y = -H + 1.5 + i * 7.3; c.fillStyle = sprShade('#9a6a3c', (rnd() - 0.5) * 0.2); c.fillRect(-W + 1.5, y, W * 2 - 3, 6.3); c.fillStyle = 'rgba(255, 230, 190, 0.2)'; c.fillRect(-W + 1.5, y, W * 2 - 3, 1); } // planks
        c.strokeStyle = 'rgba(60, 34, 14, 0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-W + 3, -4); c.quadraticCurveTo(0, -3.4, W - 3, -4.4); c.moveTo(-W + 3, 3.4); c.quadraticCurveTo(0, 4, W - 3, 3); c.stroke();
        for (const x of [-9, 9]) { // leather straps, brass buckles
            c.fillStyle = '#4e2f19'; c.fillRect(x - 2.4, -H - 0.5, 4.8, H * 2 + 1); c.fillStyle = 'rgba(255, 210, 160, 0.15)'; c.fillRect(x - 2.4, -H, 1, H * 2);
            c.strokeStyle = '#d6a64a'; c.lineWidth = 1.1; c.strokeRect(x - 3, 2.5, 6, 4.4); c.fillStyle = '#e9c46a'; c.fillRect(x - 0.4, 2.2, 0.9, 5);
        }
        c.fillStyle = '#c99a3c'; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.fillRect(sx > 0 ? W - 3.5 : -W, sy > 0 ? H - 3.5 : -H, 3.5, 3.5); // brass corners
        c.fillStyle = '#5e3a1e'; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.rect(-8, H, 16, 6); c.fill(); c.stroke(); // a drawer pulled out at the front
        c.fillStyle = '#2a1a0c'; c.fillRect(-6.8, H + 0.8, 13.6, 3.8);
        for (const [x, col] of [[-5, '#7cb24f'], [-2.2, '#b07cc6'], [0.8, '#d9793a'], [3.6, '#9cc36a'], [5.6, '#e0d38a']]) { c.fillStyle = col; c.beginPath(); c.arc(x, H + 2.6, 1.3, 0, Math.PI * 2); c.fill(); } // dried herbs in it
        c.fillStyle = '#e9c46a'; c.beginPath(); c.arc(0, H + 6.6, 1.1, 0, Math.PI * 2); c.fill(); // the knob
        c.fillStyle = '#efe2c0'; c.strokeStyle = '#6b5530'; c.lineWidth = 0.6; c.beginPath(); c.roundRect(-4, -8.2, 8, 5, 1); c.fill(); c.stroke(); // a label, in her hand
        c.strokeStyle = 'rgba(70, 50, 30, 0.7)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-2.6, -6.4); c.lineTo(2.4, -6.4); c.moveTo(-2.6, -4.8); c.lineTo(1.2, -4.8); c.stroke();
    },
    ruins(c, rnd) { // the straggler's hoard: a battered chest flung open, a sack, coin spilled about
        qsShadow(c, 3, 6, 23, 15);
        const coin = (x, y, r = 2.2) => { c.fillStyle = '#7a5410'; c.beginPath(); c.arc(x + 0.4, y + 0.5, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f1c34a'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff1b8'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, Math.PI * 2); c.fill(); };
        c.save(); c.translate(-15, 7); c.rotate(0.4); // the sack, slumped beside it
        const sg = c.createRadialGradient(-2, -2, 1, 0, 0, 9); sg.addColorStop(0, '#d8c08e'); sg.addColorStop(1, '#8a7046');
        c.fillStyle = sg; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 9, 7.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(80, 58, 28, 0.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(0, 0, 6, -3); c.moveTo(-5, 3); c.quadraticCurveTo(0, 4, 6, 2); c.stroke();
        c.fillStyle = '#b39867'; c.beginPath(); c.moveTo(-8, -3); c.lineTo(-13, -5); c.lineTo(-12, 0); c.lineTo(-13, 4); c.lineTo(-8, 3); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#5a3a1e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, -3.2); c.lineTo(-8, 3.2); c.stroke(); c.restore();
        c.save(); c.translate(4, -1); c.rotate(0.22);
        const W = 14, H = 9;
        c.fillStyle = '#3a2414'; c.strokeStyle = QS_OUT; c.lineWidth = 1.3; c.beginPath(); c.rect(-W, -H - 8, W * 2, 8); c.fill(); c.stroke(); // the lid thrown back, its underside
        c.fillStyle = '#4f3320'; c.fillRect(-W + 1.5, -H - 6.5, W * 2 - 3, 5);
        c.fillStyle = '#5e3d24'; c.beginPath(); c.rect(-W, -H, W * 2, H * 2); c.fill(); c.stroke(); // the box
        c.fillStyle = '#1a0f07'; c.fillRect(-W + 2.5, -H + 2.5, W * 2 - 5, H * 2 - 5);
        for (let i = 0; i < 14; i++) coin(-W + 5 + rnd() * (W * 2 - 10), -H + 5 + rnd() * (H * 2 - 10), 1.9 + rnd() * 0.6); // heaped coin
        c.fillStyle = '#a8a8b0'; c.fillRect(-3, -2, 7, 2); c.fillStyle = '#d9d9e0'; c.fillRect(-3, -2, 7, 0.7); // a knife among them
        c.fillStyle = '#4a545c'; for (const x of [-W + 4, W - 6]) { c.fillRect(x, -H - 8, 2, 8); c.fillRect(x, -H, 2, 2.5); c.fillRect(x, H - 2.5, 2, 2.5); } // iron bands
        c.strokeStyle = 'rgba(20, 10, 4, 0.8)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(W - 0.5, -2); c.lineTo(W - 4, 1); c.lineTo(W - 1, 4); c.stroke(); // a split board, kicked in
        c.restore();
        for (const [x, y] of [[18, 7], [14, 11], [21, 12], [8, 13], [-3, 15], [24, 4]]) coin(x, y); // spilled out to the south-east
    },
};
const QS_ITEM_SIZE = { strongbox: 50, hammer: 66, herbs: 56, ruins: 64 };
const QS_ITEM_DRAW = 1.3; // drawn larger than painted, like the caches: the quest target should never be walked past
const qsItemSprite = q => qsBake('item_' + q, QS_ITEM_SIZE[q] || 56, QS_ITEM_SIZE[q] || 56, QS_ITEM_ART[q]);
const QS_ITEM_GLINT = { strongbox: [-15, -10], hammer: [13, -15], herbs: [2, -16], ruins: [6, -2] }; // where the twinkle sits: a brass corner, the sledge's face, the mireflower, the coin
const QS_STASH_COINS = [[18, 7], [14, 11], [21, 12], [-3, 15]];

function qsRays() { // the slow sunburst under a quest item, baked once
    return qsBake('rays', 140, 140, c => {
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 70); g.addColorStop(0, 'rgba(255, 228, 150, 0.9)'); g.addColorStop(0.35, 'rgba(255, 214, 120, 0.35)'); g.addColorStop(1, 'rgba(255, 214, 120, 0)');
        c.fillStyle = g;
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, w = i % 2 ? 0.07 : 0.12, L = i % 2 ? 52 : 70; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L); c.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L); c.closePath(); c.fill(); }
    });
}

// caches.js drawCache: a quest item where it lies, with more light than any cache so it's never walked past
function drawQuestItem(e) {
    const c = ctx, q = e.pod.quest, x = e.x, y = e.y, t = fxTime, sd = e.seed || 0, k = 0.5 + 0.5 * Math.sin(t * 2.4 + sd);
    const age = t - (e.bornAt || 0), pop = age < 0.35 ? easeOutBack(Math.max(0, age) / 0.35) : 1; // it pops in (the stash after the fight)
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, x, y, 70, '#ffc65a', (0.2 + 0.08 * k) * pop);
    c.translate(x, y); c.globalAlpha = (0.2 + 0.12 * k) * pop; // two ray bursts turning against each other
    c.save(); c.rotate(t * 0.25 + sd); qsStamp(c, qsRays(), 0, 0, 0.9 + 0.1 * k); c.restore();
    c.rotate(-t * 0.18 - sd + 0.26); c.globalAlpha *= 0.6; qsStamp(c, qsRays(), 0, 0, 0.7); c.restore();
    const rp = ((t + sd) % 1.9) / 1.9; // a ring breathing out every couple of seconds
    c.save(); c.strokeStyle = `rgba(255, 224, 140, ${0.55 * (1 - rp) * pop})`; c.lineWidth = 2 * (1 - rp) + 0.5; c.beginPath(); c.arc(x, y, 18 + rp * 34, 0, Math.PI * 2); c.stroke(); c.restore();
    qsStamp(c, qsItemSprite(q), x, y, pop * QS_ITEM_DRAW);
    for (let i = 0; i < 4; i++) { // motes drifting off it
        const ph = (t * 0.45 + i / 4 + sd) % 1, a = sd * 3 + i * 1.7;
        const mx = x + Math.cos(a + ph * 1.5) * (10 + ph * 18), my = y + Math.sin(a + ph * 1.5) * (8 + ph * 14) - ph * 10;
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, mx, my, 5, '#ffe9a8', 0.8 * Math.sin(Math.PI * ph) * pop); c.restore();
    }
    const [gx, gy] = (QS_ITEM_GLINT[q] || [0, 0]).map(v => v * QS_ITEM_DRAW), ph = ((t + sd * 1.7) % 2.2) / 0.5; // the twinkle, twice as often as a cache's
    if (ph < 1) qsStar(c, x + gx, y + gy, 9 * Math.sin(Math.PI * ph), Math.sin(Math.PI * ph), 0.3 + ph * 0.6);
    if (q === 'ruins') QS_STASH_COINS.forEach(([cx, cy], i) => { const p2 = ((t * 0.9 + i * 0.37 + sd) % 1.6) / 0.4; if (p2 < 1) qsStar(c, x + cx * QS_ITEM_DRAW, y + cy * QS_ITEM_DRAW, 5 * Math.sin(Math.PI * p2), Math.sin(Math.PI * p2)); }); // coin glinting
}
const easeOutBack = u => { const s = 1.7; u -= 1; return 1 + u * u * ((s + 1) * u + s); };

// Picked up (caches.js cacheBroken for pod.quest): a gold flash instead of splinters, the item flies to the hero
function questItemFx(e, q) {
    const x = e.x, y = e.y;
    addShake(1.5);
    spawnParticle({ kind: 'ring', color: '#ffe39a', x, y, vx: 0, vy: 0, size: 10, grow: 230, life: 0.32, drag: 0, spin: 0, rot: 0 });
    spawnParticle({ kind: 'ring', color: '#fff3d6', x, y, vx: 0, vy: 0, size: 6, grow: 120, life: 0.22, drag: 0, spin: 0, rot: 0 });
    burst(x, y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#ffd76b', size: 2.2, speed: [140, 360], life: 0.3, drag: 5 });
    burst(x, y, 0, Math.PI * 2, 8, { kind: 'dot', color: '#fff3d6', size: 2.6, speed: [40, 140], life: 0.5, drag: 3 });
    if (q === 'ruins') { // the lid flies, coin jumps
        burst(x, y, 0, Math.PI * 2, 6, { kind: 'debris', color: '#5e3d24', size: 5, speed: [100, 260], life: 0.7, drag: 3.2 });
        burst(x, y, -Math.PI / 2, Math.PI * 1.4, 10, { kind: 'dot', color: '#f1c34a', size: 2.8, speed: [120, 280], life: 0.6, drag: 3 });
    }
    dustPuff(x, y, 0, Math.PI * 2, 4, '#a08a6a'); // skillfx_space.js
    MAT_FX.push({ chip: true, icon: qsIcon('item_' + q), x, y, sx: x, sy: y - 26, t0: fxTime, rot: 0, big: true }); // caches.js: it hops up, then into the pack
}

// ---------- the wares ----------
const QS_WARE_ART = [
    c => { // a bolt of cloth: a roll of red with a gold stripe, its end showing the layers, a flap loose
        qsShadow(c, 3, 4, 15, 8); c.rotate(-0.35);
        c.fillStyle = '#b8453a'; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.roundRect(-13, -6, 24, 12, 3); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 220, 200, 0.22)'; c.fillRect(-12, -5, 22, 2); c.fillStyle = 'rgba(40, 6, 4, 0.25)'; c.fillRect(-12, 2.6, 22, 2.4);
        c.fillStyle = '#e8c36a'; c.fillRect(-13, -1.2, 24, 2.4);
        c.fillStyle = '#c95a4c'; c.beginPath(); c.ellipse(11, 0, 3.4, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke(); // the roll's end
        c.strokeStyle = '#6a1e16'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(11, 0, 2.2, 4, 0, 0, Math.PI * 2); c.ellipse(11, 0, 1, 1.8, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#b8453a'; c.strokeStyle = QS_OUT; c.lineWidth = 1; c.beginPath(); c.moveTo(-13, 6); c.quadraticCurveTo(-9, 11, -2, 9.5); c.lineTo(-4, 6); c.closePath(); c.fill(); c.stroke(); // the loose flap
    },
    c => { // a spice box, lid off: four compartments of colour
        qsShadow(c, 3, 4, 13, 11); c.rotate(0.2);
        c.fillStyle = '#7a5130'; c.strokeStyle = QS_OUT; c.lineWidth = 1.1; c.beginPath(); c.rect(-15, -9, 7, 18); c.fill(); c.stroke(); // the lid, set aside
        c.fillStyle = '#e8c36a'; c.fillRect(-12.5, -6, 2, 12);
        c.fillStyle = '#8a5c34'; c.beginPath(); c.rect(-6, -9, 18, 18); c.fill(); c.stroke();
        const cols = ['#d9822b', '#e8c547', '#7a4a2a', '#6f8c3e'];
        for (let i = 0; i < 4; i++) { const cx = -1.5 + (i % 2) * 9, cy = -4.5 + ((i / 2) | 0) * 9; c.fillStyle = '#2a1a0c'; c.fillRect(cx - 3.6, cy - 3.6, 7.2, 7.2); const g = c.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 4); g.addColorStop(0, sprShade(cols[i], 0.35)); g.addColorStop(1, cols[i]); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 3.1, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = '#5a3a1e'; c.lineWidth = 1; c.beginPath(); c.moveTo(3, -9); c.lineTo(3, 9); c.moveTo(-6, 0); c.lineTo(12, 0); c.stroke();
    },
    c => { // an oil lamp of brass: the body, the spout, the handle's loop
        qsShadow(c, 3, 4, 13, 8); c.rotate(-0.25);
        c.strokeStyle = QS_OUT; c.lineWidth = 3.4; c.beginPath(); c.arc(-11, 0, 4, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); c.strokeStyle = '#c9952e'; c.lineWidth = 1.6; c.stroke(); // the handle
        c.fillStyle = '#b8862a'; c.strokeStyle = QS_OUT; c.lineWidth = 1.1; c.beginPath(); c.moveTo(4, -3.5); c.lineTo(14, -1.4); c.quadraticCurveTo(16, 0, 14, 1.4); c.lineTo(4, 3.5); c.closePath(); c.fill(); c.stroke(); // the spout
        c.fillStyle = '#2a1a08'; c.beginPath(); c.arc(14, 0, 1, 0, Math.PI * 2); c.fill(); // the wick's mouth
        const g = c.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.4, '#e2b04a'); g.addColorStop(1, '#8e6018');
        c.fillStyle = g; c.beginPath(); c.ellipse(-1, 0, 9, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(80, 50, 10, 0.6)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(-1, 0, 6, 4.5, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#3a2408'; c.beginPath(); c.arc(-1, 0, 1.8, 0, Math.PI * 2); c.fill(); // the filling hole
    },
    c => { // a small sack of grain, tied, a little spilled
        qsShadow(c, 3, 4, 13, 10);
        c.fillStyle = '#e6c46a'; for (const [x, y] of [[-12, 8], [-14, 5], [-10, 10.5], [-15.5, 9]]) { c.beginPath(); c.ellipse(x, y, 1.2, 0.7, 0.5, 0, Math.PI * 2); c.fill(); }
        c.rotate(-0.5);
        const g = c.createRadialGradient(0, -3, 1, 2, 0, 12); g.addColorStop(0, '#e2cc9c'); g.addColorStop(0.6, '#b49a68'); g.addColorStop(1, '#7c6542');
        c.fillStyle = g; c.strokeStyle = QS_OUT; c.lineWidth = 1.1; c.beginPath(); c.ellipse(2, 0, 10, 8.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#c4aa78'; c.beginPath(); c.moveTo(-7, -3); c.lineTo(-13, -5.5); c.lineTo(-12, 0); c.lineTo(-13, 5.5); c.lineTo(-7, 3); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#6b4a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-7.5, -3.4); c.lineTo(-7.5, 3.4); c.stroke();
        c.strokeStyle = 'rgba(70, 50, 24, 0.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4, -3); c.quadraticCurveTo(3, -1.5, 9, -4); c.moveTo(-4, 3); c.quadraticCurveTo(3, 2, 9, 4); c.stroke();
        c.fillStyle = 'rgba(30, 60, 110, 0.55)'; c.beginPath(); c.arc(4, 0, 2.6, 0, Math.PI * 2); c.fill(); // a miller's blue mark
    },
    c => { // a rolled rug: deep purple, gold diamonds, fringed ends
        qsShadow(c, 3, 4, 18, 8); c.rotate(0.3);
        c.strokeStyle = '#e0cfa0'; c.lineWidth = 0.7; c.beginPath(); for (let y = -4.5; y <= 4.5; y += 1.5) { c.moveTo(-15, y); c.lineTo(-18, y); c.moveTo(15, y); c.lineTo(18, y); } c.stroke(); // the fringe
        c.fillStyle = '#5a2450'; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.roundRect(-15, -5.5, 30, 11, 4); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 220, 240, 0.18)'; c.fillRect(-14, -4.6, 28, 2); c.fillStyle = 'rgba(20, 0, 16, 0.3)'; c.fillRect(-14, 2.4, 28, 2.2);
        c.fillStyle = '#e8c36a'; for (let x = -10; x <= 10; x += 5) { c.beginPath(); c.moveTo(x, -3.2); c.lineTo(x + 2, 0); c.lineTo(x, 3.2); c.lineTo(x - 2, 0); c.closePath(); c.fill(); }
        c.strokeStyle = '#9c3a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-15, -3.6); c.lineTo(15, -3.6); c.moveTo(-15, 3.6); c.lineTo(15, 3.6); c.stroke();
    },
    c => { // a small crate, cross-braced, his stencil on it
        qsShadow(c, 3, 4, 13, 12); c.rotate(-0.18);
        c.fillStyle = '#9a6a3c'; c.strokeStyle = QS_OUT; c.lineWidth = 1.3; c.beginPath(); c.rect(-10, -10, 20, 20); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 230, 190, 0.2)'; c.fillRect(-9.5, -9.5, 19, 1.2);
        c.strokeStyle = '#6a4423'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-8.5, -8.5); c.lineTo(8.5, 8.5); c.moveTo(8.5, -8.5); c.lineTo(-8.5, 8.5); c.stroke();
        c.strokeStyle = '#4a2e16'; c.lineWidth = 1.2; c.strokeRect(-8.5, -8.5, 17, 17);
        c.fillStyle = 'rgba(120, 30, 20, 0.7)'; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#9a6a3c'; c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); c.fill(); // his mark
    },
];
const qsWareSprite = i => qsBake('ware' + (i % 6), 40, 40, QS_WARE_ART[i % 6]);

function drawQuestWares(c) {
    for (const w of sqs.wares) {
        const t = fxTime + w.i * 1.3, k = 0.5 + 0.5 * Math.sin(t * 2.2);
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, w.x, w.y, 40, '#ffe9a8', 0.22 + 0.1 * k); c.restore();
        c.strokeStyle = `rgba(255, 228, 150, ${0.3 + 0.15 * k})`; c.lineWidth = 1.5; c.beginPath(); c.arc(w.x, w.y + 2, 21, 0, Math.PI * 2); c.stroke(); // a ring of light on the ground: something to pick up
        qsStamp(c, qsWareSprite(w.i), w.x, w.y - 1.5 * k, 1.3 + 0.04 * k); // a soft breathing, as if it caught the light
        const ph = (t % 3) / 0.45; if (ph < 1) qsStar(c, w.x + 7, w.y - 7, 6 * Math.sin(Math.PI * ph), Math.sin(Math.PI * ph));
    }
}

function wareFx(w) { // sidequests.js updateSidequests: picked up
    spawnParticle({ kind: 'ring', color: '#fff3d6', x: w.x, y: w.y, vx: 0, vy: 0, size: 6, grow: 140, life: 0.28, drag: 0, spin: 0, rot: 0 });
    burst(w.x, w.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ffe39a', size: 1.8, speed: [100, 260], life: 0.25, drag: 5 });
    burst(w.x, w.y, -Math.PI / 2, 1.6, 5, { kind: 'dot', color: '#fff3d6', size: 2.2, speed: [30, 90], life: 0.45, drag: 2 });
    MAT_FX.push({ chip: true, icon: qsIcon('ware' + (w.i % 6)), x: w.x, y: w.y, sx: w.x, sy: w.y - 20, t0: fxTime, rot: 0, big: true });
}

// ---------- the ambush ----------
function ambushFx(heap, foes) { // sidequests.js springAmbush: they burst out of the charred timber and the ash
    const hx = heap.x, hy = heap.y;
    burst(hx, hy, 0, Math.PI * 2, 10, { kind: 'smoke', color: '#4a433c', size: 9, grow: 40, life: 0.9, speed: [40, 150], drag: 3 }); // ash thrown up
    burst(hx, hy, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#7d746a', size: 7, grow: 34, life: 0.7, speed: [60, 180], drag: 3.5 });
    burst(hx, hy, 0, Math.PI * 2, 10, { kind: 'dot', color: '#ff9a4a', size: 2, speed: [60, 220], life: 0.8, drag: 2.5 }); // embers still in the heap
    spawnParticle({ kind: 'ring', color: '#cfc4b4', x: hx, y: hy, vx: 0, vy: 0, size: 10, grow: 200, life: 0.3, drag: 0, spin: 0, rot: 0 });
    for (const e of foes) {
        const a = Math.atan2(e.y - hy, e.x - hx);
        burst(hx, hy, a, 0.6, 5, { kind: 'debris', color: '#2a1f17', size: 5, speed: [180, 380], life: 0.6, drag: 3.5 }); // charred splinters, flung their way
        burst(hx, hy, a, 0.5, 3, { kind: 'debris', color: '#4a3424', size: 4, speed: [140, 300], life: 0.6, drag: 3.5 });
        burst(e.x, e.y, a + Math.PI, 1.6, 5, { kind: 'smoke', color: '#5d554c', size: 6, grow: 30, life: 0.6, speed: [50, 140], drag: 3.5 }); // the ash they shook off
    }
}

function stashRevealFx(x, y) { // sidequests.js questFoeDied: the last one down, the hoard they were guarding shows
    dustPuff(x, y, 0, Math.PI * 2, 8, '#6d655c');
    spawnParticle({ kind: 'ring', color: '#ffe39a', x, y, vx: 0, vy: 0, size: 8, grow: 220, life: 0.35, drag: 0, spin: 0, rot: 0 });
    burst(x, y, 0, Math.PI * 2, 12, { kind: 'dot', color: '#ffd76b', size: 2.4, speed: [60, 200], life: 0.6, drag: 2.5 });
    addShake(1.5);
}

// The straggler's shout: the castle's bubble (map_castle.js drawThroneBark), his name in red, pinned to the view's edge if he's off it
function drawQuestBark(c) {
    const b = sqs.bark; if (!b) return;
    const age = fxTime - b.t0; if (!b.e || b.e.dead || age > b.life) { sqs.bark = null; return; }
    const a = Math.min(1, age / 0.15, (b.life - age) / 0.3), pop = age < 0.18 ? 0.85 + 0.15 * easeOutBack(age / 0.18) : 1;
    c.save(); c.font = 'bold 10px Georgia, serif'; const nw = c.measureText(b.name.toUpperCase() + '  ▶').width; // a long name over a short line ("To me, lads!") ran past the bubble
    c.font = 'italic 16px Georgia, serif'; c.textAlign = 'left'; c.textBaseline = 'top';
    const tw = c.measureText(b.text).width, w = Math.max(tw + 28, nw + 20), h = 44, mx = 14, ax = b.e.x, ay = b.e.y - b.e.size / 2;
    let bx = ax - w / 2, by = ay - 34 - h;
    const vx0 = camera.x + mx, vx1 = camera.x + viewW() - mx - w, vy0 = camera.y + mx, vy1 = camera.y + viewH() - mx - h;
    const cx = Math.max(vx0, Math.min(vx1, bx)), cy = Math.max(vy0, Math.min(vy1, by)), pinned = cx !== bx || cy !== by; bx = cx; by = cy;
    c.translate(bx + w / 2, by + h); c.scale(pop, pop); c.translate(-(bx + w / 2), -(by + h));
    c.globalAlpha = a; c.fillStyle = 'rgba(20, 11, 9, 0.9)'; c.strokeStyle = '#c9a227'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(bx, by, w, h, 6);
    if (!pinned) { c.moveTo(ax - 9, by + h); c.lineTo(ax, by + h + 12); c.lineTo(ax + 9, by + h); } // the tail down to him
    c.fill(); c.stroke();
    const nm = b.name.toUpperCase();
    c.fillStyle = '#ff8a65'; c.font = 'bold 10px Georgia, serif'; c.fillText(pinned ? (ax > bx + w ? nm + '  ▶' : ax < bx ? '◀  ' + nm : nm) : nm, bx + 10, by + 6);
    c.fillStyle = '#f3e5c8'; c.font = 'italic 16px Georgia, serif'; c.fillText(b.text, bx + 14, by + 20);
    c.restore();
}

// ---------- per frame ----------
function drawQuestGround() { drawQuestWares(ctx); } // main.js, with the friends

function drawQuestAbove() { // main.js, above the canopies and smoke
    const c = ctx;
    if (questsOn() && gameState !== STATE.DIALOGUE) for (const n of npcs) {
        if (n.map !== currentMap.type || !FRIENDS[n.id]) continue;
        const m = friendMarker(n.id); if (!m) continue;
        drawFriendBadge(c, n.x, n.y - (n.id === 'smith' ? 56 : 50), m, n.id.length);
    }
    drawQuestBark(c);
}

// Screen space (main.js, after the world): a chip at the edge of the view for each friend waiting with a '?' off it, and the fall
function drawQuestScreen() {
    drawReviveScreen();
    if (!questsOn() || gameState !== STATE.PLAYING || (stageEvent && stageEvent.blocking) || sqs.reviving) return;
    const c = ctx, z = camZoom(), W = canvas.width, H = canvas.height, L = 44, R = W - 44, T = 76, B = H - 210; // clear of the plaque and the skill bar
    for (const n of npcs) {
        if (n.map !== currentMap.type || !FRIENDS[n.id] || friendMarker(n.id) !== '?') continue;
        const sx = (n.x - camera.x) * z, sy = (n.y - 30 - camera.y) * z;
        if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) continue; // on screen: the badge itself does
        const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, s = Math.min(dx > 0 ? (R - cx) / dx : dx < 0 ? (L - cx) / dx : 1e9, dy > 0 ? (B - cy) / dy : dy < 0 ? (T - cy) / dy : 1e9);
        const x = cx + dx * s, y = cy + dy * s, a = Math.atan2(dy, dx), k = 0.5 + 0.5 * Math.sin(fxTime * 3 + n.x);
        c.save(); c.translate(x, y);
        c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 36, QS_BADGE['?'].glow, 0.22 + 0.12 * k); c.globalCompositeOperation = 'source-over';
        c.save(); c.rotate(a); c.translate(20 + 2.5 * k, 0); c.fillStyle = '#e8f4fd'; c.strokeStyle = '#0b0705'; c.lineWidth = 2; c.beginPath(); c.moveTo(7, 0); c.lineTo(-2, -6.5); c.lineTo(-2, 6.5); c.closePath(); c.stroke(); c.fill(); c.restore(); // pointing the way
        qsStamp(c, qsChip('?'), 0, 0);
        c.restore();
    }
}

// ---------- the fall in Cinderholt (sidequests.js baseDeath / reviveTick) ----------
const QS_FALL_DIM = 1.0, QS_FALL_BLACK = 1.8, QS_WAKE_HOLD = 1.3, QS_WAKE_IN = 0.9; // seconds: on the ground, to black; dark with the line, the light back
function drawReviveScreen() {
    const c = ctx, W = canvas.width, H = canvas.height;
    let a = 0, txt = 0;
    if (sqs.reviving && !sqs.wakeAt) { // on the ground: the world greys, then goes black
        const t = sqs.reviveT || 0;
        a = t < QS_FALL_DIM ? 0.45 * t / QS_FALL_DIM : Math.min(1, 0.45 + 0.55 * (t - QS_FALL_DIM) / (QS_FALL_BLACK - QS_FALL_DIM));
    } else if (sqs.wakeAt) { // awake by the gate: real time, the game runs under it (the hero is rooted while it lifts)
        const t = (performance.now() - sqs.wakeAt) / 1000;
        a = t < QS_WAKE_HOLD ? 1 : Math.max(0, 1 - (t - QS_WAKE_HOLD) / QS_WAKE_IN);
        txt = Math.min(1, t / 0.35, Math.max(0, (QS_WAKE_HOLD + 0.35 - t) / 0.5));
    }
    if (a <= 0) return;
    c.save();
    if (a < 1) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85); g.addColorStop(0, `rgba(10, 6, 4, ${a * 0.7})`); g.addColorStop(1, `rgba(10, 6, 4, ${Math.min(1, a * 1.5)})`); c.fillStyle = g; } // the edges go first
    else c.fillStyle = '#0a0604';
    c.fillRect(0, 0, W, H);
    if (txt > 0) {
        c.globalAlpha = txt; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#e8d9b8'; c.font = 'italic 26px Georgia, serif'; c.fillText('You come to by the gate.', W / 2, H / 2 - 10);
        c.fillStyle = '#a39279'; c.font = 'italic 15px Georgia, serif'; c.fillText('The ruins are quiet again.', W / 2, H / 2 + 22);
    }
    c.restore();
}

// ---------- icons: for the pickup lines (caches.js MAT_FX) and the Tab sheet ----------
const QS_ICON_ART = {
    coin(c) { // gold
        c.fillStyle = '#7a5410'; c.beginPath(); c.arc(0.8, 1, 9, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#f1c34a'); g.addColorStop(1, '#a3741c');
        c.fillStyle = g; c.strokeStyle = '#4a3108'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(122, 84, 16, 0.7)'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 6.4, 0, Math.PI * 2); c.stroke();
    },
    lucky_coin(c) { // his grandmother's coin: gold, a four-leaf clover struck on it, a hole for a string
        QS_ICON_ART.coin(c);
        c.fillStyle = '#9a6c14'; for (const [x, y] of [[0, -2.2], [2.2, 0], [0, 2.2], [-2.2, 0]]) { c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#ffe9a0'; for (const [x, y] of [[-0.4, -2.6], [1.8, -0.4], [-0.4, 1.8], [-2.6, -0.4]]) { c.beginPath(); c.arc(x, y, 0.7, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = '#9a6c14'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0.6, 2.4); c.quadraticCurveTo(1.6, 4.6, 3.4, 5); c.stroke(); // the stem
        c.fillStyle = '#2a1a06'; c.beginPath(); c.arc(0, -7.2, 1.1, 0, Math.PI * 2); c.fill();
    },
    herb_pouch(c) { // a leather pouch, drawstring, herbs poking out of its mouth
        for (const [a, col] of [[-2.1, '#7cb24f'], [-1.4, '#5f9a3e'], [-0.9, '#9cc36a']]) { c.save(); c.translate(0, -5); c.rotate(a); c.strokeStyle = '#3f6a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = col; c.beginPath(); c.ellipse(7, 0, 2.8, 1.4, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
        const g = c.createRadialGradient(-3, 0, 1, 0, 2, 10); g.addColorStop(0, '#b07a48'); g.addColorStop(1, '#5e3a1c');
        c.fillStyle = g; c.strokeStyle = QS_OUT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-5, -5); c.quadraticCurveTo(-10, 2, -6, 8); c.quadraticCurveTo(0, 11, 6, 8); c.quadraticCurveTo(10, 2, 5, -5); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#d8c08a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-5.5, -4.5); c.lineTo(5.5, -4.5); c.stroke(); // the drawstring
        c.lineWidth = 0.9; c.beginPath(); c.moveTo(4, -4.5); c.quadraticCurveTo(7, -2, 6.5, 1.5); c.stroke();
        c.strokeStyle = 'rgba(232, 200, 150, 0.6)'; c.lineWidth = 0.6; c.setLineDash([1.2, 1]); c.beginPath(); c.moveTo(-6, 3); c.quadraticCurveTo(0, 6, 6, 3); c.stroke(); c.setLineDash([]); // stitching
    },
    hound_tooth(c) { // a fang on a cord
        c.strokeStyle = '#5a3a1e'; c.lineWidth = 1.3; c.beginPath(); c.arc(0, -3, 7.5, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); // the cord's loop
        c.beginPath(); c.moveTo(-6.6, -6.2); c.lineTo(-1.6, -1); c.moveTo(6.6, -6.2); c.lineTo(1.6, -1); c.stroke();
        c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(0, -1, 1.8, 0, Math.PI * 2); c.fill(); // the knot
        const g = c.createLinearGradient(-3, 0, 3, 9); g.addColorStop(0, '#fbf3dc'); g.addColorStop(1, '#c9b48a');
        c.fillStyle = g; c.strokeStyle = '#3a2c18'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2.6, 0); c.quadraticCurveTo(-3, 6, 2.4, 10); c.quadraticCurveTo(0.4, 5, 2.6, 0.4); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-1.6, 1.4); c.quadraticCurveTo(-1.6, 5, 0.6, 7.4); c.stroke();
    },
    quest(c) { // a rolled parchment: any quest line without its own icon
        c.fillStyle = '#e9dcb8'; c.strokeStyle = '#5a4428'; c.lineWidth = 1; c.beginPath(); c.rect(-6, -7, 12, 14); c.fill(); c.stroke();
        for (const y of [-7, 7]) { c.fillStyle = '#d4c49a'; c.beginPath(); c.ellipse(0, y, 7.6, 2.2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
        c.strokeStyle = 'rgba(90, 68, 40, 0.6)'; c.lineWidth = 0.7; c.beginPath(); for (const y of [-3, 0, 3]) { c.moveTo(-4, y); c.lineTo(4, y); } c.stroke();
        c.fillStyle = '#a33a2a'; c.beginPath(); c.arc(3.4, 4.6, 1.8, 0, Math.PI * 2); c.fill();
    },
};
const QS_SEAL = { merchant: ['#b3402f', 'coin'], apothecary: ['#4f8a4a', 'leaf'], smith: ['#41607a', 'hammer'] }; // a favour: the friend's wax seal
function sealArt(who) {
    return c => {
        const [col, mark] = QS_SEAL[who] || QS_SEAL.merchant;
        c.fillStyle = sprShade(col, -0.4); c.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = i % 2 ? 9.6 : 8.6; c.lineTo(Math.cos(a) * r + 0.6, Math.sin(a) * r + 0.8); } c.closePath(); c.fill(); // the wax's spread edge
        const g = c.createRadialGradient(-3, -3, 1, 0, 0, 9); g.addColorStop(0, sprShade(col, 0.35)); g.addColorStop(1, col);
        c.fillStyle = g; c.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = i % 2 ? 9 : 8.2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
        c.strokeStyle = sprShade(col, -0.45); c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 5.6, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = sprShade(col, -0.5); c.fillStyle = sprShade(col, -0.5); c.lineWidth = 1.1;
        if (mark === 'coin') { c.beginPath(); c.arc(0, 0, 2.8, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(0, -1.6); c.lineTo(0, 1.6); c.stroke(); }
        else if (mark === 'leaf') { c.beginPath(); c.moveTo(-3, 3); c.quadraticCurveTo(-3, -3, 3, -3); c.quadraticCurveTo(3, 3, -3, 3); c.fill(); }
        else { c.fillRect(-3.2, -3, 6.4, 2.6); c.fillRect(-0.6, -0.6, 1.2, 4); }
    };
}

function qsIcon(key) { // a canvas: 'coin', a keepsake id, 'quest', 'seal_<friend>', 'item_<quest>', 'ware<i>'
    if (key.startsWith('item_')) return qsItemSprite(key.slice(5));
    if (key.startsWith('ware')) return qsWareSprite(+key.slice(4));
    if (key.startsWith('seal_')) return qsBake(key, 22, 22, sealArt(key.slice(5)));
    return qsBake('ic_' + key, 22, 22, QS_ICON_ART[key] || QS_ICON_ART.quest);
}
function qsIconImg(key, cls = 'qs-ic') { // the same, inline in the Tab sheet
    if (!QFX_URL[key]) QFX_URL[key] = qsIcon(key).toDataURL();
    return `<img class="${cls}" src="${QFX_URL[key]}" alt="">`;
}
