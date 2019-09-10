"use strict";

const ConfigUtils = require('../../lib/utils').ConfigUtils;
const fs = require('fs');
const tmp = require('tmp');

describe('Config Utils', function() {

  it('loads config', function() {
    let contents = `module.exports = ${JSON.stringify(config)};`;
    fs.outputFileSync(path.join(dir, 'config/bundlesize.js'), contents);
    
    ConfigUtils.loadConfig(configPath);
  });

  it('throws if configFile not present', function() {

  });

  it('throws if config not valid', function() {

  });
})