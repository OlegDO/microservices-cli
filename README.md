# CLI for [microservices](https://github.com/Lomray-Software/microservices)

![npm (scoped)](https://img.shields.io/npm/v/@lomray/microservices-cli)
![GitHub](https://img.shields.io/github/license/Lomray-Software/microservices-cli)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

The CLI is a command-line interface tool that helps you to initialize, develop, and maintain your microservices. It embodies best-practice architectural patterns to encourage well-structured apps.

Use `npx @lomray/microservices-cli -h` to view a list of available commands.

### Init new microservices project
```bash
npx @lomray/microservices-cli project-name
```

### Create new microservice
```bash
npx @lomray/microservices-cli create microservice-name
# or
microservices create microservice-name
```

### Create new microservice with DB support
```bash
microservices create microservice-name --with-db
```
