/* NEblox — Polished single-file game logic
   - Put required image & audio files in /assets/ as documented.
   - If player sprite frame size differs, modify FRAME_W/FRAME_H and NUM_RUN_FRAMES.
*/

// ---------- CONFIG (adjust if needed) ----------
const CANVAS_W = 900, CANVAS_H = 500;

// Player sprite sheet frame size (change if your sprite differs)
const FRAME_W = 72;      // width per frame in player.png
const FRAME_H = 72;      // height per frame
const NUM_RUN_FRAMES = 4; // number of frames for running animation (frames 1..NUM_RUN_FRAMES)
const JUMP_FRAME_INDEX = NUM_RUN_FRAMES + 1; // frame index for jump (optional)

// ---------- DOM ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("startScreen");
const startBtn = document.getElementById("startBtn");
const questionBox = document.getElementById("questionBox");
const questionText = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const submitAnswer = document.getElementById("submitAnswer");
const cancelAnswer = document.getElementById("cancelAnswer");
const gameOver = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const hasKeyEl = document.getElementById("hasKey");
const muteBtn = document.getElementById("muteBtn");
const finalScore = document.getElementById("finalScore");

// ---------- Assets (paths) ----------
const ASSETS = {
  bg: "assets/background.png",
  startBtn: "assets/start-button.png",
  player: "assets/player.png",
  platform: "assets/platform.png",
  enemy: "assets/enemy.png",
  key: "assets/key.png",
  door: "assets/door.png",
  bgm: "assets/bgm.mp3",   // optional
  keySfx: "assets/key.wav" // optional
};

// ---------- Game state ----------
let running = false;
let pausedForQuiz = false;
let score = 0;
let lives = 3;
let hasKey = false;
let soundOn = true;

// ------- Load images & audio (simple loader) -------
const images = {};
const audio = {};

function loadImage(name, src) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => { images[name] = i; res(); };
    i.onerror = () => { images[name] = null; res(); };
    i.src = src;
  });
}
function loadAudio(name, src) {
  return new Promise(res => {
    const a = new Audio();
    a.onloadeddata = () => { audio[name] = a; res(); };
    a.onerror = () => { audio[name] = null; res(); };
    a.src = src;
    a.load();
  });
}

async function preload() {
  const promises = [
    loadImage("bg", ASSETS.bg),
    loadImage("player", ASSETS.player),
    loadImage("platform", ASSETS.platform),
    loadImage("enemy", ASSETS.enemy),
    loadImage("key", ASSETS.key),
    loadImage("door", ASSETS.door),
    loadImage("startBtn", ASSETS.startBtn)
  ];
  // optional audio
  promises.push(loadAudio("bgm", ASSETS.bgm));
  promises.push(loadAudio("keySfx", ASSETS.keySfx));
  await Promise.all(promises);
  // set looping bgm volume
  if (audio.bgm) { audio.bgm.loop = true; audio.bgm.volume = 0.35; }
}

// ---------- Entities ----------
const player = {
  x: 80, y: 350, w: 48, h: 64, vx: 0, vy: 0, onGround: false, dir: 1
};

const platforms = [
  { x: 0, y: 430, w: 900, h: 70, type: "long" }, // ground
  { x: 220, y: 340, w: 140, h: 16, type: "mid" },
  { x: 430, y: 280, w: 120, h: 16, type: "mid" },
  { x: 630, y: 220, w: 120, h: 16, type: "mid" }
];

let enemies = [
  { x: 320, y: 390, w: 40, h: 40, dir: 1, speed: 1.6, minX: 260, maxX: 420 },
  { x: 520, y: 250, w: 40, h: 40, dir: -1, speed: 1.2, minX: 430, maxX: 720 }
];

const keyObj = { x: 720, y: 180, w: 30, h: 30, taken: false };
const doorObj = { x: 820, y: 360, w: 48, h: 68 };

// simple quiz pool
const quizList = [
  { q: "Ibu kota Indonesia?", a: "jakarta" },
  { q: "Planet terbesar di tata surya?", a: "jupiter" },
  { q: "Gunung tertinggi di dunia?", a: "everest" },
  { q: "Lambang kimia air?", a: "h2o" },
  { q: "Presiden pertama Indonesia?", a: "soekarno" }
];
let currentQuestion = null;
let quizCallback = null;

// input
const keys = { left:false, right:false, up:false };

// animation counters
let runFrame = 0, tick = 0;

// ---------- helpers ----------
function rectOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function playSound(name){
  if(!soundOn) return;
  const s = audio[name];
  if(s){ s.currentTime = 0; s.play(); }
}

// ---------- UI updates ----------
function updateHUD(){
  scoreEl.textContent = "Score: " + score;
  livesEl.textContent = "Lives: " + lives;
  hasKeyEl.textContent = "Key: " + (hasKey ? "✅" : "❌");
  muteBtn.textContent = soundOn ? "🔊" : "🔈";
}

// ---------- quiz popup ----------
function showQuiz(cb){
  if(pausedForQuiz) return;
  pausedForQuiz = true;
  currentQuestion = quizList[Math.floor(Math.random()*quizList.length)];
  questionText.textContent = currentQuestion.q;
  answerInput.value = "";
  questionBox.classList.remove("hidden");
  quizCallback = cb;
}
submitAnswer.onclick = () => {
  const ans = answerInput.value.trim().toLowerCase();
  questionBox.classList.add("hidden");
  const correct = ans === (currentQuestion?.a || "");
  pausedForQuiz = false;
  currentQuestion = null;
  if(quizCallback) quizCallback(correct);
};
cancelAnswer.onclick = () => {
  questionBox.classList.add("hidden");
  pausedForQuiz = false;
  if(quizCallback) quizCallback(false);
};

// ---------- start / restart ----------
startBtn.onclick = () => {
  // start only if images loaded
  startScreen.style.display = "none";
  if(audio.bgm && soundOn) audio.bgm.play();
  startLoop();
};
restartBtn.onclick = () => {
  // reset minimal state
  lives = 3; score = 0; hasKey = false;
  keyObj.taken = false;
  player.x = 80; player.y = 350; player.vx = 0; player.vy = 0;
  enemies = [
    { x: 320, y: 390, w: 40, h: 40, dir: 1, speed: 1.6, minX: 260, maxX: 420 },
    { x: 520, y: 250, w: 40, h: 40, dir: -1, speed: 1.2, minX: 430, maxX: 720 }
  ];
  updateHUD();
  gameOver.classList.add("hidden");
  startLoop();
};
muteBtn.onclick = () => {
  soundOn = !soundOn;
  if(!soundOn && audio.bgm){ audio.bgm.pause(); }
  else if(soundOn && audio.bgm && running){ audio.bgm.play(); }
  updateHUD();
};

// keyboard
window.addEventListener("keydown", e => {
  if(e.key === "ArrowLeft" || e.key === "a") keys.left = true;
  if(e.key === "ArrowRight" || e.key === "d") keys.right = true;
  if((e.key === "ArrowUp" || e.key === " " || e.key === "w")) keys.up = true;
});
window.addEventListener("keyup", e => {
  if(e.key === "ArrowLeft" || e.key === "a") keys.left = false;
  if(e.key === "ArrowRight" || e.key === "d") keys.right = false;
  if((e.key === "ArrowUp" || e.key === " " || e.key === "w")) keys.up = false;
});

// ---------- core loop ----------
let lastTime = 0;
function startLoop(){
  canvas.style.display = "block";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  updateHUD();
}

function stopLoop(){
  running = false;
  if(audio.bgm) audio.bgm.pause();
}

function loop(ts){
  if(!running) return;
  const dt = Math.min(40, ts - lastTime) / 16.666;
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- update physics & AI ----------
function update(dt){
  if(pausedForQuiz) return; // freeze game while answering

  // player horizontal
  const speed = 3.2;
  if(keys.left){ player.vx = -speed; player.dir = -1; }
  else if(keys.right){ player.vx = speed; player.dir = 1; }
  else player.vx = 0;

  // jump
  if(keys.up && player.onGround){ player.vy = -12.5; player.onGround = false; }

  // gravity & movement
  player.vy += 0.7;
  player.x += player.vx;
  player.y += player.vy;

  // platform collisions (simple AABB top-only)
  player.onGround = false;
  for(const p of platforms){
    if(player.x + player.w > p.x && player.x < p.x + p.w){
      // if falling and passes top
      if(player.y + player.h > p.y && player.y + player.h - player.vy <= p.y + 2){
        // landed
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }

  // bounds
  player.x = clamp(player.x, 0, CANVAS_W - player.w);
  if(player.y > CANVAS_H + 100){
    // fell off
    loseLife();
  }

  // enemies update
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.x += e.speed * e.dir;
    if(e.x < e.minX){ e.x = e.minX; e.dir = 1; }
    if(e.x > e.maxX){ e.x = e.maxX; e.dir = -1; }

    if(rectOverlap(player, e)){
      // check stomp
      if(player.vy > 0 && (player.y + player.h) <= (e.y + 12)){
        // stomp
        enemies.splice(i,1);
        player.vy = -8;
        score += 25;
        playSound("keySfx"); // reuse small sfx if present
        updateHUD();
      } else {
        // hit
        loseLife();
      }
    }
  }

  // key pickup
  if(!keyObj.taken && rectOverlap(player, keyObj)){
    // pause and ask quiz
    showQuiz(correct => {
      if(correct){
        keyObj.taken = true;
        hasKey = true;
        score += 50;
        playSound("keySfx");
        updateHUD();
      } else {
        // small feedback
        if(soundOn) alert("Jawaban salah! Coba lagi nanti.");
      }
    });
  }

  // door open
  if(hasKey && rectOverlap(player, doorObj)){
    // level complete => simple flow: increase score, spawn new key and enemy as next level
    score += 150;
    hasKey = false;
    keyObj.taken = false;
    // move key & enemies for next stage (example)
    keyObj.x = 120; keyObj.y = 300;
    enemies = [
      { x: 360, y: 390, w: 40, h: 40, dir: 1, speed: 1.7, minX: 300, maxX: 460 }
    ];
    player.x = 60; player.y = 350;
    updateHUD();
    alert("Level selesai! Lanjut ke tantangan berikutnya.");
  }

  // animation tick
  tick++;
  if(tick > 6){ tick = 0; runFrame = (runFrame + 1) % NUM_RUN_FRAMES; }
}

// ---------- lose life ----------
function loseLife(){
  lives -= 1;
  updateHUD();
  if(lives <= 0){
    gameOverFlow();
  } else {
    // respawn
    player.x = 60; player.y = 350; player.vx = 0; player.vy = 0;
    hasKey = false;
    keyObj.taken = false;
    playSound("keySfx");
  }
}

function gameOverFlow(){
  running = false;
  gameOver.classList.remove("hidden");
  finalScore.textContent = "Score: " + score;
  if(audio.bgm) audio.bgm.pause();
}

// ---------- RENDER ----------
function render(){
  // background
  if(images.bg) ctx.drawImage(images.bg, 0, 0, CANVAS_W, CANVAS_H);
  else { ctx.fillStyle = "#9fd3ff"; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }

  // platforms using tile: scale image to platform width
  for(const p of platforms){
    if(images.platform){
      // draw tiled (repeat) to avoid stretching artifacts
      const pattern = ctx.createPattern(images.platform, 'repeat-x');
      ctx.fillStyle = pattern;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = "#6b3";
      ctx.fillRect(p.x,p.y,p.w,p.h);
    }
  }

  // key
  if(!keyObj.taken){
    if(images.key) ctx.drawImage(images.key, keyObj.x, keyObj.y, keyObj.w, keyObj.h);
    else { ctx.fillStyle="gold"; ctx.fillRect(keyObj.x,keyObj.y,keyObj.w,keyObj.h); }
  }

  // door
  if(images.door) ctx.drawImage(images.door, doorObj.x, doorObj.y, doorObj.w, doorObj.h);
  else { ctx.fillStyle="#7b4"; ctx.fillRect(doorObj.x,doorObj.y,doorObj.w,doorObj.h); }

  // enemies
  for(const e of enemies){
    if(images.enemy) ctx.drawImage(images.enemy, e.x, e.y, e.w, e.h);
    else { ctx.fillStyle="crimson"; ctx.fillRect(e.x,e.y,e.w,e.h); }
  }

  // player (sprite sheet)
  if(images.player){
    // choose frame
    let frameIndex = 0; // idle
    if(!player.onGround) frameIndex = JUMP_FRAME_INDEX;      // jump
    else if(Math.abs(player.vx) > 0.1) frameIndex = 1 + runFrame; // run frames (1..NUM_RUN_FRAMES)
    // clamp frameIndex if user sprite small
    const sx = frameIndex * FRAME_W;
    const sy = 0;
    ctx.save();
    if(player.dir < 0){
      // flip horizontally
      ctx.translate(player.x + player.w/2, 0);
      ctx.scale(-1,1);
      ctx.translate(-(player.x + player.w/2), 0);
    }
    ctx.drawImage(images.player, sx, sy, FRAME_W, FRAME_H, player.x, player.y, player.w, player.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0b57a4";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
}

// ---------- init ----------
(async function init(){
  await preload();
  // if startBtn image missing, leave default <img> alt but still clickable
  // Show start screen (already visible)
  updateHUD();
})();
