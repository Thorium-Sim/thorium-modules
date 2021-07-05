/**
 *
 * common
 *
 */

import {
  isObject,
  areErrors,
  hasOwnProperty,
  hasOwnStringProperty,
} from './utils';

/** @category Common */
export interface Disposable {
  /** Dispose of the instance and clear up resources. */
  dispose: () => void | Promise<void>;
}

/**
 * Types of messages allowed to be sent by the client/server over the WS protocol.
 *
 * @category Common
 */
export enum MessageType {
  ConnectionInit = 'connection_init', // Client -> Server
  ConnectionAck = 'connection_ack', // Server -> Client

  Message = 'message', // Client -> Server
  Error = 'error', // Server -> Client
}

/** @category Common */
interface ConnectionInitMessage {
  readonly type: MessageType.ConnectionInit;
  readonly payload?: Record<string, unknown>;
}

/** @category Common */
interface ConnectionAckMessage {
  readonly type: MessageType.ConnectionAck;
  readonly payload?: Record<string, unknown>;
}

/** @category Common */
export interface SendMessage {
  readonly type: string;
  readonly payloadId: string;
  [key: string]: any;
}
/** @category Common */
export type Message<
  T extends MessageType = MessageType
> = T extends MessageType.ConnectionAck
  ? ConnectionAckMessage
  : T extends MessageType.ConnectionInit
  ? ConnectionInitMessage
  : T extends MessageType.Message
  ? SendMessage
  : never;

/**
 * Checks if the provided value is a message.
 *
 * @category Common
 */
function isMessage(val: unknown): val is Message {
  if (isObject(val)) {
    // all messages must have the `type` prop
    if (!hasOwnStringProperty(val, 'type')) {
      return false;
    }
    // validate other properties depending on the `type`
    switch (val.type) {
      case MessageType.ConnectionInit:
        // the connection init message can have optional payload object
        return (
          !hasOwnProperty(val, 'payload') ||
          val.payload === undefined ||
          isObject(val.payload)
        );
      case MessageType.ConnectionAck:
        // the connection ack message can have optional payload object too
        return (
          !hasOwnProperty(val, 'payload') ||
          val.payload === undefined ||
          isObject(val.payload)
        );
      case MessageType.Message:
        return hasOwnStringProperty(val, 'type');
      case MessageType.Error:
        return hasOwnStringProperty(val, 'id') && areErrors(val.payload);
      default:
        return true;
    }
  }
  return false;
}

/**
 * Function for transforming values within a message during JSON parsing
 * The values are produced by parsing the incoming raw JSON.
 *
 * Read more about using it:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#using_the_reviver_parameter
 *
 * @category Common
 */
export type JSONMessageReviver = (this: any, key: string, value: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Parses the raw websocket message data to a valid message.
 *
 * @category Common
 */
export function parseMessage(
  data: unknown,
  reviver?: JSONMessageReviver
): Message {
  if (isMessage(data)) {
    return data;
  }
  if (typeof data !== 'string') {
    throw new Error('Message not parsable');
  }
  const message = JSON.parse(data, reviver);
  if (!isMessage(message)) {
    throw new Error('Invalid message');
  }
  return message;
}

/**
 * Function that allows customization of the produced JSON string
 * for the elements of an outgoing `Message` object.
 *
 * Read more about using it:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter
 *
 * @category Common
 */
export type JSONMessageReplacer = (this: any, key: string, value: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Stringifies a valid message ready to be sent through the socket.
 *
 * @category Common
 */
export function stringifyMessage<T extends MessageType>(
  msg: Message<T>,
  replacer?: JSONMessageReplacer
): string {
  if (!isMessage(msg)) {
    throw new Error('Cannot stringify invalid message: ' + msg);
  }
  return JSON.stringify(msg, replacer);
}
