# Standalone Emscripten WASM Makefile for Theoria
# Usage: make -f emscripten/wasm-makefile.mk -j4
# Run from theoria-src/src/
#
# Or use: node build/build.js (which compiles directly without make)

CXX = em++

# Source files (main.cpp excluded - wasm_entry.cpp provides its own main)
SRCS = benchmark.cpp bitboard.cpp evaluate.cpp \
	misc.cpp movegen.cpp movepick.cpp position.cpp \
	search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp \
	nnue/evaluate_nnue.cpp nnue/features/half_ka_v2_hm.cpp \
	syzygy/tbprobe.cpp \
	emscripten/wasm_entry.cpp

OBJS = $(SRCS:.cpp=.o)

EXE = theoria.js

# SIMD flags (WebAssembly SIMD128 mapping to SSE intrinsics)
SIMD_FLAGS = -msimd128 -msse -msse2 -mssse3 -msse4.1

# Feature flags
FEATURE_FLAGS = \
	-DUSE_PTHREADS \
	-DUSE_POPCNT \
	-DUSE_SSE2 \
	-DUSE_SSSE3 \
	-DUSE_SSE41 \
	-DNDEBUG \
	-DNNUE_EMBEDDING_OFF

CXXFLAGS = -O3 -std=c++17 -flto \
	-fno-exceptions \
	-Wall -Wcast-qual \
	-pthread \
	$(SIMD_FLAGS) \
	$(FEATURE_FLAGS)

# Emscripten link flags
EM_LDFLAGS = \
	-sPROXY_TO_PTHREAD \
	-sINITIAL_MEMORY=134217728 \
	-sMAXIMUM_MEMORY=2147483648 \
	-sALLOW_MEMORY_GROWTH=1 \
	-sMODULARIZE=1 \
	-sEXPORT_NAME=Theoria \
	-sEXPORTED_FUNCTIONS=[_main,_command] \
	-sEXPORTED_RUNTIME_METHODS=[ccall,cwrap,UTF8ToString] \
	-sNO_EXIT_RUNTIME=1 \
	-sENVIRONMENT=worker \
	-sFILESYSTEM=1 \
	-sPTHREAD_POOL_SIZE=4 \
	--closure 0

LDFLAGS = -O3 -flto -pthread $(EM_LDFLAGS)

.PHONY: all clean

all: $(EXE)

$(EXE): $(OBJS)
	$(CXX) $(LDFLAGS) -o $@ $(OBJS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(EXE) theoria.wasm theoria.worker.js
