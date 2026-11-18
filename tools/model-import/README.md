# Model import

Turns a character model (an .obj in a T-pose) into a body the game can wear as an outfit: `src/models/<name>.bin`.
The steps are four scripts run in order in the game's page (browser console or the preview), each leaving its
result on `window` for the next. They were written for the long-coat body and hold measurements taken from that
model, so a new model needs its own numbers in steps 3 and 4.

1. `1-load.js` reads the .obj (served next to the game as `_tmp_model.obj`) and turns it to the game's axes.
2. `2-voxelise.js` fills the closed mesh into a grid of small cubes.
3. `3-rebuild.js` edits the solid (removes the head and hands, which the game supplies; removes what should not be
   there; fills the coat's skirt) and rebuilds a light surface from it (about 14,000 triangles).
4. `4-fit-and-pack.js` gives every point its bone weights, warps the figure into the game's own T-pose and
   proportions, gives every triangle a material (coat, sash, under-robe, skin, trousers, boots) and packs the file.

The game side is `src/charbody.js` (loading, bones, posing) and the `body: '<name>'` field on an outfit in
`src/cosmetics.js`. Never commit the source model itself.
