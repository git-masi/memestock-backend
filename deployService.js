const process = require('process');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const directory = './services/';
const args = process.argv.slice(2);
const serviceName = args[0];
const profile = args[1];
const env = args[2] ?? 'dev';
let serviceIsValid = false;

if (serviceName === 'all') {
  fs.readdirSync(directory).forEach((file) => {
    const isDir = fs.lstatSync(path.resolve(directory, file)).isDirectory();
    if (isDir && file.endsWith('-service')) {
      deploy(directory + file);
    }
  });
  return;
}

readDir(directory);

if (serviceIsValid) {
  deploy(directory + serviceName);
}

function readDir(directory) {
  fs.readdirSync(directory).forEach((file) => {
    const isDir = fs.lstatSync(path.resolve(directory, file)).isDirectory();
    const dirNameIsMatch = file.startsWith(serviceName);
    if (isDir && dirNameIsMatch) {
      serviceIsValid = true;
    }
  });
}

function deploy(dir) {
  const awsProfile = profile ? `export AWS_PROFILE=${profile} &&` : '';
  const deployScript = `cd ${dir} && ${awsProfile} sls deploy -s ${env} -l`;
  execSync(deployScript, { stdio: [0, 1, 2] });

  // exec(deployScript, (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`exec error: ${error}`);
  //     return;
  //   }
  //   console.log(`stdout: ${stdout}`);
  //   console.error(`\nstderr: ${stderr}`);
  // });
}
