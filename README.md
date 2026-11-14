# Sever

A third-person 3D sword arena that runs in the browser. Swing your sword with the mouse, and whatever the blade passes through is cut along that exact line: bodies split along the plane of your swing, and the pieces tumble, bleed and can be cut again. Built with [three.js](https://threejs.org/) (loaded from a CDN), no build step.

**Play:** https://cyonyst1-sys.github.io/sever-sword-arena/

## Controls

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look (click the game to lock the mouse) |
| Hold left mouse + move the mouse | Swing the sword in the direction you drag. While you swing, the mouse still turns you: the sword moves the most, your body twists less, and the camera turns only a little. Let go and your body turns back to where the camera faces |
| Tap left mouse | Quick slash (alternates left and right) |
| Hold right mouse | Grappling hook: grabs whatever is in front of you (with a little aim assist) and reels you in. Swing on it, and let go to fly off with your momentum |
| Shift | Dash about 13 m where you're looking (more with the glide after it). Cuts through anyone in your path. Works in the air: dash out of a grapple swing to reach the next platform, and you keep your swing speed |
| Space | Jump. On a glowing jump pad, launches you to the next platform |
| Tab | Scoreboard |
| Esc | Menu |

Everyone moves at full speed all the time, so there's no sprint.

**Your sword grows with every kill:** it starts at 1.12 m and gets 8 cm longer per kill (up to 3 m), so your reach grows as you rack up kills. Your blade length shows under your score. Dying puts it back to the starting length, so it measures your current streak (your kill count on the scoreboard is kept).

The crosshair glows cyan when the hook has something to grab. Swords that cross clash and knock both fighters back, so holding your blade in the way blocks a swing.

## Difficulty
Bots come in eight levels: Easy, Normal, Hard, then Brutal, Nightmare, Shogun, Demon and Kami. Each step up winds strikes faster, attacks more often, dodges more of your swings, dash-cuts more, turns faster and grapples sooner. Coin rewards scale with it (up to 4x on Kami), online too.

## Modes

Pick a mode on the home screen (the host picks it in a multiplayer room). Bots play every mode.

- **King of the Platform:** a platform marked by a gold beam is the throne. Stand on it alone to score 1 point a second (contested = nobody scores). It moves every 40 s. First to 60, or most after 5 minutes.
- **Juggernaut:** one crowned fighter with the max 3 m blade against everyone else. Whoever cuts them down takes the crown. The juggernaut scores 1 point a second, but only while standing on something: flying, swinging or dashing scores nothing, so they have to land and fight. First to 60, or most after 5 minutes.
- **Last Blade Standing:** no respawns, and always at least 12 fighters (bots fill the rest, whatever the Bots setting). From 5 s in, platforms glow red for 3 s, then plunge into the clouds, one every ~4 s on Sky Spires and ~7 s on Sky Plateaus, from the outside in. Last fighter alive wins.
- **Headhunter:** kills drop gold heads (the victim's own plus all they carried). Pick them up and bank them at one of two **altars floating in open air**, with no platform anywhere near. Each altar sits inside a ring of pillars, with lines of pillars leading in from the nearest platforms; they can't be cut. Swing in and pass through the big glowing zone inside the ring to bank. Die carrying heads and you drop them all. First to 20 banked.

- **Free-for-all:** everyone against everyone, bots included. One clean cut kills. Respawn after 3 s; first to 15 kills, or the most after 5 minutes.
- **Horde:** you (and up to 3 friends) against waves of oni. Anyone cut down comes back at the start of the next wave; the run ends when everyone is down at once.

Solo games are you plus bots (0 to 7, Easy / Normal / Hard).

Bots get around mainly by grappling: they hook a sky pillar beside the platform their enemy is on (or the next one on the way), swing toward it, and let go at the moment their arc will drop them onto the top, steering in the air to land near the middle. When they are well above a platform they hook its top and are pulled straight down onto it. If they fall, they swing back onto a platform the same way. Sometimes they dash out of a swing toward the platform, and they always do when a swing or fall would leave them short. They only take the jump pads when there is no clean swing. Harder bots grapple more often.

## Multiplayer

Click **Multiplayer** on the home screen.

- **Open rooms:** a live list of rooms that are online now. Press **Join** on one.
- **Host:** pick a mode and press **Create room**. Share the 5-letter code or press **Copy invite link** (the link opens the game with the code filled in).
- In the lobby the host picks the mode, how many bots and how hard they are, and presses **Start match**. Friends can also join a match that's already running.
- Up to 8 players in Free-for-all (bots fill the empty slots), 4 in Horde.
- It's peer-to-peer (WebRTC via [PeerJS](https://peerjs.com/)): the host's browser runs the match, so the host should keep the tab open. PeerJS's free public server only introduces the browsers to each other. Some strict school or work networks block peer-to-peer connections.

## Maps

Pick the map on the home screen (the host picks it in a multiplayer room). Both are about 200 m across, above a sea of clouds, with sky pillars everywhere and jump pads between platforms. Fall into the clouds and you're out.

### Sky Plateaus

Fewer, much bigger platforms for larger battles:

- **7 huge plateaus** (about 40 m across): a 46 m central plateau and six around it, each at a slightly different height (from 4 m below to 8 m above the centre).
- Low **terraces** (a step up, no jump needed), low walls and stone blocks spread over each plateau, and some **pillars rise straight through the plateaus** as cover and mid-fight grapple points.
- Wide open floor built for **dashing**: bots dash across the plateaus constantly here.
- Fighters respawn near the action rather than far away, and bots head for the plateau where the most fighters are, so brawls of 3 to 6 fighters break out.

### Great Canopy
Same size as the other maps: a giant forest canopy high above a misty floor.
- **Multi-armed tree branches** grow out from five huge trunks and stretch across the map. The branches are oval, wider than they are tall, so their tops are broad running surfaces; they are thicker low down, skinnier up high, and every limb tapers toward its tip. They climb, dip and level out again, on many layers (from about 27 m below to 37 m above the middle), and steer around the other trunks instead of running into them. Run along them and fight on them.
- **Big, thick leaves** spread through the branches act as landing pads for getting onto a branch. Each grows on a curved stalk that swells out of the bark, with a spray of small leaves at the bud.
- **A dense forest of thin bamboo** (about 870 stalks) runs from the floor up to the leaf roof. They are the grapple points. You and your dash pass straight through them, and only the grapple attaches. Any fast blade contact severs a stalk in one slice: a swing, or just carrying your sword through one as you fly past (bots too). The top topples and falls away, and the stump stays (you can still hook it, or cut it lower). Your sword never cuts the stalk your own grapple is hooked onto.
- Branches you can hook too. In Last Blade Standing a whole branch with its leaves crumbles at once.

### Sky Spires

A sky arena made of 23 floating platforms at different heights:

- A large **hub** in the middle, a ring of platforms around it, and an outer ring further out, each at its own height.
- **High perches** floating above the others and **low platforms** hanging below them.
- Low walls and stone blocks on each platform for cover.
- **Jump pads** (the glowing discs near platform edges) link every platform into one network. Stand on one and press **Space** to launch onto the next platform.
- About 90 **sky pillars** all over the arena, rising far above and below the platforms (marked with glowing rings), to grapple and swing between. Grapple the edge of a platform and the hook pulls you up and over onto it.


Fights happen platform by platform: whoever lands on a platform fights whoever's there, then swings or pads on to the next one. Bots go for enemies on their own platform or the next one over first, climb up to higher platforms by grappling their edge, and use the pads to get around.

### Colosseum

A colosseum bowl in the sky, built entirely of **round platforms**:

- A big round **arena floor** in the middle, the lowest point of the map.
- Three rings of round platforms around it, stepping up and out like the seats of a coliseum: 8 at 10 m up, 10 at about 21 m, and 12 on the **high rim** at about 33 m.
- **Everyone spawns on the high rim** and swings down toward the arena floor to fight.
- Tall **stone columns** between the rings, from the clouds to the sky, to grapple and swing on.

## Shop
Cosmetics only: nothing in the shop changes reach, speed or damage. Open it from the home screen.
- **Coins**: 10 for playing a match through (40 s or more), 5 per kill, 30 for a win, plus points (King of the Platform, Juggernaut, Headhunter) or waves (Horde). Any match with bots, solo or online, pays by the bot difficulty: 0.75x on Easy, 1.3x on Hard, and more on the harder levels (up to 4x on Kami). Playing online with friends adds +10% per friend (up to +30%). The end screen lists the bonuses you got. You start with 150. Coins and items are saved in your browser.
- **Masks**: Shinobi Wrap, Iron Menpo, Tengu, Oni, Kitsune, Skull, Hannya, Void Mask.
- **Headwear**: Hachimaki, Long Ponytail, Shinobi Hood, Demon Horns, Straw Kasa, Kabuto Helmet, Ember Crown.
- **Outfits**: ten colour schemes for jacket, trim and trousers (or keep your team colour).
- **Swords**: Needle, Bone Blade, Cleaver, Jade Edge, Gilded, Obsidian, Frostbite, Bloodmoon, Void Edge. Same reach and cutting as the katana.
- **Trails**: solid colours, plus Rainbow, Ember (sparks), Sakura Petals and Lightning (crackling sparks).
- **Kill effects** (what happens to whoever you cut down; everyone sees them): Sakura Burst (petals instead of blood), Ink Strike (ink splashes and stains), Smoke Vanish (the pieces vanish in smoke), Gold Rush (a chime and a shower of coins), Ember Ash (the pieces glow, then crumble to ash), Frozen (they freeze and shatter on landing), Lightning Strike (a bolt from the sky and thunder), Void Rift (a purple tear along the cut swallows them).
- **Grapples**: Iron Chain, Jungle Vine, Kunai Line, Shadow Tether (trails smoke), Spirit Thread (glowing), Lightning Whip (crackling bolt), Dragon Tail (gold scales and a dragon head that bites on).
- Try anything on the turning, swinging preview before you buy. Other players see what you wear, and bots wear random gear.


### Pagoda Falls
Sunset over purple mountains, pines, a distant waterfall and a sea of warm cloud, with cherry petals drifting through.
- **Everyone spawns on the outer ring** (the rock spires and terraces) and rushes the centre.
- A **three-tier pagoda** in the middle: walk around each deck's walled tier, then swing or dash up to the next. The tiled eaves flare out under each deck.
- A ring of **stone islands** (with torii gates and stone lanterns), three of them joined to the pagoda by **rope bridges**.
- Further out, tall **rock spires** with small tops and broad, low **terraces** with stone cover; two terraces are bridged in.
- **Red lacquer posts** (about 375) stand everywhere from the clouds to the sky. They work like the canopy's bamboo: grapple them and pass through them, and any fast blade contact severs one (the top falls, the stump stays).

### Moonlit Isles
Night under a full moon with a halo, a sky full of stars, far-off floating islands with trees, and fireflies.
- **Floating grass islands**: a big one in the middle with a **great cherry tree** (solid trunk; you can grapple its blossom), five around it and eight more on the outside, at many heights.
- **Rope bridges** join the middle island to three of the others, and each of those to an outer island.
- **Bamboo groves** (about 650 stalks) between the islands to swing from and cut through.
## How the slicing works

Every fighter is built from simple convex shapes (boxes, spheres, cylinders). When a blade connects, the game takes the plane swept by the blade that frame, bakes the posed model into world-space triangles, splits every triangle by that plane, and caps each cut part with the convex hull of the points where the plane crossed it (flesh-red for the body, steel for swords). Each side becomes a rigid piece with its own physics. Pieces lying on the floor nudge each other apart so they come to rest separately instead of piling through each other. Pieces keep their materials and can be sliced again.

## Code

- `index.html`: page, menus, HUD and styles
- `src/main.js`: game loop, controls, grappling hook, combat, bots, match rules, networking
- `src/cosmetics.js`: the shop catalogue (masks, headwear, outfits, swords, trails), coins and what you own
- `src/shop.js`: the shop screen and its 3D preview
- `src/maps2.js`: the Pagoda Falls and Moonlit Isles maps
- `src/killfx.js` and `src/grapple.js`: the kill effects and grapple styles
- `src/arena.js`: all three maps (Sky Spires, Sky Plateaus, Great Canopy), collision, grapple targeting and the bots' navigation graph
- `src/fighter.js`: the procedural samurai (human proportions: tapered torso, neck, face, jointed limbs), a long-striding run cycle, IK arms and legs, sword and trail
- `src/slice.js`: mesh slicing, cut caps, piece physics, blood and sparks
- `src/audio.js`: procedural sound effects. Movement sounds (sword whooshes, jumps, landings, dashes) are only heard within about 15 m of your character; slices, clashes and hooks carry about 32 m
- `src/net.js`: peer-to-peer rooms and the open rooms list (adapted from Splatline Paintball)

Every push to `main` redeploys the site on GitHub Pages within about a minute. Before committing changes to `src/` or `index.html`, run `tools/bump-version.sh` so browsers load the new files together.

To run locally, serve the folder with any static web server (ES modules don't load from `file://`).
