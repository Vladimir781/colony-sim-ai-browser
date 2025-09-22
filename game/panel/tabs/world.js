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

  const faunaSection = document.createElement('section');
  faunaSection.className = 'fauna-section';

  const predatorBlock = document.createElement('div');
  const predatorHeading = document.createElement('h3');
  predatorHeading.textContent = 'Хищники';
  predatorBlock.appendChild(predatorHeading);
  const predatorList = document.createElement('ul');
  predatorList.className = 'fauna-list predators';
  predatorBlock.appendChild(predatorList);
  faunaSection.appendChild(predatorBlock);

  const herbBlock = document.createElement('div');
  const herbHeading = document.createElement('h3');
  herbHeading.textContent = 'Травоядные';
  herbBlock.appendChild(herbHeading);
  const herbList = document.createElement('ul');
  herbList.className = 'fauna-list herbivores';
  herbBlock.appendChild(herbList);
  faunaSection.appendChild(herbBlock);

  element.appendChild(faunaSection);

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

      predatorList.innerHTML = '';
      const predators = state.fauna?.predators ?? [];
      if (!predators.length) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = 'Нет хищников';
        predatorList.appendChild(empty);
      } else {
        for (const predator of predators) {
          const item = document.createElement('li');
          const name = document.createElement('span');
          name.className = 'fauna-name';
          name.textContent = `#${predator.id}`;
          const pos = document.createElement('span');
          pos.className = 'fauna-meta';
          pos.textContent = `(${predator.x}, ${predator.y})`;
          const hunger = document.createElement('span');
          hunger.className = 'fauna-meta';
          hunger.textContent = `сытость ${Number(predator.hunger ?? 0).toFixed(2)}`;
          item.appendChild(name);
          item.appendChild(pos);
          item.appendChild(hunger);
          predatorList.appendChild(item);
        }
      }

      herbList.innerHTML = '';
      const herbivores = state.fauna?.herbivores ?? [];
      if (!herbivores.length) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = 'Нет травоядных';
        herbList.appendChild(empty);
      } else {
        for (const herbivore of herbivores) {
          const item = document.createElement('li');
          const name = document.createElement('span');
          name.className = 'fauna-name';
          name.textContent = `#${herbivore.id}`;
          const pos = document.createElement('span');
          pos.className = 'fauna-meta';
          pos.textContent = `(${herbivore.x}, ${herbivore.y})`;
          const hunger = document.createElement('span');
          hunger.className = 'fauna-meta';
          hunger.textContent = `сытость ${Number(herbivore.hunger ?? 0).toFixed(2)}`;
          item.appendChild(name);
          item.appendChild(pos);
          item.appendChild(hunger);
          herbList.appendChild(item);
        }
      }
    },
  };
}
