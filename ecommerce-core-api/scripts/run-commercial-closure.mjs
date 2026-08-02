import { spawn } from 'node:child_process';
import process from 'node:process';

if (!process.env.COMMERCIAL_CLOSURE_DATABASE_URL?.trim()) {
  console.error('COMMERCIAL_CLOSURE_DATABASE_URL is required; mandatory PostgreSQL tests were NOT RUN.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', '--test-concurrency=1', 'test/commercial-closure.pg.cjs'], {
  cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: false,
});
child.on('error', (error) => { console.error(error); process.exit(1); });
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Commercial closure suite terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
