function operand(calc: (a: number, b: number) => number, state: number[]) {
  if (state.length < 2) return [];
  return state
    .slice(0, -2)
    .concat([calc(state[state.length - 1], state[state.length - 2])]);
}

export default function calculator(state: number[] = [], action: any) {
  // This is just a simple stack based calculator, used for testing.
  switch (action.type) {
    case '+':
      return operand((a: number, b: number) => a + b, state);
    case '-':
      return operand((a: number, b: number) => a - b, state);
    case '/':
      return operand((a: number, b: number) => a / b, state);
    case '*':
      return operand((a: number, b: number) => a * b, state);
    case '%':
      return operand((a: number, b: number) => a % b, state);
  }
  if (action.type === 'number') {
    return state.concat([action.value]);
  }
  return state;
}
