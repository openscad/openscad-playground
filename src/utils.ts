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
