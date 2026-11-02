#!/usr/bin/env node
// Re-pins every library (and the font sources) in libs-config.json to the
// current head of its tracked branch. Run via `npm run libs:update`, review the
// diff, then commit. Pass `--check` to only report what would change.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const configFile = 'libs-config.json';
const check = process.argv.includes('--check');
const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

function head(repo, branch) {
  const out = execFileSync('git', ['ls-remote', repo, `refs/heads/${branch}`], { encoding: 'utf-8' });
  const sha = out.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Cannot resolve ${repo}@${branch}`);
  return sha;
}

let changed = 0;
function pin(obj, key, repo, branch, label) {
  const sha = head(repo, branch);
  if (obj[key] !== sha) {
    console.log(`${label}: ${obj[key] ?? '(unpinned)'} -> ${sha}`);
    obj[key] = sha;
    changed++;
  }
}

for (const lib of config.libraries) pin(lib, 'commit', lib.repo, lib.branch, lib.name);
const f = config.fonts;
pin(f, 'liberationCommit', f.liberationRepo, f.liberationBranch, 'liberation fonts');
// notoBaseUrl is https://github.com/<org>/<repo>/raw/<ref>/<dir>/ ; keep it pointing at a commit.
const m = f.notoBaseUrl.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/raw\/([^/]+)\/(.*)$/);
if (!m) throw new Error(`Unexpected notoBaseUrl: ${f.notoBaseUrl}`);
const notoSha = head(`${m[1]}.git`, f.notoBranch ?? 'master');
const notoUrl = `${m[1]}/raw/${notoSha}/${m[3]}`;
if (notoUrl !== f.notoBaseUrl) {
  console.log(`noto fonts: ${m[2]} -> ${notoSha}`);
  f.notoBaseUrl = notoUrl;
  f.notoBranch = f.notoBranch ?? 'master';
  changed++;
}

if (check) {
  console.log(changed ? `${changed} pin(s) out of date` : 'All pins up to date');
} else {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 4) + '\n');
  console.log(changed ? `Updated ${changed} pin(s) in ${configFile}` : 'Nothing to update');
}
