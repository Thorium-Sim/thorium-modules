export interface NetConnectorSocket {
  /**
   * Sends a message through the socket. Will always
   * provide a `string` message.
   *
   * Please take care that the send is ready. Meaning,
   * only provide a truly OPEN socket through the `opened`
   * method of the `Server`.
   *
   * The returned promise is used to control the flow of data
   * (like handling back pressure).
   */
  send(data: string): Promise<void> | void;
  /**
   * Closes the socket gracefully. Will always provide
   * the appropriate code and close reason. `onDisconnect`
   * callback will be called.
   *
   * The returned promise is used to control the graceful
   * closure.
   */
  close(code?: number, reason?: string): Promise<void> | void;
  /**
   * Called when message is received. The library requires the data
   * to be a `string`.
   *
   * Exceptions raised during any phase of operation processing will
   * reject the callback's promise, catch them and communicate them
   * to your clients however you wish.
   */
  onMessage(cb: (data: string) => Promise<void> | void): void;
  /**
   * Called when the connection is opened.
   *
   * Exceptions raised during any phase of operation processing will
   * reject the callback's promise, catch them and communicate them
   * to your clients however you wish.
   */
  onOpen: (cb: () => Promise<void> | void) => void;
  /**
   * Called when the connection is closed.
   *
   * Exceptions raised during any phase of operation processing will
   * reject the callback's promise, catch them and communicate them
   * to your clients however you wish.
   */
  onClose: (cb: () => Promise<void> | void) => void;
}

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
export type EventMessageListener = (message: object) => void;

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

export interface NetConnector {
  send(data: object): Promise<object> | void;
  on<E extends Event>(event: E, listener: EventListener<E>): () => void;
  destroy: (code?: number, reason?: string) => void;
}
