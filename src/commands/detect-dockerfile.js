import { Option } from 'commander';
import fs from 'node:fs';
import chalk from 'chalk';
import github from '@actions/core';
import { program } from '../command.js';

/**
 * Detect right docker file for microservice
 */
const runDetectDockerfile = (workdir) => {
  const dockerfile = 'Dockerfile-nodejs';
  const workdirDockerfile = [workdir, 'Dockerfile'].join('/');
  const path = fs.existsSync(workdirDockerfile) ? workdirDockerfile : dockerfile;

  console.log(`Dockerfile path: ${chalk.green(path)}`);

  github.setOutput('path', path);
}

/**
 * Add command to CLI
 */
program.command('detect-docker-file')
  .description('Detect microservice docker file')
  .addOption(new Option('--workdir [files]', 'working directory e.g. "microservices/authorization"').env('WORK_DIR'))
  .action(({ workdir }) => {
    void runDetectDockerfile(workdir);
  });
