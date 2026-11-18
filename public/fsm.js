/* Lightweight browser Finite State Machine kernel + ring-buffer tracer for UX / DX / AX */
(function () {
  'use strict';

  const CAPACITY = 300;
  const ring = new Array(CAPACITY);
  let writeIdx = 0;
  let totalCount = 0;
  let seqCounter = 0;
  let autoIdCounter = 0;
  const instances = new Map();

  const registry = {
    registerInstance(machine, instanceId, getState) {
      const key = machine + ':' + instanceId;
      instances.set(key, {
        machine,
        instanceId,
        getState,
        updatedAt: Date.now(),
        transitionCount: 0
      });
      return key;
    },
    unregisterInstance(key) {
      instances.delete(key);
    },
    record(key, machine, instanceId, from, event, to, rejected, meta) {
      const now = Date.now();
      const entry = {
        seq: ++seqCounter,
        ts: now,
        machine,
        instanceId,
        from,
        event,
        to
      };
      if (rejected) entry.rejected = true;
      if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
        entry.meta = meta;
      }
      ring[writeIdx] = entry;
      writeIdx = (writeIdx + 1) % CAPACITY;
      if (totalCount < CAPACITY) totalCount++;
      const inst = instances.get(key);
      if (inst) {
        inst.updatedAt = now;
        if (!rejected) inst.transitionCount++;
      }
      return entry;
    },
    getTrace(limit) {
      const maxItems = Math.max(0, Math.min(typeof limit === 'number' ? limit : 100, totalCount));
      if (maxItems === 0) return [];
      const out = [];
      const start = (writeIdx - maxItems + CAPACITY) % CAPACITY;
      for (let i = 0; i < maxItems; i++) {
        const item = ring[(start + i) % CAPACITY];
        if (item) out.push(item);
      }
      return out;
    },
    listInstances() {
      const out = [];
      for (const inst of instances.values()) {
        out.push({
          machine: inst.machine,
          instanceId: inst.instanceId,
          state: inst.getState(),
          updatedAt: inst.updatedAt,
          transitionCount: inst.transitionCount
        });
      }
      return out;
    },
    clearTrace() {
      ring.fill(undefined);
      writeIdx = 0;
      totalCount = 0;
    }
  };

  function createMachine(config) {
    const name = String(config.name || 'anonymous');
    const id = String(config.id || name + '-' + ++autoIdCounter);
    let current = config.initial;
    const transitions = config.transitions || {};
    const listeners = new Set();
    const regKey = registry.registerInstance(name, id, () => current);

    function syncDomAttr() {
      if (config.bindDataset && config.bindDataset.element && config.bindDataset.attr) {
        try {
          config.bindDataset.element.setAttribute(config.bindDataset.attr, String(current));
        } catch (_) {}
      }
    }

    syncDomAttr();

    function notify(from, to, event, payload) {
      syncDomAttr();
      if (typeof config.onTransition === 'function') {
        try {
          config.onTransition({ from, to, event, payload });
        } catch (_) {}
      }
      for (const fn of listeners) {
        try {
          fn({ from, to, event, payload });
        } catch (_) {}
      }
    }

    return {
      name,
      id,
      get state() {
        return current;
      },
      is() {
        for (let i = 0; i < arguments.length; i++) {
          if (arguments[i] === current) return true;
        }
        return false;
      },
      can(event) {
        const table = transitions[current];
        return Boolean(table && Object.prototype.hasOwnProperty.call(table, event));
      },
      send(event, payload, meta) {
        const from = current;
        const table = transitions[from];
        const spec = table ? table[event] : undefined;
        if (spec === undefined) {
          registry.record(regKey, name, id, from, event, from, true, meta);
          return false;
        }
        const next = typeof spec === 'function' ? spec({ from, event, payload }) : spec;
        if (!next) {
          registry.record(regKey, name, id, from, event, from, true, meta);
          return false;
        }
        current = next;
        registry.record(regKey, name, id, from, event, next, false, meta);
        notify(from, next, event, payload);
        return true;
      },
      force(next, reason, meta) {
        const from = current;
        current = next;
        const ev = '$force:' + (reason || 'manual');
        registry.record(regKey, name, id, from, ev, next, false, meta);
        if (from !== next) {
          notify(from, next, ev, undefined);
        } else {
          syncDomAttr();
        }
      },
      subscribe(fn) {
        listeners.add(fn);
        return function () {
          listeners.delete(fn);
        };
      },
      dispose() {
        listeners.clear();
        registry.unregisterInstance(regKey);
      }
    };
  }

  window.GitMapFsm = {
    createMachine,
    registry
  };
})();
