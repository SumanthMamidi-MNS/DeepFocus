/**
 * Deep Focus v2.0 - Immersive Zen Mode UI Component
 */

import store from '../../state/store.js';
import { startTimer, pauseTimer } from '../../timer/timer.js';

export function initZenModeUi() {
  const zenOverlay = document.getElementById('zen-overlay');
  const zenDigits = document.getElementById('zen-digits');
  const zenCloseBtn = document.getElementById('zen-close-btn');
  const zenPlayPauseBtn = document.getElementById('zen-play-pause-btn');
  const zenTaskLabel = document.getElementById('zen-active-task-label');

  if (!zenOverlay || !zenCloseBtn || !zenPlayPauseBtn) {
    console.warn("Zen Mode UI elements not found. Skipping initialization.");
    return;
  }

  // Breathing guide elements
  const breathingCircle = document.getElementById('zen-breathing-circle');
  const breathingText = document.getElementById('zen-breathing-text');

  let breathingInterval = null;
  let breathStateIdx = 0;

  // Box Breathing cycle: Inhale (4s), Hold (4s), Exhale (4s), Hold (4s)
  const breathCycles = [
    { text: 'Inhale...', class: 'inhale', duration: 4000 },
    { text: 'Hold...', class: 'hold-in', duration: 4000 },
    { text: 'Exhale...', class: 'exhale', duration: 4000 },
    { text: 'Hold...', class: 'hold-out', duration: 4000 }
  ];

  // Bind Open Zen Mode trigger
  const enterZenBtn = document.getElementById('enter-zen-mode-btn');
  if (enterZenBtn) {
    enterZenBtn.addEventListener('click', () => {
      store.setState('zenModeActive', true);
    });
  }

  // Bind Close Button
  zenCloseBtn.addEventListener('click', () => {
    store.setState('zenModeActive', false);
  });

  // Bind Zen Play/Pause
  zenPlayPauseBtn.addEventListener('click', () => {
    const { timer } = store.getState();
    if (timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  // Subscribe to store updates
  store.subscribe((state) => {
    const { zenModeActive, timer, tasks, activeTaskId } = state;

    // 1. Sync full-screen toggle visibility
    if (zenModeActive) {
      zenOverlay.classList.add('open');
      document.body.style.overflow = 'hidden'; // Lock scrolling
      
      // Start breathing loop if not running
      startBreathingCycle();
    } else {
      zenOverlay.classList.remove('open');
      document.body.style.overflow = '';
      
      // Clear breathing loop
      stopBreathingCycle();
    }

    // 2. Sync countdown timer digits
    const minutes = Math.floor(timer.timeLeft / 60);
    const seconds = timer.timeLeft % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (zenDigits) {
      zenDigits.textContent = formatted;
    }

    // 3. Sync Active Task details
    if (zenTaskLabel) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        zenTaskLabel.textContent = `Focusing on: ${activeTask.title}`;
        zenTaskLabel.style.display = 'block';
      } else {
        zenTaskLabel.style.display = 'none';
      }
    }

    // 4. Sync Play/Pause button icons inside Zen
    if (zenPlayPauseBtn) {
      if (timer.isRunning) {
        zenPlayPauseBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        `;
      } else {
        zenPlayPauseBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
      }
    }
  });

  function startBreathingCycle() {
    if (breathingInterval) return;

    breathStateIdx = 0;
    runBreathTick();

    // Loop through breathing box sequence
    const cycleDurations = 4000;
    breathingInterval = setInterval(() => {
      breathStateIdx = (breathStateIdx + 1) % 4;
      runBreathTick();
    }, cycleDurations);
  }

  function runBreathTick() {
    const cycle = breathCycles[breathStateIdx];
    if (breathingText) {
      breathingText.textContent = cycle.text;
    }

    // Reset breathing visualizer classes
    if (breathingCircle) {
      breathingCircle.className = 'zen-breathing-circle';
      // Force repaint to restart CSS transitions
      void breathingCircle.offsetWidth;
      breathingCircle.classList.add(cycle.class);
    }
  }

  function stopBreathingCycle() {
    if (breathingInterval) {
      clearInterval(breathingInterval);
      breathingInterval = null;
    }
  }
}
