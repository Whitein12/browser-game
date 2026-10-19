// ==========================================
// quests.js - Cinderholt's sidequests, the friends' small talk and the keepsakes (BASE.md step 5)
// ==========================================
// The content: who gives what, in which order, every line said, and the rewards. The mechanics (the talk menu, quest
// state, markers, the tracker, each kind's triggers) read these tables.
// Lines are strings (the friend speaking) or { who: 'hero', text } (dialogue.js). Each friend offers their quests one at
// a time, in `order`; a quest can wait on a rebuild or another quest (`needs`).
// Kinds:
//   ambush  - a spot in Cinderholt; walking near it springs bandits; when they're down a stash appears to open
//   wares   - `count` pickups strewn round Cinderholt to walk over
//   fetch   - a quest cache on a dungeon map (`map`, near `near`), only while the quest is active; breaking it gives `item`
//   bounty  - kill `count` enemies of `enemy` (in any run while the quest is active)
//   deliver - carry `item` to another friend (`to`), who has their own lines for it

const QUESTS = {
    // ---------------- the merchant ----------------
    ruins: {
        giver: 'merchant', order: 1, kind: 'ambush', title: 'Rats in the Ruins',
        spot: { house: 0 }, // the burnt-out lot at the west end of the village (VIL_HOUSES index), past the apothecary's
        foes: ['thief', 'thief', 'archer'],
        steps: ['Search the burnt lot at the west end of the village', 'Open the stash', 'Tell the merchant what you found'],
        offer: [
            "Funny thing. Nights since the raid, someone's been creeping about the old Harlan place. The burnt one, out west.",
            'Lights where no one lives. Footprints in the ash. And my crates keep getting lighter.',
            { who: 'hero', text: "A bandit who didn't run with the rest?" },
            "That's my guess. One who knows the raiders left a lot behind in a hurry. Would you have a look? Carefully?",
        ],
        accept: { who: 'hero', text: "I'll look tonight." },
        spring: { name: 'Bandit Straggler', lines: ["Should've left the ruins alone, hero!"] }, // shouted (a bark, not a dialogue) as they jump out
        stashFound: "A raider's stash: coin, tools, and a lucky charm the straggler won't need anymore.",
        done: [
            "Three of them? Living under our noses! And all that coin, my coin half of it, I'd wager.",
            'Keep it. You earned it twice over. Oh, and this...',
            "My grandmother's lucky coin. They took it off my counter the night of the raid. It's always brought good fortune to whoever carries it. Take it.",
        ],
        reward: { gold: 120, wood: 10, iron: 8, keepsake: 'lucky_coin' },
    },
    wares: {
        giver: 'merchant', order: 2, kind: 'wares', title: 'Scattered Wares', needs: { quest: 'ruins' },
        count: 6,
        steps: ['Gather the merchant\'s wares strewn round the village ({n}/{count})', 'Bring them back to the merchant'],
        offer: [
            'When they ran, the raiders dropped half of what they took. My wares are scattered from the well to the palisade.',
            'Bolts of cloth, a spice box, a lamp or two. Six bundles, by my count. I would fetch them myself, but...',
            { who: 'hero', text: 'But?' },
            "...but my knees, and the crows, and honestly I'd rather sit here and watch you do it. Ha! I'll pay, of course.",
        ],
        accept: { who: 'hero', text: "Six bundles. I'll find them." },
        done: [
            'All six! Not a seam torn. You have the eye of a quartermaster.',
            "Here, for your trouble. And some timber I'd saved for my own roof; you'll put it to better use.",
        ],
        reward: { gold: 60, wood: 10 },
    },
    strongbox: {
        giver: 'merchant', order: 3, kind: 'fetch', title: 'The Strongbox', needs: { quest: 'wares' },
        exp: 'fallen_bastion', map: 'castle', near: 'the treasury', item: 'The merchant\'s strongbox', // the keep's treasury
        steps: ["Find the merchant's strongbox in the Bastion's treasury (noticeboard: The Fallen Bastion)", 'Bring the strongbox home'],
        offer: [
            "I've a confession. The raiders didn't just take my stock. They took my strongbox. Iron, brass corners, my mark on the lid.",
            "Everything I've saved for twenty years. They'd have hauled it to that castle of theirs, to Valerius's treasury.",
            { who: 'hero', text: "I've been in that treasury. Gold heaped to the ceiling." },
            "Then mine will be the one with the dent in the lid. If you go back... I'd be in your debt. Truly.",
        ],
        accept: { who: 'hero', text: "If it's there, I'll bring it home." },
        done: [
            'My strongbox! The dent and all. They never even got the lock open, ha!',
            "Listen. From today, you pay what I pay. Well, near enough. Fifteen off every price in my shop, for as long as I'm trading.",
            'And take this, from the box. A man who carries his savings home deserves a cut of them.',
        ],
        reward: { gold: 200, perk: 'merchant_discount' },
    },

    // ---------------- the apothecary ----------------
    herbs: {
        giver: 'apothecary', order: 1, kind: 'fetch', title: 'The Herb Chest',
        exp: 'raiders_camp', map: 'trail', near: "the bandits' hunting camp", item: "The apothecary's herb chest", // the Raiders' Trail camp
        steps: ["Find the apothecary's herb chest at the hunting camp (noticeboard: The Raiders' Camp)", 'Bring the herb chest back'],
        offer: [
            "They took my herb chest. Not the coin, not the silver spoons. My herbs. Brutes don't even know what half of them do.",
            "Moonwort, ember-root, dried mireflower. Years of gathering. I'd bet my last bandage it's at that camp of theirs on the trail.",
            { who: 'hero', text: 'The camp by the river road. I know it.' },
            "Then you know it stinks of wet hound. Bring the chest back, and I'll brew you anything you like for a song.",
        ],
        accept: { who: 'hero', text: "I'll get your herbs back." },
        done: [
            "My chest! They didn't even open the mireflower drawer. Good. It would've given them a rash they'd never forget.",
            "A promise is a promise: from now on my elixirs are twenty a bottle for you. Don't tell the merchant.",
        ],
        reward: { perk: 'apoth_elixir' },
    },
    cores: {
        giver: 'apothecary', order: 2, kind: 'bounty', title: 'Crystal Cores', needs: { quest: 'herbs' },
        exp: 'silent_hive', enemy: 'crystal_slime', count: 12,
        steps: ['Shatter crystal slimes in the hive ({n}/{count}) (noticeboard: The Silent Hive)', 'Bring the cores to the apothecary'],
        offer: [
            "Have you ever seen a crystal slime up close? The core inside them hums. Ground fine, it's the best mender of bone I know.",
            "Twelve cores would keep my shelves for a year. With the Queen dead, they've crawled back into her hive in their hundreds.",
            { who: 'hero', text: "They reflect half of what you throw at them." },
            "Then don't throw. Hit them very hard, very close. That's medical advice.",
        ],
        accept: { who: 'hero', text: 'Twelve cores. Very hard, very close.' },
        done: [
            "Twelve, and hardly chipped. You do listen. That's rarer than crystal.",
            "Here. Gold, and the stone you'll want for your rebuilding. And this pouch: I've stitched a little of everything into it.",
            "Hang it on your flask strap. The herbs steep into whatever you drink. You'll feel the difference.",
        ],
        reward: { gold: 100, stone: 15, keepsake: 'herb_pouch' },
    },
    salve: {
        giver: 'apothecary', order: 3, kind: 'deliver', title: 'A Salve for the Smith', needs: { quest: 'cores' },
        to: 'smith', item: 'A jar of burn salve',
        steps: ['Bring the burn salve to the smith', 'Tell the apothecary how he took it'],
        offer: [
            "The smith burned both hands dragging his tools out of the fire. He won't come to me. Too proud, the old ox.",
            "This salve will have them healed in a week. He won't take it from me, but he'll take it from you.",
        ],
        accept: { who: 'hero', text: "I'll make sure he uses it." },
        deliver: [ // the smith, when the hero hands it over
            { who: 'hero', text: 'From the apothecary. For your hands.' },
            "Hmph. Tell her I'm fine. I've had worse burns from my own breakfast.",
            '...',
            "It does cool, though. Fine. Fine! Tell her... tell her thank you. And not to make a fuss about it.",
        ],
        done: [
            'He took it? He actually put it on? Ha! I could kiss you. Well, no. But I could pay you.',
            "And I'll be making that old ox a new jar every week, whether he likes it or not.",
        ],
        reward: { gold: 50 },
    },

    // ---------------- the smith ----------------
    hammer: {
        giver: 'smith', order: 1, kind: 'fetch', title: "My Father's Hammer",
        exp: 'fallen_bastion', map: 'castle', near: "the outer bailey's smithy", item: "The smith's old hammer", // the castle's smithy
        steps: ["Find the smith's hammer in the Bastion's smithy (noticeboard: The Fallen Bastion)", 'Bring the hammer back to the smith'],
        offer: [
            "My father's hammer. Forged it himself, fifty years back. Hickory haft, a lion stamped on the cheek.",
            'Hung over my anvil my whole life. The raiders took it. Took it, of all things, out of a burning house.',
            "Their castle has a smithy. A bandit with an eye for good iron would hang it there. Looters are crawling over that place now, so be quick.",
            { who: 'hero', text: 'A lion on the cheek. I will find it.' },
        ],
        accept: { who: 'hero', text: "I'll bring it home." },
        done: [
            '...',
            "That's it. That's his. Feel the balance on it. They don't make them like this anymore. I don't make them like this anymore.",
            "I owe you more than I can pay, so here's what I can: your steel goes on my anvil first, and for less. Fifteen less, every time.",
        ],
        reward: { perk: 'smith_discount' },
    },
    hounds: {
        giver: 'smith', order: 2, kind: 'bounty', title: 'The Hounds', needs: { quest: 'hammer' },
        exp: 'raiders_camp', enemy: 'hound', count: 15,
        steps: ["Kill the feral hounds at the raiders' camp ({n}/{count}) (noticeboard: The Raiders' Camp)", 'Tell the smith the hounds are dealt with'],
        offer: [
            'Those war-hounds the raiders keep. They came in first, the night of the raid. Ran the guards down before the bandits ever reached the gate.',
            "Killed my old dog, too. Fifteen years, that dog. Never bit anyone who didn't deserve it.",
            "The Beastmaster's dead, but his kennels weren't empty. They say the pack's gone wild out at the old camp on the trail.",
            { who: 'hero', text: "Then I'll finish what he started." },
        ],
        accept: { who: 'hero', text: 'Fifteen hounds. For your dog.' },
        done: [
            "Fifteen. Good. That's good.",
            "Here. Gold, and iron I'd been hoarding. And this: a tooth off the first hound that came through the gate. I kept it.",
            "Wear it. Let it remind you to keep moving. Something's always chasing.",
        ],
        reward: { gold: 150, iron: 15, keepsake: 'hound_tooth' },
    },
};

// The keepsakes: one-off trinkets only quests give. Not gear: they're always carried, listed in the Tab sheet.
const KEEPSAKES = {
    lucky_coin: { name: 'Lucky Coin', desc: '+15% gold from kills', from: 'ruins' },
    herb_pouch: { name: 'Herb Pouch', desc: 'Your flask heals 10% more', from: 'cores' },
    hound_tooth: { name: 'Hound-Tooth Charm', desc: '+5% move speed', from: 'hounds' },
};
// The friends' favours: their services, better for you
const PERKS = {
    merchant_discount: { name: "The Merchant's Favour", desc: '15% off every price in his shop' },
    apoth_elixir: { name: "The Apothecary's Favour", desc: 'Elixirs cost 20 gold instead of 30' },
    smith_discount: { name: "The Smith's Favour", desc: 'Upgrades cost 15% less' },
};

// ---------- the talk menu's texts ----------
// Greetings open the menu (one line, picked by what's true now; the first match wins). Chat lines are pools: the menu's
// Chat plays one conversation from the first pool whose `when` holds, trying not to repeat the last one.
// `when` keys: built (their building rebuilt), quest:<id> (that quest done), cleared:<dungeon>, else always.
const TALK = {
    merchant: {
        greet: [
            { when: 'built', line: 'Welcome, welcome! Fair prices, mostly.' },
            { line: "Ah, my favourite customer. Not that I've a shop to sell from." },
        ],
        service: 'Trade',
        chat: [
            { when: 'quest:strongbox', convo: [
                ["Twenty years of savings, back under my bed. I sleep like a baby now. A rich baby."],
                ['I counted the strongbox three times last night. Then a fourth, for luck.', { who: 'hero', text: 'And?' }, 'Still all there. Ha!'],
            ] },
            { when: 'built', convo: [
                ["Customers again! Well. You, mostly. But the roads will open, and they'll come."],
                ['The roof only leaks over the silks now. Progress!'],
                ["A caravan from the south sent word. They'd heard Valerius fell. They're coming to see if it's true."],
            ] },
            { convo: [
                ["The guards were good men. Most of them were younger than you. I sold one his first sword."],
                ["Do you know what they took first? The ale. Before the gold, before the silver. Priorities, I suppose."],
                ['I keep flipping this coin, waiting for it to land on a better day.', { who: 'hero', text: 'Has it?' }, 'Today it landed on you. So, yes.'],
            ] },
        ],
    },
    apothecary: {
        greet: [
            { when: 'built', line: 'Mind the drying racks. What do you need?' },
            { line: "You're not bleeding, are you? Good. Then what is it?" },
        ],
        service: 'Remedies',
        chat: [
            { when: 'quest:salve', convo: [
                ["The smith came by. Asked for 'some more of the cold stuff'. For his hands. Not that he needed it, he says."],
            ] },
            { when: 'built', convo: [
                ['The garden behind the house came back on its own. Mint is stubborn. I respect that.'],
                ['Half of medicine is knowing which plant kills you. The other half is knowing how much.'],
            ] },
            { convo: [
                ["I patched up who I could, the night of the raid. It wasn't enough. It's never enough."],
                ['The rain got into what the fire missed. I have three dry herbs left, and one of them is a weed.'],
                ["You've a scar there I haven't seen before. The Bastion?", { who: 'hero', text: 'A spear on a chain.' }, "Hold still next time. I'll give you something for it."],
            ] },
        ],
    },
    smith: {
        greet: [
            { when: 'built', line: 'Forge is hot. What are we making?' },
            { line: "Hmph. You again. Good." },
        ],
        service: 'Smithing',
        chat: [
            { when: 'quest:hammer', convo: [
                ["Every morning I take my father's hammer down, and I put it back up. Never strike with it. Just feel the weight."],
            ] },
            { when: 'built', convo: [
                ["Rebuilt it a hand's width wider. Room for a second anvil, if I ever take an apprentice."],
                ['Good steel is patient. Bad steel is in a hurry. Most people are bad steel.'],
            ] },
            { convo: [
                ["Forty years at that forge. Never once let it go cold. And now look at it."],
                ['I pulled what tools I could out of the fire. Burned my hands doing it. Worth it.', { who: 'hero', text: 'Do they hurt?' }, "Only when I think about them. So I don't."],
                ['That Valerius. I shod his horse once, years ago. Before he was anything. Should have dropped the hammer on his foot.'],
            ] },
        ],
    },
};

// ---------- expeditions and memories (expeditions.js) ----------
// Expeditions: short trips from the noticeboard to places the hero knows, as they are now, after the story: the map with its
// story scenes off, three waves of what lives there now, then a named chief (an existing enemy type, scaled and tinted),
// a purse, and the road home. Repeatable. Quest items and bounty kills count only here (the present).
// Memories: the full dungeons replayed as the hero remembers them (the parchment map, behind the board's "Memories" notice).
const EXPEDITIONS = {
    fallen_bastion: {
        name: 'The Fallen Bastion', map: 'castle', dungeon: 'bandit_bastion',
        notice: ['WANTED: able blades.', "With the King of Thieves dead, looters and deserters are picking his castle clean. Whatever's left of Cinderholt's in there, it won't be for long."],
        poster: 'The merchant',
        foes: ['thief', 'archer', 'shield', 'crossbow', 'halberd', 'grenadier', 'cutpurse'],
        chief: { type: 'halberd', name: 'Harrow the Deserter', title: 'Captain of the Turncoats', scale: 1.6, tint: '#8e1f1f',
            bark: "Valerius is dead, and the gold's mine. Walk away.", move: 'rally' }, // at half health he calls his men out of the doorways
        purse: 140,
    },
    raiders_camp: {
        name: "The Raiders' Camp", map: 'trail', dungeon: 'bandit_bastion',
        notice: ['BEWARE: wild dogs on the trail road.', "The Beastmaster's hounds have gone feral at the old raider camp. Two carts lost this week. Travellers keep away, or bring a sword."],
        poster: 'A carter, by the look of the hand',
        foes: ['hound', 'hound', 'hound', 'trapper', 'slinger'],
        chief: { type: 'hound', name: 'Old Scar', title: 'Leader of the Pack', scale: 2.1, tint: '#5d4a3a',
            bark: null, move: 'howl' }, // at half health it howls and the pack comes running
        purse: 120,
    },
    silent_hive: {
        name: 'The Silent Hive', map: 'hive', dungeon: 'slime_caves',
        notice: ['The Slime Caves.', "Since the Queen fell the hive has gone quiet. Too quiet: the crystal slimes are breeding in the dark, and the cave mouth glitters at night."],
        poster: 'The apothecary',
        foes: ['crystal_slime', 'crystal_slime', 'spore_slime', 'slime_warden'],
        chief: { type: 'crystal_slime', name: 'The Prism', title: 'Heart of the Hive', scale: 2.4, tint: '#b388ff',
            bark: null, move: 'shatter' }, // throws a ring of shards; splits into three crystal slimes when it dies
        purse: 120,
    },
};
// The memory card shown before a full replay (the noticeboard's "Memories" -> the parchment map)
const MEMORIES = {
    slime_caves: { title: 'A memory: the Slime Caves', line: 'You remember the caves as they were, the first time: the stench of the lakes, the King in the clearing, the Queen on her throne.' },
    bandit_bastion: { title: 'A memory: the Bandit Bastion', line: 'You remember Cinderholt burning, the raiders on the trail, and the long road to the castle of the King of Thieves.' },
    fade: 'The memory fades.',
};
