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
    <div><dt>Тренировка (мс)</dt><dd data-field="training">0</dd></div>
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
      metricsList.querySelector('[data-field="training"]').textContent = state.metrics?.trainingTime
        ? state.metrics.trainingTime.toFixed(1)
        : '0';
    },
  };
}
