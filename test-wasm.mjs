import { readFileSync } from 'fs';
import { join } from 'path';

const wasmDir = join(import.meta.dirname, 'public', 'wasm');
globalThis.self = globalThis;
globalThis.location = { href: 'http://localhost:5002/wasm/theoria.js' };
globalThis.importScripts = function() {};
globalThis.performance = globalThis.performance || { now: Date.now };

let jsCode = readFileSync(join(wasmDir, 'theoria.js'), 'utf8');
const Theoria = new Function(jsCode + '\nreturn Theoria;')();

const wasmBinary = readFileSync(join(wasmDir, 'theoria.wasm'));
let outputLines = [];

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT:', err.message, err.stack);
});

try {
  const engine = await Theoria({
    wasmBinary: wasmBinary.buffer,
    locateFile(path) { return join(wasmDir, path); },
    print(text) {
      outputLines.push(text);
      console.log('[OUT]', text);
    },
    printErr(text) {
      console.log('[ERR]', text);
    },
    onAbort(what) {
      console.log('[ABORT] reason:', JSON.stringify(what));
      console.log('[ABORT] stack:', new Error().stack);
    },
  });

  console.log('Module resolved. FS:', typeof engine.FS);

  // Wait and check if main loop callback fires
  await new Promise(r => setTimeout(r, 500));

  // Try uci command
  engine.ccall('command', 'number', ['string'], ['uci']);
  await new Promise(r => setTimeout(r, 500));

  engine.ccall('command', 'number', ['string'], ['isready']);
  await new Promise(r => setTimeout(r, 500));

  console.log('\nAll output:');
  outputLines.forEach(l => console.log('  >', l));
} catch (err) {
  console.log('CATCH:', err.message);
}

process.exit(0);
