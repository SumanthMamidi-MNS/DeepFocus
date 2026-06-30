/**
 * Deep Focus v2.0 - Reactive State Store
 */

class Store {
  constructor() {
    this.subscribers = new Set();

    // Default settings
    const defaultSettings = {
      theme: 'zen-dark',
      masterVolume: 0.7,
      autoResume: false,
      keyboardVolume: 0.5,
      notificationEnabled: true,
      keyboardSwitch: 'blue', // default mechanical profile
      visualizerMode: 'aurora' // default visual mode
    };

    // Load settings from localStorage
    const savedSettings = {};
    for (const key of Object.keys(defaultSettings)) {
      const stored = localStorage.getItem(`df_settings_${key}`);
      if (stored !== null) {
        try {
          savedSettings[key] = JSON.parse(stored);
        } catch {
          savedSettings[key] = stored;
        }
      } else {
        savedSettings[key] = defaultSettings[key];
      }
    }

    this.state = {
      // Timer state
      timer: {
        timeLeft: 25 * 60,
        duration: 25 * 60,
        isRunning: false,
        type: 'focus',
        cycleCount: 0,
        pomoCycles: 0,
        distractionsCount: 0
      },

      // Audio state
      audio: {
        masterVolume: savedSettings.masterVolume,
        eq: [0, 0, 0, 0, 0],
        layers: {
          musicPad: { active: true, volume: 0.6, pan: 0.0, pitch: 1.0 },
          rain: { active: false, volume: 0.5, pan: 0.0, pitch: 1.0 },
          wind: { active: false, volume: 0.4, pan: -0.3, pitch: 1.0 },
          fire: { active: false, volume: 0.4, pan: 0.2, pitch: 1.0 },
          waves: { active: false, volume: 0.5, pan: 0.0, pitch: 0.8 },
          whiteNoise: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
          coffeeShop: { active: false, volume: 0.4, pan: -0.2, pitch: 1.0 },
          keyboard: { active: false, volume: savedSettings.keyboardVolume, pan: 0.1, pitch: 1.0 },
          paper: { active: false, volume: 0.4, pan: 0.3, pitch: 1.0 }
        },
        // G.O.A.T. Binaural Beats and Solfeggio tones
        binaural: {
          active: false,
          frequency: 10, // 10Hz Alpha (Focus)
          carrier: 140,  // 140Hz
          volume: 0.15
        },
        solfeggio: {
          active: false,
          frequency: 528, // 528Hz Transformation / Focus
          volume: 0.1
        },
        keyboardSwitch: savedSettings.keyboardSwitch,
        currentPreset: null
      },

      // User Settings
      settings: {
        theme: savedSettings.theme,
        autoResume: savedSettings.autoResume,
        notificationEnabled: savedSettings.notificationEnabled,
        visualizerMode: savedSettings.visualizerMode,
        selectedChime: 'tibetan-bowl'
      },

      // G.O.A.T. Task Board states
      tasks: [],
      activeTaskId: null,

      // G.O.A.T. Custom Theme list
      userThemes: [],

      // G.O.A.T. Full-Screen Zen Mode active state
      zenModeActive: false,

      // Mood / Journal / Stats State
      currentMood: null,
      todaySessions: [],
      weeklyStats: {
        focusMinutes: [0, 0, 0, 0, 0, 0, 0],
        streak: 0,
        completedCount: 0,
        successRate: 0
      },
      recentJournals: [],
      smartRecommendation: 'Welcome back. Let\'s set a clear focus goal today.'
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const callback of this.subscribers) {
      try {
        callback(this.state);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    }
  }

  setState(path, value) {
    const parts = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) return;
      current = current[parts[i]];
    }

    const lastKey = parts[parts.length - 1];
    current[lastKey] = value;

    // Side-effects persistence
    if (path.startsWith('settings.')) {
      const settingKey = path.substring(9);
      localStorage.setItem(`df_settings_${settingKey}`, JSON.stringify(value));
    }
    if (path === 'audio.masterVolume') {
      localStorage.setItem('df_settings_masterVolume', JSON.stringify(value));
    }
    if (path === 'audio.layers.keyboard.volume') {
      localStorage.setItem('df_settings_keyboardVolume', JSON.stringify(value));
    }
    if (path === 'audio.keyboardSwitch') {
      localStorage.setItem('df_settings_keyboardSwitch', JSON.stringify(value));
    }

    this.notify();
  }

  getState() {
    return this.state;
  }
}

export const store = new Store();
export default store;
