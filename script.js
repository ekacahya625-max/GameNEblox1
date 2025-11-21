const canvas = document.getElementById("gameCanvas");
const c = canvas.getContext("2d");

let running = false;

// PLAYER
let player = { x: 50, y: 380, w: 40, h: 60, speed: 4, dy: 0, jump: false };

// ENEMY
let enemy = { x: 500, y: 390, w: 40, h: 60, speed: 2 };

// KEY
let key = { x: 750, y: 350, w: 30, h: 30, collected: false };

// DOOR
let door = { x: 820, y: 360, w: 60, h: 100 };

// Physics
const gravity = 0.45;

// Keyboard
let keys = {};

document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// START BUTTON
document.getElementById("startBtn").addEventListener("click", () => {
    document.getElementById("startScreen").style.display = "none";
    canvas.style.display = "block";
    running = true;
    gameLoop();
});

function updatePlayer() {
    if (keys["ArrowRight"]) player.x += player.speed;
    if (keys["ArrowLeft"]) player.x -= player.speed;

    if (keys[" "] && !player.jump) {
        player.dy = -10;
        player.jump = true;
    }

    player.dy += gravity;
    player.y += player.dy;

    if (player.y > 380) {
        player.y = 380;
        player.dy = 0;
        player.jump = false;
    }
}

function updateEnemy() {
    enemy.x += enemy.speed;
    if (enemy.x <= 100 || enemy.x >= 600) enemy.speed *= -1;

    if (checkCollision(player, enemy)) {
        alert("Kamu terkena musuh! Game Over.");
        location.reload();
    }
}

function checkCollision(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

function checkKeyPickup() {
    if (!key.collected && checkCollision(player, key)) {
        let q = prompt("Jawab pertanyaan: Ibu kota Indonesia?");
        if (q && q.toLowerCase() === "jakarta") {
            key.collected = true;
            alert("Benar! Kamu mendapatkan kunci 🔑");
        } else {
            alert("Jawaban salah. Coba lagi mengambil kunci.");
        }
    }
}

function checkDoor() {
    if (checkCollision(player, door)) {
        if (key.collected) {
            alert("Selamat! Kamu naik level 🎉");
            location.reload();
        } else {
            alert("Kunci belum ditemukan!");
        }
    }
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = "blue";
    c.fillRect(player.x, player.y, player.w, player.h);

    c.fillStyle = "red";
    c.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);

    if (!key.collected) {
        c.fillStyle = "yellow";
        c.fillRect(key.x, key.y, key.w, key.h);
    }

    c.fillStyle = "brown";
    c.fillRect(door.x, door.y, door.w, door.h);
}

function gameLoop() {
    if (!running) return;
    updatePlayer();
    updateEnemy();
    checkKeyPickup();
    checkDoor();
    draw();
    requestAnimationFrame(gameLoop);
}
