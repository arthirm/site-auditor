'use strict';

const finalhandler = require('finalhandler');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');

class StaticServer {
  constructor() {
    this._serve = serveStatic(path.join(__dirname, '../../fixtures/static'));
  }

  start() {
    this._server = http.createServer((req, res) => {
      console.log(`Serving ${req.url}`);
      const done = finalhandler(req, res);
      this._serve(req, res, done);
    });
    this._server.listen(3006);
    console.log("Static server started");
  }

  stop() {
    if(this._server) {
      this._server.close();
    }
  }
}

module.exports = {
  StaticServer
}