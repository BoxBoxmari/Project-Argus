// tăng tính mượt bằng pace + jitter
const base = Number(process.env.ARGUS_DELAY_MS ?? 350);
const jitter = Number(process.env.ARGUS_JITTER_MS ?? 200);
export const pace = async () => {
  const wait = base + Math.floor(Math.random() * jitter);
  await new Promise(r => setTimeout(r, wait));
}
export function backoff(attempt: number) {
  const base = Number(process.env.ARGUS_BACKOFF_BASE_MS||500);
  return base * Math.pow(2, Math.max(0, attempt-1));
}
