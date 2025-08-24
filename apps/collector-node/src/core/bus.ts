// progress/data bus giống Userscript (BroadcastChannel + fallback)
export type ProgressMsg = { type: 'progress'; url: string; count: number; ts: number; meta?: any };

const PROG = 'argus:progress';

export function progressEmit(msg: ProgressMsg): void {
  try { 
    new BroadcastChannel(PROG).postMessage(msg); 
  } catch {
    // BroadcastChannel not available
  }
  
  try { 
    localStorage.setItem('ARGUS_MAILBOX', JSON.stringify({
      topic: 'progress', 
      payload: msg, 
      url: (typeof location !== 'undefined') ? location.href : msg.url, 
      ts: Date.now()
    })); 
  } catch {
    // localStorage not available
  }
  
  try { 
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ARGUS:PROGRESS', { detail: msg } as any)); 
    }
  } catch {
    // CustomEvent not available
  }
}

export function progressListen(callback: (msg: ProgressMsg) => void): () => void {
  const cleanup: Array<() => void> = [];
  
  // BroadcastChannel listener
  try {
    const bc = new BroadcastChannel(PROG);
    bc.onmessage = (event) => callback(event.data);
    cleanup.push(() => bc.close());
  } catch {
    // BroadcastChannel not available
  }
  
  // Custom event listener
  try {
    if (typeof window !== 'undefined') {
      const handler = (event: CustomEvent) => callback(event.detail);
      window.addEventListener('ARGUS:PROGRESS', handler as EventListener);
      cleanup.push(() => window.removeEventListener('ARGUS:PROGRESS', handler as EventListener));
    }
  } catch {
    // CustomEvent not available
  }
  
  return () => cleanup.forEach(fn => fn());
}
