// ==========================================
// globals.js - Central State & Variables
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, TREE: 3, INTERMISSION: 5, INVENTORY: 6, SHOP: 7, DEAD: 8, VICTORY: 9, DEV: 10, LETTER: 11, DIALOGUE: 12, SPELLBOOK: 13 };
let gameState = STATE.MENU;

let lastTime = performance.now();
const WAVE_BREAK = 4; let waveBreak = 0; // seconds left in the breather between regular waves (stage.js onWaveCleared)
let waveStats = { kills: 0, gold0: 0, time: 0, dmgTaken: 0, peak: 0 }; let shopWave = -1; // per-wave numbers for the wave-cleared screen; the wave the shop stock was rolled for
let score = 0; let wave = 1; let enemiesToSpawn = 0; let enemySpawnTimer = 0; let activeEnemies = 0; let isBossWave = false; let bossSpawned = false;
let hitStopTimer = 0; let isEndlessMode = false; let devNoCooldowns = false;

const keys = { w: false, a: false, s: false, d: false };
let isMouseDown = false; let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;

const player = { 
    x: 0, y: 0, radius: 18, speed: 250, isMoving: false,
    level: 1, xp: 0, maxXp: 50,
    baseHp: 100, hp: 100, maxHp: 100, shield: 0, shieldTimer: 0,
    gold: 0, orbDmg: 0.0, skillPoints: 0, armor: 0,
    tree: {}, treeHp: 0, treePower: 0, treeCdr: 0, treeSpeed: 0, // skilltree.js: the talents taken and what the class talents add
    frenzyStacks: 0, frenzyTimer: 0, momentum: 0, arcaneResonance: 0, scrap: 0, iFrames: 0,
    blade: null, flow: 0, maxFlow: 100, stance: 'handheld', parryTimer: 0, airborneBlade: null,
    zeal: 0, maxZeal: 100
};

let classDataConfig = {}; let enemyDataConfig = {}; let itemDataConfig = {};
let selectedClassId = null; let activeClass = null; let activeDungeon = null; let activeDungeonId = null;
let equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null };
let inventory = []; let shopItems = [];

const cooldowns = { basic: 0, s1: 0, s2: 0, s3: 0, s4: 0, rmb: 0 };
const cooldownMax = { basic: 0, s1: 0, s2: 0, s3: 0, s4: 0 }; // full length of the last cooldown started (HUD overlay, swing animations)
const buffs = { rapidFire: 0, msBoost: 0, slowed: 0, dragonfire: 0, rooted: 0, weakened: 0, evade100: 0, deathMarkActive: 0, overclockTimer: 0, avatarOfRenewal: 0, aspectOfReaper: 0, ascension: 0, zealLocked: false, lastSpellClass: null, inSanctuary: false, barkskin: false, feralSurge: 0, direWolf: 0 };
const enemies = []; const projectiles = []; const effects = []; const drops = [];
const el = (id) => document.getElementById(id);

let currentMap = { type: 'open', left: 0, right: 0, top: 0, bottom: 0 };