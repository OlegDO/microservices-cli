import fs from 'node:fs';
import { getFilteredMsNames, getMsFolder } from '../command.js';
import chalk from "chalk";

/**
 * Get microservices list
 */
const getMicroservices = (withDir, checkJson) => {
  const onlyMs = getFilteredMsNames();
  const msFolder = getMsFolder();
  const list = [];

  const dirs = fs.readdirSync(msFolder, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }

    if (onlyMs !== '' && !onlyMs.includes(dir.name)) {
      continue;
    }

    if (checkJson && !fs.existsSync(`${msFolder}/${dir.name}/package.json`)) {
      continue;
    }

    const name = withDir ? `${msFolder}/${dir.name}` : dir.name;

    list.push(name);
  }

  console.log(chalk.blue('Obtained microservices:'), list);

  return list;
};

export default getMicroservices;
