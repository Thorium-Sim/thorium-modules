import {
  ActionConstraint,
  ConnectionData,
  Connector,
  InputQueueItem,
  OutputQueueItem,
  SimulationMachine,
  StateConstraint,
  SynchronizerConfig,
} from '@thorium-sim/types/dist';
import LockstepClient from './LockstepClient';

interface Client {
  id: number;
  rtt: number;
  ackId: number;
  lastTime: number;
  connected: boolean;
  meta: Record<string, unknown>;
  frozen: boolean;
  freezeTime: number | null;
}
export default class LockstepServer<
  S extends StateConstraint,
  A extends ActionConstraint
> extends LockstepClient<S, A> {
  // The tick time data of last few (freezeWait / fixedTick) ticks.
  // This is used to calculate the round trip time.
  tickTime: number[] = [];
  host: true = true;
  hostQueue: OutputQueueItem<A>[] = [];
  clients: { [clientId: number]: Client } = {};
  clientList: Client[] = [];
  dynamicTickTimer: number | NodeJS.Timeout | null = null;
  actionHandler:
    | null
    | ((
        action: OutputQueueItem<A>,
        client: Client
      ) => OutputQueueItem<A>) = null;
  connectionHandler:
    | null
    | ((data: unknown, clientId: number) => Record<string, unknown>) = null;
  constructor(
    machine: SimulationMachine<S, A>,
    connector: Connector<S, A>,
    config: Partial<SynchronizerConfig> = {}
  ) {
    super(machine, connector, config);
  }
  addClient(client: Client) {
    this.clients[client.id] = client;
    this.clientList.push(client);
  }
  removeClient(clientId: number) {
    let client = this.clients[clientId];
    this.clientList.splice(this.clientList.indexOf(client), 1);
    // Or we can call remove
    delete this.clients[clientId];
  }
  start(data: Record<string, unknown> = {}) {
    if (this.started) return;

    let meta = data;
    if (this.connectionHandler != null) {
      meta = this.connectionHandler(data, 0);
    }
    this.meta = meta;

    // Create client information of server itself
    let client = {
      id: this.connector.getClientId(),
      rtt: 0,
      ackId: 0,
      lastTime: Date.now(),
      connected: true,
      meta,
      frozen: false,
      freezeTime: null,
    };

    this.addClient(client);

    super.start();
    // If there are any backlogs in host buffer, process them
    if (this.config.dynamic && this.hostQueue.length > 0) {
      this.handleTick();
    }
  }
  doDynamicPush() {
    // Just send actions to itself
    if (!this.started || !this.config.dynamic) return;
    if (this.outputQueue.length === 0) return;
    this.handleAction(
      { id: 0, rtt: 0, actions: this.outputQueue },
      false,
      this.connector.getClientId()
    );
    this.outputQueue = [];
  }
  handleAction(
    actions: InputQueueItem<A>,
    _supressTick = false,
    clientId: number
  ) {
    // Push to host is only available for dynamic mode, since acknowledge
    // will send the data to host in fixed mode.
    if (!this.config.dynamic) return;
    let client = this.clients[clientId];
    if (client == null) {
      this.handleError('Client ID ' + clientId + ' does not exist', clientId);
      return;
    }
    if (!Array.isArray(actions.actions)) {
      this.handleError('Actions value is not array', clientId);
      return;
    }
    // Copy the contents to input queue. concat is pretty slow.
    for (let i = 0; i < actions.actions.length; ++i) {
      let transformed = this.validateAction(actions.actions[i], client);
      if (transformed === null) continue;
      this.hostQueue.push(transformed);
    }
    // Start the dynamic tick timer,
    if (!this.frozen && this.dynamicTickTimer === null && this.started) {
      this.dynamicTickTimer = setTimeout(() => {
        this.dynamicTickTimer = null;
        this.handleTick();
      }, this.config.dynamicTickWait);
    }
  }
  doAck(tickId: number) {
    this.handleAck(
      {
        id: tickId,
        actions: this.outputQueue,
      },
      this.connector.getClientId()
    );
    this.outputQueue = [];
  }
  // Handle acknowledge - calculate RTT, add action, trigger tick, etc...
  handleAck(
    actions: { id: number; actions: OutputQueueItem<A>[] },
    clientId: number
  ) {
    // Handle ACK; Only host will process it.
    if (!this.host) return;
    // ACK data has id and actions...
    let client = this.clients[clientId];
    if (client == null) {
      this.handleError('Client ID ' + clientId + ' does not exist', clientId);
      return;
    }
    // Is this really necessary?
    // TCP will handle order issue, so we don't have to care about it
    if (
      actions == null ||
      (client.connected && actions.id !== client.ackId + 1)
    ) {
      this.handleError(
        'Wrong tick data received; order matching failed',
        clientId
      );
      return;
    }
    if (actions.id > this.tickId) {
      // Well, literally.
      this.handleError(
        'Wrong tick data received; client is from future',
        clientId
      );
      return;
    }
    if (!Array.isArray(actions.actions)) {
      this.handleError('Actions field is not array', clientId);
      return;
    }
    if (client.connected) client.ackId = actions.id;
    // Copy the contents to input queue. concat is pretty slow.
    for (let i = 0; i < actions.actions.length; ++i) {
      let transformed = this.validateAction(actions.actions[i], client);
      if (transformed === undefined) continue;
      this.hostQueue.push(transformed);
    }
    // Update RTT...
    if (client.connected) {
      client.rtt =
        Date.now() -
        this.tickTime[
          Math.max(0, this.tickTime.length - (this.tickId - actions.id) - 1)
        ];
    } else {
      client.rtt = Date.now() - client.lastTime;
      client.connected = true;
    }
    // Update last time.
    client.lastTime = Date.now();
    this.doUnfreeze(client);
    if (this.hostQueue.length !== 0 && this.config.dynamic) {
      // Start the dynamic tick timer,
      if (this.dynamicTickTimer === null && this.started) {
        this.dynamicTickTimer = setTimeout(() => {
          this.dynamicTickTimer = null;
          this.handleTick();
        }, this.config.dynamicTickWait);
      }
    }
  }

  handleTick(actClient?: boolean) {
    if (actClient) return super.handleTick();
    if (this.config.dynamic && this.hostQueue.length === 0) return;
    let currentTime = Date.now();
    // Host should check whether to hang, send input buffer to clients,
    // then process itself.
    for (let i = 0; i < this.clientList.length; ++i) {
      let client = this.clientList[i];
      // Client is matched up with the server; continue anyway.
      if (client.ackId === this.tickId) continue;
      // Ignore itself
      if (client.id === this.connector.getClientId()) continue;
      if (
        client.freezeTime &&
        client.freezeTime + this.config.disconnectWait < currentTime
      ) {
        // Forcefully disconnect the client
        this.connector.disconnect(client.id);
        this.handleDisconnect(client.id);
      } else if (client.lastTime + this.config.freezeWait < currentTime) {
        // Freeze... In dynamic mode, we should start a tick timer to count
        // down to the disconnection.
        this.doFreeze(client);
      }
    }
    // If it's frozen, don't process it
    if (this.frozen) return;
    // Increment the tick ID
    this.tickId++;
    this.tickTime.push(currentTime);
    // Remove tickTime entry until specified length is reached
    while (
      this.tickTime.length >
      this.config.freezeWait / this.config.fixedTick
    ) {
      this.tickTime.shift();
    }
    // Now, push the input buffer to the clients.
    let sendData = {
      id: this.tickId,
      actions: this.hostQueue,
      rtt: 0,
    };
    this.hostQueue = [];

    for (let i = 0; i < this.clientList.length; ++i) {
      if (this.clientList[i].id === this.connector.getHostId()) continue;
      this.connector.push(
        sendData.actions,
        this.clientList[i].id,
        this.clientList[i].rtt
      );
    }
    super.handleAction(sendData, true);
    if (!this.config.dynamic) super.handleTick();
  }
  doFreeze(client: Client) {
    if (client.frozen) return;
    client.frozen = true;
    client.freezeTime = Date.now();
    this.frozen += 1;
    if (this.frozen === 1) this.emit('freeze', client.id);
  }
  doUnfreeze(client: Client) {
    if (!client.frozen) return;
    client.frozen = false;
    client.freezeTime = null;
    this.frozen -= 1;
    if (this.frozen === 0) this.emit('unfreeze', client.id);
    if (this.frozen < 0) {
      // This isn't client's fault - thus we throw an error.
      throw new Error('Frozen lower than 0 - something went wrong.');
    }
  }

  handleConnect(data: ConnectionData<S>, clientId: number) {
    if (this.clients[clientId] != null) {
      this.handleError('Client already joined', clientId);
      return;
    }
    let meta = data.meta;
    if (this.connectionHandler != null) {
      try {
        meta = this.connectionHandler(data, clientId);
      } catch (e) {
        // Reject connection
        this.handleError((e && e.message) || e, clientId);
        return;
      }
    }
    // Create client information
    let client: Client = {
      id: clientId,
      rtt: 0,
      ackId: this.tickId,
      lastTime: Date.now(),
      connected: false,
      meta,
      frozen: false,
      freezeTime: null,
    };

    this.addClient(client);
    // Freeze until client sends ACK.
    this.doFreeze(client);
    // Send client the state information.
    this.connector.connect(
      {
        state: this.machine.getState(),
        tickId: this.tickId,
        config: this.config,
        // Send client ID along with the connect signal; this might be
        // used by connector.
        id: clientId,
        meta,
        // Nothing else is required for now
      },
      clientId
    );
    this.emit('connect', clientId);
  }
  handleDisconnect(clientId: number) {
    let client = this.clients[clientId];
    if (client == null) {
      this.handleError('Client ID ' + clientId + ' does not exist', clientId);
      return;
    }
    // Remove the client, that's all.
    this.removeClient(clientId);
    this.doUnfreeze(client);
    // Prehaps we should send disconnect event to other clients.
    this.emit('disconnect', clientId);
  }
  handleError(error: unknown, clientId: number) {
    console.log('Lockstep Server Error:', error);

    this.emit('error', error, clientId);
    if (clientId != null && clientId !== this.connector.getClientId()) {
      this.connector.error(error, clientId);
    }
  }
  validateAction(action: OutputQueueItem<A>, client: Client) {
    if (this.actionHandler) {
      return this.actionHandler(action, client);
    }
    if (typeof action === 'object') {
      return Object.assign({}, action, {
        clientId: client.id,
      });
    }
    return action;
  }
}
