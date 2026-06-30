/**
 * Deep Focus v2.0 - Layout and Modal Controller
 */

import store from '../state/store.js';
import { startTimer, pauseTimer, resetTimer, skipSession, fitToNextHour } from '../timer/timer.js';
import { initVisualizer, startVisualizerLoop, stopVisualizerLoop } from '../audio/visualizer.js';
import { clearAllUserData } from '../state/db.js';
import { updateMasterVolume, fadeMasterVolume } from '../audio/synth.js';

export function initViewController() {
  const themeSelector = document.getElementById('theme-select');
  const shortcutModal = document.getElementById('modal-shortcuts');
  const openShortcutsBtn = document.getElementById('open-shortcuts-btn');
  const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
  const toggleNotificationBtn = document.getElementById('toggle-notification-btn');

  // 1. Initial visualizer canvas setup
  const canvasEl = document.getElementById('visualizer-canvas');
  if (canvasEl) {
    initVisualizer(canvasEl);
  }

  // 2. Theme selector binding
  themeSelector.addEventListener('change', (e) => {
    const selectedTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    store.setState('settings.theme', selectedTheme);
  });

  // Load initial theme on HTML node
  const { settings } = store.getState();
  document.documentElement.setAttribute('data-theme', settings.theme);
  themeSelector.value = settings.theme;

  // 2b. Visualizer mode selector binding (G.O.A.T. addition)
  const visModeSelect = document.getElementById('visualizer-mode-select');
  if (visModeSelect) {
    visModeSelect.addEventListener('change', (e) => {
      store.setState('settings.visualizerMode', e.target.value);
    });
    visModeSelect.value = settings.visualizerMode || 'aurora';
  }

  // 3. Bind Keyboard Shortcuts Modals
  openShortcutsBtn.addEventListener('click', () => {
    shortcutModal.classList.add('open');
  });

  closeShortcutsBtn.addEventListener('click', () => {
    shortcutModal.classList.remove('open');
  });

  // Modal dismiss on overlay clicking
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  // Save preset modal cancel
  const closePresetSaveBtn = document.getElementById('close-preset-save-btn');
  if (closePresetSaveBtn) {
    closePresetSaveBtn.addEventListener('click', () => {
      document.getElementById('modal-preset-save').classList.remove('open');
    });
  }

  // Trigger Save Preset modal open
  const openPresetSaveBtn = document.getElementById('open-preset-save-modal-btn');
  if (openPresetSaveBtn) {
    openPresetSaveBtn.addEventListener('click', () => {
      document.getElementById('modal-preset-save').classList.add('open');
    });
  }

  // 4. Request Notifications permission toggler
  toggleNotificationBtn.addEventListener('click', () => {
    const { settings: currentSettings } = store.getState();
    
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        const granted = permission === 'granted';
        store.setState('settings.notificationEnabled', granted);
        updateNotificationIcon(granted);
      });
    } else {
      const toggled = !currentSettings.notificationEnabled;
      store.setState('settings.notificationEnabled', toggled);
      updateNotificationIcon(toggled);
    }
  });

  // Sync notification button visual state
  updateNotificationIcon(settings.notificationEnabled && Notification.permission === 'granted');

  function updateNotificationIcon(enabled) {
    if (enabled) {
      toggleNotificationBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
        <span class="sr-only">Notifications Enabled</span>
      `;
      toggleNotificationBtn.setAttribute('title', 'Notifications Enabled');
    } else {
      toggleNotificationBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-2 7H8v-7c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v7zm-5.75-9.25h1.5v3h-1.5v-3zm0 4.5h1.5v1.5h-1.5v-1.5z"/>
        </svg>
        <span class="sr-only">Notifications Muted</span>
      `;
      toggleNotificationBtn.setAttribute('title', 'Notifications Muted');
    }
  }

  // 5. Global Keyboard Shortcuts Handler
  document.addEventListener('keydown', (e) => {
    // Skip shortcut processing if user is currently typing in input or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    const { timer } = store.getState();
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (timer.isRunning) {
          pauseTimer();
        } else {
          startTimer();
        }
        break;
      case 'KeyR':
        resetTimer();
        break;
      case 'KeyS':
        skipSession();
        break;
      case 'KeyF':
        fitToNextHour();
        break;
      case 'KeyZ':
        const { zenModeActive } = store.getState();
        store.setState('zenModeActive', !zenModeActive);
        break;
      case 'Slash': // '?' key (with shift)
        if (e.shiftKey) {
          shortcutModal.classList.toggle('open');
        }
        break;
      default:
        break;
    }
  });

  // 6. Hook visualizer state to timer state
  store.subscribe((state) => {
    const { timer } = state;
    if (timer.isRunning) {
      startVisualizerLoop();
    } else {
      // Keep running visualizer for fluid backdrop movement, but let it go into idle wave state
      startVisualizerLoop();
    }
  });

  // 7. Tab switches for Audio & Workspace panels (G.O.A.T. addition)
  const tabButtons = document.querySelectorAll('.panel-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabGroup = btn.parentElement;
      const targetId = btn.dataset.tab;
      
      // Deactivate all siblings in this tab group
      tabGroup.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Deactivate all sibling panels
      const parentCard = tabGroup.closest('.glass-panel');
      parentCard.querySelectorAll('.panel-tab-content').forEach((panel) => {
        panel.classList.remove('active');
      });

      // Activate target panel
      const targetPanel = parentCard.querySelector(`#${targetId}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // 8. Session controls: Guest Mode & Workspace Reset (G.O.A.T. addition)
  const guestBtn = document.getElementById('guest-mode-btn');
  const guestIndicator = document.getElementById('guest-indicator');
  const guestLabel = document.getElementById('guest-label');
  const resetBtn = document.getElementById('reset-workspace-btn');

  // Load initial Guest Mode setting (defaults to Guest Mode: Active)
  let persistenceEnabled = localStorage.getItem('df_persistence_enabled') === 'true';
  updateGuestModeUI();

  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      persistenceEnabled = !persistenceEnabled;
      localStorage.setItem('df_persistence_enabled', persistenceEnabled ? 'true' : 'false');
      updateGuestModeUI();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Reset Workspace?\n\nThis will permanently delete all custom presets, tasks, journals, and theme customizations, resetting the app to factory defaults.")) {
        clearAllUserData().then(() => {
          // Force reload page to boot fresh
          window.location.reload();
        });
      }
    });
  }

  function updateGuestModeUI() {
    if (!guestIndicator || !guestLabel || !guestBtn) return;
    if (!persistenceEnabled) {
      guestIndicator.style.background = '#22c55e'; // Green
      guestLabel.textContent = 'Guest Session';
      guestBtn.title = 'Guest Session: Changes are transient and will clear on exit.';
    } else {
      guestIndicator.style.background = '#a855f7'; // Purple
      guestLabel.textContent = 'Persistent';
      guestBtn.title = 'Persistent Workspace: All changes are saved locally.';
    }
  }

  // 9. Pomo visual dot sync & distraction count sync
  store.subscribe((state) => {
    const pomoCycles = state.timer.pomoCycles || 0;
    document.querySelectorAll('.pomo-dot').forEach((dot, idx) => {
      if (idx < pomoCycles) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });

    const distractionCount = state.timer.distractionsCount || 0;
    const badge = document.getElementById('distraction-count-badge');
    if (badge) {
      if (distractionCount > 0) {
        badge.textContent = distractionCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  });

  // 10. Distraction Logger Click Event
  const logDistractionBtn = document.getElementById('log-distraction-btn');
  if (logDistractionBtn) {
    logDistractionBtn.addEventListener('click', () => {
      const currentCount = store.getState().timer.distractionsCount || 0;
      store.setState('timer.distractionsCount', currentCount + 1);
      
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(550, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } catch (err) {}
    });
  }

  // 11. Chime Selector Change Event
  const chimeSelect = document.getElementById('chime-select');
  if (chimeSelect) {
    chimeSelect.addEventListener('change', (e) => {
      store.setState('settings.selectedChime', e.target.value);
    });
    const currentSettings = store.getState().settings;
    chimeSelect.value = currentSettings.selectedChime || 'tibetan-bowl';
  }

  // 12. Session Completed Modal Listeners
  window.addEventListener('session-completed', (e) => {
    const statsText = document.getElementById('completion-modal-stats');
    if (statsText) {
      statsText.textContent = `You focused for ${e.detail.duration} minutes. Great work!`;
    }

    const quotes = [
      { q: "Focus is a muscle, and you just completed a heavy lift.", a: "Zenith Guide" },
      { q: "Real density of focus is not busy-ness, but stillness of mind.", a: "Sumanth Mamidi" },
      { q: "The successful warrior is the average man, with laser-like focus.", a: "Bruce Lee" },
      { q: "Keep your attention focused entirely on what is truly your own concern.", a: "Epictetus" },
      { q: "Concentration is the secret of strength in politics, in war, in trade, in short in all management of human affairs.", a: "Ralph Waldo Emerson" }
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteText = document.getElementById('completion-quote');
    const authorText = document.getElementById('completion-quote-author');
    if (quoteText && authorText) {
      quoteText.textContent = `"${randomQuote.q}"`;
      authorText.textContent = `— ${randomQuote.a}`;
    }

    const completionModal = document.getElementById('modal-completion');
    if (completionModal) {
      completionModal.classList.add('open');
    }
  });

  const completionCloseBtn = document.getElementById('completion-close-btn');
  if (completionCloseBtn) {
    completionCloseBtn.addEventListener('click', () => {
      document.getElementById('modal-completion').classList.remove('open');
      store.setState('timer.distractionsCount', 0);
    });
  }

  // 13. Master Sound Stop/Play Toggle Control
  const masterSoundToggleBtn = document.getElementById('master-sound-toggle-btn');
  const masterSoundIcon = document.getElementById('master-sound-icon');
  let previousMasterVolume = 0.7;

  if (masterSoundToggleBtn) {
    masterSoundToggleBtn.addEventListener('click', () => {
      const currentVol = store.getState().audio.masterVolume;
      if (currentVol > 0) {
        previousMasterVolume = currentVol;
        store.setState('audio.masterVolume', 0);
        fadeMasterVolume(0, 0.5);
      } else {
        const restoreVol = previousMasterVolume > 0 ? previousMasterVolume : 0.7;
        store.setState('audio.masterVolume', restoreVol);
        fadeMasterVolume(restoreVol, 0.5);
      }
    });
  }

  // Sync master sound toggle UI icon on masterVolume changes
  store.subscribe((state) => {
    const vol = state.audio.masterVolume;
    if (masterSoundIcon) {
      if (vol > 0) {
        masterSoundIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;
        if (masterSoundToggleBtn) masterSoundToggleBtn.title = "Mute Ambient Soundscape";
      } else {
        masterSoundIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
        if (masterSoundToggleBtn) masterSoundToggleBtn.title = "Unmute Ambient Soundscape";
      }
    }
  });

  // 14. Interactive User Guide Modal Tabs Control
  const tabBtnGuide = document.getElementById('help-tab-btn-guide');
  const tabBtnKeys = document.getElementById('help-tab-btn-keys');
  const tabContentGuide = document.getElementById('help-tab-content-guide');
  const tabContentKeys = document.getElementById('help-tab-content-keys');

  if (tabBtnGuide && tabBtnKeys && tabContentGuide && tabContentKeys) {
    tabBtnGuide.addEventListener('click', () => {
      tabBtnGuide.className = 'btn-primary help-tab-btn';
      tabBtnKeys.className = 'btn-secondary help-tab-btn';
      tabContentGuide.style.display = 'flex';
      tabContentKeys.style.display = 'none';
    });

    tabBtnKeys.addEventListener('click', () => {
      tabBtnGuide.className = 'btn-secondary help-tab-btn';
      tabBtnKeys.className = 'btn-primary help-tab-btn';
      tabContentGuide.style.display = 'none';
      tabContentKeys.style.display = 'flex';
    });
  }
}

