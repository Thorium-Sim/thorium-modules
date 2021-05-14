import {
  ActionConstraint,
  Connector,
  OutputQueueItem,
  StateConstraint,
} from '@thorium-sim/types';
import ws from 'ws';
import { LockstepClient } from '@thorium-sim/lockstep';

// Use web browser's native WebSocket if possible.

function parseJSON(string: string) {
  try {
    return JSON.parse(string);
  } catch (e) {
    return null;
  }
}
export type AllowedData<A> =
  | { type: 'connect'; data: Record<string, unknown> }
  | { type: 'meta'; data: Record<string, unknown> }
  | { type: 'action'; data: OutputQueueItem<A>[] }
  | { type: 'ack'; data: { id: number; actions: OutputQueueItem<A>[] } };
type SecondParam<T extends (...params: any[]) => any> = T extends (
  param1: any,
  param2: infer R,
  ...rest: any[]
) => any
  ? R
  : never;

export default class WebSocketClientConnector<
  S extends StateConstraint,
  A extends ActionConstraint
> extends Connector<S, A> {
  client: ws;
  clientId: number;
  replacer: SecondParam<typeof JSON.stringify>;
  synchronizer!: LockstepClient<S, A>;
  constructor(client: ws) {
    super();
    this.client = client;
    this.clientId = 1;
    this.replacer = null;
  }
  setSynchronizer(synchronizer: LockstepClient<S, A>) {
    this.synchronizer = synchronizer;
  }
  // This is not used at all by clients for now, so we're sending a dummy value.
  getHostId() {
    return 0;
  }
  getClientId() {
    return this.clientId;
  }
  meta(data: Record<string, unknown>) {
    this.sendData({ type: 'meta', data });
  }
  push(data: OutputQueueItem<A>[]) {
    this.sendData({ type: 'action', data });
  }
  ack(data: { id: number; actions: OutputQueueItem<A>[] }) {
    this.sendData({ type: 'ack', data });
  }
  sendData(data: AllowedData<A>) {
    this.client.send(JSON.stringify(data, this.replacer));
  }
  connect(metadata: Record<string, unknown>) {
    this.client.onopen = () => {
      this.sendData({ type: 'connect', data: metadata });
    };
    this.client.onmessage = event => {
      this.handleMessage(event.data.toString());
    };
    this.client.onerror = event => {
      this.handleError(event);
    };
    this.client.onclose = event => {
      this.handleDisconnect(event);
    };
    if (this.client && this.client.readyState === 1) {
      this.sendData({ type: 'connect', data: metadata });
      return;
    }
  }
  disconnect() {
    this.client.close();
    this.handleDisconnect();
  }
  error() {
    // Well, nothing to do here.
    this.disconnect();
  }
  start(metadata: Record<string, unknown> = {}) {
    this.connect(metadata);
  }
  stop() {
    this.disconnect();
  }
  handleMessage(string: string) {
    let data = parseJSON(string);
    if (data == null) return;
    switch (data.type) {
      case 'meta':
        break;
      case 'action':
        this.synchronizer.handleAction(data.data, false, 0);
        break;
      case 'ack':
        // Not implemented
        // this.synchronizer.handleAck(data.data, 0);
        break;
      case 'connect':
        this.clientId = data.data.id;
        this.synchronizer.handleConnect(data.data, 0);
        break;
      case 'error':
        this.synchronizer.handleError(data.data, 0);
    }
  }
  handleError(event: unknown) {
    this.synchronizer.handleError(event, 0);
  }
  handleDisconnect(_event?: ws.CloseEvent) {
    this.synchronizer.handleDisconnect(0);
  }
}
