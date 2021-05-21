# @thorium-sim/tab-id

Creates unique, persistent IDs between tabs and windows using browser `localStorage`, `sessionStorage`, and `BroadcastChannel`.

## Problem

You need some way to uniquely identify each open tab of your app and have those IDs persist between sessions.

## Solution

By storing a list of IDs in `localStorage`, using `BroadcastChannel` to coordinate IDs between open tabs, and `sessionStorage` to store the current tab's ID, each browser tab can maintain its own independent unique ID.

## Usage

Install with NPM.

```bash
npm install @thorium-sim/tab-id
```

Then import and use the `getTabId` function.

```js
import { getTabId } from '@thorium-sim/tab-id';

async function initializeApp() {
  const tabId = await getTabId();
  // ...
}
```

This function has to be an async function because of the delay in using `BroadcastChannel`. However, once the `tabId` has been retrieved once, you can use `getTabIdSync` to get it synchronously. Because of this, there is a helper `initializeTabId` function which can be run when your app first loads.

```js
import { initializeTabId, getTabIdSync } from '@thorium-sim/tab-id';

initializeTabId();

// This function must be called a short time after initializeTabId
function useTabId() {
  const tabId = getTabIdSync();
  // ...
}
```

You can also set the tab ID to any other string value that you want. Since the tab ID isn't reactive, you might want to refresh the browser after this operation.

```js
import { setTabId } from '@thorium-sim/tab-id';

function updateTabId() {
  setTabId('blah');
  location.reload();
}
```

Finally, there is a React hook which _is_ reactive when you use the built-in set function.

```js
import { useClientId } from '@thorium-sim/tab-id';

const App = () => {
  const [clientId, setClientId] = useClientId();
  // ...
};
```
