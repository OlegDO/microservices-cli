import fs from 'node:fs';

/**
 * Add new line to begin of file
 */
const prependLineToFile = (filePath, line) => {
  const data = fs
    .readFileSync(filePath, { encoding: 'utf-8' })

  fs.writeFileSync(filePath, `${line}\n${data}`, { encoding: 'utf-8' });
}

export default prependLineToFile;
