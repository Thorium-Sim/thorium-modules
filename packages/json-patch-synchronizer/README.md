# @thorium-sim/json-patch-synchronizer

A tool for seamlessly synchronizing data between two places using JavaScript Proxies and JSON Patches.

## Problem

You've got an object that you want synchronized between two places. Whenever you mutate the object in one place, eventually you want those changes to be applied to the other object, and vice versa.

## Solution

This package lets you create a synchronizer which calls a callback whenever a change is made with the JSON Patch ([RFC6902](http://tools.ietf.org/html/rfc6902)) of the change. This patch is generated using [`fast-json-patch`](https://github.com/Starcounter-Jack/JSON-Patch), and mutations are observed using a JavaScript Proxy.

With another synchronizer somewhere else, you can call the `applyPatches` method on the synchronized object with the patches from the first object, and the changes will be applied. You can set it up to work unidirectionally, or you can support bi-directional changes.

It's up to the developer to do something with the patches, whether it be sending it over a WebSocket or using `window.postMessage` or something else to transport the patch. This makes the package very flexible - transport and use-case agnostic.

## Usage

Install with NPM

```bash
npm install @thorium-sim/rng
```

Then you can create a synchronizer with your object, passing in a callback which is called whenever patches are compiled. This is where you would transmit your patches to the other synchronizer.

```js
import { createSynchronizer } from '@thorium-sim/json-patch-synchronizer';

// For this demo, we have to pre-initialize one of our objects.
let synchronizer2 = {};

const synchronizer1 = createSynchronizer(
  {},
  { onSendPatches: patches => synchronizer2?.applyPatches(patches) }
);
synchronizer2 = createSynchronizer(
  {},
  { onSendPatches: patches => synchronizer1?.applyPatches(patches) }
);

synchronizer1.numberList = [];
synchronizer1.numberList.push(1, 2, 3);

console.log(synchronizer2); // {numberList: [ 1, 2, 3 ]}
```

By default, synchronizers will send their patches immediately. However, it might be more efficient to combine patches together, in case one of the properties is changed multiple times. The `maxOperations` option lets you choose how many options to allow before sending the patch. If more than this number of operations happens, the `onSendPatches` callback will be called.

```js
import { createSynchronizer } from '@thorium-sim/json-patch-synchronizer';

const synchronizer = createSynchronizer(
  {},
  { maxOperations: 5, onSendPatches: patches => console.log('Patches Sent') }
);

// Operation 1
synchronizer.numberList = [];
// Operation 2, 3, and 4
synchronizer.numberList.push(1, 2, 3);
// Operation 5; the patches will be sent
synchronizer.name = 'Alex'; // Patches Sent
```

Of course, if one fewer than the necessary number of operations happens, it won't be synchronized until another operation happens. To help balance this out, you can specify a throttle timeout. That will cause `onSendPatches` to be called _a maximum_ number of milliseconds after a mutation to the synchronizer.

```js
import { createSynchronizer } from '@thorium-sim/json-patch-synchronizer';

const synchronizer = createSynchronizer(
  {},
  { maxOperations: 10, throttleTimeMs: 5000 onSendPatches: patches => console.log('Patches Sent') }
);

// Operation 1
synchronizer.numberList = [];
// Operation 2, 3, and 4
synchronizer.numberList.push(1, 2, 3);
// Operation 5
synchronizer.name = "Alex"

// 5 Seconds pass...
// Patches Sent
```

These two options can be used together, in which case the patches will be sent if the operation threshold is passed _or_ if the throttle time elapses. However, if `0` is passed to `maxOperations`, the patches will only be sent after the throttle time is over.

## API

`createSynchronizer<T>(target: T, options: SynchronizerOptions): T & { applyPatches: (patches: Operation[]) => void }`

Creates a new synchronizer object, based on the values of the `target` parameter. When the returned value is mutated, it will call the `options.onSendPatches` method; the value of the synchronized object can be updated with patches from somewhere else by calling `synchronizer.applyPatches(patches)` with the JSON Patch compatible array of patch objects.

## Options

`onSendPatches` is required; all other options are optional

### onSendPatches `(patches:Operation[]) => void`

_Required_

This function is called at some point after a mutation is made to the synchronizer object. The patches are based on the JSON Patch specification and come in the following shapes:

```
Add: {path:string; op: 'add'; value: T}
Remove: {path: string; op: 'remove'}
Replace: {path:string; op: 'replace'; value: T;}
```

This callback should be used to transmit the patches to somewhere else where they can be applied to another synchronizer object. This can be done with HTTP, WebSockets, `window.postMessage`, or any other kind of transport mechanism.

### maxOperations `number`

_Default: `1`_

The number of operations that will occur before `onSendPatches` is called with the current list of patches. Using a higher number will possibly create more efficient patch lists, combining some of the operations into a single patch; however this will also increase the time between synchronization events.

### throttleTimeMs `number`

_Default: `0`_

The _maximum_ amount of time in milliseconds between when the synchronizer is mutated and when `onSendPatches` is called. Using this in conjunction with `maxOperations` makes sure synchronization events happen after a certain period of time while still combining operations together as much as possible.

## License

Copyright 2021 Fyreworks LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
