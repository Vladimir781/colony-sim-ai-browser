export function createAgentsTab() {
  const element = document.createElement('div');
  element.className = 'tab-agents';
  const heading = document.createElement('h2');
  heading.textContent = 'Агенты';
  element.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'agents-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">ID</th>
        <th scope="col">Позиция</th>
        <th scope="col">Энергия</th>
        <th scope="col">Сытость</th>
        <th scope="col">Роль</th>
        <th scope="col">Трейты</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  element.appendChild(table);
  const tbody = table.querySelector('tbody');

  return {
    element,
    update(state) {
      if (!state?.agents) return;
      tbody.innerHTML = '';
      for (const agent of state.agents) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${agent.id}</td>
          <td>${agent.x}, ${agent.y}</td>
          <td>${agent.energy.toFixed(2)}</td>
          <td>${agent.satiety.toFixed(2)}</td>
          <td>${agent.role}</td>
          <td>${agent.traits.join(', ')}</td>
        `;
        tbody.appendChild(row);
      }
    },
  };
}
