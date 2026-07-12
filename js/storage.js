// localStorage persistence for config, presets and app settings.

const KEYS = {
  config: 'intervals.config',
  presets: 'intervals.presets',
  settings: 'intervals.settings',
  lastPreset: 'intervals.lastPreset',
};

export const DEFAULT_CONFIG = {
  countdown: 3,
  work: 10,
  rest: 5,
  rounds: 8,
  sets: 1,
  setRest: 60,
};

export const BUILTIN_PRESETS = {
  'Tabata': { countdown: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 },
  'HIIT 30/15': { countdown: 10, work: 30, rest: 15, rounds: 10, sets: 1, setRest: 60 },
  'Boxing 3min': { countdown: 10, work: 180, rest: 60, rounds: 5, sets: 1, setRest: 60 },
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — non-fatal
  }
}

export function loadConfig() {
  return { ...DEFAULT_CONFIG, ...read(KEYS.config, {}) };
}

export function saveConfig(cfg) {
  write(KEYS.config, cfg);
}

/** User presets only; built-ins are merged in by getAllPresets(). */
export function loadUserPresets() {
  return read(KEYS.presets, {});
}

export function getAllPresets() {
  return { ...BUILTIN_PRESETS, ...loadUserPresets() };
}

export function savePreset(name, cfg) {
  const presets = loadUserPresets();
  presets[name] = { ...cfg };
  write(KEYS.presets, presets);
}

export function deletePreset(name) {
  const presets = loadUserPresets();
  delete presets[name];
  write(KEYS.presets, presets);
}

export function isBuiltinPreset(name) {
  return name in BUILTIN_PRESETS && !(name in loadUserPresets());
}

/** Name of the preset selected when the app was last used ('' = custom). */
export function loadLastPreset() {
  return read(KEYS.lastPreset, '');
}

export function saveLastPreset(name) {
  write(KEYS.lastPreset, name);
}

export function loadSettings() {
  return { muted: false, vibration: true, volume: 0.7, ticks: true, ...read(KEYS.settings, {}) };
}

export function saveSettings(settings) {
  write(KEYS.settings, settings);
}
