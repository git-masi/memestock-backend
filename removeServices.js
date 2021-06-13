const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

(async () => {
  const directory = './services/';

  await Promise.all(
    fs.readdirSync(directory).reduce((arr, file) => {
      const isDir = fs.lstatSync(path.resolve(directory, file)).isDirectory();

      if (isDir) {
        arr.push(remove(directory + file));
      }

      return arr;
    }, [])
  );

  function remove(dir) {
    const deployScript = `cd ${dir} && sls remove`;

    console.log(deployScript);

    return exec(deployScript, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`\nstderr: ${stderr}`);
    });
  }
})();
