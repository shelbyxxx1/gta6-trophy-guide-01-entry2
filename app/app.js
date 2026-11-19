// Vice & Virtue — GTA VI Trophy Field Guide.
// Plain static tracker: checklist saved in localStorage, export/import as a
// file, filters by kind, a spoiler setting for hidden story trophies, and a
// four-phase roadmap to the platinum. Everything loads from app/ itself.
const KEY = 'vice-virtue-gta6-progress-v1';
const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const searchEl = document.getElementById('search');
const spoilerEl = document.getElementById('spoiler');

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));
const sourceById = new Map(doc.sources.map((s) => [s.id, s]));

let earned = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
let filter = 'all';
let query = '';
let spoiler = false;
let selectedId = 1;
let tab = 'guide';

const KIND_ORDER = ['platinum', 'story', 'activity', 'collectible', 'world'];
const KIND_LABEL = {
  platinum: 'Platinum',
  story: 'Story',
  activity: 'Activities',
  collectible: 'Collectibles',
  world: 'World & crime',
};

function save() {
  localStorage.setItem(KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function gradeBadge(t) {
  return `<span class="badge ${t.grade}">${t.grade}</span>`;
}

function tagHtml(t) {
  const tags = [`<span class="tag">${t.kind}</span>`];
  if (t.hidden) tags.push('<span class="tag hidden-tag">Hidden</span>');
  if (t.missable) tags.push('<span class="tag missable">Missable</span>');
  if (t.unconfirmed) tags.push('<span class="tag unconfirmed">Unconfirmed</span>');
  if (t.count) tags.push(`<span class="tag">×${t.count}</span>`);
  return tags.join('');
}

function isSpoilerHidden(t) {
  return spoiler && t.hidden && t.kind === 'story' && !earned.has(t.id);
}

function visibleTrophies() {
  return trophies.filter((t) => {
    if (filter === 'missable' && !t.missable) return false;
    if (filter === 'online') return false;
    if (filter !== 'all' && filter !== 'missable' && t.kind !== filter) return false;
    if (query) {
      const hay = `${t.name} ${t.description}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function renderProgress() {
  const n = earned.size;
  const pct = Math.round((n / trophies.length) * 100);
  document.getElementById('progress-count').textContent = `${n}/${trophies.length}`;
  document.getElementById('progress-label').textContent = `earned · ${pct}% to platinum`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  const phaseCounts = doc.roadmap.map((p) => {
    const ids = trophies.filter((t) => t.phase === p.phase).map((t) => t.id);
    const done = ids.filter((id) => earned.has(id)).length;
    return `Phase ${p.phase}: ${done}/${ids.length}`;
  });
  document.getElementById('roadmap-strip').innerHTML =
    `<b>Roadmap:</b> ${phaseCounts.join(' · ')} — one possibly missable trophy (Positive Mental Attitude, Chapter 1).`;
}

function renderList() {
  const shown = visibleTrophies();
  listEl.replaceChildren();
  if (filter === 'online') {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent =
      'No online trophies in the official list — all 55 are single-player and offline. That is why the platinum needs no multiplayer.';
    listEl.append(empty);
    return;
  }
  if (shown.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No trophies match this filter and search.';
    listEl.append(empty);
    return;
  }
  for (const kind of KIND_ORDER) {
    const group = shown.filter((t) => t.kind === kind);
    if (group.length === 0) continue;
    const done = group.filter((t) => earned.has(t.id)).length;
    const title = document.createElement('h2');
    title.className = 'group-title';
    title.innerHTML = `${KIND_LABEL[kind]} — <span>${done}/${group.length} earned</span>`;
    listEl.append(title);
    for (const t of group) {
      const hidden = isSpoilerHidden(t);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `trophy${earned.has(t.id) ? ' earned' : ''}${t.id === selectedId ? ' selected' : ''}`;
      row.dataset.id = t.id;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = earned.has(t.id);
      box.setAttribute('aria-label', `Mark ${t.name} earned`);
      box.addEventListener('click', (event) => event.stopPropagation());
      box.addEventListener('change', () => {
        toggleEarned(t.id);
      });
      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = `trophy-name${earned.has(t.id) ? ' earned-name' : ''}`;
      name.textContent = hidden ? 'Hidden trophy — earn it to reveal' : t.name;
      const desc = document.createElement('span');
      desc.className = 'trophy-desc';
      desc.textContent = hidden ? 'Story trophy, hidden until earned.' : t.description;
      const tags = document.createElement('span');
      tags.className = 'trophy-tags';
      tags.innerHTML = tagHtml(t);
      body.append(name, document.createElement('br'), desc, tags);
      const badges = document.createElement('span');
      badges.className = 'badges';
      badges.innerHTML = gradeBadge(t);
      row.append(box, body, badges);
      row.addEventListener('click', () => {
        selectedId = t.id;
        renderList();
        renderDetail();
        syncHash();
      });
      listEl.append(row);
    }
  }
}

function sourceChips(t) {
  return t.sources
    .map((id) => {
      const s = sourceById.get(id);
      if (!s) return '';
      return s.url
        ? `<a class="source-chip" href="${s.url}" target="_blank" rel="noopener">[${id}] ${escapeHtml(s.name)}</a>`
        : `<span class="source-chip">[${id}] ${escapeHtml(s.name)}</span>`;
    })
    .join('');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderDetail() {
  const t = byId.get(selectedId) ?? trophies[0];
  const hidden = isSpoilerHidden(t);
  const phase = doc.roadmap.find((p) => p.phase === t.phase);
  detailEl.replaceChildren();
  const tags = document.createElement('div');
  tags.className = 'trophy-tags';
  tags.innerHTML = gradeBadge(t) + tagHtml(t);
  const title = document.createElement('h2');
  title.textContent = hidden ? 'Hidden trophy' : t.name;
  const official = document.createElement('p');
  official.className = 'official';
  official.innerHTML = hidden
    ? 'Official description hidden until earned.'
    : `<b>Official description</b> — ${escapeHtml(t.description)}`;
  const guideLabel = document.createElement('p');
  guideLabel.className = 'guide-label';
  guideLabel.textContent = 'Guide — in our own words';
  const guide = document.createElement('p');
  guide.textContent = hidden
    ? 'Turn the spoiler setting off, or earn this trophy, to read its guide.'
    : t.guide;
  detailEl.append(tags, title, official, guideLabel, guide);
  if (!hidden) {
    const phaseLine = document.createElement('p');
    phaseLine.className = 'phase-line';
    phaseLine.innerHTML = `Roadmap — <b>Phase ${t.phase}: ${escapeHtml(phase?.title ?? '')}</b> (${escapeHtml(phase?.hours ?? '')})`;
    const sourcesLabel = document.createElement('p');
    sourcesLabel.className = 'sources-label';
    sourcesLabel.textContent = 'Sources for this guide';
    const chips = document.createElement('div');
    chips.className = 'source-chips';
    chips.innerHTML = sourceChips(t);
    detailEl.append(phaseLine, sourcesLabel, chips);
  }
  if (!hidden && t.missable) {
    const note = document.createElement('p');
    note.className = 'missable-note';
    note.innerHTML = `<b>Possibly missable.</b> ${escapeHtml(t.missable_note ?? '')}`;
    detailEl.append(note);
  }
  if (!hidden && t.unconfirmed) {
    const note = document.createElement('p');
    note.className = 'unconfirmed-note';
    note.innerHTML =
      '<b>Unconfirmed at launch.</b> No guide had a verified unlock method for this trophy when the game released. The guide above is the honest reading of its official description — nothing more.';
    detailEl.append(note);
  }
  const mark = document.createElement('button');
  mark.type = 'button';
  mark.className = `mark-btn${earned.has(t.id) ? ' earned' : ''}`;
  mark.textContent = earned.has(t.id) ? '✓ Earned — click to unmark' : 'Mark earned';
  mark.addEventListener('click', () => toggleEarned(t.id));
  detailEl.append(mark);
}

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  save();
  renderProgress();
  renderList();
  renderDetail();
}

function renderRoadmap() {
  const host = document.getElementById('roadmap-phases');
  host.replaceChildren();
  for (const p of doc.roadmap) {
    const ids = trophies.filter((t) => t.phase === p.phase);
    const done = ids.filter((t) => earned.has(t.id)).length;
    const section = document.createElement('div');
    section.className = 'phase';
    const title = document.createElement('h3');
    title.innerHTML = `Phase ${p.phase} — ${escapeHtml(p.title)} <span class="hours">${escapeHtml(p.hours)} · ${done}/${ids.length} earned</span>`;
    const text = document.createElement('p');
    text.textContent = p.text;
    const srcs = document.createElement('p');
    srcs.className = 'phase-line';
    srcs.textContent = `Sources: ${p.sources.join(', ')} — see Sources & about for the full citations.`;
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const t of ids) {
      const chip = document.createElement('span');
      chip.className = `chip${earned.has(t.id) ? ' done' : ''}`;
      chip.textContent = `${earned.has(t.id) ? '✓ ' : ''}${isSpoilerHidden(t) ? 'Hidden trophy' : t.name}`;
      chips.append(chip);
    }
    section.append(title, text, srcs, chips);
    host.append(section);
  }
  const missable = trophies.filter((t) => t.missable);
  document.getElementById('missable-summary').textContent =
    `${missable.length} of 55 trophies is flagged possibly missable. PowerPyx and GTABase agree on this one; every other trophy is earnable in free-roam after the story, because there are no other one-time windows in the list.`;
  const mList = document.getElementById('missable-list');
  mList.replaceChildren();
  for (const t of missable) {
    const section = document.createElement('div');
    section.className = 'phase';
    section.innerHTML = `<h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.guide)}</p>`;
    mList.append(section);
  }
}

function renderSources() {
  const host = document.getElementById('source-list');
  host.replaceChildren();
  for (const s of doc.sources) {
    const li = document.createElement('li');
    li.innerHTML = `<b>[${s.id}] ${escapeHtml(s.name)}</b> — ${escapeHtml(s.note)}` +
      (s.url ? ` <a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a>` : '');
    host.append(li);
  }
}

function setTab(next) {
  tab = next;
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.tab === next);
  }
  document.getElementById('view-guide').classList.toggle('hidden', next !== 'guide');
  document.getElementById('view-roadmap').classList.toggle('hidden', next !== 'roadmap');
  document.getElementById('view-sources').classList.toggle('hidden', next !== 'sources');
  if (next === 'roadmap') renderRoadmap();
  if (next === 'sources') renderSources();
}

function syncHash() {
  const parts = [`trophy-${selectedId}`];
  if (filter !== 'all') parts.push(`filter-${filter}`);
  if (spoiler) parts.push('spoiler-on');
  if (tab !== 'guide') parts.unshift(tab);
  history.replaceState(null, '', `#/${parts.join('/')}`);
}

function readHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  for (const part of parts) {
    if (part === 'roadmap' || part === 'sources' || part === 'guide') setTab(part);
    else if (part.startsWith('trophy-')) {
      const id = Number(part.slice(7));
      if (byId.has(id)) selectedId = id;
    } else if (part.startsWith('filter-')) {
      const kind = part.slice(7);
      if (['story', 'missable', 'collectible', 'activity', 'online'].includes(kind)) filter = kind;
    } else if (part === 'spoiler-on') spoiler = true;
  }
  spoilerEl.checked = spoiler;
  for (const button of document.querySelectorAll('.filter')) {
    button.classList.toggle('active', button.dataset.filter === filter);
  }
}

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => {
    setTab(button.dataset.tab);
    syncHash();
  });
}
for (const button of document.querySelectorAll('.filter')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    for (const other of document.querySelectorAll('.filter')) {
      other.classList.toggle('active', other === button);
    }
    renderList();
    syncHash();
  });
}
searchEl.addEventListener('input', () => {
  query = searchEl.value.trim().toLowerCase();
  renderList();
});
spoilerEl.addEventListener('change', () => {
  spoiler = spoilerEl.checked;
  renderList();
  renderDetail();
  syncHash();
});
document.getElementById('export').addEventListener('click', () => {
  const payload = JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b) }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('import').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    earned = new Set(ids.filter((id) => byId.has(id)));
    save();
    renderProgress();
    renderList();
    renderDetail();
  } catch {
    alert('That file is not a Vice & Virtue progress export.');
  }
  event.target.value = '';
});

readHash();
renderProgress();
renderList();
renderDetail();
setTab(tab);
