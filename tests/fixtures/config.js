module.exports = {    
   baseUrl: 'https://qprod.www.linkedin-ei.com',
   debugPort: 9222,
   workerPoolSize: 5,
   puppeteer: {
     pageConfig: '/Users/aravisha/Downloads/site-audit/default-puppeteer.js',
   },
   lighthouse: {
     emulatedFormFactor: 'desktop', 
     onlyCategories: ['performance']
   },
   sourceMap: {
      includedTypes: ['Script'],
      buildDir: '/Users/aravisha/asset_size/voyager-web_trunk/dist/extended',
      splitUrlPattern: '/sc/voyager' 
   },      
   budgets: [ 
       {
           "path": "/notifications/",
           "resourceSizes": [
               {
                   "resourceType": "script",
                   "budget": 300
               },
               {
                   "resourceType": "stylesheet",
                   "budget": 300
               }
           ]
       }
 ]
 }