// ==========================================
// dialogue.js - A visual-novel style dialogue box: the speaker painted large in the bottom-left corner, the text box beside them
// ==========================================
// openDialogue({ name, title, portrait, lines, onClose }) pauses the game (STATE.DIALOGUE) and types the lines out one at a time.
// Enter, Space or a click finishes the line being typed, then moves to the next; after the last one the box closes, the
// game resumes and onClose runs (map_bridge.js: Valerius's escape carries on; a death taunt shows the death screen). `portrait` is a BIG_PORTRAITS id
// (portraits.js), front-facing, head to hips. It animates in real time: the fight is paused underneath.

const DLG_CPS = 45; // letters typed per second
let dlg = null;

function openDialogue(o) {
    dlg = { name: o.name, portrait: o.portrait, lines: o.lines, onClose: o.onClose, i: 0, start: performance.now(), lineAt: 0, shown: -1 };
    gameState = STATE.DIALOGUE; keys.w = keys.a = keys.s = keys.d = false; isMouseDown = false;
    el('dialogue-name').textContent = o.name; el('dialogue-title').textContent = o.title || '';
    el('dialogue-screen').classList.remove('hidden');
    const cv = el('dialogue-portrait'), dpr = window.devicePixelRatio || 1, P = BIG_PORTRAITS[o.portrait]; // sized once it's laid out
    cv.height = Math.round((cv.clientHeight || 600) * dpr); cv.width = Math.round(cv.height * P.w / P.h);
    dlgLine(); requestAnimationFrame(dlgFrame);
}

function dlgLine() { dlg.lineAt = performance.now(); dlg.shown = -1; el('dialogue-text').textContent = ''; el('dialogue-more').classList.add('hidden'); }

function dlgFrame(now) {
    if (!dlg) return;
    const line = dlg.lines[dlg.i], n = Math.min(line.length, Math.floor((now - dlg.lineAt) / 1000 * DLG_CPS));
    if (n !== dlg.shown) { dlg.shown = n; el('dialogue-text').textContent = line.slice(0, n); el('dialogue-more').classList.toggle('hidden', n < line.length); }
    drawBigPortrait(el('dialogue-portrait'), dlg.portrait, (now - dlg.start) / 1000); // portraits.js
    requestAnimationFrame(dlgFrame);
}

// Enter / Space / a click: finish the line, or go on to the next, or close after the last
function dialogueAdvance() {
    if (!dlg || gameState !== STATE.DIALOGUE) return;
    const line = dlg.lines[dlg.i];
    if (dlg.shown < line.length) { dlg.lineAt = -1e9; dlg.shown = line.length; el('dialogue-text').textContent = line; el('dialogue-more').classList.remove('hidden'); return; } // finish it at once
    if (++dlg.i < dlg.lines.length) { dlgLine(); return; }
    const done = dlg.onClose; dlg = null;
    el('dialogue-screen').classList.add('hidden');
    gameState = STATE.PLAYING; lastTime = performance.now();
    if (done) done();
}
window.dialogueAdvance = dialogueAdvance;

// ---------- Valerius gloats over a fallen hero (combat.js playerDied) ----------
// Whenever he's on the field when the hero dies: the bridge duel, watching from his throne while his guard fights (wave 16),
// and the last fight. A few sets per place, picked at random.
const VALERIUS_TAUNTS = {
    bridge: [
        ['Down you go.', 'All that way from Cinderholt, to die on my bridge. The crows will thank you.'],
        ['Is that all?', 'I gave you a road out. You should have taken it.'],
        ['Stay down.', 'I\'ll hang what\'s left of you over the gate, so the next fool knows the way in.'],
    ],
    throne: [
        ['Look at you. Bleeding on my carpet.', 'I didn\'t even have to stand up.'],
        ['Kneel, then. Ah, you already are.'],
        ['That\'s what comes of storming a king\'s hall. Drag it out.'],
    ],
    king: [
        ['Every crown in this hall I took from someone who thought they were stronger.', 'You were just one more.'],
        ['You fought well. It changes nothing.', 'Your blade goes on my wall. Your name goes nowhere.'],
        ['That\'s the difference between us.', 'I never stay down.'],
    ],
};

// The dialogue to open if Valerius saw the hero fall, or null
function valeriusTaunt() {
    const v = enemies.find(e => e.type === 'boss_valerius' && !e.dead && !e.escaping);
    const seated = currentMap.type === 'castle' && typeof cst !== 'undefined' && cst.seated; // map_castle.js: on his throne, watching
    if (!v && !seated) return null;
    const where = seated && !v ? 'throne' : v.king ? 'king' : 'bridge', sets = VALERIUS_TAUNTS[where];
    const bare = where !== 'bridge';
    return { name: bare ? 'Valerius' : 'Valerius the Vanguard', title: where === 'king' ? 'King of Thieves' : 'Lord of the Bastion', portrait: bare ? 'valerius_bare' : 'valerius', lines: sets[(Math.random() * sets.length) | 0] };
}

window.addEventListener('keydown', e => {
    if (gameState !== STATE.DIALOGUE || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ') { e.preventDefault(); dialogueAdvance(); }
});
