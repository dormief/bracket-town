import './style.css';
import { parse, solution, norm, maxDepth, encode, decode, DEFAULT, ParseError, type Node, type Clue, type Puzzle } from './parser';

const app = document.getElementById('app')!, modal = document.getElementById('modal')!;
const KEY = 'bracket-town-puzzles';
const START = 100, WRONG = 2, HINT = 5, REVEAL = 15;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const load = (): Puzzle[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const store = (ps: Puzzle[]) => localStorage.setItem(KEY, JSON.stringify(ps));
const shareUrl = (p: Puzzle) => location.href.split('#')[0] + '#/s/' + encode(p);
function toast(msg: string) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy this:', text); }
}
function showModal(html: string) { modal.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`; modal.classList.remove('hidden'); (modal.querySelector('button,a') as HTMLElement | null)?.focus(); }
const closeModal = () => modal.classList.add('hidden');
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

/* ---------------- PLAY ---------------- */
let cleanupPlay: (() => void) | null = null;
function play(p: Puzzle, origin: 'default' | 'saved' | 'shared') {
  let parsed; try { parsed = parse(p.source); } catch (e) { app.innerHTML = `<section class="panel"><h2>Broken puzzle</h2><p>${esc((e as Error).message)}</p><a class="btn" href="#/">Play default</a></section>`; return; }
  const { nodes, clues } = parsed;
  const solved = new Set<number>(), revealed = new Set<number>(), hinted = new Map<number, number>();
  let score = START, wrong = 0, sel = -1, justSolved = -1, done = false;
  const isActive = (c: Clue) => !solved.has(c.id) && c.parts.every(n => typeof n === 'string' || solved.has(n.id));
  const active = () => clues.filter(isActive).sort((a, b) => order(a) - order(b));
  const pos = new Map<number, number>(); let k = 0;
  (function walk(ns: Node[]) { for (const n of ns) if (typeof n !== 'string') { pos.set(n.id, k++); walk(n.parts); } })(nodes);
  const order = (c: Clue) => pos.get(c.id)!;

  app.innerHTML = `<section class="play">
    <div class="meta"><h1 class="ptitle">${esc(p.title)}</h1>
      <div class="scorebox" aria-live="polite"><span class="score">${score}</span><small>score</small></div></div>
    <div class="stats"><span class="left"></span><span class="wrongs"></span></div>
    <div class="sentence" aria-live="polite"></div>
    <p class="hint-line"></p>
    <div class="actions"><button class="btn ghost" data-a="hint">Hint <small>−${HINT}</small></button><button class="btn ghost" data-a="reveal">Reveal <small>−${REVEAL}</small></button>
      <button class="btn ghost" data-a="restart">Restart</button>${origin !== 'default' ? `<button class="btn ghost" data-a="share">Share</button>` : ''}${origin === 'shared' ? `<button class="btn ghost" data-a="save">Save</button>` : ''}</div>
  </section>
  <form class="answerbar" autocomplete="off"><input class="ans" type="text" enterkeyhint="go" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type an answer…" aria-label="Answer"><button class="btn primary" type="submit">Go</button></form>`;
  const sentence = app.querySelector('.sentence') as HTMLElement, input = app.querySelector('.ans') as HTMLInputElement, bar = app.querySelector('.answerbar') as HTMLElement;
  const scoreEl = app.querySelector('.score')!, hintLine = app.querySelector('.hint-line')!;

  function html(ns: Node[]): string {
    return ns.map(n => {
      if (typeof n === 'string') return esc(n);
      if (solved.has(n.id)) return `<span class="solved${n.id === justSolved ? ' pop' : ''}${revealed.has(n.id) ? ' rev' : ''}">${esc(n.answer)}</span>`;
      const act = isActive(n);
      return act ? `<button type="button" class="clue active${n.id === sel ? ' sel' : ''}" data-id="${n.id}" aria-pressed="${n.id === sel}"><b>[</b>${html(n.parts)}<b>]</b></button>`
        : `<span class="clue d${Math.min(n.depth, 4)}"><b>[</b>${html(n.parts)}<b>]</b></span>`;
    }).join('');
  }
  function render() {
    const act = active();
    if (!act.find(c => c.id === sel)) sel = act[0]?.id ?? -1;
    sentence.innerHTML = html(nodes); scoreEl.textContent = String(score);
    app.querySelector('.left')!.textContent = `${clues.length - solved.size} of ${clues.length} clues left`;
    app.querySelector('.wrongs')!.textContent = wrong ? `${wrong} wrong guess${wrong > 1 ? 'es' : ''}` : '';
    const h = hinted.get(sel); const c = clues[sel];
    hintLine.textContent = c && h ? `Hint: starts with “${c.answer.slice(0, h)}…” (${c.answer.length} letters)` : '';
    justSolved = -1;
  }
  function solve(c: Clue, how: 'guess' | 'reveal') {
    solved.add(c.id); if (how === 'reveal') revealed.add(c.id); justSolved = c.id; sel = -1; render();
    if (solved.size === clues.length) { done = true; setTimeout(win, 900); }
  }
  function win() {
    const rank = score >= 95 ? 'Mayor' : score >= 80 ? 'Alderman' : score >= 60 ? 'Shopkeeper' : score >= 40 ? 'Resident' : 'Tourist';
    showModal(`<p class="kicker">Town complete!</p><p class="final">${esc(solution(nodes))}</p>
      <div class="bigscore">${Math.max(score, 0)}<small>/ ${START}</small></div><p class="rank">Rank: <b>${rank}</b></p>
      <p class="muted">${wrong} wrong · ${[...hinted.keys()].length} hints · ${revealed.size} reveals</p>
      <div class="row"><button class="btn primary" data-m="share">Share result</button><button class="btn ghost" data-m="close">Close</button><a class="btn ghost" href="#/editor">Make your own</a></div>`);
    modal.querySelector('[data-m=close]')!.addEventListener('click', closeModal);
    modal.querySelector('[data-m=share]')!.addEventListener('click', () => {
      const text = `Bracket Town — ${p.title}\nScore ${Math.max(score, 0)}/${START} · ${rank}\n${origin === 'default' ? location.href.split('#')[0] : shareUrl(p)}`;
      if (navigator.share) navigator.share({ text }).catch(() => {}); else copy(text, 'Result copied');
    });
  }
  function submit() {
    if (done) return; const g = norm(input.value); if (!g) return;
    const act = active(); const target = act.find(c => c.id === sel && norm(c.answer) === g) || act.find(c => norm(c.answer) === g);
    if (target) { input.value = ''; solve(target, 'guess'); }
    else { score -= WRONG; wrong++; render(); bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake'); input.select(); }
  }
  bar.addEventListener('submit', e => { e.preventDefault(); submit(); });
  sentence.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('.clue.active') as HTMLElement | null; if (b) { sel = +b.dataset.id!; render(); input.focus({ preventScroll: true }); } });
  app.querySelector('.actions')!.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a'); const c = clues[sel];
    if (a === 'hint' && c && !done) { const h = hinted.get(c.id) || 0; if (h < c.answer.length - 1) { hinted.set(c.id, h + 1); score -= HINT; } render(); }
    if (a === 'reveal' && c && !done) { score -= REVEAL; solve(c, 'reveal'); }
    if (a === 'restart') play(p, origin);
    if (a === 'share') copy(shareUrl(p), 'Share link copied');
    if (a === 'save') { const ps = load(); ps.unshift({ ...p, id: crypto.randomUUID?.() || String(Date.now()), updated: Date.now() }); store(ps); toast('Saved to My puzzles'); }
  });
  const onKey = (e: KeyboardEvent) => {
    if (!modal.classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
    if ((e.key === 'Tab' && document.activeElement === input) || (e.altKey && /Arrow(Left|Right)/.test(e.key))) {
      const act = active(); if (!act.length) return; e.preventDefault();
      const i = act.findIndex(c => c.id === sel); const d = e.shiftKey || e.key === 'ArrowLeft' ? -1 : 1;
      sel = act[(i + d + act.length) % act.length].id; render();
    }
  };
  document.addEventListener('keydown', onKey);
  // keep the answer bar above the iOS keyboard
  const vv = window.visualViewport;
  const place = () => { if (!vv) return; const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); bar.style.transform = `translateY(${-off}px)`; };
  vv?.addEventListener('resize', place); vv?.addEventListener('scroll', place);
  cleanupPlay = () => { document.removeEventListener('keydown', onKey); vv?.removeEventListener('resize', place); vv?.removeEventListener('scroll', place); };
  render();
  if (matchMedia('(pointer:fine)').matches) input.focus();
}

/* ---------------- EDITOR ---------------- */
function editor(id?: string) {
  const ps = load(); const existing = id ? ps.find(p => p.id === id) : undefined;
  const p: Puzzle = existing ? { ...existing } : { title: '', source: '' };
  app.innerHTML = `<section class="panel editor">
    <h1>${existing ? 'Edit puzzle' : 'Create a puzzle'}</h1>
    <p class="muted">Write one sentence. Wrap each clue as <code>[clue text|answer]</code>. Clues can contain other clues — e.g.
    <code>The [capital of [boot-shaped country|Italy]|Rome] is lovely</code>. Only brackets with no brackets inside are solvable first.</p>
    <label>Title<input class="title" type="text" maxlength="80" placeholder="My puzzle" value="${esc(p.title)}"></label>
    <label>Puzzle<textarea class="src" rows="7" spellcheck="false" placeholder="The [capital of [boot-shaped country|Italy]|Rome] is lovely.">${esc(p.source)}</textarea></label>
    <div class="status"></div>
    <div class="preview"><h3>Finished sentence</h3><p class="fin muted">—</p></div>
    <div class="row wrap"><button class="btn primary" data-e="play">Play it</button><button class="btn" data-e="save">Save</button><button class="btn ghost" data-e="share">Copy share link</button><button class="btn ghost" data-e="sample">Insert example</button></div>
  </section>`;
  const t = app.querySelector('.title') as HTMLInputElement, s = app.querySelector('.src') as HTMLTextAreaElement;
  const status = app.querySelector('.status')!, fin = app.querySelector('.fin')!;
  let ok = false;
  const validate = () => {
    p.title = t.value.trim() || 'Untitled puzzle'; p.source = s.value;
    try { const r = parse(s.value); ok = true;
      status.className = 'status ok'; status.textContent = `✓ ${r.clues.length} clue${r.clues.length > 1 ? 's' : ''}, ${maxDepth(r.clues)} level${maxDepth(r.clues) > 1 ? 's' : ''} deep`;
      fin.textContent = solution(r.nodes); fin.classList.remove('muted');
    } catch (e) { ok = false; status.className = 'status err';
      const pe = e as ParseError; const line = s.value.slice(0, pe.pos).split('\n');
      status.textContent = s.value.trim() ? `✗ ${pe.message} (line ${line.length}, col ${line[line.length - 1].length + 1})` : 'Start typing a sentence with [clue|answer] brackets.';
      fin.textContent = '—'; fin.classList.add('muted'); }
  };
  t.addEventListener('input', validate); s.addEventListener('input', validate); validate();
  const save = () => { const all = load(); p.updated = Date.now();
    if (p.id) { const i = all.findIndex(x => x.id === p.id); if (i >= 0) all[i] = p; else all.unshift(p); } else { p.id = crypto.randomUUID?.() || String(Date.now()); all.unshift(p); }
    store(all); history.replaceState(null, '', '#/editor/' + p.id); };
  app.querySelector('.row')!.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('[data-e]')?.getAttribute('data-e');
    if (a === 'sample') { s.value = DEFAULT.source; t.value ||= 'Example'; validate(); return; }
    if (!a) return; if (!ok) { toast('Fix the errors first'); return; }
    if (a === 'save') { save(); toast('Saved'); }
    if (a === 'play') { save(); location.hash = '#/play/' + p.id; }
    if (a === 'share') copy(shareUrl(p), 'Share link copied');
  });
}

/* ---------------- LIBRARY ---------------- */
function library() {
  const ps = load();
  app.innerHTML = `<section class="panel"><h1>My puzzles</h1>
    <div class="row wrap"><a class="btn primary" href="#/editor">+ New puzzle</a><button class="btn ghost" data-l="export">Export all (JSON)</button>
    <label class="btn ghost">Import JSON<input type="file" accept="application/json,.json" hidden></label></div>
    <ul class="list">${ps.length ? ps.map(p => { let info = ''; try { const r = parse(p.source); info = `${r.clues.length} clues · ${maxDepth(r.clues)} deep`; } catch { info = 'has errors'; }
      return `<li><div><b>${esc(p.title)}</b><small class="muted">${info}</small></div><div class="row">
      <a class="btn sm primary" href="#/play/${p.id}">Play</a><a class="btn sm" href="#/editor/${p.id}">Edit</a>
      <button class="btn sm ghost" data-share="${p.id}">Share</button><button class="btn sm ghost" data-json="${p.id}">JSON</button><button class="btn sm danger" data-del="${p.id}">Delete</button></div></li>`; }).join('')
      : '<li class="muted">No saved puzzles yet. Create one!</li>'}</ul></section>`;
  const download = (data: unknown, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = name; a.click(); };
  app.addEventListener('click', function h(e) {
    if (!location.hash.startsWith('#/library')) return app.removeEventListener('click', h);
    const el = e.target as HTMLElement; const find = (id?: string) => ps.find(p => p.id === id)!;
    if (el.dataset.l === 'export') download(ps, 'bracket-town-puzzles.json');
    if (el.dataset.share) copy(shareUrl(find(el.dataset.share)), 'Share link copied');
    if (el.dataset.json) download(find(el.dataset.json), 'puzzle.json');
    if (el.dataset.del && confirm(`Delete “${find(el.dataset.del).title}”?`)) { store(ps.filter(p => p.id !== el.dataset.del)); app.removeEventListener('click', h); library(); }
  });
  app.querySelector('input[type=file]')!.addEventListener('change', async e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); const arr = (Array.isArray(d) ? d : [d]) as Puzzle[]; let n = 0; const all = load();
      for (const x of arr) { if (typeof x?.source !== 'string') continue; try { parse(x.source); } catch { continue; }
        all.unshift({ id: crypto.randomUUID?.() || String(Date.now() + n), title: String(x.title || 'Imported'), source: x.source, updated: Date.now() }); n++; }
      store(all); toast(`Imported ${n} puzzle${n === 1 ? '' : 's'}`); library();
    } catch { toast('Not a valid JSON file'); }
  });
}

/* ---------------- ROUTER ---------------- */
function route() {
  cleanupPlay?.(); cleanupPlay = null; closeModal(); window.scrollTo(0, 0);
  const h = location.hash.slice(1) || '/'; const [, a, b] = h.split('/');
  document.querySelectorAll('nav a').forEach(n => n.classList.toggle('on', n.getAttribute('href') === '#/' + (a === 'play' || a === 's' ? '' : a || '')));
  document.body.dataset.view = a || 'play';
  if (a === 'editor') editor(b);
  else if (a === 'library') library();
  else if (a === 's' && b) { try { play(decode(b), 'shared'); } catch { app.innerHTML = '<section class="panel"><h2>That share link is broken.</h2><a class="btn" href="#/">Play default</a></section>'; } }
  else if (a === 'play' && b) { const p = load().find(x => x.id === b); p ? play(p, 'saved') : (location.hash = '#/'); }
  else play(DEFAULT, 'default');
}
document.getElementById('helpbtn')?.addEventListener('click', () => {
  showModal(`<p class="kicker">How to play</p><h2 class="htitle">Solve the sentence from the inside out.</h2>
    <ul class="howto"><li>Each <b>[bracketed clue]</b> hides a word or phrase.</li><li>Only the innermost clues can be solved — they're highlighted. Tap one, type the answer, press Enter.</li>
    <li>Solved answers fill in and unlock the clues around them.</li><li>You start with ${START} points: wrong guess −${WRONG}, hint −${HINT}, reveal −${REVEAL}.</li></ul>
    <div class="row"><button class="btn primary" data-m="close">Got it</button></div>`);
  modal.querySelector('[data-m=close]')!.addEventListener('click', closeModal);
});
addEventListener('hashchange', route); route();
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
