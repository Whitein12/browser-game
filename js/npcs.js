// ==========================================
// npcs.js - Cinderholt's friends on the map: their top-down sprites and a simple wander
// ==========================================
// The smith, the apothecary and the merchant (BASE.md) as they walk the village; their dialogue portraits are portraits.js
// BIG_PORTRAITS. Drawn like the heroes: NPC_SPRITES[id] in the sprite frame (+x is the facing, +y the right side), stamped
// through sprites.js stampSprite (drawCharacter falls back to NPC_SPRITES). They aren't enemies, so nothing can hit them.
// For now only the dev console puts them on the map (devFriendsWalk); the walkable village (BASE.md step 1) will place them.

const NPC_SPRITES = {
    // A big old man: a linen shirt rolled to the elbows, a leather apron, bald with a white fringe, his beard jutting
    // out in front, the sledge on his right shoulder (its head behind him, the haft forward to his fist)
    smith(c, p) {
        const SKIN = '#c98d6c', SHIRT = '#cfbf9e', APRON = '#6e4528', WHITE = '#dcd7cf';
        c.scale(1.15, 1.15);
        sprFeet(c, p, '#3e2a1e');
        sprTorso(c, SHIRT, 16, 11);
        c.save(); c.beginPath(); c.ellipse(-1, 0, 11, 16, 0, 0, Math.PI * 2); c.clip(); // the apron over his front
        c.fillStyle = APRON; c.beginPath(); c.ellipse(4, 0, 7, 12, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(20, 10, 4, 0.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, -8); c.lineTo(-9, -6); c.moveTo(2, 8); c.lineTo(-9, 6); c.stroke(); // its straps over his shoulders
        c.restore();
        for (const s of [-1, 1]) sprEllipse(c, -0.5, s * 15, 5.5, 5, SHIRT); // the shoulders
        sprStroke(c, SKIN, 4.5, () => { c.moveTo(1, -16.5); c.lineTo(5, -15.5); }); // the left forearm, hanging
        sprEllipse(c, 6, -15, 3, 3, SKIN);
        sprStroke(c, SKIN, 4.5, () => { c.moveTo(1, 16); c.lineTo(8, 11.5); }); // the right, up to the haft
        sprStroke(c, '#6d4c33', 2.6, () => { c.moveTo(11, 11); c.lineTo(-14, 14.5); }); // the haft
        c.beginPath(); c.rect(-17.5, 8, 6.5, 14); sprFill(c, '#3b3e44'); // the sledge's head, behind his shoulder
        c.fillStyle = '#8e979e'; c.fillRect(-17, 6.5, 5.5, 2); c.fillRect(-17, 21.5, 5.5, 2);
        sprEllipse(c, 9, 11, 3.4, 3.4, SKIN); // the fist
        sprEllipse(c, 7.5, 0, 6, 6.5, WHITE); // the beard, out in front
        c.strokeStyle = '#3b3e44'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(12, -2); c.lineTo(12, 2); c.stroke(); // its iron ring
        sprEllipse(c, 1, 0, 8, 8, SKIN); // the bald head
        sprStroke(c, WHITE, 2.6, () => c.arc(1, 0, 7, Math.PI * 0.55, Math.PI * 1.45)); // the white fringe round the back
        sprEllipse(c, 3, -2.5, 2.8, 1.8, 'rgba(255, 245, 230, 0.4)', false); // the shine
        for (const s of [-1, 1]) sprEllipse(c, 6.5, s * 3, 1.5, 2.2, WHITE, false); // bushy brows
    },

    // A young herbalist: a wine-red skirt, a green wrap jacket, wide sleeves meeting in front, a sprig in her hands;
    // dark green hair, a bun with a blue ribbon, two beaded braids over her shoulders
    apothecary(c, p) {
        const HAIR = '#1c3a34', GREEN = '#6cae60', LIME = '#cdd95e', SKIN = '#f3d8c2';
        c.scale(0.92, 0.92);
        sprFeet(c, p, '#2b4a2a');
        sprEllipse(c, -2 + p.trail.x * 0.3, p.trail.y * 0.3, 11, 14, '#7a3350'); // the skirt, swinging behind her stride
        sprTorso(c, GREEN, 12.5, 9);
        sprStroke(c, '#2d6a3b', 1.6, () => { c.moveTo(0, -7); c.lineTo(7, 2); }); // the crossed collar
        for (const s of [-1, 1]) { // the wide sleeves, the forearms meeting at her waist
            c.beginPath(); c.moveTo(-3, s * 8); c.quadraticCurveTo(-3, s * 16, 4, s * 15); c.quadraticCurveTo(9, s * 12, 10, s * 5); c.lineTo(5, s * 4); c.quadraticCurveTo(1, s * 8, -3, s * 8); c.closePath(); sprFill(c, GREEN);
            sprEllipse(c, 9, s * 5.5, 2, 3, LIME);
        }
        sprLeaf(c, 11, -1, 0.4, 7, '#66bb6a'); sprEllipse(c, 16, 1.5, 1.4, 1.4, '#fafafa', false); // the sprig
        sprEllipse(c, 10.5, 0, 3, 4, SKIN); // her clasped hands
        for (const s of [-1, 1]) { sprStroke(c, HAIR, 1.6, () => { c.moveTo(2, s * 6); c.quadraticCurveTo(5, s * 8.5, 6, s * 10); }); sprEllipse(c, 6.5, s * 10.5, 1.2, 1.2, s < 0 ? '#5c8fd6' : '#d9824a', false); } // the braids
        sprEllipse(c, 1.5, 0, 7, 7, HAIR);
        c.strokeStyle = '#33665a'; c.lineWidth = 0.9; c.beginPath(); for (const a of [-0.9, -0.3, 0.3, 0.9]) { c.moveTo(7.5, Math.sin(a) * 4); c.quadraticCurveTo(2, Math.sin(a) * 6, -3, Math.sin(a) * 4); } c.stroke(); // strands
        sprEllipse(c, -3.5, 1.5, 3.4, 3.4, HAIR); // the bun
        for (const s of [-1, 1]) sprEllipse(c, -6.5 + s * 1.2, 3.5 + s * 1.8, 1.8, 1.1, '#5b73c9', false); // the ribbon
    },

    // A cheerful trader: a long green cape trimmed in gold, a mint tunic under a dark green capelet, a red bow, silver hair
    // under a green cap with a white feather. Standing about, he flips a coin.
    merchant(c, p) {
        const MINT = '#62c08e', CAPE = '#2f7d42', CAPE_D = '#21592f', YEL = '#f2e27a', SKIN = '#f3dac6';
        sprFeet(c, p, '#5a3a28');
        sprCape(c, p, '#1d4f2a', 20, 12.5, YEL); // darker than the capelet, so the two read apart
        sprTorso(c, MINT, 13.5, 9);
        const idle = p.move < 0.25;
        sprEllipse(c, -1.5, 0, 9.5, 15, CAPE); // the capelet over his shoulders
        c.save(); c.beginPath(); c.ellipse(-1.5, 0, 9.5, 15, 0, 0, Math.PI * 2); c.clip();
        c.fillStyle = MINT; c.beginPath(); c.moveTo(3, 0); c.lineTo(9, -6); c.lineTo(9, 6); c.closePath(); c.fill(); // open at the front
        c.fillStyle = YEL; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x = 4 + k * 2, y = s * (1 + k * 2); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y + s * 2); c.lineTo(x - 1, y + s * 2.5); c.closePath(); c.fill(); } // its triangle trim
        c.restore();
        if (idle) { sprStroke(c, MINT, 3.6, () => { c.moveTo(4, -12); c.lineTo(9, -10.5); }); sprEllipse(c, 10, -10, 2.8, 2.6, SKIN); } // the hand out for the coin
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(7, 0); c.lineTo(9, s * 3); c.lineTo(5.5, s * 2.5); c.closePath(); sprFill(c, '#d63a3a'); } // the red bow
        sprEllipse(c, 1.5, 0, 7.6, 7.6, '#cdc6c2'); // silver hair under the cap
        sprEllipse(c, 1, 0, 6.6, 6.6, CAPE_D); // the cap
        sprEllipse(c, 1, 0, 4.6, 4.6, CAPE, false);
        c.strokeStyle = YEL; c.lineWidth = 1; c.beginPath(); c.arc(1, 0, 4.6, 0, Math.PI * 2); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 0.4; c.moveTo(1 + Math.cos(a) * 4.6, Math.sin(a) * 4.6); c.lineTo(1 + Math.cos(a) * 6.4, Math.sin(a) * 6.4); } c.stroke(); // the panels' gold edges
        sprLeaf(c, 1, 6, Math.PI - 0.3, 13, '#f7f5f0'); // the feather, swept back
        sprEllipse(c, 1.5, 6.5, 1.8, 1.8, '#f7f5f0');
        if (idle) { // the coin, flipped and caught: it grows as it rises toward the eye
            const k = (p.t * 0.9) % 1, h = Math.sin(k * Math.PI), w = 2.2 + h * 1.4;
            sprEllipse(c, 12, -11, w * (0.25 + 0.75 * Math.abs(Math.cos(p.t * 11))), w, '#e8b931');
        }
    },
};

// ---------- talking to them (interiors.js: E in reach) ----------
// Names and lines are placeholders until the user writes them (BASE.md). After the talk, their service screen opens; it
// returns to the village (ui.js: opened while playing, it goes back to play).
const FRIENDS = {
    smith: { role: 'smith', name: 'The Smith', title: "Cinderholt's forge", lines: ['Back in one piece. Good.', "My forge went up with the house. Until it's built again, I'll do what I can out here."], service: () => openSmith() },
    apothecary: { role: 'apothecary', name: 'The Apothecary', title: 'Herbs and remedies', lines: ['Hold still. I need to see whether that wound is poisoned.'], service: () => openApothecary() },
    merchant: { role: 'merchant', name: 'The Merchant', title: 'Goods from the road', lines: ['Fair prices, mostly. Have a look.'], service: () => openShop() },
};
// Until their building is rebuilt (rebuild.js) a friend has no service, only these; after it, a thank-you once
FRIENDS.smith.closed = ["No forge, no smithing. I can't temper a blade on a heap of ash.", 'Get my house back up and I\'ll have that fire roaring again by nightfall.'];
FRIENDS.smith.thanks = ['Ha! Listen to that bellows breathe.', "Forty years I worked that anvil. Bring me your steel, and I'll make it sing."];
FRIENDS.apothecary.closed = ['The roof came down on half my shelves. Whatever the fire missed, the rain will spoil.', "Fix the house and I'll have tinctures brewing again."];
FRIENDS.apothecary.thanks = ['Dry shelves, a roof that holds. You have no idea what that means to a herbalist.', 'Come in whenever you need patching up. I mean it.'];
FRIENDS.merchant.closed = ["Can't sell much out of a shop with no roof. The crows already took a fancy to my silks.", 'Patch the place up and I\'ll open the doors.'];
FRIENDS.merchant.thanks = ['Open for business! Ha, I\'ve waited weeks to say that.', 'First pick of everything goes to you, of course. At a fair price. Mostly.'];

// The return to Cinderholt (map_base.js base_arrival, once per hero): the merchant meets the hero at the gate (base2.md).
// Strings are his lines; { who: 'hero' } lines are the hero's (dialogue.js).
const ARRIVAL_LINES = [
    'Is that... it is! You came back!',
    "And in one piece, too. When the smoke cleared, nobody knew whether you'd made it.",
    { who: 'hero', text: "I followed the raiders' trail all the way to the Bastion. Tell me what happened here." },
    'They came at night. No horns, no warning. The guards at the gate never saw them coming.',
    'They cut them down, every last one. Then they went house to house, took whatever they could carry, and burned the rest.',
    "The fires are out now, but... well. You can see it. Half the roofs are gone, and the smith's house burned to the ground.",
    { who: 'hero', text: 'Valerius is dead. His crown is mine. No one will raid Cinderholt again.' },
    'Dead? The King of Thieves himself? Ha! Gods, I could kiss you.',
    { who: 'hero', text: "Then we rebuild. The town hall, the apothecary's, your shop, the forge. All of it." },
    "That'll take gold. And timber, iron and stone, more than this village has left.",
    'Anything you hauled out of those caves and that cursed castle will help. Every plank, every nail.',
    "Come find me by my shop when you're ready to start. And... welcome home.",
];
function talkTo(id) { talkMenu(id); } // sidequests.js: the greeting, then Chat / the service / the quest. Before their building is rebuilt (rebuild.js) the service is shut and the friend says why (`closed`). The dev console's devTalk keeps the plain lines (`lines`).

// ---------- the friends walking about ----------

const NPC_INFO = { smith: { speed: 55, r: 18 }, apothecary: { speed: 70, r: 13 }, merchant: { speed: 75, r: 15 } };
let npcs = [];

// Put a friend on a map (by default the current one) at x, y; they wander within `range` of that spot
function addNpc(id, x, y, range = 160, map = currentMap.type) {
    const n = { id, x, y, home: { x, y }, range, facing: Math.PI / 2, target: null, wait: 1 + Math.random() * 2, walk: 0, vx: 0, vy: 0, map };
    if (map === currentMap.type) clampToBounds(n, NPC_INFO[id].r);
    npcs.push(n); return n;
}

function updateNpcs(dt) {
    for (const n of npcs) {
        if (n.map !== currentMap.type) continue; // they keep to the map they were put on (a shop's keeper stays in the shop)
        const info = NPC_INFO[n.id], ox = n.x, oy = n.y;
        if (n.target) {
            const dx = n.target.x - n.x, dy = n.target.y - n.y, d = Math.hypot(dx, dy);
            if (d < 6) { n.target = null; n.wait = 2 + Math.random() * 3; }
            else {
                const step = Math.min(d, (n.speed || info.speed) * dt); // n.speed: a scene hurries them (map_base.js arrival)
                n.x += dx / d * step; n.y += dy / d * step; clampToBounds(n, info.r);
                if (Math.hypot(n.x - ox, n.y - oy) < step * 0.4) { n.target = null; n.wait = 0.5 + Math.random(); } // a wall: try elsewhere
                turnNpc(n, Math.atan2(dy, dx), dt);
            }
        } else {
            const hd = Math.hypot(player.x - n.x, player.y - n.y);
            if (hd < 140) turnNpc(n, Math.atan2(player.y - n.y, player.x - n.x), dt); // the hero is near: look at them between strolls
            if ((n.wait -= dt) <= 0) { const a = Math.random() * Math.PI * 2, r = Math.min(40, n.range * 0.4) + Math.random() * n.range; n.target = { x: n.home.x + Math.cos(a) * r, y: n.home.y + Math.sin(a) * r }; }
        }
        const hd = Math.hypot(player.x - n.x, player.y - n.y), min = info.r + (player.radius || 15); // step aside rather than walk through the hero
        if (hd < min && hd > 0) { n.x -= (player.x - n.x) / hd * (min - hd); n.y -= (player.y - n.y) / hd * (min - hd); clampToBounds(n, info.r); }
        const mx = dt > 0 ? (n.x - ox) / dt : 0, my = dt > 0 ? (n.y - oy) / dt : 0, k = Math.min(1, dt * 10);
        n.vx += (mx - n.vx) * k; n.vy += (my - n.vy) * k;
        n.walk += Math.hypot(n.x - ox, n.y - oy) * 0.06;
    }
}

function turnNpc(n, ang, dt) {
    let d = ang - n.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
    n.facing += d * Math.min(1, dt * 6);
}

// After the enemies and before the hero (main.js draw)
function drawNpcs() {
    for (const n of npcs) {
        if (n.map !== currentMap.type) continue;
        const big = n.id === 'smith' ? 1.15 : 1, cos = Math.cos(n.facing), sin = Math.sin(n.facing);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.beginPath(); ctx.ellipse(n.x + 3, n.y + 6, 15 * big, 18 * big, n.facing, 0, Math.PI * 2); ctx.fill();
        let tx = -(n.vx * cos + n.vy * sin) * 0.03, ty = -(-n.vx * sin + n.vy * cos) * 0.03; const m = Math.hypot(tx, ty); // cloth dragged behind, as playerPose
        if (m > 12) { tx *= 12 / m; ty *= 12 / m; }
        const pose = { t: performance.now() / 1000, walk: n.walk, move: Math.min(1, Math.hypot(n.vx, n.vy) / 150), trail: { x: tx, y: ty }, live: false, wolf: false };
        stampSprite(n.x, n.y, n.facing, n.id, pose);
    }
}
