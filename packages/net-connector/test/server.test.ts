import { NetConnectorSocket } from '@thorium-sim/types';
import { MessageType } from '../src/common';
import { makeServer } from '../src/netConnectorServer';

describe('Net Connector Server', () => {
  it('instantiates', async () => {
    const executeFunction = jest.fn();
    const server = makeServer({
      context: { testContext: true },
      execute: async props => {
        await executeFunction(props);
        return { type: 'response' };
      },
    });
    const sendFunction = jest.fn();
    const closeFunction = jest.fn();
    async function onMessage(onMessageFunction: (data: string) => void) {
      onMessageFunction(JSON.stringify({ type: MessageType.ConnectionInit }));
      await new Promise(res => setTimeout(res, 100));
      onMessageFunction(JSON.stringify({ type: 'Testing' }));
    }
    const socket: NetConnectorSocket = {
      onOpen: () => {},
      onClose: () => {},
      send: sendFunction,
      close: closeFunction,
      onMessage,
    };
    const close = server.opened(socket, {});

    await new Promise(res => setTimeout(res, 1000));
    await close(2200, 'complete');
    expect(closeFunction).toHaveBeenCalledTimes(1);
    expect(closeFunction).toHaveBeenCalledWith(2200, 'complete');
    expect(sendFunction).toHaveBeenCalledTimes(2);
    expect(sendFunction).toHaveBeenCalledWith('{"type":"connection_ack"}');
    expect(sendFunction).toHaveBeenCalledWith('{"type":"response"}');
    expect(executeFunction).toHaveBeenCalledWith({
      context: { testContext: true },
      type: 'Testing',
    });
    expect(executeFunction).toHaveBeenCalledTimes(1);
  });
});
