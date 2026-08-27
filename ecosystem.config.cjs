const path = require('node:path');

const root = __dirname;
const environment =
  process.env.EFOLUSI_DEPLOY_ENVIRONMENT ??
  (root.includes(`${path.sep}efolusi-dev${path.sep}`) ? 'dev' : 'prod');
const port = process.env.EARTHOS_NATIVE_PORT ?? '13106';

if (environment !== 'dev') {
  throw new Error('EarthOS native web is dev-only; main remains on Cloudflare');
}

module.exports = {
  apps: [
    {
      name: 'efolusi-dev-earthos-web',
      cwd: root,
      script: 'pnpm',
      args: `--filter @earthos/web start -- -H 127.0.0.1 -p ${port}`,
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      kill_timeout: 15_000,
      listen_timeout: 15_000,
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: port,
      },
      output: '/home/deploy/logs/efolusi-dev-earthos-web.out.log',
      error: '/home/deploy/logs/efolusi-dev-earthos-web.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
