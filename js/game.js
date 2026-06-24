window.VPGame = (() => {
  const { roles, terrains, artifacts, weathers } = window.VP_DATA;
  const STORAGE_KEY = "vpohod_saved_game_v1";

  const roleById = Object.fromEntries(roles.map((role) => [role.id, role]));
  const artifactById = Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact]));

  const state = {
    status: "setup",
    selectedRoles: [],
    playerCount: 4,
    mapSize: 6,
    players: [],
    map: [],
    round: 0,
    turnIndex: 0,
    weather: null,
    weatherCancelled: false,
    movement: createEmptyMovement(),
    storyTokens: 0,
    log: [],
    selectionMode: null,
    final: null
  };

  function createEmptyMovement() {
    return {
      rolled: false,
      die: null,
      points: 0,
      basePoints: 0,
      previousPosition: null,
      negativeCancelled: false,
      explorerComplexIgnored: false
    };
  }

  function clonePosition(position) {
    return position ? { x: position.x, y: position.y } : null;
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function selectRole(roleId) {
    const limit = state.playerCount;
    if (!roleById[roleId]) return;

    const index = state.selectedRoles.indexOf(roleId);
    if (index >= 0) {
      state.selectedRoles.splice(index, 1);
      return;
    }

    if (state.selectedRoles.length < limit) {
      state.selectedRoles.push(roleId);
    }
  }

  function setPlayerCount(count) {
    state.playerCount = Number(count);
    state.selectedRoles = state.selectedRoles.slice(0, state.playerCount);
  }

  function setMapSize(size) {
    state.mapSize = Number(size);
  }

  function startGame(options) {
    const names = options.names || [];
    const mapSize = Number(options.mapSize || state.mapSize || 6);
    const selectedRoles = [...state.selectedRoles].slice(0, state.playerCount);

    if (selectedRoles.length !== state.playerCount) {
      throw new Error("Количество выбранных ролей не совпадает с количеством игроков.");
    }

    state.status = "playing";
    state.mapSize = mapSize;
    state.players = selectedRoles.map((roleId, index) => ({
      id: `player-${index + 1}`,
      number: index + 1,
      name: sanitizeName(names[index]) || `Игрок ${index + 1}`,
      roleId,
      color: roleById[roleId].color,
      x: 0,
      y: 0,
      previous: null,
      visitedMid: false,
      finished: false,
      artifacts: [],
      specialCharges: roleById[roleId].charges,
      usedSpecial: false,
      fatigue: false
    }));

    state.map = generateMap(mapSize);
    state.round = 0;
    state.turnIndex = 0;
    state.weather = null;
    state.weatherCancelled = false;
    state.movement = createEmptyMovement();
    state.storyTokens = 0;
    state.log = [];
    state.selectionMode = null;
    state.final = null;

    giveRescuerStartArtifact();
    beginRound();
    revealStartCells();
    addLog("Партия началась. Открыты База, Промежуточная цель и Главная цель. Остальная карта закрыта.");
    beginTurn();
    saveGame();
  }

  function sanitizeName(value) {
    return String(value || "").replace(/[<>]/g, "").trim().slice(0, 24);
  }

  function giveRescuerStartArtifact() {
    const rescuer = state.players.find((player) => player.roleId === "rescuer");
    if (!rescuer) return;
    const startArtifact = randomItem(artifacts);
    rescuer.artifacts.push(startArtifact.id);
    addLog(`${rescuer.name} начинает поход с предметом «${startArtifact.name}».`);
  }

  function generateMap(size) {
    const cells = [];
    const mid = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
    const goal = { x: size - 1, y: size - 1 };
    const safePath = new Set();

    for (let x = 0; x <= mid.x; x += 1) safePath.add(key(x, 0));
    for (let y = 0; y <= mid.y; y += 1) safePath.add(key(mid.x, y));
    for (let x = mid.x; x <= goal.x; x += 1) safePath.add(key(x, mid.y));
    for (let y = mid.y; y <= goal.y; y += 1) safePath.add(key(goal.x, y));

    for (let y = 0; y < size; y += 1) {
      const row = [];
      for (let x = 0; x < size; x += 1) {
        const isBase = x === 0 && y === 0;
        const isMid = x === mid.x && y === mid.y;
        const isGoal = x === goal.x && y === goal.y;
        const onSafePath = safePath.has(key(x, y));
        const centerDistance = Math.abs(x - mid.x) + Math.abs(y - mid.y);
        const closeToCenter = centerDistance <= Math.max(1, Math.floor(size / 3));

        let terrainId = "plain";
        if (isGoal) terrainId = "mountain";
        else if (isBase || isMid) terrainId = "plain";
        else if (onSafePath) terrainId = randomItem(["plain", "forest", "plain", "water"]);
        else terrainId = weightedTerrain(closeToCenter);

        row.push({
          x,
          y,
          terrainId,
          revealed: false,
          marker: isBase ? "base" : isMid ? "mid" : isGoal ? "goal" : null,
          artifactId: null
        });
      }
      cells.push(row);
    }

    const artifactPool = shuffle(artifacts.map((artifact) => artifact.id));
    const candidates = [];
    forEachCell(cells, (cell) => {
      if (!cell.marker) candidates.push(cell);
    });
    shuffle(candidates).slice(0, artifactPool.length).forEach((cell, index) => {
      cell.artifactId = artifactPool[index];
    });

    return cells;
  }

  function weightedTerrain(closeToCenter) {
    const simple = ["plain", "plain", "forest", "forest", "water"];
    const complex = ["plain", "forest", "water", "swamp", "mountain", "swamp"];
    return randomItem(closeToCenter ? complex : simple);
  }

  function forEachCell(map, callback) {
    map.forEach((row) => row.forEach(callback));
  }

  function revealStartCells() {
    revealCell(0, 0, { silent: true });
    const mid = Math.floor(state.mapSize / 2);
    revealCell(mid, mid, { silent: true });
    revealCell(state.mapSize - 1, state.mapSize - 1, { silent: true });
  }

  function beginRound() {
    state.round += 1;
    state.weatherCancelled = false;
    state.weather = randomItem(weathers);
    state.players.forEach((player) => {
      player.roundBoostUsed = false;
    });
    addLog(`Раунд ${state.round}. Погода: ${state.weather.name}. ${state.weather.description}`);
  }

  function beginTurn() {
    if (state.players.every((player) => player.finished)) {
      finishGame();
      return;
    }

    while (currentPlayer().finished) {
      state.turnIndex = (state.turnIndex + 1) % state.players.length;
      if (state.turnIndex === 0) beginRound();
    }

    state.movement = createEmptyMovement();
    state.selectionMode = null;
    const player = currentPlayer();

    applyPermanentStartEffects(player);
    addLog(`Ход игрока ${player.name}. Роль: ${roleById[player.roleId].name}.`);
  }

  function applyPermanentStartEffects(player) {
    if (player.roleId === "scout") {
      const opened = revealFirstAdjacentHidden(player.x, player.y);
      if (opened) addLog(`${player.name} как Разведчик открывает соседнюю карточку «${terrains[opened.terrainId].name}».`);
    }

    if (player.artifacts.includes("compass")) {
      const opened = revealFirstAdjacentHidden(player.x, player.y);
      if (opened) addLog(`Компас помогает игроку ${player.name} открыть соседнюю карточку «${terrains[opened.terrainId].name}».`);
    }

    if (player.roleId === "camp_keeper") {
      const tired = state.players.find((target) => target.fatigue);
      if (tired) {
        tired.fatigue = false;
        addLog(`${player.name} снимает усталость у игрока ${tired.name}.`);
      }
    }

    if (player.roleId === "rescuer") {
      const tired = state.players.find((target) => target.fatigue);
      if (tired) {
        tired.fatigue = false;
        addLog(`${player.name} отменяет серьёзный штраф у игрока ${tired.name}.`);
      }
    }
  }

  function revealFirstAdjacentHidden(x, y) {
    const adjacent = getAdjacentCells(x, y).find((cell) => !cell.revealed);
    if (!adjacent) return null;
    revealCell(adjacent.x, adjacent.y);
    return adjacent;
  }

  function currentPlayer() {
    return state.players[state.turnIndex];
  }

  function rollDice() {
    const player = currentPlayer();
    if (state.movement.rolled || player.finished) return;

    const die = Math.floor(Math.random() * 6) + 1;
    let points = die;
    const currentCell = getCell(player.x, player.y);
    const weatherActive = state.weather && !state.weatherCancelled && !state.movement.negativeCancelled;

    if (weatherActive && state.weather.id === "clear") points += 1;
    if (weatherActive && state.weather.id === "fog") points = Math.max(1, points - 1);
    if (weatherActive && state.weather.id === "heat" && currentCell.terrainId === "plain" && !player.artifacts.includes("hat")) {
      points = Math.max(1, points - 1);
      player.fatigue = true;
    }

    state.movement.rolled = true;
    state.movement.die = die;
    state.movement.basePoints = die;
    state.movement.points = points;
    addLog(`${player.name} бросает кубик: ${die}. Очки движения: ${points}.`);
    saveGame();
  }

  function getReachableCells() {
    const player = currentPlayer();
    if (!state.movement.rolled || state.movement.points <= 0 || player.finished) return [];

    return getAdjacentCells(player.x, player.y).filter((cell) => {
      if (!cell.revealed) return state.movement.points >= 1;
      const validation = validateMove(player, cell);
      return validation.ok;
    });
  }

  function attemptMove(x, y) {
    const player = currentPlayer();
    if (!state.movement.rolled) return { ok: false, message: "Сначала бросьте кубик." };
    if (state.movement.points <= 0) return { ok: false, message: "Очки движения закончились." };
    if (!isAdjacent(player.x, player.y, x, y)) return { ok: false, message: "Можно ходить только на соседнюю клетку." };

    const target = getCell(x, y);
    const wasHidden = !target.revealed;
    if (wasHidden) {
      revealCell(x, y);
      addLog(`${player.name} открывает карточку «${terrains[target.terrainId].name}».`);
    }

    const validation = validateMove(player, target);
    if (!validation.ok) {
      addLog(`На клетку «${terrains[target.terrainId].name}» сейчас нельзя войти: ${validation.message}`);
      return validation;
    }

    const previous = { x: player.x, y: player.y };
    player.previous = clonePosition(previous);
    player.x = x;
    player.y = y;
    state.movement.previousPosition = previous;
    state.movement.points -= validation.cost;

    addLog(`${player.name} переходит на клетку «${cellPublicName(target)}». Потрачено очков: ${validation.cost}.`);

    resolveCellEffects(player, target);

    if (target.terrainId === "mountain") {
      state.movement.points = 0;
      addLog("Горы останавливают ход после входа.");
    }

    if (state.movement.points <= 0) {
      addLog(`Ход игрока ${player.name} можно завершить.`);
    }

    saveGame();
    return { ok: true };
  }

  function validateMove(player, target) {
    const weatherActive = state.weather && !state.weatherCancelled && !state.movement.negativeCancelled;

    if (weatherActive && state.weather.id === "wind" && player.previous && player.previous.x === target.x && player.previous.y === target.y) {
      return { ok: false, message: "ветер запрещает возвращаться назад", cost: 0 };
    }

    if (target.terrainId === "mountain" && state.movement.die !== 6) {
      return { ok: false, message: "для горы на кубике должна выпасть 6", cost: 0 };
    }

    if (target.terrainId === "swamp" && state.movement.die !== 6 && !player.artifacts.includes("gear") && !canExplorerIgnoreComplex(player)) {
      return { ok: false, message: "для болота нужна 6 или спецснаряжение", cost: 0 };
    }

    let cost = 1;
    const waterWithoutRaft = target.terrainId === "water" && !player.artifacts.includes("raft");
    if (waterWithoutRaft) cost = 2;
    if (weatherActive && state.weather.id === "rain" && terrains[target.terrainId].className === "complex") cost += 1;

    if (cost > state.movement.points) {
      const message = waterWithoutRaft
        ? `в водоём можно без плавсредства, но нужно 2 очк. движения; доступно ${state.movement.points}`
        : `нужно ${cost} очк. движения, доступно ${state.movement.points}`;
      return { ok: false, message, cost };
    }

    return { ok: true, cost };
  }

  function canExplorerIgnoreComplex(player) {
    return player.roleId === "explorer" && !state.movement.explorerComplexIgnored;
  }

  function resolveCellEffects(player, cell) {
    if (cell.terrainId === "swamp" && canExplorerIgnoreComplex(player) && state.movement.die !== 6 && !player.artifacts.includes("gear")) {
      state.movement.explorerComplexIgnored = true;
      addLog(`${player.name} как Исследователь игнорирует сложность болота.`);
    }

    if (cell.marker === "mid" && !player.visitedMid) {
      player.visitedMid = true;
      addLog(`${player.name} достиг Промежуточной цели.`);
    }

    if (cell.marker === "goal") {
      if (!player.visitedMid) {
        addLog(`${player.name} видит Главную цель, но сначала нужно посетить Промежуточную цель.`);
      } else if (!player.finished) {
        player.finished = true;
        addLog(`${player.name} достиг Главной цели.`);
      }
    }

    if (cell.artifactId) {
      player.artifacts.push(cell.artifactId);
      addLog(`${player.name} находит предмет «${artifactById[cell.artifactId].name}».`);
      cell.artifactId = null;
    }

    if (state.players.every((target) => target.finished)) {
      finishGame();
    }
  }

  function revealCell(x, y, options = {}) {
    const cell = getCell(x, y);
    if (!cell || cell.revealed) return false;

    cell.revealed = true;
    const hasMemoryKeeper = state.players.some((player) => player.roleId === "memory_keeper");
    if (hasMemoryKeeper) {
      state.storyTokens += 1;
      if (!options.silent) addLog("Команда получает жетон истории за открытую карточку.");
    }
    return true;
  }

  function endTurn() {
    const player = currentPlayer();
    if (!player.finished) addLog(`${player.name} завершает ход.`);

    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    if (state.turnIndex === 0) beginRound();
    beginTurn();
    saveGame();
  }

  function useRoleAction() {
    const player = currentPlayer();
    const role = roleById[player.roleId];
    if (!role || player.specialCharges <= 0) {
      return { ok: false, message: "Особое действие этой роли уже использовано." };
    }

    if (player.roleId === "scout") {
      if (!state.movement.rolled) return { ok: false, message: "Сначала бросьте основной кубик." };
      const bonus = Math.floor(Math.random() * 6) + 1;
      state.movement.points += bonus;
      spendCharge(player);
      addLog(`${player.name} использует «Быстрый марш». Дополнительный бросок: ${bonus}.`);
      return { ok: true };
    }

    if (player.roleId === "explorer") {
      state.selectionMode = { type: "reveal-any", playerId: player.id };
      return { ok: true, message: "Выберите любую закрытую карточку на карте." };
    }

    if (player.roleId === "camp_keeper") {
      state.weatherCancelled = true;
      spendCharge(player);
      addLog(`${player.name} устраивает «Тёплый привал». Погода отменена до конца раунда.`);
      return { ok: true };
    }

    if (player.roleId === "mood_keeper") {
      state.movement.negativeCancelled = true;
      state.movement.points += state.movement.rolled ? 1 : 0;
      spendCharge(player);
      addLog(`${player.name} отменяет негативный эффект и поддерживает команду.`);
      return { ok: true };
    }

    if (player.roleId === "memory_keeper") {
      if (state.storyTokens < 3) return { ok: false, message: "Нужно минимум 3 жетона истории." };
      if (!state.movement.rolled) return { ok: false, message: "Сначала бросьте кубик." };
      state.storyTokens -= 3;
      state.movement.points += 2;
      spendCharge(player);
      addLog(`${player.name} использует «Памятный кадр»: команда получает 2 очка движения.`);
      return { ok: true };
    }

    if (player.roleId === "rescuer") {
      state.selectionMode = { type: "rescue-player", playerId: player.id };
      return { ok: true, message: "Выберите игрока для спасательной операции." };
    }

    return { ok: false, message: "Действие пока недоступно." };
  }

  function spendCharge(player) {
    player.specialCharges = Math.max(0, player.specialCharges - 1);
    player.usedSpecial = true;
    state.selectionMode = null;
    saveGame();
  }

  function handleSelectionCell(x, y) {
    const mode = state.selectionMode;
    if (!mode) return { ok: false };

    const player = currentPlayer();
    if (mode.type === "reveal-any") {
      const cell = getCell(x, y);
      if (!cell || cell.revealed) return { ok: false, message: "Нужно выбрать закрытую карточку." };
      revealCell(x, y);
      spendCharge(player);
      addLog(`${player.name} открывает любую карточку: «${terrains[cell.terrainId].name}».`);
      return { ok: true };
    }

    if (mode.type === "rescue-destination") {
      const targetPlayer = state.players.find((target) => target.id === mode.targetPlayerId);
      if (!targetPlayer) return { ok: false, message: "Игрок не найден." };
      const targetCell = getCell(x, y);
      if (!targetCell || !targetCell.revealed) return { ok: false, message: "Спасательная операция доступна только на открытую клетку." };
      if (!isAdjacent(targetPlayer.x, targetPlayer.y, x, y)) return { ok: false, message: "Можно переместить только на соседнюю клетку." };
      if (targetPlayer.finished) return { ok: false, message: "Игрок уже завершил маршрут." };
      targetPlayer.previous = { x: targetPlayer.x, y: targetPlayer.y };
      targetPlayer.x = x;
      targetPlayer.y = y;
      spendCharge(player);
      addLog(`${player.name} проводит спасательную операцию для игрока ${targetPlayer.name}.`);
      resolveCellEffects(targetPlayer, targetCell);
      return { ok: true };
    }

    return { ok: false };
  }

  function chooseRescueTarget(playerId) {
    const player = currentPlayer();
    const target = state.players.find((item) => item.id === playerId);
    if (!state.selectionMode || state.selectionMode.type !== "rescue-player") return { ok: false };
    if (!target || target.finished) return { ok: false, message: "Нужно выбрать игрока, который ещё в пути." };
    state.selectionMode = { type: "rescue-destination", playerId: player.id, targetPlayerId: target.id };
    return { ok: true, message: `Теперь выберите открытую соседнюю клетку рядом с игроком ${target.name}.` };
  }

  function tradeArtifact(fromPlayerId, toPlayerId, artifactId) {
    const from = state.players.find((player) => player.id === fromPlayerId);
    const to = state.players.find((player) => player.id === toPlayerId);
    if (!from || !to || from.id === to.id) return { ok: false, message: "Игроки для обмена не выбраны." };
    if (from.x !== to.x || from.y !== to.y) return { ok: false, message: "Для обмена игроки должны быть на одной клетке." };
    const index = from.artifacts.indexOf(artifactId);
    if (index < 0) return { ok: false, message: "У игрока нет такого предмета." };
    from.artifacts.splice(index, 1);
    to.artifacts.push(artifactId);
    addLog(`${from.name} передаёт предмет «${artifactById[artifactId].name}» игроку ${to.name}.`);
    saveGame();
    return { ok: true };
  }

  function finishGame() {
    if (state.status === "finished") return;
    state.status = "finished";
    const targetRounds = state.mapSize === 4 ? 6 : state.mapSize === 5 ? 8 : 10;
    let stars = 1;
    if (state.round <= targetRounds + 4) stars = 2;
    if (state.round <= targetRounds && state.storyTokens >= Math.max(3, state.mapSize)) stars = 3;

    const opened = countRevealed();
    state.final = {
      stars,
      opened,
      rounds: state.round,
      story: buildFinalStory(stars, opened)
    };
    addLog(`Победа. Вся команда достигла Главной цели. Итог: ${stars} из 3.`);
    saveGame();
  }

  function buildFinalStory(stars, opened) {
    const weatherName = state.weather ? state.weather.name : "переменная погода";
    const roleNames = state.players.map((player) => roleById[player.roleId].name).join(", ");
    return `Команда прошла маршрут за ${state.round} раундов. В походе участвовали: ${roleNames}. Открыто карточек: ${opened}. Последняя погода на маршруте: ${weatherName}. Команда дошла до цели и получила ${stars} из 3.`;
  }

  function getAdjacentCells(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ].filter((position) => inBounds(position.x, position.y)).map((position) => getCell(position.x, position.y));
  }

  function isAdjacent(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < state.mapSize && y < state.mapSize;
  }

  function getCell(x, y) {
    return state.map[y] ? state.map[y][x] : null;
  }

  function key(x, y) {
    return `${x}:${y}`;
  }

  function cellPublicName(cell) {
    if (cell.marker === "base") return "База";
    if (cell.marker === "mid") return "Промежуточная цель";
    if (cell.marker === "goal") return "Главная цель";
    return terrains[cell.terrainId].name;
  }

  function countRevealed() {
    let count = 0;
    forEachCell(state.map, (cell) => { if (cell.revealed) count += 1; });
    return count;
  }

  function addLog(text) {
    state.log.unshift({ text, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) });
    state.log = state.log.slice(0, 80);
  }

  function newGame() {
    localStorage.removeItem(STORAGE_KEY);
    state.status = "setup";
    state.selectedRoles = [];
    state.players = [];
    state.map = [];
    state.round = 0;
    state.turnIndex = 0;
    state.weather = null;
    state.final = null;
    state.log = [];
    state.selectionMode = null;
    state.movement = createEmptyMovement();
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить партию", error);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
      return state.status === "playing" || state.status === "finished";
    } catch (error) {
      console.warn("Не удалось загрузить партию", error);
      return false;
    }
  }

  return {
    state,
    roleById,
    artifactById,
    selectRole,
    setPlayerCount,
    setMapSize,
    startGame,
    rollDice,
    getReachableCells,
    attemptMove,
    endTurn,
    useRoleAction,
    handleSelectionCell,
    chooseRescueTarget,
    tradeArtifact,
    getCell,
    countRevealed,
    newGame,
    loadGame,
    saveGame
  };
})();
