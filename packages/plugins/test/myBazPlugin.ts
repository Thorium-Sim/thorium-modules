import { createComponent } from '../src';
import { Base } from '../src/pluginArchitecture';

// export const myBazPlugin = (_instance: Base) => {
//   return {
//     components: { identity: createComponent({ description: 'Hello!' }) },
//   };
// };

export const myBazPlugin = () => ({
  components: { identity: createComponent({ description: 'Hello!' }) },
});
