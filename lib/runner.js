'use strict';

const path = require('path');
const { ConfigUtils, error } = require('./utils');
const { performAssetSizeCheck, diffReport, filterUrls } = require('./audits/asset-size');
const { printSummaryAndGetFailedResources } = require('./audits/asset-size/audit-budget');
const Tracer = require('./trace/tracer');


/**
 * This class is responsible for invoking the tracer and audit for each page
 */
module.exports = class Runner {
  constructor(configPath) {
    this._config = ConfigUtils.loadConfig(path.resolve(configPath));
    ConfigUtils.validate(this._config);
  }

  run() {
    const baseUrl = this._config.baseUrl;
    const paths = this._config.budgets.map(budget => budget.path);
    let startPort = this._config.debugPort;
    const pages = paths.map((path, index) => {
      return {
        url: baseUrl + path,
        port: startPort + index,
        relativePath: path,
        config: this._config,
      };
    });
    try {
      console.log(
        '********************************************************************'
      );
      console.log(
        '*                                                                  *'
      );
      console.log(
        '*                         Asset Size Audit                         *'
      );
      console.log(
        '*                                                                  *'
      );
      console.log(
        '********************************************************************'
      );
      const results = pages.map(async page => {
        let cb;
        // Application setup can be done here
        if (page.config.pageConfig) {
          const callbackPath = page.config.pageConfig;
          cb = require(callbackPath);
        }
        // Trace network results
        const tracer = new Tracer(page, cb);
        let pageResult = await tracer.trace();
        pageResult = filterUrls(page, pageResult)
        let audits;
        // Perform audit
        if (pageResult) {
          audits = await performAssetSizeCheck(page, pageResult);
        }
        return { audits, page, pageResult };
      });

      return Promise.all(results)
        .then( results => {
            const failedResources = printSummaryAndGetFailedResources(results, this._config);
            diffReport(results, failedResources);
            return failedResources;
        }).catch( e => {
          error(`Error while handling results`);
          error(e);
        });

    } catch (e) {
      error(`Error while running audits`);
      error(e);
    }
  }
}
