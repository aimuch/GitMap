/**
 * Lightweight, zero-dependency Finite State Machine kernel + ring-buffer transition tracer
 * for deterministic lifecycle management and DX/AX runtime diagnostics.
 */

export interface FsmTransitionRecord {
  seq: number;
  ts: number;
  machine: string;
  instanceId: string;
  from: string;
  event: string;
  to: string;
  rejected?: boolean;
  meta?: Record<string, unknown>;
}

export interface FsmInstanceSnapshot {
  machine: string;
  instanceId: string;
  state: string;
  updatedAt: number;
  transitionCount: number;
}

export class FsmTraceRegistry {
  private readonly buffer: Array<FsmTransitionRecord | undefined>;
  private readonly capacity: number;
  private writeIndex = 0;
  private totalCount = 0;
  private seqCounter = 0;
  private readonly instances = new Map<string, { machine: string; instanceId: string; getState: () => string; updatedAt: number; transitionCount: number }>();

  constructor(capacity = 250) {
    this.capacity = Math.max(16, capacity);
    this.buffer = new Array(this.capacity);
  }

  public registerInstance(machine: string, instanceId: string, getState: () => string): string {
    const key = `${machine}:${instanceId}`;
    this.instances.set(key, {
      machine,
      instanceId,
      getState,
      updatedAt: Date.now(),
      transitionCount: 0
    });
    return key;
  }

  public unregisterInstance(key: string): void {
    this.instances.delete(key);
  }

  public record(
    key: string,
    machine: string,
    instanceId: string,
    from: string,
    event: string,
    to: string,
    rejected = false,
    meta?: Record<string, unknown>
  ): FsmTransitionRecord {
    const now = Date.now();
    const entry: FsmTransitionRecord = {
      seq: ++this.seqCounter,
      ts: now,
      machine,
      instanceId,
      from,
      event,
      to,
      ...(rejected ? { rejected: true } : {}),
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {})
    };
    this.buffer[this.writeIndex] = entry;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.totalCount < this.capacity) {
      this.totalCount++;
    }
    const inst = this.instances.get(key);
    if (inst) {
      inst.updatedAt = now;
      if (!rejected) inst.transitionCount++;
    }
    return entry;
  }

  public getTrace(limit = 100): FsmTransitionRecord[] {
    const maxItems = Math.max(0, Math.min(limit, this.totalCount));
    if (maxItems === 0) return [];
    const result: FsmTransitionRecord[] = [];
    const startOffset = (this.writeIndex - maxItems + this.capacity) % this.capacity;
    for (let i = 0; i < maxItems; i++) {
      const item = this.buffer[(startOffset + i) % this.capacity];
      if (item) result.push(item);
    }
    return result;
  }

  public listInstances(): FsmInstanceSnapshot[] {
    const out: FsmInstanceSnapshot[] = [];
    for (const inst of this.instances.values()) {
      out.push({
        machine: inst.machine,
        instanceId: inst.instanceId,
        state: inst.getState(),
        updatedAt: inst.updatedAt,
        transitionCount: inst.transitionCount
      });
    }
    return out;
  }

  public clearTrace(): void {
    this.buffer.fill(undefined);
    this.writeIndex = 0;
    this.totalCount = 0;
  }
}

export const fsmRegistry = new FsmTraceRegistry(300);

export type FsmTargetResolver<S extends string, E extends string, P = unknown> =
  | S
  | ((ctx: { from: S; event: E; payload?: P }) => S | null | undefined);

export interface StateMachineConfig<S extends string, E extends string, P = unknown> {
  name: string;
  id?: string;
  initial: S;
  transitions: Record<S, Partial<Record<E, FsmTargetResolver<S, E, P>>>>;
  registry?: FsmTraceRegistry;
  onTransition?: (info: { from: S; to: S; event: E | string; payload?: P }) => void;
}

let autoInstanceSeq = 0;

export class StateMachine<S extends string, E extends string, P = unknown> {
  public readonly name: string;
  public readonly id: string;
  private current: S;
  private readonly transitions: Record<S, Partial<Record<E, FsmTargetResolver<S, E, P>>>>;
  private readonly registry: FsmTraceRegistry;
  private readonly registryKey: string;
  private readonly onTransition?: (info: { from: S; to: S; event: E | string; payload?: P }) => void;
  private readonly listeners = new Set<(info: { from: S; to: S; event: E | string; payload?: P }) => void>();

  constructor(config: StateMachineConfig<S, E, P>) {
    this.name = config.name;
    this.id = config.id || `${config.name}-${++autoInstanceSeq}`;
    this.current = config.initial;
    this.transitions = config.transitions;
    this.registry = config.registry || fsmRegistry;
    this.onTransition = config.onTransition;
    this.registryKey = this.registry.registerInstance(this.name, this.id, () => this.current);
  }

  public get state(): S {
    return this.current;
  }

  public is(...states: S[]): boolean {
    return states.includes(this.current);
  }

  public can(event: E): boolean {
    const table = this.transitions[this.current];
    return Boolean(table && Object.prototype.hasOwnProperty.call(table, event));
  }

  public send(event: E, payload?: P, meta?: Record<string, unknown>): boolean {
    const from = this.current;
    const table = this.transitions[from];
    const targetSpec = table ? table[event] : undefined;
    if (targetSpec === undefined) {
      this.registry.record(this.registryKey, this.name, this.id, from, event, from, true, meta);
      return false;
    }
    const next: S | null | undefined =
      typeof targetSpec === 'function'
        ? (targetSpec as (ctx: { from: S; event: E; payload?: P }) => S | null | undefined)({ from, event, payload })
        : (targetSpec as S);
    if (!next) {
      this.registry.record(this.registryKey, this.name, this.id, from, event, from, true, meta);
      return false;
    }
    this.current = next;
    this.registry.record(this.registryKey, this.name, this.id, from, event, next, false, meta);
    if (next !== from || targetSpec !== undefined) {
      this.onTransition?.({ from, to: next, event, payload });
      for (const listener of this.listeners) {
        try {
          listener({ from, to: next, event, payload });
        } catch (_) {}
      }
    }
    return true;
  }

  public force(next: S, reason = 'manual', meta?: Record<string, unknown>): void {
    const from = this.current;
    this.current = next;
    const syntheticEvent = `$force:${reason}`;
    this.registry.record(this.registryKey, this.name, this.id, from, syntheticEvent, next, false, meta);
    if (from !== next) {
      this.onTransition?.({ from, to: next, event: syntheticEvent });
      for (const listener of this.listeners) {
        try {
          listener({ from, to: next, event: syntheticEvent });
        } catch (_) {}
      }
    }
  }

  public subscribe(listener: (info: { from: S; to: S; event: E | string; payload?: P }) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.listeners.clear();
    this.registry.unregisterInstance(this.registryKey);
  }
}
