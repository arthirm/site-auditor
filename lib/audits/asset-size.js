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
const { error, formatSize, groupBy, readJson } = require("../utils");
const log = console.log;

/**
 * This class performs budget audit for a page
 */
class BudgetReport {
  constructor(page, networkResponse) {
    // Page object created by runner
    this._page = page;
    // Network results from tracer
    this._networkResponse = networkResponse;
  }

  /**
   * Get budget summary
   * @param {*} resourceSizes
   */
  summarize(resourceSizes) {
    const groupedByType = groupBy(this._networkResponse, 'resourceType');

    // Get the total asset size for each resource type
    const summary = this.computeSummary(groupedByType);
    if (resourceSizes) {
      return resourceSizes.map(resource => {
        // Figure out which resource went over budget
        const { resourceType, budget} = resource;
       if (summary[resourceType] !== undefined) {
        const size = summary[resourceType];
        const budgetinKB = budget * 1024;
        const sizeOverBudget = size > budgetinKB ? (size - budgetinKB) : undefined;
        return { resourceType, size, sizeOverBudget };
       }
     }).filter(result => !!result);
    } else {
      console.log("No resource sizes has been provided. Returning totalSize of the resources");
      return summary;
    }
  }

  /**
   * Compute total asset size for each resource type
   * @param {*} groupedByType
   */
  computeSummary(groupedByType) {
     const summary = {};
     Object.keys(groupedByType).forEach(type => {
        const responses = groupedByType[type];
        const size = responses.reduce((acc, curr) => {
          return acc + Number((curr.size ? curr.size : 0));
        }, 0);
        summary[type.toLowerCase()] = size;
     });
     return summary;
  }

  report() {
    const pathBudget = this._page.config.budgets.filter(budget => budget.path === this._page.relativePath);
    let auditResults;
    if (pathBudget && pathBudget[0]) {
      auditResults = this.summarize(pathBudget[0].resourceSizes);
    }

    if (auditResults.length > 0) {
      auditResults.forEach(resource => {
        let parts = this._page.url.split('/');
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
      return auditResults.filter(r => r.sizeOverBudget > 0);
    } else {
      console.warn(chalk.red(`Warning: Budget result is undefined.`));
      return auditResults;
    }
  }

}

/**
 * This class generates asset manifest file for a specific resource type of each page
 */
class AssetSizeManifestGenerator {
  constructor(page, filetype, pageResult) {
    // Name of the route under test
    this._pathName = page.relativePath.replace(/\//g, '');
    // Page object created by runner
    this._page = page;
    // Network results from tracer
    this._pageResult = pageResult;
    // js/css etc
    this._filetype = filetype;
    // Dir for storing manifests
    let current_manifest = page.config.assetManifest.currentManifestDir;
    this._currentManifestDir = current_manifest !== undefined ? current_manifest : path.join(__dirname, '/tmp/current-manifests');

    if (!fs.existsSync(this._currentManifestDir)) {
      mkdirp.sync(this._currentManifestDir)
    }
  }

  /**
   * The network response from chrome will include all network calls for the site. This function filters only the calls
   *  that needs be audited for asset size and converts them to disk paths.
   */
   networkRequestToPaths() {
    const { includedTypes, buildDir, includeUrlPattern, encoding } = this._page.config.assetManifest;

    // The below code, filters the needed requests and replaces the http url with the disk path
    const urlsToAssetify = this._pageResult
      .filter(nr => includedTypes.includes(nr["resourceType"]))
      .map(nr => new URL(nr.url).pathname)
      .filter(path => (path ? path.includes(includeUrlPattern) : false))
      .map(path => path.replace(includeUrlPattern, buildDir))
      .map(pt => encoding && encoding.includes(path.extname(pt)) ? path.join(path.dirname(pt), path.basename(pt, encoding)) : pt);
    return urlsToAssetify;
  }

  /**
   * This function uses source-map-explorer to determine which file each byte in the minified code
   *  of each file in the fileArray came from.
   * In order for this function to work each file passed in the filesArray should have a corresponding
   *  sourcemap.
   */
   async createAssetObjForRoute() {
    const filePaths = this.networkRequestToPaths();
    try {
      const srcmapResults = await explore(filePaths, {
        output: { format: "json" }
      });
      return srcmapResults;
    } catch(e) {
      // return Promise.reject(new Error(`Couldn't run source map explorer for the page '${this._pathName}'.
      //   Make sure the source maps exists for the file(s) '${filePaths}' \n ${JSON.stringify(e)}`));
      throw new Error(`Error: Couldn't run source map explorer for the page '${this._pathName}'.
        Make sure the source maps exists for the file(s) '${filePaths}' \n ${JSON.stringify(e)}`);
    }
  }

  /**
   * Sort bundles and files by descending value of size
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
      const explorerResult = await this.createAssetObjForRoute();
      if (explorerResult) {
        let routeObj = {};
        routeObj.routeName = this._pathName;
        routeObj.filetype = this._filetype;
        routeObj.files = explorerResult.bundles;

        // Sort files by size for all bundles
        routeObj = this.sortBySize(routeObj)
        const manifestPath = path.join(this._currentManifestDir, this._pathName + "-" + this._filetype + ".json");
        fs.writeFileSync(manifestPath, JSON.stringify(routeObj));
      }
    } catch(e) {
      console.error(e);
    }
  }
}

/**
 * This class reports diff between same 2 manifest files from different builds.
 * It reports the application files that are added, deleted or modified.
 */
class DiffReporter {
  constructor(page, filetype) {
    this._pageName = page.relativePath.replace(/\//g, '');
    this._config = page.config;
    // left-hand-side/ base manifest file
    this._lhs = {};
    // right-hand-side/ current manifest file
    this._rhs = {};

    const assetFileName = this._pageName + '-' + filetype + '.json';
    const baseManifestDir = page.config.assetManifest.diffReport.baseManifestDir;
    this._lhs = path.join(baseManifestDir, assetFileName)

    // currentManifestDir should be created by AssetSizeManifestGenerator if the dir is not present
    const currentManifestDir = page.config.assetManifest.currentManifestDir;
    this._rhs = path.join(currentManifestDir, assetFileName)
  }

  /**
   * The function returns the files from all bundles.
   * @param {*} bundles
   */
  flattenBundle(manifest) {
    const allFiles = {};
    const bundles = manifest.files;
    bundles.forEach(bundle => {
       let bundleFiles = bundle.files;
       if(bundleFiles['0'] !== undefined) {
         let obj = { [`${bundle['bundleName']}`] : bundle.totalBytes};
         Object.assign(allFiles, obj);
       } else {
         Object.assign(allFiles, bundleFiles);
       }
    });
    return allFiles;
  }

/**
 * Add bundle name for each file to report in diff table
 * @param {*} manifest
 * @param {*} diffResult
 */
  addBundleNameToDiff(manifest, diffResult) {
    let baseBundleDir = '';
    if (this._config && this._config.assetManifest && this._config.assetManifest.buildDir) {
      baseBundleDir = this._config.assetManifest.buildDir;
    };
    return diffResult.map(diff => {
      const file = Array.isArray(diff["path"]) ? diff["path"].join("/") : diff["path"];
      diff['bundleName'] = [];
      diff['file'] = file;
      const bundles = manifest.files;
      bundles.forEach(bundle => {
        if(bundle.files && Object.keys(bundle.files).includes(file)) {
          diff['bundleName'].push(bundle['bundleName'].replace(baseBundleDir, ''));
        } else if(bundle['bundleName'] === file) {
          diff['bundleName'].push(bundle['bundleName'].replace(baseBundleDir, ''));
          diff['file'] = '';
        }
      });
      return diff;
    });
  }

  /**
   * This function diffs 2 asset manifest files and reports the difference
   */
  diffReport() {
    if (fs.existsSync(this._lhs)) {
      const oldManifest = readJson(this._lhs);
      const currentManifest = readJson(this._rhs);
      const result = deepDiff.diff(this.flattenBundle(oldManifest), this.flattenBundle(currentManifest));
      if (result === undefined) {
        log(chalk.blue.bold(`\nAsset size diff report for '${this._pageName}' \n`));
        log(logSymbols.info, `Files (${this._lhs} and ${this._rhs}) are indentical\n`);
      } else {
        const resultWithBundles = this.addBundleNameToDiff(currentManifest, result);
        const groupedByEditKind = groupBy(resultWithBundles, 'kind');
        this.printToConsole(groupedByEditKind);
        return groupedByEditKind;
      }
    } else {
      console.warn(chalk.red(`Warning: File ${this._lhs} not present for comparison`));
    }
  }

  /**
   * Create table object to report diff
   */
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

  /**
   * Create a table for each kind to report diff
   * @param {*} groupedByEditKind
   * @param {*} kind denotes whether the file was new, deleted or edited
   */
  printFailureReportTable(groupedByEditKind, kind) {
    const table = this.getTable()
    groupedByEditKind[kind].forEach(diff => {
          if (kind === "E") {
            table.push([diff.file, diff.bundleName.join(), formatSize(diff.lhs), formatSize(diff.rhs), formatSize(diff.rhs - diff.lhs)]);
          } else if (kind === "N") {
            table.push([diff.file, diff.bundleName.join(), null, formatSize(diff.rhs), null]);
          } else if (kind === "D") {
            table.push([diff.file, diff.bundleName.join(), formatSize(diff.lhs), null, null]);
          }
    });
    console.log(table.toString());
    console.log("\n");
  }

  printToConsole(groupedByEditKind) {
    log(chalk.blue.bold(`\nAsset size failure reason for '${this._pageName}' \n`));
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
   * This function orchestrates asset size audit which does,
   *  a. Report perfomance budgets for the configured pages.
   *  b. Generate Assetsize Manifest files which contains which file each byte in the page being rendered came from.
   *  c. Provides diff between same 2 set of manifest files that are generated from different builds.
   * @param {*} page
   * @param {*} pageResult
   */
 async function performAssetSizeCheck(page, pageResult) {
    // Report whether the resource passed/failed the budgeting
    const budgetReport = new BudgetReport(page, pageResult);
    const failedAudits = budgetReport.report();

    //AssetSize manifest files should be generated only if assetManifest section is present in config file
    if (failedAudits!== undefined && page.config.assetManifest) {
      page.config.assetManifest.includedTypes.forEach(async type => {
          // Generate asset size manifest files
          const manifestGenerator = new AssetSizeManifestGenerator(page, type, pageResult);
          await manifestGenerator.createAssetManifests();

          // Print failure report if diffReport section is present in config and there are failed audits for resourcetype
          if (page.config.assetManifest.diffReport && failedAudits.filter(resource => resource.resourceType == type.toLowerCase())) {
            const diffFinder = new DiffReporter(page, type);
            diffFinder.diffReport();
          }
        });
     }
     return failedAudits;
  }

module.exports = {
  BudgetReport,
  AssetSizeManifestGenerator,
  DiffReporter,
  performAssetSizeCheck,
};