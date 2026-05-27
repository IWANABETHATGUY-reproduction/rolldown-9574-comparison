# rolldown PR #9574 — bundler comparison

Reproduces the test case from
[rolldown/rolldown#9574 (comment)](https://github.com/rolldown/rolldown/pull/9574#issuecomment-4552962462)
to compare how **rolldown**, **rspack**, **webpack**, **esbuild**, and **rollup**
handle `sideEffects: false` combined with two related forms of namespace
re-export.

## Test cases

Two variants share the same `package.json` (`"sideEffects": false`) and
`api.js`:

```js
// api.js
export const used = 'used';
export const unused = 'unused';
```

### `src/` — own-export form

```js
// src/main.js
import api from './middle.js';
console.log(api.used);

// src/middle.js
import * as api from './api.js';
console.log(123);              // side-effect-shaped statement
export default api;            // own export — captures namespace value
```

### `src2/` — pure re-export form

```js
// src2/main.js
import { api } from './middle.js';
console.log(api.used);

// src2/middle.js
export * as api from './api.js';   // pure re-export, no own binding
console.log(123);                  // side-effect-shaped statement
```

The distinction is the heart of the PR comment: `export default api` is an
**own export** (the module captures a value into a local `default` binding,
which requires evaluating the module), whereas `export * as api from './api'`
is a **pure re-export** (no local binding; the consumer reaches through to
`api.js` directly without requiring `middle.js` to evaluate).

## Setup

```sh
npm install
npm run build           # runs all five against the active input
npm run build:rolldown  # individual targets
npm run build:rspack
npm run build:webpack
npm run build:esbuild
npm run build:rollup
```

Each config (`rolldown.config.js`, `rollup.config.js`, `rspack.config.js`,
`webpack.config.js`, `esbuild.config.mjs`) has two input lines — one
active, one commented. Toggle the comments to switch between `src/` and
`src2/`.

rolldown is pinned to the PR #9574 preview build via
`https://pkg.pr.new/rolldown/rolldown@9574`. The other four resolve to `latest`.

## Results

### `src/` — own-export form (`export default api`)

| Bundler | `console.log(123)` |
|---|---|
| rolldown (PR #9574) | dropped |
| rspack (latest) | dropped |
| webpack 5 (latest) | **kept** |
| esbuild (latest) | kept |
| rollup (latest) | kept |

### `src2/` — pure re-export form (`export * as api from './api'`)

| Bundler | `console.log(123)` |
|---|---|
| rolldown (PR #9574) | dropped |
| rspack (latest) | dropped |
| webpack 5 (latest) | dropped |
| esbuild (latest) | kept |
| rollup (latest) | dropped |

### Cross-tab summary

| Bundler | src (own export) | src2 (re-export) | Distinguishes the two forms? |
|---|---|---|---|
| rolldown PR #9574 | dropped | dropped | **no** |
| rspack | dropped | dropped | **no** |
| webpack 5 | kept | dropped | **yes** |
| esbuild | kept | kept | no (conservative both ways) |
| rollup | kept | dropped | **yes** |

## Interpretation

The cross-tab matrix is the most revealing artifact in this repo. **Webpack
and rollup distinguish the two syntactic forms**: they preserve
`console.log(123)` when the default export is an own-export expression
(`export default api`) but elide it when the export is a pure re-export
(`export * as api from './api'`).

That matches the ECMAScript semantics described in the PR comment:

- `export default <expr>` evaluates the expression at module load time and
  binds the result to the module's local `default` slot. To observe the
  default binding, the module body must execute. Therefore the
  side-effect-shaped statement in the same body is reachable code under
  any consumption of the default export.
- `export * as ns from './source'` introduces no local binding in the
  intermediate module. The consumer effectively reaches through to
  `./source`. Under `sideEffects: false`, the intermediate module can be
  skipped because none of its own exports are being read.

Against that yardstick:

- **rolldown PR #9574** and **rspack** collapse both forms into the
  re-export shape. That's correct for `src2` but moves `src` in a direction
  webpack does not — they go further than webpack on the very convention
  webpack defines.
- **webpack** and **rollup** track the distinction correctly.
- **esbuild** is conservative on both: keeps the side effect in both
  variants, which is safe but leaves the `src2` optimization on the table.

The PR comment was right that the rewiring of `LocalExport["default"].referenced`
collapses two semantically distinct forms into one. The empirical effect
shows up exactly where the comment predicted: in `src`, where rolldown PR
diverges from webpack/rollup, while rspack already exhibits the same
divergence. In `src2`, where the collapse happens to coincide with the
correct answer, all four aggressive bundlers agree.

## Source of the concern

Per the comment, the optimization rewires `LocalExport["default"].referenced`
so `export default ns` is treated like `export { ns as default }`. The
`src` vs `src2` results confirm that the distinction matters: webpack and
rollup observably behave differently across the two forms, but rolldown
PR #9574 and rspack do not.
