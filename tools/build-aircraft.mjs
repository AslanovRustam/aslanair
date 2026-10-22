// npm run build:aircraft [-- --renders hero,side …]
// Blender (headless) → tools/blender/out → gltf-transform (meshopt + WebP) → public/models.
import { copyFileSync, statSync } from 'node:fs';
import { OUT, optimize, runBlender } from './gltf.mjs';

runBlender('tools/blender/build.py', process.argv.slice(2));
optimize(`${OUT}/airliner.glb`, 'public/models/airliner.glb');
copyFileSync(`${OUT}/airliner.meta.json`, 'public/models/airliner.meta.json');
console.log(`public/models/airliner.glb: ${(statSync('public/models/airliner.glb').size / 1e6).toFixed(2)} MB`);
