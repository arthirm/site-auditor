"use strict";

const chalk = require("chalk");
const Launcher = require("./launcher").Launcher;
const workerpool = require("workerpool");
const log = console.log;

const execute = async (page) => {
  //TODO: Log in file
  //log(chalk.blue(`Starting audit for ${page.url}`));
  const launcher = new Launcher(page.url, page.port, page.config);
  // TODO: Error handler
  const lhr = await launcher.launch();  
  return lhr;    
};

workerpool.worker({
  execute
});

