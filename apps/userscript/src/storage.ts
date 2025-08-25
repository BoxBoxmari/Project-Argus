export function clearStorage() {
  const keys = GM_listValues?.() ?? Object.keys(localStorage);
  const kill = (k: string) => /^(argus\.progress(\.|$)|progress:|https?:\/\/|.*::partial$|ARGUS_.*)/.test(k);
  
  for (const k of keys) {
    if (kill(k)) {
      try {
        GM_deleteValue ? GM_deleteValue(k) : localStorage.removeItem(k);
      } catch {}
    }
  }
}

export function clearProgress() {
  const keys = GM_listValues?.() ?? Object.keys(localStorage);
  const progressKeys = keys.filter(k => k.startsWith('argus.progress'));
  
  for (const k of progressKeys) {
    try {
      GM_deleteValue ? GM_deleteValue(k) : localStorage.removeItem(k);
    } catch {}
  }
}

export function clearExtractedData() {
  const keys = GM_listValues?.() ?? Object.keys(localStorage);
  const dataKeys = keys.filter(k => 
    k.includes('::partial') || 
    k.startsWith('ARGUS_') ||
    k.includes('reviews') ||
    k.includes('extract')
  );
  
  for (const k of dataKeys) {
    try {
      GM_deleteValue ? GM_deleteValue(k) : localStorage.removeItem(k);
    } catch {}
  }
}

export function getStorageStats() {
  const keys = GM_listValues?.() ?? Object.keys(localStorage);
  const stats = {
    total: keys.length,
    argus: keys.filter(k => k.startsWith('argus.')).length,
    progress: keys.filter(k => k.includes('progress')).length,
    partial: keys.filter(k => k.includes('::partial')).length,
    argus_upper: keys.filter(k => k.startsWith('ARGUS_')).length,
    http: keys.filter(k => k.startsWith('http')).length
  };
  
  return stats;
}
