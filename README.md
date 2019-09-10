# SiteAudit

SiteAudit is a simple tool which does the following,
  * Use lighthouse to audit budgets for your site
  * Generates asset size manifests to record the size information for future reference
  * Reports the difference between manifest files for the same page for understanding the increase in asset size for a page.

## Usage

```js
const Runner = require('Runner');
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
       }
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
Asset size exceeded budget for 'https://www.abc.com/routeA/' type: 'script' by 45.71 KB, Current size: 79.71 KB
Asset size check passed for 'https://www.abc.com/routeA/' type: 'stylesheet'

Asset size failure reason for 'routeA'
Modified Files
--------------
File: src/bar.js, Old Size: 0.10 KB, New Size: 0.12 KB, Change: 0.02 KB
Deleted Files
-------------
File: src/foo.js, Old Size: 0.09 KB
New Files
---------
File: src/foo-bar.js, Size: 0.09 KB
```