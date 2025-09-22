export function createWorldTab() {
  const element = document.createElement('div');
  element.className = 'tab-world';
  const heading = document.createElement('h2');
  heading.textContent = 'Мир';
  element.appendChild(heading);

  const info = document.createElement('dl');
  info.className = 'metrics-grid';
  info.innerHTML = `
    <div><dt>Размер</dt><dd data-field="size">0 × 0</dd></div>
    <div><dt>Время суток</dt><dd data-field="time">0</dd></div>
    <div><dt>Еда</dt><dd data-field="food">0</dd></div>
    <div><dt>Дерево</dt><dd data-field="wood">0</dd></div>
    <div><dt>Руда</dt><dd data-field="ore">0</dd></div>
    <div><dt>Кристаллы</dt><dd data-field="crystal">0</dd></div>
    <div><dt>Постройки</dt><dd data-field="structures">0</dd></div>
    <div><dt>Хищники</dt><dd data-field="predators">0</dd></div>
    <div><dt>Травоядные</dt><dd data-field="herbivores">0</dd></div>
    <div><dt>Средняя опасность</dt><dd data-field="danger">0</dd></div>
  `;
  element.appendChild(info);

  return {
    element,
    update(state) {
      if (!state?.world) return;
      info.querySelector('[data-field="size"]').textContent = `${state.world.width} × ${state.world.height}`;
      info.querySelector('[data-field="time"]').textContent = state.world.timeOfDay.toFixed(0);
      for (const key of ['food', 'wood', 'ore', 'crystal']) {
        const el = info.querySelector(`[data-field="${key}"]`);
        if (el) el.textContent = state.world.resources?.[key] ?? 0;
      }
      info.querySelector('[data-field="structures"]').textContent = state.structures?.length ?? 0;
      info.querySelector('[data-field="predators"]').textContent = state.fauna?.predators?.length ?? 0;
      info.querySelector('[data-field="herbivores"]').textContent = state.fauna?.herbivores?.length ?? 0;
      if (state.worldTiles?.length) {
        const totalDanger = state.worldTiles.reduce((sum, tile) => sum + (tile.danger ?? 0), 0);
        const avgDanger = totalDanger / state.worldTiles.length;
        info.querySelector('[data-field="danger"]').textContent = avgDanger.toFixed(2);
      }
    },
  };
}
