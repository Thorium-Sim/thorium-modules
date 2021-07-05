import { NetSendInput, NetSendResult } from '@thorium-sim/types/dist';
import deepmerge from 'deepmerge';
import { PluginPackage } from '.';

type Options = {
  [key: string]: unknown;
};

export type InputDefinition<
  Params extends NetSendInput,
  Result extends NetSendResult,
  DataModel
> = (params: Params, model: DataModel) => Result | Promise<Result>;

export type ApiExtension = {
  [key: string]: unknown;
};

export type TestPlugin = {
  (instance: Base & any, options: Options): ApiExtension;
  transformPlugin?: (
    plugin: ApiExtension,
    context: { metadata?: PluginPackage; folder?: string }
  ) => Promise<ApiExtension>;
  pluginMetadata?: PluginPackage;
  pluginFolder?: string;
};
type Constructor<T> = new (...args: any[]) => T;

/**
 * @author https://stackoverflow.com/users/2887218/jcalz
 * @see https://stackoverflow.com/a/50375286/10325032
 */
export type UnionToIntersection<Union> = (Union extends any
? (argument: Union) => void
: never) extends (argument: infer Intersection) => void // tslint:disable-line: no-unused
  ? Intersection
  : never;

type AnyFunction = (...args: any) => any;

type ReturnTypeOf<T extends AnyFunction | AnyFunction[]> = T extends AnyFunction
  ? ReturnType<T>
  : T extends AnyFunction[]
  ? UnionToIntersection<ReturnType<T[number]>>
  : never;

export class Base<TOptions extends Options = Options> {
  static plugins: TestPlugin[] = [];
  static plugin<
    S extends Constructor<any> & { plugins: any[] },
    T extends TestPlugin[]
  >(this: S, ...additionalPlugins: T) {
    const currentPlugins = this.plugins;
    let newPlugins: TestPlugin[] = [...additionalPlugins].filter(Boolean);

    const BaseWithPlugins = class extends this {
      static plugins = currentPlugins.concat(
        newPlugins.filter(plugin => !currentPlugins.includes(plugin))
      );
    };

    return BaseWithPlugins as typeof this & { plugins: any[] } & Constructor<
        UnionToIntersection<ReturnTypeOf<T>>
      >;
  }

  static defaults<
    TDefaults extends Options,
    S extends Constructor<Base<TDefaults>>
  >(this: S, defaults: TDefaults) {
    const BaseWitDefaults = class extends this {
      constructor(...args: any[]) {
        super(Object.assign({}, defaults, args[0] || {}));
      }
    };

    return BaseWitDefaults as typeof BaseWitDefaults & typeof this;
  }

  constructor(options: TOptions = {} as TOptions) {
    this.options = options;
  }
  async applyPlugins() {
    // apply plugins
    // https://stackoverflow.com/a/16345172
    const classConstructor = this.constructor as typeof Base;
    await Promise.all(
      classConstructor.plugins.map(async plugin => {
        let pluginResult = plugin(this, this.options);
        if (plugin.transformPlugin) {
          pluginResult = await plugin.transformPlugin(pluginResult, {
            folder: plugin.pluginFolder,
            metadata: plugin.pluginMetadata,
          });
        }
        if (pluginResult) {
          Object.assign(this, deepmerge(this, pluginResult));
        }
      })
    );
  }
  options: TOptions;
}
