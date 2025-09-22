export function createProgressionTab() {
  const element = document.createElement('div');
  element.className = 'tab-progression';

  const summaryCard = document.createElement('section');
  summaryCard.className = 'progression-card progression-card--summary';
  summaryCard.innerHTML = `
    <header class="progression-card__header">
      <h2>Прогресс колонии</h2>
      <p class="progression-level"><span data-field="level">1</span> уровень</p>
    </header>
    <dl class="progression-summary-grid">
      <div><dt>Базовые очки</dt><dd data-field="score">0</dd></div>
      <div><dt>Множитель</dt><dd data-field="multiplier">x1.00</dd></div>
      <div><dt>Эффективные очки</dt><dd data-field="effective">0</dd></div>
      <div><dt>Достижений</dt><dd data-field="unlocked">0</dd></div>
      <div><dt>Настроение</dt><dd data-field="mood">0%</dd></div>
    </dl>
  `;
  const levelField = summaryCard.querySelector('[data-field="level"]');
  const scoreField = summaryCard.querySelector('[data-field="score"]');
  const multiplierField = summaryCard.querySelector('[data-field="multiplier"]');
  const effectiveField = summaryCard.querySelector('[data-field="effective"]');
  const unlockedField = summaryCard.querySelector('[data-field="unlocked"]');
  const moodField = summaryCard.querySelector('[data-field="mood"]');

  const challengeCard = document.createElement('section');
  challengeCard.className = 'progression-card progression-card--challenge';
  const challengeBody = document.createElement('div');
  challengeBody.className = 'challenge-body';
  challengeBody.dataset.empty = 'true';
  challengeBody.innerHTML = '<p>Задание ещё формируется...</p>';
  challengeCard.innerHTML = '<header class="progression-card__header"><h3>Ежедневный челлендж</h3></header>';
  challengeCard.appendChild(challengeBody);

  const achievementsSection = document.createElement('section');
  achievementsSection.className = 'progression-card progression-card--achievements';
  achievementsSection.innerHTML = '<header class="progression-card__header"><h3>Достижения</h3></header>';
  const achievementList = document.createElement('div');
  achievementList.className = 'achievement-list';
  achievementsSection.appendChild(achievementList);

  const logSection = document.createElement('section');
  logSection.className = 'progression-card progression-card--log';
  logSection.innerHTML = '<header class="progression-card__header"><h3>Лента событий</h3></header>';
  const logList = document.createElement('ul');
  logList.className = 'progression-log';
  logSection.appendChild(logList);

  element.append(summaryCard, challengeCard, achievementsSection, logSection);

  function renderChallenge(challenge) {
    if (!challenge) {
      challengeBody.dataset.empty = 'true';
      challengeBody.innerHTML = '<p>Новых заданий пока нет.</p>';
      return;
    }
    const progressPercent = challenge.target
      ? Math.min(1, challenge.progress / challenge.target)
      : 1;
    const remainingSeconds = Math.max(0, challenge.remainingSeconds ?? 0);
    const formattedTime = remainingSeconds >= 120
      ? `~${Math.ceil(remainingSeconds / 60)} мин`
      : `~${remainingSeconds} с`;
    challengeBody.dataset.empty = 'false';
    challengeBody.innerHTML = `
      <div class="challenge-head">
        <h4>${challenge.title}</h4>
        <p>${challenge.description}</p>
      </div>
      <div class="challenge-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${challenge.target}" aria-valuenow="${Math.round(challenge.progress)}">
        <span style="width: ${(progressPercent * 100).toFixed(1)}%"></span>
      </div>
      <div class="challenge-meta">
        <span>${Math.round(challenge.progress)} / ${challenge.target}</span>
        <span>${challenge.completed ? 'Выполнено!' : `Осталось: ${formattedTime}`}</span>
        <span>Награда: +${challenge.rewardPoints}</span>
      </div>
    `;
  }

  function renderAchievements(list = []) {
    achievementList.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'achievement-empty';
      empty.textContent = 'Пока нет открытых достижений. Попробуйте выполнить задания!';
      achievementList.appendChild(empty);
      return;
    }
    for (const achievement of list) {
      const item = document.createElement('article');
      item.className = 'achievement';
      item.dataset.unlocked = achievement.unlocked ? 'true' : 'false';

      const header = document.createElement('div');
      header.className = 'achievement__header';
      const title = document.createElement('span');
      title.className = 'achievement__title';
      title.textContent = achievement.title;
      const points = document.createElement('span');
      points.className = 'achievement__points';
      points.textContent = `+${achievement.points}`;
      header.append(title, points);
      item.appendChild(header);

      const description = document.createElement('p');
      description.className = 'achievement__description';
      description.textContent = achievement.description;
      item.appendChild(description);

      const progressBar = document.createElement('div');
      progressBar.className = 'achievement__progress';
      progressBar.setAttribute('role', 'progressbar');
      progressBar.setAttribute('aria-valuemin', '0');
      progressBar.setAttribute('aria-valuemax', String(achievement.target ?? 0));
      progressBar.setAttribute('aria-valuenow', String(Math.round(achievement.progress ?? 0)));
      const percent = achievement.target ? Math.min(1, (achievement.progress ?? 0) / achievement.target) : 1;
      const progressFill = document.createElement('span');
      progressFill.style.width = `${(percent * 100).toFixed(1)}%`;
      progressBar.appendChild(progressFill);
      item.appendChild(progressBar);

      const status = document.createElement('div');
      status.className = 'achievement__status';
      status.textContent = achievement.unlocked
        ? achievement.unlockedAt != null
          ? `Открыто на тике ${achievement.unlockedAt}`
          : 'Открыто'
        : `${Math.round(percent * 100)}% прогресса`;
      item.appendChild(status);

      achievementList.appendChild(item);
    }
  }

  function renderLog(history = [], highlights = new Set()) {
    logList.innerHTML = '';
    if (!history.length) {
      const empty = document.createElement('li');
      empty.className = 'progression-log__item progression-log__item--empty';
      empty.textContent = 'История событий появится по мере развития колонии.';
      logList.appendChild(empty);
      return;
    }
    for (const entry of history) {
      const item = document.createElement('li');
      item.className = 'progression-log__item';
      item.dataset.type = entry.type ?? 'info';
      if (highlights.has(entry.id)) {
        item.classList.add('progression-log__item--new');
      }
      const message = document.createElement('span');
      message.className = 'progression-log__message';
      message.textContent = entry.message ?? entry.title ?? '';
      const meta = document.createElement('span');
      meta.className = 'progression-log__meta';
      const metaParts = [];
      if (typeof entry.tick === 'number') metaParts.push(`тик ${entry.tick}`);
      if (entry.points) metaParts.push(`+${entry.points} очков`);
      meta.textContent = metaParts.join(' • ');
      item.append(message, meta);
      logList.appendChild(item);
    }
  }

  return {
    element,
    update(state) {
      if (!state?.progression) return;
      const { progression } = state;
      levelField.textContent = String(progression.level ?? 1);
      scoreField.textContent = String(Math.round(progression.score ?? 0));
      const multiplier = typeof progression.multiplier === 'number' ? progression.multiplier : 1;
      multiplierField.textContent = `x${multiplier.toFixed(2)}`;
      effectiveField.textContent = String(Math.round(progression.effectiveScore ?? progression.score ?? 0));
      unlockedField.textContent = String(progression.unlockedCount ?? 0);
      const moodPercent = Math.round(((progression.mood ?? 0) * 100));
      moodField.textContent = `${moodPercent}%`;

      renderChallenge(progression.dailyChallenge);
      renderAchievements(progression.achievements ?? []);
      const highlightIds = new Set((progression.notifications ?? []).map((entry) => entry.id));
      renderLog(progression.history ?? [], highlightIds);
    },
  };
}
