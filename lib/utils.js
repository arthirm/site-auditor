'use strict';

const fs = require('fs');
const chalk = require('chalk');

/**
 * This Class validates the config file passed to this lib
 */
class ConfigUtils {
  static loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not present in ${configPath}`);
    }
    return require(configPath);
  }

  static validate(config) {
    const { debugPort, baseUrl, budgets, chrome, includeUrlPattern } = config;
    let msg = '';

    if (!debugPort) msg = "'debugPort' not configured in config file. ";
    if (!baseUrl) msg += "'baseUrl' not configured in config file. ";
    if (!budgets) msg += "'budgets' not configured in config file.";
    if (!includeUrlPattern)
      msg += "'includeUrlPattern' is not defined in config file. ";

    if (config.assetManifest) {
      const { includedTypes, buildDir } = config.assetManifest;
      if (!buildDir)
        msg += "'buildDir' is not defined in config.assetManifest. ";
      if (!includedTypes)
        msg +=
          "'includedTypes' which is needed to run source-map-explorer is not defined in config.assetManifest. ";

      if (config.assetManifest.diffReport) {
        const baseManifestDir = config.assetManifest.diffReport.baseManifestDir;
        if (!baseManifestDir)
          msg +=
            "'baseManifestDir' is not defined in config.assetManifest.diffReport to do the comparison. ";
      }
    }
    if (msg) {
      msg +=
        ' Please refer to https://github.com/arthirm/site-auditor/blob/master/README.md for configuring';
      throw new Error(chalk.red(msg));
    }
  }
}

function readJson(filePath) {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function formatSize(sizeInBytes) {
  return (sizeInBytes / 1024).toFixed(2) + ' KB';
}

function error(message) {
  console.error(chalk.red(message));
}

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const val = item[key];
    groups[val] = groups[val] || [];
    groups[val].push(item);
    return groups;
  }, {});
}

module.exports = {
  ConfigUtils,
  groupBy,
  readJson,
  formatSize,
  error,
};
