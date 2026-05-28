// ==========================================
// globals.js - Central State & Variables
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, LEVELUP: 3, EVOLVE: 4, INTERMISSION: 5, INVENTORY: 6, SHOP: 7, DEAD: 8, VICTORY: 9, DEV: 10 };
let gameState = STATE.MENU;

let lastTime = performance.now();
let score = 0; let wave = 1; let enemiesToSpawn = 0; let enemySpawnTimer = 0; let activeEnemies = 0; let isBossWave = false; let bossSpawned = false;
let hitStopTimer = 0; let isEndlessMode = false; let devNoCooldowns = false;

const keys = { w: false, a: false, s: false, d: false };
let isMouseDown = false; let mouseX = canvas.width / 2; let mouseY = canvas.height / 2;

const player = { 
    x: 0, y: 0, radius: 18, speed: 250, isMoving: false,
    level: 1, xp: 0, maxXp: 50,
    baseHp: 100, hp: 100, maxHp: 100, shield: 0, shieldTimer: 0,
    gold: 0, bonusDmg: 0.0, skillPoints: 0, armor: 0,
    frenzyStacks: 0, frenzyTimer: 0, momentum: 0, arcaneResonance: false, iFrames: 0,
    blade: null 
};

let classDataConfig = {}; let enemyDataConfig = {}; let itemDataConfig = {};
let selectedClassId = null; let activeClass = null; let activeDungeon = null; let activeDungeonId = null;
let equipment = { weapon: null, armor: null, amulet: null, boots: null, gloves: null };
let inventory = []; let shopItems = [];
let evolvingSkillId = null; let isProcessingClick = false; 

const cooldowns = { basic: 0, s1: 0, s2: 0, s3: 0, s4: 0, rmb: 0 };
const buffs = { rapidFire: 0, msBoost: 0, slowed: 0, ironBulwark: 0, rooted: 0, powerSurgeStacks: 0, powerSurgeTimer: 0, weakened: 0, evade100: 0, deathMarkActive: 0, overclockTimer: 0, bladeCascade: 0, cascadeTimer: 0 };
const enemies = []; const projectiles = []; const effects = []; const drops = [];
const el = (id) => document.getElementById(id);

let currentMap = { type: 'open', left: 0, right: 0, top: 0, bottom: 0, valeriusTriggered: false };