# SiteAuditor

SiteAuditor is a simple tool which,
  * Uses chrome-debugging-client to audit budgets for your site until a configured marker or until LoadEventfired
  * Generates asset size manifests to record the size information for future reference using source-map-explorer
  * Reports the difference between the manifest files for a page to understand the increase in asset size.

## Usage

### Note:
 * Make sure the configured site/page is reachable before using the tool.
 * Also to generate asset manifests or to report diff, the build should have generated the source maps for the corresponding assets.

Using command line:

```js
npx site-auditor --config-path config.js
```

To use it in code:

```js
const Runner = require('site-auditor');
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
  includeUrlPattern: '<url-path-to-convert-to-disk-path>',
  excludeUrlPattern: '<url-pattern-to-exclude-from-tracing>',
  printAuditSummary: true, // (optional) defaults to true. Either audit summary or diff report should be enabled
  printOnlyFailedPages: true,
  baseDir : '<base-dir-of-the-app>'
  chrome: {
    additionalArguments: ['additional args for chrome'],
    emulatedFormFactor : '<mobile/desktop (default)>',
    headless: true,
    marker: '<rum_marker>' // (optional) if not present tracing will be done until LoadEventFired
    userAgent : '<user-agent-to-track-mobile-pages>',
    traceTimeout : '<timeout-in-ms>'
  },
  assetManifest: {
    // Type of assets for which manifests need to be generated
    includedTypes: ['script', 'stylesheet'],
    // In case js has source maps but css does not, then this config is to indicate that source-map-explorer should be used only for scripts and not css but the manifest files should be generated for both
    typesWithoutSourceMap: ['stylesheet'],
    buildDir: '<path-where-build-output-of-application-resides>',
    targetDir: '<dir-to-store-asset-manifests-from-current-run>',
    diffReport: {
      oldManifestDir : '<asset-manifests-dir-path-from-prev-commit-for-comparison>'
    },
    encoding: 'br' // brotli compression or other formats
  },
  budgets: [
    {
      "path": "/routeA/",
      "name": "routeA",
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 300 // size in KB
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

╔══════╤════════╤════════════════╤═════════════════════════════╤════════════════════════════╤═══════════════════════════╤══════════╗
║ Page │ Type   │ Exceeded (y/n) │ Current size (Uncompressed) │ Size Limits (Uncompressed) │ Difference (Uncompressed) │ Url      ║
╟──────┼────────┼────────────────┼─────────────────────────────┼────────────────────────────┼───────────────────────────┼──────────╢
║ foo  │ script │  Y             │ 10.74 KB                    │ 10 KB                      │ 0.74 KB                   │ base/foo ║
╚══════╧════════╧════════════════╧═════════════════════════════╧════════════════════════════╧═══════════════════════════╧══════════╝


'routeA' - diff report

Prev: 751 KB, Current: 735 KB, Diff: -0.02 KB

╔════════════════╤════════════════════════════╤═══════════╤═══════════════╤══════════╗
║ Files          │ Bundle Name                │ Prev Size │ Current size  │ Change   ║
╟────────────────┼────────────────────────────┼───────────┼───────────────┼──────────╢
║ src/foo-bar.js │ fixtures/assets/foo.min.js │ N/A       │ 0.09 KB (New) │ 0.09 KB  ║
╟────────────────┼────────────────────────────┼───────────┼───────────────┼──────────╢
║ src/bar.js     │ fixtures/assets/foo.min.js │ 0.10 KB   │ 0.12 KB       │ 0.02 KB  ║
╟────────────────┼────────────────────────────┼───────────┼───────────────┼──────────╢
║ src/foo.js     │ fixtures/assets/foo.min.js │ 0.09 KB   │ Deleted       │ -0.09 KB ║
╟────────────────┼────────────────────────────┼───────────┼───────────────┼──────────╢
║ Total          │                            │ 0.19 KB   │ 0.21 KB       │ 0.02 KB  ║
╚════════════════╧════════════════════════════╧═══════════╧═══════════════╧══════════╝

```
