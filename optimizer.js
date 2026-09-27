/*
 * Image Tools frontend
 * Copyright (C) 2026 Ruz Valiakhmetov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Source and license information:
 https://github.com/ruzvaliakhmetov/image-tools/
 */

const LIBIMAGEQUANT_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/libimagequant-wasm@0.3.0/dist/wasm/libimagequant_wasm.js";
const LIBIMAGEQUANT_WASM_URL =
  "https://cdn.jsdelivr.net/npm/libimagequant-wasm@0.3.0/dist/wasm/libimagequant_wasm_bg.wasm";
const OXIPNG_MODULE_URL = "https://esm.sh/@jsquash/oxipng@2.3.0";

const SETTINGS = Object.freeze({
  quality: 90,
  maxColors: 256,
  dithering: 1,
  oxipngLevel: 4,
  speed: 3
});

let enginePromise = null;

function loadEngines() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import(LIBIMAGEQUANT_MODULE_URL),
      import(OXIPNG_MODULE_URL)
    ]).then(async ([libimagequant, oxipng]) => {
      await libimagequant.default(LIBIMAGEQUANT_WASM_URL);

      return {
        libimagequant,
        optimisePng: oxipng.optimise
      };
    }).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }

  return enginePromise;
}

function quantizePng(originalBytes, engines) {
  const decoded = engines.libimagequant.decode_png_to_rgba(originalBytes);
  const rgbaData = decoded[0];
  const width = decoded[1];
  const height = decoded[2];
  const quantizer = new engines.libimagequant.ImageQuantizer();

  try {
    quantizer.setSpeed(SETTINGS.speed);
    quantizer.setQuality(
      Math.max(0, SETTINGS.quality - 20),
      SETTINGS.quality
    );
    quantizer.setMaxColors(SETTINGS.maxColors);

    const quantized = quantizer.quantizeImage(rgbaData, width, height);

    try {
      const palette = quantized.getPalette();
      quantized.setDithering(SETTINGS.dithering);

      const paletteIndices = quantized.getPaletteIndices(
        rgbaData,
        width,
        height
      );

      return engines.libimagequant.encode_palette_to_png(
        paletteIndices,
        palette,
        width,
        height
      );
    } finally {
      quantized.free();
    }
  } finally {
    quantizer.free();
  }
}

function outputName(filename) {
  const safeName = filename.replace(/[\\/]/g, "_");
  const dot = safeName.lastIndexOf(".");
  const base = dot > 0 ? safeName.slice(0, dot) : safeName;

  return base + "_optimised.png";
}

function uniqueName(name, usedNames) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = base + "_" + suffix + extension;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function optimizeFile(file, engines) {
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const quantizedBytes = quantizePng(originalBytes, engines);
  let oxipngBytes = null;

  try {
    const quantizedBuffer = quantizedBytes.buffer.slice(
      quantizedBytes.byteOffset,
      quantizedBytes.byteOffset + quantizedBytes.byteLength
    );
    const optimizedBuffer = await engines.optimisePng(quantizedBuffer, {
      level: SETTINGS.oxipngLevel,
      interlace: false,
      optimiseAlpha: true
    });

    oxipngBytes = new Uint8Array(optimizedBuffer);
  } catch (error) {
    console.warn("OxiPNG failed; using the smaller remaining version.", error);
  }

  const candidates = [originalBytes, quantizedBytes];
  if (oxipngBytes) {
    candidates.push(oxipngBytes);
  }
  candidates.sort((left, right) => left.byteLength - right.byteLength);

  return {
    name: outputName(file.name),
    bytes: new Uint8Array(candidates[0])
  };
}

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC_TABLE = createCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}

function buildZip(entries) {
  const encoder = new TextEncoder();
  const localRecords = [];
  const centralRecords = [];
  const timestamp = zipDateTime(new Date());
  let localOffset = 0;
  let centralSize = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const size = entry.bytes.byteLength;
    const checksum = crc32(entry.bytes);
    const localRecord = new Uint8Array(30 + nameBytes.length + size);
    const localView = new DataView(localRecord.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localRecord.set(nameBytes, 30);
    localRecord.set(entry.bytes, 30 + nameBytes.length);
    localRecords.push(localRecord);

    const centralRecord = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralRecord.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralRecord.set(nameBytes, 46);
    centralRecords.push(centralRecord);

    localOffset += localRecord.byteLength;
    centralSize += centralRecord.byteLength;
  });

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob(
    localRecords.concat(centralRecords, [endRecord]),
    { type: "application/zip" }
  );
}

async function optimizeFiles(files, onProgress) {
  const engines = await loadEngines();
  const entries = [];
  const usedNames = new Set();

  for (let index = 0; index < files.length; index += 1) {
    onProgress({
      stage: "optimizing",
      index,
      total: files.length,
      fileName: files[index].name
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const optimized = await optimizeFile(files[index], engines);
    optimized.name = uniqueName(optimized.name, usedNames);
    entries.push(optimized);
  }

  onProgress({ stage: "zip", total: files.length });
  return buildZip(entries);
}

window.pngOptimizer = Object.freeze({ optimizeFiles });
