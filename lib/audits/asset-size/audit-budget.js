"use strict";

const chalk = require("chalk");
const log = console.log;
const logSymbols = require('log-symbols');
const { formatSize, groupBy } = require("../../utils");

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
   * Get budget summary
   * @param {*} resourceSizes
   */
  summarize(resourceSizes) {
    const groupedByType = groupBy(this._networkResponse, 'resourceType');
    // Get the total asset size for each resource type
    const summary = this.computeSummary(groupedByType);
    if (resourceSizes) {
      return resourceSizes.map(resource => {
        // Figure out which resource went over budget
        const { resourceType, budget} = resource;
       if (summary[resourceType] !== undefined) {
        const size = summary[resourceType];
        const budgetinKB = budget * 1024;
        const sizeOverBudget = size > budgetinKB ? (size - budgetinKB) : undefined;
        return { resourceType, size, sizeOverBudget };
       }
     }).filter(result => !!result);
    } else {
      console.log("No resource sizes has been provided. Returning totalSize of the resources");
      return summary;
    }
  }

  /**
   * Compute total asset size for each resource type
   * @param {*} groupedByType
   */
  computeSummary(groupedByType) {
     const summary = {};
     Object.keys(groupedByType).forEach(type => {
        const responses = groupedByType[type];
        const size = responses.reduce((acc, curr) => {
          return acc + Number((curr.size ? curr.size : 0));
        }, 0);
        summary[type.toLowerCase()] = size;
     });
     return summary;
  }

  report() {
    const pathBudget = this._page.config.budgets.filter(budget => budget.path === this._page.relativePath);
    let auditResults;
    if (pathBudget && pathBudget[0]) {
      auditResults = this.summarize(pathBudget[0].resourceSizes);
    }

    if (auditResults.length > 0) {
      auditResults.forEach(resource => {
        if (resource.sizeOverBudget > 0) {
          let msg = `You exceeded the allowable maximum for a ${chalk.yellow(pathBudget[0].name)} ${chalk.yellow(resource.resourceType)}!
          Now the size is ${chalk.yellow(formatSize(resource.size))} with a total increase of ${chalk.red(formatSize(resource.sizeOverBudget))}`;
          log(logSymbols.error, msg);
        } else {
          let msg = `Asset size check passed for ${lastSegment} ${resource.resourceType}!`;
          log(logSymbols.success, msg);
        }
      });
      return auditResults.filter(r => r.sizeOverBudget > 0);
    } else {
      console.warn(chalk.red(`Warning: Budget result is undefined.`));
      return auditResults;
    }
  }

}

module.exports = {
  AuditBudget: AuditBudget
};
