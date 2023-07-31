import fs from 'node:fs';

/**
 * Add new line to end of file
 */
const appendLineToFile = (filePath, line) => {
  fs.appendFileSync(filePath, `${line}\n`);
}

export default appendLineToFile;
