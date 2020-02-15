'use strict';

const AssetSizeManifestGenerator = require('./asset-size-manifest-generator');
const { AuditBudget, printAuditSummaryAndGetFailedResources } = require('./audit-budget');
const DiffReporter = require('./diff-reporter');

/**
 * This function includes and excludes the configured requests
 * @param {Object} page config object
 * @param {*} pageResults from tracing
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
 * This function performs asset-size check for each page and collects audit results
 * @param {*} page config object
 * @param {*} pageResults from tracing
 */
 async function collectAssetSizeAuditSummaryFor(page, pageResults) {
  const auditBudget = new AuditBudget(page, pageResults);
  const audits = auditBudget.audit();
  return audits;
}

/**
 * This function invokes assetManifest generation for all pages and resource types
 * @param {Object} results contains audit results, tracing results and page config
 */
async function generateManifests(results) {
  return Promise.all(results.map(async r => {
    const page = r.page;
    const manifestFn = async type => {
      const auditsForType = r.audits.filter(a => a.resourceType === type);
      const manifestGenerator = new AssetSizeManifestGenerator(page, type, r.pageResult, auditsForType[0]);
      return manifestGenerator.createAssetManifests();
    }
    return Promise.all(page.config.assetManifest.includedTypes.map(type => manifestFn(type)));
  }));
}

/**
 * This function invokes diff reporting for all pages if the page has failed audit for a resource type (js/css)
 * @param {Object} results contains audit results, tracing results and page config
 * @param {Object} failedResources
 */
async function diffReport(results, failedResources) {
  return Promise.all(results.map(async r =>  {
    const page = r.page;
    const includedTypes = page.config.assetManifest.includedTypes;
    const filteredFailedResources = failedResources ? failedResources.filter(resource => includedTypes.includes(resource.resourceType)) : [];
    if(filteredFailedResources.length > 0 ) {
      return filteredFailedResources
      .filter(failedResource => failedResource.url === page.relativePath)
      .map(failedResource => {
        const diffFinder = new DiffReporter(page, failedResource.resourceType);
        return Promise.all(diffFinder.diffReport());
      });
    } else {
      return Promise.resolve([]);
    }
  }));
}

/**
 * This function orchestrates asset size reporting,
 * a. Print Audit Summary
 * b. Generate assetsize manifest files which contains which file each byte in the page being rendered came from.
 * c. Provides diff between same 2 set of manifest files that are generated from different builds.
 * @param {Object} options
 * @param {Object} res contains audit results, tracing results and page config
 * @param {Object} config
 */

async function assetSizeReport(options, res, config) {
  // Print page audit summary
  const failedResources = printAuditSummaryAndGetFailedResources(res, config);

  if (options.manifest && config.assetManifest) {
    await generateManifests(res);
    if (options.diff && config.assetManifest.diffReport) {
      await diffReport(res, failedResources);
    }
  }
  return failedResources;
}

module.exports = {
  collectAssetSizeAuditSummaryFor, diffReport, filterUrls, generateManifests, assetSizeReport
}