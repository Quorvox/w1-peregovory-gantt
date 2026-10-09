// w1: планер переговоров, ванилла без зависимостей
const KEY = 'w1-items';
const ORDER = ['plan', 'work', 'done'];
const NAMES = { plan: 'план', work: 'в работе', done: 'готово' };
const DAY = 86400000;

function uid() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function seed() {
  // демо-набор на первый запуск
  const t = new Date();
  const d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [
    { id: uid() + 'a', title: 'повестка и цели', owner: 'александр', start: d(0), end: d(2), status: 'done' },
    { id: uid() + 'b', title: 'аргументы и уступки', owner: 'мария', start: d(1), end: d(4), status: 'work' },
    { id: uid() + 'c', title: 'договор и сроки', owner: 'александр', start: d(3), end: d(6), status: 'plan' },
  ];
}

function load() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) { const s = seed(); if (typeof localStorage !== 'undefined') save(s); return s; }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : seed();
  } catch (e) { return seed(); }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function validate(f) {
  // проверка формы, возвр. ошибки по полям
  const err = {};
  if (!f.title.trim()) err.title = 'нужно название';
  if (!f.start) err.start = 'нет старта';
  if (!f.end) err.end = 'нет финиша';
  if (f.start && f.end && f.end < f.start) err.end = 'финиш раньше старта';
  return err;
}

function ganttRange(items) {
  // мин/макс даты и длина шкалы
  const ds = items.flatMap(i => [i.start, i.end]).sort();
  const min = ds[0], max = ds[ds.length - 1];
  // +день: последний день тоже занимает место на шкале
  return { min, max, span: Math.max(new Date(max) - new Date(min) + DAY, DAY) };
}

function barPos(item, r) {
  // полоса в процентах шкалы
  const left = (new Date(item.start) - new Date(r.min)) / r.span * 100;
  const width = Math.max((new Date(item.end) - new Date(item.start) + DAY) / r.span * 100, 3);
  return { left: +left.toFixed(1), width: +width.toFixed(1) };
}

function days(r) {
  // даты от min до max включительно
  const out = [];
  let cur = new Date(r.min);
  const end = new Date(r.max);
  while (cur <= end) { out.push(cur.toISOString().slice(0, 10).slice(5)); cur = new Date(+cur + DAY); }
  return out;
}

function nextStatus(s) {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

if (typeof document !== 'undefined') {
  let items = load();
  let filter = 'all';

  const $ = id => document.getElementById(id);

  function renderList() {
    const box = $('list');
    const rows = items.filter(i => filter === 'all' || i.status === filter);
    if (!rows.length) { box.innerHTML = '<div class="empty">пусто, добавь пункт выше</div>'; return; }
    box.innerHTML = rows.map(i => `
      <div class="item" data-id="${i.id}">
        <div class="t"><b>${esc(i.title)}</b><span>${esc(i.owner)} · ${i.start} → ${i.end}</span></div>
        <button class="st ${i.status}" data-act="st">${NAMES[i.status]}</button>
        <button class="del" data-act="del">✕</button>
      </div>`).join('');
  }

  function renderGantt() {
    const box = $('gantt');
    if (!items.length) { box.innerHTML = '<div class="empty">нет данных для шкалы</div>'; return; }
    const r = ganttRange(items);
    const ds = days(r);
    const today = new Date().toISOString().slice(0, 10);
    const tPos = (r.min <= today && today <= r.max)
      ? ((new Date(today) - new Date(r.min)) / r.span * 100).toFixed(1) : null;
    box.innerHTML = `
      <div class="g-head"><div></div><div class="g-days" style="grid-template-columns:repeat(${ds.length},1fr)">
        ${ds.map(d => `<span>${d}</span>`).join('')}
      </div></div>` + items.map(i => {
        const p = barPos(i, r);
        return `<div class="g-row"><div class="g-label">${esc(i.title)}</div>
          <div class="g-track"><div class="g-bar ${i.status}" style="left:${p.left}%;width:${p.width}%"></div>
          ${tPos !== null ? `<div class="g-today" style="left:${tPos}%"></div>` : ''}</div></div>`;
      }).join('');
  }

  function render() { renderList(); renderGantt(); }

  document.addEventListener('DOMContentLoaded', () => {
    // подсветка активного фильтра
    $('filters').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      filter = b.dataset.f;
      document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('on', x === b));
      renderList();
    });

    // клики по списку: статус по кругу, удаление
    $('list').addEventListener('click', e => {
      const card = e.target.closest('.item');
      if (!card) return;
      const item = items.find(i => i.id === card.dataset.id);
      if (!item) return;
      if (e.target.dataset.act === 'del') items = items.filter(i => i !== item);
      if (e.target.dataset.act === 'st') item.status = nextStatus(item.status);
      save(items);
      render();
    });

    // отправка формы
    $('f').addEventListener('submit', e => {
      e.preventDefault();
      const f = { title: $('title').value, owner: $('owner').value.trim() || '—',
                  start: $('start').value, end: $('end').value, status: $('status').value };
      const err = validate(f);
      ['title', 'start', 'end'].forEach(k => $(k).classList.toggle('bad', !!err[k]));
      $('err').textContent = Object.values(err)[0] || '';
      if (Object.keys(err).length) return;
      items.push({ id: uid(), ...f });
      save(items);
      $('f').reset();
      render();
    });

    render();
  });
}
