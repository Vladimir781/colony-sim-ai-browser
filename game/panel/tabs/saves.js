export function createSavesTab({ onCommand }) {
  const element = document.createElement('div');
  element.className = 'tab-saves';
  const heading = document.createElement('h2');
  heading.textContent = 'Сейвы и данные';
  element.appendChild(heading);

  const actions = document.createElement('div');
  actions.className = 'button-row';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Сохранить сейчас';
  saveBtn.addEventListener('click', () => onCommand?.('storage:save'));

  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'Загрузить последний';
  loadBtn.addEventListener('click', () => onCommand?.('storage:load')); 

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Экспортировать мозги';
  exportBtn.addEventListener('click', () => onCommand?.('brains:export'));

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json';
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCommand?.('brains:import', reader.result);
    };
    reader.readAsText(file);
  });

  actions.appendChild(saveBtn);
  actions.appendChild(loadBtn);
  actions.appendChild(exportBtn);
  actions.appendChild(importInput);
  element.appendChild(actions);

  const log = document.createElement('p');
  log.className = 'storage-log';
  element.appendChild(log);

  return {
    element,
    update(state) {
      if (state?.storageMessage) {
        log.textContent = state.storageMessage;
      }
    },
  };
}
