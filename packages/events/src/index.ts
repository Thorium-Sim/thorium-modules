import { NetSendResult, NetSendInput } from '@thorium-sim/types';
import deepMerge from 'deepmerge';
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const idLength = 16;
function randomId() {
  let id = '';
  while (id.length < idLength) {
    id += chars.substr(Math.trunc(Math.random() * chars.length - 1), 1);
  }
  return id;
}

type EventHandler = (
  event: { params: NetSendInput; context: object },
  dataModel: any
) => NetSendResult;

export function createEventStore(keepLogs: boolean = false) {
  const inputTypes: Record<string, string[]> = {};
  const eventHandlers: Record<string, EventHandler> = {};

  const eventLog: {
    inputType: string;
    input: NetSendInput;
    context: object;
    timestamp: number;
  }[] = [];

  function registerEventHandler(
    inputType: string,
    eventHandler: EventHandler
  ): string {
    const handlerSymbol = randomId();
    inputTypes[inputType] = inputTypes[inputType] || [];
    inputTypes[inputType].push(handlerSymbol);
    eventHandlers[handlerSymbol] = eventHandler;
    return handlerSymbol;
  }

  async function handleEvent(
    inputType: string,
    input: NetSendInput,
    context: object = {},
    dataModel: any
  ) {
    if (keepLogs) {
      eventLog.push({ inputType, input, context, timestamp: Date.now() });
    }
    const results = await Promise.all(
      inputTypes[inputType]?.map(handlerId => {
        const handler = eventHandlers[handlerId];
        if (!handler) return {};
        return handler({ params: input, context }, dataModel);
      }) || []
    );
    if (results.length === 1) return results[0];
    return deepMerge.all(results);
  }

  function getEventLog() {
    return eventLog;
  }

  return {
    registerEventHandler,
    handleEvent,
    getEventLog,
  };
}
