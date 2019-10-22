'use strict';

const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const AssetSizeManifestGenerator = require('../../../../lib/audits/asset-size/asset-size-manifest-generator');

describe('AssetSizeManifestGenerator', function() {
  let config, page;
  beforeEach(function() {
    config = {
      includeUrlPattern: '/pattern',
      assetManifest: {
        includedTypes: ['script'],
        buildDir: path.join(__dirname, '../../../fixtures/assets'),
        currentManifestDir: path.join(
          __dirname,
          '../../../fixtures/current-manifests/'
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