import EventEmitter from 'events';
import {
  Connector,
  InputQueueItem,
  OutputQueueItem,
  SimulationMachine,
  SynchronizerConfig,
  ConnectionData,
  StateConstraint,
  ActionConstraint,
} from '@thorium-sim/types';

export default class LockstepClient<
  S extends StateConstraint,
  A extends ActionConstraint
> extends EventEmitter {
  machine: SimulationMachine<S, A>;
  connector: Connector<S, A>;
  config: SynchronizerConfig;
  // The tick ID. This increments by 1 every tick, and is used to
  tickId = 0;
  // The input queue. This stores the actions that needs to be run, separated
  // by tick ID.
  inputQueue: InputQueueItem<A>[] = [];
  // The output queue. This stores the actions triggered by UI / etc...,
  // and sends it to the server.
  outputQueue: OutputQueueItem<A>[] = [];
  // The round trip time between the host and the client.
  rtt = 0;
  // Is the system frozen? How many clients are affecting the status?
  frozen = 0;
  // Is the system started?
  started = false;
  // Timer objects
  dynamicPushTimer: number | NodeJS.Timeout | null = null;
  fixedTickTimer: number | NodeJS.Timeout | null = null;
  // Promise callbacks used in push function.
  promiseId = 0;
  promises: {
    [promiseId: number]: {
      resolve: (value: unknown) => void;
      reject: (reason?: any) => void;
    };
  } = {};
  // Metadata of client itself.
  meta: Record<string, unknown> | null = null;
  constructor(
    machine: SimulationMachine<S, A>,
    connector: Connector<S, A>,
    config: Partial<SynchronizerConfig> = {}
  ) {
    super();
    this.machine = machine;
    this.connector = connector;
    this.config = {
      dynamic: true,
      dynamicPushWait: 10,
      dynamicTickWait: 10,
      fixedTick: 50,
      fixedBuffer: 1,
      disconnectWait: 10000,
      freezeWait: 1000,
      ...config,
    };
  }
  start(_data?: unknown) {
    this.started = true;
    this.emit('start');
    if (this.config.dynamic) {
      // If there are any backlogs in output buffer, process them now
      this.doDynamicPush();
    } else {
      // Start the tick timer..
      if (this.fixedTickTimer === null) {
        this.fixedTickTimer = setInterval(() => {
          this.handleTick();
        }, this.config.fixedTick);
      }
    }
  }

  stop() {
    this.started = false;
    this.emit('stop');
    if (!this.config.dynamic && this.fixedTickTimer !== null) {
      // Clear the tick timer.
      clearInterval(this.fixedTickTimer as number);
      this.fixedTickTimer = null;
    }
  }

  // Queues and triggers the action created from UI / etc, ...
  netsend(action: A) {
    if (this.config.dynamic && this.dynamicPushTimer === null && this.started) {
      this.dynamicPushTimer = setTimeout(() => {
        this.dynamicPushTimer = null;
        this.doDynamicPush();
      }, this.config.dynamicPushWait);
    }
    let promiseId = this.promiseId++;
    let promise = new Promise((resolve, reject) => {
      this.promises[promiseId] = { resolve, reject };
    });
    this.outputQueue.push({ ...action, promiseId });
    return promise;
  }

  doDynamicPush() {
    if (!this.started || !this.config.dynamic) return;
    if (this.outputQueue.length === 0) return;
    this.connector.push(this.outputQueue, this.connector.getHostId());
    this.outputQueue = [];
  }

  handleAction(
    actions: InputQueueItem<A>,
    supressTick: boolean,
    _clientId?: number
  ) {
    // This means the host has sent the message...
    if (
      !supressTick &&
      (this.inputQueue.length === 0
        ? this.tickId + 1 !== actions.id
        : this.inputQueue[this.inputQueue.length - 1].id + 1 !== actions.id)
    ) {
      this.connector.error(
        'Wrong tick data received; desync occurred?',
        this.connector.getHostId()
      );
      return;
    }
    this.inputQueue.push(actions);
    this.doAck(actions.id);
    this.rtt = actions.rtt;
    // Cancel push timer if exists.
    if (this.config.dynamic && this.dynamicPushTimer != null) {
      clearTimeout(this.dynamicPushTimer as number);
      this.dynamicPushTimer = null;
    }
    // Handle tick immediately in dynamic mode.
    if (this.config.dynamic) this.handleTick(true);
  }

  doAck(tickId: number) {
    this.connector.ack(
      {
        id: tickId,
        actions: this.outputQueue,
      },
      this.connector.getHostId()
    );
    this.outputQueue = [];
  }

  // Handles the tick - run state machine, empty queue, etc...
  handleTick(_actClient?: boolean) {
    // Do we have sufficient tick data? If not, freeze!
    if (
      (!this.config.dynamic &&
        this.inputQueue.length <= this.config.fixedBuffer) ||
      this.inputQueue.length === 0
    ) {
      // Insufficient data, freeze.
      this.doFreeze();
      return;
    }
    if (this.frozen) {
      this.doUnfreeze();
    }
    // Process input queue until we have no data remaining.
    while (this.inputQueue.length > this.config.fixedBuffer) {
      let frame = this.inputQueue.shift();
      if (!frame) break;
      this.tickId = frame.id;
      for (let i = 0; i < frame.actions.length; ++i) {
        let action = frame.actions[i];
        // TODO pull out from this function to enable V8 optimization
        let result, error;
        try {
          result = this.machine.run(action);
        } catch (e) {
          result = e;
          error = true;
        }
        if (
          action.clientId === this.connector.getClientId() &&
          this.promises[action.promiseId] != null
        ) {
          let promises = this.promises[action.promiseId];
          if (error) {
            promises.reject(result);
          } else {
            promises.resolve(result);
          }
          delete this.promises[action.promiseId];
        } else if (error) {
          this.handleError(result);
        }
      }
      this.emit('tick', this.tickId);
    }
    // Since machine will call push function by itself, we don't need to
    // handle it.
  }
  doFreeze(_client?: unknown) {
    if (!this.frozen) return;
    this.frozen = 1;
    this.emit('freeze');
  }
  doUnfreeze(_client?: unknown) {
    this.frozen = 0;
    this.emit('unfreeze');
  }
  handleConnect(data: ConnectionData<S>, _clientId?: number) {
    // Server has sent the startup state information.
    if (this.started) {
      this.emit(
        'error',
        'Client startup already done; but server sent' + 'connection info'
      );
      return;
    }
    this.tickId = data.tickId;
    this.config = data.config;
    this.meta = data.meta;
    this.machine.loadState(data.state);
    this.start();
    // Send ACK right away
    this.connector.ack(
      {
        id: this.tickId,
        actions: this.outputQueue,
      },
      this.connector.getHostId()
    );
    this.outputQueue = [];
    this.emit('connect');
  }
  // Handle disconnect - remove client, trigger action, etc...
  handleDisconnect(_clientId?: number) {
    // Disconnected...
    this.stop();
    this.emit('disconnect');
  }
  handleError(error: unknown, _clientId?: number) {
    console.log('Lockstep Client Error:', error);
    this.emit('error', error);
  }
}
