'use strict';

const AssetSizeManifestGenerator = require('./asset-size-manifest-generator');
const { AuditBudget } = require('./audit-budget');
const DiffReporter = require('./diff-reporter');

/**
 * This function performs asset-size check for each page
 * @param {*} page
 * @param {*} pageResults
 */
 async function performAssetSizeCheck(page, pageResults) {
  const auditBudget = new AuditBudget(page, pageResults);
  const audits = auditBudget.audit();
  return audits;
}

/**
 * This function includes and excludes the configured requests
 * @param {*} page
 * @param {*} pageResults
 */
function filterUrls(page, pageResults) {
  const includeUrlPattern = page.config.includeUrlPattern;
  const excludeUrlPattern = page.config.excludeUrlPattern;
  if (includeUrlPattern) {
    pageResults = pageResults.filter(obj =>
      obj.url ? obj.url.includes(includeUrlPattern) : false
    );
  }
  if (excludeUrlPattern) {
    pageResults = pageResults.filter(obj =>
      obj.url ? !obj.url.includes(excludeUrlPattern) : false
    );
  }
  return pageResults;
}

/**
 * This function orchestrates asset size reporting,
 * a. Generate Assetsize Manifest files which contains which file each byte in the page being rendered came from.
 * b. Provides diff between same 2 set of manifest files that are generated from different builds.
 * @param {*} results
 * @param {*} failedResources
 */
function diffReport(results, failedResources) {
  results.forEach( r => {
    const page = r.page;
    // AssetSize manifest files should be generated only if assetManifest section is present in config file
    if (failedResources !== undefined && failedResources.length > 0 && page.config.assetManifest) {
      page.config.assetManifest.includedTypes.forEach(async type => {
        // Generate asset size manifest files
        const manifestGenerator = new AssetSizeManifestGenerator(page, type, r.pageResult);
        await manifestGenerator.createAssetManifests();

        // Print failure report if diffReport section is present in config and there are failed audits for resourcetype
        if (
          page.config.assetManifest.diffReport &&
          failedResources.filter(resource => resource.resourceType == type.toLowerCase())
        ) {
          const diffFinder = new DiffReporter(page, type);
          diffFinder.diffReport();
        }
      });
    }
  });
}

module.exports = {
  performAssetSizeCheck, diffReport, filterUrls
}