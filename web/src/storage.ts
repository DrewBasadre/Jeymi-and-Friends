import type { Project } from './project';

/** Local drafts in IndexedDB: survives reloads and works offline. */
const DB_NAME = 'pavo-teacher-studio';
const STORE = 'projects';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const projectStore = {
  list: () => run<Project[]>('readonly', (store) => store.getAll() as IDBRequest<Project[]>),
  save: (project: Project) => run('readwrite', (store) => store.put(project)),
  remove: (id: string) => run('readwrite', (store) => store.delete(id)),
};
