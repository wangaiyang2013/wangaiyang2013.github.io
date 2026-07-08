(function () {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nctx = nextCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySub = document.getElementById("overlaySub");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");

  document.getElementById("year").textContent = new Date().getFullYear();

  const COLS = 10, ROWS = 20, CELL = 28;
  const COLORS = {
    I: "#2bd4d4", O: "#f2d43a", T: "#b06ef0", S: "#5fd35f",
    Z: "#f0604f", J: "#4f7af0", L: "#f0a04f"
  };
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };

  let board, current, nextPiece, score, lines, level, dropMs, dropAcc, lastTs, running, paused, gameOver, raf;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function rotate(matrix) {
    const n = matrix.length;
    const res = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        res[c][n - 1 - r] = matrix[r][c];
    return res;
  }

  function spawn(type) {
    const shape = SHAPES[type].map(r => r.slice());
    return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
  }

  function randomPiece() {
    const keys = Object.keys(SHAPES);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  function cells(piece) {
    const out = [];
    const s = piece.shape;
    for (let r = 0; r < s.length; r++)
      for (let c = 0; c < s[r].length; c++)
        if (s[r][c]) out.push([piece.y + r, piece.x + c]);
    return out;
  }

  function collide(piece, shape, ox, oy) {
    const s = shape || piece.shape;
    for (let r = 0; r < s.length; r++) {
      for (let c = 0; c < s[r].length; c++) {
        if (!s[r][c]) continue;
        const x = piece.x + c + ox, y = piece.y + r + oy;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    for (const [r, c] of cells(current)) {
      if (r < 0) { endGame(); return; }
      board[r][c] = current.type;
    }
    clearLines();
    current = spawn(nextPiece);
    nextPiece = randomPiece();
    if (collide(current, null, 0, 0)) endGame();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(v => v)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++; r++;
      }
    }
    if (cleared) {
      const pts = [0, 100, 300, 500, 800][cleared] * level;
      score += pts; lines += cleared;
      level = 1 + Math.floor(lines / 10);
      dropMs = Math.max(90, 800 - (level - 1) * 65);
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }

  function move(ox, oy) { if (!collide(current, null, ox, oy)) { current.x += ox; current.y += oy; draw(); return true; } return false; }
  function rotatePiece() {
    const r = rotate(current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collide(current, r, kick, 0)) { current.shape = r; current.x += kick; draw(); return; }
    }
  }
  function softDrop() { if (!move(0, 1)) lockPiece(); draw(); }
  function hardDrop() {
    while (move(0, 1)) score += 2;
    lockPiece(); updateStats(); draw();
  }

  // —— 绘制 ——
  function dark() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }

  function drawCell(g, x, y, color, size) {
    const pad = 1.5;
    g.fillStyle = color;
    g.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    g.fillStyle = "rgba(255,255,255,.22)";
    g.fillRect(x + pad, y + pad, size - pad * 2, (size - pad * 2) * 0.32);
  }

  function draw() {
    const isDark = dark();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 网格
    ctx.strokeStyle = isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke(); }
    // 已落定
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]) drawCell(ctx, c * CELL, r * CELL, COLORS[board[r][c]], CELL);
    // 落点投影
    if (current && !gameOver) {
      let gy = 0;
      while (!collide(current, null, 0, gy + 1)) gy++;
      ctx.fillStyle = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.07)";
      for (const [r, c] of cells(current)) {
        const yy = r + gy;
        if (yy >= 0) ctx.fillRect(c * CELL + 3, yy * CELL + 3, CELL - 6, CELL - 6);
      }
      for (const [r, c] of cells(current)) if (r >= 0) drawCell(ctx, c * CELL, r * CELL, COLORS[current.type], CELL);
    }
    drawNext();
  }

  function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const s = SHAPES[nextPiece];
    const size = 20;
    const offX = (nextCanvas.width - s[0].length * size) / 2;
    const offY = (nextCanvas.height - s.length * size) / 2;
    for (let r = 0; r < s.length; r++)
      for (let c = 0; c < s[r].length; c++)
        if (s[r][c]) drawCell(nctx, offX + c * size, offY + r * size, COLORS[nextPiece], size);
  }

  // —— 主循环 ——
  function loop(ts) {
    if (!running) return;
    if (!paused && !gameOver) {
      if (!lastTs) lastTs = ts;
      dropAcc += ts - lastTs;
      if (dropAcc >= dropMs) { dropAcc = 0; softDrop(); }
    }
    lastTs = ts;
    raf = requestAnimationFrame(loop);
  }

  function endGame() {
    gameOver = true; running = false; cancelAnimationFrame(raf);
    overlay.classList.remove("hide");
    overlayTitle.textContent = "游戏结束";
    overlaySub.textContent = "得分 " + score + " · 按开始再来一局";
  }

  function start() {
    board = emptyBoard();
    score = 0; lines = 0; level = 1; dropMs = 800; dropAcc = 0; lastTs = 0;
    gameOver = false; paused = false; running = true;
    current = spawn(randomPiece());
    nextPiece = randomPiece();
    updateStats();
    overlay.classList.add("hide");
    pauseBtn.textContent = "暂停";
    draw();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "继续" : "暂停";
    overlay.classList.toggle("hide", !paused);
    if (paused) { overlayTitle.textContent = "已暂停"; overlaySub.textContent = "按继续或方向键恢复"; }
  }

  // —— 输入 ——
  const KEY = {
    ArrowLeft: () => move(-1, 0),
    ArrowRight: () => move(1, 0),
    ArrowDown: softDrop,
    ArrowUp: rotatePiece,
    " ": hardDrop
  };
  document.addEventListener("keydown", (e) => {
    if (!running || gameOver) {
      if (e.key === "Enter" || e.key === " ") start();
      return;
    }
    if (e.key === "p" || e.key === "P") { togglePause(); return; }
    if (paused) return;
    if (KEY[e.key]) { e.preventDefault(); KEY[e.key](); draw(); }
  });

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", togglePause);

  document.querySelectorAll(".t-touch button").forEach(b => {
    b.addEventListener("click", () => {
      if (!running || gameOver) { start(); return; }
      const act = b.dataset.act;
      if (act === "left") move(-1, 0);
      else if (act === "right") move(1, 0);
      else if (act === "rotate") rotatePiece();
      else if (act === "soft") softDrop();
      else if (act === "hard") hardDrop();
      draw();
    });
  });

  // 初始画面
  board = emptyBoard();
  draw();
})();
