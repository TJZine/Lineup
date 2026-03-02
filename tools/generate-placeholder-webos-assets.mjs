import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) throw new Error(`Invalid hex color: ${hex}`);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new Error(`RGBA buffer length mismatch: got ${rgba.length}, expected ${width * height * 4}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4 + 1;
  const raw = Buffer.allocUnsafe(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // no filter
    const srcStart = y * width * 4;
    const dstStart = y * stride + 1;
    raw.set(rgba.subarray(srcStart, srcStart + width * 4), dstStart);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = pngChunk('IDAT', compressed);
  const out = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    idat,
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return out;
}

function renderEmberSteelPlaceholder(width, height, { withRing = true } = {}) {
  const rgba = new Uint8Array(width * height * 4);

  const baseTop = hexToRgb('#12141a');
  const baseBottom = hexToRgb('#07080c');
  const steelMid = hexToRgb('#161922'); // aligns with Ember & Steel surface tint
  const ember = hexToRgb('#d4a07a');

  const minDim = Math.min(width, height);
  const cx = width * 0.52;
  const cy = height * 0.48;
  const ringR = minDim * 0.23;
  const ringW = Math.max(2, minDim * 0.032);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;

      const tY = height === 1 ? 0 : y / (height - 1);
      const bgR = lerp(baseTop.r, baseBottom.r, tY);
      const bgG = lerp(baseTop.g, baseBottom.g, tY);
      const bgB = lerp(baseTop.b, baseBottom.b, tY);

      const nx = (x + 0.5 - width / 2) / (width / 2);
      const ny = (y + 0.5 - height / 2) / (height / 2);
      const d = Math.sqrt(nx * nx + ny * ny);

      // Vignette + subtle center lift
      const vignette = smoothstep(0.35, 1.0, d);
      const lift = 1 - smoothstep(0.0, 0.78, d);

      let r = lerp(bgR, steelMid.r, lift * 0.35);
      let g = lerp(bgG, steelMid.g, lift * 0.35);
      let b = lerp(bgB, steelMid.b, lift * 0.35);
      r = lerp(r, 0, vignette * 0.28);
      g = lerp(g, 0, vignette * 0.28);
      b = lerp(b, 0, vignette * 0.28);

      if (withRing) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx); // -PI..PI

        // Ring with a small notch (gap) to feel "tuned", not generic.
        const ringBand = 1 - smoothstep(ringW * 0.55, ringW, Math.abs(dist - ringR));
        const gap = smoothstep(0.2, 0.65, Math.abs(angle - (-Math.PI / 2.8))); // gap near upper-right
        const ring = ringBand * (1 - gap * 0.92);

        const glow = ringBand * (1 - smoothstep(ringW, ringW * 4.2, Math.abs(dist - ringR)));

        r = lerp(r, ember.r, ring * 0.85);
        g = lerp(g, ember.g, ring * 0.85);
        b = lerp(b, ember.b, ring * 0.85);

        r = lerp(r, ember.r, glow * 0.14);
        g = lerp(g, ember.g, glow * 0.14);
        b = lerp(b, ember.b, glow * 0.14);

        // Center dot for recognition at small sizes
        const dot = 1 - smoothstep(ringR * 0.0, ringR * 0.14, dist);
        r = lerp(r, ember.r, dot * 0.10);
        g = lerp(g, ember.g, dot * 0.10);
        b = lerp(b, ember.b, dot * 0.10);
      }

      rgba[i] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[i + 3] = 255;
    }
  }

  return rgba;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePng(outPath, width, height, rgba) {
  const buf = encodePngRgba(width, height, rgba);
  fs.writeFileSync(outPath, buf);
}

function main() {
  const repoRoot = process.cwd();
  const publicDir = path.join(repoRoot, 'public');
  ensureDir(publicDir);

  const iconPath = path.join(publicDir, 'icon.png');
  const largeIconPath = path.join(publicDir, 'largeIcon.png');
  const splashPath = path.join(publicDir, 'splashBackground.png');

  writePng(iconPath, 80, 80, renderEmberSteelPlaceholder(80, 80));
  writePng(largeIconPath, 130, 130, renderEmberSteelPlaceholder(130, 130));
  writePng(splashPath, 1920, 1080, renderEmberSteelPlaceholder(1920, 1080, { withRing: true }));

  // eslint-disable-next-line no-console
  console.log('Generated:', {
    icon: 'public/icon.png (80x80)',
    largeIcon: 'public/largeIcon.png (130x130)',
    splashBackground: 'public/splashBackground.png (1920x1080)',
  });
}

main();

