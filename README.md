# SiteAudit

SiteAudit is a simple tool which,
  * Uses chrome-debugging-client to audit budgets for your site until a configured marker or until LoadEventfired
  * Generates asset size manifests to record the size information for future reference using source-map-explorer
  * Reports the difference between the manifest files for a page to understand the increase in asset size.

## Usage

Using command line:

```js
npx audit --config-path config.js
```

To use it in code:

```js
const Runner = require('site-audit');
(async () => {
  try {
    const runner = new Runner('config.js');
    await runner.run();
  } catch(e) {
    console.error(e));
    process.exit(1);
  }
})();
```

## Sample Configuration

```js
module.exports = {    
  baseUrl: 'https://www.abc.com',
  debugPort: 9222,
  pageConfig: '/<setup-script-to-perform-login-and-other-stuff>.js',
  includeUrlPattern: '<url-pattern>',
  excludeUrlPattern: '<url-pattern>',
  chrome: {
    additionalArguments: [],
    emulatedFormFactor : '<mobile/desktop (default)>',
    headless: true,
    marker: '<rum_marker>' // (optional) if not present tracing will be done until LoadEventFired
    userAgent : '<user-agent>',
  },
  assetManifest: {
    includedTypes: ['script'],
    buildDir: '<path-where-build-output-of-application-resides>',
    targetDir: '<dir-to-store-asset-manifests-from-current-run>',
    diffReport: {
    oldManifestDir : '<asset-manifests-dir-path-from-prev-commit-for-comparison>'
    },
    encoding: 'br'
  },
  budgets: [
    {
      "path": "/routeA/",
      "name": "routeA",
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 300
        },
        {
          "resourceType": "stylesheet",
          "budget": 100
        }
      ]
    }
  ]
}
```

## Output example

```
********************************************************************
*                                                                  *
*                 Asset Size Audit Results                         *
*                                                                  *
********************************************************************

Audit summary for routeA

✖ You exceeded the allowable maximum for a routeA script!
         Now the size is 43.22 KB with a total increase of 0.70 KB
✔ Asset size check passed for routeA stylesheet!

Asset size diff report for 'routeA' (Uncompressed size)

Modified Files
--------------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │  Bundle Name        │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo.js     │ /assets/abc.js      │ 15.66 KB  │ 15.68 KB     │ 0.02 KB ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

New Files
---------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │  Bundle Name        │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo-bar.js │ /assets/abc.js      │   0 KB    │ 1.68 KB      │ 1.68 KB ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

Deleted Files
-------------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │  Bundle Name        │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/bar.js     │  /assets/abc.js     │  1 KB     │  0 KB        │ - 1 KB  ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝
```
