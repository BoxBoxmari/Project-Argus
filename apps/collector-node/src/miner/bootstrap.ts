// Tiêm module miner vào window để page.evaluate gọi được
import * as Miner from './reviews';
import * as Selectors from '../core/selectors';
import * as Bus from '../core/bus';

// Expose modules to global window object for page.evaluate
declare global {
  interface Window {
    ArgusMiner: typeof Miner;
    ArgusSelectors: typeof Selectors;
    ArgusBus: typeof Bus;
  }
}

(window as any).ArgusMiner = Miner;
(window as any).ArgusSelectors = Selectors;
(window as any).ArgusBus = Bus;

// Also expose individual functions for convenience
(window as any).runMinerLoop = Miner.runMinerLoop;
(window as any).collectOnce = Miner.collectOnce;
(window as any).ensureOpened = Miner.ensureOpened;
(window as any).injectAntiIdleInPage = Miner.injectAntiIdleInPage;
