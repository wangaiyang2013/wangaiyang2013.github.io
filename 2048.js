(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("reset");

  document.getElementById("year").textContent = new Date().getFullYear();

  let grid, score, best, won, over, cells;

  best = Number(localStorage.getItem("best2048") || 0);
  bestEl.textContent = best;

  // 生成 16 个格子
  cells = [];
  for (let r = 0; r < 4; r++) {
    cells[r] = [];
    for (let c = 0; c < 4; c++) {
      const el = document.createElement("div");
      el.className = "tile";
      boardEl.appendChild(el);
      cells[r][c] = el;
    }
  }

  function reset() {
    grid = Array.from({ length: 4 }, () => new Array(4).fill(0));
    score = 0; won = false; over = false;
    scoreEl.textContent = "0";
    spawn(); spawn();
    render();
    overlay.classList.add("hidden");
  }

  function emptyCells() {
    const list = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (grid[r][c] === 0) list.push({ r, c });
    return list;
  }

  function spawn() {
    const list = emptyCells();
    if (!list.length) return;
    const { r, c } = list[Math.floor(Math.random() * list.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    cells[r][c].dataset.fresh = "1";
  }

  function slide(line) {
    let arr = line.filter((v) => v);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        if (arr[i] === 2048 && !won) { won = true; }
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < 4) arr.push(0);
    return arr;
  }

  function getLines(dir) {
    const lines = [];
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < 4; r++) {
        let line = [];
        for (let c = 0; c < 4; c++) line.push(grid[r][c]);
        if (dir === "right") line.reverse();
        lines.push(line);
      }
    } else {
      for (let c = 0; c < 4; c++) {
        let line = [];
        for (let r = 0; r < 4; r++) line.push(grid[r][c]);
        if (dir === "down") line.reverse();
        lines.push(line);
      }
    }
    return lines;
  }

  function setLines(dir, lines) {
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < 4; r++) {
        let line = lines[r].slice();
        if (dir === "right") line.reverse();
        for (let c = 0; c < 4; c++) grid[r][c] = line[c];
      }
    } else {
      for (let c = 0; c < 4; c++) {
        let line = lines[c].slice();
        if (dir === "down") line.reverse();
        for (let r = 0; r < 4; r++) grid[r][c] = line[r];
      }
    }
  }

  function move(dir) {
    if (over) return;
    const lines = getLines(dir);
    let moved = false;
    for (let i = 0; i < 4; i++) {
      const before = lines[i].join();
      lines[i] = slide(lines[i]);
      if (lines[i].join() !== before) moved = true;
    }
    if (!moved) return;
    setLines(dir, lines);
    spawn();
    render();
    checkState();
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const v = grid[r][c];
        if (c < 3 && grid[r][c + 1] === v) return true;
        if (r < 3 && grid[r + 1][c] === v) return true;
      }
    return false;
  }

  function checkState() {
    if (score > best) {
      best = score;
      localStorage.setItem("best2048", best);
      bestEl.textContent = best;
    }
    if (won) {
      over = true;
      overlayText.textContent = "🎉 你凑出了 2048！";
      startBtn.textContent = "继续玩";
      overlay.classList.remove("hidden");
      return;
    }
    if (!canMove()) {
      over = true;
      overlayText.textContent = "游戏结束 · 分数 " + score;
      startBtn.textContent = "再来一局";
      overlay.classList.remove("hidden");
    }
  }

  function render() {
    scoreEl.textContent = score;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = grid[r][c];
        const el = cells[r][c];
        if (v === 0) {
          el.textContent = "";
          el.className = "tile";
        } else {
          const cls = v > 2048 ? "tile-super" : "tile-" + v;
          el.textContent = v;
          el.className = "tile " + cls;
          if (el.dataset.fresh === "1") {
            el.classList.add("tile-new");
            delete el.dataset.fresh;
            setTimeout(() => el.classList.remove("tile-new"), 160);
          }
        }
      }
    }
  }

  const KEYMAP = {
    arrowup: "up", w: "up",
    arrowdown: "down", s: "down",
    arrowleft: "left", a: "left",
    arrowright: "right", d: "right",
  };
  document.addEventListener("keydown", (e) => {
    const dir = KEYMAP[e.key.toLowerCase()];
    if (dir) { move(dir); e.preventDefault(); }
  });

  // 触屏滑动
  let tStart = null;
  boardEl.addEventListener("touchstart", (e) => { tStart = e.changedTouches[0]; }, { passive: true });
  boardEl.addEventListener("touchend", (e) => {
    if (!tStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tStart.clientX, dy = t.clientY - tStart.clientY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
    tStart = null;
  }, { passive: true });

  startBtn.addEventListener("click", reset);
  resetBtn.addEventListener("click", reset);

  reset();
})();
