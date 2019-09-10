'use strict';
const Runner = require('../../lib/runner');

describe('Runner', function() {

  it('runs the audits', async() => {
    const runner = new Runner('./tests/fixtures/config.js');
    const results = await runner.run();
  });

})