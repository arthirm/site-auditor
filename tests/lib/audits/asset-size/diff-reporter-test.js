'use strict';

const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const DiffReporter = require('../../../../lib/audits/asset-size/diff-reporter');

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
          '../../../fixtures/current-manifests/'
        ),
        diffReport: {
          baseManifestDir: path.join(
            __dirname,
            '../../../fixtures/base-manifests/'
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
    expect(results.E[0].bundleName).to.equal('fixtures/assets/foo.min.js');

    // reports deleted files
    expect(results.D[0].file).to.equal('src/foo.js');

    // reports new files
    expect(results.N[0].file).to.equal('src/foo-bar.js');
    expect(results.N[0].bundleName).to.equal('fixtures/assets/foo.min.js');
  });
});