import { Server as WebSocketServer, ServerOptions } from 'ws';
import { LockstepServer } from '@thorium-sim/lockstep';

import {
  ActionConstraint,
  Connector,
  OutputQueueItem,
  StateConstraint,
} from '@thorium-sim/types/dist';

function parseJSON(string: string) {
  try {
    return JSON.parse(string);
  } catch (e) {
    return null;
  }
}
interface WebSocketServerConnectorOptions extends Partial<ServerOptions> {
  ws?: WebSocketServer;
}
type SecondParam<T extends (...params: any[]) => any> = T extends (
  param1: any,
  param2: infer R,
  ...rest: any[]
) => any
  ? R
  : never;
export default class WebSocketServerConnector<
  S extends StateConstraint,
  A extends ActionConstraint
> extends Connector<S, A> {
  server: WebSocketServer;
  replacer: SecondParam<typeof JSON.stringify>;
  clientIds: number;
  clients: Record<number, WebSocket>;
  synchronizer!: LockstepServer<S, A>;

  constructor(options: WebSocketServerConnectorOptions = {}) {
    super();
    // User may want to provide their own websocket instance
    if (!options.ws) {
      this.server = new WebSocketServer(options);
    } else {
      this.server = options.ws;
    }
    this.clients = {};
    this.clientIds = 1;
    this.replacer = null;
  }
  setSynchronizer(synchronizer: LockstepServer<S, A>) {
    this.synchronizer = synchronizer;
  }
  getHostId() {
    return 0;
  }
  getClientId() {
    return 0;
  }
  meta(data: Record<string, unknown>, clientId: number) {
    this.sendData({ type: 'meta', data }, clientId);
  }
  push(data: OutputQueueItem<A>[], clientId: number) {
    this.sendData({ type: 'push', data }, clientId);
  }
  ack(data: { id: number; actions: OutputQueueItem<A>[] }, clientId: number) {
    this.sendData({ type: 'ack', data }, clientId);
  }
  connect(data: Record<string, unknown>, clientId: number) {
    this.sendData({ type: 'connect', data }, clientId);
  }
  sendData(data: Record<string, unknown>, clientId: number) {
    if (this.clients[clientId] == null) return;
    if (this.clients[clientId].readyState !== 1) return;
    this.clients[clientId].send(JSON.stringify(data, this.replacer));
  }
  disconnect(clientId: number) {
    if (this.clients[clientId] == null) return;
    if (this.clients[clientId].readyState !== 1) return;
    this.clients[clientId].close();
    delete this.clients[clientId];
  }
  error(data: string, clientId: number) {
    this.sendData({ type: 'error', data }, clientId);
    setTimeout(() => this.disconnect(clientId), 0);
  }
  start(metadata: Record<string, unknown>, noRegister = false) {
    if (!noRegister) {
      this.server.on('connection', this.handleConnect.bind(this));
    }
    this.synchronizer.start(metadata);
  }
  stop() {
    if (this.server) this.server.close();
  }
  handleConnect(client: WebSocket) {
    let clientId = this.clientIds++;
    this.clients[clientId] = client;
    client.onmessage = event => {
      this.handleMessage(event.data, clientId);
    };
    client.onerror = event => {
      this.handleError(event, clientId);
    };
    client.onclose = () => {
      this.handleDisconnect(clientId);
    };
    // We don't have to send 'handshake header' packet, right?
    // It's not really necessary...
  }
  handleMessage(string: string, clientId: number) {
    let data = parseJSON(string);
    if (data == null) return;
    switch (data.type) {
      case 'meta':
        // :P?
        // if (this.synchronizer.handleMeta) {
        //   this.synchronizer.handleMeta(data.data, 0);
        // }
        break;
      case 'push':
        this.synchronizer.handleAction(data.data, false, clientId);
        break;
      case 'ack':
        this.synchronizer.handleAck(data.data, clientId);
        break;
      case 'connect':
        this.synchronizer.handleConnect(data.data, clientId);
        break;
    }
  }
  handleError(event: any, clientId: number) {
    this.synchronizer.handleError(event.message, clientId);
  }
  handleDisconnect(clientId: number) {
    if (this.clients[clientId] == null) return;
    this.synchronizer.handleDisconnect(clientId);
  }
}
