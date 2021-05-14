import LockstepServer from '../src/LockstepServer';

import LocalConnectorServer from './localConnectorServer';

import ReducerMachine from './reducerMachine';
import calculatorReducer from './calculatorReducer';

describe('LockstepServer', () => {
  it('should initialize and operate correctly', async () => {
    let machine = new ReducerMachine(calculatorReducer, []);
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[]"`);
    machine.run({ type: 'number', value: 5 });
    machine.run({ type: 'number', value: 4 });
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[5,4]"`);
    machine.run({ type: '+' });
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[9]"`);
    let connector = new LocalConnectorServer();

    let synchronizer = new LockstepServer(machine, connector, {
      dynamic: true,
      dynamicPushWait: 100,
      dynamicTickWait: 100,
      fixedTick: 1000,
      fixedBuffer: 0,
      disconnectWait: 10000,
      freezeWait: 2000,
    });
    connector.synchronizer = synchronizer;
    synchronizer.actionHandler = (action, client) => {
      if (typeof action === 'object') {
        return Object.assign({}, action, {
          clientId: client.id,
        });
      }
      return action;
    };

    synchronizer.start();

    await synchronizer.netsend({ type: 'number', value: 3 });
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[9,3]"`);
    await synchronizer.netsend({ type: 'number', value: 4 });
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(
      `"[9,3,4]"`
    );
    await synchronizer.netsend({
      type: '*',
    });

    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(
      `"[9,12]"`
    );
    await synchronizer.netsend({
      type: '+',
    });
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[21]"`);
  });
});
