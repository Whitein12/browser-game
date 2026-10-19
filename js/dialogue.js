// ==========================================
// dialogue.js - A visual-novel style dialogue box: the speaker painted large in the bottom-left corner, the text box beside them
// ==========================================
// openDialogue({ name, title, portrait, lines, onClose }) pauses the game (STATE.DIALOGUE) and types the lines out one at a time.
// Enter, Space or a click finishes the line being typed, then moves to the next; after the last one the box closes, the
// game resumes and onClose runs (map_bridge.js: Valerius's escape carries on; a death taunt shows the death screen). `portrait` is a BIG_PORTRAITS id
// (portraits.js), front-facing, head to hips. It animates in real time: the fight is paused underneath.
// A line is a string (the main speaker) or { who: 'hero', text }: the hero answers, their class portrait standing bare in the
// bottom-right corner (portraits.js drawPortrait with `bare`), there from the start whenever the dialogue has a hero line. The one not
// talking is dimmed, and the name plate moves to the box's right side for the hero.

const DLG_CPS = 45; // letters typed per second
let dlg = null;

const dlgText = l => typeof l === 'string' ? l : l.text;
const dlgIsHero = l => !!l && typeof l === 'object' && l.who === 'hero';

function openDialogue(o) {
    const hasHero = o.lines.some(dlgIsHero), cid = hasHero && activeClass ? activeClassId() : null;
    dlg = { name: o.name, title: o.title || '', tint: (BIG_PORTRAITS[o.portrait] || {}).tint || '', portrait: o.portrait, hero: cid && PORTRAITS[cid] ? cid : null,
        lines: o.lines, onClose: o.onClose, i: 0, start: performance.now(), lineAt: 0, shown: -1, choices: o.choices || null, sel: 0, choiceOn: false }; // tint: a friend's title in their own colour, not his red; choices: sidequests.js talk menu
    const ch = el('dialogue-choices'); ch.classList.add('hidden'); ch.innerHTML = '';
    gameState = STATE.DIALOGUE; keys.w = keys.a = keys.s = keys.d = false; isMouseDown = false;
    const scr = el('dialogue-screen'), hv = el('dialogue-hero');
    scr.classList.toggle('with-hero', !!dlg.hero); scr.classList.remove('hero-speaks'); hv.classList.toggle('hidden', !dlg.hero);
    scr.classList.remove('hidden');
    const cv = el('dialogue-portrait'), dpr = window.devicePixelRatio || 1, P = BIG_PORTRAITS[o.portrait]; // sized once it's laid out
    cv.height = Math.round((cv.clientHeight || 600) * dpr); cv.width = Math.round(cv.height * P.w / P.h);
    if (dlg.hero) { hv.height = Math.round((hv.clientHeight || 300) * dpr); hv.width = Math.round(hv.height * PT_W / PT_H); }
    dlgLine(); requestAnimationFrame(dlgFrame);
}

// Who's talking on this line: the plate's name and title, which side it sits on, who is dimmed
function dlgSpeaker() {
    const hero = dlgIsHero(dlg.lines[dlg.i]);
    let name = dlg.name, title = dlg.title, color = dlg.tint;
    if (hero) {
        const cls = dlg.hero ? classDataConfig[dlg.hero].name : activeClass ? activeClass.name : '';
        name = (heroData && heroData.name) || cls || 'You'; // quick play has no hero's name: the class is the name, so no title under it
        title = heroData && heroData.name ? cls : '';
        color = dlg.hero ? sprShade(PORTRAITS[dlg.hero].color, 0.35) : ''; // lifted, so the dark class colours still read on the plate
    }
    el('dialogue-name').textContent = name; el('dialogue-title').textContent = title; el('dialogue-title').style.color = color;
    el('dialogue-screen').classList.toggle('hero-speaks', hero);
}

function dlgLine() { dlg.lineAt = performance.now(); dlg.shown = -1; el('dialogue-text').textContent = ''; el('dialogue-more').classList.add('hidden'); dlgSpeaker(); }

function dlgFrame(now) {
    if (!dlg) return;
    const line = dlgText(dlg.lines[dlg.i]), n = Math.min(line.length, Math.floor((now - dlg.lineAt) / 1000 * DLG_CPS));
    if (n !== dlg.shown) { dlg.shown = n; el('dialogue-text').textContent = line.slice(0, n); el('dialogue-more').classList.toggle('hidden', n < line.length || !!dlg.choices); }
    if (dlg.choices && !dlg.choiceOn && dlg.i === dlg.lines.length - 1 && n >= line.length) dlgShowChoices(); // the last line is typed: the list appears
    const t = (now - dlg.start) / 1000;
    drawBigPortrait(el('dialogue-portrait'), dlg.portrait, t); // portraits.js
    if (dlg.hero) drawPortrait(el('dialogue-hero'), dlg.hero, t + 2.3, 1, true);
    requestAnimationFrame(dlgFrame);
}

// Enter / Space / a click: finish the line, or go on to the next, or close after the last
function dialogueAdvance() {
    if (!dlg || gameState !== STATE.DIALOGUE) return;
    const line = dlgText(dlg.lines[dlg.i]);
    if (dlg.shown < line.length) { dlg.lineAt = -1e9; dlg.shown = line.length; el('dialogue-text').textContent = line; el('dialogue-more').classList.remove('hidden'); return; } // finish it at once
    if (dlg.choices && dlg.i === dlg.lines.length - 1) { dlgShowChoices(); return; } // a menu stays on its last line until one is picked
    if (++dlg.i < dlg.lines.length) { dlgLine(); return; }
    dlgClose(dlg.onClose);
}
window.dialogueAdvance = dialogueAdvance;
function dlgClose(then) { // the box goes, the game resumes, then `then` (which may open the next dialogue or a screen)
    dlg = null;
    el('dialogue-screen').classList.add('hidden'); el('dialogue-screen').classList.remove('with-hero', 'hero-speaks'); el('dialogue-hero').classList.add('hidden');
    gameState = STATE.PLAYING; lastTime = performance.now();
    if (then) then();
}

// ---------- choices (sidequests.js talkMenu): [{ label, act, disabled, note, leave }] ----------
// Shown under the last line once it is typed. Arrows / W-S or the mouse move, Enter / Space / a click pick, 1-9 are shortcuts,
// Escape is the `leave` choice. A pick closes the box, then runs its act (usually the next dialogue); a disabled one only shows its note.
function dlgShowChoices() {
    if (!dlg || !dlg.choices || dlg.choiceOn) return;
    dlg.choiceOn = true; dlg.sel = Math.max(0, dlg.choices.findIndex(c => !c.disabled));
    const box = el('dialogue-choices'); box.innerHTML = '';
    dlg.choices.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'dlg-choice' + (c.disabled ? ' disabled' : '') + (c.leave ? ' leave' : '');
        d.innerHTML = `<span class="dlg-k">${i + 1}</span><span class="dlg-l"></span>` + (c.note ? '<i class="dlg-n"></i>' : '');
        d.querySelector('.dlg-l').textContent = c.label; if (c.note) d.querySelector('.dlg-n').textContent = c.note;
        d.addEventListener('mouseenter', () => { if (dlg && !c.disabled) { dlg.sel = i; dlgMark(); } });
        d.addEventListener('click', e => { e.stopPropagation(); dlgPick(i); });
        box.appendChild(d);
    });
    box.classList.remove('hidden'); el('dialogue-more').classList.add('hidden'); dlgMark();
}
function dlgMark() { [...el('dialogue-choices').children].forEach((d, i) => d.classList.toggle('sel', dlg && i === dlg.sel)); }
function dlgPick(i) {
    if (!dlg || !dlg.choiceOn) return;
    const c = dlg.choices[i]; if (!c || c.disabled) return;
    dlgClose(c.act || (c.leave ? dlg.onClose : null));
}
function dlgStep(d) { // the next enabled choice up or down
    const n = dlg.choices.length; let s = dlg.sel;
    for (let k = 0; k < n; k++) { s = (s + d + n) % n; if (!dlg.choices[s].disabled) break; }
    dlg.sel = s; dlgMark();
}

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
    if (dlg && dlg.choiceOn) { // a menu is up: it takes the keys
        if (k === 'arrowup' || k === 'w') { e.preventDefault(); dlgStep(-1); }
        else if (k === 'arrowdown' || k === 's') { e.preventDefault(); dlgStep(1); }
        else if (k === 'enter' || k === ' ') { e.preventDefault(); dlgPick(dlg.sel); }
        else if (/^[1-9]$/.test(k)) dlgPick(+k - 1);
        else if (k === 'escape') { const i = dlg.choices.findIndex(c => c.leave); if (i >= 0) dlgPick(i); }
        return;
    }
    if (k === 'enter' || k === ' ') { e.preventDefault(); dialogueAdvance(); }
});
