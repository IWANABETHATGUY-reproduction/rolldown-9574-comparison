# rolldown PR #9574 — bundler comparison

Reproduces the test case from
[rolldown/rolldown#9574 (comment)](https://github.com/rolldown/rolldown/pull/9574#issuecomment-4552962462)
to compare how **rolldown**, **rspack**, **webpack**, **esbuild**, and **rollup**
handle `sideEffects: false` combined with `export default <namespace>`.

## Test case

```js
// package.json
{ "sideEffects": false }

// src/main.js
import api from './middle.js';
console.log(api.used);

// src/middle.js
import * as api from './api.js';
console.log(123);        // side-effect-shaped statement
export default api;

// src/api.js
export const used = 'used';
export const unused = 'unused';
```

The question: under `sideEffects: false`, does `console.log(123)` survive
into the bundle?

## Setup

```sh
npm install
npm run build           # runs all five
npm run build:rolldown  # individual targets
npm run build:rspack
npm run build:webpack
npm run build:esbuild
npm run build:rollup
```

rolldown is pinned to the PR #9574 preview build via
`https://pkg.pr.new/rolldown/rolldown@9574`. The other four resolve to `latest`.

## Result

| Bundler | `console.log(123)` | Notes |
|---|---|---|
| rolldown (PR #9574) | dropped | inlines `api.used` to `"used"` |
| rspack (latest) | dropped | inlines `api.used` to `"used"` |
| webpack 5 (latest) | **kept** | despite `sideEffects: false` |
| esbuild (latest) | kept | namespace + `unused` also kept |
| rollup (latest) | kept | `unused` tree-shaken, namespace frozen |

### rolldown (PR #9574 preview)

```js
console.log("used");
```

### rspack

```js
console.log((/* inlined export .used */"used"));
```

### webpack 5

```js
// NAMESPACE OBJECT: ./src/api.js
var api_namespaceObject = {};
__webpack_require__.r(api_namespaceObject);
__webpack_require__.d(api_namespaceObject, {
  unused: () => (unused),
  used:   () => (used)
});

;// ./src/api.js
const used = 'used';
const unused = 'unused';

;// ./src/middle.js
console.log(123);
const middle = api_namespaceObject;

;// ./src/main.js
console.log(middle.used);
```

### esbuild

```js
// src/api.js
var api_exports = {};
__export(api_exports, { unused: () => unused, used: () => used });
var used = "used";
var unused = "unused";

// src/middle.js
console.log(123);
var middle_default = api_exports;

// src/main.js
console.log(middle_default.used);
```

### rollup

```js
const used = 'used';

var api = /*#__PURE__*/Object.freeze({
    __proto__: null,
    used: used
});

console.log(123);

console.log(api.used);
```

## Interpretation

The key finding: **webpack itself — the originator of the `sideEffects`
convention — keeps `console.log(123)`.** Only **rspack** and the
**rolldown PR #9574** preview drop it.

That reframes the question. The `sideEffects: false` field is webpack's
convention, and webpack's own behavior is the reference for what that
convention means. Under webpack 5:

- A module whose default export is consumed is included.
- Once included, its top-level statements run.
- `sideEffects: false` gates *whether the whole module can be skipped when
  nothing it exports is used*, not whether individual side-effect-shaped
  statements may be deleted from an included module.

By that yardstick:

- **rollup, esbuild, webpack** are consistent: include `middle.js`, keep
  `console.log(123)`.
- **rspack** diverges from webpack: it applies a more aggressive statement-
  level pruning that webpack does not perform on the same input.
- **rolldown PR #9574** matches rspack's aggressive behavior, which is
  also a divergence from webpack.

So the question shifts from "is the aggressive optimization valid under the
`sideEffects` contract?" to "is it intentional that rspack — and now
rolldown — go further than webpack itself does?" If matching webpack
semantics is the goal, this PR introduces a divergence in the same direction
rspack already diverges.

## Source of the concern

The original PR comment raised a structural worry: the optimization rewires
`LocalExport["default"].referenced` so that `export default ns` is treated
like a re-export chain. Per the ECMAScript spec, `export default <expr>`
is an **own export** of the module, while `export { ns as default }` is a
**re-export** — they have different implications for module inclusion. The
collapse is what enables the elimination of `middle.js`'s body here. Whether
that's correct under `sideEffects: false` is debatable; what is not
debatable is that webpack does not do it, so the PR moves rolldown away
from webpack-compatible behavior rather than toward it.
