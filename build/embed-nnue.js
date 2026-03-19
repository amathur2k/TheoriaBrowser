/**
 * Converts a binary NNUE file to a C header with a hex-encoded array.
 * This follows the stockfish.js embedNet() pattern.
 *
 * Usage: node build/embed-nnue.js <input.nnue> <output.h>
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

export function embedNnue(inputPath, outputPath) {
  const data = readFileSync(inputPath);
  const filename = basename(inputPath);
  const varName = 'gEmbeddedNNUEData';
  const sizeVar = 'gEmbeddedNNUESize';

  let header = '';
  header += '// Auto-generated NNUE embedding. Do not edit.\n';
  header += `// Source: ${filename}\n`;
  header += `// Size: ${data.length} bytes\n\n`;
  header += '#include <cstdint>\n\n';
  header += `alignas(64) const uint8_t ${varName}[] = {\n`;

  // Write hex bytes, 16 per line
  for (let i = 0; i < data.length; i++) {
    if (i % 16 === 0) header += '  ';
    header += '0x' + data[i].toString(16).padStart(2, '0');
    if (i < data.length - 1) header += ',';
    if (i % 16 === 15 || i === data.length - 1) header += '\n';
    else header += ' ';
  }

  header += '};\n\n';
  header += `const uint64_t ${sizeVar} = ${data.length}ULL;\n`;

  writeFileSync(outputPath, header);
  console.log(`Embedded ${filename} (${data.length} bytes) → ${outputPath}`);
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('embed-nnue.js') && process.argv.length >= 4) {
  embedNnue(process.argv[2], process.argv[3]);
}
