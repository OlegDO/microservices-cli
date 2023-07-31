import fs from 'node:fs';

/**
 * Replace string in file
 */
const replaceStrInFile = (subj, replaceValue, file) => {
  const data = fs
    .readFileSync(file, { encoding: 'utf-8' })
    .replace(new RegExp(subj, 'g'), replaceValue);

  fs.writeFileSync(file, data, { encoding: 'utf-8' });
};

export default replaceStrInFile;
