'use strict';

const chai = require('chai');
const expect = chai.expect;
const AuditBudget = require('../../../../lib/audits/asset-size/audit-budget');

describe('AuditBudget', function() {
  let config, page;
  beforeEach(function() {
    config = {
      budgets: [
        {
          path: '/foo',
          resourceSizes: [
            {
              resourceType: 'script',
              budget: 1, // Size is in KB
            },
          ],
        },
      ],
    };
    page = {
      url: 'base/foo',
      relativePath: '/foo',
      config,
    };
  });

  it('reports the resource that went over budget', function() {
    let networkRequests = [
      {
        resourceType: 'script',
        url: '/abc',
        size: 1000,
      },
      {
        resourceType: 'script',
        url: '/bar',
        size: 1000,
      },
    ];

    const auditBudget = new AuditBudget(page, networkRequests);
    const failedAudits = auditBudget.report();

    expect(failedAudits[0].sizeOverBudget).equals(976);
    expect(failedAudits[0].size).equals(2000);
    expect(failedAudits[0].resourceType).equals('script');
  });

  it('handles when request does not contain the resource for which budgeting is defined', function() {
    let networkRequests = [
      {
        resourceType: 'images',
        url: '/abc',
        size: 1000,
      },
    ];
    const auditBudget = new AuditBudget(page, networkRequests);
    expect(function() {
      auditBudget.report();
    }).to.contain(/Warning: Budget result is undefined*/);
  });
});