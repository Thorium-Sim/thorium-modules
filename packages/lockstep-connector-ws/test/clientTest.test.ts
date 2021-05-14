import { LockstepClient } from '@thorium-sim/lockstep';
import { LockstepServer } from '@thorium-sim/lockstep';

import WebSocketServerConnector from '../src/webSocketServerConnector';

import DelayClientConnector from './delayClientConnector';

import ReducerMachine from './reducerMachine';
import calculatorReducer from './calculatorReducer';

describe.skip('WebsocketClientConnector', () => {
  it('should work', async () => {
    function createServer() {
      let machine = new ReducerMachine(calculatorReducer, []);
      let connector = new WebSocketServerConnector({
        port: 23482,
      });

      let synchronizer = new LockstepServer(machine, connector, {
        dynamic: true,
        dynamicPushWait: 10,
        dynamicTickWait: 10,
        fixedTick: 10,
        fixedBuffer: 0,
        disconnectWait: 100,
        freezeWait: 20,
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
      return connector;
    }
    const server = createServer();
    let machine = new ReducerMachine(calculatorReducer, []);
    let connector = new DelayClientConnector('ws://localhost:23482');

    let synchronizer = new LockstepClient(machine, connector);
    connector.synchronizer = synchronizer;
    connector.start({
      name: 'Bananananananana',
    });

    synchronizer.on('connect', () => {
      console.log('Connected!');
    });
    synchronizer.on('disconnect', () => {
      console.log('Disconnected!');
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

    console.log('Running this stuff');
    console.log(
      'Netsend stuff',
      await synchronizer.netsend({ type: 'number', value: 9 })
    );
    expect(
      JSON.stringify(await synchronizer.netsend({ type: 'number', value: 9 }))
    ).toMatchInlineSnapshot();
    expect(JSON.stringify(machine.getState())).toMatchInlineSnapshot();
    expect(synchronizer.rtt).toMatchInlineSnapshot();
    expect(synchronizer.meta).toMatchInlineSnapshot();

    connector.disconnect();
    server.stop();
  });
});
