import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileLogic } from './compile-logic.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let compiling = false;
let queued = false;
let timer;

async function compile() {
  if (compiling) { queued = true; return; }
  compiling = true;
  try {
    const result = await compileLogic({ root:appRoot });
    if (result.changed) console.log('[logic] compiled; local server will restart');
  } catch (error) {
    console.error(`[logic] compile failed; keeping the last valid build\n${error.message}`);
  } finally {
    compiling = false;
    if (queued) { queued = false; void compile(); }
  }
}

await compileLogic({ root:appRoot });
const child = spawn(process.execPath, ['--watch', 'local-server.mjs'], { cwd:appRoot, stdio:'inherit' });
const watchers = ['logic-src', 'content'].map(directory => watch(path.join(appRoot, directory), { recursive:true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => void compile(), 150);
}));

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  if (!child.killed) child.kill(signal);
}

for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop(signal));
child.on('exit', code => {
  stop('SIGTERM');
  process.exitCode = code ?? 0;
});

