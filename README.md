# Sever

A third-person 3D sword arena that runs in the browser. Swing your sword with the mouse, and whatever the blade passes through is cut along that exact line: bodies split along the plane of your swing, and the pieces tumble, bleed and can be cut again. Built with [three.js](https://threejs.org/) (loaded from a CDN), no build step.

**Play:** https://cyonyst1-sys.github.io/sever-sword-arena/

## Controls

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look (click the game to lock the mouse) |
| Hold left mouse + move the mouse | Swing the sword in the direction you drag. The camera holds still while you swing |
| Tap left mouse | Quick slash (alternates left and right) |
| Hold right mouse | Grappling hook: grabs whatever is in front of you (with a little aim assist) and reels you in. Swing on it, and let go to fly off with your momentum |
| Shift | Dash where you're looking. Cuts through anyone in your path |
| Space | Jump |
| Tab | Scoreboard |
| Esc | Menu |

Everyone moves at full speed all the time, so there's no sprint.

**Your sword grows with every kill:** it starts at 1.12 m and gets 8 cm longer per kill (up to 3 m), so your reach grows as you rack up kills. Your blade length shows under your score. Lengths reset each match.

The crosshair glows cyan when the hook has something to grab. Swords that cross clash and knock both fighters back, so holding your blade in the way blocks a swing.

## Modes

- **Free-for-all:** everyone against everyone, bots included. One clean cut kills. Respawn after 3 s; first to 15 kills, or the most after 5 minutes.
- **Horde:** you (and up to 3 friends) against waves of oni. Anyone cut down comes back at the start of the next wave; the run ends when everyone is down at once.

Solo games are you plus bots (0 to 7, Easy / Normal / Hard).

Bots use the grappling hook too: to climb up to anyone standing above them, to fly across the map toward a far-off target, and to swing back to safety when they go off the edge. Harder bots grapple more often.

## Multiplayer

Click **Multiplayer** on the home screen.

- **Open rooms:** a live list of rooms that are online now. Press **Join** on one.
- **Host:** pick a mode and press **Create room**. Share the 5-letter code or press **Copy invite link** (the link opens the game with the code filled in).
- In the lobby the host picks the mode, how many bots and how hard they are, and presses **Start match**. Friends can also join a match that's already running.
- Up to 8 players in Free-for-all (bots fill the empty slots), 4 in Horde.
- It's peer-to-peer (WebRTC via [PeerJS](https://peerjs.com/)): the host's browser runs the match, so the host should keep the tab open. PeerJS's free public server only introduces the browsers to each other. Some strict school or work networks block peer-to-peer connections.

## The map

A floating island above a sea of clouds:

- A stepped ziggurat in the middle with ramps up every side.
- The **crown**: a floating platform above the ziggurat, held up on four columns, with a spire rising out of it.
- Four **towers** (7 m) with ramps up their sides and battlements on top, each joined to the crown by a **sky bridge**.
- **Jump pads** at the four corners that launch you onto the crown.
- **Sky pillars** that rise far into the sky (marked with glowing rings), on the island and out over the void, to grapple and swing around. Fall off the island and you're out.

## How the slicing works

Every fighter is built from simple convex shapes (boxes, spheres, cylinders). When a blade connects, the game takes the plane swept by the blade that frame, bakes the posed model into world-space triangles, splits every triangle by that plane, and caps each cut part with the convex hull of the points where the plane crossed it (flesh-red for the body, steel for swords). Each side becomes a rigid piece with its own physics. Pieces keep their materials and can be sliced again.

## Code

- `index.html`: page, menus, HUD and styles
- `src/main.js`: game loop, controls, grappling hook, combat, bots, match rules, networking
- `src/arena.js`: the map, collision, grapple targeting and the bots' navigation graph
- `src/fighter.js`: the procedural samurai model, walk cycle, IK arms and legs, sword and trail
- `src/slice.js`: mesh slicing, cut caps, piece physics, blood and sparks
- `src/audio.js`: procedural sound effects
- `src/net.js`: peer-to-peer rooms and the open rooms list (adapted from Splatline Paintball)

Every push to `main` redeploys the site on GitHub Pages within about a minute. Before committing changes to `src/` or `index.html`, run `tools/bump-version.sh` so browsers load the new files together.

To run locally, serve the folder with any static web server (ES modules don't load from `file://`).
