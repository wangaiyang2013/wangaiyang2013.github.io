(function () {
  "use strict";

  const canvas = document.getElementById("plane");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySub = document.getElementById("overlaySub");
  const startBtn = document.getElementById("startBtn");

  document.getElementById("year").textContent = new Date().getFullYear();

  const W = 400, H = 600;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const ENEMY_TYPES = [
    { r: 14, hp: 1, vy: 2.6, score: 10, color: "#f0604f" },
    { r: 20, hp: 3, vy: 1.9, score: 25, color: "#f0a04f" },
    { r: 28, hp: 6, vy: 1.25, score: 60, color: "#b06ef0" }
  ];

  let state, player, bullets, enemies, particles, powerups, stars;
  let score, lives, lastTs, spawnTimer, fireTimer, powerTimer, running, raf;

  function reset() {
    score = 0; lives = 3; spawnTimer = 0; fireTimer = 0; powerTimer = 0;
    bullets = []; enemies = []; particles = []; powerups = [];
    player = { x: W / 2, y: H - 60, w: 34, h: 36, speed: 4.2, fire: 1, inv: 0 };
    stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vy: 0.6 + Math.random() * 1.6, s: 0.6 + Math.random() * 1.6
    }));
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    livesEl.textContent = lives > 0 ? "❤".repeat(lives) : "—";
  }

  function spawnEnemy() {
    const t = ENEMY_TYPES[Math.min(ENEMY_TYPES.length - 1, Math.floor(Math.random() * (enemies.length > 6 ? 3 : 2)))];
    const diff = 1 + score / 1200;
    enemies.push({
      x: t.r + Math.random() * (W - 2 * t.r), y: -t.r,
      r: t.r, hp: t.hp, maxhp: t.hp, vy: t.vy * diff, score: t.score,
      color: t.color, sway: Math.random() * Math.PI * 2, swayAmp: t.r > 16 ? 0.9 : 0.4, baseX: 0
    });
    enemies[enemies.length - 1].baseX = enemies[enemies.length - 1].x;
  }

  function fire() {
    const n = player.fire >= 2 ? 3 : 1;
    const spread = [-8, 0, 8];
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : spread[i];
      bullets.push({ x: player.x + off, y: player.y - player.h / 2, vy: -7, w: 4, h: 12 });
    }
  }

  function explode(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.4;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  function spawnPower() {
    powerups.push({ x: 20 + Math.random() * (W - 40), y: -16, vy: 1.8, r: 12 });
  }

  // —— 输入 ——
  const keys = {};
  let pointer = { active: false, x: W / 2, y: H - 60 };

  document.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if (!running && (e.key === "Enter" || e.key === " ")) start();
  });
  document.addEventListener("keyup", (e) => { keys[e.key] = false; });

  function ptr(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    pointer.x = (t.clientX - rect.left) * (W / rect.width);
    pointer.y = (t.clientY - rect.top) * (H / rect.height);
  }
  canvas.addEventListener("mousedown", (e) => { pointer.active = true; ptr(e); });
  canvas.addEventListener("mousemove", (e) => { if (pointer.active) ptr(e); });
  window.addEventListener("mouseup", () => { pointer.active = false; });
  canvas.addEventListener("touchstart", (e) => { pointer.active = true; ptr(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => { ptr(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", () => { pointer.active = false; });

  function handleInput() {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
    if (dx || dy) {
      const m = Math.hypot(dx, dy) || 1;
      player.x += (dx / m) * player.speed;
      player.y += (dy / m) * player.speed;
    }
    if (pointer.active) {
      player.x += (pointer.x - player.x) * 0.28;
      player.y += (pointer.y - player.y) * 0.28;
    }
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
    player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));
  }

  // —— 更新 ——
  function update(dt) {
    handleInput();

    for (const s of stars) {
      s.y += s.vy * dt * 60;
      if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
    }

    fireTimer += dt * 1000;
    const interval = powerTimer > 0 ? 130 : 260;
    if (fireTimer >= interval) { fireTimer = 0; fire(); }

    for (const b of bullets) b.y += b.vy * dt * 60;
    bullets = bullets.filter(b => b.y > -20);

    if (powerTimer > 0) powerTimer -= dt * 1000;

    spawnTimer += dt * 1000;
    const spawnEvery = Math.max(360, 900 - score / 3);
    if (spawnTimer >= spawnEvery) { spawnTimer = 0; spawnEnemy(); if (Math.random() < 0.06) spawnPower(); }

    for (const e of enemies) {
      e.y += e.vy * dt * 60;
      e.sway += dt * 2;
      e.x = e.baseX + Math.sin(e.sway) * e.swayAmp * 14;
    }

    for (const p of powerups) p.y += p.vy * dt * 60;
    powerups = powerups.filter(p => p.y < H + 20);

    // 子弹 vs 敌机
    for (const b of bullets) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy <= e.r * e.r) {
          e.hp--; b.y = -999;
          explode(b.x, b.y, e.color, 4);
          if (e.hp <= 0) { score += e.score; explode(e.x, e.y, e.color, 16); updateHUD(); }
          break;
        }
      }
    }
    bullets = bullets.filter(b => b.y > -20);

    // 敌机 vs 玩家
    if (player.inv <= 0) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const rr = e.r + player.w * 0.4;
        if (dx * dx + dy * dy <= rr * rr) {
          e.hp = 0; explode(e.x, e.y, e.color, 18);
          hitPlayer(); break;
        }
      }
    } else {
      player.inv -= dt * 1000;
    }

    // 强化道具
    for (const p of powerups) {
      const dx = p.x - player.x, dy = p.y - player.y;
      if (dx * dx + dy * dy <= (p.r + player.w * 0.4) ** 2) {
        p.y = H + 50; player.fire = 3; powerTimer = 6000; explode(p.x, p.y, "#f2d43a", 12);
      }
    }
    if (powerTimer <= 0) player.fire = 1;

    enemies = enemies.filter(e => e.hp > 0 && e.y < H + e.r + 4);

    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= dt * 2; }
    particles = particles.filter(p => p.life > 0);
  }

  function hitPlayer() {
    lives--; updateHUD();
    explode(player.x, player.y, "#4f7af0", 20);
    player.inv = 1500;
    if (lives <= 0) gameOver();
  }

  // —— 绘制 ——
  function draw() {
    const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isDark ? "#1a1820" : "#eef0f4";
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = isDark ? "rgba(255,255,255,.5)" : "rgba(80,90,120,.35)";
      ctx.fillRect(s.x, s.y, s.s, s.s * 2.4);
    }

    // 子弹
    ctx.fillStyle = "#f2d43a";
    for (const b of bullets) ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);

    // 强化道具
    for (const p of powerups) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "#f2d43a"; ctx.fill();
      ctx.fillStyle = "#7a5a00"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("P", p.x, p.y + 1);
    }

    // 敌机
    for (const e of enemies) {
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.beginPath();
      ctx.moveTo(0, e.r); ctx.lineTo(-e.r, -e.r * 0.7); ctx.lineTo(0, -e.r * 0.3); ctx.lineTo(e.r, -e.r * 0.7);
      ctx.closePath(); ctx.fillStyle = e.color; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -e.r * 0.1, e.r * 0.28, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fill();
      ctx.restore();
    }

    // 玩家
    if (player.inv <= 0 || Math.floor(player.inv / 120) % 2 === 0) {
      ctx.save(); ctx.translate(player.x, player.y);
      ctx.beginPath();
      ctx.moveTo(0, -player.h / 2); ctx.lineTo(-player.w / 2, player.h / 2);
      ctx.lineTo(0, player.h * 0.3); ctx.lineTo(player.w / 2, player.h / 2);
      ctx.closePath(); ctx.fillStyle = "#4f7af0"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -player.h * 0.1, 4, 0, Math.PI * 2); ctx.fillStyle = "#cfe0ff"; ctx.fill();
      ctx.restore();
    }

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // 强化计时条
    if (powerTimer > 0) {
      ctx.fillStyle = "rgba(242,212,58,.85)";
      ctx.fillRect(0, H - 4, W * (powerTimer / 6000), 4);
    }
  }

  // —— 循环 ——
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false; cancelAnimationFrame(raf);
    overlay.classList.remove("hide");
    overlayTitle.textContent = "坠机了 💥";
    overlaySub.textContent = "得分 " + score + " · 按开始再战";
  }

  function start() {
    reset();
    running = true; lastTs = 0;
    overlay.classList.add("hide");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  startBtn.addEventListener("click", start);

  reset(); draw();
})();
