/**
 * Chess.com public API integration.
 * Fetches recent games for a given username.
 */

const BASE = 'https://api.chess.com/pub/player';

/**
 * Fetch the most recent games for a username.
 * Returns up to 20 games from the latest available month.
 * @param {string} username
 * @returns {Promise<Array>} Array of game objects
 */
export async function fetchRecentGames(username) {
  const name = username.trim().toLowerCase();
  if (!name) throw new Error('Username is required');

  // Get list of archive months
  const archivesRes = await fetch(`${BASE}/${encodeURIComponent(name)}/games/archives`, {
    headers: { 'Accept': 'application/json' },
  });

  if (archivesRes.status === 404) throw new Error(`Player "${username}" not found on Chess.com`);
  if (!archivesRes.ok) throw new Error(`Chess.com API error: ${archivesRes.status}`);

  const { archives } = await archivesRes.json();
  if (!archives || archives.length === 0) throw new Error('No games found for this player');

  // Fetch latest month that has games
  for (let i = archives.length - 1; i >= 0; i--) {
    const url = archives[i];
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) continue;

    const { games } = await res.json();
    if (!games || games.length === 0) continue;

    // Return most recent 20 games, newest first
    return games.slice(-20).reverse().map(g => ({
      white: g.white?.username || '?',
      black: g.black?.username || '?',
      whiteRating: g.white?.rating,
      blackRating: g.black?.rating,
      result: parseResult(g.white?.result, g.black?.result),
      date: parseDate(g.end_time),
      timeControl: g.time_class || '',
      pgn: g.pgn || '',
      url: g.url || '',
    }));
  }

  throw new Error('No games with PGN data found');
}

function parseResult(whiteResult, blackResult) {
  if (whiteResult === 'win') return '1-0';
  if (blackResult === 'win') return '0-1';
  return '½-½';
}

function parseDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
