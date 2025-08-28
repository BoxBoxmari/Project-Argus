export function logEvent(type:string, payload:any){
  try {
    console.debug(`[Argus][${type}]`, payload);
  } catch {}
}
