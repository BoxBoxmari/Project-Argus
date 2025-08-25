import type { Page } from 'playwright';
import { Plugin } from '@argus/js-core';

export function scrollPlugin(pause: number, timeout = 12000): Plugin {
  return {
    name: 'scroll',
    async run({ page }: { page: Page }) {
      await Promise.race([
        page.evaluate(async (delay) => {
          await new Promise<void>(resolve => {
            let total = 0;
            const step = window.innerHeight;
            const timer = setInterval(() => {
              window.scrollBy(0, step);
              total += step;
              if (total >= document.body.scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, delay);
          });
        }, pause),
        page.waitForTimeout(timeout)
      ]);
    }
  };
}
