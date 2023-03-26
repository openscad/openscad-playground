// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

type KVObject = {[key: string]: any};
type KVEntriesMap = Map<KVObject, [string, any][]>;

/**
 * 
 * @param o the object we want to mutate
 * @param mutate a function that modifies any part of the object.
 * @returns an object tree in which each node is identical to its original if no value under its subtree truly changed. If any did, the node's identity is new.
 */
export function bubbleUpDeepMutations<T extends KVObject>(o: T, mutate: (o: T) => void): T {
  const allOriginalEntries = collectObjectEntriesDeeply(o);
  mutate(o);
  return bubbleChangesUp(o, allOriginalEntries) as T;
}

function collectObjectEntriesDeeply(o: KVObject, out: KVEntriesMap = new Map()): KVEntriesMap {
  if (out.get(o)) {
    return out; // Graph cycle
  }
  
  const entries = [...Object.entries(o)];
  out.set(o, entries);
  for (const [, v] of entries) {
    if (typeof v !== 'object') {
      continue;
    }
    if (v instanceof RegExp ||
      v instanceof Blob) {
      continue;
    }
    collectObjectEntriesDeeply(v, out);
  }
  return out;
}

function bubbleChangesUp(o: KVObject, allOriginalEntries: KVEntriesMap) {
  if (o == null || typeof o !== 'object') {
    return o;
  }
  const entries = Object.entries(o);
  const originalEntries = allOriginalEntries.get(o);
  if (!originalEntries) {
    // the object has already changed as we can't find it, return it = new
    return o;
  }

  let changed = false;
  if (entries.length != originalEntries.length) {
    changed = true;
  } else {
    for (let i = 0; i < entries.length; i++) {
      const [originalName, originalValue] = originalEntries[i];
      const [newName, newValue] = entries[i];
      if (originalName !== newName) {
        changed = true;
        break;
      }
      const updatedValue = bubbleChangesUp(newValue, allOriginalEntries);
      if (updatedValue !== originalValue) {
        changed = true;
        break;
      }
    }
  }
  return changed ? Object.fromEntries(entries) : o;
}