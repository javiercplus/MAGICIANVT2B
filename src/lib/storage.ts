export interface SavedConfig {
  gazeEnabled?: boolean;
  captureOutside?: boolean;
  micEnabled?: boolean;
  autoBlinkEnabled?: boolean;
  greenScreen?: boolean;
  lighting?: any; // LightingConfig
}

const DB_NAME = 'MagicianVrmDB';
const STORE_NAME = 'VrmStore';
const CONFIG_KEY = 'magician_vrm_config';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveVrmToIndexedDB(blob: Blob, name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ blob, name }, 'lastVrm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadVrmFromIndexedDB(): Promise<{ blob: Blob; name: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('lastVrm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result as { blob: Blob; name: string });
      } else {
        resolve(null);
      }
    };
  });
}

export function saveConfig(config: SavedConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save config to localStorage', err);
  }
}

export function loadConfig(): SavedConfig | null {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load config from localStorage', err);
    return null;
  }
}
