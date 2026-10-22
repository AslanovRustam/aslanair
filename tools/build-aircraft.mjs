// npm run build:aircraft [-- --renders hero,side …]
// Blender (headless) → tools/blender/out → gltf-transform (meshopt + WebP) → public/models.
import { spawnSync } from 'node:child_process';
import { copyFileSync, statSync } from 'node:fs';

const BLENDER = process.env.BLENDER_PATH ?? 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';
const OUT = 'tools/blender/out';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`\n${command} exited with ${result.status ?? result.error}`);
    process.exit(1);
  }
}

run(BLENDER, ['-b', '--factory-startup', '-P', 'tools/blender/build.py', '--', '--out', OUT, ...process.argv.slice(2)]);

// Keep named nodes (Door1L, CabinShell…) separate and the geometry untouched; only compress.
run('npx', [
  'gltf-transform', 'optimize', `${OUT}/airliner.glb`, 'public/models/airliner.glb',
  '--compress', 'meshopt',
  '--texture-compress', 'webp',
  '--texture-size', '2048',
  '--simplify', 'false',
  '--join-named', 'false',
  '--flatten', 'false',
  '--instance', 'false',
  '--palette', 'false',
], { shell: true });

copyFileSync(`${OUT}/airliner.meta.json`, 'public/models/airliner.meta.json');
console.log(`public/models/airliner.glb: ${(statSync('public/models/airliner.glb').size / 1e6).toFixed(2)} MB`);
