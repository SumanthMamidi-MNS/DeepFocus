/**
 * Deep Focus v2.0 - Sound Studio UI Component
 */

import store from '../../state/store.js';
import { saveCustomPreset, applyPreset, removePreset, loadPresetsList, exportPresetJson, importPresetJson } from '../../audio/studio.js';
import { applyEqPreset } from '../../audio/eq.js';

// Sound Metadata with beautiful premium SVGs
const SOUNDS_METADATA = [
  {
    id: 'musicPad',
    name: 'Zen Melody',
    svg: '<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>'
  },
  {
    id: 'rain',
    name: 'Zen Rain',
    svg: '<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zm-8 4h2v-2h-2v2zm-4-1h2v-2H7v2zm8 0h2v-2h-2v2z"/>'
  },
  {
    id: 'wind',
    name: 'Forest Wind',
    svg: '<path d="M20.14 5c-.32 0-.64.14-.86.38L14 11H3v2h11.24l5.04 5.62c.22.24.54.38.86.38.66 0 1.2-.54 1.2-1.2V6.2c0-.66-.54-1.2-1.2-1.2zM21 16.3l-3.86-4.3 3.86-4.3v8.6zM6 8.5C6 7.67 6.67 7 7.5 7h4V5h-4C5.57 5 4 6.57 4 8.5S5.57 12 7.5 12h4v-2h-4C6.67 10 6 9.33 6 8.5z"/>'
  },
  {
    id: 'fire',
    name: 'Fire Hearth',
    svg: '<path d="M19.48 12.35c-1.57-4.08-7.16-6.7-5.81-10.23-.1.04-.21.08-.31.13C10.54 3.69 8 7.19 8 10.5c0 3.21 2 5.5 4.5 7.5 2.24-2 3.5-4.75 3.5-7.5 0-1.63-.35-3-1.07-4.22 2.34 2.87 3.57 6.59 1.57 10.36 2.05-1.25 3.5-3.5 3.5-6.5 0-3.32-2-5.5-4.5-7.5-2.24 2-3.5 4.75-3.5 7.5 0 1.63.35 3 1.07 4.22-2.34-2.87-3.57-6.59-1.57-10.36zM13.5 22c3.04 0 5.5-2.46 5.5-5.5 0-1.66-.74-3.15-1.9-4.17C16.5 14.5 15.5 17 13.5 18s-4-1.5-4-4.5c-1.16 1.02-1.9 2.51-1.9 4.17 0 3.04 2.46 5.5 5.5 5.5z"/>'
  },
  {
    id: 'waves',
    name: 'Ocean Tide',
    svg: '<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>'
  },
  {
    id: 'whiteNoise',
    name: 'Static Veil',
    svg: '<path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM6 12h2v2H6zm0-4h2v2H6zm4 4h2v2h-2zm0-4h2v2h-2zm4 4h2v2h-2zm0-4h2v2h-2zm-4 8h2v2h-2zm-4 0h2v2H6zm8 0h2v2h-2z"/>'
  },
  {
    id: 'coffeeShop',
    name: 'Cafe Murmur',
    svg: '<path d="M4 19h16v2H4zM20 6h-2V5c0-1.65-1.35-3-3-3H9C7.35 2 6 3.35 6 5v1h11v5c0 2.76-2.24 5-5 5H9c-2.76 0-5-2.24-5-5V5H2v1c0 3.52 2.61 6.43 6 6.92V16h2v-2h4v2h2v-3.08c3.39-.49 6-3.4 6-6.92zM16 5v1H8V5c0-.55.45-1 1-1h6c.55 0 1 .45 1 1z"/>'
  },
  {
    id: 'keyboard',
    name: 'Mechanical Click',
    svg: '<path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-3 0h2v2H5v-2zm0-3h2v2H5V8zm11 8H8v-2h8v2zm0-5h2v2h-2v-2zm0-3h2v2h-2V8zm3 3h2v2h-2v-2zm0-3h2v2h-2V8z"/>'
  },
  {
    id: 'paper',
    name: 'Paper Rustle',
    svg: '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>'
  }
];

export function initStudioUi() {
  const soundGrid = document.getElementById('studio-sound-grid');
  const presetPillsContainer = document.getElementById('preset-pills');
  const eqSlidersContainer = document.getElementById('eq-band-sliders');
  const masterVolumeSlider = document.getElementById('master-volume-slider');

  // Modal triggers
  const presetNameInput = document.getElementById('new-preset-name');
  const saveModalConfirmBtn = document.getElementById('save-preset-confirm');
  const importFileInput = document.getElementById('preset-import-file');
  const exportPresetBtn = document.getElementById('preset-export-btn');

  let activePresetsList = [];

  // 1. Build Sound Cards dynamically
  soundGrid.innerHTML = '';
  SOUNDS_METADATA.forEach((sound) => {
    const card = document.createElement('div');
    card.className = 'sound-card';
    card.id = `card-${sound.id}`;
    
    card.innerHTML = `
      <div class="sound-header">
        <div class="sound-title-wrapper">
          <svg class="sound-icon" viewBox="0 0 24 24">${sound.svg}</svg>
          <span class="sound-title">${sound.name}</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="switch-${sound.id}">
          <span class="slider-toggle"></span>
        </label>
      </div>
      <div class="sound-controls">
        <div class="control-row">
          <span class="control-label">Vol</span>
          <input type="range" class="slider-input" id="vol-${sound.id}" min="0" max="1" step="0.05" value="0.5">
        </div>
        <div class="control-row">
          <span class="control-label">Pan</span>
          <input type="range" class="slider-input" id="pan-${sound.id}" min="-1" max="1" step="0.1" value="0">
        </div>
        <div class="control-row">
          <span class="control-label">Pitch</span>
          <input type="range" class="slider-input" id="pitch-${sound.id}" min="0.5" max="1.5" step="0.05" value="1.0">
        </div>
        ${sound.id === 'keyboard' ? `
        <div class="control-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-glass);">
          <span class="control-label" style="min-width: 50px;">Switch</span>
          <select id="keyboard-switch-select" class="btn-secondary" style="font-size: 0.75rem; padding: 2px 6px; flex-grow: 1; border-radius: 4px; height: 24px; border: 1px solid var(--border-glass);">
            <option value="blue">Blue Clicky</option>
            <option value="brown">Brown Tactile</option>
            <option value="red">Red Linear</option>
            <option value="typewriter">Typewriter</option>
          </select>
        </div>
        ` : ''}
      </div>
    `;

    soundGrid.appendChild(card);

    // Bind event listeners
    const toggle = card.querySelector(`#switch-${sound.id}`);
    const volSlider = card.querySelector(`#vol-${sound.id}`);
    const panSlider = card.querySelector(`#pan-${sound.id}`);
    const pitchSlider = card.querySelector(`#pitch-${sound.id}`);

    toggle.addEventListener('change', (e) => {
      store.setState(`audio.layers.${sound.id}.active`, e.target.checked);
    });

    volSlider.addEventListener('input', (e) => {
      store.setState(`audio.layers.${sound.id}.volume`, parseFloat(e.target.value));
    });

    panSlider.addEventListener('input', (e) => {
      store.setState(`audio.layers.${sound.id}.pan`, parseFloat(e.target.value));
    });

    pitchSlider.addEventListener('input', (e) => {
      store.setState(`audio.layers.${sound.id}.pitch`, parseFloat(e.target.value));
    });
  });

  // Bind Keyboard switch profile select dropdown (G.O.A.T. feature)
  const kbSwitchSelect = document.getElementById('keyboard-switch-select');
  if (kbSwitchSelect) {
    kbSwitchSelect.addEventListener('change', (e) => {
      store.setState('audio.keyboardSwitch', e.target.value);
    });
  }

  // 2. Bind Binaural Beats controls (G.O.A.T. feature)
  const switchBinaural = document.getElementById('switch-binaural');
  const freqBinaural = document.getElementById('freq-binaural');
  const carrierBinaural = document.getElementById('carrier-binaural');
  const volBinaural = document.getElementById('vol-binaural');

  if (switchBinaural) {
    switchBinaural.addEventListener('change', (e) => {
      store.setState('audio.binaural.active', e.target.checked);
    });
  }
  if (freqBinaural) {
    freqBinaural.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('freq-val-binaural').textContent = `${val}Hz`;
      store.setState('audio.binaural.frequency', val);
    });
  }
  if (carrierBinaural) {
    carrierBinaural.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('carrier-val-binaural').textContent = `${val}Hz`;
      store.setState('audio.binaural.carrier', val);
    });
  }
  if (volBinaural) {
    volBinaural.addEventListener('input', (e) => {
      store.setState('audio.binaural.volume', parseFloat(e.target.value));
    });
  }

  // 3. Bind Solfeggio Tones controls (G.O.A.T. feature)
  const switchSolfeggio = document.getElementById('switch-solfeggio');
  const freqSolfeggio = document.getElementById('freq-solfeggio');
  const volSolfeggio = document.getElementById('vol-solfeggio');

  if (switchSolfeggio) {
    switchSolfeggio.addEventListener('change', (e) => {
      store.setState('audio.solfeggio.active', e.target.checked);
    });
  }
  if (freqSolfeggio) {
    freqSolfeggio.addEventListener('change', (e) => {
      store.setState('audio.solfeggio.frequency', parseInt(e.target.value));
    });
  }
  if (volSolfeggio) {
    volSolfeggio.addEventListener('input', (e) => {
      store.setState('audio.solfeggio.volume', parseFloat(e.target.value));
    });
  }

  // 4. Build Equalizer vertical sliders
  const eqLabels = ['Low', 'L-Mid', 'Mid', 'H-Mid', 'High'];
  eqSlidersContainer.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const band = document.createElement('div');
    band.className = 'eq-band';
    band.innerHTML = `
      <div class="eq-slider-container">
        <input type="range" class="eq-slider" id="eq-band-${i}" min="-12" max="12" step="0.5" value="0">
      </div>
      <span class="eq-value" id="eq-val-${i}">0dB</span>
      <span class="eq-label">${eqLabels[i]}</span>
    `;
    eqSlidersContainer.appendChild(band);

    const eqSlider = band.querySelector(`#eq-band-${i}`);
    const eqValText = band.querySelector(`#eq-val-${i}`);

    eqSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      eqValText.textContent = `${val > 0 ? '+' : ''}${val}dB`;
      
      const { audio } = store.getState();
      const nextEq = [...audio.eq];
      nextEq[i] = val;
      store.setState('audio.eq', nextEq);
    });
  }

  // Master Volume binding
  masterVolumeSlider.addEventListener('input', (e) => {
    store.setState('audio.masterVolume', parseFloat(e.target.value));
  });

  // Preset save logic
  saveModalConfirmBtn.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    if (!name) return;

    saveCustomPreset(name)
      .then(() => {
        presetNameInput.value = '';
        document.getElementById('modal-preset-save').classList.remove('open');
      })
      .catch((err) => console.error(err));
  });

  // Preset Export logic
  exportPresetBtn.addEventListener('click', () => {
    const { audio } = store.getState();
    if (audio.currentPreset) {
      exportPresetJson(audio.currentPreset, activePresetsList);
    } else {
      alert("Please load or save a preset first before exporting.");
    }
  });

  // Preset Import logic
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    importPresetJson(file)
      .then((importedPreset) => {
        applyPreset(importedPreset);
        alert(`Successfully imported preset: "${importedPreset.name}"`);
      })
      .catch(err => {
        alert("Failed to import preset: " + err.message);
      });
  });

  // Bind EQ preset options
  const eqPresetBtns = document.querySelectorAll('.eq-preset-btn');
  eqPresetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const presetKey = e.target.dataset.preset;
      applyEqPreset(presetKey);
    });
  });

  // Listen to presets-updated event to rebuild preset list
  window.addEventListener('presets-updated', (event) => {
    activePresetsList = event.detail;
    renderPresetsPills(activePresetsList);
  });

  // Initial load
  loadPresetsList();

  function renderPresetsPills(presets) {
    presetPillsContainer.innerHTML = '';
    const { audio } = store.getState();

    presets.forEach((preset) => {
      const isCustom = !['Zen Rain', 'Warm Cabin', 'Ocean Cove', 'Cafe Writer'].includes(preset.name);
      
      const pill = document.createElement('div');
      pill.className = `preset-pill ${audio.currentPreset === preset.name ? 'active' : ''}`;
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = preset.name;
      nameSpan.style.cursor = 'pointer';
      nameSpan.addEventListener('click', () => {
        applyPreset(preset);
      });
      pill.appendChild(nameSpan);

      if (isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'preset-delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.setAttribute('title', 'Delete Preset');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete preset "${preset.name}"?`)) {
            removePreset(preset.name);
          }
        });
        pill.appendChild(delBtn);
      }

      presetPillsContainer.appendChild(pill);
    });
  }

  // 5. Subscribe to store updates to keep sliders matched
  store.subscribe((state) => {
    const { audio } = state;

    // Sync master volume
    if (masterVolumeSlider) {
      masterVolumeSlider.value = audio.masterVolume;
    }

    // Sync sound cards switches and sliders
    Object.keys(audio.layers).forEach((key) => {
      const card = document.getElementById(`card-${key}`);
      if (!card) return;

      const layer = audio.layers[key];
      const toggle = card.querySelector(`#switch-${key}`);
      const volSlider = card.querySelector(`#vol-${key}`);
      const panSlider = card.querySelector(`#pan-${key}`);
      const pitchSlider = card.querySelector(`#pitch-${key}`);

      if (toggle && toggle.checked !== layer.active) {
        toggle.checked = layer.active;
      }
      
      if (layer.active) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }

      if (volSlider && parseFloat(volSlider.value) !== layer.volume) {
        volSlider.value = layer.volume;
      }
      if (panSlider && parseFloat(panSlider.value) !== layer.pan) {
        panSlider.value = layer.pan;
      }
      if (pitchSlider && parseFloat(pitchSlider.value) !== layer.pitch) {
        pitchSlider.value = layer.pitch;
      }
    });

    // Sync G.O.A.T. Switch Dropdown select
    const activeKbSelect = document.getElementById('keyboard-switch-select');
    if (activeKbSelect && activeKbSelect.value !== audio.keyboardSwitch) {
      activeKbSelect.value = audio.keyboardSwitch;
    }

    // Sync G.O.A.T. Binaural Beats inputs
    if (switchBinaural && switchBinaural.checked !== audio.binaural.active) {
      switchBinaural.checked = audio.binaural.active;
    }
    const binauralCard = document.getElementById('card-binaural');
    if (binauralCard) {
      if (audio.binaural.active) binauralCard.classList.add('active');
      else binauralCard.classList.remove('active');
    }
    if (freqBinaural) {
      freqBinaural.value = audio.binaural.frequency;
      document.getElementById('freq-val-binaural').textContent = `${audio.binaural.frequency}Hz`;
    }
    if (carrierBinaural) {
      carrierBinaural.value = audio.binaural.carrier;
      document.getElementById('carrier-val-binaural').textContent = `${audio.binaural.carrier}Hz`;
    }
    if (volBinaural) volBinaural.value = audio.binaural.volume;

    // Sync G.O.A.T. Solfeggio Tones inputs
    if (switchSolfeggio && switchSolfeggio.checked !== audio.solfeggio.active) {
      switchSolfeggio.checked = audio.solfeggio.active;
    }
    const solfeggioCard = document.getElementById('card-solfeggio');
    if (solfeggioCard) {
      if (audio.solfeggio.active) solfeggioCard.classList.add('active');
      else solfeggioCard.classList.remove('active');
    }
    if (freqSolfeggio) freqSolfeggio.value = audio.solfeggio.frequency;
    if (volSolfeggio) volSolfeggio.value = audio.solfeggio.volume;

    // Sync 5-Band EQ sliders
    audio.eq.forEach((gainDb, index) => {
      const eqSlider = document.getElementById(`eq-band-${index}`);
      const eqValText = document.getElementById(`eq-val-${index}`);
      if (eqSlider && parseFloat(eqSlider.value) !== gainDb) {
        eqSlider.value = gainDb;
      }
      if (eqValText) {
        eqValText.textContent = `${gainDb > 0 ? '+' : ''}${gainDb}dB`;
      }
    });

    // Re-highlight presets pills if preset changed
    const activePills = presetPillsContainer.querySelectorAll('.preset-pill');
    activePills.forEach((pill) => {
      const span = pill.querySelector('span');
      if (span && span.textContent === audio.currentPreset) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  });
}
