export type Node = string | Clue;
export interface Clue { id: number; parts: Node[]; answer: string; depth: number }
export interface Puzzle { id?: string; title: string; source: string; updated?: number }
export class ParseError extends Error { constructor(msg: string, public pos: number) { super(msg); } }

export function parse(src: string): { nodes: Node[]; clues: Clue[] } {
  let i = 0, nextId = 0; const clues: Clue[] = [];
  function seq(inBracket: boolean, depth: number): Node[] {
    const out: Node[] = []; let buf = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '[') { if (buf) out.push(buf); buf = ''; out.push(clue(depth + 1)); continue; }
      if (c === ']') { if (!inBracket) throw new ParseError('Unmatched "]"', i); break; }
      if (c === '|') { if (!inBracket) throw new ParseError('"|" outside of a bracket', i); break; }
      buf += c; i++;
    }
    if (buf) out.push(buf);
    return out;
  }
  function clue(depth: number): Clue {
    const start = i; i++;
    const parts = seq(true, depth);
    if (i >= src.length) throw new ParseError('Unclosed "[" — missing "]"', start);
    if (src[i] === ']') throw new ParseError('Bracket has no answer — add "|answer" before "]"', start);
    i++; let ans = '';
    while (i < src.length && src[i] !== ']') {
      if (src[i] === '[' || src[i] === '|') throw new ParseError('Answers cannot contain "[" or "|"', i);
      ans += src[i++];
    }
    if (i >= src.length) throw new ParseError('Unclosed "[" — missing "]"', start);
    i++;
    const text = parts.map(p => typeof p === 'string' ? p : 'x').join('').trim();
    if (!text) throw new ParseError('Bracket has an empty clue', start);
    if (!ans.trim()) throw new ParseError('Bracket has an empty answer', start);
    const c: Clue = { id: nextId++, parts, answer: ans.trim(), depth }; clues.push(c); return c;
  }
  const nodes = seq(false, 0);
  if (!clues.length) throw new ParseError('Add at least one [clue|answer]', 0);
  return { nodes, clues };
}
export const solution = (nodes: Node[]): string =>
  nodes.map(n => typeof n === 'string' ? n : n.answer).join('').replace(/\s+/g, ' ').trim();
export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export const maxDepth = (cs: Clue[]) => Math.max(0, ...cs.map(c => c.depth));

export const encode = (p: Puzzle) => btoa(unescape(encodeURIComponent(JSON.stringify({ t: p.title, s: p.source })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decode(s: string): Puzzle {
  const j = JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  return { title: String(j.t || 'Shared puzzle'), source: String(j.s) };
}
export const DEFAULT: Puzzle = { id: 'default', title: 'A Summer Trip',
  source: 'Last summer we flew to [city nicknamed the Big [fruit that keeps the [physician, informally|doctor] away|apple]|New York] to see the [monument holding a [source of light|torch] in the harbor|Statue of Liberty], then ate [round Italian dish topped with [melty dairy food|cheese]|pizza] in [Manhattan\'s [middle, or main|central] green space|Central Park].' };
