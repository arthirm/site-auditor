'use strict';

const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const AssetSizeManifestGenerator = require('../../../lib/audits/asset-size/asset-size-manifest-generator')
  .AssetSizeManifestGenerator;
const AuditBudget = require('../../../lib/audits/asset-size/audit-budget')
  .AuditBudget;
const DiffReporter = require('../../../lib/audits/asset-size/diff-reporter')
  .DiffReporter;

describe('Asset size', function() {
  describe('AuditBudget', function() {
    let config, page;
    beforeEach(function() {
      config = {
        budgets: [
          {
            path: '/foo',
            resourceSizes: [
              {
                resourceType: 'script',
                budget: 1, // Size is in KB
              },
            ],
          },
        ],
      };
      page = {
        url: 'base/foo',
        relativePath: '/foo',
        config,
      };
    });

    it('reports the resource that went over budget', function() {
      let networkRequests = [
        {
          resourceType: 'script',
          url: '/abc',
          size: 1000,
        },
        {
          resourceType: 'script',
          url: '/bar',
          size: 1000,
        },
      ];

      const auditBudget = new AuditBudget(page, networkRequests);
      const failedAudits = auditBudget.report();

      expect(failedAudits[0].sizeOverBudget).equals(976);
      expect(failedAudits[0].size).equals(2000);
      expect(failedAudits[0].resourceType).equals('script');
    });

    it('handles when request does not contain the resource for which budgeting is defined', function() {
      let networkRequests = [
        {
          resourceType: 'images',
          url: '/abc',
          size: 1000,
        },
      ];
      const auditBudget = new AuditBudget(page, networkRequests);
      expect(function() {
        auditBudget.report();
      }).to.contain(/Warning: Budget result is undefined*/);
    });
  });

  describe('AssetSizeManifestGenerator', function() {
    let config, page;
    beforeEach(function() {
      config = {
        includeUrlPattern: '/pattern',
        assetManifest: {
          includedTypes: ['script'],
          buildDir: path.join(__dirname, '../../fixtures/assets'),
          currentManifestDir: path.join(
            __dirname,
            '../../fixtures/current-manifests/'
          ),
        },
      };
      page = {
        url: 'base/foo',
        relativePath: '/foo',
        config,
      };
    });

    it('converts the network requests to disk paths and respects filters', function() {
      let networkRequests = [
        {
          resourceType: 'script',
          url: 'http://www.page.com/bar/abc',
          size: 1000,
        },
        {
          resourceType: 'script',
          url: 'http://www.page.com/pattern/abcd',
          size: 1000,
        },
        {
          resourceType: 'image',
          url: 'http://www.page.com/foo/abcd',
          size: 1000,
        },
      ];
      const manifestGenerator = new AssetSizeManifestGenerator(
        page,
        'js',
        networkRequests
      );
      const paths = manifestGenerator.networkRequestToPaths();
      expect(paths.length).equals(1);
      expect(paths[0]).contains('fixtures/assets/abcd');
    });

    it('generates a manifest file when a valid source map is present', async function() {
      let networkRequests = [
        {
          resourceType: 'script',
          url: 'http://www.page.com/pattern/foo.min.js',
          size: 1000,
        },
      ];

      const manifestGenerator = new AssetSizeManifestGenerator(
        page,
        'js',
        networkRequests
      );
      const explorerResult = await manifestGenerator.createAssetObjForRoute();

      expect(explorerResult.bundles[0].bundleName).contains(
        'assets/foo.min.js'
      );
      expect(explorerResult.bundles[0].files['src/bar.js']).equals(104);
      // check the size is sorted
      expect(
        Object.values(explorerResult.bundles[0].files)
      ).to.have.ordered.members([478, 104, 97, 36]);
    });

    it('throws when source map is not found for the js file', async function() {
      chai.use(chaiAsPromised);
      page.relativePath = '/bar';
      let networkRequests = [
        {
          resourceType: 'script',
          url: 'http://www.page.com/pattern/bar.min.js',
          size: 1000,
        },
      ];
      const manifestGenerator = new AssetSizeManifestGenerator(
        page,
        'js',
        networkRequests
      );
      await expect(
        manifestGenerator.createAssetObjForRoute()
      ).to.be.rejectedWith(
        "Error: Couldn't run source map explorer for the page 'bar'"
      );
    });
  });

  describe('DiffReporter', function() {
    let config, page;
    beforeEach(function() {
      config = {
        budgets: [
          {
            path: '/foo',
          },
        ],
        assetManifest: {
          currentManifestDir: path.join(
            __dirname,
            '../../fixtures/current-manifests/'
          ),
          diffReport: {
            baseManifestDir: path.join(
              __dirname,
              '../../fixtures/base-manifests/'
            ),
          },
        },
      };
      page = {
        url: 'base/foo',
        relativePath: '/foo',
        config,
      };
    });

    it('reports diff between 2 manifest files', function() {
      const diffFinder = new DiffReporter(page, 'script');
      const results = diffFinder.diffReport();

      // reports edited files
      expect(results.E[0].file).to.equal('src/bar.js');
      expect(results.E[0].bundleName[0]).to.equal('fixtures/assets/foo.min.js');

      // reports deleted files
      expect(results.D[0].file).to.equal('src/foo.js');

      // reports new files
      expect(results.N[0].file).to.equal('src/foo-bar.js');
      expect(results.N[0].bundleName[0]).to.equal('fixtures/assets/foo.min.js');
    });
  });
});
