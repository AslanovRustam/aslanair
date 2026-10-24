// node tools/encode-sky.mjs <eso0932a.jpg> <indianocean_amo_2013070_lrg.jpg> — encodes the night sky's two images
// from their downloaded originals (sources and licences in public/images/sky/CREDITS.md):
// - stars.webp: ESO's Milky Way panorama (equirectangular, in galactic coordinates) at 4096×2048, its sky background
//   taken to black — the backdrop adds it over its own night gradient;
// - cloud-sea.webp: a square of NASA's MODIS cloud deck in grey, 2048 across — the cloud sea grades it to moonlight.
import { mkdirSync, statSync } from 'node:fs';
import sharp from 'sharp';

const [stars, clouds] = process.argv.slice(2);
if (!stars || !clouds) throw new Error('usage: node tools/encode-sky.mjs <eso0932a.jpg> <indianocean_amo_2013070_lrg.jpg>');
const DIR = 'public/images/sky';
mkdirSync(DIR, { recursive: true });

// the panorama's sky background sits at about 9/255 (its median); 14 takes it and its noise to black
const BLACK = 14;
await sharp(stars)
  .resize(4096, 2048, { kernel: 'lanczos3' })
  .linear(255 / (255 - BLACK), (-BLACK * 255) / (255 - BLACK))
  .webp({ quality: 86, effort: 6 })
  .toFile(`${DIR}/stars.webp`);

// a 4200 px square of the deck's lower left: unbroken stratocumulus with a few dark lanes of open sea
await sharp(clouds)
  .extract({ left: 0, top: 1800, width: 4200, height: 4200 })
  .greyscale()
  .normalise()
  .resize(2048, 2048, { kernel: 'lanczos3' })
  .webp({ quality: 86, effort: 6 })
  .toFile(`${DIR}/cloud-sea.webp`);

for (const name of ['stars.webp', 'cloud-sea.webp']) console.log(name, statSync(`${DIR}/${name}`).size, 'bytes');
