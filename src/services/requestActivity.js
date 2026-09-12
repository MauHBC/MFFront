const listeners = new Set();
let pendingMutations = 0;

const notify = () => listeners.forEach((listener) => listener(pendingMutations));

export function beginMutationRequest() {
  pendingMutations += 1;
  notify();
}

export function endMutationRequest() {
  pendingMutations = Math.max(0, pendingMutations - 1);
  notify();
}

export function hasPendingMutationRequest() {
  return pendingMutations > 0;
}

export function subscribeToMutationRequests(listener) {
  listeners.add(listener);
  listener(pendingMutations);
  return () => listeners.delete(listener);
}
