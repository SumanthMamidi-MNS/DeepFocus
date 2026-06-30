/**
 * Deep Focus v2.0 - Zen Kanban / Task List UI Component
 */

import store from '../../state/store.js';
import { saveTask, deleteTask, getAllTasks } from '../../state/db.js';

export function initTodoUi() {
  const todoListContainer = document.getElementById('todo-list');
  const addTaskInput = document.getElementById('new-task-title');
  const addEstPomos = document.getElementById('new-task-pomos');
  const addTaskConfirmBtn = document.getElementById('add-task-btn');
  const activeTaskNameEl = document.getElementById('active-task-name');

  if (!todoListContainer || !addTaskConfirmBtn) {
    console.warn("Todo Board elements not found. Skipping initialization.");
    return;
  }

  // Load initial tasks from IndexedDB
  loadTasksFromDb();

  // Listen for task updates or logs to update task metrics
  window.addEventListener('session-logged', () => {
    // If a focus session was completed and we had an active task, increment its completed count
    const { activeTaskId, timer } = store.getState();
    if (activeTaskId && timer.type === 'focus') {
      getAllTasks().then((tasks) => {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          task.sessionsCount = (task.sessionsCount || 0) + 1;
          saveTask(task).then(() => loadTasksFromDb());
        }
      });
    }
  });

  // Bind Add Button
  addTaskConfirmBtn.addEventListener('click', () => {
    const title = addTaskInput.value.trim();
    if (!title) return;

    const estPomos = parseInt(addEstPomos.value) || 1;

    const task = {
      title,
      estPomodoros: estPomos,
      sessionsCount: 0,
      completed: false
    };

    saveTask(task)
      .then(() => {
        addTaskInput.value = '';
        addEstPomos.value = '1';
        loadTasksFromDb();
      })
      .catch(err => console.error(err));
  });

  // Bind Enter key in task input
  addTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTaskConfirmBtn.click();
    }
  });

  function loadTasksFromDb() {
    getAllTasks().then((tasks) => {
      // Sort: incomplete first, then by id
      tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.id - a.id;
      });

      store.setState('tasks', tasks);
      renderTasks(tasks);
    });
  }

  function renderTasks(tasks) {
    if (!todoListContainer) return;

    if (tasks.length === 0) {
      todoListContainer.innerHTML = '<div class="text-muted" style="padding: 16px; text-align: center;">Task board clear. Draft a focus goal above.</div>';
      return;
    }

    const { activeTaskId } = store.getState();
    todoListContainer.innerHTML = '';

    tasks.forEach((task) => {
      const card = document.createElement('div');
      card.className = `sound-card ${task.completed ? 'opacity-50' : ''} ${activeTaskId === task.id ? 'active' : ''}`;
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.padding = '12px 16px';
      card.style.marginBottom = '8px';
      card.style.borderStyle = activeTaskId === task.id ? 'solid' : 'dashed';

      // Assemble pomodoro indicators (e.g. 🍅 / 🔴 pills)
      let pomoPills = '';
      const totalCount = Math.max(task.estPomodoros, task.sessionsCount);
      for (let i = 0; i < totalCount; i++) {
        if (i < task.sessionsCount) {
          // Completed pomodoro blocks
          pomoPills += '<span style="color: var(--accent); font-size: 0.8rem; margin-right: 2px;">●</span>';
        } else {
          // Estimated remaining
          pomoPills += '<span style="color: var(--border-glass-highlight); font-size: 0.8rem; margin-right: 2px;">○</span>';
        }
      }

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex-grow: 1; cursor: pointer;" class="task-select-trigger">
          <input type="checkbox" class="task-checkbox" id="check-${task.id}" ${task.completed ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
          <div style="display: flex; flex-direction: column;">
            <span class="task-title" style="font-weight: 500; font-size: 0.9rem; text-decoration: ${task.completed ? 'line-through' : 'none'}; color: ${task.completed ? 'var(--text-secondary)' : 'var(--text-primary)'}">${escapeHtml(task.title)}</span>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
              <span class="text-muted" style="font-size: 0.75rem;">${task.sessionsCount}/${task.estPomodoros} blocks</span>
              <div style="display: flex;">${pomoPills}</div>
            </div>
          </div>
        </div>
        <button class="task-delete-btn" data-id="${task.id}" style="color: var(--text-secondary); cursor: pointer; font-size: 1.1rem; padding: 4px; line-height: 1;">&times;</button>
      `;

      // Bind selection click
      const selectTrigger = card.querySelector('.task-select-trigger');
      selectTrigger.addEventListener('click', (e) => {
        // Prevent trigger if clicking directly on checkbox input
        if (e.target.classList.contains('task-checkbox')) return;
        
        if (task.completed) return; // Cannot select completed tasks
        
        // Toggle active task
        const currentActive = store.getState().activeTaskId;
        const nextActive = currentActive === task.id ? null : task.id;
        store.setState('activeTaskId', nextActive);
      });

      // Bind checkbox completion toggle
      const checkbox = card.querySelector(`.task-checkbox`);
      checkbox.addEventListener('change', (e) => {
        const nextCompleted = e.target.checked;
        task.completed = nextCompleted;
        
        // If completing, make sure it is deselected as active
        if (nextCompleted && activeTaskId === task.id) {
          store.setState('activeTaskId', null);
        }

        saveTask(task)
          .then(() => loadTasksFromDb())
          .catch(err => console.error(err));
      });

      // Bind delete button
      const delBtn = card.querySelector('.task-delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = parseInt(e.target.dataset.id);
        if (activeTaskId === taskId) {
          store.setState('activeTaskId', null);
        }
        deleteTask(taskId)
          .then(() => loadTasksFromDb())
          .catch(err => console.error(err));
      });

      todoListContainer.appendChild(card);
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

  // Subscribe to store updates to keep task names aligned with the top banner
  store.subscribe((state) => {
    const { activeTaskId, tasks } = state;
    const activeTask = tasks.find(t => t.id === activeTaskId);

    if (activeTaskNameEl) {
      if (activeTask) {
        activeTaskNameEl.innerHTML = `
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); font-weight: 600; display: block;">Focusing On</span>
          <span style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(activeTask.title)}</span>
        `;
        activeTaskNameEl.style.display = 'block';
      } else {
        activeTaskNameEl.style.display = 'none';
      }
    }

    // Adjust borders of rendered list dynamically if active selection changes elsewhere
    const cards = todoListContainer.querySelectorAll('.sound-card');
    cards.forEach((card) => {
      const check = card.querySelector('.task-checkbox');
      if (check) {
        const id = parseInt(check.id.split('-')[1]);
        if (id === activeTaskId) {
          card.classList.add('active');
          card.style.borderStyle = 'solid';
        } else {
          card.classList.remove('active');
          card.style.borderStyle = 'dashed';
        }
      }
    });
  });
}
