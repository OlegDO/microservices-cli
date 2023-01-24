#!/usr/bin/env node
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const { Command, Option, Argument } = require('commander');
const inquirer = require('inquirer');
const github = require('@actions/core');
const GhDownload = require('github-download');
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

    await new Promise((resolve, reject) => {
      GhDownload(getGithubParams(isStaging), path)
        .on('end', () => {
          resolve(true);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  } catch (err) {
    console.info(chalk.red(`Failed to download configuration: ${err.message}`));

    return;
  }

  console.info(chalk.green('Downloaded.'));
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
  fileNames.forEach((fileName) => {
    const file = folder ? `${folder}/${fileName}` : fileName;
    if (fs.existsSync(file)) {
      return file;
    }
  });

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
  const folder = './configs';
  const middlewaresFile = findFile([`middlewares.${env}.json`, 'middlewares.json'], folder);
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

  const middlewares = JSON.stringify(
    JSON.parse(fs.readFileSync(middlewaresFile, { encoding: 'utf8' })),
  );
  const configs = JSON.stringify(JSON.parse(fs.readFileSync(configFile, { encoding: 'utf8' })));
  const dotenv = fs
    .readFileSync(dotenvFile, { encoding: 'utf8' })
    .replace(/MS_INIT_MIDDLEWARES=.*/, `MS_INIT_MIDDLEWARES='${middlewares}'`)
    .replace(/MS_INIT_CONFIGS=.*/, `MS_INIT_CONFIGS='${configs}'`);

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
 * Create microservice feature
 */
const runChangeFeature = async (name, action, isStaging) => {
  const msPath = `${getMsFolder()}/${name}`;
  const msSrcPath = `${getMsFolder()}/${name}/src`;
  // const tempPath = `${getMsFolder()}/${name}/temp`;

  const { feature } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'feature',
        message: 'Please choose feature: ',
        choices: ['none', 'db'],
      },
    ]);

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
          replaceStrInFile('// dbOptions:', 'dbOptions:', `${msSrcPath}/config/start.ts`);
          replaceStrInFile('// GetDbConfig,', 'GetDbConfig,', `${msSrcPath}/config/start.ts`);
          replaceStrInFile('start }', 'startWithDb }', `${msSrcPath}/index.ts`);
          replaceStrInFile('default start', 'default startWithDb', `${msSrcPath}/index.ts`);
        } else {
          replaceStrInFile('withDb: true', 'withDb: false', `${msSrcPath}/constants/index.ts`);
          replaceStrInFile('dbOptions:', '// dbOptions:', `${msSrcPath}/config/start.ts`);
          replaceStrInFile('GetDbConfig,', '// GetDbConfig,', `${msSrcPath}/config/start.ts`);
          replaceStrInFile('startWithDb }', 'start }', `${msSrcPath}/index.ts`);
          replaceStrInFile('default startWithDb', 'default start', `${msSrcPath}/index.ts`);
        }
        break;
    }
  } catch (e) {
    console.log(`Failed ${action} feature ${chalk.red(feature)}: ${e.message}`);

    return;
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

  await downloadRepo(tempPath, isStaging)

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
    await runChangeFeature('db', 'add', isStaging);
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
  const msSrcPath = `${msFolder}/${name}/src`;
  const tempPath = `${msFolder}/${name}/temp`;
  const targetMsPath = `${tempPath}/microservices/${name}`;

  if (fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" already exists!`);

    return;
  }

  const { type } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Please choose type: ',
        choices: ['docker', 'package'],
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
        fs.appendFileSync(`${msPath}/Dockerfile`, 'COPY ./permissions $WEB_PATH/lib/migrations/permissions/list\n');
        fs.appendFileSync(`${msPath}/Dockerfile`, 'COPY ./lib/package.json.js $WEB_PATH/lib/package.json.js\n');
      } else {
        replaceStrInFile('authorization', name, `${msPath}/Dockerfile`);
        replaceStrInFile('authorization', name, `${msPath}/package.json`);
        replaceStrInFile('sync:permissions', 'lint:format', `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/sync.js', '', `${msPath}/package.json`);
        replaceStrInFile('authorization', name, `${msPath}/package-lock.json`);
        replaceStrInFile('authorization', name, `${msPath}/README.md`);
      }

      break;

    case 'package':
      fse.copySync(`${tempPath}/template/new/__helpers__`, `${msPath}/__helpers__`, {});
      fse.copySync(`${tempPath}/template/new/__tests__/index-test.ts`, `${msPath}/__tests__/index-test.ts`, {});
      fse.copySync(`${tempPath}/template/package`, msPath, {});
      fse.copySync(`${targetMsPath}/src/index.ts`, `${msPath}/src/index.ts`, {});

      const files = fs.readdirSync(`${tempPath}/template/new`);

      files.forEach((file) => {
        const filePath = path.resolve(`${tempPath}/template/new/${file}`);

        if (fs.lstatSync(filePath).isFile()) {
          fse.copySync(filePath, `${msPath}/${file}`, {});
        }
      });

      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/constants/index.ts`);
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/config/start.ts`);

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
  let promptAction = '';

  if (!act) {
    const prompt = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Please choose feature: ',
          choices: ['export', 'sync'],
        },
      ]);

    promptAction = prompt.action;
  }

  const action = act || promptAction;
  let npmCommand;

  switch (action) {
    case 'export':
      npmCommand = 'permissions:export';
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
    void runChangeFeature(name, action, staging);
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

program.command('package-version')
  .description('Get version from package.json')
  .addOption(new Option('--dir [dir]', 'working directory').env('WORK_DIR'))
  .action(({ dir }) => {
    void runOutputPackageVersion(dir);
  });

program.command('permissions')
  .description('Working with permissions in authorization microservice')
  .addArgument(new Argument('[action]', 'permissions action. export - dump from DB to files, sync - get microservices meta and update in schema DB').choices(['export', 'sync']))
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
