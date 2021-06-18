const fs = require('fs');
const { execSync } = require('child_process');

const dir = './seedData/companies';

readDir(dir);

function readDir(directory) {
  fs.readdirSync(directory).forEach((file) => {
    addToDb(`${dir}/${file}`);
  });
}

function addToDb(path) {
  try {
    const script = `sls invoke local -f companies -p ${path}`;
    execSync(script, { stdio: [0, 1, 2] });
  } catch (error) {
    console.info(error);
  }
}
