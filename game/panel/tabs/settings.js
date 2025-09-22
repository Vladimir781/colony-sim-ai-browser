import { THINK_EVERY_OPTIONS } from '../../data/constants.js';

export function createSettingsTab({ onCommand }) {
  const element = document.createElement('form');
  element.className = 'tab-settings';
  element.setAttribute('aria-describedby', 'settings-description');
  element.addEventListener('submit', (event) => event.preventDefault());

  const heading = document.createElement('h2');
  heading.textContent = 'Настройки';
  element.appendChild(heading);

  const thinkLabel = document.createElement('label');
  thinkLabel.textContent = 'Частота размышлений';
  thinkLabel.htmlFor = 'think-every';
  const thinkSelect = document.createElement('select');
  thinkSelect.id = 'think-every';
  for (const value of THINK_EVERY_OPTIONS) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value}`;
    thinkSelect.appendChild(option);
  }
  thinkSelect.addEventListener('change', () => {
    onCommand?.('settings:update', { thinkEvery: Number(thinkSelect.value) });
  });
  element.appendChild(thinkLabel);
  element.appendChild(thinkSelect);

  const learningLabel = document.createElement('label');
  learningLabel.textContent = 'Обучение включено';
  learningLabel.htmlFor = 'learning-toggle';
  const learningToggle = document.createElement('input');
  learningToggle.type = 'checkbox';
  learningToggle.id = 'learning-toggle';
  learningToggle.addEventListener('change', () => {
    onCommand?.('settings:update', { allowLearning: learningToggle.checked });
  });
  element.appendChild(learningLabel);
  element.appendChild(learningToggle);

  const brainLabel = document.createElement('label');
  brainLabel.textContent = 'Модель мозга';
  brainLabel.htmlFor = 'brain-model';
  const brainSelect = document.createElement('select');
  brainSelect.id = 'brain-model';
  for (const value of ['tiny-mlp', 'tiny-mlp-wide', 'tiny-mlp-deep', 'tiny-mlp-ultra', 'tiny-gru']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    brainSelect.appendChild(option);
  }
  brainSelect.addEventListener('change', () => {
    onCommand?.('settings:update', { brainModel: brainSelect.value });
  });
  element.appendChild(brainLabel);
  element.appendChild(brainSelect);

  const explorationLabel = document.createElement('label');
  explorationLabel.textContent = 'Эпсилон исследования действий';
  explorationLabel.htmlFor = 'exploration-epsilon';
  const explorationWrapper = document.createElement('div');
  explorationWrapper.className = 'settings-field settings-field--slider';
  const explorationInput = document.createElement('input');
  explorationInput.type = 'range';
  explorationInput.min = '0';
  explorationInput.max = '0.6';
  explorationInput.step = '0.02';
  explorationInput.id = 'exploration-epsilon';
  explorationInput.value = '0.12';
  const explorationValue = document.createElement('span');
  explorationValue.className = 'settings-field__value';
  explorationValue.textContent = '12%';
  explorationInput.addEventListener('input', () => {
    explorationValue.textContent = `${Math.round(Number(explorationInput.value) * 100)}%`;
  });
  explorationInput.addEventListener('change', () => {
    onCommand?.('settings:update', { explorationEpsilon: Number(explorationInput.value) });
  });
  explorationWrapper.append(explorationInput, explorationValue);
  element.appendChild(explorationLabel);
  element.appendChild(explorationWrapper);

  const instinctLabel = document.createElement('label');
  instinctLabel.textContent = 'Вес инстинктов';
  instinctLabel.htmlFor = 'instinct-weight';
  const instinctWrapper = document.createElement('div');
  instinctWrapper.className = 'settings-field settings-field--slider';
  const instinctInput = document.createElement('input');
  instinctInput.type = 'range';
  instinctInput.min = '0';
  instinctInput.max = '1';
  instinctInput.step = '0.05';
  instinctInput.id = 'instinct-weight';
  instinctInput.value = '0.4';
  const instinctValue = document.createElement('span');
  instinctValue.className = 'settings-field__value';
  instinctValue.textContent = '40%';
  instinctInput.addEventListener('input', () => {
    instinctValue.textContent = `${Math.round(Number(instinctInput.value) * 100)}%`;
  });
  instinctInput.addEventListener('change', () => {
    onCommand?.('settings:update', { instinctWeight: Number(instinctInput.value) });
  });
  instinctWrapper.append(instinctInput, instinctValue);
  element.appendChild(instinctLabel);
  element.appendChild(instinctWrapper);

  const memoryLabel = document.createElement('label');
  memoryLabel.textContent = 'Память опыта (шагов)';
  memoryLabel.htmlFor = 'memory-window';
  const memoryWrapper = document.createElement('div');
  memoryWrapper.className = 'settings-field settings-field--number';
  const memoryInput = document.createElement('input');
  memoryInput.type = 'number';
  memoryInput.min = '8';
  memoryInput.max = '480';
  memoryInput.step = '1';
  memoryInput.id = 'memory-window';
  memoryInput.value = '180';
  const memoryHint = document.createElement('span');
  memoryHint.className = 'settings-field__value';
  memoryHint.textContent = '180 шагов';
  memoryInput.addEventListener('input', () => {
    memoryHint.textContent = `${memoryInput.value} шагов`;
  });
  memoryInput.addEventListener('change', () => {
    const value = Math.max(8, Number(memoryInput.value));
    memoryInput.value = String(value);
    memoryHint.textContent = `${value} шагов`;
    onCommand?.('settings:update', { memoryWindow: value });
  });
  memoryWrapper.append(memoryInput, memoryHint);
  element.appendChild(memoryLabel);
  element.appendChild(memoryWrapper);

  const description = document.createElement('p');
  description.id = 'settings-description';
  description.textContent = 'Настройки применяются сразу и сохраняются в localStorage.';
  element.appendChild(description);

  return {
    element,
    update(state) {
      if (!state) return;
      if (state.config?.agents?.thinkEvery) {
        thinkSelect.value = String(state.config.agents.thinkEvery);
      }
      if (typeof state.config?.agents?.allowLearning === 'boolean') {
        learningToggle.checked = state.config.agents.allowLearning;
      }
      if (state.config?.brains?.model) {
        brainSelect.value = state.config.brains.model;
      }
      if (typeof state.config?.brains?.explorationEpsilon === 'number') {
        explorationInput.value = String(state.config.brains.explorationEpsilon);
        explorationValue.textContent = `${Math.round(Number(explorationInput.value) * 100)}%`;
      }
      if (typeof state.config?.brains?.instinctWeight === 'number') {
        instinctInput.value = String(state.config.brains.instinctWeight);
        instinctValue.textContent = `${Math.round(Number(instinctInput.value) * 100)}%`;
      }
      if (typeof state.config?.brains?.memoryWindow === 'number') {
        memoryInput.value = String(state.config.brains.memoryWindow);
        memoryHint.textContent = `${memoryInput.value} шагов`;
      }
    },
  };
}
