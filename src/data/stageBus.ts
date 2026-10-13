import type { Stage } from './sim';

type Handler = (n: Stage) => void;
const handlers = new Set<Handler>();

/** Lets buttons anywhere (protocol strip) drive the Network Lab. */
export function requestStage(n: Stage): void {
  handlers.forEach(h => h(n));
}

export function onStageRequest(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}