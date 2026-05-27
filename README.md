# rolldown PR #9574 — bundler comparison

Reproduces the test case from
[rolldown/rolldown#9574 (comment)](https://github.com/rolldown/rolldown/pull/9574#issuecomment-4552962462)
to compare how **rolldown**, **rspack**, **esbuild**, and **rollup** handle
`sideEffects: false` combined with `export default <namespace>`.

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
npm run build           # runs all four
npm run build:rolldown  # individual targets
npm run build:rspack
npm run build:esbuild
npm run build:rollup
```

rolldown is pinned to the PR #9574 preview build via
`https://pkg.pr.new/rolldown/rolldown@9574`. The other three resolve to `latest`.

## Result

| Bundler | `console.log(123)` | Notes |
|---|---|---|
| rolldown (PR #9574) | dropped | inlines `api.used` to `"used"` |
| rspack | dropped | inlines `api.used` to `"used"` |
| esbuild | kept | namespace + `unused` also kept |
| rollup | kept | `unused` tree-shaken, namespace frozen |

### rolldown (PR #9574 preview)

```js
console.log("used");
```

### rspack

```js
console.log((/* inlined export .used */"used"));
```

### esbuild

```js
var __defProp = Object.defineProperty;
var __export = (target, all) => { ... };

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

Two defensible readings of the `sideEffects: false` contract:

**Aggressive (webpack convention).** The author has promised that top-level
statements in this package are not observable. The bundler may therefore
drop any statement that doesn't contribute to a consumed export, even
inside a module that is otherwise included. Under this reading, **rolldown
PR #9574 and rspack are correct**: they take the author at their word and
eliminate `console.log(123)` because nothing about it contributes to the
default export value being consumed by `main.js`.

**Conservative (rollup / esbuild).** `sideEffects: false` (or
`treeshake.moduleSideEffects: false`) gates only *module inclusion*. Once
a module is included because one of its exports is consumed, statement-level
side-effect-shaped calls are preserved. Under this reading, `console.log(123)`
stays.

Both interpretations are defensible. Within the webpack `sideEffects`
semantics that rspack inherits and that rolldown PR #9574 aims to match,
dropping the call is the intended optimization — the field exists to enable
exactly this kind of statement-level pruning when the author has explicitly
opted in.

## Source of the concern

The original PR comment raised a different worry: the optimization rewires
`LocalExport["default"].referenced` so that `export default ns` is treated
like a re-export chain. Per the ECMAScript spec, `export default <expr>` is
an **own export** of the module, while `export { ns as default }` is a
**re-export** — they have different implications for module inclusion when
`sideEffects` is *not* set. The collapse is safe under `sideEffects: false`,
but the same mechanism firing without that opt-in would be unambiguously
wrong. That distinction is what the PR review is asking to preserve.
