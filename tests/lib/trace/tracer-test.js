'use strict';

const Tracer = require('../../../lib/trace/tracer');
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const StaticServer = require('../utils/http-server').StaticServer;

describe('Tracer', function() {
  let server;
  let config, page;
  this.timeout(20000);
  beforeEach(function() {
    config = {};
    page = {
      url: 'http://localhost:3006/index.html',
      config,
    };
    server = new StaticServer();
    //Start the static http server
    server.start();
  });

  afterEach(function() {
    server.stop();
  });

  it('traces the results until the given mark', async function() {
    page.config.chrome = {
      marker: 'mark_end',
      headless: true,
    };
    const tracer = new Tracer(page);
    const pageResult = await tracer.trace();
    // Page result does not include 'afterrum.js' since it loads after the rum marker is triggered
    expect(pageResult.length).equals(2);
    expect(pageResult[0].url).equals('http://localhost:3006/index.html');
    expect(pageResult[1].url).equals('http://localhost:3006/js/index.js');
  });

  it('throws if the page cannot be reached', async function() {
    chai.use(chaiAsPromised);
    let cb = {};
    const tracer = new Tracer(page, cb);
    await expect(tracer.trace()).to.be.rejectedWith(
      'Network Request could not be captured. TypeError: this._cb is not a function'
    );
  });
});
