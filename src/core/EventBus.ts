/**
 * Tiny typed event bus used to decouple systems (combat → UI, relics → combat,
 * etc.). It intentionally has no dependencies and no async plumbing — game
 * events fire synchronously during simulation so the render layer can pick
 * them up in the next frame.
 */

export type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<EventHandler<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers[event];
    if (!set) {
      set = new Set();
      this.handlers[event] = set;
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers[event];
    if (!set) return;
    // copy to allow listeners to unsubscribe during iteration
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (err) {
        // Never let a misbehaving subscriber break the simulation.
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler for '${String(event)}' threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers = {};
  }
}
