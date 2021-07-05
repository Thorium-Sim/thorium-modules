import { createComponent, createInput, FlightDataModel } from '../src';
import { Base } from '../src/pluginArchitecture';
import type { myFooPlugin } from './myFooPlugin';

type Dependencies = typeof myFooPlugin;

export function myBarPlugin(_instance: Base) {
  const components = {
    position: createComponent({ x: 0, y: 0 }),
  };

  const flightInputs = {
    firePhasers: createInput((params: { phaserId: string }) => {
      console.log(params);
      return { success: true };
    }),
    asyncOperation: async (
      params: { phaserId: string },
      flight: FlightDataModel<typeof components | Dependencies>
    ) => {
      const thing = flight.ecs.entities[0].components.identity.name;
      console.log(params);
      return { success: true };
    },
  };
  return {
    components,
    flightInputs,
  };
}
