/**
 * Generate PWA icons (192x192 and 512x512) as valid PNGs
 * Uses only Node.js built-in modules (no external packages).
 *
 * The icons are a solid #2563EB blue rounded-rect with a white broom shape
 * drawn pixel-by-pixel. For simplicity we draw:
 *   - A filled blue background
 *   - A white broom icon composed of simple geometric shapes
 */

import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BLUE = [0x25, 0x63, 0xeb]; // #2563EB
const WHITE = [0xff, 0xff, 0xff];
const LIGHT_BLUE = [0x1d, 0x4e, 0xd8]; // slightly darker for broom details

function createPNG(width, height, pixelData) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);

  // IDAT chunk - raw pixel data with filter bytes
  // Each row: filter byte (0 = None) + RGB pixels
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      row[1 + x * 3] = pixelData[idx];
      row[1 + x * 3 + 1] = pixelData[idx + 1];
      row[1 + x * 3 + 2] = pixelData[idx + 2];
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 for PNG
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      table[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 3);

  // Fill with blue background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = BLUE[0];
    pixels[i * 3 + 1] = BLUE[1];
    pixels[i * 3 + 2] = BLUE[2];
  }

  function setPixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 3;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
    }
  }

  function fillCircle(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          setPixel(cx + dx, cy + dy, color);
        }
      }
    }
  }

  function fillRect(x, y, w, h, color) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        setPixel(x + dx, y + dy, color);
      }
    }
  }

  // Draw rounded rectangle background (with rounded corners)
  const cornerR = Math.floor(size * 0.15);
  // Clear corners to create rounded effect (make them slightly darker)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check if pixel is in a corner region that should be rounded
      let inCorner = false;
      if (x < cornerR && y < cornerR) {
        // Top-left
        inCorner =
          (cornerR - x) * (cornerR - x) + (cornerR - y) * (cornerR - y) >
          cornerR * cornerR;
      } else if (x >= size - cornerR && y < cornerR) {
        // Top-right
        const dx = x - (size - cornerR);
        inCorner = dx * dx + (cornerR - y) * (cornerR - y) > cornerR * cornerR;
      } else if (x < cornerR && y >= size - cornerR) {
        // Bottom-left
        const dy = y - (size - cornerR);
        inCorner =
          (cornerR - x) * (cornerR - x) + dy * dy > cornerR * cornerR;
      } else if (x >= size - cornerR && y >= size - cornerR) {
        // Bottom-right
        const dx = x - (size - cornerR);
        const dy = y - (size - cornerR);
        inCorner = dx * dx + dy * dy > cornerR * cornerR;
      }
      if (inCorner) {
        // Transparent / white for corners
        setPixel(x, y, WHITE);
      }
    }
  }

  // --- Draw a broom icon ---
  const s = size / 512; // scale factor

  // Broom handle (diagonal line from top-right to center)
  const handleWidth = Math.max(8, Math.floor(12 * s));
  const handleStartX = size * 0.65;
  const handleStartY = size * 0.15;
  const handleEndX = size * 0.35;
  const handleEndY = size * 0.55;

  for (let t = 0; t <= 1; t += 0.001) {
    const x = handleStartX + (handleEndX - handleStartX) * t;
    const y = handleStartY + (handleEndY - handleStartY) * t;
    fillCircle(x, y, handleWidth / 2, WHITE);
  }

  // Broom head (bristles area - a wider shape at the bottom)
  const bristleTop = size * 0.52;
  const bristleBottom = size * 0.82;
  const bristleCenterX = size * 0.35;
  const bristleWidth = size * 0.32;

  // Draw bristle base (trapezoid shape)
  for (let y = bristleTop; y <= bristleBottom; y++) {
    const progress = (y - bristleTop) / (bristleBottom - bristleTop);
    const width = bristleWidth * (0.6 + progress * 0.4);
    const xStart = bristleCenterX - width / 2;
    fillRect(xStart, y, width, 1, WHITE);
  }

  // Draw bristle lines (darker lines within the bristle area)
  const numBristles = Math.floor(7 * s) || 5;
  for (let i = 0; i < numBristles; i++) {
    const ratio = (i + 1) / (numBristles + 1);
    const topY = bristleTop + (bristleBottom - bristleTop) * 0.15;
    const botY = bristleBottom;
    const topWidth = bristleWidth * 0.65;
    const botWidth = bristleWidth * 1.0;

    for (let y = topY; y <= botY; y++) {
      const progress = (y - bristleTop) / (bristleBottom - bristleTop);
      const currentWidth = bristleWidth * (0.6 + progress * 0.4);
      const xCenter = bristleCenterX - currentWidth / 2 + currentWidth * ratio;
      const lineW = Math.max(1, Math.floor(2 * s));
      fillRect(xCenter - lineW / 2, y, lineW, 1, LIGHT_BLUE);
    }
  }

  // Broom binding (rectangle where handle meets bristles)
  const bindingHeight = Math.max(8, Math.floor(18 * s));
  const bindingWidth = bristleWidth * 0.7;
  const bindingX = bristleCenterX - bindingWidth / 2;
  const bindingY = bristleTop - bindingHeight / 2;
  fillRect(bindingX, bindingY, bindingWidth, bindingHeight, WHITE);

  // Small sparkle dots to suggest cleanliness
  const sparklePositions = [
    [0.7, 0.45],
    [0.75, 0.55],
    [0.65, 0.6],
    [0.72, 0.35],
  ];
  for (const [sx, sy] of sparklePositions) {
    const sparkleSize = Math.max(3, Math.floor(6 * s));
    fillCircle(size * sx, size * sy, sparkleSize, WHITE);
    // Cross shape
    fillRect(
      size * sx - sparkleSize * 2,
      size * sy - 1,
      sparkleSize * 4,
      Math.max(2, Math.floor(3 * s)),
      WHITE
    );
    fillRect(
      size * sx - 1,
      size * sy - sparkleSize * 2,
      Math.max(2, Math.floor(3 * s)),
      sparkleSize * 4,
      WHITE
    );
  }

  return createPNG(size, size, pixels);
}

// Generate icons
const outDir = join(__dirname, "public", "icons");
mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];
for (const size of sizes) {
  const png = generateIcon(size);
  const filePath = join(outDir, `icon-${size}.png`);
  writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
}

console.log("Done! Icons generated successfully.");
