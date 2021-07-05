import { createComponent, GetComponents } from '../src';
import { Base } from '../src/pluginArchitecture';
export const myFooPlugin = (_instance: Base) => {
  return {
    components: {
      identity: createComponent<{ name: string }>({ name: 'Test' }),
      position: createComponent({
        x: 0,
        y: 0,
        z: 0,
      }),
    },
  };
};

type comps = GetComponents<typeof myFooPlugin>;

type blah = comps['identity'];
