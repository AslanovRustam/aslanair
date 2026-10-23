import { feature } from 'topojson-client';
import land from 'world-atlas/land-110m.json';

type Ring = [number, number][];

/**
 * A ring's longitudes made continuous: the data is stitched across the antimeridian, so a ring that crosses it jumps
 * by 360°. Returns the points and how far the ring winds round (±360 for one that circles a pole).
 */
function unwrap(ring: Ring): { points: Ring; winds: number } {
  const points: Ring = [];
  let shift = 0;
  for (const [i, [lon, lat]] of ring.entries()) {
    if (i > 0) {
      const step = lon + shift - points[i - 1][0];
      if (step > 180) shift -= 360;
      else if (step < -180) shift += 360;
    }
    points.push([lon + shift, lat]);
  }
  return { points, winds: points[points.length - 1][0] - points[0][0] };
}

/**
 * Natural Earth's 1:110m land (world-atlas, public domain) drawn into an equirectangular mask `width` × `width / 2`;
 * returns whether a latitude and longitude is land. Runs in the browser (it draws on a canvas).
 */
export function landMask(width = 1024): (lat: number, lon: number) => boolean {
  const height = width / 2;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const x = (lon: number) => ((lon + 180) / 360) * width;
  const y = (lat: number) => ((90 - lat) / 180) * height;
  const shapes = feature(land, land.objects.land);
  const geometries = 'features' in shapes ? shapes.features.map((f) => f.geometry) : [shapes.geometry];
  ctx.beginPath();
  for (const g of geometries) {
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const ring of polygons.flat()) {
      const { points, winds } = unwrap(ring);
      // a ring round a pole (Antarctica) closes along that pole
      if (Math.abs(winds) > 180) {
        const pole = points[0][1] < 0 ? -90 : 90;
        points.push([points[points.length - 1][0], pole], [points[0][0], pole]);
      }
      // drawn three times so whatever lies past ±180° wraps round
      for (const offset of [-360, 0, 360]) {
        points.forEach(([lon, lat], i) => (i ? ctx.lineTo(x(lon + offset), y(lat)) : ctx.moveTo(x(lon + offset), y(lat))));
        ctx.closePath();
      }
    }
  }
  ctx.fillStyle = '#fff';
  ctx.fill('evenodd');
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return (lat, lon) => {
    const col = Math.min(width - 1, Math.max(0, Math.floor(x(lon))));
    const row = Math.min(height - 1, Math.max(0, Math.floor(y(lat))));
    return pixels[(row * width + col) * 4] > 127;
  };
}
