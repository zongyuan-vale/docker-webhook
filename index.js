const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 递归删除目录
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file) {
      const curPath = path + '/' + file;
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

const resolvePost = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      console.log('chunk --- ', chunk);
      body += chunk;
    });
    req.on('end', () => {
      try {
        let res = decodeURIComponent(body);
        if (res.startsWith('payload=')) {
          resolve(JSON.parse(res.split('payload=')[1]));
        } else {
          resolve(JSON.parse(body));
        }
      } catch (error) {
        reject(new Error('无法处理的返回值'));
      }
    });
  });

http
  .createServer(async (req, res) => {
    console.log('receive request');
    console.log('url', req.url);
    if (req.method === 'POST' && req.url === '/') {
      const data = await resolvePost(req);

      if (!data || !data.repository) {
        res.end(data.message);
      }

      console.log('resolvePost --- ', data);
      const projectDir = path.resolve(`./${data.repository.name}`);
      deleteFolderRecursive(projectDir);

      // 拉取仓库最新代码
      execSync(
        `git clone https://github.com/zongyuan-vale/${data.repository.name}.git ${projectDir}`,
        {
          stdio: 'inherit',
        }
      );

      // 复制 Dockerfile 到项目目录
      // fs.copyFileSync(
      //   path.resolve(`./Dockerfile`),
      //   path.resolve(projectDir, './Dockerfile')
      // );

      // 复制 .dockerignore 到项目目录
      // fs.copyFileSync(
      //   path.resolve(__dirname, `./.dockerignore`),
      //   path.resolve(projectDir, './.dockerignore')
      // );

      // 创建 docker 镜像
      execSync(`docker build . -t ${data.repository.name}-image:latest `, {
        stdio: 'inherit',
        cwd: projectDir,
      });

      // 销毁 docker 容器
      execSync(
        `docker ps -a -f "name=^${data.repository.name}-container" --format="{{.Names}}" | xargs -r docker stop | xargs -r docker rm`,
        {
          stdio: 'inherit',
        }
      );

      // 创建 docker 容器
      execSync(
        `docker run -d -p 8888:80 --name ${data.repository.name}-container  ${data.repository.name}-image:latest`,
        {
          stdio: 'inherit',
        }
      );

      console.log('deploy success');
      res.end('ok');
    }
  })
  .listen(3000, () => {
    console.log('server is ready');
  });
