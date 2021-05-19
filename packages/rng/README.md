# @thorium-sim/rng

A pseudo-random number generation framework. Built with https://github.com/dubzzz/pure-rand

## Problem

You want to do deterministic random number generation with the ability to set the random seed. You also need the ability to jump forward an arbitrary number of steps when initializing the RNG. Finally, you want some convenience methods for generating more than just numbers between 0 and 1.

## Solution

This package uses the [`pure-rand`](https://github.com/dubzzz/pure-rand) package under the hood, along with the Mersenne Twister algorithm, for fast, deterministic random number generation. The RNGs support methods for generating floats, ints, strings of different lengths, and picking random values from an array.

## Installation

```bash
npm install @thorium-sim/rng
```

## Usage

```ts
import { createRNG } from '@thorium-sim/rng';

const rng1 = createRNG('hello.');

console.log(rng1.next()); // 0.7820937772705439
console.log(rng1.nextInt(1, 10)); // 6
console.log(rng1.nextString(5)); // Tigun
console.log(rng1.nextFromList(['random', 'number', 'generator'])); // generator

const rng2 = createRNG('hello.');
console.log(rng2.next()); // 0.7820937772705439
```

> Note: In development mode, namely when `process.env.NODE_ENV` is not 'production' or 'test', this package will poison the `Math.random` global to make it trigger a warning any time it is used. This is to serve as a reminder to not use `Math.random` so the program remains deterministic.

## API

`createRNG(seed: number | string, skip?:number): RNG`

Creates a new random number generator instance. You can pass it either a number or a string, which will be hashed into a number before being fed in as the seed. You can optionally pass in the number of generation iterations to skip, in case you need to sync your RNG up with another separate RNG. This returns an RNG object with several methods for generating random values.

### next `() => number`

Returns a random number between 0 and 1 inclusive.

### nextInt `(min:number, max:number) => number`

Returns a random integer between the min number and the max number. Both min and max are required.

### nextBoolean `() => boolean`

Returns a random boolean value, either `true` or `false`.

### nextChar `(chars?: string) => string`

_`chars` default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'_

Returns a random character. You can optionally pass it a list of characters to pick from.

### nextString `(length?: number, chars?:string) => string`

_`length` default: 16_
_`chars` default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'_

Returns a random string of `length` composed of the `chars` that are passed in.

### nextFromList `<T>(list:T[]) => T`

Returns a random item from the provided list.

### setRng `(newRng: RandomGenerator) => void`

A lower-level API that allows you to manually set the internal RNG to one created by the `pure-rand` package.

### rng `RandomGenerator`

The internal RNG created by the `pure-rand` package.

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
