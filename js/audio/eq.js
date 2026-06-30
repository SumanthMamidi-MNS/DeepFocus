/**
 * Deep Focus v2.0 - Equalizer Utility Module
 */

import store from '../state/store.js';

export const EQ_PRESETS = {
  flat: {
    name: "Flat",
    gains: [0, 0, 0, 0, 0]
  },
  acoustic: {
    name: "Acoustic",
    gains: [2.5, 1.0, 0.0, 1.5, 2.0]
  },
  electronic: {
    name: "Electronic",
    gains: [4.5, 2.0, -1.0, 1.5, 3.5]
  },
  deepFocus: {
    name: "Deep Focus",
    gains: [1.5, 0.0, -2.5, 0.0, 1.0]
  },
  vocalBoost: {
    name: "Vocal Boost",
    gains: [-2.0, -1.0, 3.5, 2.0, 0.5]
  },
  tinnitusRelief: {
    name: "Tinnitus Relief",
    gains: [3.0, 1.5, -2.0, -4.0, -6.0]
  }
};

export function applyEqPreset(presetKey) {
  const preset = EQ_PRESETS[presetKey];
  if (preset) {
    store.setState('audio.eq', [...preset.gains]);
  }
}

export function resetEqualizer() {
  applyEqPreset('flat');
}
