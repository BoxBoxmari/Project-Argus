export function clearAll(){
  const keys = [];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i)!;
    if (k.startsWith('argus.') || k.startsWith('http') || k.includes('::partial')) keys.push(k);
  }
  for(const k of keys) localStorage.removeItem(k);
}
