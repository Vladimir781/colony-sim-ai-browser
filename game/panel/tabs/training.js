import { ACTIONS } from '../../data/constants.js';

function formatNumber(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toFixed(digits);
}

function renderTrend(container, values) {
  container.innerHTML = '';
  if (!values || values.length === 0) {
    container.dataset.empty = 'true';
    return;
  }
  container.dataset.empty = 'false';
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  for (const value of values) {
    const bar = document.createElement('span');
    const height = Math.max(4, Math.round(((value - min) / range) * 100));
    bar.style.height = `${height}%`;
    if (value < 0) bar.classList.add('negative');
    bar.title = value.toFixed(3);
    container.appendChild(bar);
  }
}

function renderWeights(grid, brain) {
  grid.innerHTML = '';
  if (!brain || !brain.preview || brain.preview.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'Предпросмотр весов недоступен';
    grid.appendChild(empty);
    return;
  }
  const preview = brain.preview.slice(0, 24);
  const maxAbs = preview.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
  preview.forEach((value, index) => {
    const row = document.createElement('div');
    row.className = 'weight-row';
    const label = document.createElement('span');
    label.textContent = `w${index}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'weight-bar-wrapper';
    const bar = document.createElement('div');
    bar.className = 'weight-bar';
    const fill = document.createElement('div');
    fill.className = 'weight-bar-fill';
    const magnitude = Math.min(1, Math.abs(value) / maxAbs);
    const widthPercent = magnitude * 50;
    if (value >= 0) {
      fill.style.left = '50%';
      fill.style.width = `${widthPercent}%`;
    } else {
      fill.style.left = `${50 - widthPercent}%`;
      fill.style.width = `${widthPercent}%`;
      bar.classList.add('negative');
    }
    bar.appendChild(fill);
    const valueLabel = document.createElement('span');
    valueLabel.className = 'weight-value';
    valueLabel.textContent = value.toFixed(3);
    wrapper.appendChild(bar);
    wrapper.appendChild(valueLabel);
    row.appendChild(label);
    row.appendChild(wrapper);
    grid.appendChild(row);
  });
}

export function createTrainingTab() {
  const element = document.createElement('div');
  element.className = 'tab-training';

  const heading = document.createElement('h2');
  heading.textContent = 'Обучение агентов';
  element.appendChild(heading);

  const summary = document.createElement('dl');
  summary.className = 'metrics-grid';
  summary.innerHTML = `
    <div><dt>Средняя награда</dt><dd data-field="summary-avgReward">0</dd></div>
    <div><dt>Всего обновлений</dt><dd data-field="summary-updates">0</dd></div>
    <div><dt>Буфер опыта</dt><dd data-field="summary-buffer">0</dd></div>
    <div><dt>Последнее обновление (мс)</dt><dd data-field="summary-lastUpdate">0</dd></div>
    <div><dt>Суммарное обучение (мс)</dt><dd data-field="summary-time">0</dd></div>
    <div><dt>Награда последнего батча</dt><dd data-field="summary-batch">0</dd></div>
    <div><dt>Размер последнего батча</dt><dd data-field="summary-batchSize">0</dd></div>
    <div><dt>Градиент (RMS)</dt><dd data-field="summary-grad">0</dd></div>
  `;
  element.appendChild(summary);

  const agentLabel = document.createElement('label');
  agentLabel.textContent = 'Выберите агента';
  agentLabel.htmlFor = 'training-agent-select';
  element.appendChild(agentLabel);

  const agentSelect = document.createElement('select');
  agentSelect.id = 'training-agent-select';
  element.appendChild(agentSelect);

  const agentMeta = document.createElement('section');
  agentMeta.className = 'training-agent-meta';
  agentMeta.innerHTML = `
    <h3 data-field="agentTitle">Агент не выбран</h3>
    <dl class="metrics-grid compact">
      <div><dt>Шаги</dt><dd data-field="steps">0</dd></div>
      <div><dt>Обновления</dt><dd data-field="agentUpdates">0</dd></div>
      <div><dt>Средняя награда</dt><dd data-field="agentAvgReward">0</dd></div>
      <div><dt>Последняя награда</dt><dd data-field="agentLastReward">0</dd></div>
      <div><dt>Базовая оценка</dt><dd data-field="agentBaseline">0</dd></div>
      <div><dt>Advantage</dt><dd data-field="agentAdvantage">0</dd></div>
      <div><dt>Размер батча</dt><dd data-field="agentBatchSize">0</dd></div>
      <div><dt>Последнее обновление</dt><dd data-field="agentLastUpdate">0 мс</dd></div>
      <div><dt>Градиент (RMS)</dt><dd data-field="agentGrad">0</dd></div>
      <div><dt>Последнее действие</dt><dd data-field="agentAction">—</dd></div>
    </dl>
  `;
  element.appendChild(agentMeta);

  const trends = document.createElement('section');
  trends.className = 'training-trends';
  trends.innerHTML = `
    <div>
      <h4>Награды (последние шаги)</h4>
      <div class="trend" data-field="rewardTrend" aria-label="История наград"></div>
    </div>
    <div>
      <h4>Средний возврат (последние обновления)</h4>
      <div class="trend" data-field="returnTrend" aria-label="История возвратов"></div>
    </div>
  `;
  element.appendChild(trends);

  const brainSection = document.createElement('section');
  brainSection.className = 'training-brain';
  brainSection.innerHTML = `
    <h3>Статистика мозга</h3>
    <p class="brain-model" data-field="brainModel">—</p>
    <dl class="metrics-grid compact">
      <div><dt>Параметров</dt><dd data-field="brainSize">0</dd></div>
      <div><dt>Мин</dt><dd data-field="brainMin">0</dd></div>
      <div><dt>Макс</dt><dd data-field="brainMax">0</dd></div>
      <div><dt>Среднее</dt><dd data-field="brainMean">0</dd></div>
      <div><dt>Сигма</dt><dd data-field="brainStd">0</dd></div>
    </dl>
    <div class="weights-grid" data-field="weightsGrid"></div>
  `;
  element.appendChild(brainSection);

  let currentState = null;
  let selectedAgentId = null;

  function ensureOptions(state) {
    const ids = state?.agents?.map((agent) => agent.id) ?? [];
    const existing = Array.from(agentSelect.options).map((option) => Number(option.value));
    const changed = ids.length !== existing.length || ids.some((id, index) => id !== existing[index]);
    if (changed) {
      agentSelect.innerHTML = '';
      if (!ids.length) {
        selectedAgentId = null;
        return;
      }
      for (const id of ids) {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = `Агент ${id}`;
        agentSelect.appendChild(option);
      }
      if (selectedAgentId && ids.includes(selectedAgentId)) {
        agentSelect.value = String(selectedAgentId);
      } else if (ids.length) {
        selectedAgentId = ids[0];
        agentSelect.value = String(selectedAgentId);
      }
    }
  }

  function renderAgent(agent) {
    const title = agentMeta.querySelector('[data-field="agentTitle"]');
    const stats = agent?.training ?? null;
    if (!agent || !stats) {
      title.textContent = 'Агент не выбран';
      for (const field of [
        'steps',
        'agentUpdates',
        'agentAvgReward',
        'agentLastReward',
        'agentBaseline',
        'agentAdvantage',
        'agentBatchSize',
        'agentLastUpdate',
        'agentGrad',
        'agentAction',
      ]) {
        const target = agentMeta.querySelector(`[data-field="${field}"]`);
        if (target) target.textContent = field === 'agentAction' ? '—' : '0';
      }
      renderTrend(trends.querySelector('[data-field="rewardTrend"]'), []);
      renderTrend(trends.querySelector('[data-field="returnTrend"]'), []);
      brainSection.querySelector('[data-field="brainModel"]').textContent = '—';
      brainSection.querySelector('[data-field="brainSize"]').textContent = '0';
      brainSection.querySelector('[data-field="brainMin"]').textContent = '0';
      brainSection.querySelector('[data-field="brainMax"]').textContent = '0';
      brainSection.querySelector('[data-field="brainMean"]').textContent = '0';
      brainSection.querySelector('[data-field="brainStd"]').textContent = '0';
      renderWeights(brainSection.querySelector('[data-field="weightsGrid"]'), null);
      return;
    }

    title.textContent = `Агент ${agent.id} — ${agent.brainModel ?? 'модель неизвестна'}`;
    agentMeta.querySelector('[data-field="steps"]').textContent = stats.steps ?? 0;
    agentMeta.querySelector('[data-field="agentUpdates"]').textContent = stats.updates ?? 0;
    agentMeta.querySelector('[data-field="agentAvgReward"]').textContent = formatNumber(
      stats.avgReward ?? 0,
      3,
    );
    agentMeta.querySelector('[data-field="agentLastReward"]').textContent = formatNumber(
      stats.lastReward ?? 0,
      3,
    );
    agentMeta.querySelector('[data-field="agentBaseline"]').textContent = formatNumber(
      stats.lastBaseline ?? 0,
      3,
    );
    agentMeta.querySelector('[data-field="agentAdvantage"]').textContent = formatNumber(
      stats.lastAdvantage ?? 0,
      3,
    );
    agentMeta.querySelector('[data-field="agentBatchSize"]').textContent = stats.lastBatchSize ?? 0;
    agentMeta
      .querySelector('[data-field="agentLastUpdate"]')
      .textContent = `${formatNumber(stats.lastUpdateMs ?? 0, 2)} мс`;
    agentMeta.querySelector('[data-field="agentGrad"]').textContent = formatNumber(
      stats.lastGradientRms ?? 0,
      4,
    );
    const lastAction = stats.lastAction ?? ACTIONS[agent.lastAction] ?? '—';
    agentMeta.querySelector('[data-field="agentAction"]').textContent = lastAction;

    renderTrend(trends.querySelector('[data-field="rewardTrend"]'), stats.recentRewards ?? []);
    renderTrend(trends.querySelector('[data-field="returnTrend"]'), stats.recentReturns ?? []);

    const brain = agent.brain ?? null;
    const brainStats = brain?.stats ?? {};
    brainSection.querySelector('[data-field="brainModel"]').textContent =
      brain?.model ?? agent.brainModel ?? '—';
    brainSection.querySelector('[data-field="brainSize"]').textContent = brain?.size ?? 0;
    brainSection.querySelector('[data-field="brainMin"]').textContent = formatNumber(
      brainStats.min ?? 0,
      3,
    );
    brainSection.querySelector('[data-field="brainMax"]').textContent = formatNumber(
      brainStats.max ?? 0,
      3,
    );
    brainSection.querySelector('[data-field="brainMean"]').textContent = formatNumber(
      brainStats.mean ?? 0,
      3,
    );
    brainSection.querySelector('[data-field="brainStd"]').textContent = formatNumber(
      brainStats.std ?? 0,
      3,
    );
    renderWeights(brainSection.querySelector('[data-field="weightsGrid"]'), brain);
  }

  agentSelect.addEventListener('change', () => {
    const value = Number(agentSelect.value);
    if (Number.isNaN(value)) return;
    selectedAgentId = value;
    if (!currentState) return;
    const agent = currentState.agents?.find((item) => item.id === selectedAgentId) ?? null;
    renderAgent(agent);
  });

  return {
    element,
    update(state) {
      currentState = state;
      if (!state) {
        renderAgent(null);
        return;
      }

      const metrics = state.metrics ?? {};
      summary.querySelector('[data-field="summary-avgReward"]').textContent = formatNumber(
        metrics.avgReward ?? 0,
        3,
      );
      summary.querySelector('[data-field="summary-updates"]').textContent = metrics.totalUpdates ?? 0;
      summary.querySelector('[data-field="summary-buffer"]').textContent = metrics.bufferSize ?? 0;
      summary.querySelector('[data-field="summary-lastUpdate"]').textContent = formatNumber(
        metrics.lastTrainingMs ?? 0,
        2,
      );
      summary.querySelector('[data-field="summary-time"]').textContent = formatNumber(
        metrics.trainingTime ?? 0,
        1,
      );
      summary.querySelector('[data-field="summary-batch"]').textContent = formatNumber(
        metrics.lastBatchReward ?? 0,
        3,
      );
      summary.querySelector('[data-field="summary-batchSize"]').textContent = metrics.lastBatchSize ?? 0;
      summary.querySelector('[data-field="summary-grad"]').textContent = formatNumber(
        metrics.lastGradientRms ?? 0,
        4,
      );

      ensureOptions(state);
      let agent = state.agents?.find((item) => item.id === selectedAgentId) ?? null;
      if (!agent && state.agents?.length) {
        agent = state.agents[0];
        selectedAgentId = agent.id;
        agentSelect.value = String(agent.id);
      }
      renderAgent(agent);
    },
  };
}
