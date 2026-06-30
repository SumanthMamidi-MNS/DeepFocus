/**
 * Deep Focus v2.0 - Sound Studio Mixer and Presets Manager
 */

import store from '../state/store.js';
import synths, { updateMasterVolume, updateEqBand, getAudioContext, updateBinauralBeats, updateSolfeggio } from './synth.js';
import { savePreset, deletePreset, getPresets } from '../state/db.js';

// Sync current audio state with store updates
export function initializeAudioSync() {
  let initialBoot = true;
  let audioContextResumed = false;

  // Gesture listener to boot AudioContext and start active synths
  const initAudioOnGesture = () => {
    if (audioContextResumed) return;
    audioContextResumed = true;

    // Remove event listeners
    window.removeEventListener('click', initAudioOnGesture);
    window.removeEventListener('keydown', initAudioOnGesture);
    window.removeEventListener('touchstart', initAudioOnGesture);

    // Initialize/resume context
    try {
      getAudioContext();
      
      // Force sync all active layers since the context is now running
      syncSynths(store.getState());
    } catch (err) {
      console.warn('AudioContext lazy-initialization failed:', err);
    }
  };

  window.addEventListener('click', initAudioOnGesture);
  window.addEventListener('keydown', initAudioOnGesture);
  window.addEventListener('touchstart', initAudioOnGesture);

  function syncSynths(state) {
    // 1. Update Master Volume
    updateMasterVolume(state.audio.masterVolume);

    // 2. Update 5-Band Equalizer
    state.audio.eq.forEach((gainDb, index) => {
      updateEqBand(index, gainDb);
    });

    // 3. Update individual procedural sound layers
    Object.keys(state.audio.layers).forEach((key) => {
      const layerState = state.audio.layers[key];
      const synthInstance = synths[key];

      if (!synthInstance) return;

      // Update basic parameters (always safe to call)
      synthInstance.setVolume(layerState.volume);
      synthInstance.setPan(layerState.pan);
      synthInstance.setPitch(layerState.pitch);

      // Handle start / stop triggers
      if (layerState.active) {
        if (!synthInstance.active && audioContextResumed) {
          try {
            synthInstance.start();
          } catch (err) {
            console.error(`Failed to start synth channel [${key}]:`, err);
          }
        }
      } else {
        if (synthInstance.active) {
          synthInstance.stop();
        }
      }
    });

    // 4. Update Binaural Beats
    const bin = state.audio.binaural;
    updateBinauralBeats(bin.active && audioContextResumed, bin.frequency, bin.carrier, bin.volume);

    // 5. Update Solfeggio Tones
    const sol = state.audio.solfeggio;
    updateSolfeggio(sol.active && audioContextResumed, sol.frequency, sol.volume);
  }

  store.subscribe((state) => {
    // During initial boot store setup, do NOT trigger any node creations (wait for user gesture)
    if (initialBoot) {
      initialBoot = false;
      return;
    }
    syncSynths(state);
  });
}

// Preset Action: Create custom preset
export function saveCustomPreset(presetName) {
  const { audio } = store.getState();
  
  // Format saving parameters
  const preset = {
    name: presetName,
    layers: {},
    eq: [...audio.eq]
  };

  Object.keys(audio.layers).forEach((key) => {
    const layer = audio.layers[key];
    preset.layers[key] = {
      active: layer.active,
      volume: layer.volume,
      pan: layer.pan,
      pitch: layer.pitch
    };
  });

  return savePreset(preset)
    .then(() => {
      // Reload preset lists
      return loadPresetsList();
    })
    .then(() => {
      store.setState('audio.currentPreset', presetName);
    });
}

// Preset Action: Apply preset
export function applyPreset(preset) {
  // If it's a built-in preset or a loaded IndexedDB preset
  const { audio } = store.getState();
  
  // Pause any audio node if it's not in the target preset
  Object.keys(audio.layers).forEach((key) => {
    const nextLayer = preset.layers[key] || { active: false, volume: 0.5, pan: 0.0, pitch: 1.0 };
    store.setState(`audio.layers.${key}.active`, nextLayer.active);
    store.setState(`audio.layers.${key}.volume`, nextLayer.volume);
    store.setState(`audio.layers.${key}.pan`, nextLayer.pan);
    store.setState(`audio.layers.${key}.pitch`, nextLayer.pitch);
  });

  // Apply EQ settings
  store.setState('audio.eq', [...preset.eq]);
  store.setState('audio.currentPreset', preset.name);
}

// Preset Action: Delete Preset
export function removePreset(name) {
  return deletePreset(name)
    .then(() => {
      return loadPresetsList();
    })
    .then(() => {
      const { audio } = store.getState();
      if (audio.currentPreset === name) {
        store.setState('audio.currentPreset', null);
      }
    });
}

// Load presets list from database and populate into store
export function loadPresetsList() {
  return getPresets().then((dbPresets) => {
    // Add default built-in presets
    const builtIn = getBuiltInPresets();
    const allPresets = [...builtIn, ...dbPresets];
    // Custom Event to notify UI of presets list change
    const event = new CustomEvent('presets-updated', { detail: allPresets });
    window.dispatchEvent(event);
    return allPresets;
  });
}

// JSON Preset Export
export function exportPresetJson(presetName, dbPresets = []) {
  const preset = dbPresets.find(p => p.name === presetName);
  if (!preset) return null;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `deepfocus_preset_${presetName.replace(/\s+/g, '_').toLowerCase()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// JSON Preset Import
export function importPresetJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const preset = JSON.parse(e.target.result);
        
        // Validation
        if (!preset.name || !preset.layers || !Array.isArray(preset.eq) || preset.eq.length !== 5) {
          throw new Error("Invalid preset JSON format");
        }

        savePreset(preset)
          .then(() => loadPresetsList())
          .then((presets) => resolve(preset))
          .catch(err => reject(err));
      } catch (err) {
        reject(new Error("Failed to parse JSON file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("File reading error"));
    reader.readAsText(file);
  });
}

// Built-in Focus Presets
export function getBuiltInPresets() {
  return [
    {
      name: "Zen Rain",
      layers: {
        musicPad: { active: true, volume: 0.5, pan: 0.0, pitch: 1.0 },
        rain: { active: true, volume: 0.6, pan: 0.0, pitch: 1.0 },
        wind: { active: false, volume: 0.4, pan: -0.3, pitch: 1.0 },
        fire: { active: false, volume: 0.4, pan: 0.2, pitch: 1.0 },
        waves: { active: false, volume: 0.5, pan: 0.0, pitch: 0.8 },
        whiteNoise: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
        coffeeShop: { active: false, volume: 0.4, pan: -0.2, pitch: 1.0 },
        keyboard: { active: false, volume: 0.4, pan: 0.1, pitch: 1.0 },
        paper: { active: false, volume: 0.4, pan: 0.3, pitch: 1.0 }
      },
      eq: [2, 0, -1, 0, 1]
    },
    {
      name: "Warm Cabin",
      layers: {
        musicPad: { active: true, volume: 0.4, pan: -0.1, pitch: 0.9 },
        rain: { active: true, volume: 0.35, pan: -0.2, pitch: 0.95 },
        wind: { active: true, volume: 0.25, pan: 0.3, pitch: 1.0 },
        fire: { active: true, volume: 0.6, pan: 0.1, pitch: 1.0 },
        waves: { active: false, volume: 0.5, pan: 0.0, pitch: 0.8 },
        whiteNoise: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
        coffeeShop: { active: false, volume: 0.4, pan: -0.2, pitch: 1.0 },
        keyboard: { active: false, volume: 0.4, pan: 0.1, pitch: 1.0 },
        paper: { active: false, volume: 0.4, pan: 0.3, pitch: 1.0 }
      },
      eq: [4, 1, 0, -2, -1]
    },
    {
      name: "Ocean Cove",
      layers: {
        musicPad: { active: true, volume: 0.45, pan: 0.1, pitch: 1.0 },
        rain: { active: false, volume: 0.5, pan: 0.0, pitch: 1.0 },
        wind: { active: true, volume: 0.3, pan: -0.4, pitch: 0.85 },
        fire: { active: false, volume: 0.4, pan: 0.2, pitch: 1.0 },
        waves: { active: true, volume: 0.65, pan: 0.0, pitch: 0.9 },
        whiteNoise: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
        coffeeShop: { active: false, volume: 0.4, pan: -0.2, pitch: 1.0 },
        keyboard: { active: false, volume: 0.4, pan: 0.1, pitch: 1.0 },
        paper: { active: false, volume: 0.4, pan: 0.3, pitch: 1.0 }
      },
      eq: [1, 2, 0, -1, 3]
    },
    {
      name: "Cafe Writer",
      layers: {
        musicPad: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
        rain: { active: false, volume: 0.5, pan: 0.0, pitch: 1.0 },
        wind: { active: false, volume: 0.4, pan: -0.3, pitch: 1.0 },
        fire: { active: false, volume: 0.4, pan: 0.2, pitch: 1.0 },
        waves: { active: false, volume: 0.5, pan: 0.0, pitch: 0.8 },
        whiteNoise: { active: false, volume: 0.3, pan: 0.0, pitch: 1.0 },
        coffeeShop: { active: true, volume: 0.5, pan: 0.0, pitch: 1.0 },
        keyboard: { active: true, volume: 0.45, pan: 0.2, pitch: 1.05 },
        paper: { active: true, volume: 0.3, pan: -0.3, pitch: 1.0 }
      },
      eq: [-3, -1, 3, 2, 1]
    }
  ];
}

// Document listener to intercept keydown events for mechanical sound typing response
document.addEventListener('keydown', (e) => {
  const { audio } = store.getState();
  // Only trigger click on keydown if Keyboard layer is active AND master volume is up
  if (audio.layers.keyboard.active && synths.keyboard.active && audio.masterVolume > 0) {
    // Prevent typing clicking during control shortcut strokes
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    
    // Slight randomized pitch for each key press to sound natural
    const pitchOffset = Math.random() * 0.12 - 0.06;
    synths.keyboard.setPitch(audio.layers.keyboard.pitch + pitchOffset);
    synths.keyboard.triggerSingleClick();
  }
});
