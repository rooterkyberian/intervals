import { PHASES, buildSchedule, totalDuration, IntervalTimer } from './timer.js';
import * as audio from './audio.js';
import * as storage from './storage.js';
import * as wakelock from './wakelock.js';

const $ = (sel) => document.querySelector(sel);

const FIELDS = [
  { key: 'countdown', min: 0, max: 999 },
  { key: 'work', min: 1, max: 5999 },
  { key: 'rest', min: 0, max: 5999 },
  { key: 'rounds', min: 1, max: 99 },
  { key: 'sets', min: 1, max: 99 },
  { key: 'setRest', min: 0, max: 5999 },
];

let config = storage.loadConfig();
let settings = storage.loadSettings();
let timer = null;

// ---------- helpers ----------

function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
}

function inputFor(key) {
  return $(`#cfg-${key}`);
}

// ---------- setup screen ----------

function renderConfig() {
  for (const f of FIELDS) inputFor(f.key).value = config[f.key];
  $('#total-time').textContent = fmtTime(Math.round(totalDuration(config)));
}

function readField(f) {
  const raw = parseInt(inputFor(f.key).value, 10);
  const val = Number.isFinite(raw) ? Math.min(f.max, Math.max(f.min, raw)) : storage.DEFAULT_CONFIG[f.key];
  return val;
}

function onFieldChange() {
  for (const f of FIELDS) config[f.key] = readField(f);
  storage.saveConfig(config);
  $('#preset-select').value = '';
  storage.saveLastPreset('');
  updatePresetButtons();
  renderConfig();
}

function renderPresets(selected = '') {
  const select = $('#preset-select');
  select.innerHTML = '';
  const custom = document.createElement('option');
  custom.value = '';
  custom.textContent = 'Custom';
  select.appendChild(custom);
  for (const name of Object.keys(storage.getAllPresets())) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  select.value = selected;
  updatePresetButtons();
}

function updatePresetButtons() {
  const name = $('#preset-select').value;
  $('#preset-delete').disabled = !name || storage.isBuiltinPreset(name);
}

function applyPreset(name) {
  const preset = storage.getAllPresets()[name];
  if (!preset) return;
  config = { ...storage.DEFAULT_CONFIG, ...preset };
  storage.saveConfig(config);
  storage.saveLastPreset(name);
  renderConfig();
  updatePresetButtons();
}

function savePreset() {
  const nameInput = $('#preset-name');
  const name = (nameInput.value.trim() || $('#preset-select').value).slice(0, 40);
  if (!name) {
    nameInput.focus();
    return;
  }
  storage.savePreset(name, config);
  storage.saveLastPreset(name);
  nameInput.value = '';
  renderPresets(name);
}

// ---------- timer screen ----------

const PHASE_SOUNDS = {
  work: audio.workStart,
  rest: audio.restStart,
  setrest: audio.restStart,
};

let schedule = [];
let lastTickKey = '';

function showScreen(id) {
  $('#setup').classList.toggle('hidden', id !== 'setup');
  $('#timer').classList.toggle('hidden', id !== 'timer');
}

function setPhaseClass(name) {
  $('#timer').className = `screen phase-${name}`;
}

function renderPhase(phase, index) {
  setPhaseClass(phase.type);
  $('#t-phase').textContent = PHASES[phase.type].label;
  $('#t-round').textContent = `Round ${phase.round}/${config.rounds}`;
  $('#t-set').textContent = config.sets > 1 ? `Set ${phase.set}/${config.sets}` : '';
  const next = schedule[index + 1];
  $('#t-next').textContent = next ? `Next: ${PHASES[next.type].label}` : 'Last one — finish strong!';
  PHASE_SOUNDS[phase.type]?.();
}

function renderTick({ phase, index, remainingMs, progress }) {
  const sec = Math.ceil(remainingMs / 1000);
  $('#t-time').textContent = fmtTime(sec);
  $('#t-progress-fill').style.transform = `scaleX(${1 - progress})`;
  // 3-2-1 lead-in ticks before every transition
  const key = `${index}:${sec}`;
  if (sec >= 1 && sec <= 3 && key !== lastTickKey && timer.state === 'running') {
    lastTickKey = key;
    if (settings.ticks) audio.tick();
  }
}

function renderFinished() {
  setPhaseClass('done');
  $('#t-phase').textContent = 'DONE';
  $('#t-time').textContent = '\u{1F389}';
  $('#t-next').textContent = 'Workout complete';
  $('#t-progress-fill').style.transform = 'scaleX(0)';
  $('#t-pause').classList.add('hidden');
  audio.finish();
  wakelock.release();
}

function startWorkout() {
  audio.unlock();
  wakelock.acquire();
  schedule = buildSchedule(config);
  if (schedule.length === 0) return;
  lastTickKey = '';
  $('#t-pause').classList.remove('hidden');
  $('#t-pause').textContent = 'Pause';
  timer = new IntervalTimer(schedule, {
    onPhase: renderPhase,
    onTick: renderTick,
    onFinish: renderFinished,
  });
  showScreen('timer');
  timer.start();
}

function togglePause() {
  if (!timer) return;
  if (timer.state === 'running') {
    timer.pause();
    $('#t-pause').textContent = 'Resume';
    $('#timer').classList.add('paused');
  } else if (timer.state === 'paused') {
    audio.unlock();
    timer.resume();
    $('#t-pause').textContent = 'Pause';
    $('#timer').classList.remove('paused');
  }
}

function exitWorkout() {
  timer?.reset();
  timer = null;
  wakelock.release();
  $('#timer').classList.remove('paused');
  showScreen('setup');
}

function restartWorkout() {
  timer?.reset();
  $('#timer').classList.remove('paused');
  startWorkout();
}

// ---------- sound / vibration settings ----------

function applySettings() {
  audio.setMuted(settings.muted);
  audio.setVibration(settings.vibration);
  audio.setVolume(settings.volume);
  $('#set-sound').checked = !settings.muted;
  $('#set-volume').value = Math.round(settings.volume * 100);
  $('#set-volume-val').textContent = `${Math.round(settings.volume * 100)}%`;
  $('#set-ticks').checked = settings.ticks;
  $('#set-vibration').checked = settings.vibration;
  $('#t-mute').textContent = settings.muted ? '\u{1F507}' : '\u{1F50A}';
  $('#t-mute').setAttribute('aria-label', settings.muted ? 'Unmute' : 'Mute');
}

function updateSettings(patch) {
  Object.assign(settings, patch);
  storage.saveSettings(settings);
  applySettings();
}


// ---------- wiring ----------

function init() {
  renderConfig();
  const lastPreset = storage.loadLastPreset();
  renderPresets(lastPreset in storage.getAllPresets() ? lastPreset : '');
  applySettings();

  for (const f of FIELDS) {
    inputFor(f.key).addEventListener('change', onFieldChange);
  }
  document.querySelectorAll('.stepper button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.stepper').querySelector('input');
      const f = FIELDS.find((x) => `cfg-${x.key}` === input.id);
      const step = parseInt(btn.dataset.step, 10);
      const cur = parseInt(input.value, 10) || 0;
      input.value = Math.min(f.max, Math.max(f.min, cur + step));
      onFieldChange();
    });
  });

  $('#preset-select').addEventListener('change', (e) => {
    if (e.target.value) applyPreset(e.target.value);
    updatePresetButtons();
  });
  $('#preset-save').addEventListener('click', savePreset);
  $('#preset-delete').addEventListener('click', () => {
    const name = $('#preset-select').value;
    if (name && !storage.isBuiltinPreset(name)) {
      storage.deletePreset(name);
      storage.saveLastPreset('');
      renderPresets();
    }
  });

  const dialog = $('#settings');
  $('#settings-open').addEventListener('click', () => dialog.showModal());
  $('#settings-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // tap on backdrop
  });
  $('#set-sound').addEventListener('change', (e) => updateSettings({ muted: !e.target.checked }));
  $('#set-volume').addEventListener('input', (e) => updateSettings({ volume: e.target.valueAsNumber / 100 }));
  $('#set-ticks').addEventListener('change', (e) => updateSettings({ ticks: e.target.checked }));
  $('#set-vibration').addEventListener('change', (e) => updateSettings({ vibration: e.target.checked }));
  $('#set-test').addEventListener('click', () => audio.test());
  $('#t-mute').addEventListener('click', () => updateSettings({ muted: !settings.muted }));

  $('#start').addEventListener('click', startWorkout);
  $('#t-pause').addEventListener('click', togglePause);
  $('#t-restart').addEventListener('click', restartWorkout);
  $('#t-stop').addEventListener('click', exitWorkout);

  document.addEventListener('keydown', (e) => {
    if ($('#timer').classList.contains('hidden')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'Escape') {
      exitWorkout();
    }
  });

  // Mobile browsers throttle timers in hidden tabs; state is derived from
  // timestamps, so a forced tick on return snaps everything up to date.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') timer?.tick();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
