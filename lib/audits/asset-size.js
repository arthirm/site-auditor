"use strict";

const explore = require("source-map-explorer").default;
const fs = require("fs");
const chalk = require("chalk");
const deepDiff = require("deep-diff");
const mkdirp = require('mkdirp');
const path = require('path');
const SilentError = require("silent-error");

const error = require("../utils").error;
const formatSize = require("../utils.js").formatSize;
const log = console.log;
const readJson = require("../utils.js").readJson;

class LHBudgetReport {
  constructor(url, lhr) {
    this._url = url;
    this._lhr = lhr;
  }

  report() {        
    const auditResults = this._lhr["audits"]["performance-budget"]["details"]["items"];
    if (auditResults === undefined) {
      throw new SilentError("Error: Lighthouse budget result is undefined. Please check if the lighthouse was run successfully");
    }
    this.printReport(auditResults);
    return auditResults.filter(r => r.sizeOverBudget > 0);
  }

  printReport(auditResults) {
    auditResults.forEach(resource => {
      if (resource.sizeOverBudget > 0) {
        let msg = chalk.red(
          `Asset size exceeded budget for '${this._url}' type: '${
            resource.resourceType
          }' by ${formatSize(
            resource.sizeOverBudget
          )}, Current size: ${formatSize(resource.size)}`
        );
        log(msg);
      } else {
        let msg = chalk.green(
          `Asset size check passed for '${this._url}' type: '${resource.resourceType}'`
        );
        log(msg);
      }
    });
  }
}

class AssetSizeManifestGenerator {
  constructor(path, filetype, filesArray, targetDir) {
    // Name of the page to under test
    this._path = path;
    // js/css etc
    this._filetype = filetype;
    // Array of built and minified filepaths which should have corresponding sourcemap files    
    this._filesArray = filesArray;    
    // Basedir for storing manifests
    this._targetDir = targetDir;
    if (!fs.existsSync(targetDir)) {
      mkdirp.sync(targetDir)
    }
  }

  /**
   * This function uses source-map-explorer to determine which file each byte in the minified code
   *  of each file in the fileArray came from.
   * In order for this function to work each file passed in the filesArray should have a corresponding
   *  sourcemap.
   */
   async createObjForRoute() {    
    try {
      const srcmapResults = await explore(this._filesArray, {
        output: { format: "json" }
      });
      return srcmapResults;
    } catch(e) {      
      //TODO: Test this
      if (e.errors) {
        e.errors.forEach(err => error(`Error executing source map explorer for ${this._filesArray}. ${err.message}`))
      } else {
        error(`Error executing source map explorer for '${this._filesArray}'. Make sure the page '${this._path}' was loaded fine. ${e}`)
      }
    }             
  }

  /**
   * Create asset-manifest files
   * @param {*} baseDir basedir to store the amnifest files
   */
  async createAssetManifests() { 
    try {      
      const srcMapResult = await this.createObjForRoute();      
      if (srcMapResult) {
        let routeObj = {};
        routeObj.routeName = this._path;
        routeObj.filetype = this._filetype;      
        routeObj.files = srcMapResult.bundles;
        const manifestPath = path.join(this._targetDir, this._path + "-" + this._filetype + ".json");
        fs.writeFileSync(manifestPath, JSON.stringify(routeObj));
      }       
    } catch(e) {
      console.error(e);
    }
  }
}

class DiffReporter {
  constructor(lhs, rhs, page) {
    this._lhs = lhs || {};
    this._rhs = rhs || {};
    this._page = page;
  }

  /**
   * The function returns the merged files from all bundles.
   * @param {*} bundles
   */
  flattenBundle(bundles) {
    let allFiles = {};
    for (let bkey in bundles) {
      let bundle = bundles[bkey];
      for (let value in bundle) {
        Object.assign(allFiles, bundle[value].files);
      }
    }
    return allFiles;
  }

  groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const val = item[key];
      groups[val] = groups[val] || [];
      groups[val].push(item);
      return groups;
    }, {});
  }

  /**
   * This function diffs 2 asset manifest files and reports the difference
   */
  diffReport() {
    const oldManifest = this.flattenBundle(readJson(this._lhs));
    const currentManifest = this.flattenBundle(readJson(this._rhs));
    const result = deepDiff.diff(oldManifest, currentManifest);
    if (result === undefined) {
      log(`Files (${this._lhs} and ${this._rhs}) are indentical`);
    } else {
      const groupedByEditKind = this.groupBy(result, "kind");
      this.printToConsole(groupedByEditKind);
      return groupedByEditKind;
    } 
  }

  printToConsole(groupedByEditKind) {
    log(chalk.green.bold(`Asset size failure reason for '${this._page}'`));
    for (let kind in groupedByEditKind) {
      if (kind === "N") {
        log(chalk.green.underline("New Files"));
      } else if (kind === "D") {
        log(chalk.green.underline("Deleted Files"));
      } else if (kind === "E") {
        log(chalk.green.underline("Modified Files"));
      }

      groupedByEditKind[kind].forEach(diff => {
        const file = Array.isArray(diff["path"])
          ? diff["path"].join("/")
          : diff["path"];
        let msg = `${chalk.yellow(`File`)}: ${file}`;
        if (kind === "E") {
          msg +=
            `, ${chalk.yellow(`Old Size`)}: ${formatSize(diff.lhs)},` +
            ` ${chalk.yellow(`New Size`)}: ${formatSize(diff.rhs)},` +
            ` ${chalk.yellow(`Change`)}: ${formatSize(diff.rhs - diff.lhs)}`;
        } else if (kind === "N") {
          msg += `, ${chalk.yellow(`Size`)}: ${formatSize(diff.rhs)}`;
        } else if (kind === "D") {
          msg += `, ${chalk.yellow(`Old Size`)}: ${formatSize(diff.lhs)}`;
        }
        log(chalk(msg));
      });
    }
  }
}

/**
   * This function audits and reports perfomance budgets for the configured pages.
   * It generates Assetsize Manifest files which contains which file each byte in the page being rendered came from.
   * 
   * @param {*} page 
   * @param {*} lhr
   */
  function performAssetSizeCheck(page, lhr) {
    const budgetReport = new LHBudgetReport(page.url, lhr);
    const failedAudits = budgetReport.report();
    //AssetSize manifest files should be generated only if sourcemap section is present in config file
    if (page.config.assetManifest) {
      // TODO: Validate the assetManifest section in config
      page.config.assetManifest.includedTypes.forEach(type => {
        const paths = networkRequestToPaths(page.config, lhr);
        let pathName;
          try {
            // Generate asset size manifest files
            pathName = page.relativePath.replace(/\//g, '');
            const currentManifestTargetDir = page.config.assetManifest.targetDir;
            const manifestGenerator = new AssetSizeManifestGenerator(pathName, type, paths, currentManifestTargetDir);
            manifestGenerator.createAssetManifests();
          
            // Report Diff if diffReport section is present in config and the page failed for the current resoucreType
            if (page.config.assetManifest.diffReport && failedAudits.filter(resource => resource.resourceType == type.toLowerCase())) {
              const assetFileName = pathName + '-' + type + '.json';
              const prevManifestTargetDir = page.config.assetManifest.diffReport.oldManifestDir;
              const diffFinder = new DiffReporter(path.join(currentManifestTargetDir, assetFileName), path.join(prevManifestTargetDir, assetFileName), pathName);
              diffFinder.diffReport();
            }

          } catch(e) {
            // TODO: Report proper error
            console.log(e);
          }
        })
     }
  }

  /**
 * The network response from lighthouse will include all network calls for the site. This function filters only the calls
 *  that needs be audited for asset size
 * @param {*} config 
 * @param {*} lhr 
 */
function networkRequestToPaths(config, lhr) {
  const { includedTypes, buildDir, splitUrlPattern } = config.assetManifest;
  const networkRequests = lhr["audits"]["network-requests"]["details"]["items"];
  // The below code, filters the needed requests and replaces the http url with the disk path
  const urlsToAssetify = networkRequests
    .filter(nr => includedTypes.includes(nr["resourceType"]))
    .map(nr => new URL(nr.url).pathname) 
    .filter(path => (path ? path.includes(splitUrlPattern) : false))
    .map(path => path.replace(splitUrlPattern, buildDir));
  return urlsToAssetify;
}

module.exports = {
  LHBudgetReport,
  AssetSizeManifestGenerator,
  DiffReporter,
  performAssetSizeCheck,
  networkRequestToPaths
};