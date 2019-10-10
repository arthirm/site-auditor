# SiteAudit

SiteAudit is a simple tool which,
  * Uses chrome-debugging-client to audit budgets for your site until a configured marker
  * Generates asset size manifests to record the size information for future reference using source-map-explorer
  * Reports the difference between the manifest files for a page to understand the increase in asset size.

## Usage

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
  chrome: {
    additionalArguments: [],
    emulatedFormFactor : '<mobile/desktop (default)>',
    headless: true,
    marker: '<rum_marker>'
    userAgent : '<user-agent>',
  },
  assetManifest: {
    includedTypes: ['Script'],
    buildDir: '<path-where-build-output-of-application-resides>',
    includeUrlPattern: '<url-pattern>',
    targetDir: '<dir-to-store-asset-manifests-from-current-run>',
    diffReport: {
    oldManifestDir : '<asset-manifests-dir-path-from-prev-commit-for-comaprison>'
    },
    encoding: '.br'
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
    },
    {
      "path": "/routeB/"
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
✖ You exceeded the allowable maximum for a routeA script!
         Now the size is 18.36 KB with a total increase of 0.70 KB
✔ Asset size check passed for routeB script!

Asset size failure reason for 'routeA'

Modified Files
--------------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Current Bundle      │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo.js     │ /assets/abc.js      │ 15.66 KB  │ 15.68 KB     │ 0.02 KB ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

New Files
---------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Current Bundle      │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo-bar.js │ /assets/abc.js      │   0 KB    │ 1.68 KB      │ 1.68 KB ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

Deleted Files
-------------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Current Bundle      │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/bar.js     │                     │  1 KB     │  0 KB        │ - 1 KB  ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝
```
