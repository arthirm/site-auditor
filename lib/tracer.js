"use strict";

const { spawnChrome } = require("chrome-debugging-client");
const chalk = require('chalk');

class Tracer {
  constructor(page, cb) {
    this._page = page;
    this._networkRequests = [];
    this._cb = cb;
  }

  async trace() {
    let browser, connection;
    let config = this._page.config;
    // userAgent will be used only in mobile
    let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/66.6 Mobile/14A5297c Safari/602.1';

    try {
      const chromeSettings = config.chrome;
      let additionalArguments = ['--ignore-certificate-errors', '--hide-scrollbars', '--mute-audio'];
      let headless = true;
      if (chromeSettings !== undefined) {
        if (chromeSettings.headless !== undefined) {
          headless = chromeSettings.headless;
        }
        if( chromeSettings.additionalArguments !== undefined) {
          additionalArguments.concat(chromeSettings.additionalArguments);
        }
        if (chromeSettings.userAgent !== undefined) {
          userAgent = chromeSettings.userAgent;
        }
      }
      browser = spawnChrome({
        headless,
        additionalArguments
      });
      connection = browser.connection;
      const { targetId } = await connection.send('Target.createTarget', {
        url: "about:blank",
      });

      const page = await connection.attachToTarget(targetId);

      // To trace mobile page
      if (chromeSettings && chromeSettings.emulatedFormFactor !== undefined && chromeSettings.emulatedFormFactor.toLowerCase() === 'mobile') {
        await page.send('Network.setUserAgentOverride', { userAgent });
      }

      page.on('Network.responseReceived', (params) => {
        this._networkRequests.push({
        timestamp: params.timestamp,
        resourceType: params.type,
        url: params.response.url,
        status: params.response.status,
        mimeType: params.response.mimeType,
        size: params.response.headers['content-length'] !== undefined ? params.response.headers['content-length'] : params.response.encodedDataLength
        });
      });

      await Promise.all([
        page.send('Page.enable'),
        page.send('Network.enable'),
        page.send('Runtime.enable')
      ]);

      await page.send('Network.clearBrowserCache');

      if (this._cb) {
        console.log(`Configuring page using provided callback for url ${this._page.url}`);
        await this._cb(page);
      }
      console.log(chalk.blue(`About to navigate to url ${this._page.url}`));

      await this._createRUMPromise(page, config.chrome.marker);
      await page.send('Page.navigate', { url: this._page.url });
      const evalPromise = page.send('Runtime.evaluate', {expression: `__RUMMarkerPromise`, awaitPromise: true});

      let timeoutId;
      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject('Promise timed out after waiting for 30s');
        }, 30000);
      });
      await Promise.race([
        evalPromise,
        timeout
      ]).then(() => {
        if(timeoutId) {
          clearTimeout(timeoutId);
        }
      });

      await Promise.all([
        page.send('Network.disable'),
        page.send('Runtime.disable')
      ]);
      await page.send('Page.close');
    } catch(e) {
      throw new Error('Network Request could not be captured. ' + e);
    } finally {
      if (browser !== undefined) {
        await browser.dispose();
      }
    }
    return this._networkRequests;
  }

  async _createRUMPromise(page, marker) {
    console.log(`Registering RUM marker: ${marker} to the page`);
    return page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        self.__RUMMarkerPromise = new Promise(resolve => {
          const observer = new PerformanceObserver(function(list) {
            if (list.getEntriesByName('${marker}').length > 0) {
              resolve();
            }
        });
        observer.observe({ entryTypes: ["mark"] });
        });`
      });
  }
}

module.exports = { Tracer };