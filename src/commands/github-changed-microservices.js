import { Option } from 'commander';
import github from '@actions/core';
import chalk from 'chalk';
import { program } from '../command.js';

/**
 * Get changed microservices based on "tj-actions/changed-files@v35" GitHub Action output
 * NOTE: used in CI/CD
 */
const runOutputChangedMicroservices = (filesStr) => {
  let files = [];

  try {
    files = JSON.parse(filesStr || '[]');
  } catch (e) {
    try {
      // try to remove escape slashes
      files = JSON.parse(filesStr.replace(/\\/g,""));
    } catch (e2) {
      console.log(`Failed to parse json input: ${filesStr}`);

      return github.setFailed(`Action failed with error ${e}, ${e2}`);
    }
  }

  if (!files.length) {
    console.log(chalk.yellow('No files changed!'));

    return;
  }

  const changedMs = new Set();

  [...new Set(files)].forEach((file) => {
    if (!file.startsWith('microservices')) {
      return;
    }

    const [,msName] = file.split('/');

    if (msName) {
      changedMs.add(msName);
    }
  });

  const output1 = `["${[...changedMs].join('","')}"]`;
  const output2 = [...changedMs].join(' ');

  console.log(`Changed microservices: ${chalk.green(output1)}`);

  // output example: ["demo1","demo2","demo3"]
  github.setOutput('list', output1);
  // output example: "demo1 demo2 demo3"
  github.setOutput('list-spaced', output2);
}

/**
 * Add command to CLI
 */
program.command('changed-microservices')
  .description('Set changed microservices based on git history to Github Actions')
  .addOption(new Option('--files [files]', 'changed files in json format').env('FILES'))
  .action(({ files }) => {
    void runOutputChangedMicroservices(files);
  });
