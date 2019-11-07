'use strict';

const TRACE_REQUEST_EVENT_KEY = 'ResourceSendRequest';
const TRACE_RESOURCE_EVENT_KEY = 'ResourceReceiveResponse';
const TRACE_RESOURCE_FINISH_KEY = 'ResourceFinish';

/**
 * This class helps in filtering the requests until the given rum marker or loadEventFired.
 */
module.exports = class TraceEventsHandler {
  constructor(traceEvents) {
    this._traceEvents = traceEvents;
  }

  /**
   * From the tracing events, this function gets ResourceSendRequest, ResourceReceiveResponse and ResourceFinish from 'devtools.timeline' category
   * Gets rumMarker event from 'blink.user_timing' category
   * Filters the requests that happened before rum marker event
   * and returns the grouped object.
   * @param {*} rumMarkerName
   */
  filterAndGroupEvents(rumMarkerName, url) {
    let requests = [],
      rumMarkerEvent;
    const responseHeaders = [],
      responseFinish = [];
    for (let e of this._traceEvents) {
      if (e.cat === 'devtools.timeline') {
        if (e.name === TRACE_REQUEST_EVENT_KEY) {
          requests.push(e);
        } else if (e.name === TRACE_RESOURCE_EVENT_KEY) {
          responseHeaders.push(e.args['data']);
        } else if (e.name === TRACE_RESOURCE_FINISH_KEY) {
          responseFinish.push(e.args['data']);
        }
      } else if (
        rumMarkerName &&
        e.cat === 'blink.user_timing' &&
        e.name === rumMarkerName
      ) {
        rumMarkerEvent = e;
      }
    }
    requests = this._filterRequestsTillRumMarker(requests, rumMarkerEvent, url);
    return this._groupByRequestId(requests, responseHeaders, responseFinish);
  }

  /**
   * Since each tracing event has a different kind of information like requests contain url, reosurceFinish has size etc
   * The 'requests', 'responseHeaders' and 'responseFinish' are grouped by requestId
   * @param {*} requests contains url
   * @param {*} responseHeaders contains mimeType, statusCode
   * @param {*} responseFinish contains the resource size (encodedDataLength)
   */
  _groupByRequestId(requests, responseHeaders, responseFinish) {
    return requests.map(e => {
      return Object.assign(
        {},
        e,
        responseHeaders.find(rh => rh.requestId === e.requestId),
        responseFinish.find(rh => rh.requestId === e.requestId)
      );
    });
  }

  /**
   * If a rum marker is configured, filter the requests until the rum marker timestamp,
   * If not return all the requests.
   * @param {*} requests
   * @param {*} rumMarkerEvent
   */
  _filterRequestsTillRumMarker(requests, rumMarkerEvent, url) {
    const rumMarkerTs = rumMarkerEvent ? rumMarkerEvent.ts : undefined;
    if (rumMarkerTs) {
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
      return 'stylesheet';
    } else if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.includes('font')) {
      return 'font';
    } else if (
      mimeType.startsWith('text/javascript') ||
      mimeType.includes('application/javascript') ||
      mimeType.includes('script')
    ) {
      return 'script';
    }
    return 'other';
  }
}