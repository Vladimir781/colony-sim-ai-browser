export class ECS {
  constructor() {
    this.nextId = 1;
    this.entities = new Set();
    this.components = new Map();
    this.systems = [];
  }

  createEntity() {
    const id = this.nextId;
    this.nextId += 1;
    this.entities.add(id);
    return id;
  }

  removeEntity(id) {
    this.entities.delete(id);
    for (const store of this.components.values()) {
      store.delete(id);
    }
  }

  registerComponent(name) {
    if (!this.components.has(name)) {
      this.components.set(name, new Map());
    }
  }

  addComponent(entity, name, data) {
    this.registerComponent(name);
    this.components.get(name).set(entity, data);
  }

  getComponent(entity, name) {
    const store = this.components.get(name);
    return store ? store.get(entity) : undefined;
  }

  getComponents(name) {
    return this.components.get(name) ?? new Map();
  }

  addSystem(system) {
    this.systems.push(system);
  }

  runSystems(delta) {
    for (const system of this.systems) {
      system(delta, this);
    }
  }
}

export function queryEntities(ecs, componentNames) {
  const [first, ...rest] = componentNames;
  const base = ecs.getComponents(first);
  const entities = [];
  for (const [entity, data] of base.entries()) {
    let include = true;
    for (const name of rest) {
      const comp = ecs.getComponent(entity, name);
      if (!comp) {
        include = false;
        break;
      }
    }
    if (include) {
      entities.push({ entity, components: { [first]: data } });
    }
  }
  return entities;
}
