'use strict';

const chalk = require('chalk');
const deepDiff = require('deep-diff');
const fs = require('fs');
const log = console.log;
const logSymbols = require('log-symbols');
const path = require('path');

const { formatSize, readJson, getTable } = require('../../utils');

/**
 * This class reports diff between same 2 manifest files from different builds.
 * It reports the application files that are added, deleted or modified.
 */
module.exports = class DiffReporter {
  constructor(page, filetype) {
    const pathBudget = page.config.budgets.filter(
      budget => budget.path === page.relativePath
    )[0];
    if (pathBudget.name !== undefined) {
      this._pageName = pathBudget.name;
    } else {
      this._pageName = page.relativePath.replace(/\//g, '');
    }
    this._pathName = page.relativePath.replace(/\//g, '');
    this._config = page.config;
    // left-hand-side/ base manifest file
    this._lhs = {};
    // right-hand-side/ current manifest file
    this._rhs = {};

    const assetFileName = this._pathName + '-' + filetype + '.json';
    const baseManifestDir =
      page.config.assetManifest.diffReport.baseManifestDir;
    this._lhs = path.join(baseManifestDir, assetFileName);

    // currentManifestDir should be created by AssetSizeManifestGenerator if the dir is not present
    const currentManifestDir = page.config.assetManifest.currentManifestDir;
    this._rhs = path.join(currentManifestDir, assetFileName);
    this._buildDir = page.config.assetManifest.buildDir;
  }

  /**
   * The function flattens the bundle name with file name and returns the object in this format <bundleName::fileName : size>
   * @param {Object} manifest file content
   * @return {Object} <bundleName::fileName : size> object
   */
  flattenBundle(manifest) {
    const allFiles = {};
    const bundles = manifest.files;
    bundles.forEach(bundle => {
      let bundleFilesWithBundleNames = {};
      let bundleName = bundle['bundleName'].replace(this._buildDir, '');

      Object.keys(bundle.files).forEach(key => {
        let fileName = key;
        if (key === '0') {
          fileName = bundleName;
        }
        bundleFilesWithBundleNames[`${bundleName}::${fileName}`] = bundle.files[key];
      });

      Object.assign(allFiles, bundleFilesWithBundleNames);
    });
    return allFiles;
  }

  /**
   * Add bundleName and fileName in each diff object to report in diff table.
   * @param {Object} diffResult - The result is from flattened asset manifest files
   * @return {Object} diff object
   */
  addBundleAndFileNameToDiff(diffResult) {
    return diffResult.map(diff => {
      const file = Array.isArray(diff['path'])
        ? diff['path'].join('/')
        : diff['path'];
      diff['bundleName'] =  file.split("::")[0];
      diff['file'] =  file.split("::")[1];
      return diff;
    });
  }

  /**
   * This function diffs 2 asset manifest files and reports the difference
   */
  diffReport() {
    log(chalk.blue.bold(`\n'${this._pageName}' - diff report (Uncompressed size) \n`));
    let result = [];

    if (!fs.existsSync(this._lhs)) {
      console.warn(
        chalk.red(`Warning: File ${this._lhs} not present for comparison`)
      );
      return result;
    }

    const baseManifest = readJson(this._lhs);
    const currentManifest = readJson(this._rhs);
    log(chalk.blue(`Prev: ${baseManifest.totalUncompressedSize}, Current: ${currentManifest.totalUncompressedSize}, Diff: ${formatSize(currentManifest.totalRawUncompressedSize - baseManifest.totalRawUncompressedSize)} \n`));

    let diffResult = deepDiff.diff(
      this.flattenBundle(baseManifest),
      this.flattenBundle(currentManifest)
    );

    if (diffResult === undefined) {
      log(
        logSymbols.info,
        `Files (${this._lhs} and ${this._rhs}) are indentical\n`
      );
    } else {
      let resultWithBundles = this.addBundleAndFileNameToDiff(diffResult);
      resultWithBundles = this.sortByChange(resultWithBundles);
      this.printTable(resultWithBundles);
      result = resultWithBundles;
    }
    return result;
  }

  /**
   * Sort the array by change
   * @param {Object} diffObj
   * @return {Object} diff object
   */
  sortByChange(diffObj) {
    diffObj = diffObj.map(res => {
      const lhs = res['lhs'] ? res['lhs'] : 0;
      const rhs = res['rhs'] ? res['rhs'] : 0;
      const change = rhs - lhs;
      return Object.assign(res, { change });
    }).sort( (a, b) => b.change - a.change);
    return diffObj;
  }

  /**
   * Print the files/modules that are added, deleted, modified in a single table
   * @param {Object} results
   */
  printTable(results) {
    const columns = ['Files', 'Bundle Name', 'Prev Size', 'Current size', 'Change'];
    const table = getTable(columns);
    results.forEach(diff => {
      table.push([
        diff.file,
        diff.bundleName,
        diff.lhs ? formatSize(diff.lhs) : 'N/A',
        diff.rhs ? diff.kind === 'N' ? `${formatSize(diff.rhs)} (New)` : formatSize(diff.rhs) : 'Deleted',
        formatSize(diff.change),
      ]);
    });
    let {prev, curr, change} = this.computeTotal(results);
    table.push(['Total', '', formatSize(prev), formatSize(curr), formatSize(change)]);

    console.log(table.toString());
    console.log('\n');
  }

  /**
   * Compute the total change to report in diff table
   * @param {Object} results
   * @return {Object} total of prev, current and change
   */
  computeTotal(results) {
    let prev = 0, curr = 0, change = 0;
    results.forEach(diff => {
      prev = diff.lhs ? (prev + diff.lhs) : prev;
      curr = diff.rhs ? (prev + diff.rhs) : curr;
      change += diff.change;
    });
    return { prev, curr, change };
  }
}
