/**
 * Generates proper PNG icons for the Chrome extension.
 * Creates a dark purple background with a white lightning bolt — no dependencies needed.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

// ── PNG builder (pure Node, no canvas required) ───────────────────────────────
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const c = Buffer.concat([t, data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(c));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(pixels, size) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  // Build raw rows
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixels[y * size + x];
      const base = y * (1 + size * 4) + 1 + x * 4;
      raw[base] = r; raw[base + 1] = g; raw[base + 2] = b; raw[base + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

// ── Draw the icon ─────────────────────────────────────────────────────────────
function drawIcon(size) {
  const pixels = new Array(size * size).fill(null).map(() => [0, 0, 0, 0]);

  // Background: dark navy #0d0d1a with rounded corners
  const bgR = 13, bgG = 13, bgB = 26;
  const radius = Math.round(size * 0.22);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded corner test
      let inCorner = false;
      const corners = [[radius, radius], [size - 1 - radius, radius],
                       [radius, size - 1 - radius], [size - 1 - radius, size - 1 - radius]];
      for (const [cx, cy] of corners) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > radius * radius &&
            x <= radius + 1 && y <= radius + 1 ||
            x >= size - radius - 2 && y <= radius + 1 ||
            x <= radius + 1 && y >= size - radius - 2 ||
            x >= size - radius - 2 && y >= size - radius - 2) {
          // simplify: just check distance from corner
        }
      }

      const nearTopLeft     = x < radius && y < radius;
      const nearTopRight    = x >= size - radius && y < radius;
      const nearBottomLeft  = x < radius && y >= size - radius;
      const nearBottomRight = x >= size - radius && y >= size - radius;

      if (nearTopLeft) {
        const dx = x - radius, dy = y - radius;
        inCorner = dx * dx + dy * dy > radius * radius;
      } else if (nearTopRight) {
        const dx = x - (size - 1 - radius), dy = y - radius;
        inCorner = dx * dx + dy * dy > radius * radius;
      } else if (nearBottomLeft) {
        const dx = x - radius, dy = y - (size - 1 - radius);
        inCorner = dx * dx + dy * dy > radius * radius;
      } else if (nearBottomRight) {
        const dx = x - (size - 1 - radius), dy = y - (size - 1 - radius);
        inCorner = dx * dx + dy * dy > radius * radius;
      }

      if (!inCorner) {
        // Gradient background: top-left violet #7c3aed → bottom-right #5b21b6
        const t = (x + y) / (size * 2);
        const r = Math.round(124 + t * (91 - 124));   // 124 → 91
        const g = Math.round(58  + t * (33 - 58));    // 58 → 33
        const b = Math.round(237 + t * (182 - 237));  // 237 → 182
        pixels[y * size + x] = [r, g, b, 255];
      }
    }
  }

  // Lightning bolt — draw as filled polygon approximation
  // Scale points relative to size
  const s = size / 128;
  const boltPoints = [
    [72, 8],   // top-right of bolt
    [44, 56],  // middle-left notch top
    [72, 56],  // middle indent
    [56, 120], // bottom point
    [84, 64],  // middle-right notch bottom
    [60, 64],  // middle indent right
    [88, 8],   // top-left, back to top
  ].map(([px, py]) => [Math.round(px * s), Math.round(py * s)]);

  // Scan-line fill the bolt
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (pointInPoly(x, y, boltPoints)) {
        pixels[y * size + x] = [255, 255, 255, 255]; // white bolt
      }
    }
  }

  return pixels;
}

// Generate all sizes
const sizes = [16, 48, 128];
for (const size of sizes) {
  const pixels = drawIcon(size);
  const png = makePNG(pixels, size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Generated icon${size}.png (${png.length} bytes)`);
}

console.log("\n✅ All icons generated in browser-extension/icons/");
