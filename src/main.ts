import './style.css';
import { parse, solution, norm, DEFAULT, type Node, type Clue, type Puzzle } from './parser';

const app = document.getElementById('app')!, modal = document.getElementById('modal')!;
const START = 100, WRONG = 2, HINT = 5, REVEAL = 15;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function toast(msg: string) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy this:', text); }
}
function showModal(html: string) { modal.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`; modal.classList.remove('hidden'); (modal.querySelector('button,a') as HTMLElement | null)?.focus(); }
const closeModal = () => modal.classList.add('hidden');
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

/* ---------------- PLAY ---------------- */
let cleanupPlay: (() => void) | null = null;
function play(p: Puzzle) {
  cleanupPlay?.(); cleanupPlay = null; closeModal();
  let parsed; try { parsed = parse(p.source); } catch (e) { app.innerHTML = `<section class="panel"><h2>Broken puzzle</h2><p>${esc((e as Error).message)}</p></section>`; return; }
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
    <div class="actions"><button class="btn ghost sm" data-a="restart">Start over</button></div>
  </section>
  <div class="dock"><div class="hintpop hidden" role="dialog" aria-modal="false" aria-labelledby="hp-q"><p class="hp-q" id="hp-q"></p><div class="hp-opts"><button type="button" class="btn primary" data-a="hint">Use a hint <small>−${HINT}</small></button><button type="button" class="btn" data-a="reveal">Reveal answer <small>−${REVEAL}</small></button><button type="button" class="btn ghost" data-a="cancel">Not now</button></div></div><form class="answerbar" autocomplete="off"><input class="ans" type="text" enterkeyhint="go" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type an answer…" aria-label="Answer"><button class="btn primary" type="submit">Go</button></form></div>`;
  const sentence = app.querySelector('.sentence') as HTMLElement, input = app.querySelector('.ans') as HTMLInputElement, bar = app.querySelector('.answerbar') as HTMLElement, dock = app.querySelector('.dock') as HTMLElement;
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
      <div class="row"><button class="btn primary" data-m="share">Share result</button><button class="btn ghost" data-m="close">Close</button></div>`);
    modal.querySelector('[data-m=close]')!.addEventListener('click', closeModal);
    modal.querySelector('[data-m=share]')!.addEventListener('click', () => {
      const text = `Bracket Town — ${p.title}\nScore ${Math.max(score, 0)}/${START} · ${rank}\n${location.href.split('#')[0]}`;
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
  const vv = window.visualViewport;
  const pop = app.querySelector('.hintpop') as HTMLElement; let popFor = -1;
  const closePop = () => { pop.classList.add('hidden'); popFor = -1; };
  function openPop(b: HTMLElement) {
    const c = clues[sel]; if (!c || done) return; popFor = c.id;
    const h = hinted.get(c.id) || 0, more = h < c.answer.length - 1;
    pop.querySelector('.hp-q')!.textContent = more ? `Stuck on this one? A hint shows letter ${h + 1} of ${c.answer.length}.` : 'Only the full answer is left to reveal.';
    (pop.querySelector('[data-a=hint]') as HTMLButtonElement).hidden = !more;
    pop.classList.remove('hidden');
    if (innerWidth >= 560) {
      const r = b.getBoundingClientRect(), w = pop.offsetWidth, ph = pop.offsetHeight;
      let top = r.bottom + 8; if (top + ph > (vv?.height ?? innerHeight) - 90) top = Math.max(8, r.top - ph - 8);
      const d = dock.getBoundingClientRect();
      pop.style.left = `${-d.left + Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`; pop.style.top = `${top - d.top}px`;
    } else { pop.style.left = ''; pop.style.top = ''; }
    (pop.querySelector('button:not([hidden])') as HTMLElement).focus({ preventScroll: true });
  }
  sentence.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('.clue.active') as HTMLElement | null; if (!b) return;
    const id = +b.dataset.id!;
    if (id === sel) { render(); openPop(sentence.querySelector(`[data-id="${id}"]`) as HTMLElement); }
    else { closePop(); sel = id; render(); input.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', e => { if (popFor < 0) return; const t = e.target as HTMLElement; if (!pop.contains(t) && !t.closest('.clue.active.sel')) closePop(); }, true);
  const onAct = (e: Event) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a'); const c = clues[popFor >= 0 ? popFor : sel];
    if (a === 'hint' && c && !done) { const h = hinted.get(c.id) || 0; if (h < c.answer.length - 1) { hinted.set(c.id, h + 1); score -= HINT; } sel = c.id; closePop(); render(); }
    if (a === 'reveal' && c && !done) { closePop(); score -= REVEAL; solve(c, 'reveal'); }
    if (a === 'cancel') closePop();
    if (a === 'restart' && confirm('Start this puzzle over? Your progress and score will be reset.')) play(p);
  };
  app.querySelector('.actions')!.addEventListener('click', onAct); pop.addEventListener('click', onAct);
  const onKey = (e: KeyboardEvent) => {
    if (popFor >= 0 && e.key === 'Escape') { closePop(); return; }
    if (!modal.classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
    if ((e.key === 'Tab' && document.activeElement === input) || (e.altKey && /Arrow(Left|Right)/.test(e.key))) {
      const act = active(); if (!act.length) return; e.preventDefault();
      const i = act.findIndex(c => c.id === sel); const d = e.shiftKey || e.key === 'ArrowLeft' ? -1 : 1;
      sel = act[(i + d + act.length) % act.length].id; render();
    }
  };
  document.addEventListener('keydown', onKey);
  // keep the answer bar above the iOS keyboard
  const place = () => { if (!vv) return; const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); dock.style.transform = `translateY(${-off}px)`; if (popFor >= 0) closePop(); };
  vv?.addEventListener('resize', place); vv?.addEventListener('scroll', place);
  cleanupPlay = () => { document.removeEventListener('keydown', onKey); vv?.removeEventListener('resize', place); vv?.removeEventListener('scroll', place); };
  render();
  if (matchMedia('(pointer:fine)').matches) input.focus();
}

document.getElementById('helpbtn')?.addEventListener('click', () => {
  showModal(`<p class="kicker">How to play</p><h2 class="htitle">Solve the sentence from the inside out.</h2>
    <ul class="howto"><li>Each <b>[bracketed clue]</b> hides a word or phrase.</li><li>Only the innermost clues can be solved — they're highlighted. Tap one, type the answer, press Enter.</li>
    <li>Solved answers fill in and unlock the clues around them.</li><li>Stuck? Tap the highlighted clue again to ask for help: <b>Use a hint</b> shows its next letter, <b>Reveal answer</b> fills it in. Tap outside to back out for free.</li><li>You start with ${START} points: wrong guess −${WRONG}, hint −${HINT}, reveal −${REVEAL}.</li></ul>
    <div class="row"><button class="btn primary" data-m="close">Got it</button></div>`);
  modal.querySelector('[data-m=close]')!.addEventListener('click', closeModal);
});
const themeBtn = document.getElementById('themebtn');
const applyTheme = (t: string | null) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(localStorage.getItem('bt-theme'));
themeBtn?.addEventListener('click', () => {
  const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const t = dark ? 'light' : 'dark'; localStorage.setItem('bt-theme', t); applyTheme(t); toast(t === 'dark' ? 'Night ink on' : 'Daylight paper on');
});
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
play(DEFAULT);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
