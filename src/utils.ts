// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Source } from "./state/app-state";

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
  // return AbortablePromise<SyntaxCheckOutput>((res, rej) => {
  //   (async () => {
  //     try {
  //       const result = await job;
  //       // console.log(result);

  //       let parameterSet: ParameterSet | undefined = undefined;
  //       if (result.outputs && result.outputs.length == 1) {
  //         let [[, content]] = result.outputs;
  //         content = new TextDecoder().decode(content as any);
  //         try {
  //           parameterSet = JSON.parse(content)
  //           // console.log('PARAMETER SET', JSON.stringify(parameterSet, null, 2))
  //         } catch (e) {
  //           console.error(`Error while parsing parameter set: ${e}\n${content}`);
  //         }
  //       } else {
  //         console.error('No output from runner!');
  //       }

  //       res({
  //         ...processMergedOutputs(result.mergedOutputs, {shiftSourceLines: {
  //           sourcePath: sources[0].path,
  //           skipLines: 1,
  //         }}),
  //         parameterSet,
  //       });
  //     } catch (e) {
  //       console.error(e);
  //       rej(e);
  //     }
  //   })()
  //   return () => job.kill();
  // });
  //return (...args: T) => async ({now, callback}: {now: boolean, callback: (result?: R, error?: any) => void}) => {
  return (...args: T) => ({now}: {now: boolean}) => AbortablePromise<R>((resolve, reject) => {
    let abortablePromise: AbortablePromise<R> | undefined = undefined;
    (async () => {
      const doExecute = async () => {
        if (runningJobKillSignal) {
          runningJobKillSignal();
          runningJobKillSignal = null;
        }
        abortablePromise = job(...args);
        runningJobKillSignal = abortablePromise.kill;
        try {
          resolve(await abortablePromise);
        } catch (e) {
          reject(e);
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
    })();
    return () => abortablePromise?.kill();
  });
}

export function validateStringEnum<T extends string>(
    s: T, values: T[],
    orElse: (s: string) => T = s => { throw new Error(`Unexpected value: ${s} (valid values: ${values.join(', ')})`); }): T {
  return values.indexOf(s) < 0 ? orElse(s) : s;
}
export const validateBoolean = (s: boolean, orElse: () => boolean = () => false) => typeof s === 'boolean' ? s : orElse(); 
export const validateString = (s: string, orElse: () => string = () => '') => s != null && typeof s === 'string' ? s : orElse();
export const validateArray = <T>(a: Array<T>, validateElement: (e: T) => T, orElse: () => T[] = () => []) => {
  if (!(a instanceof Array)) return orElse();
  return a.map(validateElement);
};

export function formatBytes(n: number) {
  if (n < 1024) {
    return `${Math.floor(n)} bytes`;
  }
  n /= 1024;
  if (n < 1024) {
    return `${Math.floor(n * 10) / 10} kB`;
  }
  n /= 1024;
  return `${Math.floor(n * 10) / 10} MB`;
}

export function formatMillis(n: number) {
  if (n < 1000)
    return `${Math.floor(n)}ms`;

  return `${Math.floor(n / 100) / 10}sec`;
}

// https://medium.com/quick-code/100vh-problem-with-ios-safari-92ab23c852a8
export function registerCustomAppHeightCSSProperty() {
  const updateAppHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
  }
  window.addEventListener('resize', updateAppHeight)
  updateAppHeight();
}

// In PWA mode, persist files in LocalStorage instead of the hash fragment.
export function isInStandaloneMode() {
  return Boolean(('standalone' in window.navigator) && (window.navigator.standalone));
}

export function downloadUrl(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename)
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
}

export async function fetchSource(fs: FS, {content, path, url}: Source): Promise<Uint8Array> {
  const isText = path.endsWith('.scad') || path.endsWith('.json');
  if (content) {
    return new TextEncoder().encode(content);
  } else if (url) {
    if (isText) {
      content = await (await fetch(url)).text();
      return new TextEncoder().encode(content.replace(/\r\n/g, '\n'));
    } else {
      // Fetch bytes
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);
      return data;
    }
  } else if (path) {
    const data = fs.readFileSync(path);
    return new Uint8Array('buffer' in data ? data.buffer : data);
  } else {
    throw new Error('Invalid source: ' + JSON.stringify({path, content, url}));
  }
}

export function readFileAsDataURL(file: File) {
  // TO data URI:
  return new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      res(reader.result as string);
    }
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  // return URL.createObjectURL(file);
}