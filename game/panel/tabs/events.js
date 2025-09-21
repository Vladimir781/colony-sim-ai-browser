export function createEventsTab() {
  const element = document.createElement('div');
  element.className = 'tab-events';
  const heading = document.createElement('h2');
  heading.textContent = 'События';
  element.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'events-log';
  element.appendChild(list);

  return {
    element,
    update(state) {
      const events = state?.storyteller?.history ?? [];
      list.innerHTML = '';
      for (const event of events.slice().reverse()) {
        const item = document.createElement('li');
        item.textContent = `${event.type.toUpperCase()}: ${event.description}`;
        list.appendChild(item);
      }
    },
  };
}
