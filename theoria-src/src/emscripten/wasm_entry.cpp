/*
 * WASM entry point for Theoria chess engine.
 *
 * Uses emscripten_set_main_loop for a non-blocking polling loop.
 * NO ASYNCIFY needed — avoids the massive overhead on every function.
 *
 * JavaScript calls command() to enqueue UCI commands.
 * The main loop polls the queue each frame and dispatches commands.
 */

#ifdef __EMSCRIPTEN__

#include <emscripten.h>
#include <iostream>
#include <sstream>
#include <string>
#include <queue>
#include <deque>
#include <memory>

#include "../bitboard.h"
#include "../evaluate.h"
#include "../misc.h"
#include "../position.h"
#include "../search.h"
#include "../tune.h"
#include "../types.h"
#include "../uci.h"

// Global state for the polling loop
static std::queue<std::string> commandQueue;

static Stockfish::UCI*           g_uci    = nullptr;
static Stockfish::Position       g_pos;
static Stockfish::StateListPtr   g_states;

// Called from JavaScript to send a UCI command
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    int command(const char* cmd) {
        if (cmd) {
            commandQueue.push(std::string(cmd));
        }
        return 0;
    }
}

static bool getCommand(std::string& cmd) {
    if (commandQueue.empty())
        return false;
    cmd = commandQueue.front();
    commandQueue.pop();
    return true;
}

// Process one UCI command — mirrors UCI::loop() dispatch
static void processCommand(const std::string& cmd) {
    using namespace Stockfish;

    std::istringstream is(cmd);
    std::string        token;

    is >> std::skipws >> token;

    if (token == "quit" || token == "stop")
        g_uci->threads.stop = true;

    else if (token == "ponderhit")
        g_uci->threads.main_manager()->ponder = false;

    else if (token == "uci")
        sync_cout << "id name " << engine_info(true) << "\n"
                  << g_uci->options << "\nuciok" << sync_endl;

    else if (token == "setoption")
        g_uci->setoption(is);

    else if (token == "go")
        g_uci->go(g_pos, is, g_states);

    else if (token == "position")
        g_uci->position(g_pos, is, g_states);

    else if (token == "ucinewgame")
        g_uci->search_clear();

    else if (token == "isready")
        sync_cout << "readyok" << sync_endl;

    else if (token == "d")
        sync_cout << g_pos << sync_endl;

    else if (token == "eval")
        g_uci->trace_eval(g_pos);

    else if (token == "compiler")
        sync_cout << compiler_info() << sync_endl;
}

// Called every frame by emscripten_set_main_loop
static void mainLoopStep() {
    // Process all pending commands in the queue
    std::string cmd;
    while (getCommand(cmd)) {
        processCommand(cmd);
    }
}

int main(int argc, char* argv[]) {
    using namespace Stockfish;

    std::cout << engine_info() << std::endl;

    Bitboards::init();
    Position::init();

    static UCI uci(argc, argv);
    g_uci = &uci;

    Tune::init(uci.options);
    uci.evalFiles = Eval::NNUE::load_networks(uci.workingDirectory(), uci.options, uci.evalFiles);

    g_states.reset(new std::deque<StateInfo>(1));
    g_pos.set("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              false, &g_states->back());

    std::cout << "info string engine ready" << std::endl;

    // Start non-blocking polling loop: 100 FPS = every ~10ms
    // 0 for simulate_infinite_loop means don't throw if main returns
    emscripten_set_main_loop(mainLoopStep, 100, 0);

    return 0;
}

#endif // __EMSCRIPTEN__
