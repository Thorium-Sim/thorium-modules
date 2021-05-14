import {
  ActionConstraint,
  SimulationMachine,
  StateConstraint,
} from '@thorium-sim/types';
// A simple replica of Redux for testing.

export default class ReducerMachine<
  S extends StateConstraint,
  A extends ActionConstraint
> implements SimulationMachine<S, A> {
  reducer: (state: S, action: A) => S;
  state: S;
  constructor(reducer: (state: S, action: A) => S, state: S) {
    this.reducer = reducer;
    this.state = state;
    // Doing this to get initial state
    this.run();
  }
  getState() {
    return this.state;
  }
  loadState(state: S) {
    this.state = state;
  }
  run(action?: A) {
    if (!action) return this.state;
    this.state = this.reducer(this.state, action);
    return this.state;
  }
}
