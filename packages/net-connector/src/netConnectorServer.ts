import {
  Message,
  MessageType,
  stringifyMessage,
  parseMessage,
  JSONMessageReplacer,
  JSONMessageReviver,
  SendMessage,
} from './common';
import { isObject } from './utils';
import { NetConnectorSocket } from '@thorium-sim/types';
interface ExecutionArgs {
  type: string;
  context: ExecutionContextValue;
  [key: string]: any;
}
type ExecutionResult = { type: string; [key: string]: any };
/** @category Server */
export type OperationResult = Promise<ExecutionResult> | ExecutionResult;

/**
 * A concrete GraphQL execution context value type.
 *
 * Mainly used because TypeScript collapses unions
 * with `any` or `unknown` to `any` or `unknown`. So,
 * we use a custom type to allow definitions such as
 * the `context` server option.
 *
 * @category Server
 */
export type ExecutionContextValue =
  | object // you can literally pass "any" JS object as the context value
  | symbol
  | number
  | string
  | boolean
  | undefined
  | null;

/** @category Server */
export interface ServerOptions<E = unknown> {
  /**
   * A value which is provided to every resolver and holds
   * important contextual information like the currently
   * logged in user, or access to a database.
   *
   * Note that the context function is invoked on each operation only once.
   */
  context?:
    | ExecutionContextValue
    | ((
        ctx: Context<E>,
        message: SendMessage
      ) => Promise<ExecutionContextValue> | ExecutionContextValue);
  /**
   * Is the `execute` function from GraphQL which is
   * used to execute the query and mutation operations.
   *
   * Throwing an error from within this function will
   * close the socket with the `Error` message
   * in the close event reason.
   */
  execute: (args: ExecutionArgs) => OperationResult;
  /**
   * The amount of time for which the server will wait
   * for `ConnectionInit` message.
   *
   * Set the value to `Infinity`, `''`, `0`, `null` or `undefined` to skip waiting.
   *
   * If the wait timeout has passed and the client
   * has not sent the `ConnectionInit` message,
   * the server will terminate the socket by
   * dispatching a close event `4408: Connection initialization timeout`
   *
   * @default 3 * 1000 (3 seconds)
   */
  connectionInitWaitTimeout?: number;
  /**
   * Is the connection callback called when the
   * client requests the connection initialization
   * through the message `ConnectionInit`.
   *
   * The message payload (`connectionParams` from the
   * client) is present in the `Context.connectionParams`.
   *
   * - Returning `true` or nothing from the callback will
   * allow the client to connect.
   *
   * - Returning `false` from the callback will
   * terminate the socket by dispatching the
   * close event `4403: Forbidden`.
   *
   * - Returning a `Record` from the callback will
   * allow the client to connect and pass the returned
   * value to the client through the optional `payload`
   * field in the `ConnectionAck` message.
   *
   * Throwing an error from within this function will
   * close the socket with the `Error` message
   * in the close event reason.
   */
  onConnect?: (
    ctx: Context<E>
  ) =>
    | Promise<Record<string, unknown> | boolean | void>
    | Record<string, unknown>
    | boolean
    | void;
  /**
   * Called when the client disconnects for whatever reason after
   * he successfully went through the connection initialization phase.
   * Provides the close event too.
   
   *
   * This callback will be called EXCLUSIVELY if the client connection
   * is acknowledged. Meaning, `onConnect` will be called before the `onDisconnect`.
   *
   * For tracking socket closures at any point in time, regardless
   * of the connection state - consider using the `onClose` callback.
   */
  onDisconnect?: (
    ctx: Context<E>,
    code: number,
    reason: string
  ) => Promise<void> | void;
  /**
   * Called when the socket closes for whatever reason, at any
   * point in time. Provides the close event too.
   *
   * In comparison to `onDisconnect`, this callback will ALWAYS
   * be called, regardless if the user successfully went through
   * the connection initialization or not. `onConnect` might not
   * called before the `onClose`.
   */
  onClose?: (
    ctx: Context<E>,
    code: number,
    reason: string
  ) => Promise<void> | void;

  /**
   * An optional override for the JSON.parse function used to hydrate
   * incoming messages to this server. Useful for parsing custom data types
   * out of the incoming JSON.
   */
  jsonMessageReviver?: JSONMessageReviver;
  /**
   * An optional override for the JSON.stringify function used to serialize
   * outgoing messages to from server. Useful for serializing custom
   * data types out to the client.
   */
  jsonMessageReplacer?: JSONMessageReplacer;
}

/** @category Server */
export interface Server<E = undefined> {
  /**
   * New socket has been established. The lib will validate
   * the protocol and use the socket accordingly. Returned promise
   * will resolve after the socket closes.
   *
   * The second argument will be passed in the `extra` field
   * of the `Context`. You may pass the initial request or the
   * original WebSocket, if you need it down the road.
   *
   * Returns a function that should be called when the same socket
   * has been closed, for whatever reason. The close code and reason
   * must be passed for reporting to the `onDisconnect` callback. Returned
   * promise will resolve once the internal cleanup is complete.
   */
  opened(
    socket: NetConnectorSocket,
    ctxExtra: E
  ): (code: number, reason: string) => Promise<void>; // closed
}

/** @category Server */
export interface Context<E = unknown> {
  /**
   * Indicates that the `ConnectionInit` message
   * has been received by the server. If this is
   * `true`, the client wont be kicked off after
   * the wait timeout has passed.
   */
  readonly connectionInitReceived: boolean;
  /**
   * Indicates that the connection was acknowledged
   * by having dispatched the `ConnectionAck` message
   * to the related client.
   */
  readonly acknowledged: boolean;
  /** The parameters passed during the connection initialization. */
  readonly connectionParams?: Readonly<Record<string, unknown>>;
  readonly socket: NetConnectorSocket;
  /**
   * An extra field where you can store your own context values
   * to pass between callbacks.
   */
  extra: E;
}

/**
 * Makes a Protocol compliant WebSocket GraphQL server. The server
 * is actually an API which is to be used with your favorite WebSocket
 * server library!
 *
 * Read more about the Protocol in the PROTOCOL.md documentation file.
 *
 * @category Server
 */
export function makeServer<E = unknown>(options: ServerOptions<E>): Server<E> {
  const {
    context,
    execute,
    connectionInitWaitTimeout = 3 * 1000, // 3 seconds
    onConnect,
    onDisconnect,
    onClose,
    jsonMessageReviver: reviver,
    jsonMessageReplacer: replacer,
  } = options;

  return {
    opened(socket, extra) {
      const ctx: Context<E> = {
        connectionInitReceived: false,
        acknowledged: false,
        socket,
        extra,
      };

      // kick the client off (close socket) if the connection has
      // not been initialized after the specified wait timeout
      const connectionInitWait =
        connectionInitWaitTimeout > 0 && isFinite(connectionInitWaitTimeout)
          ? setTimeout(() => {
              if (!ctx.connectionInitReceived)
                socket.close(4408, 'Connection initialization timeout');
            }, connectionInitWaitTimeout)
          : null;

      socket.onMessage(async function onMessage(data) {
        let message: Message;
        try {
          message = parseMessage(data, reviver);
        } catch (err) {
          return socket.close(4400, 'Invalid message received');
        }
        switch (message.type) {
          case MessageType.ConnectionInit: {
            if (ctx.connectionInitReceived)
              return socket.close(4429, 'Too many initialization requests');

            // @ts-expect-error: I can write
            ctx.connectionInitReceived = true;

            if (isObject(message))
              // @ts-expect-error: I can write
              ctx.connectionParams = message.payload;

            const permittedOrPayload = await onConnect?.(ctx);
            if (permittedOrPayload === false)
              return socket.close(4403, 'Forbidden');

            await socket.send(
              stringifyMessage<MessageType.ConnectionAck>(
                isObject(permittedOrPayload)
                  ? {
                      type: MessageType.ConnectionAck,
                      payload: permittedOrPayload,
                    }
                  : {
                      type: MessageType.ConnectionAck,
                      // payload is completely absent if not provided
                    },
                replacer
              )
            );

            // @ts-expect-error: I can write
            ctx.acknowledged = true;
            return;
          }
          default: {
            if (!ctx.acknowledged) return socket.close(4401, 'Unauthorized');

            let execArgs: ExecutionArgs = { ...message, context: {} };
            // if `onSubscribe` didn't specify a context, inject one
            if (!('contextValue' in execArgs))
              execArgs.context =
                (typeof context === 'function'
                  ? await context(ctx, message as SendMessage)
                  : context) || {};

            // the execution arguments have been prepared
            // perform the operation and act accordingly
            let result = await execute(execArgs);

            await socket.send(
              stringifyMessage(
                { ...result, payloadId: (message as SendMessage).payloadId },
                replacer
              )
            );

            return;
          }
        }
      });
      // wait for close, cleanup and the disconnect callback
      return async (code, reason) => {
        if (connectionInitWait) clearTimeout(connectionInitWait);
        if (ctx.acknowledged) await onDisconnect?.(ctx, code, reason);
        socket.close(code, reason);
        await onClose?.(ctx, code, reason);
      };
    },
  };
}
