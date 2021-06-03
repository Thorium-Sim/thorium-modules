import { createClient } from '../src';
import { ClientEmitterSocket, ClientWebSocket } from '../src/utils';
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
    let message!: ({ data }: { data: string }) => void;
    let open!: () => void;
    const socket: ClientWebSocket = {
      close: closeFn,
      send: sendFn,
      addEventListener: (event: string, handler: EventListener) => {
        if (event === 'open') open = handler as any;
        // if (event === 'close') close = handler as any;
        if (event === 'message')
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
    message({ data: JSON.stringify({ type: 'connection_ack' }) });
    const sendPromise = client.send({ type: 'testing' });
    message({ data: JSON.stringify({ payloadId, type: 'response' }) });
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
    expect(messageFn).toBeCalledWith({
      data: JSON.stringify({ type: 'connection_ack' }),
    });
    expect(messageFn).toBeCalledWith({
      data: JSON.stringify({ payloadId, type: 'response' }),
    });
  });
  it('instantiates with an on-based socket', async () => {
    // const client = createClient({ })

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
    let message!: (data: any) => void;
    let open!: () => void;
    const socket: ClientEmitterSocket = {
      close: closeFn,
      send: sendFn,
      on: (event: string, handler: any) => {
        if (event === 'open') open = handler as any;
        if (event === 'message')
          message = data => {
            messageFn(data);
            handler(data as any);
          };
        return () => {};
      },
    };
    const client = createClient({
      connectionParams: { testing: 'true' },
      connect: () => socket,
    });
    client.start();
    open();
    message({ type: 'connection_ack' });
    const sendPromise = client.send({ type: 'testing' });
    message({ payloadId, type: 'response' });
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
    expect(messageFn).toBeCalledWith({
      type: 'connection_ack',
    });
    expect(messageFn).toBeCalledWith({
      payloadId,
      type: 'response',
    });
  });
});
