import fs from 'fs';
import Runner from './runner';

const argv = require('yargs')
  .command(
    'audit [--config-path]',
    'Performs a buget audit of your site using configuration options provided by `config-path`',
  )
  .option({
    'config-path': {
      alias: 'c',
      type: 'string',
      description: 'The path to the config file.',
    },
    'manifest': {
      alias: 'm',
      type: 'boolean',
      description: 'Generate manifest files but will not provide diff report',
      default: false,
    },
    'diff': {
      alias: 'd',
      type: 'boolean',
      description: 'Report diff between 2 set of manifest files (The page sizes differences between different commits)',
      default: false,
    },
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

    const runner = new Runner(argv.configPath, argv.manifest, argv.diff);
    await runner.run();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
