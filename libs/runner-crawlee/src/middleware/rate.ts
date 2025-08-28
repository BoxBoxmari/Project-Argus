export async function pace() {
  const base = Number(process.env.ARGUS_DELAY_MS||400);
  const jitter = Number(process.env.ARGUS_JITTER_MS||250);
  const wait = base + Math.floor(Math.random()*jitter);
  await new Promise(r=>setTimeout(r, wait));
}
export function backoff(attempt: number) {
  const base = Number(process.env.ARGUS_BACKOFF_BASE_MS||500);
  return base * Math.pow(2, Math.max(0, attempt-1));
}
