const { spawnChrome } = require("chrome-debugging-client");
const chalk = require('chalk');

const timeout = new Promise((resolve, reject) => {
  let id = setTimeout(() => {
    clearTimeout(id);
    reject('Promise timed out after waiting for 30s');
  }, 30000)
});

class Tracer {
  constructor(page, cb) {
    this._page = page;
    this._networkRequests = [];
    this._cb = cb;
  }

  async trace() {
    let browser, connection;
    try {
      const chromeSettings = this._page.config.chrome;
      let headless = false;
      if (chromeSettings !== undefined && chromeSettings.headless !== undefined) {
        headless = chromeSettings.headless;
      }
      let additionalArguments = ['--ignore-certificate-errors', '--hide-scrollbars', '--mute-audio'];
      if (chromeSettings !== undefined && chromeSettings.additionalArguments !== undefined) {
        additionalArguments.concat(chromeSettings.additionalArguments);
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

      await this._createRUMPromise(page);
      await page.send('Page.navigate', { url: this._page.url });
      const expression = `__RUMMarkerPromise`;
      const evalPromise = page.send('Runtime.evaluate', {expression: expression, awaitPromise: true});
      await Promise.race([
        evalPromise,
        timeout
      ]);

      await Promise.all([
        page.send('Network.disable'),
        page.send('Runtime.disable')
      ]);
      await page.send('Page.close');
    } catch(e) {
      throw new Error('Network Request could not be captured.' + e);
    } finally {
      if (browser !== undefined) {
        await browser.dispose();
      }
    }
    return this._networkRequests;
  }

  async _createRUMPromise(page) {
    return page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
            self.__RUMMarkerPromise = new Promise(resolve => {
                const observer = new PerformanceObserver(function(list) {
                    if (list.getEntriesByName('mark_lazy_render_end').length > 0) {
                        resolve();
                    }
                });
                observer.observe({ entryTypes: ["mark"] });
            });
        `
      });
  }
}

module.exports = { Tracer };