# @thorium-sim/db-fs

A proxy- and filesystem-based database intended for infrequent writes to long-term storage.

## The Problem

Your app is reading data very frequently, so it needs to be stored in-memory while the app is running. However, you still want persistence.

You want to persist data to the file system, but you don't want to have to manually write calls to the database - you just want to mutate a file and have it update in the file system.

Also, you want to have multiple files storing data, not all of it in a single database file.

However, you might be making frequent writes, and you don't want to write to the filesystem too frequently.

## The Solution

When `@thorium-sim/db-fs` loads in your data, it wraps it in a JavaScript proxy. Whenever any of the properties of the data is mutated, it schedules the file to be written using a throttle. After a certain period of time, the current state of the object will be persisted, meaning if the app is shut off unexpectedly some time in the middle, most of the data will still be persisted. This provides maximum convenience with a moderate level of reliability and safety.

## Usage

```bash
npm install @thorium-sim/db-fs
```

Then, you can access a database with the default export, which returns an object. Any properties that you set on that object will be eventually persisted to the database.

```ts
import getStore from '@thorium-sim/db-fs';

const store = getStore(); // Defaults to `./db.json`

store.a = 1;
store.b = 'hello!';
```

> Note: This database is intended to only be used by one client at a time. Once the database is first loaded, it doesn't check to see if there are any changes made by another client. Using two clients with the same database might cause data loss.

It also supports a TypeScript generic to define the type of the data in the database. If you are using nested data structures, like objects and arrays, it's usually best to initialize them when you first create the store. Note that every other time the store initializes, it will use the values from the file system.

```ts
import getStore from '@thorium-sim/db-fs';

interface StoreData {
  a: number;
  b: string;
  c: number[];
}
const store = getStore<StoreData>({ initialData: { a: 1, b: 'Hey', c: [] } });
```

You can also have your database be a JSON-compatible array of data.

```ts
import getStore from '@thorium-sim/db-fs';

interface StoreData {
  a: number;
  b: string;
  c: number[];
}
const store = getStore<StoreData[]>({
  initialData: [{ a: 1, b: 'Hey', c: [] }],
});
```

You can also specify a path to store the database file in. A separate `setBasePath` export lets you set the path for any database created with `@thorium-sim/db-fs`.

```ts
import getStore, {setBasePath} from '@thorium-sim/db-fs`

setBasePath('./databases')

const store = getStore({path:"myData.json"}) // Stored in `./databases/myData.json`
```

The `store` object which is returned from `getStore` includes two extra functions:

### writeFile `async (force?:Boolean) = Promise<void>`

This will queue a write to the database. If you set `force` to `true`, the database will write immediately, without waiting for the throttle.

```ts
import getStore from '@thorium-sim/db-fs';

interface StoreData {
  a: number;
  b: string;
  c: number[];
}
const store = getStore<StoreData>({ initialData: { a: 1, b: 'Hey', c: [] } });
store.writeFile(true); // Write after the throttle is complete - usually unnecessary
store.a = 10;
store.writeFile(true); // Write immediately
```

### removeFile `async () => Promise<void>`

This will permanently delete the database from the file system and remove it from memory. Use with caution.

## Options

All of the options are optional; none need to be provided.

### path `string`

_Default: `db.json`_

Where in the filesystem the database will be stored. This gets appended to the base path, which is set with `setBasePath`

### initialData `T`

_Default: `{}`_

The initial data used when the database is first created. It is an object with the same shape as the generic which is passed to `getStore`.

### throttle `number`

_Default: 30 _ 1000 or 30 seconds\*

The time in milliseconds between saves of the database. Once the store is mutated, a throttle function will wait _at most_ this number of milliseconds before saving. Any mutations made within that time will be included once the database is saved.

### safeMode `boolean`

_Default: false_

This is a development-only feature that does nothing in production. If `safeMode` is set to `true`, the database will only ever write when called with `store.writeFile(true)`. Otherwise, any throttled write operations will be ignored. This is intended to keep the database state in a specific way during development and for automated tests.

If you specifically want to test the throttled writing in a test environment, you can explicitly set `safeMode` to `false`, which will turn on throttled database writes in test mode, namely when `process.env.NODE_ENV === "test".

Throttled writes will always work in production mode, namely when `process.env.NODE_ENV === "production"`

### class `class constructor`

_Default: undefined_

When defined, the store will attempt to turn your database into a class when it instantiates. It will pass the data to the class constructor function you provide and use the resulting class instance as the return value. For databases that store an array, it will loop over the array and pass each item to the class constructor.

### indent `number`

_Default: 2_

The number of spaces to indent the JSON when stored in the file. This makes the data more readable when looking at the database file directly.

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
