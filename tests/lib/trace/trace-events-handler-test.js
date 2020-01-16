'use strict';

const TraceEventsHandler = require('../../../lib/trace/trace-events-handler');
const chai = require('chai');
const expect = chai.expect;

describe('TraceEventsHandler', function() {

  it('_filterRequestsTillRumMarker does not include requests that are returned after the rumMarker is triggered', async function() {
   
    const requests = [
      { args: { data: [{ url: 'http://localhost:3006/index.html' }] }, ts: 2 },
      { args: { data: [{ url: 'http://localhost:3006/js/index.js' }] }, ts: 3 },
      { args: { data: [{ url: 'http://localhost:3006/js/afterrum.js' }] }, ts: 12 } ];

    const rumMarkerEvent = {
      name: 'mark_end',
      ts: 5
    };

    const url = 'http://localhost:3006/index.html';

    const expectedResult = [ [ { url: 'http://localhost:3006/index.html' } ],
    [ { url: 'http://localhost:3006/js/index.js' } ] ];

    const traceEventsHandler = new TraceEventsHandler();
    const result = traceEventsHandler._filterRequestsTillRumMarker(requests, rumMarkerEvent, url);
    expect(result).to.deep.equal(expectedResult);

  });

  it('_groupByRequestId groups details from different responses by requestId', async function() {

    const requests = [ { requestId: '1', url: '/index.html' }, { requestId: '2', url: '/index.js' }];
    const responseHeaders = [{
      mimeType: 'text/html',
      requestId: '1',
      statusCode: 200,
      }, {
        mimeType: 'application/javascript',
        requestId: '2',
        statusCode: 200,
      }];

    const responseFinish = [ { 
      encodedDataLength: 455,
      requestId: '1'
      }, {
      encodedDataLength: 531,
      requestId: '2' }];

    const expectedResult = [ { requestId: '1',
      url: '/index.html',
      mimeType: 'text/html',
      statusCode: 200,
      encodedDataLength: 455 },
    { requestId: '2',
      url: '/index.js',
      mimeType: 'application/javascript',
      statusCode: 200,
      encodedDataLength: 531 } ];

    const traceEventsHandler = new TraceEventsHandler();
    const result = traceEventsHandler._groupByRequestId(requests, responseHeaders, responseFinish);
    expect(result).to.deep.equal(expectedResult);

  });

  it('filterAndGroupEvents', async function() {

    const traceEvents = [
      { args: { data: { requestId: '4', url: '/another.html' }  },
        cat: 'devtools.timeline',
        name: 'ResourceWillSendRequest',
        ts: 2 },

      { args: { data: { requestId: '1', url: '/index.html' }  },
        cat: 'devtools.timeline',
        name: 'ResourceSendRequest',
        ts: 2
      },
      { args: { data: { requestId: '1', mimeType: 'text/html', statusCode: 200 } },
        cat: 'devtools.timeline',
        name: 'ResourceReceiveResponse',
        ts: 3
      },
      { args: { data: { requestId: '1', encodedDataLength: 455 } },
        cat: 'devtools.timeline',
        name: 'ResourceFinish',
        ts: 1
      },
      { args: { data: { requestId: '2', url: '/index.js' } },
        cat: 'devtools.timeline',
        name: 'ResourceSendRequest',
        ts: 2
      },
      { args: { data: { requestId: '2', mimeType: 'text/javascript', statusCode: 200 } },
        cat: 'devtools.timeline',
        name: 'ResourceReceiveResponse',
        ts: 4
      },
      { args: { data: { requestId: '2', encodedDataLength: 555 } },
        cat: 'devtools.timeline',
        name: 'ResourceFinish',
        ts: 3
      },
      { args: { data: { requestId: '5' } },
        cat: 'blink.user_timing',
        name: 'rum_marker',
        ts: 5
      },
      { args: { data: { requestId: '4', url: '/abc.html' } },
        cat: 'devtools.timeline',
        name: 'ResourceSendRequest',
        ts: 4
      },
      { args: { data: { requestId: '3', url: '/afterRum.js' } },
        cat: 'devtools.timeline',
        name: 'ResourceSendRequest',
        ts: 8
      } ];

    const rumMarkerName = 'rum_marker';
    const url = 'http://localhost:3006/index.html';

    const traceEventsHandler = new TraceEventsHandler(traceEvents);
    const requestResponseEvents = traceEventsHandler.filterAndGroupEvents(rumMarkerName, url);

    const expectedResult = [ { requestId: '1',
      url: '/index.html',
      mimeType: 'text/html',
      statusCode: 200,
      encodedDataLength: 455 },
    { requestId: '2',
      url: '/index.js',
      mimeType: 'text/javascript',
      statusCode: 200,
      encodedDataLength: 555 },
    { requestId: '4', url: '/abc.html' } ];

    expect(requestResponseEvents).to.deep.equal(expectedResult);
  });

  it('fromMimeType returns the correct mimetype based on the resource type', async function() {
    expect('script').to.equal(TraceEventsHandler.fromMimeType('text/javascript'));
    expect('stylesheet').to.equal(TraceEventsHandler.fromMimeType('text/css'));
    expect('other').to.equal(TraceEventsHandler.fromMimeType('others'));
  });

});