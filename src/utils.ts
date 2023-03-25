// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

export function mapObject(o: any, f: (key: string, value: any) => any, ifPred: (key: string) => boolean) {
  const ret = [];
  for (const key of Object.keys(o)) {
    if (ifPred && !ifPred(key)) {
      continue;
    }
    ret.push(f(key, o[key]));
  }
  return ret;
}

type Killer = () => void;
export type AbortablePromise<T> = Promise<T> & {kill: Killer}
export function AbortablePromise<T>(f: (resolve: (result: T) => void, reject: (error: any) => void) => Killer): AbortablePromise<T>
{
  let kill: Killer;
  const promise = new Promise<T>((res, rej) => {
    kill = f(res, rej);
  });
  return Object.assign(promise, {kill: kill!});
}

// <T extends any[]>(...args: T)
export function turnIntoDelayableExecution<T extends any[], R>(
    delay: number,
    job: (...args: T) => AbortablePromise<R>) {
  let pendingId: number | null;
  let runningJobKillSignal: (() => void) | null;

  return (...args: T) => async ({now, callback}: {now: boolean, callback: (result: R) => void}) => {
    const doExecute = async () => {
      if (runningJobKillSignal) {
        runningJobKillSignal();
        runningJobKillSignal = null;
      }
      const abortablePromise = job(...args);
      runningJobKillSignal = abortablePromise.kill;
      try {
        callback(await abortablePromise);
      } finally {
        runningJobKillSignal = null;
      }
    }
    if (pendingId) {
      clearTimeout(pendingId);
      pendingId = null;
    }
    if (now) {
      doExecute();
    } else {
      pendingId = window.setTimeout(doExecute, delay);
    }
  };
}

export const validateString = (s: string, orElse: () => string = () => '') => s != null && typeof s === 'string' ? s : orElse();
export const validateArray = <T>(a: Array<T>, validateElement: (e: T) => T, orElse: () => T[] = () => []) => {
  if (!(a instanceof Array)) return orElse();
  return a.map(validateElement);
}
