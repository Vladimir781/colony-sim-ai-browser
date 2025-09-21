export function createCommsTab() {
  const element = document.createElement('div');
  element.className = 'tab-comms';
  const heading = document.createElement('h2');
  heading.textContent = 'Коммуникация';
  element.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'comms-log';
  element.appendChild(list);

  return {
    element,
    update(state) {
      if (!state?.comms) return;
      list.innerHTML = '';
      for (const entry of state.comms.slice().reverse()) {
        const item = document.createElement('li');
        const time = new Date(entry.time).toLocaleTimeString();
        item.textContent = `#${entry.agentId}: ${entry.message} (${time})`;
        list.appendChild(item);
      }
    },
  };
}
