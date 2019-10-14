"use strict";

const AssetSizeManifestGenerator = require("./asset-size-manifest-generator").AssetSizeManifestGenerator;
const AuditBudget = require("./audit-budget").AuditBudget;
const DiffReporter = require("./diff-reporter").DiffReporter;

/**
 * This function orchestrates asset size audit which does,
 * a. Report perfomance budgets for the configured pages.
 * b. Generate Assetsize Manifest files which contains which file each byte in the page being rendered came from.
 * c. Provides diff between same 2 set of manifest files that are generated from different builds.
 * @param {*} page
 * @param {*} pageResults
 */
async function performAssetSizeCheck(page, pageResults) {
  // Include and exclude the configured requests
  const includeUrlPattern = page.config.includeUrlPattern;
  const excludeUrlPattern = page.config.excludeUrlPattern;
  if (includeUrlPattern) {
    pageResults = pageResults.filter(obj => (obj.url ? obj.url.includes(includeUrlPattern) : false));
  }
  if (excludeUrlPattern) {
    pageResults = pageResults.filter(obj => (obj.url ? !obj.url.includes(excludeUrlPattern) : false));
  }

  // Report whether the resource passed/failed the budgeting
  const auditBudget = new AuditBudget(page, pageResults);
  const failedAudits = auditBudget.report();

  // AssetSize manifest files should be generated only if assetManifest section is present in config file
  if (failedAudits!== undefined && page.config.assetManifest) {
    page.config.assetManifest.includedTypes.forEach(async type => {
      // Generate asset size manifest files
      const manifestGenerator = new AssetSizeManifestGenerator(page, type, pageResults);
      await manifestGenerator.createAssetManifests();

      // Print failure report if diffReport section is present in config and there are failed audits for resourcetype
      if (page.config.assetManifest.diffReport && failedAudits.filter(resource => resource.resourceType == type.toLowerCase())) {
        const diffFinder = new DiffReporter(page, type);
        diffFinder.diffReport();
      }
    });
  }
  return failedAudits;
}

module.exports = {
  performAssetSizeCheck
};