import github from '@actions/core';
import chalk from 'chalk';
import { program } from '../command.js';
import getMicroservices from "../helpers/get-microservices.js";

/**
 * Get microservices list
 * @description NOTE: used in CI/CD
 */
const getMicroservicesList = () => {
  const microservices = getMicroservices()

  const output1 = `["${[...microservices].join('","')}"]`;
  const output2 = [...microservices].join(' ');

  console.log(`Microservices list: ${chalk.green(output1)}`);

  // output example: ["demo1","demo2","demo3"]
  github.setOutput('list', output1);
  // output example: "demo1 demo2 demo3"
  github.setOutput('list-spaced', output2);
}

/**
 * Add command to CLI
 */
program.command('microservices-list')
  .description('Returns microservices list based on folders')
  .action(() => {
    void getMicroservicesList();
  });
