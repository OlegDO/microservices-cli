import fs from 'node:fs';

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

export default findFile;
