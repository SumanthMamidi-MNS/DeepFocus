/**
 * Deep Focus v2.0 - IndexedDB Storage Engine
 */

const DB_NAME = 'DeepFocusDB';
const DB_VERSION = 4; // Upgraded to v4 to bypass user browser VersionError (where v3 already exists)

let dbInstance = null;
let dbPromise = null;

export function initDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  // Handle transient guest session wipe on first tab opening
  if (!sessionStorage.getItem('df_session_active')) {
    sessionStorage.setItem('df_session_active', 'true');
    
    const persistenceEnabled = localStorage.getItem('df_persistence_enabled') === 'true';
    if (!persistenceEnabled) {
      console.log("New Guest session detected. Evicting previous transient data...");
      
      // Clear localStorage values
      localStorage.clear();

      // Delete the database to get a clean factory state
      dbPromise = new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = deleteRequest.onerror = deleteRequest.onblocked = () => {
          openDatabaseConnection(resolve, reject);
        };
      });
      return dbPromise;
    } else {
      console.log("Persistent workspace session active. Restoring saved data...");
    }
  }

  dbPromise = new Promise((resolve, reject) => {
    openDatabaseConnection(resolve, reject);
  });
  return dbPromise;
}

function openDatabaseConnection(resolve, reject) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onerror = (event) => {
    console.error('IndexedDB Error:', event.target.error);
    dbPromise = null; // Reset on failure
    reject(event.target.error);
  };

  request.onsuccess = (event) => {
    dbInstance = event.target.result;
    resolve(dbInstance);
  };

  request.onupgradeneeded = (event) => {
    const db = event.target.result;

    // 1. Session History Store
    if (!db.objectStoreNames.contains('history')) {
      const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      historyStore.createIndex('startTime', 'startTime', { unique: false });
      historyStore.createIndex('type', 'type', { unique: false });
    }

    // 2. Custom Sound Presets Store
    if (!db.objectStoreNames.contains('presets')) {
      db.createObjectStore('presets', { keyPath: 'name' });
    }

    // 3. Journal Store
    if (!db.objectStoreNames.contains('journal')) {
      const journalStore = db.createObjectStore('journal', { keyPath: 'id', autoIncrement: true });
      journalStore.createIndex('date', 'date', { unique: false });
    }

    // 4. Zen Tasks Store (G.O.A.T. addition)
    if (!db.objectStoreNames.contains('tasks')) {
      db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
    }

    // 5. User Custom Themes Store (G.O.A.T. addition)
    if (!db.objectStoreNames.contains('user_themes')) {
      db.createObjectStore('user_themes', { keyPath: 'name' });
    }
  };
}

function getStore(storeName, mode = 'readonly') {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

// --- Session History Methods ---

export function addSession(session) {
  return getStore('history', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.add({
        startTime: Date.now(),
        duration: session.duration, // in minutes
        type: session.type, // 'focus' | 'break'
        completed: session.completed, // boolean
        mood: session.mood || null,
        journal: session.journal || '',
        ...session
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getAllSessions() {
  return getStore('history', 'readonly').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

// --- Custom Presets Methods ---

export function savePreset(preset) {
  return getStore('presets', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(preset); // name is keyPath
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getPresets() {
  return getStore('presets', 'readonly').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deletePreset(name) {
  return getStore('presets', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// --- Journal Entry Methods ---

export function addJournalEntry(entry) {
  return getStore('journal', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.add({
        date: Date.now(),
        mood: entry.mood,
        note: entry.note
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getAllJournalEntries() {
  return getStore('journal', 'readonly').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteJournalEntry(id) {
  return getStore('journal', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// --- G.O.A.T. Todo Task List Methods ---

export function saveTask(task) {
  return getStore('tasks', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(task); // put acts as add if id is missing, or update if id exists
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getAllTasks() {
  return getStore('tasks', 'readonly').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteTask(id) {
  return getStore('tasks', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// --- G.O.A.T. Custom User Themes Methods ---

export function saveUserTheme(theme) {
  return getStore('user_themes', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(theme); // name is keyPath
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getUserThemes() {
  return getStore('user_themes', 'readonly').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteUserTheme(name) {
  return getStore('user_themes', 'readwrite').then((store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

export function clearAllUserData() {
  localStorage.clear();
  return new Promise((resolve) => {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    dbPromise = null;
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
      console.log('IndexedDB database deleted successfully.');
      resolve();
    };
    req.onerror = () => {
      console.error('Error deleting IndexedDB database:', req.error);
      resolve();
    };
    req.onblocked = () => {
      console.warn('Database deletion blocked.');
      resolve();
    };
  });
}
