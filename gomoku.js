(function () {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("reset");

  document.getElementById("year").textContent = new Date().getFullYear();

  const N = 15, PAD = 15, CELL = (canvas.width - 2 * PAD) / (N - 1);
  const BLACK = 1, WHITE = 2;
  let board, current, gameOver, lock;

  function px(i) { return PAD + i * CELL; }

  function reset() {
    board = Array.from({ length: N }, () => new Array(N).fill(0));
    current = BLACK; // 玩家先手
    gameOver = false;
    lock = false;
    setStatus("轮到你了（黑）");
    draw();
  }

  function setStatus(t) { statusEl.textContent = t; }

  function draw() {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = dark ? "#5e4a28" : "#7a5a2a";
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(px(0), px(i)); ctx.lineTo(px(N - 1), px(i)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(i), px(0)); ctx.lineTo(px(i), px(N - 1)); ctx.stroke();
    }
    // 星位
    const stars = [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]];
    ctx.fillStyle = dark ? "#5e4a28" : "#7a5a2a";
    stars.forEach(([r, c]) => { ctx.beginPath(); ctx.arc(px(c), px(r), 3, 0, 7); ctx.fill(); });

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c]) drawStone(r, c, board[r][c]);
      }
    }
  }

  function drawStone(r, c, player) {
    const x = px(c), y = px(r), rad = CELL * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    if (player === BLACK) {
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();
    } else {
      ctx.fillStyle = "#fafafa";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#bbb";
      ctx.stroke();
    }
    // 高光
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = player === BLACK ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.06)";
    ctx.fill();
  }

  function place(r, c, player) {
    board[r][c] = player; drawStone(r, c, player);
  }

  function winAt(r, c, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let n = 1;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc] === player) { n++; rr += dr * s; cc += dc * s; }
      }
      if (n >= 5) return true;
    }
    return false;
  }

  // —— AI 启发式 ——
  function countLine(r, c, dr, dc, player) {
    let n = 0, rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc] === player) { n++; rr += dr; cc += dc; }
    return n;
  }

  function lineScore(r, c, dr, dc, player) {
    const fwd = countLine(r, c, dr, dc, player);
    const bwd = countLine(r, c, -dr, -dc, player);
    const count = 1 + fwd + bwd;
    const fEnd = r + (fwd + 1) * dr, fCol = c + (fwd + 1) * dc;
    const bEnd = r - (bwd + 1) * dr, bCol = c - (bwd + 1) * dc;
    let open = 0;
    if (fEnd >= 0 && fEnd < N && fCol >= 0 && fCol < N && board[fEnd][fCol] === 0) open++;
    if (bEnd >= 0 && bEnd < N && bCol >= 0 && bCol < N && board[bEnd][bCol] === 0) open++;
    if (count >= 5) return 1e7;
    if (count === 4) return open === 2 ? 1e5 : open === 1 ? 2000 : 100;
    if (count === 3) return open === 2 ? 2000 : open === 1 ? 200 : 10;
    if (count === 2) return open === 2 ? 100 : open === 1 ? 20 : 1;
    return open === 2 ? 5 : 1;
  }

  function evalPoint(r, c, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let total = 0;
    for (const [dr, dc] of dirs) total += lineScore(r, c, dr, dc, player);
    return total;
  }

  function aiMove() {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [1, -1], [-1, 0], [0, -1], [-1, -1], [2, 0], [0, 2], [2, 2], [-2, -1], [-2, 1], [2, -1], [-2, -1]];
    let best = null, bestScore = -1;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 0) continue;
        // 只考虑已有棋子附近的落点
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc] !== 0) { near = true; break; }
          }
        if (!near) continue;
        const off = evalPoint(r, c, WHITE) + 0.8 * evalPoint(r, c, BLACK) + Math.random() * 5;
        if (off > bestScore) { bestScore = off; best = { r, c }; }
      }
    }
    if (!best) best = { r: 7, c: 7 };
    place(best.r, best.c, WHITE);
    if (winAt(best.r, best.c, WHITE)) {
      gameOver = true; setStatus("AI 赢了（白）😎");
      return;
    }
    current = BLACK; lock = false; setStatus("轮到你了（黑）");
  }

  function onBoard(e) {
    if (gameOver || lock || current !== BLACK) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const c = Math.round((x - PAD) / CELL);
    const r = Math.round((y - PAD) / CELL);
    if (r < 0 || r >= N || c < 0 || c >= N || board[r][c] !== 0) return;

    place(r, c, BLACK);
    if (winAt(r, c, BLACK)) { gameOver = true; setStatus("你赢了！🎉（黑）"); return; }

    current = WHITE; lock = true; setStatus("AI 思考中…");
    setTimeout(aiMove, 220);
  }

  canvas.addEventListener("click", onBoard);
  resetBtn.addEventListener("click", reset);
  reset();
})();
