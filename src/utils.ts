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


export function turnIntoDelayableExecution<T>(delay: number, job: () => AbortablePromise<T>, callback: (result: T) => void) {
  let pendingId: number | null;
  let runningJobKillSignal: (() => void) | null;

  const doExecute = async () => {
    if (runningJobKillSignal) {
      runningJobKillSignal();
      runningJobKillSignal = null;
    }
    const abortablePromise = job();
    runningJobKillSignal = abortablePromise.kill;
    try {
      callback(await abortablePromise);
    } finally {
      runningJobKillSignal = null;
    }
  }
  return async ({now}: {now: boolean}) => {
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
export const validateArray = <T>(a: Array<T>, validateElement: (e: T) => T, orElse: () => T[]) => {
  if (!(a instanceof Array)) return orElse();
  return a.map(validateElement);
}
