// npm run build:kit [-- --renders seat]
// Blender (headless) → tools/blender/out → gltf-transform (meshopt) → public/models/cabin-kit.glb.
import { copyFileSync, statSync } from 'node:fs';
import { OUT, optimize, runBlender } from './gltf.mjs';

runBlender('tools/blender/build_kit.py', process.argv.slice(2));
optimize(`${OUT}/cabin-kit.glb`, 'public/models/cabin-kit.glb');
copyFileSync(`${OUT}/cabin-kit.meta.json`, 'public/models/cabin-kit.meta.json');
console.log(`public/models/cabin-kit.glb: ${(statSync('public/models/cabin-kit.glb').size / 1e3).toFixed(0)} KB`);
