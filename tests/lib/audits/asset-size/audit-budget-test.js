'use strict';

const chai = require('chai');
const expect = chai.expect;
const { AuditBudget, printAuditSummaryAndGetFailedResources } = require('../../../../lib/audits/asset-size/audit-budget');

describe('AuditBudget', function() {
  let config, page;
  beforeEach(function() {
    config = {
      budgets: [
        {
          path: '/foo',
          name: 'foo',
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
    const failedAudits = auditBudget.audit();

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
      auditBudget.audit();
    }).to.contain(/Warning: Budget result is undefined*/);
  });

  it('printAuditSummaryAndGetFailedResources returns failed audits', function() {
    const auditResults = [{
      page: {
        url:'base/foo',
        relativePath: '/foo',
      },
      audits: [ {
        size: 11000, // Bytes
        sizeOverBudget: 740, // Bytes
        budget: 10, // KB
        resourceType: 'script'
      }]
    }];

    const failedResources = printAuditSummaryAndGetFailedResources(auditResults, config);
    expect(failedResources[0]).equals(auditResults[0].audits[0]);
  });

  it('printAuditSummaryAndGetFailedResources does not return failed audits if there is none', function() {
    const auditResults = [{
      page: {
        url:'base/foo',
        relativePath: '/foo',
      },
      audits: [ {
        size: 700, // Bytes
        sizeOverBudget: -40, // Bytes
        budget: 740, // KB
        resourceType: 'script'
      }]
    }];

    const failedResources = printAuditSummaryAndGetFailedResources(auditResults, config);
    expect(failedResources).to.deep.equal([]);
  });

});