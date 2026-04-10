const STORAGE_KEY = 'vessel-ops-log-v1';
const THEME_KEY = 'vessel-ops-theme';

const state = {
  entries: loadEntries(),
  activeTab: 'today',
};

const els = {
  todayDate: document.getElementById('todayDate'),
  tripCount: document.getElementById('tripCount'),
  hoursCount: document.getElementById('hoursCount'),
  flagCount: document.getElementById('flagCount'),
  monthCount: document.getElementById('monthCount'),
  todayTimeline: document.getElementById('todayTimeline'),
  latestWatch: document.getElementById('latestWatch'),
  tripList: document.getElementById('tripList'),
  maintenanceList: document.getElementById('maintenanceList'),
  patternSummary: document.getElementById('patternSummary'),
  entryType: document.getElementById('entryType'),
  vesselName: document.getElementById('vesselName'),
  startTime: document.getElementById('startTime'),
  endTime: document.getElementById('endTime'),
  duration: document.getElementById('duration'),
  location: document.getElementById('location'),
  purpose: document.getElementById('purpose'),
  conditions: document.getElementById('conditions'),
  fuel: document.getElementById('fuel'),
  performance: document.getElementById('performance'),
  severity: document.getElementById('severity'),
  notes: document.getElementById('notes'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  importFile: document.getElementById('importFile'),
};

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function fmtDateTime(iso) {
  if (!iso) return 'No time set';
  const d = new Date(iso);
  return d.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function calculateDurationHours(entry) {
  if (entry.duration) return Number(entry.duration);
  if (entry.startTime && entry.endTime) {
    const ms = new Date(entry.endTime) - new Date(entry.startTime);
    return Math.max(0, ms / 36e5);
  }
  return 0;
}

function renderStats() {
  const trips = state.entries.filter(e => e.entryType === 'Trip');
  const hours = trips.reduce((sum, e) => sum + calculateDurationHours(e), 0);
  const flags = state.entries.filter(e => ['Issue', 'Maintenance'].includes(e.entryType) || e.severity === 'High').length;
  const now = new Date();
  const monthTrips = trips.filter(e => {
    const d = new Date(e.startTime || e.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  els.tripCount.textContent = String(trips.length);
  els.hoursCount.textContent = hours.toFixed(1);
  els.flagCount.textContent = String(flags);
  els.monthCount.textContent = String(monthTrips);
}

function renderToday() {
  const today = new Date().toDateString();
  const entries = [...state.entries]
    .filter(e => new Date(e.startTime || e.createdAt).toDateString() === today)
    .sort((a,b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt));

  if (!entries.length) {
    els.todayTimeline.innerHTML = '<div class="empty-state">No entries yet today.</div>';
  } else {
    els.todayTimeline.innerHTML = entries.map(renderEntryCard).join('');
  }

  const watch = [...state.entries]
    .filter(e => e.entryType === 'Issue' || e.entryType === 'Maintenance' || e.severity === 'High')
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  els.latestWatch.innerHTML = watch ? renderEntryCard(watch) : '<div class="empty-state">No active watch items.</div>';
}

function renderEntryCard(e) {
  const meta = [
    e.vesselName,
    e.location,
    e.purpose,
    e.conditions,
    e.performance,
    e.fuel ? `Fuel: ${e.fuel}` : '',
    calculateDurationHours(e) ? `${calculateDurationHours(e).toFixed(1)}h` : '',
    e.severity ? `Severity: ${e.severity}` : '',
  ].filter(Boolean);

  return `
    <article class="entry">
      <div class="entry-top">
        <div>
          <div class="entry-type">${escapeHtml(e.entryType)}</div>
          <strong>${escapeHtml(e.location || e.vesselName || 'Untitled entry')}</strong>
        </div>
        <div class="muted">${fmtDateTime(e.startTime || e.createdAt)}</div>
      </div>
      <div class="entry-meta">${meta.map(m => `<span>${escapeHtml(m)}</span>`).join('')}</div>
      ${e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : ''}
    </article>`;
}

function renderTrips() {
  const q = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const entries = [...state.entries]
    .filter(e => type === 'all' || e.entryType === type)
    .filter(e => {
      if (!q) return true;
      const hay = [e.vesselName, e.location, e.notes, e.conditions, e.purpose, e.entryType].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt));

  els.tripList.innerHTML = entries.length ? entries.map(renderEntryCard).join('') : '<div class="empty-state">No matching entries.</div>';
}

function renderMaintenance() {
  const entries = [...state.entries]
    .filter(e => e.entryType === 'Issue' || e.entryType === 'Maintenance')
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  els.maintenanceList.innerHTML = entries.length ? entries.map(renderEntryCard).join('') : '<div class="empty-state">No maintenance items yet.</div>';
}

function renderPatterns() {
  const trips = state.entries.filter(e => e.entryType === 'Trip');
  const avgHours = trips.length ? (trips.reduce((sum, e) => sum + calculateDurationHours(e), 0) / trips.length) : 0;
  const roughTrips = state.entries.filter(e => ['Rough', 'Needs attention', 'Delayed start'].includes(e.performance)).length;
  const issueCount = state.entries.filter(e => e.entryType === 'Issue').length;
  const topPurpose = mostCommon(trips.map(e => e.purpose).filter(Boolean));

  els.patternSummary.innerHTML = [
    ['Avg trip length', `${avgHours.toFixed(1)}h`],
    ['Rough / attention events', String(roughTrips)],
    ['Issue flags', String(issueCount)],
    ['Most common purpose', topPurpose || '—'],
  ].map(([label, value]) => `<div class="mini-stat"><span class="stat-label">${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function mostCommon(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0] || '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function refreshAll() {
  renderStats();
  renderToday();
  renderTrips();
  renderMaintenance();
  renderPatterns();
}

function setTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${tabName}`));
}

function resetForm() {
  document.getElementById('logForm').reset();
  els.startTime.value = new Date().toISOString().slice(0,16);
}

function handleSubmit(event) {
  event.preventDefault();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    entryType: els.entryType.value,
    vesselName: els.vesselName.value.trim(),
    startTime: els.startTime.value || new Date().toISOString(),
    endTime: els.endTime.value || '',
    duration: els.duration.value || '',
    location: els.location.value.trim(),
    purpose: els.purpose.value,
    conditions: els.conditions.value.trim(),
    fuel: els.fuel.value.trim(),
    performance: els.performance.value,
    severity: els.severity.value,
    notes: els.notes.value.trim(),
  };

  state.entries.unshift(entry);
  saveEntries();
  refreshAll();
  setTab('today');
  resetForm();
}

function exportJson() {
  downloadFile('vessel-ops-log.json', JSON.stringify(state.entries, null, 2), 'application/json');
}

function exportCsv() {
  const headers = ['createdAt','entryType','vesselName','startTime','endTime','duration','location','purpose','conditions','fuel','performance','severity','notes'];
  const rows = state.entries.map(entry => headers.map(h => csvEscape(entry[h] || '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile('vessel-ops-log.csv', csv, 'text/csv');
}

function csvEscape(value) {
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('Invalid file');
      state.entries = data;
      saveEntries();
      refreshAll();
      alert('Import complete.');
    } catch {
      alert('Unable to import that JSON file.');
    }
  };
  reader.readAsText(file);
}

function seedDemo() {
  const base = new Date();
  const day1 = new Date(base); day1.setDate(base.getDate() - 2); day1.setHours(10,0,0,0);
  const day2 = new Date(base); day2.setDate(base.getDate() - 1); day2.setHours(13,30,0,0);
  const day3 = new Date(base); day3.setHours(11,15,0,0);

  state.entries = [
    {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), entryType: 'Trip', vesselName: 'Pontoon', startTime: day3.toISOString(), endTime: new Date(day3.getTime()+3*36e5).toISOString(), duration: '3', location: 'Lake Norman / main channel', purpose: 'Leisure', conditions: 'Busy, warm, light chop', fuel: 'Moderate burn', performance: 'Smooth', severity: '', notes: 'Good family outing. Midday traffic heavier than ideal.'
    },
    {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), entryType: 'Issue', vesselName: 'Pontoon', startTime: day2.toISOString(), endTime: '', duration: '', location: 'Dock', purpose: '', conditions: 'Calm', fuel: '', performance: 'Needs attention', severity: 'Medium', notes: 'Engine ran rough during restart. Watch next outing.'
    },
    {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), entryType: 'Maintenance', vesselName: 'Pontoon', startTime: day1.toISOString(), endTime: '', duration: '', location: 'Home dock', purpose: 'Maintenance run', conditions: '', fuel: '', performance: 'Normal', severity: 'Low', notes: 'Battery check completed and fuel topped off.'
    }
  ];
  saveEntries();
  refreshAll();
}

function initTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark', theme === 'dark');
}

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}

function init() {
  els.todayDate.textContent = fmtDate(new Date().toISOString());
  resetForm();
  initTheme();
  refreshAll();

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => {
    setTab('log');
    els.entryType.value = btn.dataset.preset;
  }));
  document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    els.duration.value = btn.dataset.duration;
  }));

  document.getElementById('logForm').addEventListener('submit', handleSubmit);
  document.getElementById('resetForm').addEventListener('click', resetForm);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('importBtn').addEventListener('click', () => els.importFile.click());
  document.getElementById('seedDemo').addEventListener('click', seedDemo);
  document.getElementById('clearTodayFilter').addEventListener('click', () => setTab('trips'));
  els.importFile.addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));
  els.searchInput.addEventListener('input', renderTrips);
  els.typeFilter.addEventListener('change', renderTrips);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
}

init();
