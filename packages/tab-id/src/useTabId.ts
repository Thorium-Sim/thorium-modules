import React from 'react';
import { getTabId, setTabId, persistenceKey } from './getTabId';

export function useClientId(): [string, (id: string) => void] {
  const [storedClientId, setClientIdFunc] = React.useState(
    sessionStorage.getItem(persistenceKey) || ''
  );
  const unmounted = React.useRef(false);
  async function runGetClientId() {
    const clientId = await getTabId();
    if (!unmounted.current) {
      setClientIdFunc(clientId);
    }
  }
  React.useEffect(() => {
    if (!storedClientId) {
      runGetClientId();
    }
    return () => {
      unmounted.current = true;
    };
  }, [storedClientId]);
  function doSetClientId(id: string) {
    setClientIdFunc(id);
    setTabId(id);
  }
  return [storedClientId, doSetClientId];
}
