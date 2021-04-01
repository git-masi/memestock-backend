const process = require('process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const directory = './services/';
const enableRead = ['src', 'handlers'];
const args = process.argv.slice(2);
const fnName = args[0];
const profile = args[1];
const env = args[2] ?? 'dev';
let fnDir = '';

if (fnName) readDir(directory);

if (fnDir) {
  const wd = process.cwd();
  const pathToLambda = fnDir.replace(wd, '');
  const changeDirTo = '.' + pathToLambda.match(/\/\w+\/[\w-_]+/)[0];
  deploy(changeDirTo);
}

function readDir(directory) {
  fs.readdirSync(directory).forEach((file) => {
    if (fs.lstatSync(path.resolve(directory, file)).isDirectory()) {
      // console.log('Directory: ' + file);
      if (file.endsWith('-service') || enableRead.includes(file))
        readDir(`${directory}/${file}`);
    } else {
      // console.log('File: ' + file);
      if (file.startsWith(fnName)) fnDir = path.resolve(directory, file);
    }
  });
}

function deploy(dir) {
  const awsProfile = profile ? `export AWS_PROFILE=${profile} &&` : '';
  const deployScript = `cd ${dir} && ${awsProfile} sls deploy -s ${env} -f ${fnName} -l`;
  execSync(deployScript, { stdio: [0, 1, 2] });
}
