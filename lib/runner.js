'use strict';

const path = require('path');
const { ConfigUtils, error } = require('./utils');
const { filterUrls, assetSizeReport, collectAssetSizeAuditSummaryFor } = require('./audits/asset-size');
const Tracer = require('./trace/tracer');


/**
 * This class is responsible for invoking the tracer and audit for each page
 */
module.exports = class Runner {
  constructor(configPath, manifest, diff, configObj) {
    if (configObj !== undefined) {
      this._config = configObj
    } else {
      this._config = ConfigUtils.loadConfig(path.resolve(configPath));
    }
    ConfigUtils.validate(this._config);
    this._options = {
      manifest : manifest !== undefined ? manifest : true,
      diff : diff !== undefined ? diff : true
    }
  }

  async run() {
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
      let results = pages.map(async page => {
        let cb;
        // Application setup can be done here
        if (page.config.pageConfig) {
          const callbackPath = page.config.pageConfig;
          cb = require(callbackPath);
        }
        // Trace network results
        const tracer = new Tracer(page, cb);
        let pageResult = await tracer.trace();
        pageResult = filterUrls(page, pageResult);
        let audits;
        // Perform audit and collect audit summary
        if (pageResult) {
          audits = await collectAssetSizeAuditSummaryFor(page, pageResult);
        }
        return { audits, page, pageResult };
      });

      const res = await Promise.all(results);
      const failedResources = assetSizeReport(this._options, res, this._config);
      return failedResources;

    } catch (e) {
      error(`Error while running audits`);
      error(e);
    }
  }
}