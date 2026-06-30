/**
 * Deep Focus v2.0 - Journal and Mood UI Component
 */

import store from '../../state/store.js';
import { addJournalEntry, getAllJournalEntries, deleteJournalEntry } from '../../state/db.js';

export function initJournalUi() {
  const moodButtons = document.querySelectorAll('.mood-btn');
  const journalTextarea = document.getElementById('journal-note');
  const saveJournalBtn = document.getElementById('save-journal-btn');
  const journalHistoryList = document.getElementById('journal-history-list');

  // 1. Bind Mood Selectors
  moodButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Find closest button parent if clicking directly on emoji text
      const targetBtn = e.target.classList.contains('mood-btn') ? e.target : e.target.closest('.mood-btn');
      const moodValue = targetBtn.dataset.mood;
      
      // Update store state
      store.setState('currentMood', moodValue);
    });
  });

  // 2. Save Log Entry
  saveJournalBtn.addEventListener('click', () => {
    const noteText = journalTextarea.value.trim();
    const { currentMood } = store.getState();

    if (!currentMood && !noteText) {
      alert("Please select a mood or write a note to log your entry.");
      return;
    }

    const entry = {
      mood: currentMood || 'calm',
      note: noteText || 'Self-reflection log.'
    };

    addJournalEntry(entry)
      .then(() => {
        journalTextarea.value = '';
        store.setState('currentMood', null); // Reset active mood choice
        loadJournalHistory();
        
        // Dispatch smart recommendation update
        window.dispatchEvent(new CustomEvent('session-logged'));
      })
      .catch((err) => console.error(err));
  });

  // Load history from DB initially
  loadJournalHistory();

  function loadJournalHistory() {
    getAllJournalEntries().then((entries) => {
      // Sort newest first
      entries.sort((a, b) => b.date - a.date);
      
      // Set to store (limit to 5 for recent panel view, but we display all in history)
      store.setState('recentJournals', entries.slice(0, 8));
      
      renderJournalList(entries);
    });
  }

  function renderJournalList(entries) {
    if (!journalHistoryList) return;
    
    if (entries.length === 0) {
      journalHistoryList.innerHTML = '<div class="text-muted" style="padding: 12px; text-align: center;">No journal logs yet. Save one above.</div>';
      return;
    }

    const moodEmojiMap = {
      focused: '🧠 Focused',
      calm: '😌 Calm',
      distracted: '🥱 Distracted',
      tired: '😵 Tired',
      energized: '🤩 Energized'
    };

    journalHistoryList.innerHTML = '';
    entries.forEach((entry) => {
      const dateStr = new Date(entry.date).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const item = document.createElement('div');
      item.className = 'journal-item';
      item.innerHTML = `
        <div class="journal-item-header">
          <span class="font-semibold text-xs" style="color: var(--accent);">${moodEmojiMap[entry.mood] || '😌 Calm'}</span>
          <span class="text-muted" style="font-size: 0.7rem;">${dateStr}</span>
        </div>
        <p style="margin-top: 4px; line-height: 1.4;">${escapeHtml(entry.note)}</p>
        <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
          <button class="delete-journal-btn" data-id="${entry.id}" style="font-size: 0.7rem; color: var(--text-secondary); opacity: 0.6; cursor: pointer;">
            Delete Log
          </button>
        </div>
      `;

      // Bind delete button
      const delBtn = item.querySelector('.delete-journal-btn');
      delBtn.addEventListener('click', (e) => {
        if (confirm("Delete this journal entry?")) {
          const entryId = parseInt(e.target.dataset.id);
          deleteJournalEntry(entryId)
            .then(() => loadJournalHistory())
            .catch(err => console.error(err));
        }
      });

      journalHistoryList.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // 3. Subscribe to store to sync active mood selection highlights
  store.subscribe((state) => {
    const { currentMood } = state;

    moodButtons.forEach((btn) => {
      if (btn.dataset.mood === currentMood) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  });

  // Re-fetch on completed session event logs
  window.addEventListener('session-logged', () => {
    loadJournalHistory();
  });
}
