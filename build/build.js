/**
 * Build script for Theoria WASM.
 * Compiles C++ source files directly with em++ (no make required).
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const THEORIA_SRC = join(ROOT, 'theoria-src', 'src');
const WASM_OUT = join(ROOT, 'public', 'wasm');
const EMSDK = 'C:\\Users\\amath\\emsdk';

// Emscripten environment
const emEnv = {
  ...process.env,
  EMSDK,
  EMSDK_PYTHON: join(EMSDK, 'python', '3.13.3_64bit', 'python.exe'),
  EMSDK_NODE: join(EMSDK, 'node', '22.16.0_64bit', 'bin', 'node.exe'),
  PATH: [
    EMSDK,
    join(EMSDK, 'upstream', 'emscripten'),
    join(EMSDK, 'node', '22.16.0_64bit', 'bin'),
    process.env.PATH,
  ].join(';'),
};

// Source files
const SRCS = [
  // Note: main.cpp excluded - wasm_entry.cpp provides its own main()
  'benchmark.cpp', 'bitboard.cpp', 'evaluate.cpp',
  'misc.cpp', 'movegen.cpp', 'movepick.cpp', 'position.cpp',
  'search.cpp', 'thread.cpp', 'timeman.cpp', 'tt.cpp',
  'uci.cpp', 'ucioption.cpp', 'tune.cpp',
  'nnue/evaluate_nnue.cpp', 'nnue/features/half_ka_v2_hm.cpp',
  'syzygy/tbprobe.cpp',
  'emscripten/wasm_entry.cpp',
];

// SIMD flags
const SIMD_FLAGS = '-msimd128 -msse -msse2 -mssse3 -msse4.1';

// Feature flags (no USE_PTHREADS — single-threaded non-blocking build)
const FEATURE_FLAGS = [
  '-DIS_64BIT',
  '-DUSE_POPCNT',
  '-DUSE_SSE2',
  '-DUSE_SSSE3',
  '-DUSE_SSE41',
  '-DNDEBUG',
  '-DNNUE_EMBEDDING_OFF',
].join(' ');

// Compile flags (no -pthread)
const CXXFLAGS = `-O2 -std=c++17 -flto -fno-exceptions -Wall -Wcast-qual ${SIMD_FLAGS} ${FEATURE_FLAGS}`;

// Link flags — NO ASYNCIFY, uses emscripten_set_main_loop instead
const EM_LDFLAGS = [
  '-sSTACK_SIZE=1048576',
  '-sINITIAL_MEMORY=134217728',
  '-sMAXIMUM_MEMORY=2147483648',
  '-sALLOW_MEMORY_GROWTH=1',
  '-sMODULARIZE=1',
  '-sEXPORT_NAME=Theoria',
  '-sEXPORTED_FUNCTIONS=_main,_command',
  '-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,FS',
  '-sNO_EXIT_RUNTIME=1',
  '-sENVIRONMENT=worker',
  '-sFILESYSTEM=1',
  '--closure 0',
].join(' ');

const LDFLAGS = `-O2 -flto ${EM_LDFLAGS}`;

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', env: emEnv, shell: true, ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf8', env: emEnv, shell: true }).trim();
}

function main() {
  console.log('=== TheoriaBrowser WASM Build ===\n');

  // Check emcc
  try {
    const version = runCapture('emcc --version').split('\n').find(l => l.includes('emcc'));
    console.log(`Emscripten: ${version}`);
  } catch {
    console.error('ERROR: emcc not found.');
    process.exit(1);
  }

  if (!existsSync(THEORIA_SRC)) {
    console.error('ERROR: Theoria source not found at', THEORIA_SRC);
    process.exit(1);
  }

  mkdirSync(WASM_OUT, { recursive: true });

  // Compile each source file
  console.log('\nCompiling source files...');
  const objs = [];

  for (const src of SRCS) {
    const srcPath = join(THEORIA_SRC, src);
    const objPath = srcPath.replace('.cpp', '.o');
    objs.push(objPath);

    if (!existsSync(srcPath)) {
      console.error(`ERROR: Source file not found: ${srcPath}`);
      process.exit(1);
    }

    // Skip if object file is newer than source (simple incremental build)
    if (existsSync(objPath)) {
      const srcStat = statSync(srcPath);
      const objStat = statSync(objPath);
      if (objStat.mtimeMs > srcStat.mtimeMs) {
        console.log(`  [skip] ${src}`);
        continue;
      }
    }

    console.log(`  [compile] ${src}`);
    run(`em++ ${CXXFLAGS} -c -o "${objPath}" "${srcPath}"`, { cwd: THEORIA_SRC });
  }

  // Link
  console.log('\nLinking...');
  const exePath = join(THEORIA_SRC, 'theoria.js');
  const objList = objs.map(o => `"${o}"`).join(' ');
  run(`em++ ${LDFLAGS} -o "${exePath}" ${objList}`, { cwd: THEORIA_SRC });

  // Copy outputs
  console.log('\nCopying outputs to public/wasm/...');
  for (const file of ['theoria.js', 'theoria.wasm']) {
    const src = join(THEORIA_SRC, file);
    if (existsSync(src)) {
      copyFileSync(src, join(WASM_OUT, file));
      console.log(`  Copied ${file}`);
    }
  }

  console.log('\nBuild complete!');
  const files = readdirSync(WASM_OUT);
  console.log('Files:', files.join(', '));
}

main();
