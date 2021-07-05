import type { System } from '@thorium-sim/ecs/dist';
import type {
  DataModel,
  GetComponents,
  GetClientModel,
  FlightDataModel,
} from '.';
import type { TestPlugin } from './pluginArchitecture';

export interface PluginPackage {
  name: string;
  version: string;
  main: string;
  author: string;
  dependencies: {
    [packageName: string]: string;
  };
}

interface SystemConstructor<T extends Record<string, Record<string, unknown>>> {
  new (): System<T>;
}
export interface PluginModel<
  Dependencies extends TestPlugin | Record<string, Record<string, any>>
> {
  components: GetComponents<Dependencies>;
  client: GetClientModel<Dependencies>;
  systems: SystemConstructor<any>[];
  flightInputs: Record<
    string,
    (
      input: { params: object; context: object },
      flight: FlightDataModel<Dependencies>
    ) => any
  >;
  serverInputs: Record<
    string,
    (
      input: { params: object; context: object },
      dataModel: DataModel<Dependencies>
    ) => any
  >;
  views: Record<string, string>;
  cards: string[];
}
