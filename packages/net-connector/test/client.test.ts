import { createClient } from '../src';
import { NetConnectorSocket } from '@thorium-sim/types';
describe('Net Connector Client', () => {
  it('instantiates with an addEventEmitter-based socket', async () => {
    const closeFn = jest.fn();
    const messageFn = jest.fn();
    let payloadId!: string;
    const sendJest = jest.fn();
    const sendFn = (input: string) => {
      const data: { payloadId: string; type: string } = JSON.parse(input);
      payloadId = data.payloadId;
      sendJest(data as any);
    };
    // let close!: () => void;
    let message!: (data: string) => void;
    let open!: () => void;
    const socket: NetConnectorSocket = {
      onOpen: cb => (open = cb),
      onClose: () => {},
      close: closeFn,
      send: sendFn,
      onMessage: handler => {
        message = data => {
          messageFn(data);
          handler(data as any);
        };
      },
    };
    const client = createClient({
      connectionParams: { testing: 'true' },
      connect: () => socket,
    });
    client.start();
    open();
    message(JSON.stringify({ type: 'connection_ack' }));
    const sendPromise = client.send({ type: 'testing' });
    message(JSON.stringify({ payloadId, type: 'response' }));
    client.destroy();
    expect(await sendPromise).toEqual({ type: 'response' });
    expect(closeFn).toBeCalledWith(2200, 'destroyed');
    expect(closeFn).toBeCalledTimes(1);
    expect(sendJest).toBeCalledWith({
      payload: { testing: 'true' },
      type: 'connection_init',
    });
    expect(sendJest).toBeCalledWith({ payloadId, type: 'testing' });
    expect(sendJest).toBeCalledTimes(2);
    expect(messageFn).toBeCalledTimes(2);
    expect(messageFn).toBeCalledWith(
      JSON.stringify({ type: 'connection_ack' })
    );
    expect(messageFn).toBeCalledWith(
      JSON.stringify({ payloadId, type: 'response' })
    );
  });
});
