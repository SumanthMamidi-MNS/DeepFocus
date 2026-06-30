/**
 * Deep Focus v2.0 - Core Application Bootstrapper
 */

import { initDB } from './state/db.js';
import { initializeAudioSync } from './audio/studio.js';
import { initTimerUi } from './ui/components/timerUi.js';
import { initStudioUi } from './ui/components/studioUi.js';
import { initJournalUi } from './ui/components/journalUi.js';
import { initAnalyticsUi } from './ui/components/analyticsUi.js';
import { initViewController } from './ui/view.js';
import { initTodoUi } from './ui/components/todoUi.js';
import { initThemeCreatorUi } from './ui/components/themeCreatorUi.js';
import { initZenModeUi } from './ui/components/zenModeUi.js';
import { initAiCompanionUi } from './ui/components/aiCompanionUi.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Deep Focus v2.0: Starting application bootstrap...');

  // Initialize DB first, then spin up components
  initDB()
    .then(() => {
      console.log('Deep Focus DB initialized successfully.');

      // 1. Initialize background Audio Syncer
      initializeAudioSync();

      // 2. Initialize UI views and modules
      initViewController();
      initTimerUi();
      initStudioUi();
      initJournalUi();
      initAnalyticsUi();
      initTodoUi();
      initThemeCreatorUi();
      initZenModeUi();
      initAiCompanionUi();

      // 3. Register PWA Service Worker
      registerServiceWorker();

      console.log('Deep Focus bootstrap completed successfully.');
    })
    .catch((error) => {
      console.error('Fatal initialization error during bootstrap:', error);
    });
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}
