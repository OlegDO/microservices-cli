#!/usr/bin/env node
import { program } from './src/command.js';

// import all commands
import './src/commands/build.js';
import './src/commands/change-feature.js';
import './src/commands/create-ms.js';
import './src/commands/detect-dockerfile.js';
import './src/commands/extend-ms.js';
import './src/commands/github-changed-microservices.js';
import './src/commands/global-feature.js';
import './src/commands/global-install.js';
import './src/commands/global-update.js';
import './src/commands/init-project.js';
import './src/commands/lint.js';
import './src/commands/lint-staged.js';
import './src/commands/package-version.js';
import './src/commands/patch-package-version.js';
import './src/commands/permissions.js';
import './src/commands/semantic-release.js';
import './src/commands/test.js';
import './src/commands/ts-check.js';
import './src/commands/update-env.js';

program.parse();
