import { EVENT_TYPES } from '../data/constants.js';
import { randomChoice } from '../utils/random.js';

export class Storyteller {
  constructor({ tensionBudget = 1, cooldownTicks = 30 } = {}) {
    this.tensionBudget = tensionBudget;
    this.cooldown = cooldownTicks;
    this.timer = 0;
    this.history = [];
  }

  tick(delta, world, ecs) {
    if (this.timer > 0) {
      this.timer -= delta;
      return null;
    }
    if (this.tensionBudget <= 0) return null;
    if (Math.random() > 0.02) return null;

    const eventType = randomChoice(EVENT_TYPES);
    const event = {
      type: eventType,
      tick: world.timeOfDay,
      impact: Math.random(),
      description: this.describe(eventType),
    };
    this.history.push(event);
    if (this.history.length > 50) this.history.shift();
    this.tensionBudget -= event.impact * 0.1;
    this.timer = this.cooldown;
    return event;
  }

  record(type, description, { impact = 0.05, tick = 0 } = {}) {
    const event = {
      type,
      tick,
      impact,
      description,
    };
    this.history.push(event);
    if (this.history.length > 50) this.history.shift();
    this.tensionBudget = Math.max(0, this.tensionBudget - impact * 0.1);
    return event;
  }

  describe(type) {
    switch (type) {
      case 'storm':
        return 'Надвигается шторм';
      case 'raid':
        return 'Враждебный набег замечен на горизонте';
      case 'drought':
        return 'Поля высыхают';
      case 'ritual':
        return 'Колония готовит ритуал для поднятия духа';
      default:
        return 'Случилось что-то необычное';
    }
  }
}
