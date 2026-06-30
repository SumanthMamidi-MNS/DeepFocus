/**
 * Deep Focus v2.0 - Theme Creator UI Component
 */

import store from '../../state/store.js';
import { saveUserTheme, deleteUserTheme, getUserThemes } from '../../state/db.js';

export function initThemeCreatorUi() {
  const themeSelector = document.getElementById('theme-select');
  const openCreatorBtn = document.getElementById('open-theme-creator-btn');
  const closeCreatorBtn = document.getElementById('close-theme-creator-btn');
  const themeCreatorModal = document.getElementById('modal-theme-creator');

  if (!openCreatorBtn || !closeCreatorBtn || !themeCreatorModal) {
    console.warn("Theme Creator controls not found. Skipping UI initialization.");
    return;
  }

  // Color inputs
  const themeNameInput = document.getElementById('new-theme-name');
  const colorBg = document.getElementById('color-bg');
  const colorGradStart = document.getElementById('color-grad-start');
  const colorGradEnd = document.getElementById('color-grad-end');
  const colorGlow1 = document.getElementById('color-glow-1');
  const colorGlow2 = document.getElementById('color-glow-2');
  const colorAccent = document.getElementById('color-accent');
  const colorAccentSec = document.getElementById('color-accent-sec');

  const saveThemeBtn = document.getElementById('save-theme-confirm');
  const customThemesListContainer = document.getElementById('custom-themes-list');

  // Load custom themes from DB on startup
  loadCustomThemes();

  // Modal toggle
  openCreatorBtn.addEventListener('click', () => {
    themeCreatorModal.classList.add('open');
  });

  closeCreatorBtn.addEventListener('click', () => {
    themeCreatorModal.classList.remove('open');
  });

  // Save custom theme logic
  saveThemeBtn.addEventListener('click', () => {
    const name = themeNameInput.value.trim();
    if (!name) {
      alert("Please enter a name for your custom theme.");
      return;
    }

    const themeKey = `custom-${name.toLowerCase().replace(/\s+/g, '-')}`;

    // Format custom theme token object
    const customTheme = {
      name: name,
      key: themeKey,
      colors: {
        bg: colorBg.value,
        gradStart: colorGradStart.value,
        gradEnd: colorGradEnd.value,
        glow1: hexToRgba(colorGlow1.value, 0.15),
        glow2: hexToRgba(colorGlow2.value, 0.12),
        accent: colorAccent.value,
        accentRgb: hexToRgb(colorAccent.value),
        accentSec: colorAccentSec.value,
        accentHover: darkenColor(colorAccent.value, 15),
        accentAlpha10: hexToRgba(colorAccent.value, 0.1),
        accentAlpha20: hexToRgba(colorAccent.value, 0.2),
        accentAlpha30: hexToRgba(colorAccent.value, 0.3),
        bgGlass: hexToRgba(colorBg.value, 0.65),
        borderGlass: hexToRgba('#ffffff', 0.05),
        borderGlassHighlight: hexToRgba('#ffffff', 0.1),
        bgHeader: hexToRgba(colorBg.value, 0.7),
        cardActive: hexToRgba(colorAccent.value, 0.08)
      }
    };

    saveUserTheme(customTheme)
      .then(() => {
        themeNameInput.value = '';
        themeCreatorModal.classList.remove('open');
        return loadCustomThemes();
      })
      .then(() => {
        // Automatically select the newly created theme
        themeSelector.value = themeKey;
        applyDynamicTheme(customTheme);
        store.setState('settings.theme', themeKey);
      })
      .catch((err) => console.error(err));
  });

  function loadCustomThemes() {
    return getUserThemes().then((themes) => {
      store.setState('userThemes', themes);
      
      // Update theme selector dropdown options
      rebuildSelectorOptions(themes);
      
      // Render theme manager list inside modal
      renderThemeManagerList(themes);

      // Re-apply if active theme is custom
      const { settings } = store.getState();
      if (settings.theme.startsWith('custom-')) {
        const activeTheme = themes.find(t => t.key === settings.theme);
        if (activeTheme) {
          applyDynamicTheme(activeTheme);
        }
      }
    });
  }

  function rebuildSelectorOptions(customThemes) {
    // Preserve default choices
    themeSelector.innerHTML = `
      <option value="zen-dark">Zen Dark</option>
      <option value="nordic-frost">Nordic Frost</option>
      <option value="forest-moss">Forest Moss</option>
      <option value="solarized-amber">Solarized Amber</option>
      <option value="sunset-ember">Sunset Ember</option>
      <option value="sakura-dawn">Sakura Dawn</option>
    `;

    // Inject custom user themes
    customThemes.forEach((theme) => {
      const opt = document.createElement('option');
      opt.value = theme.key;
      opt.textContent = `Custom: ${theme.name}`;
      themeSelector.appendChild(opt);
    });

    // Re-sync active value
    const { settings } = store.getState();
    themeSelector.value = settings.theme;
  }

  function renderThemeManagerList(themes) {
    if (!customThemesListContainer) return;
    customThemesListContainer.innerHTML = '';

    if (themes.length === 0) {
      customThemesListContainer.innerHTML = '<div class="text-muted" style="font-size: 0.8rem; padding: 4px 0;">No custom themes created yet.</div>';
      return;
    }

    themes.forEach((theme) => {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      row.innerHTML = `
        <div class="flex-row">
          <div style="width: 14px; height: 14px; border-radius: 50%; background: ${theme.colors.accent}; border: 1px solid var(--border-glass-highlight);"></div>
          <span style="font-size: 0.85rem;">${theme.name}</span>
        </div>
        <button class="theme-del-btn btn-secondary" data-key="${theme.key}" style="padding: 2px 6px; font-size: 0.75rem;">Delete</button>
      `;

      const delBtn = row.querySelector('.theme-del-btn');
      delBtn.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        if (confirm("Delete this theme?")) {
          deleteUserTheme(theme.name)
            .then(() => loadCustomThemes())
            .then(() => {
              // If deleted theme was active, revert to Zen Dark
              const { settings } = store.getState();
              if (settings.theme === key) {
                store.setState('settings.theme', 'zen-dark');
                document.documentElement.setAttribute('data-theme', 'zen-dark');
                themeSelector.value = 'zen-dark';
              }
            })
            .catch(err => console.error(err));
        }
      });

      customThemesListContainer.appendChild(row);
    });
  }

  // Inject CSS properties dynamically for Custom Themes
  function applyDynamicTheme(theme) {
    const root = document.documentElement;
    const c = theme.colors;
    
    // Override stylesheet variables dynamically on the HTML node
    root.style.setProperty('--bg-app', c.bg);
    root.style.setProperty('--bg-gradient', `linear-gradient(135deg, ${c.bg} 0%, ${c.gradEnd} 100%)`);
    root.style.setProperty('--glow-1', c.glow1);
    root.style.setProperty('--glow-2', c.glow2);
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--accent-rgb', c.accentRgb);
    root.style.setProperty('--accent-secondary', c.accentSec);
    root.style.setProperty('--accent-hover', c.accentHover);
    root.style.setProperty('--accent-alpha-10', c.accentAlpha10);
    root.style.setProperty('--accent-alpha-20', c.accentAlpha20);
    root.style.setProperty('--accent-alpha-30', c.accentAlpha30);
    root.style.setProperty('--bg-glass', c.bgGlass);
    root.style.setProperty('--border-glass', c.borderGlass);
    root.style.setProperty('--border-glass-highlight', c.borderGlassHighlight);
    root.style.setProperty('--bg-header-glass', c.bgHeader);
    root.style.setProperty('--card-bg-active', c.cardActive);
    root.style.setProperty('--pulse-glow', c.accentAlpha30);
    root.style.setProperty('--btn-primary-text', '#ffffff');
  }

  // Listen to general theme selections (to apply dynamic custom overrides or clear them)
  themeSelector.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected.startsWith('custom-')) {
      const themes = store.getState().userThemes;
      const theme = themes.find(t => t.key === selected);
      if (theme) {
        applyDynamicTheme(theme);
      }
    } else {
      // Revert style property overrides to fall back to CSS stylesheet definitions
      const root = document.documentElement;
      const styleVars = [
        'bg-app', 'bg-gradient', 'glow-1', 'glow-2', 'accent', 'accent-rgb',
        'accent-secondary', 'accent-hover', 'accent-alpha-10', 'accent-alpha-20',
        'accent-alpha-30', 'bg-glass', 'border-glass', 'border-glass-highlight',
        'bg-header-glass', 'card-bg-active', 'pulse-glow', 'btn-primary-text'
      ];
      styleVars.forEach(v => root.style.removeProperty(`--${v}`));
      root.setAttribute('data-theme', selected);
    }
  });

  // Re-apply custom theme properties on load if needed
  const { settings } = store.getState();
  if (settings.theme.startsWith('custom-')) {
    getUserThemes().then((themes) => {
      const theme = themes.find(t => t.key === settings.theme);
      if (theme) {
        applyDynamicTheme(theme);
      }
    });
  }

  // Hex helpers
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function darkenColor(hex, percent) {
    let num = parseInt(hex.replace("#",""),16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) - amt,
    G = (num >> 8 & 0x00FF) - amt,
    B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
  }
}
