'use strict';

const { formatSize, getTable, groupBy } = require('../../utils');
const chalk = require('chalk');

/**
 * This class performs budget audit for a page
 */
class AuditBudget {
  constructor(page, networkResponse) {
    // Page object created by runner
    this._page = page;
    // Network results from tracer
    this._networkResponse = networkResponse;
  }

  /**
   * Audit and get budget summary
   * @return {Object} returns summary object
   */
  audit() {
    const pathBudget = this._page.config.budgets.filter(
      budget => budget.path === this._page.relativePath
    );

    const resourceSizes = pathBudget[0].resourceSizes
    const groupedByType = groupBy(this._networkResponse, 'resourceType');
    // Get the total asset size for each resource type
    const summary = this.computeSummary(groupedByType);
    if (resourceSizes) {
      return resourceSizes
        .map(resource => {
          // Figure out which resource went over budget
          const { resourceType, budget } = resource;
          if (summary[resourceType] !== undefined) {
            const size = summary[resourceType];

            const budgetinKB = budget  * 1024;
            const sizeOverBudget = size - budgetinKB;
            return { url: this._page.relativePath, resourceType, size, sizeOverBudget, budget };
          }
        })
        .filter(result => !!result);
    } else {
      console.log(
        'No resource sizes has been provided. Returning totalSize of the resources'
      );
      return summary;
    }
  }

  /**
   * Compute total asset size for each resource type
   * @param {Object} groupedByType
   * @return {Object} returns summary object
   */
  computeSummary(groupedByType) {
    const summary = {};
    Object.keys(groupedByType).forEach(type => {
      const responses = groupedByType[type];
      const size = responses.reduce((acc, curr) => {
        return acc + Number(curr.size ? curr.size : 0);
      }, 0);
      summary[type.toLowerCase()] = size;
    });
    return summary;
  }
}

/**
 * Prints the audit summary of all pages/failed pages and returns the failed resource
 * @param {Object} auditResults
 * @param {Object} config
 * @return {Array} failedResources
 */
function printAuditSummaryAndGetFailedResources(auditResults, config) {

  let encoding = 'Uncompressed';
  if (config.assetManifest && config.assetManifest.encoding) {
    encoding = config.assetManifest.encoding;
  }

  // By default print the audit summary
  const printAuditSummary = config.printAuditSummary ? config.printAuditSummary : 'true';
  if (printAuditSummary) {
    const columns = ['Page', 'Type', 'Exceeded (y/n)', `Current size (${encoding})`, `Size Limits (${encoding})`, `Difference (${encoding})`, 'Url'];
    const table = getTable(columns);
    // Print summary of all pages or only the failed one's
    const printOnlyFailedPages = config.printOnlyFailedPages ? config.printOnlyFailedPages : 'false';

    auditResults.forEach( result => {
      const page = result.page;
        const pathBudget = config.budgets.filter(
          budget => budget.path === page.relativePath
        );

        if (result.audits.length > 0) {
          result.audits.forEach(resource => {
            if (!printOnlyFailedPages || (printOnlyFailedPages && resource.sizeOverBudget > 0)) {
              table.push([pathBudget[0].name, resource.resourceType, resource.sizeOverBudget > 0 ? `Y` : `N`,
                formatSize(resource.size), `${resource.budget} KB`, formatSize(resource.sizeOverBudget), page.url
                ]);
            }
          });
        } else {
          console.warn(chalk.red(`Warning: Budget result is undefined for ${page.url}`));
        }
    });
    if (table.length > 0) {
      console.log(table.toString());
      console.log('\n');
    }
  }

  // Return the failed resource
  const failedResource =  auditResults.map(result => result.audits.filter(r => r.sizeOverBudget > 0));
  return [].concat(...failedResource);
}

module.exports = {
  AuditBudget, printAuditSummaryAndGetFailedResources
}