(function () {
  "use strict";

  const DIFFS = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 },
  };

  let config = DIFFS.beginner;
  let board = [];
  let firstClick = true;
  let gameOver = false;
  let flagsPlaced = 0;
  let revealedCount = 0;
  let timer = 0;
  let timerId = null;

  const boardEl = document.getElementById("board");
  const mineCountEl = document.getElementById("mineCount");
  const timerEl = document.getElementById("timer");
  const resetBtn = document.getElementById("reset");
  const msgEl = document.getElementById("msg");

  document.getElementById("year").textContent = new Date().getFullYear();

  function setMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (type ? " " + type : "");
  }

  function init() {
    board = [];
    firstClick = true;
    gameOver = false;
    flagsPlaced = 0;
    revealedCount = 0;
    timer = 0;
    stopTimer();
    timerEl.textContent = "000";
    mineCountEl.textContent = pad(config.mines);
    resetBtn.textContent = "🙂";
    setMsg("点任意格子开始，第一下保证安全～");
    buildBoard();
  }

  function pad(n) {
    return String(Math.max(0, Math.min(999, n))).padStart(3, "0");
  }

  function cellEl(r, c) {
    return boardEl.children[r * config.cols + c];
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + config.cols + ", var(--cell))";
    for (let r = 0; r < config.rows; r++) {
      board[r] = [];
      for (let c = 0; c < config.cols; c++) {
        board[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
        const el = document.createElement("button");
        el.className = "cell";
        el.dataset.r = r;
        el.dataset.c = c;
        el.addEventListener("click", onLeftClick);
        el.addEventListener("contextmenu", onRightClick);
        boardEl.appendChild(el);
      }
    }
  }

  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) fn(nr, nc);
      }
    }
  }

  function placeMines(safeR, safeC) {
    const safe = new Set();
    forEachNeighbor(safeR, safeC, (nr, nc) => safe.add(nr * config.cols + nc));
    safe.add(safeR * config.cols + safeC);

    const total = config.rows * config.cols;
    const mines = Math.min(config.mines, total - safe.size - 1);
    let placed = 0;
    while (placed < mines) {
      const idx = Math.floor(Math.random() * total);
      const r = Math.floor(idx / config.cols), c = idx % config.cols;
      if (safe.has(idx) || board[r][c].mine) continue;
      board[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        if (board[r][c].mine) continue;
        let n = 0;
        forEachNeighbor(r, c, (nr, nc) => { if (board[nr][nc].mine) n++; });
        board[r][c].adj = n;
      }
    }
  }

  function startTimer() {
    timerId = setInterval(() => {
      timer = Math.min(timer + 1, 999);
      timerEl.textContent = pad(timer);
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function onLeftClick() {
    if (gameOver) return;
    const r = +this.dataset.r, c = +this.dataset.c;
    const cell = board[r][c];
    if (cell.flagged) return;

    if (cell.revealed) {
      if (cell.adj > 0) chord(r, c);
      return;
    }

    if (firstClick) {
      placeMines(r, c);
      firstClick = false;
      startTimer();
    }

    if (cell.mine) {
      lose(r, c);
      return;
    }
    reveal(r, c);
    checkWin();
  }

  function reveal(r, c) {
    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    revealedCount++;
    const el = cellEl(r, c);
    el.classList.add("revealed");
    el.dataset.n = cell.adj;
    if (cell.adj > 0) {
      el.textContent = cell.adj;
    } else {
      forEachNeighbor(r, c, (nr, nc) => reveal(nr, nc));
    }
  }

  function chord(r, c) {
    let flags = 0;
    forEachNeighbor(r, c, (nr, nc) => { if (board[nr][nc].flagged) flags++; });
    if (flags !== board[r][c].adj) return;
    let hitMine = false, mineR = -1, mineC = -1;
    forEachNeighbor(r, c, (nr, nc) => {
      const n = board[nr][nc];
      if (n.flagged || n.revealed) return;
      if (n.mine) { hitMine = true; mineR = nr; mineC = nc; }
    });
    if (hitMine) { lose(mineR, mineC); return; }
    forEachNeighbor(r, c, (nr, nc) => {
      if (!board[nr][nc].revealed && !board[nr][nc].flagged) reveal(nr, nc);
    });
    checkWin();
  }

  function onRightClick(e) {
    e.preventDefault();
    if (gameOver) return;
    const r = +this.dataset.r, c = +this.dataset.c;
    const cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    const el = cellEl(r, c);
    if (cell.flagged) {
      el.classList.add("flagged");
      el.textContent = "🚩";
      flagsPlaced++;
    } else {
      el.classList.remove("flagged");
      el.textContent = "";
      flagsPlaced--;
    }
    mineCountEl.textContent = pad(config.mines - flagsPlaced);
  }

  function lose(hitR, hitC) {
    gameOver = true;
    stopTimer();
    resetBtn.textContent = "😵";
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const cell = board[r][c];
        const el = cellEl(r, c);
        if (cell.mine && !cell.flagged) {
          el.classList.add("revealed", "mine");
          el.textContent = "💣";
        } else if (!cell.mine && cell.flagged) {
          el.classList.add("wrong");
          el.textContent = "❌";
        }
      }
    }
    const hitEl = cellEl(hitR, hitC);
    hitEl.classList.add("mine-hit");
    setMsg("💥 踩雷了！再接再厉～", "lose");
  }

  function checkWin() {
    const total = config.rows * config.cols;
    const nonMines = total - Math.min(config.mines, total - 1);
    if (revealedCount >= nonMines) {
      gameOver = true;
      stopTimer();
      resetBtn.textContent = "😎";
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (board[r][c].mine && !board[r][c].flagged) {
            board[r][c].flagged = true;
            const el = cellEl(r, c);
            el.classList.add("flagged");
            el.textContent = "🚩";
          }
        }
      }
      mineCountEl.textContent = "000";
      setMsg("🎉 你赢了！用时 " + timer + " 秒", "win");
    }
  }

  document.querySelectorAll(".diff").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".diff").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      config = DIFFS[b.dataset.level];
      init();
    });
  });
  resetBtn.addEventListener("click", init);

  init();
})();
