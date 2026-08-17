import { spawn, spawnSync } from 'node:child_process';
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

async function isCrevantiaBackend() {
  try {
    const response = await fetch('http://127.0.0.1:4000/api/v1/health', {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isCrevantiaFrontend() {
  try {
    const response = await fetch('http://127.0.0.1:3000/iniciar-sesion', {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('Crevantia');
  } catch {
    return false;
  }
}

function stopChild(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.killed) return;

  if (process.platform === 'win32' && child.pid) {
    // npm crea procesos nietos para Nest y Next; /T evita dejarlos huérfanos.
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill(signal);
}

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) stopChild(child, signal);
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
  child.once('exit', (code) => {
    if (stopping) return;
    console.error(`\n${workspace} se cerró inesperadamente (código ${code ?? 'desconocido'}).\n`);
    process.exitCode = code || 1;
    stop();
  });
  return child;
}

async function waitForBackend(child) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('El backend se cerró antes de quedar disponible.');
    }

    if (await isCrevantiaBackend()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('El backend no respondió en 60 segundos.');
}

async function inspectServices() {
  const [frontendPortBusy, backendPortBusy] = await Promise.all([
    portIsBusy(3000),
    portIsBusy(4000),
  ]);
  const [frontendReady, backendReady] = await Promise.all([
    frontendPortBusy ? isCrevantiaFrontend() : false,
    backendPortBusy ? isCrevantiaBackend() : false,
  ]);

  if (frontendPortBusy && !frontendReady) {
    throw new Error('El puerto 3000 está ocupado por otra aplicación.');
  }
  if (backendPortBusy && !backendReady) {
    throw new Error('El puerto 4000 está ocupado por otra aplicación.');
  }

  return { frontendReady, backendReady };
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}
process.on('exit', () => stop());

try {
  const services = await inspectServices();

  if (services.frontendReady) console.log('Frontend existente detectado en http://localhost:3000');
  if (services.backendReady) console.log('Backend existente detectado en http://localhost:4000');

  if (!services.backendReady) {
    const backend = startWorkspace('backend');
    await waitForBackend(backend);
    console.log('\nBackend disponible en http://localhost:4000\n');
  }

  if (!services.frontendReady) {
    console.log('Iniciando frontend en http://localhost:3000\n');
    startWorkspace('frontend');
  }

  if (services.frontendReady && services.backendReady) {
    console.log('\nCrevantia ya está ejecutándose. No se inició una segunda instancia.\n');
  }
} catch (error) {
  stop();
  console.error(`\nNo se pudo iniciar Crevantia: ${error.message}\n`);
  process.exitCode = 1;
}
