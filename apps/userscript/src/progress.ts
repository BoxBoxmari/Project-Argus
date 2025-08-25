const NS = 'argus.progress.';
export type Progress = { 
  links: { discovered: number; done: number }; 
  errors: number;
  last_update: string;
};

const zero: Progress = { 
  links: { discovered: 0, done: 0 }, 
  errors: 0,
  last_update: new Date().toISOString()
};

export function load(): Progress {
  try { 
    return JSON.parse(localStorage.getItem(NS + 'state') || '') as Progress; 
  } catch { 
    return structuredClone(zero); 
  }
}

export function save(p: Progress) { 
  p.last_update = new Date().toISOString();
  localStorage.setItem(NS + 'state', JSON.stringify(p)); 
}

export function reset() { 
  save(structuredClone(zero)); 
}

// Fix: Only increment discovered when actually discovering new links, not when reading payloads
export function incrementDiscovered(count: number = 1) {
  const p = load();
  p.links.discovered += count;
  save(p);
}

export function incrementDone(count: number = 1) {
  const p = load();
  p.links.done += count;
  save(p);
}

export function incrementErrors(count: number = 1) {
  const p = load();
  p.errors += count;
  save(p);
}

// Get progress without modifying it
export function getProgress(): Progress {
  return load();
}
