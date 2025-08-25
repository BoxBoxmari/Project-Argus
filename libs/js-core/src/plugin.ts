export interface PluginContext {
  [key: string]: any;
}

export interface Plugin {
  name: string;
  init?(ctx: PluginContext): Promise<void> | void;
  run(ctx: PluginContext): Promise<void>;
  teardown?(ctx: PluginContext): Promise<void> | void;
}

export class PluginManager {
  private plugins: Plugin[] = [];

  register(plugin: Plugin) {
    this.plugins.push(plugin);
  }

  async init(ctx: PluginContext) {
    for (const p of this.plugins) {
      if (p.init) await p.init(ctx);
    }
  }

  async run(ctx: PluginContext) {
    for (const p of this.plugins) {
      await p.run(ctx);
    }
  }

  async teardown(ctx: PluginContext) {
    for (const p of this.plugins) {
      if (p.teardown) await p.teardown(ctx);
    }
  }
}
