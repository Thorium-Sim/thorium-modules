import { LockstepServer } from '@thorium-sim/lockstep';

import WebSocketServerConnector from '../src/webSocketServerConnector';

import ReducerMachine from './reducerMachine';
import calculatorReducer from './calculatorReducer';

describe('server connector', () => {
  it('should work', async () => {
    let machine = new ReducerMachine(calculatorReducer, []);
    let connector = new WebSocketServerConnector({
      port: 23482,
    });

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
    connector.start({
      name: 'Appppppppppple',
    });

    synchronizer.on('connect', (clientId: number) => {
      console.log(synchronizer.clients[clientId]);
      console.log('Client ' + clientId + ' connected');
    });
    synchronizer.on('disconnect', (clientId: number) => {
      console.log('Client ' + clientId + ' disconnected');
    });
    synchronizer.on('freeze', () => {
      console.log('Synchronizer frozen');
    });
    synchronizer.on('unfreeze', () => {
      console.log('Synchronizer unfrozen');
    });
    synchronizer.on('error', (error: any) => {
      console.log(error);
    });

    synchronizer.start();

    expect(
      JSON.stringify(await synchronizer.netsend({ type: 'number', value: 9 }))
    ).toMatchInlineSnapshot(`"[9]"`);
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot(`"[9]"`);
    expect(synchronizer.rtt).toMatchInlineSnapshot(`0`);
    expect(synchronizer.clientList[0].meta).toMatchInlineSnapshot(`
      Object {
        "name": "Appppppppppple",
      }
    `);
    connector.stop();
  });
});
