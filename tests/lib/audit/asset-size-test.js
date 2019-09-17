'use strict';

const path = require('path');
const expect = require('chai').expect;
const { AssetSizeManifestGenerator, DiffReporter, LHBudgetReport } =  require("../../../lib/audits/asset-size")


describe('DiffReporter', function() {

  it('reports diff between 2 manifest files', function() {
    const oldFile = path.join(__dirname, '../../fixtures/asset-manifests/foo-1.json');
    const newFile = path.join(__dirname, '../../fixtures/asset-manifests/foo-2.json');
    const diffFinder = new DiffReporter(oldFile, newFile, '/abc' );
    const results = diffFinder.diffReport();

    expect(results.E[0].file).to.equal('src/bar.js');
    expect(results.E[0].bundleName[0]).to.equal('fixtures/assets/foo.min.js');

    expect(results.D[0].file).to.equal('src/foo.js');
    expect(results.N[0].file).to.equal('src/foo-bar.js');
    expect(results.N[0].bundleName[0]).to.equal('fixtures/assets/foo.min.js');
  });

  it('assetsize reports the resource that went over budget', function() {
    const auditResults = {
    audits: { 'performance-budget': { details : { items : [{
        resourceType: 'script',
        label: 'Script',
        requestCount: 12,
        size: 1740823,
        countOverBudget: undefined,
        sizeOverBudget: 1433623 },
      {
        resourceType: 'stylesheet',
        label: 'Stylesheet',
        requestCount: 8,
        size: 169134,
        countOverBudget: undefined,
        sizeOverBudget: undefined
      }]}}}};
    
    const budgetReport = new LHBudgetReport('http://www.abc', auditResults);
    const failedAudits = budgetReport.report();
    expect(failedAudits.length).to.equal(1);
    expect(failedAudits[0]).deep.equals(auditResults.audits['performance-budget'].details.items[0])
  });

  it('assetsize report throws when lighthouse results are not generated properly', function() {
    const auditResults = {
    audits: { 'performance-budget': { details : {}}}};
    
    const budgetReport = new LHBudgetReport('http://www.abc', auditResults);
    expect(function() { budgetReport.report() }).to.throw(/Error: Lighthouse budget result is undefinedy*/);
  });

  it('asset-size manifest is generated when a valid source map is present', function() {
    let paths = [ path.resolve(path.join(__dirname, '../fixtures/assets/foo.min.js'))];
    const manifestGenerator = new AssetSizeManifestGenerator(
      '/abc',
      "js",
      paths,
      path.join(__dirname, '../tmp/asset-manifests')
    );
    manifestGenerator.createAssetManifests();
  });
 
  it.skip('asset-size manifest throws when source map is not found for the js file', function() {
    let paths = [ path.resolve(path.join(__dirname, '../fixtures/assets/bar.min.js'))];
    const manifestGenerator = new AssetSizeManifestGenerator(
      '/abc',
      "js",
      paths,
      path.resolve(path.join(__dirname, '../tmp/asset-manifests'))
    );
    expect(function() { manifestGenerator.createAssetManifests() }).to.throw();
  });

})