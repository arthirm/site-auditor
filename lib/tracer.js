"use strict";

const { spawnChrome } = require("chrome-debugging-client");
const chalk = require('chalk');

const TRACE_REQUEST_EVENT_KEY = 'ResourceSendRequest';
const TRACE_RESOURCE_EVENT_KEY = 'ResourceReceiveResponse';
const TRACE_RESOURCE_FINISH_KEY = 'ResourceFinish';

const DEFAULT_TRACE_CATEGORIES = [
  'devtools.timeline',
  'blink.user_timing'
];

class Tracer {
  constructor(page, cb) {
    this._page = page;
    this._networkRequests = [];
    this._traceEvents = [];
    this._cb = cb;
  }

  async trace() {
    let browser, connection;
    let config = this._page.config;
    // userAgent will be used only in mobile
    let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/66.6 Mobile/14A5297c Safari/602.1';

    try {
      const chromeSettings = config.chrome;
      let additionalArguments = ['--hide-scrollbars', '--mute-audio'];
      let headless = true;
      if (chromeSettings !== undefined) {
        if (chromeSettings.headless !== undefined) {
          headless = chromeSettings.headless;
        }
        if( chromeSettings.additionalArguments !== undefined) {
          additionalArguments = additionalArguments.concat(chromeSettings.additionalArguments);
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

      //start tracing
      this.setupTracing(connection);

      await Promise.all([
        page.send('Page.enable'),
        page.send('Network.enable')
      ]);

      // To trace mobile page
      if (chromeSettings && chromeSettings.emulatedFormFactor !== undefined && chromeSettings.emulatedFormFactor.toLowerCase() === 'mobile') {
        await page.send('Network.setUserAgentOverride', { userAgent });
      }

      if (this._cb) {
        console.log(`Configuring page using provided callback for url ${this._page.url}`);
        await this._cb(page);
      }
      console.log(chalk.blue(`About to navigate to url ${this._page.url}`));
      await page.send('Page.navigate', { url: this._page.url });

      await page.until('Page.loadEventFired');

      //stop tracing
      await Promise.all([
        connection.until('Tracing.tracingComplete'),
        connection.send('Tracing.end')
      ]);

      await Promise.all([
        page.send('Page.disable'),
        page.send('Network.disable')
      ]);
      await page.send('Page.close');

      const traceEventsHandler = new TraceEventsHandler(this._traceEvents);
      const requestResponseEvents = traceEventsHandler.filterAndGroupEvents(config.chrome.marker);
      this._networkRequests = this.transformRequestResponseEvents(requestResponseEvents);

    } catch(e) {
      throw new Error('Network Request could not be captured. ' + e);
    } finally {
      if (browser !== undefined) {
        await browser.dispose();
      }
    }
    return this._networkRequests;
  }

  transformRequestResponseEvents(requestResponseEvents) {
    return requestResponseEvents.map(e =>  {
      let resourceType = TraceEventsHandler.fromMimeType(e.mimeType);
      return {
        resourceType,
        url: e.url,
        status: e.statusCode,
        mimeType: e.mimeType,
        size: e.encodedDataLength
      }
    });
  }

  async setupTracing(connection) {
    connection.on('Tracing.dataCollected', ({value}) => {
      this._traceEvents.push(...value);
    });
    await connection.send('Tracing.start', {
       enableSampling: true,
       recordMode: 'recordContinuously',
       traceConfig: {
        includedCategories: DEFAULT_TRACE_CATEGORIES
       }
    });
  }
}

class TraceEventsHandler {
  constructor(traceEvents) {
    this._traceEvents = traceEvents;
  }

  filterAndGroupEvents(rumMarkerName) {
    let requests = [], rumMarkerEvent;
    const responseHeaders = [], responseFinish = [];
    for(let e of this._traceEvents) {
      if(e.cat === 'devtools.timeline') {
        if(e.name === TRACE_REQUEST_EVENT_KEY) {
          requests.push(e);
        } else if(e.name === TRACE_RESOURCE_EVENT_KEY) {
          responseHeaders.push(e.args['data']);
        } else if(e.name === TRACE_RESOURCE_FINISH_KEY) {
          responseFinish.push(e.args['data']);
        }
      } else if(rumMarkerName && e.cat === 'blink.user_timing' && e.name === rumMarkerName) {
        rumMarkerEvent = e;
      }
    }
    requests = this._filterRequestsTillRumMarker(requests, rumMarkerEvent);
    return this._groupByRequestId(requests, responseHeaders, responseFinish);
  }

  _groupByRequestId(requests, responseHeaders, responseFinish) {
    return requests.map(e => {
      return Object.assign({}, e, responseHeaders.find(rh => rh.requestId === e.requestId),
        responseFinish.find(rh =>  rh.requestId === e.requestId));
    });
  }

  _filterRequestsTillRumMarker(requests, rumMarkerEvent) {
    const rumMarkerTs = rumMarkerEvent ? rumMarkerEvent.ts : undefined;
    // If rum marker is present, filter by marker-event-timestamp else just pass along
    if(rumMarkerTs) {
      requests = requests.filter(e => e.ts <= rumMarkerTs);
    }
    return requests.map(e => e.args['data']);
  }

   /**
    * Mapping mimeType to corresponding resourceType
    * @param {*} mimeType
    */
   static fromMimeType(mimeType) {
     if (!mimeType) {
      return null;
     }
    if (mimeType.startsWith('text/html')) {
      return 'document';
    } else if (mimeType.startsWith('text/css')) {
      return 'dtylesheet';
    } else if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.includes('font')) {
      return 'font';
    } else if (mimeType.startsWith('text/javascript') || mimeType.includes('application/javascript') || mimeType.includes('script')) {
      return 'script';
    }
    return 'other';
  }
}

module.exports = { Tracer };