import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Este script debe ejecutarse mediante `npm run dev`.');
}

const children = [];
let stopping = false;

function portIsBusy(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function assertPortsAvailable() {
  for (const port of [3000, 4000]) {
    if (await portIsBusy(port)) {
      throw new Error(
        `El puerto ${port} ya está ocupado. Cierra la instancia anterior antes de ejecutar npm run dev.`,
      );
    }
  }
}

function startWorkspace(workspace) {
  const child = spawn(
    process.execPath,
    [npmCli, 'run', 'dev', '--workspace', workspace],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  children.push(child);
  return child;
}

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

async function waitForBackend(child) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('El backend se cerró antes de quedar disponible.');
    }

    try {
      const response = await fetch('http://127.0.0.1:4000/api/v1/health', {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // Nest todavía está compilando.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('El backend no respondió en 60 segundos.');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}

try {
  await assertPortsAvailable();

  const backend = startWorkspace('backend');
  await waitForBackend(backend);

  console.log('\nBackend disponible. Iniciando frontend...\n');
  startWorkspace('frontend');

  for (const child of children) {
    child.on('exit', (code) => {
      if (stopping) return;
      process.exitCode = code || 1;
      stop();
    });
  }
} catch (error) {
  stop();
  console.error(`\nNo se pudo iniciar Crevantia: ${error.message}\n`);
  process.exitCode = 1;
}
