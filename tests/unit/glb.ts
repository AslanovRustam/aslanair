// Minimal GLB reader for asset tests: the JSON chunk, node names and embedded image sizes.
import { readFileSync } from 'node:fs';

interface GltfJson {
  nodes?: { name?: string }[];
  images?: { bufferView?: number; mimeType?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
}

function chunks(path: string): { json: GltfJson; bin: Buffer } {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a GLB`);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as GltfJson;
  const binStart = 20 + jsonLength;
  const binLength = buf.readUInt32LE(binStart);
  return { json, bin: buf.subarray(binStart + 8, binStart + 8 + binLength) };
}

export function glbNodeNames(path: string): string[] {
  return (chunks(path).json.nodes ?? []).map((n) => n.name ?? '');
}

function imageSize(b: Buffer): [number, number] {
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the markers to the first SOFn
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const length = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      }
      i += 2 + length;
    }
  }
  throw new Error('unknown image format');
}

export function glbImageSizes(path: string): [number, number][] {
  const { json, bin } = chunks(path);
  return (json.images ?? []).map((img) => {
    const view = json.bufferViews![img.bufferView!];
    const start = view.byteOffset ?? 0;
    return imageSize(bin.subarray(start, start + view.byteLength));
  });
}
