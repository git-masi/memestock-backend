const process = require('process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const directory = './services/';
const args = process.argv.slice(2);
const serviceName = args[0];
const profile = args[1];
let serviceIsValid = false;

readDir(directory);

if (serviceIsValid) runService(directory + serviceName);

function readDir(directory) {
  fs.readdirSync(directory).forEach((file) => {
    const isDir = fs.lstatSync(path.resolve(directory, file)).isDirectory();
    const dirNameIsMatch = file.startsWith(serviceName);
    if (isDir && dirNameIsMatch) {
      serviceIsValid = true;
    }
  });
}

function runService(dir) {
  const awsProfile = profile ? `export AWS_PROFILE=${profile} &&` : '';
  console.log(process.cwd());
  const deployScript = `${awsProfile} npm --prefix ${dir} run start`;

  execSync(deployScript, { stdio: [0, 1, 2] });
}
