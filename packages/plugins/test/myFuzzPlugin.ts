import { createComponent, createInput, DataModel } from '../src';
import { myFooPlugin } from './myFooPlugin';

type Dependencies = typeof myFooPlugin;

export const myFuzzPlugin = () => ({
  components: { thing: createComponent({ thing: true }) },
  serverInputs: {
    doAction: (
      params: { test: string },
      dataModel: DataModel<Dependencies>
    ) => {
      dataModel.flight.ecs.entities[0].components.position;
      return {};
    },
  },
  systems: [],
});
