const DB_NAME = 'colony-sim-offline';
const DB_VERSION = 1;

const STORE_SAVES = 'saves';
const STORE_BRAINS = 'brains';

function isIndexedDBAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_BRAINS)) {
        db.createObjectStore(STORE_BRAINS, { keyPath: 'agentId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class MemoryStorage {
  constructor() {
    this.saves = [];
    this.brains = new Map();
  }

  async saveSnapshot(snapshot) {
    this.saves.push({ id: Date.now(), snapshot });
    return { ok: true, message: 'Снимок сохранён (память)' };
  }

  async loadLatestSnapshot() {
    const last = this.saves[this.saves.length - 1];
    return last?.snapshot ?? null;
  }

  async saveBrain(agentId, data) {
    this.brains.set(agentId, data);
  }

  async loadBrains() {
    return Array.from(this.brains.entries()).map(([agentId, blob]) => ({ agentId, blob }));
  }
}

class IndexedDBStorage {
  constructor(db) {
    this.db = db;
  }

  async saveSnapshot(snapshot) {
    const tx = this.db.transaction(STORE_SAVES, 'readwrite');
    const store = tx.objectStore(STORE_SAVES);
    await requestAsPromise(store.add({ snapshot, createdAt: Date.now() }));
    await transactionDone(tx);
    return { ok: true, message: 'Снимок сохранён' };
  }

  async loadLatestSnapshot() {
    const tx = this.db.transaction(STORE_SAVES, 'readonly');
    const store = tx.objectStore(STORE_SAVES);
    const request = store.getAll();
    const all = await requestAsPromise(request);
    await transactionDone(tx);
    const last = all.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).pop();
    return last?.snapshot ?? null;
  }

  async saveBrain(agentId, blob) {
    const tx = this.db.transaction(STORE_BRAINS, 'readwrite');
    const store = tx.objectStore(STORE_BRAINS);
    await requestAsPromise(store.put({ agentId, blob, updatedAt: Date.now() }));
    await transactionDone(tx);
  }

  async loadBrains() {
    const tx = this.db.transaction(STORE_BRAINS, 'readonly');
    const store = tx.objectStore(STORE_BRAINS);
    const data = await requestAsPromise(store.getAll());
    await transactionDone(tx);
    return data;
  }
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let storageInstance = null;

export async function getStorage() {
  if (storageInstance) return storageInstance;
  if (!isIndexedDBAvailable()) {
    storageInstance = new MemoryStorage();
    return storageInstance;
  }
  try {
    const db = await openDatabase();
    storageInstance = new IndexedDBStorage(db);
  } catch (error) {
    console.warn('IndexedDB недоступен, используется память', error);
    storageInstance = new MemoryStorage();
  }
  return storageInstance;
}
