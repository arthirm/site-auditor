"use strict";

const explore = require("source-map-explorer").default;
const fs = require("fs");
const chalk = require("chalk");
const deepDiff = require("deep-diff");
const logSymbols = require('log-symbols');
const mkdirp = require('mkdirp');
const path = require('path');
const SilentError = require("silent-error");
const Table = require('cli-table3');

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
    let auditResults;
    try {
      auditResults = this._lhr["audits"]["performance-budget"]["details"]["items"];
      if (auditResults === undefined) {
        throw new SilentError(`Error: Lighthouse budget result is empty. Please check if the lighthouse was run successfully.
         Turn Chrome Headless to false in config to debug locally`);
      }
    } catch(error) {
      throw new SilentError(`Error: Lighthouse budget result is undefined. Please check if the lighthouse was run successfully.
      Turn Chrome Headless to false in config to debug locally`);
    }
    this.printReport(auditResults);
    return auditResults.filter(r => r.sizeOverBudget > 0);
  }

  printReport(auditResults) {
    auditResults.forEach(resource => {
      let parts = this._url.split('/');
      let lastSegment = parts.pop() || parts.pop();
      if (resource.sizeOverBudget > 0) {
        let msg = `You exceeded the allowable maximum for a ${chalk.yellow(lastSegment)} ${chalk.yellow(resource.resourceType)}!
         Now the size is ${chalk.yellow(formatSize(resource.size))} with a total increase of ${chalk.red(formatSize(resource.sizeOverBudget))}`;
        log(logSymbols.error, msg);
      } else {
        let msg = `Asset size check passed for ${lastSegment} ${resource.resourceType}!`;
        log(logSymbols.success, msg);
      }
    });
  }
}

class AssetSizeManifestGenerator {
  constructor(path, filetype, filesArray, targetDir) {
    // Name of the route under test
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
        error(`Error executing source map explorer. Make sure the page '${this._path}' was loaded fine and
         Check if splitUrlPattern defined in config is correct. ${e}`)
    }             
  }

  /**
   * Sort bundles and files by size
   * @param {*} routeObj
   */
  sortBySize(routeObj) {
    routeObj.files.sort( (b1, b2) => b2.totalBytes - b1.totalBytes).map(bundle => {
      const files = bundle.files;
      const sortedTmp = {};
      Object.keys(files).sort((a, b) => files[b]-files[a]).forEach(key => sortedTmp[key] = files[key]);
      bundle.files = sortedTmp;
    });
    return routeObj;
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

        // Sort files by size for all bundles
        routeObj = this.sortBySize(routeObj)
        const manifestPath = path.join(this._targetDir, this._path + "-" + this._filetype + ".json");
        fs.writeFileSync(manifestPath, JSON.stringify(routeObj));
      }
    } catch(e) {
      console.error(e);
    }
  }
}

class DiffReporter {
  constructor(lhs, rhs, page, config) {
    this._lhs = lhs || {};
    this._rhs = rhs || {};
    this._page = page;
    this._config = config;
  }

  /**
   * The function returns the merged files from all bundles.
   * @param {*} bundles
   */
  flattenBundle(manifest) {
    const allFiles = {};
    const bundles = manifest.files;
    bundles.forEach(bundle => {
       let bundleFiles = bundle.files;
       if(bundleFiles['0'] !== undefined) {
         let obj = { [`${bundle['bundleName']}`] : bundle.files['0']};
         Object.assign(allFiles, obj);
       } else {
        Object.assign(allFiles, bundleFiles);
       }
    });
    return allFiles;
  }


  addBundleNameToDiff(manifest, diffResult) {
    return diffResult.map(diff => {
      const file = Array.isArray(diff["path"])
          ? diff["path"].join("/")
          : diff["path"];
      diff['bundleName'] = [];
      diff['file'] = file;
      const bundles = manifest.files;
      for(let bkey in bundles) {
        let bundle = bundles[bkey];
        if(bundle.files && Object.keys(bundle.files).includes(file)) {
            diff['bundleName'].push(bundle['bundleName'].replace(this._config.assetManifest.buildDir, ''));
        }
      }
      return diff;
    });
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
    const oldManifest = readJson(this._lhs);
    const currentManifest = readJson(this._rhs);
    const result = deepDiff.diff(this.flattenBundle(oldManifest), this.flattenBundle(currentManifest));
    if (result === undefined) {
      log(chalk.blue.bold(`\nAsset size diff report for '${this._page}' \n`));
      log(logSymbols.info, `Files (${this._lhs} and ${this._rhs}) are indentical\n`);
    } else {
      const resultWithBundles = this.addBundleNameToDiff(currentManifest, result);
      const groupedByEditKind = this.groupBy(resultWithBundles, 'kind');
      this.printToConsole(groupedByEditKind);
      return groupedByEditKind;
    } 
  }

  getTable() {
    const table = new Table({
      chars: { 'top': '═' , 'top-mid': '╤' , 'top-left': '╔' , 'top-right': '╗'
             , 'bottom': '═' , 'bottom-mid': '╧' , 'bottom-left': '╚' , 'bottom-right': '╝'
             , 'left': '║' , 'left-mid': '╟' , 'mid': '─' , 'mid-mid': '┼'
             , 'right': '║' , 'right-mid': '╢' , 'middle': '│' },
      head: [ "Files", 'Current Bundle',  "Prev Size", "Current size", "Change"],
    });
    return table;
  }

  printFailureReportTable(groupedByEditKind, kind) {
    const table = this.getTable()
    groupedByEditKind[kind].forEach(diff => {
      const file = Array.isArray(diff["path"])
          ? diff["path"].join("/")
          : diff["path"];

          if (kind === "E") {
            table.push([ file, diff.bundleName.join(), formatSize(diff.lhs), formatSize(diff.rhs), formatSize(diff.rhs - diff.lhs)]);
          } else if (kind === "N") {
            table.push([file, diff.bundleName, null, formatSize(diff.rhs), null]);
          } else if (kind === "D") {
            table.push([file, diff.bundleName, formatSize(diff.lhs), null, null]);
          }
    });
    console.log(table.toString());
    console.log("\n");
  }

  printToConsole(groupedByEditKind) {
    log(chalk.blue.bold(`\nAsset size failure reason for '${this._page}' \n`));
    for (let kind in groupedByEditKind) {
      if (kind === "N") {
        log(chalk.blue.underline("New Files\n"));
      } else if (kind === "D") {
        log(chalk.blue.underline("Deleted Files\n"));
      } else if (kind === "E") {
        log(chalk.blue.underline("Modified Files\n"));
      }
      this.printFailureReportTable(groupedByEditKind , kind);
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
 async function performAssetSizeCheck(page, lhr) {
    const budgetReport = new LHBudgetReport(page.url, lhr);
    const failedAudits = budgetReport.report();

    //AssetSize manifest files should be generated only if sourcemap section is present in config file
    if (page.config.assetManifest) {
      // TODO: Validate the assetManifest section in config
      page.config.assetManifest.includedTypes.forEach(async type => {
        const paths = networkRequestToPaths(page.config, lhr);
        let pathName;
          try {
            // Generate asset size manifest files
            pathName = page.relativePath.replace(/\//g, '');
            const currentManifestTargetDir = page.config.assetManifest.targetDir;
            const manifestGenerator = new AssetSizeManifestGenerator(pathName, type, paths, currentManifestTargetDir);
            await manifestGenerator.createAssetManifests();

            // Print failure report
            if (page.config.assetManifest.diffReport && failedAudits.filter(resource => resource.resourceType == type.toLowerCase())) {
              const assetFileName = pathName + '-' + type + '.json';
              const prevManifestTargetDir = page.config.assetManifest.diffReport.oldManifestDir;
              const diffFinder = new DiffReporter(path.join(prevManifestTargetDir, assetFileName), path.join(currentManifestTargetDir, assetFileName), pathName, page.config);
              diffFinder.diffReport();
            }
          } catch(e) {
            // TODO: Report proper error
            console.log(e);
          }
        });
     }
  }

  /**
 * The network response from lighthouse will include all network calls for the site. This function filters only the calls
 *  that needs be audited for asset size
 * @param {*} config 
 * @param {*} lhr 
 */
function networkRequestToPaths(config, lhr) {
  const { includedTypes, buildDir, splitUrlPattern, encoding } = config.assetManifest;
  const networkRequests = lhr["audits"]["network-requests"]["details"]["items"];
  fs.writeFileSync("lhr.json", JSON.stringify(lhr));
  // The below code, filters the needed requests and replaces the http url with the disk path
  const urlsToAssetify = networkRequests
    .filter(nr => includedTypes.includes(nr["resourceType"]))
    .map(nr => new URL(nr.url).pathname)
    .filter(path => (path ? path.includes(splitUrlPattern) : false))
    .map(path => path.replace(splitUrlPattern, buildDir))
    .map(pt => encoding.includes(path.extname(pt)) ? path.join(path.dirname(pt), path.basename(pt, encoding)) : pt);
  return urlsToAssetify;
}

module.exports = {
  LHBudgetReport,
  AssetSizeManifestGenerator,
  DiffReporter,
  performAssetSizeCheck,
  networkRequestToPaths
};