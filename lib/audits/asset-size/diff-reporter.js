"use strict";

const chalk = require("chalk");
const deepDiff = require("deep-diff");
const fs = require("fs");
const log = console.log;
const logSymbols = require('log-symbols');
const path = require('path');
const Table = require('cli-table3');
const { formatSize, groupBy, readJson } = require("../../utils");

/**
 * This class reports diff between same 2 manifest files from different builds.
 * It reports the application files that are added, deleted or modified.
 */
class DiffReporter {
  constructor(page, filetype) {
    const pathBudget = page.config.budgets.filter(budget => budget.path === page.relativePath)[0];
    if (pathBudget.name !== undefined) {
      this._pageName = pathBudget.name;
    } else {
      this._pageName = page.relativePath.replace(/\//g, '');
    }
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
   * The function returns the files from all bundles. This is because a file may be present in bundle A in 1 build
   *  and may be present in bundle B in another build.
   * @param {*} bundles
   */
  flattenBundle(manifest) {
    const allFiles = {};
    const bundles = manifest.files;
    bundles.forEach(bundle => {
       let bundleFiles = bundle.files;
       // if a bundle does not not contain any files, use bundle name as file name for comparison
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
    log(chalk.blue.bold(`\nAsset size diff report for '${this._pageName}' \n`));
    if (fs.existsSync(this._lhs)) {
      const oldManifest = readJson(this._lhs);
      const currentManifest = readJson(this._rhs);
      const result = deepDiff.diff(this.flattenBundle(oldManifest), this.flattenBundle(currentManifest));
      if (result === undefined) {
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
        table.push([diff.file, diff.bundleName.join(), "0 KB", formatSize(diff.rhs), formatSize(diff.rhs)]);
      } else if (kind === "D") {
        table.push([diff.file, diff.bundleName.join(), formatSize(diff.lhs), "0 KB", formatSize(0 - diff.lhs)]);
      }
    });
    console.log(table.toString());
    console.log("\n");
  }

  printToConsole(groupedByEditKind) {
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

module.exports = {
  DiffReporter
};