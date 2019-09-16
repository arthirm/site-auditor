"use strict";

const chalk = require("chalk");
const lighthouse = require("lighthouse");
const path = require("path");
const puppeteer = require("puppeteer");
const SilentError = require("silent-error");
const error = console.error;
const log = console.log;

/**
 * This class is responsible for lauching puppeteer and lighthouse.
 * Puppeteer is used for logging in to a page (incase the page to audit is behind authentication)
 * and passes on the port to lighthouse so the lighthouse can aduit the logged in page
 */
class Launcher {
  constructor(url, port, config) {
    this._url = url;
    this._port = port;
    this._config = config;
  }

  async launch() {
    let result;
    // The pageConfig points to a script which can login to a site and set cookies or
    // anything that needs to be done to set up a page before auditing
    if (this._config.puppeteer) {
      if (!path.isAbsolute(this._config.puppeteer.pageConfig)) {
        throw new SilentError(
          `Error: Please provide absolute path for ${this._config.puppeteer.pageConfig}`
        );
      }
      result = await this._launchPuppeteerAndRunLighthouse();
    } else {
      result = await this._runLighthouse();
    }
    return result;
  }

  /**
   * This function launches puppeteer, invokes pageConfig script and launches lighthouse
   */
  async _launchPuppeteerAndRunLighthouse() {
    // TODO: Explore more browser options
    const browser = await puppeteer.launch({
      headless: this._config.puppeteer.headless,
      //todo: move this to config
      args: [`--remote-debugging-port=${this._port}`, `--ignore-certificate-errors`],
      ignoreHTTPSErrors: true
    });
    const pages = await browser.pages();
    const page = pages[0];

    const pageConfigure = require(this._config.puppeteer.pageConfig);
    await pageConfigure(page);
    try {
      const lhr = await this._runLighthouse();
      return lhr;
    } catch (e) {
      error(e);
    } finally {
      await browser.close();
    }
    return [];
  }

  /**
   * This function launches the lighthouse, run audits and returns the results
   */
  async _runLighthouse() {
    const options = { port: this._port, ...this._config.lighthouse };
    const elements = await lighthouse(this._url, options, {
      extends: "lighthouse:default",
      settings: {
        budgets: this._config.budgets
      }
    })
      .then(results => {
        //TODO: Log in file
        //log(chalk.blue(`Completed executing lighthouse for ${this._url}`));
        return results.lhr;
      })
      .catch(e => {
        throw new SilentError(`Error: Could not run lighthouse. Try making  puppeteer : { headless to false } in config to debug locally. ${e}`);
      });
    return elements;
  }
}

module.exports = { Launcher };
