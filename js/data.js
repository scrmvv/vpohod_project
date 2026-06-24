window.VP_DATA = (() => {
  const ROLE_COLORS = ["#8d70df", "#7ddfe2", "#4e70e8", "#f06b4c", "#ea62a6", "#e6d35a"];

  const roles = [
    {
      id: "scout",
      name: "Разведчик",
      quote: "Я пойду первым",
      image: "assets/roles/scout.png",
      color: ROLE_COLORS[0],
      permanent: "В начале своего хода открывает одну соседнюю закрытую карточку.",
      special: "Один раз за партию: Быстрый марш — дополнительный бросок к очкам движения.",
      skill: "Лидерство, планирование",
      charges: 1
    },
    {
      id: "explorer",
      name: "Исследователь",
      quote: "Почему здесь такие камни?",
      image: "assets/roles/explorer.png",
      color: ROLE_COLORS[1],
      permanent: "Раз в ход игнорирует один эффект сложной местности. Правило горы по кубику 6 остаётся обязательным.",
      special: "Один раз за партию: Разведка карты — открыть любую закрытую карточку.",
      skill: "Любознательность, анализ",
      charges: 1
    },
    {
      id: "camp_keeper",
      name: "Хранитель лагеря",
      quote: "Кто голоден?",
      image: "assets/roles/camp_keeper.png",
      color: ROLE_COLORS[2],
      permanent: "Раз в свой ход снимает усталость у любого игрока, если она появилась.",
      special: "Один раз за партию: Тёплый привал — отменить эффект погоды до конца раунда.",
      skill: "Ответственность, забота",
      charges: 1
    },
    {
      id: "mood_keeper",
      name: "Хранитель атмосферы",
      quote: "Давайте споём!",
      image: "assets/roles/mood_keeper.png",
      color: ROLE_COLORS[3],
      permanent: "Раз в раунд даёт плюс один к шагу другому игроку. В прототипе бонус применяется к текущему ходу.",
      special: "Два раза за партию: отменить негативный эффект текущего игрока.",
      skill: "Эмпатия, дипломатия",
      charges: 2
    },
    {
      id: "memory_keeper",
      name: "Хранитель впечатлений",
      quote: "Какой закат!",
      image: "assets/roles/memory_keeper.png",
      color: ROLE_COLORS[4],
      permanent: "За каждую новую открытую карточку команда получает жетон истории.",
      special: "Один раз за партию: Памятный кадр — обменять три жетона истории на два очка движения.",
      skill: "Самовыражение, память",
      charges: 1
    },
    {
      id: "rescuer",
      name: "Спасатель",
      quote: "Я выведу. Спокойно.",
      image: "assets/roles/rescuer.png",
      color: ROLE_COLORS[5],
      permanent: "Раз в свой ход отменяет серьёзный штраф у себя или товарища, если он есть.",
      special: "Один раз за партию: Спасательная операция — переместить выбранного игрока на соседнюю открытую клетку.",
      skill: "Безопасность, стрессоустойчивость",
      charges: 1
    }
  ];

  const terrains = {
    plain: {
      id: "plain",
      name: "Равнина",
      className: "simple",
      image: "assets/tiles/plain.jpg",
      description: "Нейтрально, без штрафов."
    },
    forest: {
      id: "forest",
      name: "Лес",
      className: "simple",
      image: "assets/tiles/forest.jpg",
      description: "Скрытая местность. Соседние закрытые карточки не открываются автоматически."
    },
    water: {
      id: "water",
      name: "Водоём",
      className: "simple",
      image: "assets/tiles/water.jpg",
      description: "Войти можно без плавсредства: переправа стоит 2 очка движения. С плавсредством — 1."
    },
    swamp: {
      id: "swamp",
      name: "Болото",
      className: "complex",
      image: "assets/tiles/swamp.jpg",
      description: "Вход только при выпавшей 6 или со спецснаряжением."
    },
    mountain: {
      id: "mountain",
      name: "Горы",
      className: "complex",
      image: "assets/tiles/mountain.jpg",
      description: "Вход только при выпавшей 6. После входа ход завершается."
    }
  };

  const markers = {
    base: { id: "base", name: "База", image: "assets/markers/base.png" },
    mid: { id: "mid", name: "Промежуточная цель", image: "assets/markers/mid_goal.png" },
    goal: { id: "goal", name: "Главная цель", image: "assets/markers/main_goal.png" }
  };

  const artifacts = [
    {
      id: "raft",
      name: "Плавсредство",
      image: "assets/artifacts/raft.jpg",
      description: "Водоём стоит 1 очко движения вместо 2. Без плавсредства вход разрешён, но стоит 2 очка."
    },
    {
      id: "hat",
      name: "Головной убор",
      image: "assets/artifacts/hat.jpg",
      description: "Игнорирует эффект погоды Жара."
    },
    {
      id: "gear",
      name: "Спецснаряжение",
      image: "assets/artifacts/gear.jpg",
      description: "Можно входить в болото без выпавшей 6."
    },
    {
      id: "compass",
      name: "Компас",
      image: "assets/artifacts/compass.jpg",
      description: "Открывает одну соседнюю закрытую карточку в начале хода владельца."
    }
  ];

  const weathers = [
    {
      id: "clear",
      name: "Ясно",
      description: "Плюс 1 к очкам движения после броска.",
      negative: false
    },
    {
      id: "cloudy",
      name: "Облачность",
      description: "Нейтрально, без дополнительных эффектов.",
      negative: false
    },
    {
      id: "rain",
      name: "Дождь",
      description: "Вход на сложную местность стоит на 1 очко больше.",
      negative: true
    },
    {
      id: "heat",
      name: "Жара",
      description: "На равнине следующий бросок уменьшается на 1. Головной убор отменяет эффект.",
      negative: true
    },
    {
      id: "wind",
      name: "Ветер",
      description: "Нельзя ходить назад на предыдущую клетку.",
      negative: true
    },
    {
      id: "fog",
      name: "Туман",
      description: "Все двигаются на 1 клетку меньше, минимум 1.",
      negative: true
    }
  ];

  return { roles, terrains, markers, artifacts, weathers, ROLE_COLORS };
})();
