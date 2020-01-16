'use strict';

const explore = require('source-map-explorer').default;
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

/**
 * This class generates asset manifest file for a specific resource type of each page
 */
module.exports = class AssetSizeManifestGenerator {
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
    this._currentManifestDir =
      current_manifest !== undefined
        ? current_manifest
        : path.join(__dirname, '/tmp/current-manifests');

    if (!fs.existsSync(this._currentManifestDir)) {
      mkdirp.sync(this._currentManifestDir);
    }
    this._buildDir = page.config.assetManifest.buildDir;
    this._baseDir = page.config.baseDir;
  }

  /**
   * The network response from chrome will include all network calls for the site. This function filters only the calls
   *  that needs be audited for asset size and converts them to disk paths.
   */
  networkRequestToPaths() {
    const {
      includedTypes,
      buildDir
    } = this._page.config.assetManifest;
    let encoding = this._page.config.assetManifest.encoding;
    encoding = encoding ? `.${encoding}` : undefined;
    const includeUrlPattern = this._page.config.includeUrlPattern;

    // The below code, filters the needed requests and replaces the http url with the disk path
    const urlsToAssetify = this._pageResult
      .filter(networkRequest => includedTypes.includes(networkRequest['resourceType']))
      .map(networkRequest => new URL(networkRequest.url).pathname)
      .filter(requestPath => (requestPath ? requestPath.includes(includeUrlPattern) : false))
      .map(requestPath => requestPath.replace(includeUrlPattern, buildDir))
      .map(requestPath =>
        encoding && encoding.includes(path.extname(requestPath))
          ? path.join(path.dirname(requestPath), path.basename(requestPath, encoding))
          : requestPath
     );
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
        output: { format: 'json' },
      });
      return srcmapResults;
    } catch (e) {
      throw new Error(`Error: Couldn't run source map explorer for the page '${
        this._pathName
      }'.
        Make sure the source maps exists for the file(s) '${filePaths}' \n ${JSON.stringify(
        e
      )}`);
    }
  }

  /**
   * Sort bundles and files by descending value of size to be stored in asset manifest files
   * @param {Object} routeObj
   * @return {Object} sorted routeObj
   */
  sortBySize(routeObj) {
    routeObj.files
      .sort((b1, b2) => b2.totalBytes - b1.totalBytes)
      .map(bundle => {
        const files = bundle.files;
        const sortedTmp = {};
        Object.keys(files)
          .sort((a, b) => files[b] - files[a])
          .forEach(key => {
            // Sometimes the file path in sources array of sourcemap will have an absolute path.
            // Strip the baseDir for those cases
            sortedTmp[key.replace(this._baseDir, '')] = files[key];
        });
        bundle.files = sortedTmp;
      });
    return routeObj;
  }

  /**
   * Create asset-manifest files
   */
  async createAssetManifests() {
    try {
      const explorerResult = await this.createAssetObjForRoute();
      if (explorerResult) {
        let routeObj = {};
        routeObj.routeName = this._pathName;
        routeObj.filetype = this._filetype;
        routeObj.files = explorerResult.bundles;
        // Strip baseDir from bundleName
        routeObj.files.forEach(bundle => {
          bundle['bundleName'] = bundle['bundleName'].replace(this._buildDir, '')
        });

        // Sort files by size for all bundles
        routeObj = this.sortBySize(routeObj);
        const manifestPath = path.join(
          this._currentManifestDir,
          this._pathName + '-' + this._filetype + '.json'
        );
        fs.writeFileSync(manifestPath, JSON.stringify(routeObj));
      }
    } catch (e) {
      console.error(e);
    }
  }
}
