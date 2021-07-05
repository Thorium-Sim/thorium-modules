import { ECS } from '@thorium-sim/ecs';
import { TestPlugin } from './pluginArchitecture';
import { Client } from '@thorium-sim/clients';
import { RNG } from '@thorium-sim/rng';
import { StoreObject } from '@thorium-sim/db-fs';
import { PluginModel } from './types';
import { LockstepServer } from '@thorium-sim/lockstep';

type FirstParam<T extends (...param: any[]) => any> = Parameters<T>[0];

type U2I<U> = (U extends U
? (x: U) => 0
: never) extends (x: infer I) => 0
  ? Extract<I, U>
  : never;

export type FlightDataModel<
  T extends TestPlugin | Record<string, Record<string, any>> = DefaultPlugin
> = {
  id: string;
  name: string;
  date: number;
  paused: boolean;
  ecs: ECS<GetComponents<T>>;
  rng: RNG;
  pluginIds: string[];
};
export type ServerDataModel<ClientModel extends object = {}> = {
  clients: Record<string, Client<ClientModel>>;
  thoriumId: string;
  activeFlightName: string | null;
  lockstepServer: LockstepServer;
};

type GetPluginOutput<
  T extends TestPlugin | Record<string, Record<string, any>>
> = U2I<NonNullable<T extends (...args: any) => any ? ReturnType<T> : never>>;

type GetInputs<
  T extends TestPlugin | Record<string, Record<string, any>>
> = (GetPluginOutput<T> extends { serverInputs: object }
  ? GetPluginOutput<T>['serverInputs']
  : GetPluginOutput<T> extends { flightInputs: object }
  ? GetPluginOutput<T>['flightInputs']
  : never) &
  (GetPluginOutput<T> extends { serverInputs: object }
    ? GetPluginOutput<T>['flightInputs']
    : GetPluginOutput<T> extends { flightInputs: object }
    ? GetPluginOutput<T>['serverInputs']
    : never);

export type GetInputNames<
  T extends TestPlugin | Record<string, Record<string, any>>
> = keyof GetInputs<T> extends string ? keyof GetInputs<T> : never;

export type GetInputParams<
  T extends TestPlugin | Record<string, Record<string, any>>,
  Input extends GetInputNames<T>
> = FirstParam<GetInputs<T>[Input]>;

export type GetInputReturn<
  T extends TestPlugin | Record<string, Record<string, any>>,
  Input extends GetInputNames<T>
> = ReturnType<GetInputs<T>[Input]>;

export type GetComponents<
  T extends TestPlugin | Record<string, Record<string, any>>
> = GetPluginOutput<T>['components'];

export type GetClientModel<
  T extends TestPlugin | Record<string, Record<string, any>>
> = GetPluginOutput<T>['client'];

type DefaultPlugin = {
  (): {};
};
export type DataModel<
  T extends TestPlugin | Record<string, Record<string, any>> = DefaultPlugin
> = {
  flight: StoreObject & FlightDataModel<T>;
  server: StoreObject & ServerDataModel<GetClientModel<T>>;
  plugins: PluginModel<T>;
  fireEvent<
    E extends GetInputNames<T>,
    P extends GetInputParams<T, E>,
    R extends GetInputReturn<T, E>,
    C extends Record<string, any>
  >(
    eventName: E,
    params: P,
    context: C
  ): Promise<R>;
};

/**
 * Creates a component definition to be used with the flight's ECS system.
 * If any values and types aren't properly represented on the default values
 * the types should be annotated as a generic type argument.
 * @param defaultValues An object representing the default values of the component.
 * @returns The default values object
 */
export function createComponent<T extends Record<string, unknown>>(
  defaultValues: T
): T {
  return defaultValues;
}

/**
 * Creates an input definition
 * @param action A function representing the action that will be performed when this input
 * is activated. It accepts an arbitrary object and returns an arbitrary object.
 * @returns The action, for use in a plugin definition
 */
export function createInput<
  Dependencies extends TestPlugin | Record<string, Record<string, any>>,
  P extends Record<string, unknown>,
  R extends Record<string, unknown>
>(action: (params: P, dataModel: DataModel<Dependencies>) => R) {
  return action;
}

export * from './activatePlugins';
export * from './types';
