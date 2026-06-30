/**
 * Deep Focus v2.0 - Timer UI Component
 */

import store from '../../state/store.js';
import { startTimer, pauseTimer, resetTimer, adjustTime, fitToNextHour, skipSession } from '../../timer/timer.js';

export function initTimerUi() {
  const digitsEl = document.getElementById('timer-digits');
  const labelEl = document.getElementById('timer-label');
  const statusEl = document.getElementById('timer-status');
  const progressRing = document.getElementById('timer-progress-ring');

  const playPauseBtn = document.getElementById('timer-play-pause-btn');
  const resetBtn = document.getElementById('timer-reset-btn');
  const skipBtn = document.getElementById('timer-skip-btn');
  const adjustMinusBtn = document.getElementById('timer-adjust-minus');
  const adjustPlusBtn = document.getElementById('timer-adjust-plus');
  const fitHourBtn = document.getElementById('timer-fit-hour-btn');

  // Ring circumference for R=120
  const circumference = 2 * Math.PI * 120;
  if (progressRing) {
    progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRing.style.strokeDashoffset = circumference;
  }

  // Bind Buttons
  playPauseBtn.addEventListener('click', () => {
    const { timer } = store.getState();
    if (timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', skipSession);
  adjustMinusBtn.addEventListener('click', () => adjustTime(-60)); // Subtract 1 minute
  adjustPlusBtn.addEventListener('click', () => adjustTime(60));  // Add 1 minute
  fitHourBtn.addEventListener('click', fitToNextHour);

  // Subscribe to store updates
  store.subscribe((state) => {
    const { timer } = state;

    // 1. Format digits
    const minutes = Math.floor(timer.timeLeft / 60);
    const seconds = timer.timeLeft % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (digitsEl) {
      digitsEl.textContent = formattedTime;
    }

    // Update document title for background check
    document.title = timer.isRunning 
      ? `(${formattedTime}) Deep Focus` 
      : 'Deep Focus — Ambient Focus';

    // 2. Set Labels
    if (labelEl) {
      labelEl.textContent = timer.type === 'focus' ? 'Focus Block' : 'Break Time';
      labelEl.style.color = timer.type === 'focus' ? 'var(--text-primary)' : 'var(--accent-secondary)';
    }

    // 3. Set Status/Icons
    if (statusEl) {
      statusEl.textContent = timer.isRunning ? 'Active Flow' : 'Session Paused';
    }

    if (playPauseBtn) {
      // Toggle Play/Pause icons
      if (timer.isRunning) {
        playPauseBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <span class="sr-only">Pause Timer</span>
        `;
      } else {
        playPauseBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span class="sr-only">Start Timer</span>
        `;
      }
    }

    // 4. Update SVG progress ring
    if (progressRing) {
      const progressFraction = timer.timeLeft / timer.duration;
      const offset = circumference * (1 - progressFraction);
      progressRing.style.strokeDashoffset = offset;
      
      // Update color based on mode
      progressRing.style.stroke = timer.type === 'focus' ? 'var(--accent)' : 'var(--accent-secondary)';
    }
  });
}
