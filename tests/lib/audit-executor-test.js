'use strict';
const networkRequestToPaths = require('../../lib/aseet-size');
const path = require('path')


describe('Audit-Executor', function() {

  it('networkRequestToPaths filters the correct paths', function() {
    const auditResults = {
      audits: { 'network-requests': { details : { items : [{
         url:'https://',
         transferSize: 1784,
         resourceSize: 474,
         mimeType: 'application/vnd.linkedin.normalized+json+2.1',
         resourceType: 'XHR'},
       { 
         url:'https://',
         transferSize: 332,
         resourceSize: 0,
         mimeType: '',
         resourceType: undefined,
        }]}}}};
    
    const config = {
      sourceMap: {
        includedTypes: ['Script'],
        buildDir: path.join(__dirname, '../../fixtures/asset-manifests/foo-1.json'),
        splitUrlPattern: '/sc/voyager' 
     },
    }
    
    const paths = networkRequestToPaths(config, auditResults);

  });
  

})