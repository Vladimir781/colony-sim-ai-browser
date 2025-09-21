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
  for (const value of ['tiny-mlp', 'tiny-gru']) {
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
    },
  };
}
