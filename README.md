# SiteAudit

SiteAudit is a simple tool which does the following,
  * Use lighthouse to audit budgets for your site
  * Generates asset size manifests to record the size information for future reference using source-map-expplorer
  * Reports the difference between manifest files for the a page to understand the increase in asset size.

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
    workerPoolSize: 5,
    puppeteer: {
      headless: true,
      pageConfig: '/<setup-puppeteer-script-to-perform-login-and-other-stuff>.js',
    },
    lighthouse: {
      emulatedFormFactor: 'desktop', 
      onlyCategories: ['performance']
    },
    assetManifest: {
       includedTypes: ['Script'],
       buildDir: '<path-where-build-output-of-application-resides>',
       splitUrlPattern: '<url-pattern>',
       targetDir: '<dir-to-store-asset-manifests-from-current-run>',
       diffReport: {
        oldManifestDir : '<asset-manifests-dir-path-from-prev-commit-for-comaprison>'
       },
       encoding: '.br'
    },      
    budgets: [
        {
            "path": "/routeA/",
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
✖ You exceeded the allowable maximum for a routeA script!
         Now the size is 23.22 KB with a total increase of 1.70 KB
✔ Asset size check passed for routeB script!

Asset size failure reason for 'routeA'

Modified Files
--------------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Current Bundle      │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo-bar.js │ /assets/abc.js      │ 15.66 KB  │ 15.68 KB     │ 0.02 KB ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

New Files
---------

╔════════════════╤═════════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Current Bundle      │ Prev Size │ Current size │ Change  ║
╟────────────────┼─────────────────────┼───────────┼──────────────┼─────────╢
║ src/foo-bar.js │ /assets/abc.js      │           │ 1.68 KB      │         ║
╚════════════════╧═════════════════════╧═══════════╧══════════════╧═════════╝

Deleted Files
-------------

╔════════════════╤═══════════╤══════════════╤═════════╗
║ Files          │ Prev Size │ Current size │ Change  ║
╟────────────────┼───────────┼──────────────┼─────────╢
║ src/foo.js     │ 1.68 KB   │              │         ║
╚════════════════╧═══════════╧══════════════╧═════════╝
```
