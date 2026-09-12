'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const child = spawn(process.execPath, [
  '--watch', '--watch-path=server.js', '--watch-path=lib', '--watch-path=scripts/live-reload.js', 'server.js'
], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, SF_DEV_RELOAD: '1' },
  stdio: 'inherit'
});

child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
