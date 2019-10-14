"use strict";

const path = require('path');
const performAssetSizeCheck = require("./audits/asset-size").performAssetSizeCheck;
const Tracer = require("./tracer").Tracer;
const { ConfigUtils, error } = require("./utils");

/**
 * This class is responsible for invoking the tracer and audit for each page
 */
class Runner {
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
        config: this._config
      };
    });
    try {
      console.log("********************************************************************");
      console.log("*                                                                  *");
      console.log("*                         Asset Size Audit                         *");
      console.log("*                                                                  *");
      console.log("********************************************************************");
      const results = pages.map(async page => {
        let cb;
        // Application setup can be done here
        if (page.config.pageConfig) {
          const callbackPath = page.config.pageConfig;
          cb = require(callbackPath);
        }
        // Trace network results
        const tracer = new Tracer(page, cb);
        const pageResult = await tracer.trace();
        // Perform audit
        if (pageResult) {
          performAssetSizeCheck(page, pageResult);
        }
        return pageResult;
      });
      return Promise.all(results);
    } catch (e) {
      error(`Error while running audits`);
      error(e);
    }
  }
}

module.exports = Runner;