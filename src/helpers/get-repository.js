import http from 'node:https';
import path from 'node:path';
import fse from 'fs-extra';
import unzip from 'unzipper';

/**
 * Download repository
 */
const downloadRepo = (url, dest, cb) => {
  http.get(url, (response) => {
    response.pipe(
      unzip.Extract({ path: dest })
        .on('finish', () => {
          // hard fix, be sure all files extracted
          setTimeout(cb, 500);
        })
        .on('error', (e) => cb(e))
    )
  }).on('error', function (err) {
    fse.removeSync(dest);

    if (cb) {
      cb(err.message);
    }
  });
}

/**
 * Unzip to provided folder
 */
const getRepository = (params, dest) => {
  const { user, repo, ref } = params;
  const outTemp = path.resolve('./temp-download');
  const url = `https://codeload.github.com/${user}/${repo}/zip/refs/heads/${ref}`;

  return new Promise((resolve, reject) => {
    downloadRepo(url, outTemp, (error) => {
      if (error) {
        return reject(error);
      }

      if (fse.pathExistsSync(dest)) {
        fse.removeSync(dest);
      }

      fse.moveSync(`${outTemp}/${repo}-${ref}`, dest, { overwrite: true });
      fse.removeSync(outTemp);

      resolve();
    });
  })
}

export default getRepository;
