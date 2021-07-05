import { Event, LockstepClientConfig, LockstepServer } from './types';

type Send = (data: string) => void | Promise<void>;
export function createLockstepServer({
  handleEvent,
}: {
  handleEvent: (
    type: string,
    params: Record<string, any>,
    context: Record<string, any>
  ) => Promise<Record<string, any>>;
}): LockstepServer {
  const gameStateHandlers: Function[] = [];
  const clientSockets: { send: Send; rtt: number }[] = [];
  let queuedEvents: { event: Event; resolve: Function }[] = [];

  function connect(socketSend: Send) {
    const clientObj = { send: socketSend, rtt: 0 };
    clientSockets.push(clientObj);

    const gameState = gameStateHandlers.reduce((prev, handler) => {
      return Object.assign(prev, handler());
    }, {});
    socketSend(JSON.stringify({ type: 'lockstepConnect', gameState }));
  }

  async function queueEvent(event: Event) {
    const promise = new Promise<object>((resolve) => {
      queuedEvents.push({ event, resolve });
    });
    return promise;
  }
  function onGetGameState(handler: () => object & LockstepClientConfig) {
    gameStateHandlers.push(handler);
  }

  async function tick(tickId: number) {
    const eventMessage = JSON.stringify({
      type: 'lockstepTick',
      tickId,
      events: queuedEvents.concat(),
    });
    clientSockets.forEach((socket) => {
      socket.send(eventMessage);
    });
    // Execute the machine by running all of our event handlers
    await Promise.allSettled(
      queuedEvents.map(async (event) => {
        const { type, context, ...params } = event.event;
        const result = await handleEvent(type, params, context);
        event.resolve(result);
      })
    );
  }
  return {
    queueEvent,
    connect,
    onGetGameState,
    tick,
  };
}
