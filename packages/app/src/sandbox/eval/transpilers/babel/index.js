// @flow
import getBabelConfig from './babel-parser';
import WorkerTranspiler from '../worker-transpiler';
import { type LoaderContext } from '../../transpiled-module';

import delay from '../../../utils/delay';

// Right now this is in a worker, but when we're going to allow custom plugins
// we need to move this out of the worker again, because the config needs
// to support custom plugins
class BabelTranspiler extends WorkerTranspiler {
  worker: Worker;

  constructor() {
    super('babel-loader', null, 2, { hasFS: true });
  }

  async getWorker() {
    while (typeof window.babelworkers === 'undefined') {
      await delay(50); // eslint-disable-line
    }
    // We set these up in startup.js.
    const worker = window.babelworkers.pop();
    return worker;
  }

  doTranspilation(code: string, loaderContext: LoaderContext): Promise<void> {
    return new Promise((resolve, reject) => {
      const path = loaderContext.path;

      let foundConfig = loaderContext.options;
      if (
        loaderContext.options.configurations &&
        loaderContext.options.configurations.babel &&
        loaderContext.options.configurations.babel.parsed
      ) {
        foundConfig = loaderContext.options.configurations.babel.parsed;
      }

      const babelConfig = getBabelConfig(foundConfig, path);

      this.queueTask(
        {
          code,
          config: babelConfig,
          path,
          loaderOptions: loaderContext.options,
          sandboxOptions:
            loaderContext.options.configurations &&
            loaderContext.options.configurations.sandbox &&
            loaderContext.options.configurations.sandbox.parsed,
        },
        loaderContext._module.getId(),
        loaderContext,
        (err, data) => {
          if (err) {
            loaderContext.emitError(err);

            return reject(err);
          }

          return resolve(data);
        }
      );
    });
  }

  async getTranspilerContext() {
    return new Promise(async resolve => {
      const baseConfig = await super.getTranspilerContext();

      this.queueTask(
        {
          type: 'get-babel-context',
        },
        'babelContext',
        {},
        (err, data) => {
          const { version, availablePlugins, availablePresets } = data;

          resolve({
            ...baseConfig,
            babelVersion: version,
            availablePlugins,
            availablePresets,
          });
        }
      );
    });
  }
}

const transpiler = new BabelTranspiler();

export { BabelTranspiler };

export default transpiler;
