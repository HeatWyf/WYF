(() => {
  const STAMP_COUNT = 25;
  const MILESTONES = new Set([5, 10, 15, 20, 25]);

  const gallery = document.getElementById("gallery");
  const chips = document.querySelectorAll(".theme-chip");
  const printBtn = document.getElementById("printBtn");
  const resetBtn = document.getElementById("resetBtn");

  function buildBoards() {
    document.querySelectorAll(".stamp-board").forEach((board) => {
      if (board.childElementCount) return;
      const count = Number(board.dataset.stamps) || STAMP_COUNT;
      const frag = document.createDocumentFragment();

      for (let i = 1; i <= count; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stamp-slot";
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", `第 ${i} 个印章位`);
        btn.style.setProperty("--stamp-rot", `${(i % 5) * 4 - 10}deg`);

        if (i === 1) btn.classList.add("is-start");
        if (MILESTONES.has(i)) {
          btn.classList.add("is-milestone");
          const num = document.createElement("span");
          num.className = "num";
          num.textContent = String(i);
          btn.appendChild(num);
        }

        const mark = document.createElement("span");
        mark.className = "mark";
        mark.setAttribute("aria-hidden", "true");
        btn.appendChild(mark);

        btn.addEventListener("click", () => toggleStamp(btn));
        frag.appendChild(btn);
      }

      board.appendChild(frag);
    });
  }

  function toggleStamp(btn) {
    const on = !btn.classList.contains("is-stamped");
    btn.classList.toggle("is-stamped", on);
    btn.setAttribute("aria-pressed", String(on));
  }

  function showTheme(theme) {
    document.querySelectorAll(".stamp-card").forEach((card) => {
      const match = card.dataset.theme === theme;
      card.classList.toggle("is-visible", match);
      if (match) {
        card.style.animation = "none";
        // reflow to replay enter animation
        void card.offsetWidth;
        card.style.animation = "";
      }
    });

    chips.forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.theme === theme);
    });

    localStorage.setItem("stampjoy-theme", theme);
  }

  function resetVisibleStamps() {
    document
      .querySelectorAll(".stamp-card.is-visible .stamp-slot.is-stamped")
      .forEach((slot) => {
        slot.classList.remove("is-stamped");
        slot.setAttribute("aria-pressed", "false");
      });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => showTheme(chip.dataset.theme));
  });

  printBtn?.addEventListener("click", () => window.print());
  resetBtn?.addEventListener("click", resetVisibleStamps);

  // Keyboard: 1-5 quick theme switch when not typing in an input
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const map = { "1": "fire", "2": "soccer", "3": "space", "4": "unicorn", "5": "fox" };
    if (map[e.key]) showTheme(map[e.key]);
  });

  buildBoards();

  const saved = localStorage.getItem("stampjoy-theme");
  if (saved && document.querySelector(`.stamp-card[data-theme="${saved}"]`)) {
    showTheme(saved);
  }
})();
