'use strict';

const Tracer = require('../../lib/tracer').Tracer;
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');

describe('Tracer', function() {
  let config, page;
    beforeEach(function() {
      config = {
      };
      page = {
        url: 'http://google.com/',
        port: 1234,
        config
      };
    });

  it.skip('traces the results until the given mark', async function(done) {
    let cb = undefined;
    const tracer = new Tracer(page, cb);
    const pageResult = await tracer.trace();
  });

  it.skip('throws if the page cannot be reached', async function() {
    chai.use(chaiAsPromised);
    let cb = {};
    const tracer = new Tracer(page, cb);
    await expect(tracer.trace()).to.be.rejectedWith("Network Request could not be captured.TypeError: this._cb is not a function");
  });

});