import jsonPatch, { Observer, Operation } from 'fast-json-patch';
import throttle from 'lodash.throttle';

function noop() {}

let isProxy = Symbol('isProxy');

interface SynchronizerOptions<T> {
  maxOperations?: number;
  onSendPatches?: ({ patch, state }: { patch: Operation[]; state: T }) => void;
  throttleTimeMs?: number | null;
}
export function createSynchronizer<T extends {}>(
  target: T & { applyPatches?: (patches: Operation[]) => void },
  options: SynchronizerOptions<T> = {}
): T & { applyPatches: (patches: Operation[]) => void } {
  let proxy: T;
  let operationCount = 0;
  const {
    maxOperations = 1,
    onSendPatches = noop,
    throttleTimeMs = null,
  } = options;
  const observer: Observer<Object> = jsonPatch.observe(target);

  const runGenerateThrottle = throttle(
    () => runGenerate(true),
    throttleTimeMs || 1000,
    {
      trailing: true,
      leading: false,
    }
  );

  function runGenerate(throttled?: boolean) {
    operationCount++;
    if ((maxOperations && operationCount >= maxOperations) || throttled) {
      operationCount = 0;
      runGenerateThrottle.cancel();
      const patch = jsonPatch
        .generate(observer)
        .filter((patch) => patch.path !== '/applyPatches');
      onSendPatches({ patch, state: target });
    }
  }

  let receivingPatches = false;
  function applyPatches(patches: Operation[]) {
    receivingPatches = true;
    jsonPatch.applyPatch(proxy, patches, true, true);
    receivingPatches = false;
  }
  target.applyPatches = applyPatches;
  const handler: ProxyHandler<any> = {
    get(target, key) {
      if (key === 'applyPatches') {
        return applyPatches;
      }
      if (key === isProxy) return true;
      if (
        !target[isProxy] &&
        Object.getOwnPropertyDescriptor(target, key) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !(target[key] instanceof Date)
      ) {
        return new Proxy(target[key], handler);
      } else {
        return target[key];
      }
    },
    set(target, key, value) {
      target[key] = value;
      if (!receivingPatches && key !== 'applyPatches') {
        if (throttleTimeMs) {
          runGenerateThrottle();
        } else {
          runGenerate();
        }
      }
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      if (!receivingPatches) {
        if (throttleTimeMs) {
          runGenerateThrottle();
        } else {
          runGenerate();
        }
      }
      return true;
    },
  };
  proxy = new Proxy(target, handler);
  return proxy as T & { applyPatches: (patches: Operation[]) => void };
}
