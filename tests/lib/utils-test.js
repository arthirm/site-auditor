'use strict';

const { ConfigUtils } = require('../../lib/utils');
const chai = require('chai');
const expect = chai.expect;
const path = require('path');

describe('Utils', function() {
  describe('ConfigUtils', function() {
    it('loads config', function() {
      const configPath = path.join(__dirname, '../fixtures/config.js');
      let config = ConfigUtils.loadConfig(configPath);
      let expectedConfig = require(configPath);
      expect(config).to.deep.equal(expectedConfig);
    });

    it('throws if configFile not present', function() {
      const configPath = path.join(
        __dirname,
        '../../fixtures/assets/config1.js'
      );
      expect(function() {
        ConfigUtils.loadConfig(configPath);
      }).to.throw(/Config file not present*/);
    });

    it('throws if config is not defined properly', function() {
      let config = {};
      expect(function() {
        ConfigUtils.validate(config);
      }).to.throw(/'debugPort' not configured in config file.*/);
    });

    it('throws if both printAuditSummary and diffReport is not defined in config', function() {
      let config = {
        debugPort: 9222,
        baseUrl: '/url',
        budgets: {},
        includeUrlPattern: '/url',
      };
      expect(function() {
        ConfigUtils.validate(config);
      }).to.throw(/Either printAuditSummary or diffReport should be configured to view the results*/);
    });

  });
});
