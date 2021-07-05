import { Base, TestPlugin } from '../src/pluginArchitecture';
import { myBarPlugin } from './myBarPlugin';
import { myBazPlugin } from './myBazPlugin';
import { myFooPlugin } from './myFooPlugin';
import { myFuzzPlugin } from './myFuzzPlugin';

describe('plugins', () => {
  it('correctly creates a plugin', () => {
    const plugins = [myFooPlugin, myBazPlugin, myBarPlugin, myFuzzPlugin];
    const FooTest = Base.plugin(...plugins);
    const fooTest = new FooTest();
    expect(fooTest.components.identity.name).toMatchInlineSnapshot(`"Test"`);
    expect(fooTest.components.identity.description).toMatchInlineSnapshot(
      `"Hello!"`
    );
    fooTest.flightInputs.firePhasers;
    fooTest.flightInputs.asyncOperation;

    const result = fooTest.serverInputs.doAction({ test: 'hello!' }, {} as any);
  });
});
