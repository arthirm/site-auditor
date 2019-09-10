"use strict";

const path = require('path');
const workerpool = require("workerpool");
const { ConfigUtils, error, } = require("./utils");
const { performAssetSizeCheck } = require("./audits/asset-size") 

/**
 * This class is responsible for kicking off a node process for each page to audit using lighthouse
 */
class Runner {
  constructor(configPath) {
    this._config = ConfigUtils.loadConfig(path.resolve(configPath));
    ConfigUtils.validate(this._config);

    const options = {
      minWorkers: this._config.workerPoolSize | "max",
      workerType: "process"
    };
    this._pool = workerpool.pool(__dirname + "/audit-executor.js", options);  
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
      // Multiple pages will be audited in parallel using lighthouse and a node process will be started
      // for each page to sandbox the environment
      const results = pages.map( async page => {
        const pageResult = await this._pool.exec("execute", [page]); 
        performAssetSizeCheck(page, pageResult);         
        return pageResult;
      });
      return Promise.all(results).finally(() => this._pool.terminate());
    } catch (e) {
      error(`Error while running audits`);
      error(e);
    }
  }
}

module.exports = Runner;