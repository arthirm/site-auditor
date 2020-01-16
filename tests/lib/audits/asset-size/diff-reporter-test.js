'use strict';

const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const DiffReporter = require('../../../../lib/audits/asset-size/diff-reporter');

describe('DiffReporter', function() {
  let config, page;
  beforeEach(function() {
    config = {
      budgets: [
        {
          path: '/foo'
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
    // The results array is sorted by change
    // reports edited files
    expect(results[1].file).to.equal('src/bar.js');
    expect(results[1].bundleName).to.equal('fixtures/assets/foo.min.js');

    // reports deleted files
    expect(results[2].file).to.equal('src/foo.js');

    // reports new files
    expect(results[0].file).to.equal('src/foo-bar.js');
    expect(results[0].bundleName).to.equal('fixtures/assets/foo.min.js');

  });

  it('addBundleAndFileNameToDiff adds bundle name and file name to diff object', function() {
    const diffObject =  [  {
      kind: 'E',
      path: [ 'fixtures/assets/foo.min.js::src/bar.js' ],
      lhs: 104,
      rhs: 124 },
     {
      kind: 'D',
      path: [ 'fixtures/assets/foo.min.js::src/foo.js' ],
      lhs: 97 },
     {
      kind: 'N',
      path: [ 'fixtures/assets/foo.min.js::src/foo-bar.js' ],
      rhs: 97 } ];

    const diffWithBundleAndFileName = [  {
        kind: 'E',
        path: [ 'fixtures/assets/foo.min.js::src/bar.js' ],
        lhs: 104,
        rhs: 124,
        bundleName: 'fixtures/assets/foo.min.js',
        file: 'src/bar.js' },
       {
        kind: 'D',
        path: [ 'fixtures/assets/foo.min.js::src/foo.js' ],
        lhs: 97,
        bundleName: 'fixtures/assets/foo.min.js',
        file: 'src/foo.js' },
       {
        kind: 'N',
        path: [ 'fixtures/assets/foo.min.js::src/foo-bar.js' ],
        rhs: 97,
        bundleName: 'fixtures/assets/foo.min.js',
        file: 'src/foo-bar.js' } ];

    const diffFinder = new DiffReporter(page, 'script');
    const result = diffFinder.addBundleAndFileNameToDiff(diffObject);
    expect(result).to.deep.equal(diffWithBundleAndFileName);
  });

  it('sortByChange function sorts the diff object by change', function() {
    const diffObject =  [  {
      kind: 'E',
      lhs: 104,
      rhs: 124 },
     {
      kind: 'D',
      lhs: 97 },
     {
      kind: 'N',
      rhs: 97 } ];

    const diffFinder = new DiffReporter(page, 'script');
    const results = diffFinder.sortByChange(diffObject);

    // The results array is sorted by change
    expect(results[0].change).to.equal(97);
    expect(results[1].change).to.equal(20);
    expect(results[2].change).to.equal(-97);
  });

  it('flattenBundle returns an array of files prepended with bundle name and its corresponding size', function() {
    const manifest = JSON.parse(fs.readFileSync(path.join(config.assetManifest.diffReport.baseManifestDir, 'foo-script.json')));
    const diffFinder = new DiffReporter(page, 'script');
    const result = diffFinder.flattenBundle(manifest);

    const flattenedManifest = { 'fixtures/assets/foo.min.js::node_modules/browser-pack/_prelude.js': 478,
      'fixtures/assets/foo.min.js::src/bar.js': 104,
      'fixtures/assets/foo.min.js::src/foo.js': 97,
      'fixtures/assets/foo.min.js::<unmapped>': 36 }

    expect(result).to.deep.equal(flattenedManifest);
  });

});