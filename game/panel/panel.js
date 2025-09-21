import { createOverviewTab } from './tabs/overview.js';
import { createAgentsTab } from './tabs/agents.js';
import { createWorldTab } from './tabs/world.js';
import { createCommsTab } from './tabs/comms.js';
import { createEventsTab } from './tabs/events.js';
import { createSavesTab } from './tabs/saves.js';
import { createSettingsTab } from './tabs/settings.js';
import { createHelpTab } from './tabs/help.js';

const TABS = [
  { id: 'overview', title: 'Обзор', factory: createOverviewTab },
  { id: 'agents', title: 'Агенты', factory: createAgentsTab },
  { id: 'world', title: 'Мир', factory: createWorldTab },
  { id: 'comms', title: 'Коммуникация', factory: createCommsTab },
  { id: 'events', title: 'События', factory: createEventsTab },
  { id: 'saves', title: 'Сейвы и данные', factory: createSavesTab },
  { id: 'settings', title: 'Настройки', factory: createSettingsTab },
  { id: 'help', title: 'Справка', factory: createHelpTab },
];

export class ControlPanel {
  constructor({ containerId = 'panel-root', onCommand } = {}) {
    this.container = document.getElementById(containerId) ?? document.body;
    this.onCommand = onCommand;
    this.isOpen = false;
    this.state = null;
    this.tabInstances = new Map();
    this.currentTab = 'overview';
    this.root = document.createElement('aside');
    this.root.className = 'control-panel';
    this.root.setAttribute('role', 'complementary');
    this.root.setAttribute('aria-hidden', 'true');

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'panel-toggle';
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.setAttribute('aria-controls', 'panel-tabs');
    this.toggleButton.innerHTML = '⚙️';
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.toggleButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggle();
      }
    });

    this.tablist = document.createElement('div');
    this.tablist.className = 'panel-tabs';
    this.tablist.id = 'panel-tabs';
    this.tablist.setAttribute('role', 'tablist');

    this.content = document.createElement('div');
    this.content.className = 'panel-content';

    this.root.appendChild(this.tablist);
    this.root.appendChild(this.content);
    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.root);

    this.renderTabs();
  }

  renderTabs() {
    for (const tab of TABS) {
      const button = document.createElement('button');
      button.className = 'panel-tab';
      button.type = 'button';
      button.id = `tab-${tab.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', tab.id === this.currentTab ? 'true' : 'false');
      button.setAttribute('aria-controls', `panel-${tab.id}`);
      button.textContent = tab.title;
      button.addEventListener('click', () => this.selectTab(tab.id));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const index = TABS.findIndex((item) => item.id === tab.id);
          const nextIndex =
            event.key === 'ArrowRight'
              ? (index + 1) % TABS.length
              : (index - 1 + TABS.length) % TABS.length;
          this.selectTab(TABS[nextIndex].id);
          this.focusTab(TABS[nextIndex].id);
        }
      });
      this.tablist.appendChild(button);

      const panel = document.createElement('section');
      panel.className = 'tab-panel';
      panel.id = `panel-${tab.id}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${tab.id}`);
      panel.hidden = tab.id !== this.currentTab;
      const instance = tab.factory({
        onCommand: (cmd, payload) => this.onCommand?.(cmd, payload),
      });
      panel.appendChild(instance.element);
      this.tabInstances.set(tab.id, instance);
      this.content.appendChild(panel);
    }
  }

  focusTab(id) {
    const button = this.tablist.querySelector(`#tab-${id}`);
    if (button) button.focus();
  }

  selectTab(id) {
    if (this.currentTab === id) return;
    const prev = this.tabInstances.get(this.currentTab);
    const next = this.tabInstances.get(id);
    const prevPanel = this.content.querySelector(`#panel-${this.currentTab}`);
    const nextPanel = this.content.querySelector(`#panel-${id}`);
    if (prevPanel) {
      prevPanel.hidden = true;
    }
    if (nextPanel) {
      nextPanel.hidden = false;
    }
    const prevButton = this.tablist.querySelector(`#tab-${this.currentTab}`);
    const nextButton = this.tablist.querySelector(`#tab-${id}`);
    if (prevButton) prevButton.setAttribute('aria-selected', 'false');
    if (nextButton) nextButton.setAttribute('aria-selected', 'true');
    this.currentTab = id;
    prev?.onDeactivate?.();
    next?.onActivate?.(this.state);
  }

  toggle(force) {
    const desired = typeof force === 'boolean' ? force : !this.isOpen;
    this.isOpen = desired;
    this.root.setAttribute('aria-hidden', desired ? 'false' : 'true');
    this.root.classList.toggle('panel-open', desired);
    this.toggleButton.setAttribute('aria-expanded', desired ? 'true' : 'false');
    if (desired) {
      this.focusTab(this.currentTab);
    }
  }

  update(state) {
    this.state = state;
    for (const [id, instance] of this.tabInstances.entries()) {
      instance.update?.(state);
    }
  }
}
