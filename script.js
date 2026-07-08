// 主题切换（记忆到 localStorage）
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) {
    root.setAttribute("data-theme", saved);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }
})();

// 年份
document.getElementById("year").textContent = new Date().getFullYear();

// 示例文章数据（可后续替换为真实内容）
const posts = [
  {
    date: "2026-07-08",
    title: "给 AI 搭子立规矩之后",
    desc: "把交互偏好写成结构化指令，中文、友好、确认制——体验比想象中顺。记录一下踩过的坑。",
    tag: "AI 协作",
  },
  {
    date: "2026-07-05",
    title: "Mac mini M4 上手两周",
    desc: "256G 系统盘 + 1T 外接固态，日常工作流跑得很稳。聊聊我的磁盘分区与备份策略。",
    tag: "硬件",
  },
  {
    date: "2026-06-28",
    title: "把一天切成三个锚点",
    desc: "9:30 / 13:30 / 18:30 定时提醒 + todo.md，形成稳定的工作节奏。方法比工具重要。",
    tag: "效率",
  },
  {
    date: "2026-06-20",
    title: "本地代理与开发环境",
    desc: "127.0.0.1:7897 这套配置怎么和终端、IDE 配合，以及几个容易漏掉的小细节。",
    tag: "网络",
  },
  {
    date: "2026-06-12",
    title: "静态博客，部署即上线",
    desc: "零依赖、纯 HTML/CSS/JS，一键部署拿到 HTTP 链接。简单才是可持续。",
    tag: "前端",
  },
  {
    date: "2026-06-03",
    title: "为什么我又关掉了几个 App",
    desc: "工具越少越专注。一次关于"数字极简"的小实验和复盘。",
    tag: "生活",
  },
];

const grid = document.getElementById("postGrid");
if (grid) {
  posts.forEach((p) => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.innerHTML = `
      <div class="post-date">${p.date}</div>
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <span class="post-tag">${p.tag}</span>
    `;
    grid.appendChild(card);
  });
}
