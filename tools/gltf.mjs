// Shared by the model builds: run Blender headless, then compress with gltf-transform.
import { spawnSync } from 'node:child_process';

export const BLENDER = process.env.BLENDER_PATH ?? 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';
export const OUT = 'tools/blender/out';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`\n${command} exited with ${result.status ?? result.error}`);
    process.exit(1);
  }
}

export function runBlender(script, args) {
  // --python-exit-code: a Python exception in the build must fail the run, not ship a half-written meta
  run(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', script, '--', '--out', OUT, ...args]);
}

// Keep named nodes (Door1L, CabinShell, Seat*…) separate and the geometry untouched; only compress.
export function optimize(input, output) {
  run('npx', [
    'gltf-transform', 'optimize', input, output,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '2048',
    '--simplify', 'false',
    '--join-named', 'false',
    '--flatten', 'false',
    '--instance', 'false',
    '--palette', 'false',
  ], { shell: true });
}
