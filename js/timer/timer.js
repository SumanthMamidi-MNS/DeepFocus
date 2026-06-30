/**
 * Deep Focus v2.0 - Precision Timer Engine
 */

import store from '../state/store.js';
import { addSession, saveTask } from '../state/db.js';
import { fadeMasterVolume, playCompletionChime } from '../audio/synth.js';

let worker = null;
let animationFrameId = null;
let endTime = null; // Timestamp (ms) when session will end

// Worker code to bypass background throttling
const workerCode = `
  let timerId = null;
  self.onmessage = function(e) {
    if (e.data.action === 'start') {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        self.postMessage('tick');
      }, 500); // Higher resolution to ensure background ticks
    } else if (e.data.action === 'stop') {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }
  };
`;

function getWorker() {
  if (!worker) {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.onmessage = () => {
      tick();
    };
  }
  return worker;
}

export function startTimer() {
  const { timer, audio } = store.getState();
  if (timer.isRunning) return;

  // Fade master volume back to setting level smoothly on start/resume
  fadeMasterVolume(audio.masterVolume, 1.5);

  // Calculate target end time based on remaining seconds
  endTime = Date.now() + timer.timeLeft * 1000;

  store.setState('timer.isRunning', true);

  // Start background worker
  try {
    getWorker().postMessage({ action: 'start' });
  } catch (err) {
    console.warn('Could not launch web worker, falling back to main-thread timers:', err);
  }

  // Start animation loop for high-res layout updates
  runAnimationLoop();
}

export function pauseTimer() {
  const { timer } = store.getState();
  if (!timer.isRunning) return;

  // Cancel loops
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (worker) {
    worker.postMessage({ action: 'stop' });
  }

  // Calculate exact time left
  const timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  store.setState('timer.timeLeft', timeLeft);
  store.setState('timer.isRunning', false);
  
  // Restore tab title
  document.title = 'Deep Focus — Ambient Studio';
}

export function resetTimer() {
  pauseTimer();
  const { timer } = store.getState();
  const defaultSeconds = timer.type === 'focus' ? 25 * 60 : 5 * 60;
  store.setState('timer.timeLeft', defaultSeconds);
  store.setState('timer.duration', defaultSeconds);
  document.title = 'Deep Focus — Ambient Studio';
}

export function adjustTime(deltaSeconds) {
  const { timer } = store.getState();
  let newTime = timer.timeLeft + deltaSeconds;
  if (newTime < 60) newTime = 60; // minimum 1 min
  if (newTime > 180 * 60) newTime = 180 * 60; // max 3 hours

  // Calculate actual delta applied to prevent duration desync when clamped
  const actualDelta = newTime - timer.timeLeft;

  store.setState('timer.timeLeft', newTime);
  store.setState('timer.duration', timer.isRunning ? timer.duration + actualDelta : newTime);
  
  if (timer.isRunning) {
    endTime = Date.now() + newTime * 1000;
  }
}

export function fitToNextHour() {
  const defaultSeconds = 60 * 60; // Exactly 60 minutes
  pauseTimer();
  store.setState('timer.timeLeft', defaultSeconds);
  store.setState('timer.duration', defaultSeconds);
  startTimer();
}

export function skipSession() {
  const { timer } = store.getState();
  const wasFocus = timer.type === 'focus';
  const completedFraction = (timer.duration - timer.timeLeft) / timer.duration;
  
  pauseTimer();

  // If focus session and ran for at least 1 minute, log it in history as "Done Early"
  if (wasFocus && (timer.duration - timer.timeLeft) >= 60) {
    const elapsedMinutes = Math.floor((timer.duration - timer.timeLeft) / 60);
    const sessionData = {
      duration: elapsedMinutes,
      type: 'focus',
      completed: false, // marked incomplete because it was skipped early
      note: 'Session ended early.'
    };
    addSession(sessionData).catch(err => console.error(err));
  }

  // Switch session type
  toggleSessionType();
}

function runAnimationLoop() {
  const loop = () => {
    tick();
    const { timer } = store.getState();
    if (timer.isRunning) {
      animationFrameId = requestAnimationFrame(loop);
    }
  };
  animationFrameId = requestAnimationFrame(loop);
}

function tick() {
  if (!endTime) return;

  const { timer } = store.getState();
  if (!timer.isRunning) return;

  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    handleSessionComplete();
  } else {
    const timeLeft = Math.ceil(diff / 1000);
    if (timeLeft !== timer.timeLeft) {
      store.setState('timer.timeLeft', timeLeft);
      
      // Dynamic browser tab title
      const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const secs = (timeLeft % 60).toString().padStart(2, '0');
      const typeLabel = timer.type === 'focus' ? 'Focus' : 'Break';
      document.title = `(${mins}:${secs}) ${typeLabel} | Deep Focus`;
    }
  }
}

function handleSessionComplete() {
  const { timer, settings } = store.getState();
  
  // Pause loops
  pauseTimer();
  store.setState('timer.timeLeft', 0);

  // Play a chime/gong and fade out master volume over 5 seconds
  const chimeType = settings.selectedChime || 'tibetan-bowl';
  fadeMasterVolume(0, 5.0);
  playCompletionChime(chimeType);

  // Trigger system notification
  triggerCompletionNotification();

  // If focus completes, increment task session count
  if (timer.type === 'focus') {
    const state = store.getState();
    const activeTaskId = state.activeTaskId;
    if (activeTaskId) {
      const taskIndex = state.tasks.findIndex(t => t.id === activeTaskId);
      if (taskIndex !== -1) {
        const updatedTask = { ...state.tasks[taskIndex] };
        updatedTask.sessionsCount = (updatedTask.sessionsCount || 0) + 1;
        
        const nextTasks = [...state.tasks];
        nextTasks[taskIndex] = updatedTask;
        store.setState('tasks', nextTasks);
        
        saveTask(updatedTask).catch(err => console.error("Error auto-updating task pomodoro count:", err));
      }
    }
  }

  // Add to DB history
  const sessionData = {
    duration: Math.round(timer.duration / 60),
    type: timer.type,
    completed: true,
    note: timer.type === 'focus' ? 'Focus session completed successfully.' : 'Break completed.'
  };

  addSession(sessionData)
    .then(() => {
      // Reload stats / update streaks
      window.dispatchEvent(new CustomEvent('session-logged'));
    })
    .catch((err) => console.error('Error logging completed session:', err));

  // Dispatch custom completion event for UI view modal triggers
  window.dispatchEvent(new CustomEvent('session-completed', {
    detail: {
      duration: Math.round(timer.duration / 60),
      type: timer.type
    }
  }));

  // Auto-switch modes
  toggleSessionType();

  // Auto-resume if option is checked
  if (settings.autoResume) {
    setTimeout(() => {
      startTimer();
    }, 1000);
  }
}

function toggleSessionType() {
  const { timer } = store.getState();
  const nextType = timer.type === 'focus' ? 'break' : 'focus';
  
  let nextCycleCount = timer.cycleCount;
  let nextPomoCycles = timer.pomoCycles || 0;
  
  if (timer.type === 'focus') {
    nextCycleCount += 1;
    nextPomoCycles = (nextPomoCycles + 1) % 4;
  }

  let nextDuration = 25 * 60; // default focus
  if (nextType === 'break') {
    // Every 4th focus triggers long break (15 min)
    nextDuration = (nextPomoCycles === 0 && nextCycleCount > 0) ? 15 * 60 : 5 * 60;
  }

  store.setState('timer.type', nextType);
  store.setState('timer.timeLeft', nextDuration);
  store.setState('timer.duration', nextDuration);
  store.setState('timer.cycleCount', nextCycleCount);
  store.setState('timer.pomoCycles', nextPomoCycles);
}

function triggerCompletionNotification() {
  const { timer, settings } = store.getState();
  
  // System notification
  if (settings.notificationEnabled && Notification.permission === 'granted') {
    const title = timer.type === 'focus' ? 'Focus Session Completed!' : 'Break Over!';
    const body = timer.type === 'focus' ? 'Time for a well-deserved break.' : 'Ready to start focusing?';
    
    new Notification(title, {
      body,
      tag: 'deep-focus-notification',
      requireInteraction: false
    });
  }
}

// Synchronize timer if browser goes out of focus and returns
document.addEventListener('visibilitychange', () => {
  const { timer } = store.getState();
  if (timer.isRunning && endTime) {
    const now = Date.now();
    const diff = endTime - now;
    if (diff <= 0) {
      handleSessionComplete();
    } else {
      store.setState('timer.timeLeft', Math.ceil(diff / 1000));
    }
  }
});
