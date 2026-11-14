// Game-portal hooks. On CrazyGames the build adds their SDK script (tools/build-portal.sh),
// and these calls tell the portal when the game has loaded, when a match is being played,
// and handle invite links. Everywhere else (GitHub Pages, itch.io) every call does nothing.
let sdk = null;
const ready = (async () => {
  const cg = window.CrazyGames && window.CrazyGames.SDK;
  if (!cg) return;
  try { await cg.init(); if (cg.environment !== 'disabled') sdk = cg; } catch (e) { /* not on CrazyGames */ }
})();

let playing = false;
const call = (fn) => { ready.then(() => { if (sdk) try { fn(sdk); } catch (e) { /* ignore */ } }); };

export const portal = {
  ready,
  get active() { return !!sdk; },
  loadingStop() { call((s) => s.game.loadingStop()); },
  gameplayStart() { if (playing) return; playing = true; call((s) => s.game.gameplayStart()); },
  gameplayStop() { if (!playing) return; playing = false; call((s) => s.game.gameplayStop()); },
  happytime() { call((s) => s.game.happytime()); },
  // Invite link for a multiplayer room: the portal's own link when on a portal, else this page's ?room= link.
  inviteLink(code) {
    if (sdk) try { return sdk.game.inviteLink({ room: code }); } catch (e) { /* fall through */ }
    return location.origin + location.pathname + '?room=' + code;
  },
  // Room code a player was invited to, if any (portal invite param or ?room=).
  async inviteRoom() {
    await ready;
    if (sdk) try { const r = sdk.game.getInviteParam('room'); if (r) return r; } catch (e) { /* ignore */ }
    return new URLSearchParams(location.search).get('room');
  },
};
