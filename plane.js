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

  // 敌机类型：颜色/血量/速度/分值 + 是否开火
  const ENEMY_TYPES = [
    { r: 13, hp: 1, vy: 2.6, score: 10, color: "#ff5a5a", shoot: false, span: 17 },
    { r: 19, hp: 3, vy: 1.9, score: 25, color: "#ff9a3c", shoot: true, span: 24 },
    { r: 27, hp: 6, vy: 1.25, score: 60, color: "#b46ef0", shoot: true, span: 32 }
  ];

  let score, lives, lastTs, spawnTimer, fireTimer, powerTimer, running, raf, shake;
  let player, bullets, enemyBullets, enemies, particles, powerups, starsFar, starsNear, nebulae;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function reset() {
    score = 0; lives = 3; spawnTimer = 0; fireTimer = 0; powerTimer = 0; shake = 0;
    bullets = []; enemyBullets = []; enemies = []; particles = []; powerups = [];
    player = { x: W / 2, y: H - 64, w: 30, h: 38, speed: 4.4, fire: 1, inv: 0 };
    starsFar = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 0.4 + Math.random() * 0.8, s: 0.6 + Math.random() * 1.1 }));
    starsNear = Array.from({ length: 36 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 1.2 + Math.random() * 1.8, s: 1.1 + Math.random() * 1.6 }));
    nebulae = Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 0.25 + Math.random() * 0.3, r: 70 + Math.random() * 90, hue: Math.random() < 0.5 ? "120,80,200" : "60,120,220" }));
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    livesEl.textContent = lives > 0 ? "✈".repeat(lives) : "—";
  }

  function spawnEnemy() {
    const idx = Math.min(ENEMY_TYPES.length - 1, Math.floor(Math.random() * (enemies.length > 6 ? 3 : 2)));
    const t = ENEMY_TYPES[idx];
    const diff = 1 + score / 1200;
    const x = t.r + Math.random() * (W - 2 * t.r);
    enemies.push({
      x, baseX: x, y: -t.r, r: t.r, hp: t.hp, maxhp: t.hp,
      vy: t.vy * diff, score: t.score, color: t.color, span: t.span, shoot: t.shoot,
      sway: Math.random() * Math.PI * 2, swayAmp: t.r > 16 ? 0.9 : 0.4,
      fireCd: rand(1.1, 2.2)
    });
  }

  function fire() {
    const n = player.fire >= 2 ? 3 : 1;
    const spread = [-9, 0, 9];
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : spread[i];
      bullets.push({ x: player.x + off, y: player.y - player.h / 2, vy: -8.5, r: 4, enemy: false });
    }
    // 枪口闪光
    particles.push({ kind: "flash", x: player.x, y: player.y - player.h / 2, r: 9, life: 1, max: 1 });
  }

  function explode(x, y, color, big) {
    const n = big ? 26 : 14;
    // 核心闪白
    particles.push({ kind: "flash", x, y, r: big ? 26 : 16, life: 1, max: 1 });
    // 火球碎片
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(1.2, big ? 5 : 3.4);
      const cols = ["#fff3b0", "#ffd24a", "#ff8a3c", "#ff5a2a", color];
      particles.push({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: rand(0.5, 1), color: cols[(Math.random() * cols.length) | 0], size: rand(2, 5) });
    }
    // 烟
    for (let i = 0; i < (big ? 8 : 4); i++) {
      particles.push({ kind: "smoke", x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-0.4, 0.4), vy: rand(-0.8, -0.2), life: 1, max: rand(1.2, 2), r: rand(4, 9) });
    }
    // 碎片
    for (let i = 0; i < (big ? 10 : 5); i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(1.5, 4);
      particles.push({ kind: "debris", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, max: rand(0.6, 1.1), rot: Math.random() * 6, vr: rand(-0.3, 0.3), size: rand(2, 4), color });
    }
    shake = Math.max(shake, big ? 9 : 4);
  }

  function spawnPower() {
    powerups.push({ x: 24 + Math.random() * (W - 48), y: -16, vy: 1.8, r: 13, pulse: 0 });
  }

  // —— 输入 ——
  const keys = {};
  let pointer = { active: false, x: W / 2, y: H - 64 };

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
      player.x += (pointer.x - player.x) * 0.3;
      player.y += (pointer.y - player.y) * 0.3;
    }
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
    player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));
  }

  // —— 更新 ——
  function update(dt) {
    const f = dt * 60; // 时间归一化到 60fps 步长
    handleInput();

    for (const s of starsFar) { s.y += s.vy * f; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } }
    for (const s of starsNear) { s.y += s.vy * f; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } }
    for (const n of nebulae) { n.y += n.vy * f; if (n.y - n.r > H) { n.y = -n.r; n.x = Math.random() * W; } }

    fireTimer += dt * 1000;
    const interval = powerTimer > 0 ? 130 : 250;
    if (fireTimer >= interval) { fireTimer = 0; fire(); }

    for (const b of bullets) b.y += b.vy * f;
    for (const b of enemyBullets) { b.x += b.vx * f; b.y += b.vy * f; }

    if (powerTimer > 0) powerTimer -= dt * 1000;

    spawnTimer += dt * 1000;
    const spawnEvery = Math.max(340, 880 - score / 3);
    if (spawnTimer >= spawnEvery) { spawnTimer = 0; spawnEnemy(); if (Math.random() < 0.06) spawnPower(); }

    for (const e of enemies) {
      e.y += e.vy * f;
      e.sway += dt * 2;
      e.x = e.baseX + Math.sin(e.sway) * e.swayAmp * 14;
      if (e.shoot && e.y > 0 && e.y < H * 0.7) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = rand(1.1, 2.2);
          const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
          const sp = 3.4;
          enemyBullets.push({ x: e.x, y: e.y + e.r * 0.6, vx: dx / d * sp, vy: dy / d * sp, r: 5 });
        }
      }
    }

    for (const p of powerups) { p.y += p.vy * f; p.pulse += dt * 6; }
    powerups = powerups.filter(p => p.y < H + 20);

    // 玩家子弹 vs 敌机
    for (const b of bullets) {
      if (b.y < -20) continue;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy <= e.r * e.r) {
          e.hp--; b.y = -999;
          if (e.hp <= 0) { score += e.score; explode(e.x, e.y, e.color, e.r > 20); updateHUD(); }
          else explode(b.x, b.y, e.color, false);
          break;
        }
      }
    }
    bullets = bullets.filter(b => b.y > -20);
    enemyBullets = enemyBullets.filter(b => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

    // 敌机 vs 玩家
    if (player.inv <= 0) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - player.x, dy = e.y - player.y, rr = e.r + player.w * 0.38;
        if (dx * dx + dy * dy <= rr * rr) { e.hp = 0; explode(e.x, e.y, e.color, e.r > 20); hitPlayer(); break; }
      }
      // 敌弹 vs 玩家
      for (const b of enemyBullets) {
        const dx = b.x - player.x, dy = b.y - player.y, rr = b.r + player.w * 0.34;
        if (dx * dx + dy * dy <= rr * rr) { b.y = H + 99; hitPlayer(); break; }
      }
    } else {
      player.inv -= dt * 1000;
    }

    // 强化道具
    for (const p of powerups) {
      const dx = p.x - player.x, dy = p.y - player.y, rr = p.r + player.w * 0.4;
      if (dx * dx + dy * dy <= rr * rr) {
        p.y = H + 50; player.fire = 3; powerTimer = 6000;
        particles.push({ kind: "flash", x: p.x, y: p.y, r: 18, life: 1, max: 1 });
        explode(p.x, p.y, "#ffd23a", false);
      }
    }
    if (powerTimer <= 0) player.fire = 1;

    enemies = enemies.filter(e => e.hp > 0 && e.y < H + e.r + 4);

    // 粒子
    for (const p of particles) {
      p.life -= dt / p.max;
      if (p.kind === "spark") { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; }
      else if (p.kind === "smoke") { p.x += p.vx; p.y += p.vy; p.r += 0.4; }
      else if (p.kind === "debris") { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.vr; }
      else if (p.kind === "flash") { p.r += 1.4; }
    }
    particles = particles.filter(p => p.life > 0);

    if (shake > 0.2) shake *= 0.88; else shake = 0;
  }

  function hitPlayer() {
    lives--; updateHUD();
    explode(player.x, player.y, "#5b86f5", true);
    player.inv = 1600;
    if (lives <= 0) gameOver();
  }

  // —— 绘制 ——
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b1c");
    g.addColorStop(0.55, "#0c1230");
    g.addColorStop(1, "#141a3e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 星云
    for (const n of nebulae) {
      const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      rg.addColorStop(0, `rgba(${n.hue},0.16)`);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
    }
    // 星
    const drawStars = (arr, a) => {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (const s of arr) ctx.fillRect(s.x, s.y, s.s, s.s * 2.2);
    };
    drawStars(starsFar, 0.5);
    drawStars(starsNear, 0.85);
  }

  function drawFlame(y, flick) {
    const len = 10 + flick * 9;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.35, "rgba(255,224,130,0.9)");
    g.addColorStop(0.7, "rgba(255,120,40,0.65)");
    g.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.quadraticCurveTo(-2, y + len * 0.6, 0, y + len);
    ctx.quadraticCurveTo(2, y + len * 0.6, 4, y);
    ctx.closePath(); ctx.fill();
  }

  // 通用战斗机（局部坐标：机头朝上，尾焰在 +y）
  function drawFighter(x, y, scale, pal, opt) {
    opt = opt || {};
    const span = opt.span || 22;
    const down = opt.down;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (down) ctx.rotate(Math.PI);

    // 尾焰（最底层）
    drawFlame(16, Math.random());

    // 机翼
    const wingGrad = ctx.createLinearGradient(0, -4, 0, 12);
    wingGrad.addColorStop(0, pal.wing);
    wingGrad.addColorStop(1, pal.wingDark);
    ctx.fillStyle = wingGrad;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * 3, -3);
      ctx.lineTo(sgn * span, 9);
      ctx.lineTo(sgn * span * 0.66, 12.5);
      ctx.lineTo(sgn * 2.5, 7);
      ctx.closePath(); ctx.fill();
    }
    // 尾翼
    ctx.fillStyle = pal.wingDark;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * 2, 12);
      ctx.lineTo(sgn * 9, 18);
      ctx.lineTo(sgn * 4, 17);
      ctx.closePath(); ctx.fill();
    }

    // 机身
    const bodyGrad = ctx.createLinearGradient(-5, 0, 5, 0);
    bodyGrad.addColorStop(0, pal.bodyDark);
    bodyGrad.addColorStop(0.5, pal.body);
    bodyGrad.addColorStop(1, pal.bodyDark);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(6, -10, 5, 2);
    ctx.quadraticCurveTo(4.5, 12, 1.5, 18);
    ctx.lineTo(-1.5, 18);
    ctx.quadraticCurveTo(-4.5, 12, -5, 2);
    ctx.quadraticCurveTo(-6, -10, 0, -22);
    ctx.closePath(); ctx.fill();
    // 机身高光
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-1.5, -18); ctx.quadraticCurveTo(-3, -4, -2, 12); ctx.stroke();

    // 座舱
    const glass = ctx.createLinearGradient(0, -10, 0, 0);
    glass.addColorStop(0, pal.glass);
    glass.addColorStop(1, "rgba(20,40,80,0.9)");
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.ellipse(0, -7, 3.2, 6, 0, 0, 7); ctx.fill();

    // 描边定义
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(6, -10, 5, 2);
    ctx.quadraticCurveTo(4.5, 12, 1.5, 18);
    ctx.lineTo(-1.5, 18);
    ctx.quadraticCurveTo(-4.5, 12, -5, 2);
    ctx.quadraticCurveTo(-6, -10, 0, -22);
    ctx.closePath(); ctx.stroke();

    ctx.restore();
  }

  const PAL_PLAYER = { body: "#5b86f5", bodyDark: "#2b4aa8", wing: "#3f63d6", wingDark: "#24407e", glass: "#bfeaff" };

  function drawBullets() {
    // 玩家子弹（金色发光弹 + 拖尾）
    for (const b of bullets) {
      ctx.save();
      ctx.shadowColor = "#ffe27a"; ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(255,226,122,0.4)";
      rr(b.x - 1.5, b.y - 10, 3, 18, 1.5); ctx.fill();
      ctx.fillStyle = "#fff3b0";
      rr(b.x - 2, b.y - 6, 4, 12, 2); ctx.fill();
      ctx.restore();
    }
    // 敌弹（品红光球）
    for (const b of enemyBullets) {
      ctx.save();
      ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 12;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#ff8ae6"); g.addColorStop(1, "rgba(255,79,216,0.2)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerups() {
    for (const p of powerups) {
      const glow = 0.5 + 0.5 * Math.sin(p.pulse);
      ctx.save();
      ctx.shadowColor = "#ffd23a"; ctx.shadowBlur = 14 + glow * 8;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, "#fff3b0"); g.addColorStop(0.6, "#ffd23a"); g.addColorStop(1, "rgba(255,210,58,0.15)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#7a5500"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("P", p.x, p.y + 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.kind === "spark") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      } else if (p.kind === "smoke") {
        ctx.globalAlpha = Math.max(0, p.life) * 0.35;
        ctx.fillStyle = "#9aa0b5";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === "debris") {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (p.kind === "flash") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, p.life);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.4, "rgba(255,220,140,0.7)");
        g.addColorStop(1, "rgba(255,140,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    drawBackground();

    drawBullets();
    drawPowerups();

    // 敌机
    for (const e of enemies) {
      const pal = {
        body: e.color, bodyDark: shade(e.color, -40),
        wing: shade(e.color, 18), wingDark: shade(e.color, -55), glass: "#ffe6c0"
      };
      drawFighter(e.x, e.y, e.r / 14, pal, { down: true, span: e.span });
    }

    // 玩家
    if (player.inv <= 0 || Math.floor(player.inv / 110) % 2 === 0) {
      drawFighter(player.x, player.y, 1.05, PAL_PLAYER, { down: false, span: 20 });
    }

    drawParticles();

    // 强化计时条
    if (powerTimer > 0) {
      ctx.fillStyle = "rgba(255,210,58,0.85)";
      ctx.fillRect(0, H - 4, W * (powerTimer / 6000), 4);
    }

    ctx.restore();

    // 暗角
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
