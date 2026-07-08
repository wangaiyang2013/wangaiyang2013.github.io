(function () {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const resetBtn = document.getElementById("reset");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");

  document.getElementById("year").textContent = new Date().getFullYear();

  const GRID = 20;
  const SIZE = canvas.width; // 400
  const CELL = SIZE / GRID;

  let snake, dir, nextDir, food, score, speed, timer, running, paused, dead;

  const best = Number(localStorage.getItem("snakeBest") || 0);
  bestEl.textContent = "最高 " + best;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    speed = 130;
    paused = false;
    dead = false;
    running = false;
    scoreEl.textContent = "0";
    spawnFood();
    draw();
  }

  function spawnFood() {
    let p;
    do {
      p = { x: rand(GRID), y: rand(GRID) };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    food = p;
  }

  function rand(n) { return Math.floor(Math.random() * n); }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // 撞墙
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) return gameOver();
    // 撞自己
    if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = score;
      if (score > best) {
        localStorage.setItem("snakeBest", score);
        bestEl.textContent = "最高 " + score;
      }
      spawnFood();
      if (speed > 60) {
        speed -= 6;
        clearInterval(timer);
        timer = setInterval(step, speed);
      }
    } else {
      snake.pop();
    }
    draw();
  }

  function gameOver() {
    dead = true;
    running = false;
    clearInterval(timer);
    overlayText.textContent = "游戏结束 · 得分 " + score;
    startBtn.textContent = "再来一局";
    overlay.classList.remove("hidden");
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.fillStyle = dark ? "#232029" : "#efece6";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 食物
    ctx.fillStyle = "#e2603f";
    roundRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6, 6);
    ctx.fill();

    // 蛇
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      if (i === 0) {
        ctx.fillStyle = dark ? "#ff7a55" : "#e2603f";
      } else {
        const t = i / snake.length;
        ctx.fillStyle = dark
          ? "rgb(" + Math.round(255 - t * 90) + "," + Math.round(122 - t * 40) + "," + Math.round(85 - t * 30) + ")"
          : "rgb(" + Math.round(226 - t * 90) + "," + Math.round(96 - t * 40) + "," + Math.round(63 - t * 20) + ")";
      }
      roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5);
      ctx.fill();
    }
  }

  function start() {
    reset();
    overlay.classList.add("hidden");
    running = true;
    clearInterval(timer);
    timer = setInterval(step, speed);
  }

  function setDir(x, y) {
    if (!running || paused) return;
    if (x === -dir.x && y === -dir.y) return; // 禁止反向
    nextDir = { x, y };
  }

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "w"].includes(k)) { setDir(0, -1); e.preventDefault(); }
    else if (["arrowdown", "s"].includes(k)) { setDir(0, 1); e.preventDefault(); }
    else if (["arrowleft", "a"].includes(k)) { setDir(-1, 0); e.preventDefault(); }
    else if (["arrowright", "d"].includes(k)) { setDir(1, 0); e.preventDefault(); }
    else if (k === " ") {
      if (running && !dead) { paused = !paused; if (paused) clearInterval(timer); else timer = setInterval(step, speed); }
      e.preventDefault();
    }
  });

  // 触屏滑动
  let tStart = null;
  canvas.addEventListener("touchstart", (e) => { tStart = e.changedTouches[0]; }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (!tStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tStart.clientX, dy = t.clientY - tStart.clientY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    tStart = null;
  }, { passive: true });

  startBtn.addEventListener("click", start);
  resetBtn.addEventListener("click", start);

  reset();
})();
