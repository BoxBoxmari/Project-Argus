const NS = 'argus.progress.';
export type Progress = { links:{ discovered:number; done:number }; errors:number };
const zero:Progress = { links:{discovered:0, done:0}, errors:0 };

export function load():Progress{
  try { return JSON.parse(localStorage.getItem(NS+'state')||'') as Progress; } catch { return structuredClone(zero); }
}
export function save(p:Progress){ localStorage.setItem(NS+'state', JSON.stringify(p)); }
export function reset(){ save(structuredClone(zero)); } // không cộng dồn khi import payload
