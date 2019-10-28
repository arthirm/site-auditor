import fs from 'fs';
import Runner from './runner';

const argv = require('yargs')
  .command(
    'audit [--config-path]',
    'Performs a buget audit of your site using configuration options provided by `config-path`',
  )
  .option('config-path', {
    alias: 'c',
    type: 'string',
    description: 'The path to the config file.',
  })
  .demandOption(
    ['config-path'],
    'Please provide a `config-path` to `site-audit audit`.'
  ).argv;

export async function cli() {
  try {
    if (!fs.existsSync(argv.configPath)) {
      console.log(
        `The provided configuration file path '${argv.configPath}' does not exist.`
      );
      process.exit(1);
    }

    const runner = new Runner(argv.configPath);
    await runner.run();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
