# Glimmerdeep

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/fernandondo2911-oss/glimmerdeep/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/fernandondo2911-oss/glimmerdeep/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Glimmerdeep is a lantern-lit digging game: delve 62 metres to the Heart Crystal, manage your air, dodge boulders and gloom wisps, and spend gems on upgrades at the surface tent.

## Run it

```sh
node tools/serve.mjs
```

Then open http://localhost:8080 in desktop Chrome. Move and dig with WASD or the arrow keys (or click a next-door cell), swing your pickaxe with Space, and press E at the tent to shop and rest.

To reproduce the handed-in output:

```sh
mkdir -p .out && MAKEFUN_OUTPUT_DIR=.out node main.ts
```

To retake the screenshots (headless Chromium via the DevTools protocol):

```sh
node tools/capture.mjs
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
