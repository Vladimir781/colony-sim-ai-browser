export function createOverviewTab({ onCommand }) {
  const element = document.createElement('div');
  element.className = 'tab-overview';

  const heading = document.createElement('h2');
  heading.textContent = 'Состояние колонии';
  element.appendChild(heading);

  const status = document.createElement('p');
  status.className = 'sim-status';
  status.textContent = 'Симуляция не запущена';
  element.appendChild(status);

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'primary';
  startButton.textContent = 'Старт';
  startButton.addEventListener('click', () => {
    onCommand?.('simulation:start');
  });
  element.appendChild(startButton);

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.textContent = 'Пауза';
  pauseButton.addEventListener('click', () => onCommand?.('simulation:pause'));
  element.appendChild(pauseButton);

  const metricsList = document.createElement('dl');
  metricsList.className = 'metrics-grid';
  metricsList.innerHTML = `
    <div><dt>Текущий тик</dt><dd data-field="tick">0</dd></div>
    <div><dt>Средняя энергия</dt><dd data-field="energy">0</dd></div>
    <div><dt>Средняя сытость</dt><dd data-field="satiety">0</dd></div>
    <div><dt>Средняя награда</dt><dd data-field="avgReward">0</dd></div>
    <div><dt>Время обучения (мс)</dt><dd data-field="training">0</dd></div>
    <div><dt>Последнее обновление (мс)</dt><dd data-field="lastTraining">0</dd></div>
    <div><dt>Награда последнего батча</dt><dd data-field="batchReward">0</dd></div>
    <div><dt>Буфер опыта</dt><dd data-field="buffer">0</dd></div>
    <div><dt>Обновлений мозгов</dt><dd data-field="updates">0</dd></div>
    <div><dt>Хищники</dt><dd data-field="predators">0</dd></div>
    <div><dt>Травоядные</dt><dd data-field="herbivores">0</dd></div>
    <div><dt>Постройки</dt><dd data-field="structures">0</dd></div>
  `;
  element.appendChild(metricsList);

  return {
    element,
    update(state) {
      if (!state) return;
      status.textContent = state.isRunning ? 'Симуляция активна' : 'Симуляция на паузе';
      metricsList.querySelector('[data-field="tick"]').textContent = state.tick;
      metricsList.querySelector('[data-field="energy"]').textContent = state.metrics?.avgEnergy
        ? state.metrics.avgEnergy.toFixed(2)
        : '0';
      metricsList.querySelector('[data-field="satiety"]').textContent = state.metrics?.avgSatiety
        ? state.metrics.avgSatiety.toFixed(2)
        : '0';
      metricsList.querySelector('[data-field="avgReward"]').textContent = state.metrics?.avgReward
        ? state.metrics.avgReward.toFixed(3)
        : '0';
      metricsList.querySelector('[data-field="training"]').textContent = state.metrics?.trainingTime
        ? state.metrics.trainingTime.toFixed(1)
        : '0';
      metricsList.querySelector('[data-field="lastTraining"]').textContent = state.metrics?.lastTrainingMs
        ? state.metrics.lastTrainingMs.toFixed(2)
        : '0';
      metricsList.querySelector('[data-field="batchReward"]').textContent = state.metrics?.lastBatchReward
        ? state.metrics.lastBatchReward.toFixed(3)
        : '0';
      metricsList.querySelector('[data-field="buffer"]').textContent = state.metrics?.bufferSize ?? 0;
      metricsList.querySelector('[data-field="updates"]').textContent = state.metrics?.totalUpdates ?? 0;
      const predatorCount = state.metrics?.predatorCount ?? 0;
      const herbivoreCount = state.metrics?.herbivoreCount ?? 0;
      const structureCount = state.metrics?.structureCount ?? 0;
      metricsList.querySelector('[data-field="predators"]').textContent = predatorCount;
      metricsList.querySelector('[data-field="herbivores"]').textContent = herbivoreCount;
      metricsList.querySelector('[data-field="structures"]').textContent = structureCount;
    },
  };
}
