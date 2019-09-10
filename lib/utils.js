"use strict";

const fs = require("fs");
const chalk = require("chalk");
const SilentError = require("silent-error");

/**
 * This Class validates the config file passed to this lib
 */
class ConfigUtils {
  static loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new SilentError(`Error: Config file not present in ${configPath}`);
    }
    return require(configPath);
  }

  static validate(config) {
    const { debugPort, baseUrl, budgets } = config;
    let msg;
    if (!debugPort) msg = "Error: debugPort not configured in config file.";
    if (!baseUrl) msg = "Error: baseUrl not configured in config file.";
    if (!budgets) msg = "Error: budgets not configured in config file.";
    if (msg) {
      throw new SilentError(msg);
    }
  }
}

function readJson(filePath) {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function formatSize(sizeInBytes) {
  return (sizeInBytes / 1024).toFixed(2) + " KB";
}

function error(message) {
  console.error(chalk.red(message));
}

module.exports = {
  ConfigUtils,
  readJson,
  formatSize,
  error  
};
