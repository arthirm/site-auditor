'use strict';

const { spawnChrome } = require('chrome-debugging-client');

const TraceEventsHandler = require('./trace-events-handler');

// userAgent will be used only in mobile
let userAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/66.6 Mobile/14A5297c Safari/602.1';

const DEFAULT_TRACE_CATEGORIES = ['devtools.timeline', 'blink.user_timing'];

// Default trace time out is 600000 ms or 600 secs
const TRACE_TIMEOUT = 600000;

/**
 * This class traces the network for a given page until a configured rum marker.
 * If rum marker is not configured it traces until 'loadEventFired'
 * It allows application specific configurations like cookies to be set using callback.
 */
module.exports = class Tracer {
  constructor(page, cb) {
    this._page = page;
    this._networkRequests = [];
    this._traceEvents = [];
    this._cb = cb;
  }

  async trace() {
    let browser, connection;
    let config = this._page.config;

    try {
      const chromeSettings = config.chrome;
      let additionalArguments = ['--hide-scrollbars', '--mute-audio'];
      let headless = true;
      if (chromeSettings !== undefined) {
        if (chromeSettings.headless !== undefined) {
          headless = chromeSettings.headless;
        }
        if (chromeSettings.additionalArguments !== undefined) {
          additionalArguments = additionalArguments.concat(
            chromeSettings.additionalArguments
          );
        }
        if (chromeSettings.userAgent !== undefined) {
          userAgent = chromeSettings.userAgent;
        }
      }
      browser = spawnChrome({
        headless,
        additionalArguments,
      });
      connection = browser.connection;
      const { targetId } = await connection.send('Target.createTarget', {
        url: 'about:blank',
      });

      const page = await connection.attachToTarget(targetId);

      //start tracing
      this.setupTracing(connection);

      await Promise.all([
        page.send('Page.enable'),
        page.send('Network.enable'),
        page.send('Runtime.enable')
      ]);

      // To trace mobile page
      if (
        chromeSettings &&
        chromeSettings.emulatedFormFactor !== undefined &&
        chromeSettings.emulatedFormFactor.toLowerCase() === 'mobile'
      ) {
        await page.send('Network.setUserAgentOverride', { userAgent });
      }

      // callback to perform application specific configuration like setting application cookies
      if (this._cb) {
        await this._cb(page);
      }
      if (config.chrome.marker) {
        await this._createRUMPromise(page, config.chrome.marker);
      }

      await page.send('Page.navigate', { url: this._page.url });

      // Wait for rumMarker event or loadEventFired
      const eventPromise = this._waitFor(page, config.chrome.marker);

      let timeoutId;

      const timeoutValue = config.chrome.traceTimeout ? config.chrome.traceTimeout : TRACE_TIMEOUT;

      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(`Promise timed out after waiting for ${timeoutValue} ms `);
        }, timeoutValue);
      });

      // Timeout if either rumMarker or loadEventFired does not happen in configured timeout ms
      await Promise.race([
        eventPromise,
        timeout
      ]).then(() => {
        if(timeoutId) {
          clearTimeout(timeoutId);
        }
      });

      //stop tracing
      await Promise.all([
        connection.until('Tracing.tracingComplete'),
        connection.send('Tracing.end'),
      ]);

      await Promise.all([
        page.send('Page.disable'),
        page.send('Network.disable'),
        page.send('Runtime.disable')
      ]);
      await page.send('Page.close');

      const traceEventsHandler = new TraceEventsHandler(this._traceEvents);
      const requestResponseEvents = traceEventsHandler.filterAndGroupEvents(
        config.chrome.marker, this._page.url
      );
      this._networkRequests = this.transformRequestResponseEvents(
        requestResponseEvents
      );
    } catch (e) {
      throw new Error('Network Request could not be captured. ' + e);
    } finally {
      if (browser !== undefined) {
        await browser.dispose();
      }
    }
    if (this._networkRequests[0].url.includes('chrome-error')) {
      throw new Error(`Network Request could not be captured for ${this._page.url}. Make sure the site is reachable`);
    }
    return this._networkRequests;
  }

  async _createRUMPromise(page, marker) {
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

  /**
   * If Rum marker is configured wait until the rum marker event is fired. Else wait until loadEvent is fired.
   * @param {*} page
   * @param {*} marker
   */
  async _waitFor(page, marker) {
    let eventPromise;
    if (marker) {
      eventPromise = await page.send('Runtime.evaluate', {expression: `__RUMMarkerPromise`, awaitPromise: true});
    } else {
      eventPromise = await page.until('Page.loadEventFired');
    }
    return eventPromise;
  }

  /**
   * Create an object with the needed information from the tracing events
   * @param {*} requestResponseEvents
   */
  transformRequestResponseEvents(requestResponseEvents) {
    return requestResponseEvents.map(e => {
      let resourceType = TraceEventsHandler.fromMimeType(e.mimeType);
      return {
        resourceType,
        url: e.url,
        status: e.statusCode,
        mimeType: e.mimeType,
        size: e.encodedDataLength,
      };
    });
  }

  async setupTracing(connection) {
    connection.on('Tracing.dataCollected', ({ value }) => {
      this._traceEvents.push(...value);
    });
    await connection.send('Tracing.start', {
      enableSampling: true,
      recordMode: 'recordContinuously',
      traceConfig: {
        includedCategories: DEFAULT_TRACE_CATEGORIES,
      },
    });
  }
}