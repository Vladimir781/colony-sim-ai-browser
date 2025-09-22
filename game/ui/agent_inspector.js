const DEFAULT_STATS = {
  min: 0,
  max: 0,
  mean: 0,
  std: 0,
};

function formatNumber(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const factor = 10 ** digits;
  return `${Math.round(value * factor) / factor}`;
}

function formatTimeMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value >= 1000) {
    return `${formatNumber(value / 1000, 2)} с`;
  }
  return `${formatNumber(value, 2)} мс`;
}

function formatInventory(inventory) {
  const food = inventory?.food ?? 0;
  const wood = inventory?.wood ?? 0;
  return `🍖 ${food}  •  🪵 ${wood}`;
}

function updateInputValue(input, value, digits) {
  if (!input) return;
  if (document.activeElement === input) return;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof digits === 'number') {
      input.value = formatNumber(value, digits);
    } else {
      input.value = `${value}`;
    }
  }
}

export class AgentInspector {
  constructor({ containerId = 'game-root', onCommand, onClose } = {}) {
    this.container = document.getElementById(containerId) ?? document.body;
    this.onCommand = onCommand;
    this.onClose = onClose;
    this.state = null;
    this.selectedAgentId = null;
    this.prevWeights = new Map();

    this.root = document.createElement('aside');
    this.root.className = 'agent-inspector';
    this.root.hidden = true;
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-label', 'Профиль агента');

    const header = document.createElement('header');
    header.className = 'agent-inspector__header';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'agent-inspector__title';
    this.titleEl.textContent = 'Профиль агента';

    this.tickEl = document.createElement('span');
    this.tickEl.className = 'agent-inspector__tick';
    this.tickEl.textContent = '';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'agent-inspector__close';
    closeButton.innerHTML = '✕';
    closeButton.setAttribute('aria-label', 'Закрыть профиль агента');
    closeButton.addEventListener('click', () => {
      this.close();
      this.onClose?.();
    });

    header.appendChild(this.titleEl);
    header.appendChild(this.tickEl);
    header.appendChild(closeButton);
    this.root.appendChild(header);

    const metaSection = document.createElement('section');
    metaSection.className = 'agent-inspector__section agent-inspector__meta';
    metaSection.innerHTML = `
      <dl class="agent-inspector__stats">
        <div><dt>Позиция</dt><dd data-field="position">—</dd></div>
        <div><dt>Энергия</dt><dd data-field="energy">—</dd></div>
        <div><dt>Сытость</dt><dd data-field="satiety">—</dd></div>
        <div><dt>Роль</dt><dd data-field="role">—</dd></div>
        <div><dt>Черты</dt><dd data-field="traits">—</dd></div>
        <div><dt>Инвентарь</dt><dd data-field="inventory">—</dd></div>
        <div><dt>Размышляет каждые</dt><dd data-field="thinkEvery">—</dd></div>
        <div><dt>FSM</dt><dd data-field="fsm">—</dd></div>
      </dl>
    `;
    this.root.appendChild(metaSection);

    const trainingSection = document.createElement('section');
    trainingSection.className = 'agent-inspector__section agent-inspector__training';
    trainingSection.innerHTML = `
      <h3>Обучение</h3>
      <dl class="agent-inspector__stats">
        <div><dt>Шаги</dt><dd data-field="training-steps">—</dd></div>
        <div><dt>Обновления</dt><dd data-field="training-updates">—</dd></div>
        <div><dt>Средняя награда</dt><dd data-field="training-avgReward">—</dd></div>
        <div><dt>Последняя награда</dt><dd data-field="training-lastReward">—</dd></div>
        <div><dt>Базовая оценка</dt><dd data-field="training-baseline">—</dd></div>
        <div><dt>Advantage</dt><dd data-field="training-advantage">—</dd></div>
        <div><dt>Последнее обновление</dt><dd data-field="training-lastUpdate">—</dd></div>
        <div><dt>Размер батча</dt><dd data-field="training-batch">—</dd></div>
        <div><dt>Градиент (RMS)</dt><dd data-field="training-grad">—</dd></div>
        <div><dt>Буфер</dt><dd data-field="training-buffer">—</dd></div>
      </dl>
      <canvas class="agent-inspector__chart" data-chart="rewards" width="320" height="96"></canvas>
      <p class="agent-inspector__chart-label">Жёлтая линия — награды, голубая — возвращения.</p>
    `;
    this.root.appendChild(trainingSection);

    const brainSection = document.createElement('section');
    brainSection.className = 'agent-inspector__section agent-inspector__brain';
    brainSection.innerHTML = `
      <h3>Мозг</h3>
      <div class="agent-inspector__brain-summary">
        <span>Модель: <strong data-field="brain-model">—</strong></span>
        <span>Параметров: <strong data-field="brain-size">—</strong></span>
      </div>
      <dl class="agent-inspector__stats agent-inspector__stats--compact">
        <div><dt>Мин</dt><dd data-field="brain-min">—</dd></div>
        <div><dt>Макс</dt><dd data-field="brain-max">—</dd></div>
        <div><dt>Среднее</dt><dd data-field="brain-mean">—</dd></div>
        <div><dt>σ</dt><dd data-field="brain-std">—</dd></div>
      </dl>
      <canvas class="agent-inspector__chart" data-chart="weights" width="320" height="140"></canvas>
      <p class="agent-inspector__chart-label">Цвет столбца показывает изменение веса: голубой — рост, красный — падение.</p>
    `;
    this.root.appendChild(brainSection);

    const controlsSection = document.createElement('section');
    controlsSection.className = 'agent-inspector__section agent-inspector__controls';
    const form = document.createElement('form');
    form.className = 'agent-inspector__form';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.applyChanges();
    });

    this.energyInput = document.createElement('input');
    this.energyInput.type = 'number';
    this.energyInput.step = '0.01';
    this.energyInput.min = '0';
    this.energyInput.max = '1';

    this.satietyInput = document.createElement('input');
    this.satietyInput.type = 'number';
    this.satietyInput.step = '0.01';
    this.satietyInput.min = '0';
    this.satietyInput.max = '1';

    this.foodInput = document.createElement('input');
    this.foodInput.type = 'number';
    this.foodInput.min = '0';
    this.foodInput.step = '1';

    this.woodInput = document.createElement('input');
    this.woodInput.type = 'number';
    this.woodInput.min = '0';
    this.woodInput.step = '1';

    this.thinkEveryInput = document.createElement('input');
    this.thinkEveryInput.type = 'number';
    this.thinkEveryInput.min = '1';
    this.thinkEveryInput.step = '1';

    this.roleInput = document.createElement('input');
    this.roleInput.type = 'text';

    this.traitsInput = document.createElement('input');
    this.traitsInput.type = 'text';
    this.traitsInput.placeholder = 'через запятую';

    this.fsmInput = document.createElement('input');
    this.fsmInput.type = 'checkbox';

    form.appendChild(this.createField('Энергия', this.energyInput));
    form.appendChild(this.createField('Сытость', this.satietyInput));
    form.appendChild(this.createField('Еда', this.foodInput));
    form.appendChild(this.createField('Дерево', this.woodInput));
    form.appendChild(this.createField('Размышляет каждые', this.thinkEveryInput));
    form.appendChild(this.createField('Роль', this.roleInput));
    form.appendChild(this.createField('Черты', this.traitsInput));
    form.appendChild(this.createField('Использовать FSM', this.fsmInput, true));

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'agent-inspector__status';
    this.statusEl.textContent = '';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'agent-inspector__apply';
    submitButton.textContent = 'Применить изменения';

    form.appendChild(submitButton);
    form.appendChild(this.statusEl);

    controlsSection.appendChild(document.createElement('h3')).textContent = 'Ручная настройка';
    controlsSection.appendChild(form);
    this.root.appendChild(controlsSection);

    this.fields = {};
    for (const field of [
      'position',
      'energy',
      'satiety',
      'role',
      'traits',
      'inventory',
      'thinkEvery',
      'fsm',
      'training-steps',
      'training-updates',
      'training-avgReward',
      'training-lastReward',
      'training-baseline',
      'training-advantage',
      'training-lastUpdate',
      'training-batch',
      'training-grad',
      'training-buffer',
      'brain-model',
      'brain-size',
      'brain-min',
      'brain-max',
      'brain-mean',
      'brain-std',
    ]) {
      this.fields[field] = this.root.querySelector(`[data-field="${field}"]`);
    }

    this.rewardCanvas = this.root.querySelector('[data-chart="rewards"]');
    this.rewardCtx = this.rewardCanvas.getContext('2d');
    this.weightsCanvas = this.root.querySelector('[data-chart="weights"]');
    this.weightsCtx = this.weightsCanvas.getContext('2d');

    this.container.appendChild(this.root);
  }

  createField(label, input, isCheckbox = false) {
    const wrapper = document.createElement('label');
    wrapper.className = 'agent-inspector__field';
    const title = document.createElement('span');
    title.textContent = label;
    if (isCheckbox) {
      wrapper.classList.add('agent-inspector__field--checkbox');
      wrapper.appendChild(input);
      wrapper.appendChild(title);
    } else {
      wrapper.appendChild(title);
      wrapper.appendChild(input);
    }
    return wrapper;
  }

  close() {
    this.selectedAgentId = null;
    this.root.hidden = true;
    this.tickEl.textContent = '';
    this.statusEl.textContent = '';
  }

  setSelection(agentId, state = this.state) {
    this.selectedAgentId = agentId;
    if (!agentId) {
      this.close();
      return;
    }
    if (state) {
      this.state = state;
    }
    const agent = this.findAgent(agentId);
    if (!agent) {
      this.close();
      return;
    }
    this.root.hidden = false;
    this.renderAgent(agent);
  }

  update(state) {
    this.state = state;
    if (!this.selectedAgentId) return;
    const agent = this.findAgent(this.selectedAgentId);
    if (!agent) {
      this.close();
      return;
    }
    this.renderAgent(agent);
  }

  findAgent(agentId) {
    if (!this.state?.agents) return null;
    return this.state.agents.find((agent) => agent.id === agentId) ?? null;
  }

  renderAgent(agent) {
    this.titleEl.textContent = `Агент #${agent.id}`;
    if (this.state?.tick != null) {
      this.tickEl.textContent = `тик ${this.state.tick}`;
    }
    if (this.fields.position) this.fields.position.textContent = `${agent.x}, ${agent.y}`;
    if (this.fields.energy) this.fields.energy.textContent = formatNumber(agent.energy, 3);
    if (this.fields.satiety) this.fields.satiety.textContent = formatNumber(agent.satiety, 3);
    if (this.fields.role) this.fields.role.textContent = agent.role ?? '—';
    if (this.fields.traits) this.fields.traits.textContent = agent.traits?.join(', ') || '—';
    if (this.fields.inventory) this.fields.inventory.textContent = formatInventory(agent.inventory);
    if (this.fields.thinkEvery) this.fields.thinkEvery.textContent = `${agent.thinkEvery ?? '—'}`;
    if (this.fields.fsm) this.fields.fsm.textContent = agent.useFSM ? 'да' : 'нет';

    updateInputValue(this.energyInput, agent.energy, 3);
    updateInputValue(this.satietyInput, agent.satiety, 3);
    updateInputValue(this.foodInput, agent.inventory?.food ?? 0);
    updateInputValue(this.woodInput, agent.inventory?.wood ?? 0);
    updateInputValue(this.thinkEveryInput, agent.thinkEvery ?? 1);
    if (document.activeElement !== this.roleInput) {
      this.roleInput.value = agent.role ?? '';
    }
    if (document.activeElement !== this.traitsInput) {
      this.traitsInput.value = agent.traits?.join(', ') ?? '';
    }
    this.fsmInput.checked = Boolean(agent.useFSM);

    this.renderTraining(agent.training);
    this.renderBrain(agent);
  }

  renderTraining(training) {
    if (!training) {
      for (const key of [
        'training-steps',
        'training-updates',
        'training-avgReward',
        'training-lastReward',
        'training-baseline',
        'training-advantage',
        'training-lastUpdate',
        'training-batch',
        'training-grad',
        'training-buffer',
      ]) {
        if (this.fields[key]) this.fields[key].textContent = '—';
      }
      this.rewardCtx.clearRect(0, 0, this.rewardCanvas.width, this.rewardCanvas.height);
      return;
    }

    if (this.fields['training-steps']) this.fields['training-steps'].textContent = `${training.steps ?? 0}`;
    if (this.fields['training-updates']) this.fields['training-updates'].textContent = `${training.updates ?? 0}`;
    if (this.fields['training-avgReward']) this.fields['training-avgReward'].textContent = formatNumber(training.avgReward, 3);
    if (this.fields['training-lastReward']) this.fields['training-lastReward'].textContent = formatNumber(training.lastReward, 3);
    if (this.fields['training-baseline']) this.fields['training-baseline'].textContent = formatNumber(training.lastBaseline, 3);
    if (this.fields['training-advantage']) this.fields['training-advantage'].textContent = formatNumber(training.lastAdvantage, 3);
    if (this.fields['training-lastUpdate']) this.fields['training-lastUpdate'].textContent = formatTimeMs(training.lastUpdateMs);
    if (this.fields['training-batch']) this.fields['training-batch'].textContent = `${training.lastBatchSize ?? 0}`;
    if (this.fields['training-grad']) this.fields['training-grad'].textContent = formatNumber(training.lastGradientRms, 3);
    if (this.fields['training-buffer']) this.fields['training-buffer'].textContent = `${training.bufferSize ?? 0}`;

    this.drawRewardsChart(training.recentRewards ?? [], training.recentReturns ?? []);
  }

  renderBrain(agent) {
    const brain = agent.brain ?? {};
    const stats = brain.stats ?? DEFAULT_STATS;
    if (this.fields['brain-model']) this.fields['brain-model'].textContent = brain.model ?? agent.brainModel ?? '—';
    if (this.fields['brain-size']) this.fields['brain-size'].textContent = brain.size != null ? `${brain.size}` : '—';
    if (this.fields['brain-min']) this.fields['brain-min'].textContent = formatNumber(stats.min, 3);
    if (this.fields['brain-max']) this.fields['brain-max'].textContent = formatNumber(stats.max, 3);
    if (this.fields['brain-mean']) this.fields['brain-mean'].textContent = formatNumber(stats.mean, 3);
    if (this.fields['brain-std']) this.fields['brain-std'].textContent = formatNumber(stats.std, 3);

    this.drawWeightsChart(agent.id, brain.preview ?? [], stats);
  }

  drawRewardsChart(rewards, returns) {
    const ctx = this.rewardCtx;
    const { width, height } = this.rewardCanvas;
    ctx.clearRect(0, 0, width, height);

    const padding = 6;
    const mid = height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    const allValues = [...rewards, ...returns];
    const maxAbs = allValues.length ? Math.max(...allValues.map((value) => Math.abs(value)), 0.1) : 1;

    const drawLine = (values, color) => {
      if (!values.length) return;
      const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < values.length; i += 1) {
        const x = padding + step * i;
        const value = values[i];
        const y = mid - (value / maxAbs) * (height / 2 - padding);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    drawLine(rewards, '#f4d03f');
    drawLine(returns, '#58d3f7');
  }

  drawWeightsChart(agentId, preview, stats) {
    const ctx = this.weightsCtx;
    const { width, height } = this.weightsCanvas;
    ctx.clearRect(0, 0, width, height);
    const baseline = height / 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    ctx.lineTo(width, baseline);
    ctx.stroke();

    if (!preview.length) {
      return;
    }

    const prev = this.prevWeights.get(agentId) ?? [];
    const maxRange = Math.max(Math.abs(stats.max ?? 1), Math.abs(stats.min ?? -1), 0.1);
    const barWidth = width / preview.length;

    for (let i = 0; i < preview.length; i += 1) {
      const value = preview[i];
      const previous = prev[i] ?? 0;
      const diff = value - previous;
      let color = '#c7d0da';
      if (diff > 0.0001) color = '#4ecdf5';
      if (diff < -0.0001) color = '#ff7e6b';
      const scaled = (value / maxRange) * (height / 2 - 8);
      const rectHeight = Math.min(Math.abs(scaled), height / 2 - 6);
      const x = i * barWidth + barWidth / 2;
      ctx.fillStyle = color;
      if (scaled >= 0) {
        ctx.fillRect(x - barWidth * 0.35, baseline - rectHeight, barWidth * 0.7, rectHeight);
      } else {
        ctx.fillRect(x - barWidth * 0.35, baseline, barWidth * 0.7, rectHeight);
      }
    }

    this.prevWeights.set(agentId, Float32Array.from(preview));
  }

  applyChanges() {
    if (!this.selectedAgentId) return;
    const payload = {
      agentId: this.selectedAgentId,
      energy: Number.parseFloat(this.energyInput.value),
      satiety: Number.parseFloat(this.satietyInput.value),
      inventory: {
        food: Number.parseInt(this.foodInput.value, 10),
        wood: Number.parseInt(this.woodInput.value, 10),
      },
      thinkEvery: Number.parseInt(this.thinkEveryInput.value, 10),
      role: this.roleInput.value,
      traits: this.traitsInput.value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length),
      useFSM: this.fsmInput.checked,
    };
    this.onCommand?.('agent:update', payload);
    this.statusEl.textContent = 'Команда отправлена';
    setTimeout(() => {
      if (this.statusEl.textContent === 'Команда отправлена') {
        this.statusEl.textContent = '';
      }
    }, 1500);
  }
}
