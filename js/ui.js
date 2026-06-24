(() => {
  const data = window.VP_DATA;
  const game = window.VPGame;
  const { state, roleById, artifactById } = game;

  const els = {};

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    renderPlayerNameFields();
    renderRoleGrid();

    if (game.loadGame()) {
      showGame();
    } else {
      showSetup();
    }

    renderAll();
  });

  function cacheElements() {
    Object.assign(els, {
      setupScreen: document.getElementById("setupScreen"),
      gameScreen: document.getElementById("gameScreen"),
      playerCountSelect: document.getElementById("playerCountSelect"),
      mapSizeSelect: document.getElementById("mapSizeSelect"),
      playerNameFields: document.getElementById("playerNameFields"),
      roleAssignments: document.getElementById("roleAssignments"),
      roleGrid: document.getElementById("roleGrid"),
      startGameBtn: document.getElementById("startGameBtn"),
      setupHint: document.getElementById("setupHint"),
      newGameTopBtn: document.getElementById("newGameTopBtn"),
      roundLabel: document.getElementById("roundLabel"),
      weatherLabel: document.getElementById("weatherLabel"),
      weatherText: document.getElementById("weatherText"),
      currentPlayerName: document.getElementById("currentPlayerName"),
      currentRoleCard: document.getElementById("currentRoleCard"),
      dieLabel: document.getElementById("dieLabel"),
      movesLabel: document.getElementById("movesLabel"),
      rollBtn: document.getElementById("rollBtn"),
      roleActionBtn: document.getElementById("roleActionBtn"),
      tradeBtn: document.getElementById("tradeBtn"),
      endTurnBtn: document.getElementById("endTurnBtn"),
      turnHelp: document.getElementById("turnHelp"),
      teamList: document.getElementById("teamList"),
      board: document.getElementById("board"),
      storyTokensLabel: document.getElementById("storyTokensLabel"),
      revealedLabel: document.getElementById("revealedLabel"),
      logList: document.getElementById("logList"),
      modal: document.getElementById("modal"),
      modalBody: document.getElementById("modalBody")
    });
  }

  function bindEvents() {
    els.playerCountSelect.addEventListener("change", () => {
      game.setPlayerCount(Number(els.playerCountSelect.value));
      renderPlayerNameFields();
      renderRoleGrid();
      renderSetupState();
    });

    els.mapSizeSelect.addEventListener("change", () => {
      game.setMapSize(Number(els.mapSizeSelect.value));
    });

    els.startGameBtn.addEventListener("click", () => {
      const names = getSetupNames();
      try {
        els.modal.dataset.finalShown = "false";
        game.startGame({ names, mapSize: Number(els.mapSizeSelect.value) });
        showGame();
        renderAll();
      } catch (error) {
        openMessage("Не удалось начать игру", error.message);
      }
    });

    els.newGameTopBtn.addEventListener("click", () => {
      openConfirm("Новая партия", "Текущая партия будет сброшена. Начать заново?", () => {
        els.modal.dataset.finalShown = "false";
        game.newGame();
        closeModal();
        renderPlayerNameFields();
        renderRoleGrid();
        showSetup();
        renderAll();
      });
    });

    els.rollBtn.addEventListener("click", () => {
      game.rollDice();
      renderAll();
    });

    els.roleActionBtn.addEventListener("click", () => {
      const player = getCurrentPlayerSafe();
      if (!player) return;
      const result = game.useRoleAction();
      if (!result.ok && result.message) {
        openMessage("Особое действие", result.message);
        renderAll();
        return;
      }
      if (player.roleId === "rescuer") {
        openRescueModal();
        renderAll();
        return;
      }
      if (result.ok && result.message) openMessage("Особое действие", result.message);
      renderAll();
    });

    els.tradeBtn.addEventListener("click", openTradeModal);

    els.endTurnBtn.addEventListener("click", () => {
      game.endTurn();
      renderAll();
      if (state.status === "finished") openFinalModal();
    });

    els.modal.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal]")) closeModal();
    });
  }

  function renderPlayerNameFields() {
    const count = Number(els.playerCountSelect.value);
    game.setPlayerCount(count);
    els.playerNameFields.innerHTML = "";

    for (let i = 0; i < count; i += 1) {
      const label = document.createElement("label");
      label.textContent = `Имя игрока ${i + 1}`;
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 24;
      input.value = `Игрок ${i + 1}`;
      input.addEventListener("input", () => {
        renderRoleAssignments();
        renderRoleGrid();
      });
      label.append(input);
      els.playerNameFields.append(label);
    }
  }

  function getSetupNames() {
    return [...els.playerNameFields.querySelectorAll("input")].map((input, index) => {
      const name = input.value.trim();
      return name || `Игрок ${index + 1}`;
    });
  }

  function renderRoleAssignments() {
    if (!els.roleAssignments) return;
    const names = getSetupNames();
    els.roleAssignments.innerHTML = "";

    for (let index = 0; index < state.playerCount; index += 1) {
      const roleId = state.selectedRoles[index];
      const role = roleId ? roleById[roleId] : null;
      const item = document.createElement("article");
      item.className = "assignment-item";
      item.innerHTML = `
        <span class="assignment-item__number">${index + 1}</span>
        <div>
          <p class="assignment-item__title">${escapeHtml(names[index])}</p>
          <div class="assignment-item__role">
            ${role ? `<img src="${role.image}" alt="${escapeHtml(role.name)}">` : ""}
            <span>${role ? escapeHtml(role.name) : "роль пока не выбрана"}</span>
          </div>
        </div>
      `;
      els.roleAssignments.append(item);
    }
  }

  function renderRoleGrid() {
    els.roleGrid.innerHTML = "";
    const template = document.getElementById("roleCardTemplate");
    const selected = new Set(state.selectedRoles);
    const setupNames = getSetupNames();
    const limitReached = state.selectedRoles.length >= state.playerCount;

    data.roles.forEach((role) => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.roleId = role.id;
      card.querySelector("img").src = role.image;
      card.querySelector("img").alt = role.name;
      card.querySelector("h3").textContent = role.name;
      card.querySelector(".role-card__quote").textContent = `«${role.quote}»`;
      card.querySelector("[data-role-permanent]").textContent = role.permanent;
      card.querySelector("[data-role-special]").textContent = role.special;
      card.querySelector("[data-role-skill]").textContent = role.skill;
      const assignedIndex = state.selectedRoles.indexOf(role.id);
      const assignedLabel = card.querySelector(".role-card__assigned");
      if (assignedIndex >= 0 && assignedLabel) {
        assignedLabel.textContent = `${assignedIndex + 1}. ${setupNames[assignedIndex]} получает эту роль`;
      }

      if (selected.has(role.id)) card.classList.add("is-selected");
      if (!selected.has(role.id) && limitReached) card.classList.add("is-disabled");

      card.addEventListener("click", () => {
        game.selectRole(role.id);
        renderRoleAssignments();
        renderRoleGrid();
        renderSetupState();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          game.selectRole(role.id);
          renderRoleAssignments();
          renderRoleGrid();
          renderSetupState();
        }
      });

      els.roleGrid.append(card);
    });
  }

  function renderSetupState() {
    renderRoleAssignments();
    const selected = state.selectedRoles.length;
    const needed = state.playerCount;
    els.startGameBtn.disabled = selected !== needed;
    els.setupHint.textContent = selected === needed
      ? "Команда собрана. Проверьте распределение ролей и начинайте поход."
      : `Выберите ${needed} роли для команды. Сейчас выбрано: ${selected}. Следующая выбранная роль достанется игроку ${selected + 1}.`;
  }

  function showSetup() {
    els.setupScreen.classList.remove("hidden");
    els.gameScreen.classList.add("hidden");
    renderSetupState();
  }

  function showGame() {
    els.setupScreen.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");
  }

  function renderAll() {
    if (state.status === "setup") {
      renderSetupState();
      return;
    }
    renderStatus();
    renderCurrentPlayer();
    renderTeam();
    renderBoard();
    renderLog();
    if (state.status === "finished") openFinalModal();
  }

  function renderStatus() {
    els.roundLabel.textContent = String(state.round || 1);
    els.weatherLabel.textContent = state.weather ? state.weather.name : "Не определена";
    els.weatherText.textContent = state.weatherCancelled
      ? "Эффект погоды отменён до конца раунда."
      : state.weather ? state.weather.description : "";
    els.storyTokensLabel.textContent = String(state.storyTokens || 0);
    els.revealedLabel.textContent = String(game.countRevealed());
  }

  function renderCurrentPlayer() {
    const player = getCurrentPlayerSafe();
    if (!player) return;
    const role = roleById[player.roleId];
    els.currentPlayerName.textContent = player.name;
    els.currentRoleCard.innerHTML = `
      <img src="${role.image}" alt="${escapeHtml(role.name)}">
      <div>
        <h3>${escapeHtml(role.name)}</h3>
        <p>${escapeHtml(role.permanent)}</p>
      </div>
    `;

    els.dieLabel.textContent = state.movement.rolled ? String(state.movement.die) : "не брошен";
    els.movesLabel.textContent = String(state.movement.points || 0);
    els.rollBtn.disabled = state.movement.rolled || player.finished || state.status === "finished";
    els.roleActionBtn.disabled = player.specialCharges <= 0 || state.status === "finished";
    els.endTurnBtn.disabled = state.status === "finished";
    els.tradeBtn.disabled = state.status === "finished";

    if (state.selectionMode) {
      if (state.selectionMode.type === "reveal-any") els.turnHelp.textContent = "Выберите закрытую карточку, которую нужно открыть.";
      else if (state.selectionMode.type === "rescue-destination") els.turnHelp.textContent = "Выберите открытую соседнюю клетку для спасательной операции.";
      else els.turnHelp.textContent = "Выберите цель действия.";
    } else if (!state.movement.rolled) {
      els.turnHelp.textContent = "Бросьте кубик. После этого подсветятся доступные клетки.";
    } else if (state.movement.points > 0) {
      els.turnHelp.textContent = "Можно идти на подсвеченную соседнюю клетку. Закрытая карточка сначала перевернётся.";
    } else {
      els.turnHelp.textContent = "Очки движения закончились. Завершите ход.";
    }
  }

  function renderTeam() {
    const current = getCurrentPlayerSafe();
    els.teamList.innerHTML = "";
    state.players.forEach((player) => {
      const role = roleById[player.roleId];
      const item = document.createElement("article");
      item.className = "team-item";
      if (current && current.id === player.id) item.classList.add("is-active");
      if (player.finished) item.classList.add("is-finished");
      const artifacts = player.artifacts.map((id) => artifactById[id]?.name).filter(Boolean).join(", ") || "предметов нет";
      item.innerHTML = `
        <img src="${role.image}" alt="${escapeHtml(role.name)}">
        <div>
          <h4>${escapeHtml(player.name)} — ${escapeHtml(role.name)}</h4>
          <p>${player.visitedMid ? "Промежуточная цель посещена" : "Идёт к промежуточной цели"}${player.finished ? "; финиш" : ""}</p>
          <p>Предметы: ${escapeHtml(artifacts)}</p>
        </div>
      `;
      els.teamList.append(item);
    });
  }

  function renderBoard() {
    els.board.style.setProperty("--size", state.mapSize);
    els.board.innerHTML = "";
    const reachable = new Set(game.getReachableCells().map((cell) => `${cell.x}:${cell.y}`));
    const current = getCurrentPlayerSafe();

    for (let y = 0; y < state.mapSize; y += 1) {
      for (let x = 0; x < state.mapSize; x += 1) {
        const cell = game.getCell(x, y);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tile";
        button.dataset.x = String(x);
        button.dataset.y = String(y);
        button.setAttribute("aria-label", buildCellLabel(cell));
        if (cell.revealed) button.classList.add("is-revealed");
        if (reachable.has(`${x}:${y}`)) button.classList.add("is-reachable");
        if (current && current.x === x && current.y === y) button.classList.add("is-current");
        if (state.selectionMode && state.selectionMode.type === "reveal-any" && !cell.revealed) button.classList.add("is-reachable");
        if (state.selectionMode && state.selectionMode.type === "rescue-destination" && cell.revealed) button.classList.add("is-reachable");

        button.innerHTML = renderTileInner(cell);
        button.addEventListener("click", () => handleCellClick(x, y));
        els.board.append(button);
      }
    }
  }

  function renderTileInner(cell) {
    const terrain = data.terrains[cell.terrainId];
    const marker = cell.marker ? data.markers[cell.marker] : null;
    const artifact = cell.artifactId ? artifactById[cell.artifactId] : null;
    const players = state.players.filter((player) => player.x === cell.x && player.y === cell.y);

    return `
      <div class="tile-inner">
        <div class="tile-face tile-face--back"><span class="tile-back-mark">?</span></div>
        <div class="tile-face tile-face--front">
          <img class="tile-image" src="${terrain.image}" alt="${escapeHtml(terrain.name)}">
          ${marker ? `<div class="tile-marker"><img src="${marker.image}" alt="${escapeHtml(marker.name)}"></div>` : ""}
          ${artifact && cell.revealed ? `<img class="artifact-on-tile" src="${artifact.image}" alt="${escapeHtml(artifact.name)}" title="${escapeHtml(artifact.name)}">` : ""}
          <div class="player-markers">
            ${players.map((player) => `<span class="player-token" style="background:${player.color}" title="${escapeHtml(player.name)}">${player.number}</span>`).join("")}
          </div>
          <span class="tile-title">${escapeHtml(marker ? marker.name : terrain.name)}</span>
        </div>
      </div>
    `;
  }

  function buildCellLabel(cell) {
    if (!cell.revealed) return `Закрытая карточка ${cell.x + 1}:${cell.y + 1}`;
    const marker = cell.marker ? data.markers[cell.marker].name : "";
    return `${marker || data.terrains[cell.terrainId].name}, клетка ${cell.x + 1}:${cell.y + 1}`;
  }

  function handleCellClick(x, y) {
    if (state.selectionMode) {
      const result = game.handleSelectionCell(x, y);
      if (!result.ok && result.message) openMessage("Действие недоступно", result.message);
      if (result.ok && result.message) openMessage("Действие", result.message);
      renderAll();
      if (state.status === "finished") openFinalModal();
      return;
    }

    const result = game.attemptMove(x, y);
    if (!result.ok && result.message) openMessage("Ход недоступен", result.message);
    renderAll();
    if (state.status === "finished") openFinalModal();
  }

  function renderLog() {
    els.logList.innerHTML = "";
    state.log.slice(0, 40).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "log-entry";
      item.innerHTML = `<strong>${escapeHtml(entry.time)}</strong> ${escapeHtml(entry.text)}`;
      els.logList.append(item);
    });
  }

  function openRescueModal() {
    const player = getCurrentPlayerSafe();
    if (!player || player.specialCharges <= 0) {
      openMessage("Спасательная операция", "Особое действие уже использовано.");
      return;
    }
    const buttons = state.players
      .filter((target) => !target.finished)
      .map((target) => `<button class="button choice-button" type="button" data-rescue-target="${target.id}">${escapeHtml(target.name)}</button>`)
      .join("");

    openModal(`
      <h2 id="modalTitle">Спасательная операция</h2>
      <p>Выберите игрока, которого нужно переместить на соседнюю открытую клетку.</p>
      <div class="choice-list">${buttons}</div>
    `);

    els.modalBody.querySelectorAll("[data-rescue-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = game.chooseRescueTarget(button.dataset.rescueTarget);
        closeModal();
        if (result.message) openMessage("Спасательная операция", result.message);
        renderAll();
      });
    });
  }

  function openTradeModal() {
    const current = getCurrentPlayerSafe();
    if (!current) return;
    const partners = state.players.filter((player) => player.id !== current.id && player.x === current.x && player.y === current.y);

    if (!partners.length) {
      openMessage("Обмен", "Для обмена другой игрок должен находиться на той же клетке.");
      return;
    }

    const rows = [];
    state.players.forEach((from) => {
      if (!from.artifacts.length) return;
      partners.concat(current).forEach((to) => {
        if (from.id === to.id || from.x !== to.x || from.y !== to.y) return;
        from.artifacts.forEach((artifactId) => {
          const artifact = artifactById[artifactId];
          rows.push(`<button class="button choice-button" type="button" data-from="${from.id}" data-to="${to.id}" data-artifact="${artifactId}">${escapeHtml(from.name)} передаёт «${escapeHtml(artifact.name)}» игроку ${escapeHtml(to.name)}</button>`);
        });
      });
    });

    if (!rows.length) {
      openMessage("Обмен", "На этой клетке нет предметов, которые можно передать.");
      return;
    }

    openModal(`
      <h2 id="modalTitle">Обмен предметами</h2>
      <p>Выберите передачу предмета между игроками на одной клетке.</p>
      <div class="choice-list">${rows.join("")}</div>
    `);

    els.modalBody.querySelectorAll("[data-artifact]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = game.tradeArtifact(button.dataset.from, button.dataset.to, button.dataset.artifact);
        closeModal();
        if (!result.ok && result.message) openMessage("Обмен", result.message);
        renderAll();
      });
    });
  }

  function openFinalModal() {
    if (!state.final || els.modal.dataset.finalShown === "true") return;
    els.modal.dataset.finalShown = "true";
    const stars = "★".repeat(state.final.stars) + "☆".repeat(3 - state.final.stars);
    openModal(`
      <h2 id="modalTitle">Маршрут пройден</h2>
      <p><strong>Итог:</strong> ${stars}</p>
      <p>${escapeHtml(state.final.story)}</p>
      <div class="modal-actions">
        <button class="button button--primary" type="button" data-copy-story>Скопировать историю</button>
        <button class="button button--ghost" type="button" data-fresh-start>Новая партия</button>
      </div>
    `);

    const copyButton = els.modalBody.querySelector("[data-copy-story]");
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(state.final.story);
        copyButton.textContent = "История скопирована";
      } catch (error) {
        copyButton.textContent = "Скопируйте вручную";
      }
    });

    els.modalBody.querySelector("[data-fresh-start]").addEventListener("click", () => {
      els.modal.dataset.finalShown = "false";
      game.newGame();
      closeModal();
      renderPlayerNameFields();
      renderRoleGrid();
      showSetup();
      renderAll();
    });
  }

  function openMessage(title, message) {
    openModal(`
      <h2 id="modalTitle">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions"><button class="button button--primary" type="button" data-close-modal>Понятно</button></div>
    `);
  }

  function openConfirm(title, message, onConfirm) {
    openModal(`
      <h2 id="modalTitle">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="button button--danger" type="button" data-confirm>Да, начать заново</button>
        <button class="button button--ghost" type="button" data-close-modal>Отмена</button>
      </div>
    `);
    els.modalBody.querySelector("[data-confirm]").addEventListener("click", onConfirm);
  }

  function openModal(html) {
    els.modalBody.innerHTML = html;
    els.modal.classList.remove("hidden");
  }

  function closeModal() {
    els.modal.classList.add("hidden");
    els.modalBody.innerHTML = "";
  }

  function getCurrentPlayerSafe() {
    return state.players[state.turnIndex] || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
