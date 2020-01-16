'use strict';

const chai = require('chai');
const expect = chai.expect;
const { filterUrls } = require('../../../../lib/audits/asset-size');

describe('AssetSize', function() {
  let config, page;
  beforeEach(function() {
    config = {
      includeUrlPattern: '/abc',
      excludeUrlPattern: '/bar',
    };
    page = {
      url: 'base/foo',
      relativePath: '/foo',
      config,
    };
  });

  it('filterUrls includes/excludes the configured urls', function() {
    let pageResult = [
      { url: '/abc/sda' },
      { url: '/abc/bar' },
      { url: '/abc/car' },
      { url: '/car' }
    ];

    const expectUrls = [ { url: '/abc/sda' }, { url: '/abc/car' } ];
    const result = filterUrls(page, pageResult);
    expect(result).to.deep.equal(expectUrls);
  });

});
