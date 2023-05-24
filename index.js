#!/usr/bin/env node
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const { Command, Option, Argument } = require('commander');
const inquirer = require('inquirer');
const github = require('@actions/core');
const getRepository = require('./get-repository');
const packageJson = require('./package.json');

const program = new Command();

/**
 * Filter for microservices
 */
const getFilteredMsNames = () => {
  const options = program.opts();
  return process.env.ONLY || options.only || '';
}

/**
 * Get microservices folder
 */
const getMsFolder = () => {
  const options = program.opts();
  return options.msFolder;
}

/**
 * Get .env file path
 */
const getEnvPath = () => {
  const options = program.opts();
  return options.envPath;
}

/**
 * Get GitHub params
 */
const getGithubParams = (isStaging = false) => ({ user: 'Lomray-Software', repo: 'microservices', ref: isStaging ? 'staging' : 'prod' });

/**
 * Download config repo
 */
const downloadRepo = async (path, isStaging) => {
  console.info(`Download configuration...`);

  try {
    fse.ensureDirSync(path, {});

    await getRepository(getGithubParams(isStaging), path);
  } catch (err) {
    console.info(chalk.red(`Failed to download configuration: ${err.message}`));

    return;
  }

  console.info(chalk.green('Downloaded.'));
}

/**
 * Add new line to end of file
 */
const appendLineToFile = (filePath, line) => {
  fs.appendFileSync(filePath, `${line}\n`);
}

/**
 * Add new line to begin of file
 */
const prependLineToFile = (filePath, line) => {
  const data = fs
    .readFileSync(filePath, { encoding: 'utf-8' })

  fs.writeFileSync(filePath, `${line}\n${data}`, { encoding: 'utf-8' });
}

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

  console.log('Obtained microservices:', list);

  return list;
};

/**
 * Replace string in file
 */
const replaceStrInFile = (subj, replaceValue, file) => {
  const data = fs
    .readFileSync(file, { encoding: 'utf-8' })
    .replace(new RegExp(subj, 'g'), replaceValue);

  fs.writeFileSync(file, data, { encoding: 'utf-8' });
};

/**
 * Try to find file in sequence
 */
const findFile = (fileNames = [], folder) => {
  for (const fileName of fileNames) {
    const file = folder ? `${folder}/${fileName}` : fileName;

    if (fs.existsSync(file)) {
      return file;
    }
  }

  return null;
}

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
 * Get package version from package.json
 * NOTE: used in CI/CD
 */
const runOutputPackageVersion = (workDir = '.') => {
  const packageJson = path.resolve(`${workDir}/package.json`);

  if (!fs.existsSync(packageJson)) {
    const error = `package.json not found in path: ${chalk.red(packageJson)}`;

    console.log(error);

    return github.setFailed(`Action failed with error ${error}`);
  }

  const version = require(packageJson).version;

  console.log(`Version package: ${chalk.green(version)}`);
  github.setOutput('version', version);
}

/**
 * Update .env file
 */
const runUpdateDotenv = (env) => {
  const folder = 'configs';
  const middlewaresFile = findFile([`middlewares.${env}.json`, 'middlewares.json'], folder);
  const cronFile = findFile([`cron.${env}.json`, 'cron.json'], folder);
  const configFile = findFile([`config.${env}.json`, 'config.local.json', 'config.json'], folder);
  const dotenvFile = getEnvPath();

  if (!middlewaresFile) {
    console.error(`Middlewares config not found in path ${folder}`);
    return;
  }

  if (!configFile) {
    console.error(`Config not found in path ${folder}`);
    return;
  }

  let cronTasks = '[]';

  if (cronFile) {
    cronTasks = JSON.stringify(
      JSON.parse(fs.readFileSync(cronFile, { encoding: 'utf8' })),
    );
  }

  const middlewares = JSON.stringify(
    JSON.parse(fs.readFileSync(middlewaresFile, { encoding: 'utf8' })),
  );
  const configs = JSON.stringify(JSON.parse(fs.readFileSync(configFile, { encoding: 'utf8' })));
  const dotenv = fs
    .readFileSync(dotenvFile, { encoding: 'utf8' })
    .replace(/MS_INIT_MIDDLEWARES=.*/, `MS_INIT_MIDDLEWARES='${middlewares}'`)
    .replace(/MS_INIT_CONFIGS=.*/, `MS_INIT_CONFIGS='${configs}'`)
    .replace(/MS_INIT_TASKS=.*/, `MS_INIT_TASKS='${cronTasks}'`);

  fs.writeFileSync(dotenvFile, dotenv, 'utf8');
};

/**
 * Install npm packages for each microservice
 */
const runGlobalInstall = (command = 'i') => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    const packageJson = `${msDir}/package.json`;

    if (!fs.existsSync(packageJson)) {
      console.info(`Skip install: ${msDir}`);

      continue;
    }

    childProcess.execSync(`cd ${msDir} && npm ${command}`, { stdio: 'inherit' });

    console.info(`Install done: ${msDir}`);
  }
};

/**
 * Update npm package for each microservice
 */
const runGlobalUpdate = (packageName, version = null) => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    const packageJson = `${msDir}/package.json`;

    if (!fs.existsSync(packageJson) || !fs.readFileSync(packageJson).includes(packageName)) {
      console.info(`Skip update package: ${msDir}`);

      continue;
    }

    if (version) {
      replaceStrInFile(
        `"${packageName}": "\\^[\\d\\.]+"`,
        `"${packageName}": "^${version}"`,
        packageJson,
      );
    }

    childProcess.execSync(`cd ${msDir} && npm update ${packageName}`, { stdio: 'inherit' });

    console.info(`Package updated for: ${msDir}`);
  }
};

/**
 * Run semantic release
 */
const runSemanticRelease = (isDryRun = false) => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && npx semantic-release ${isDryRun ? '--dryRun' : ''}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });

    console.info(`Semantic release done: ${msDir}`);
  }
};

/**
 * Run lint staged
 */
const runLintStaged = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && npx lint-staged`, { stdio: 'inherit' });

    console.info(`Lint staged done: ${msDir}`);
  }
};

/**
 * Build each microservice
 */
const runBuild = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && npm run build`, { stdio: 'inherit' });

    const packageJsonJs = `${msDir}/lib/package.json.js`;

    if (!fs.existsSync(packageJsonJs)) {
      fs.writeFileSync(
        packageJsonJs,
        'Object.defineProperty(exports, \'__esModule\', { value: true });\nvar version = "1.0.0";\nexports.version = version;',
      );
      console.info(`Create package.json js: ${packageJsonJs}`);
    }

    console.info(`Build done: ${msDir}`);
  }
};

/**
 * Run tests for each microservice
 */
const runTests = (withCoverage = false) => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && ${withCoverage ? 'nyc' : ''} npm run test`, {
      stdio: 'inherit',
    });

    console.info(`Tests done: ${msDir}`);
  }
};

/**
 * Check typescript for each microservice
 */
const runCheckTypescript = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && npm run ts:check`, { stdio: 'inherit' });

    console.info(`Typescript check done: ${msDir}`);
  }
};

/**
 * Run lint for each microservice
 */
const runLint = (shouldFix = false) => {
  const microservices = getMicroservices(true, true);
  const action = shouldFix ? 'fix' : 'check'

  for (const msDir of microservices) {
    childProcess.execSync(`cd ${msDir} && npm run lint:${action}`, { stdio: 'inherit' });

    console.info(`Lint check done: ${msDir}`);
  }
};

/**
 * Create/remove global feature
 */
const runChangeGlobalFeature = async (action, { isStaging }) => {
  const rootPath = path.resolve(`../${getMsFolder()}`);
  const tempPath = `${rootPath}/temp`;

  const { feature } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'feature',
        message: 'Please choose feature: ',
        choices: ['none', 'integration tests'],
      },
    ]);

  if (feature === 'none') {
    return;
  }

  console.info(`Prepare to change global feature ${chalk.yellow(feature)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  try {
    await downloadRepo(tempPath, isStaging);

    switch (feature) {
      case 'integration tests':
        if (action === 'add') {
          const destPath = `${rootPath}/tests`;

          if (!fs.existsSync(destPath)) {
            fse.copySync(`${tempPath}/tests`, rootPath, {});
          } else {
            console.log(`Global feature ${chalk.red(feature)} already exist.`);
          }
        } else {
          fse.removeSync(`${rootPath}/tests`);
        }
        break;
    }
  } catch (e) {
    console.log(`Failed ${action} global feature ${chalk.red(feature)}`);

    return;
  }

  console.info(`Feature ${chalk.yellow(action)} success: ${chalk.green(feature)}`);
}

/**
 * Create/remove microservice feature
 */
const runChangeFeature = async (name, action, { feat, isStaging }) => {
  const msPath = `${getMsFolder()}/${name}`;
  const msSrcPath = `${getMsFolder()}/${name}/src`;
  const tempPath = `${getMsFolder()}/${name}/temp`;

  let feature = feat;

  if (!feature) {
    const prompt = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'answer',
          message: 'Please choose feature: ',
          choices: ['none', 'db', 'remote-config'],
        },
      ]);
    feature = prompt.answer;
  }

  if (feature === 'none') {
    return;
  }

  if (!fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" not exist!`);

    return;
  }

  console.info(`Prepare to change feature ${chalk.yellow(feature)} for: ${chalk.green(name)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  try {

    switch (feature) {
      // Add or remove DB support feature
      case 'db':
        if (action === 'add') {
          replaceStrInFile('withDb: false', 'withDb: true', `${msSrcPath}/constants/index.ts`);
        } else {
          replaceStrInFile('withDb: true', 'withDb: false', `${msSrcPath}/constants/index.ts`);
        }
        break;

      case 'remote-config':
        await downloadRepo(tempPath, isStaging);

        if (action === 'add') {
          const destPath = `${msPath}/template/features/remote-config`;

          if (!fs.existsSync(destPath)) {
            fse.copySync(`${tempPath}/template/features/remote-config`, msSrcPath, {});
          } else {
            console.log(`Feature ${chalk.red(feature)} already exist.`);
          }
        } else {
          fse.removeSync(`${msSrcPath}/config/remote.ts`);
          fse.removeSync(`${msSrcPath}/interfaces/remote-config.ts`);
        }

        break;
    }
  } catch (e) {
    console.log(`Failed ${action} feature ${chalk.red(feature)}: ${e.message}`);

    return;
  } finally {
    fse.removeSync(tempPath);
  }

  console.info(`Feature ${chalk.yellow(action)} success: ${chalk.green(feature)}`);
};

/**
 * Create new microservice
 */
const runCreateMicroservice = async (name, isStaging, withDb) => {
  const msPath = `${getMsFolder()}/${name}`;
  const tempPath = `${getMsFolder()}/${name}/temp`;

  if (fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" exist!`);

    return;
  }

  console.log(`Creating new microservice: ${chalk.green(name)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  await downloadRepo(tempPath, isStaging);

  fse.copySync(`${tempPath}/template/new`, msPath, {});

  replaceStrInFile('microservice-name', name, `${msPath}/package.json`);
  replaceStrInFile('microservice-name', name, `${msPath}/package-lock.json`);
  replaceStrInFile(
    'microservice-name',
    name,
    `${msPath}/sonar-project.properties`,
  );
  replaceStrInFile('microservice-name', name, `${msPath}/src/constants/index.ts`);
  replaceStrInFile('microservice-name', name, `${msPath}/README.md`);

  if (withDb) {
    await runChangeFeature(name, 'add', { isStaging, feat: 'db' });
  }

  fse.removeSync(tempPath);

  console.info(`Microservice created: ${chalk.green(msPath)}`);
};


/**
 * Create extended microservice
 */
const runExtendMicroservice = async (name, isStaging) => {
  const msFolder = getMsFolder();
  const msPath = `${msFolder}/${name}`;
  const msSrcPath = `${msPath}/src`;
  const tempPath = `${msPath}/temp`;
  const targetMsPath = `${tempPath}/microservices/${name}`;

  if (fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" already exists!`);

    return;
  }

  const { type } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Please choose type: ',
        choices: ['package', 'docker'],
      },
    ]);

  console.info(`Prepare to extend microservice: ${chalk.green(name)}.`)
  isStaging && console.info(chalk.yellow('Staging mode'));

  fse.ensureDirSync(msPath, {});

  await downloadRepo(tempPath, isStaging);

  if (!fs.existsSync(targetMsPath)) {
    console.log(`Unknown microservice for extend: "${chalk.red(name)}"`);

    return;
  }

  switch (type) {
    case 'docker':
      fse.copySync(`${tempPath}/template/docker`, msPath, {});

      if (name === 'authorization') {
        // copy default permissions
        fse.copySync(`${tempPath}/microservices/authorization/migrations/permissions/list`, `${msPath}/permissions`, {});

        replaceStrInFile('#volumes', 'volumes', 'docker-compose.ms.yml');
        replaceStrInFile('#  -', '  -', 'docker-compose.ms.yml');

        // docker file should include our permission when build
        appendLineToFile(`${msPath}/Dockerfile`, 'COPY ./permissions $WEB_PATH/lib/migrations/permissions/list');
        appendLineToFile(`${msPath}/Dockerfile`, 'COPY ./lib/package.json.js $WEB_PATH/lib/package.json.js');
      } else {
        replaceStrInFile('authorization', name, `${msPath}/Dockerfile`);
        replaceStrInFile('authorization', name, `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/export.js', '', `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/import.js', '', `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/sync.js', '', `${msPath}/package.json`);
        replaceStrInFile('authorization', name, `${msPath}/package-lock.json`);
        replaceStrInFile('authorization', name, `${msPath}/README.md`);
      }

      break;

    case 'package':
      fse.copySync(`${tempPath}/template/new/__helpers__`, `${msPath}/__helpers__`, {});
      fse.copySync(`${tempPath}/template/new/__tests__/index-test.ts`, `${msPath}/__tests__/index-test.ts`, {});
      fse.copySync(`${tempPath}/template/package`, msPath, { overwrite: true });
      fse.copySync(`${targetMsPath}/src/index.ts`, `${msPath}/src/index.ts`, {});
      fse.copySync(`${targetMsPath}/src/tracer.ts`, `${msPath}/src/tracer.ts`, {});

      const files = fs.readdirSync(`${tempPath}/template/new`);

      files.forEach((file) => {
        const filePath = path.resolve(`${tempPath}/template/new/${file}`);

        if (fs.lstatSync(filePath).isFile()) {
          fse.copySync(filePath, `${msPath}/${file}`, {});
        }
      });

      prependLineToFile(`${msPath}/src/index.ts`, "import '@config/di';");
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/constants/index.ts`);
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/config/start.ts`);
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msPath}/package.json`);

      childProcess.execSync(`cd ${msPath} && npm i --save require-in-the-middle`, {
        stdio: 'inherit',
      });
      childProcess.execSync(`cd ${msPath} && npm i --save @lomray/microservice-${name}`, {
        stdio: 'inherit',
      });

      break;
  }

  fse.removeSync(tempPath);

  console.info(`Microservice extended: ${chalk.green(msPath)}`);
}

/**
 * Init new project
 */
const runInitProject = async (name, isStaging) => {
  const root = path.resolve(name);
  const appName = path.basename(root);
  const tempPath = `${root}/temp`;

  if (fs.existsSync(name)) {
    console.error('Project folder already exist.');
    return;
  }

  // noinspection JSUnusedGlobalSymbols
  const { repoName } = await inquirer
    .prompt([
      {
        type: 'input',
        name: 'repoName',
        message: 'Enter repository name, e.g. "Lomray-Software/microservices": ',
        validate(value) {
          if (value?.length > 1) {
            return true;
          }

          return 'Please enter a valid repository name';
        },
      },
    ]);

  console.info(`Creating a new microservices project in ${chalk.green(root)}.`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  await downloadRepo(tempPath, isStaging);

  console.info(`Prepare to install dependencies...`);

  const files = [
    '.env',
    'package.json',
    'package-lock.json',
    'nyc.config.js',
    'docker-compose.yml',
    'docker-compose.ms.yml',
    'commitlint.config.js',
    '.prettierrc.js',
    '.npmignore',
    '.lintstagedrc.js',
    '.gitignore',
    '.gitattributes',
    '.eslintrc.js',
    '.eslintignore',
    '.editorconfig',
    '.husky',
    '.github',
    'http-requests',
    'configs',
    ['template/README.md', 'README.md'],
  ];

  files.forEach((file) => {
    if (typeof file === 'string') {
      fse.moveSync(`${tempPath}/${file}`, `${root}/${file}`, {});
    } else {
      fse.moveSync(`${tempPath}/${file[0]}`, `${root}/${file[1]}`, {});
    }
  });

  fse.ensureDirSync(`${root}/microservices`, {});
  fse.removeSync(tempPath);

  replaceStrInFile('"@lomray/microservices"', `"${appName}"`, `${root}/package.json`);
  replaceStrInFile('https://github.com/Lomray-Software/microservices', '', `${root}/package.json`);
  replaceStrInFile('"@lomray/microservices"', `"${appName}"`, `${root}/package-lock.json`);
  replaceStrInFile('Lomray-Software/microservices', repoName, `${root}/.github/workflows/build.yml`);

  childProcess.execSync(`cd ${root} && npm ci --ignore-scripts`, { stdio: 'inherit' });

  console.info(chalk.green('Done!'));
}

/**
 * Working with authorization permissions
 */
const runAuthorizationPermissions = async (act, isProd) => {
  let action = act;

  if (!action) {
    const prompt = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Please choose feature: ',
          choices: ['sync', 'export', 'import'],
        },
      ]);

    action = prompt.action;
  }

  let npmCommand;

  switch (action) {
    case 'export':
      npmCommand = 'permissions:export';
      break;

    case 'import':
      npmCommand = 'permissions:import';
      break;

    case 'sync':
      npmCommand = 'permissions:sync';
      break;

    default:
      console.log(chalk.red(`Unrecognized action: ${action}`));
      return;
  }

  console.log(chalk.yellow('Detect microservice running type...'));

  let containerId;

  try {
    containerId = String(childProcess.execSync('docker ps -aqf "name=authorization"')).trim();

    if (containerId) {
      console.log(`Seems like microservice running type is: ${chalk.green('docker')}. Container ID: ${chalk.yellow(containerId)}`);

      childProcess.execSync(`docker exec ${containerId} npm run ${npmCommand}:prod`, { stdio: 'inherit' });

      return;
    }
  } catch (e) {
    if (!e.message.includes('Cannot connect to the Docker')) {
      console.log(`Docker error: ${e}`);
    }

    if (containerId) {
      return;
    }
  }

  console.log(`Seems like microservice running type is: ${chalk.green('node')}.`);

  childProcess.execSync(`cd ${getMsFolder()}/authorization && npm run ${npmCommand}:${isProd ? 'prod' : 'dev'}`, { stdio: 'inherit' });
}

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .addOption(new Option('--only [microservices]', 'apply commands only for provided microservices, e.g. "users authentication authorization"').env('ONLY'))
  .option('--ms-folder [folder]', 'microservices folder', 'microservices')
  .option('--env-path [env-path]', 'microservices environment path', '.env')
  .hook('preAction', (_, actionCommand) => {
    if (['init', 'package-version', 'changed-microservices'].includes(actionCommand.name())) {
      return;
    }

    // Check current directory, it should be project root
    const root = process.cwd();

    if (!fs.existsSync(`${root}/${getMsFolder()}`) || !fs.existsSync(`${root}/package.json`)) {
      console.log(chalk.red('The command must be run from project root directory.'));
      process.exit(1);

      return false;
    }
  });

program.command('update-env')
  .description('Update .env file according chosen environment')
  .argument('<env>', 'environment, e.g. dev, staging, prod')
  .action((env) => {
    runUpdateDotenv(env);
  });

program.command('global-install')
  .description('Run npm install/ci for each microservice')
  .option('--ci', 'run npm "ci" instead "install"', false)
  .action(({ ci }) => {
    runGlobalInstall(ci ? 'ci' : 'i');
  });

program.command('global-update')
  .description('Update provided npm package for each microservice')
  .argument('<package-name>', 'package name')
  .argument('[version]', 'package version', undefined, null)
  .action((packageName, version) => {
    runGlobalUpdate(packageName, version);
  });

program.command('semantic-release')
  .description('Run semantic release for each microservice')
  .option('--dry-run', 'pass dry-run to semantic release', false)
  .action(({ dryRun }) => {
    runSemanticRelease(dryRun);
  });

program.command('lint-staged')
  .description('Run lint staged for each microservice')
  .action(() => {
    runLintStaged();
  });

program.command('build')
  .description('Build microservices')
  .action(() => {
    runBuild();
  });

program.command('test')
  .description('Run test for each microservice')
  .option('--coverage', 'run test with coverage', false)
  .action(({ coverage }) => {
    runTests(coverage);
  });

program.command('ts-check')
  .description('Check typescript for each microservice')
  .action(() => {
    runCheckTypescript();
  });

program.command('lint')
  .description('Run linter for each microservice')
  .option('--fix', 'check and fix problems', false)
  .action(({ fix }) => {
    runLint(fix);
  });

program.command('create')
  .description('Create new microservice')
  .argument('<name>', 'microservice name')
  .option('--staging', 'use staging configuration', false)
  .option('--with-db', 'create new microservice with DB config', false)
  .action((name, { staging, withDb }) => {
    void runCreateMicroservice(name, staging, withDb);
  });

program.command('feature')
  .description('Add or remove some microservice features like support DB etc.')
  .addArgument(new Argument('<name>', 'microservice name'))
  .addArgument(new Argument('<action>', 'action name').choices(['add', 'remove']))
  .option('--staging', 'use staging configuration', false)
  .action((name, action, { staging }) => {
    void runChangeFeature(name, action, { isStaging: staging });
  });

program.command('global-feature')
  .description('Add or remove global features like integration tests etc.')
  .addArgument(new Argument('<action>', 'action name').choices(['add', 'remove']))
  .option('--staging', 'use staging configuration', false)
  .action((action, { staging }) => {
    void runChangeGlobalFeature(action, { isStaging: staging });
  });

program.command('extend')
  .description('Create extended microservice')
  .addArgument(new Argument('<name>', 'microservice name, e.g authorization, users etc.'))
  .option('--staging', 'use staging configuration', false)
  .action((name, { staging }) => {
    void runExtendMicroservice(name, staging);
  });

program.command('changed-microservices')
  .description('Set changed microservices based on git history to Github Actions')
  .addOption(new Option('--files [files]', 'changed files in json format').env('FILES'))
  .action(({ files }) => {
    void runOutputChangedMicroservices(files);
  });

program.command('detect-docker-file')
  .description('Detect microservice docker file')
  .addOption(new Option('--workdir [files]', 'working directory e.g. "microservices/authorization"').env('WORK_DIR'))
  .action(({ workdir }) => {
    void runDetectDockerfile(workdir);
  });

program.command('package-version')
  .description('Get version from package.json')
  .addOption(new Option('--dir [dir]', 'working directory').env('WORK_DIR'))
  .action(({ dir }) => {
    void runOutputPackageVersion(dir);
  });

program.command('permissions')
  .description('Working with permissions in authorization microservice')
  .addArgument(new Argument('[action]', 'permissions action. export - dump from DB to files, sync - get microservices meta and update in schema DB').choices(['sync', 'export', 'import']))
  .option('--is-prod', 'run command in production', false)
  .action((action, { isProd }) => {
    void runAuthorizationPermissions(action, isProd);
  });

program.command('init')
  .description('Initialize new project')
  .argument('<name>', 'project name, e.g. "awesome-api" or "sub-dir/awesome-api"')
  .option('--staging', 'init project from staging config', false)
  .action((name, { staging }) => {
     void runInitProject(name, staging);
  });

program.parse();
