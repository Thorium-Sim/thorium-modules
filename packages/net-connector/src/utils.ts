/**
 *
 * utils
 *
 */

// Extremely small optimisation, reduces runtime prototype traversal
const baseHasOwnProperty = Object.prototype.hasOwnProperty;

/** @private */
export function isObject(val: unknown): val is Record<PropertyKey, unknown> {
  return typeof val === 'object' && val !== null;
}

/** @private */
export function areErrors(obj: unknown): obj is readonly Error[] {
  return (
    Array.isArray(obj) &&
    // must be at least one error
    obj.length > 0 &&
    // error has at least a message
    obj.every(ob => 'message' in ob)
  );
}

/** @private */
export function hasOwnProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, unknown> {
  return baseHasOwnProperty.call(obj, prop);
}

/** @private */
export function hasOwnStringProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, string> {
  return baseHasOwnProperty.call(obj, prop) && typeof obj[prop] === 'string';
}

export function randomizedExponentialBackOffTime(retries: number) {
  let retryDelay = 1000; // start with 1s delay
  for (let i = 0; i < retries; i++) {
    retryDelay *= 2;
  }
  return (
    retryDelay +
    // add random timeout from 300ms to 1s
    Math.floor(Math.random() * (1000 - 300) + 300)
  );
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ServerSocket {
  /**
   * The sub=protocol of the WebSocket. Will be used
   * to validate against the supported ones.
   */
  readonly protocol: string;
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
  close(code: number, reason: string): Promise<void> | void;
  /**
   * Called when message is received. The library requires the data
   * to be a `string`.
   *
   * Exceptions raised during any phase of operation processing will
   * reject the callback's promise, catch them and communicate them
   * to your clients however you wish.
   */
  onMessage(cb: (data: string) => Promise<void>): void;
}

interface ClientSocket {
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
  close(code: number, reason: string): Promise<void> | void;
}
export interface ClientWebSocket extends ClientSocket {
  addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

}

export interface ClientEmitterSocket extends ClientSocket {
  on(event: string, listener: EventListenerOrEventListenerObject): () => void;
}

