import { Message } from './common';

export type EventConnecting = 'connecting';
export type EventReconnecting = 'reconnecting';

export type EventConnected = 'connected'; // connected = socket opened + acknowledged

export type EventMessage = 'message';

export type EventClosed = 'closed';

export type EventError = 'error';

export type Event =
  | EventConnecting
  | EventConnected
  | EventReconnecting
  | EventMessage
  | EventClosed
  | EventError;

/**
 * The first argument is actually the `WebSocket`, but to avoid
 * bundling DOM typings because the client can run in Node env too,
 * you should assert the websocket type during implementation.
 *
 * Also, the second argument is the optional payload that the server may
 * send through the `ConnectionAck` message.
 *
 * @category Client
 */
export type EventConnectedListener = (
  socket: unknown,
  payload?: Record<string, unknown>
) => void;

/** @category Client */
export type EventConnectingListener = () => void;
export type EventReconnectingListener = () => void;

/**
 * Called for all **valid** messages received by the client. Mainly useful for
 * debugging and logging received messages.
 *
 * @category Client
 */
export type EventMessageListener = (message: Message) => void;

/**
 * The argument is actually the websocket `CloseEvent`, but to avoid
 * bundling DOM typings because the client can run in Node env too,
 * you should assert the websocket type during implementation.
 *
 * @category Client
 */
export type EventClosedListener = (event: unknown) => void;

/**
 * The argument can be either an Error Event or an instance of Error, but to avoid
 * bundling DOM typings because the client can run in Node env too, you should assert
 * the type during implementation. Events dispatched from the WebSocket `onerror` can
 * be handler in this listener.
 *
 * @category Client
 */
export type EventErrorListener = (error: unknown) => void;

/** @category Client */
export type EventListener<E extends Event> = E extends EventConnecting
  ? EventConnectingListener
  : E extends EventConnected
  ? EventConnectedListener
  : E extends EventMessage
  ? EventMessageListener
  : E extends EventClosed
  ? EventClosedListener
  : E extends EventError
  ? EventErrorListener
  : E extends EventReconnecting
  ? EventReconnectingListener
  : never;

export function createEmitter(
  on?: Partial<{ [event in Event]: EventListener<event> }>
) {
  const message = (() => {
    const listeners: { [key: string]: EventMessageListener } = {};
    return {
      on(id: string, listener: EventMessageListener) {
        listeners[id] = listener;
        return () => {
          delete listeners[id];
        };
      },
      emit(message: Message) {
        if ('id' in message) listeners[message.id]?.(message);
      },
    };
  })();
  const listeners: { [event in Event]: EventListener<event>[] } = {
    connecting: on?.connecting ? [on.connecting] : [],
    connected: on?.connected ? [on.connected] : [],
    message: on?.message ? [message.emit, on.message] : [message.emit],
    closed: on?.closed ? [on.closed] : [],
    error: on?.error ? [on.error] : [],
    reconnecting: on?.reconnecting ? [on.reconnecting] : [],
  };

  return {
    onMessage: message.on,
    on<E extends Event>(event: E, listener: EventListener<E>) {
      const l = listeners[event] as EventListener<E>[];
      l.push(listener);
      return () => {
        l.splice(l.indexOf(listener), 1);
      };
    },
    emit<E extends Event>(event: E, ...args: Parameters<EventListener<E>>) {
      for (const listener of listeners[event]) {
        // @ts-expect-error: The args should fit
        listener(...args);
      }
    },
  };
}
