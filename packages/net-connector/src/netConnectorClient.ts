import {
  JSONMessageReplacer,
  JSONMessageReviver,
  MessageType,
  parseMessage,
  SendMessage,
  stringifyMessage,
} from './common';
import { createEmitter } from './emitter';
import {
  ClientEmitterSocket,
  ClientWebSocket,
  generateUUID,
  isObject,
  randomizedExponentialBackOffTime,
} from './utils';

export interface ClientOptions {
  connect: () => ClientWebSocket | ClientEmitterSocket;
  /**
   * Optional parameters, passed through the `payload` field with the `ConnectionInit` message,
   * that the client specifies when establishing a connection with the server. You can use this
   * for securely passing arguments for authentication.
   *
   * If you decide to return a promise, keep in mind that the server might kick you off if it
   * takes too long to resolve! Check the `connectionInitWaitTimeout` on the server for more info.
   *
   * Throwing an error from within this function will close the socket with the `Error` message
   * in the close event reason.
   */
  connectionParams?:
    | Record<string, unknown>
    | (() => Promise<Record<string, unknown>> | Record<string, unknown>);
  /**
   * How many times should the client try to reconnect on abnormal socket closure before it errors out?
   *
   * The library classifies the following close events as fatal:
   * - `1002: Protocol Error`
   * - `1011: Internal Error`
   * - `4400: Bad Request`
   * - `4401: Unauthorized` _tried subscribing before connect ack_
   * - `4409: Subscriber for <id> already exists` _distinction is very important_
   * - `4429: Too many initialization requests`
   *
   * These events are reported immediately and the client will not reconnect.
   *
   * @default 5
   */
  retryAttempts?: number;
  /**
   * Control the wait time between retries. You may implement your own strategy
   * by timing the resolution of the returned promise with the retries count.
   * `retries` argument counts actual connection attempts, so it will begin with
   * 0 after the first retry-able disconnect.
   *
   * @default Randomized exponential back-off
   */
  retryWait?: (retries: number) => number;
  /**
   * A custom ID generator for identifying subscriptions.
   *
   * The default generates a v4 UUID to be used as the ID using `Math`
   * as the random number generator. Supply your own generator
   * in case you need more uniqueness.
   *
   * Reference: https://gist.github.com/jed/982883
   */
  generateID?: () => string;
  /**
   * An optional override for the JSON.parse function used to hydrate
   * incoming messages to this client. Useful for parsing custom data types
   * out of the incoming JSON.
   */
  jsonMessageReviver?: JSONMessageReviver;
  /**
   * An optional override for the JSON.stringify function used to serialize
   * outgoing messages from this client. Useful for serializing custom
   * data types out to the client.
   */
  jsonMessageReplacer?: JSONMessageReplacer;
  reconnect?: () => void;
}

/** Minimal close event interface required by the lib for error and socket close handling. */
interface LikeCloseEvent {
  /** Returns the WebSocket connection close code provided by the server. */
  readonly code: number;
  /** Returns the WebSocket connection close reason provided by the server. */
  readonly reason: string;
}

function isLikeCloseEvent(val: unknown): val is LikeCloseEvent {
  return isObject(val) && 'code' in val && 'reason' in val;
}

type MessagePayload<T> = T & { type: string };

export function createClient({
  retryAttempts = 5,
  retryWait = randomizedExponentialBackOffTime,
  generateID = generateUUID,
  reconnect = () => start(),
  connect,
  connectionParams = {},
  jsonMessageReplacer,
  jsonMessageReviver,
}: ClientOptions) {
  const emitter = createEmitter();
  let acknowledged = false;
  let socket: ClientWebSocket | ClientEmitterSocket | null;
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let shouldAttemptReconnect = true;
  let retryCount = retryAttempts || -1;
  function start() {
    socket = connect();
    if (socket && 'addEventListener' in socket) {
      socket.addEventListener('open', onOpen);
      socket.addEventListener('close', onClose);
      socket.addEventListener('message', onMessage);
    } else {
      socket.on('open', onOpen);
      socket.on('close', onClose);
      socket.on('message', data => onMessage({ data }));
    }
  }
  function destroy(code = 2200, reason = 'destroyed') {
    reconnectTimeoutId && clearTimeout(reconnectTimeoutId);
    shouldAttemptReconnect = false;
    socket?.close(code, reason);
  }
  async function onOpen() {
    emitter.emit('connecting');
    // Reset the retry count
    retryCount = retryAttempts;

    try {
      socket?.send(
        stringifyMessage<MessageType.ConnectionInit>(
          {
            type: MessageType.ConnectionInit,
            payload:
              typeof connectionParams === 'function'
                ? await connectionParams()
                : connectionParams,
          },
          jsonMessageReplacer
        )
      );
    } catch (err) {
      socket?.close(
        4400,
        err instanceof Error ? err.message : new Error(err).message
      );
    }
  }

  function onClose() {
    if (shouldAttemptReconnect && (retryCount > 0 || retryCount == -1)) {
      if (retryCount !== -1) retryCount--;
      reconnectTimeoutId && clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = setTimeout(function() {
        emitter.emit('reconnecting');
        start();
      }, retryWait(retryCount));
    } else {
      emitter.emit('closed', 'closed');
    }
  }

  const pendingPayloads: {
    [key: string]: (response: SendMessage) => void;
  } = {};

  function onMessage({ data }: { data: string | object }) {
    try {
      let message;
      if (typeof data === 'string') {
        message = parseMessage(data, jsonMessageReviver);
      } else {
        message = data as SendMessage;
      }
      emitter.emit('message', message);
      if (
        message.type !== MessageType.ConnectionAck &&
        message.type !== MessageType.ConnectionInit
      ) {
        const resolver = pendingPayloads[(message as SendMessage)?.payloadId];
        const { payloadId, ...data } = message as SendMessage;
        resolver?.(data as SendMessage);
      }
      if (acknowledged) return; // already connected and acknowledged

      if (message.type !== MessageType.ConnectionAck)
        throw new Error(`First message cannot be of type ${message.type}`);
      acknowledged = true;
      emitter.emit('connected', socket, message.payload); // connected = socket opened + acknowledged
    } catch (err) {
      socket?.close(
        4400,
        err instanceof Error ? err.message : new Error(err).message
      );
    }
  }
  async function send<T = unknown>(payload: MessagePayload<T>) {
    try {
      const payloadId = generateID();

      socket?.send(
        stringifyMessage<MessageType.Message>(
          { payloadId, ...payload },
          jsonMessageReplacer
        )
      );

      return new Promise<SendMessage>(resolve => {
        pendingPayloads[payloadId] = resolve;
      });
    } catch (errOrCloseEvent) {
      if (!shouldRetryConnectOrThrow(errOrCloseEvent))
        return { type: 'reconnecting' };
    }
    return { type: 'error' };
  }

  function shouldRetryConnectOrThrow(errOrCloseEvent: unknown): boolean {
    // some close codes are worth reporting immediately
    if (
      isLikeCloseEvent(errOrCloseEvent) &&
      [
        1002, // Protocol Error
        1011, // Internal Error
        4400, // Bad Request
        4401, // Unauthorized (tried subscribing before connect ack)
        4409, // Subscriber for <id> already exists (distinction is very important)
        4429, // Too many initialization requests
      ].includes(errOrCloseEvent.code)
    )
      throw errOrCloseEvent;

    // client was disposed, no retries should proceed regardless
    if (!shouldAttemptReconnect) return false;

    // retries are not allowed or we tried to many times, report error
    if (!retryAttempts || retryCount >= retryAttempts) throw errOrCloseEvent;

    // throw fatal connection problems immediately
    if (isLikeCloseEvent(errOrCloseEvent)) throw errOrCloseEvent;

    // looks good, start retrying
    reconnect();

    return true;
  }

  return {
    start,
    on: emitter.on,
    destroy,
    send,
  };
}
