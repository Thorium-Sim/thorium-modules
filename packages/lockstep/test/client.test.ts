import ReducerMachine from './reducerMachine';
import calculatorReducer from './calculatorReducer';
import LocalConnectorServer from './localConnectorServer';
import LockstepServer from '../src/LockstepServer';
import LocalConnectorClient from './localConnectorClient';
import LockstepClient from '../src/LockstepClient';
import { ActionConstraint, StateConstraint } from '../../types/dist';

describe('LockstepClient', () => {
  it('should initialize and operate correctly', async () => {
    function createServer() {
      let machine = new ReducerMachine(calculatorReducer, []);
      let connector = new LocalConnectorServer();

      let synchronizer = new LockstepServer(machine, connector, {
        dynamic: false,
        dynamicPushWait: 100,
        dynamicTickWait: 100,
        fixedTick: 100,
        fixedBuffer: 0,
        disconnectWait: 10000,
        freezeWait: 2000,
      });
      connector.synchronizer = synchronizer;
      synchronizer.start();
      return synchronizer;
    }

    function createClient<
      S extends StateConstraint,
      A extends ActionConstraint
    >(server: ReturnType<typeof createServer>['connector']) {
      let machine = new ReducerMachine(calculatorReducer, []);
      let connector = new LocalConnectorClient(
        server as LocalConnectorServer<S, A>,
        100
      );
      // @ts-ignore
      let synchronizer = new LockstepClient(machine, connector);
      // @ts-ignore
      connector.setSynchronizer(synchronizer);
      return synchronizer;
    }

    let server = createServer();
    let clients: LockstepClient<any, any>[] = [];
    for (let i = 0; i < 3; ++i) {
      let client = createClient(server.connector);
      clients.push(client);
      client.connector.connect({
        state: [],
        tickId: 0,
        config: server.config,
        id: client.connector.getClientId(),
        meta: {},
      });
    }
    expect(JSON.stringify(server.machine.getState())).toMatchInlineSnapshot(
      `"[]"`
    );
    await server.netsend({ type: 'number', value: 3 });
    expect(JSON.stringify(server.machine.getState())).toMatchInlineSnapshot(
      `"[3]"`
    );
    await server.netsend({ type: 'number', value: 3 });
    await server.netsend({ type: '*' });
    expect(JSON.stringify(server.machine.getState())).toMatchInlineSnapshot(
      `"[9]"`
    );

    let k = 10;
    for (let i = clients.length - 1; i >= 0; --i) {
      await clients[i].netsend({ type: 'number', value: k++ });
      await clients[i].netsend({ type: 'number', value: k++ });
      await clients[i].netsend({ type: '+' });
      await clients[i].netsend({ type: '+' });
    }
    expect(JSON.stringify(server.machine.getState())).toMatchInlineSnapshot(
      `"[84]"`
    );
  }, 10000);
});
