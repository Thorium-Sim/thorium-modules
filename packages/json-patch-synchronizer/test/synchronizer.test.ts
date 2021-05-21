import { createSynchronizer } from '../src';

describe('synchronizer', () => {
  it('works', () => {
    const starting: { a: number; b?: number; c?: number[] } = { a: 1 };
    const sendPatches = jest.fn();
    const sync = createSynchronizer(starting, {
      maxOperations: 4,
      onSendPatches: sendPatches,
      throttleTimeMs: null,
    });
    expect(sendPatches).not.toHaveBeenCalled();
    sync.applyPatches([
      { op: 'add', path: '/b', value: 5 },
      { op: 'add', path: '/c', value: [] },
    ]);
    expect(sync.b).toEqual(5);
    expect(sendPatches).not.toHaveBeenCalled();
    if (sync.b && sync.c) {
      sync.b++;
      expect(sendPatches).not.toHaveBeenCalled();
      sync.c.push(5);
      expect(sendPatches).not.toHaveBeenCalled();
    }

    sync.a++;
    expect(sendPatches).toHaveBeenCalledWith([
      { op: 'replace', path: '/a', value: 2 },
      { op: 'add', path: '/b', value: 6 },
      { op: 'add', path: '/c', value: [5] },
    ]);
  });
  it('works with a throttle', async () => {
    const wait = () => new Promise(res => setTimeout(res, 500));
    const starting: { a: number; b?: number; c?: number[] } = { a: 1 };
    const sendPatches = jest.fn();
    const sync = createSynchronizer(starting, {
      maxOperations: 40,
      onSendPatches: sendPatches,
      throttleTimeMs: 250,
    });
    expect(sendPatches).not.toHaveBeenCalled();
    sync.a++;
    sync.a++;
    sync.a++;
    expect(sendPatches).not.toHaveBeenCalled();
    await wait();
    expect(sendPatches).toHaveBeenCalledWith([
      { op: 'replace', path: '/a', value: 4 },
    ]);
  });
});
