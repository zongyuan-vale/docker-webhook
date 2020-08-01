# 基于 node  lts-alpine 版本镜像，并通过构建阶段命名，将有 node 环境的阶段命名为 build-stage（包含 alpine 的镜像版本相比于 latest 版本更加小巧，更适合作为 docker 镜像使用）
FROM node:lts-alpine as build-stage
# 将工作区设为 /app，和其他系统文件隔离
WORKDIR /app
# 拷贝 package.json/package-lock.json 到容器的 /app 目录
COPY package*.json ./
# 运行 npm install 在容器中安装依赖
RUN npm install
# 拷贝其他文件到容器 /app 目录，分两次拷贝是因为保持 node_modules 一致
COPY . .
# 运行 npm run build 在容器中构建
RUN npm run build

# 多阶段构建
# 将构建分为两个阶段，第一阶段基于 node 镜像，第二阶段基于 nginx 镜像

# 基于 nginx  stable-alpine 版本镜像，并将有 nginx 环境的阶段命名为 production-stage
FROM nginx:stable-alpine as production-stage
# 通过 --form 参数可以引用 build-stage 阶段生成的产物，将其复制到 /usr/share/nginx/html
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Copy容器对外暴露 80 端口
EXPOSE 80
# 容器创建时运行 nginx -g daemon off 命令，一旦 CMD 对应的命令结束，容器就会被销毁，所以通过 daemon off 让 nginx 一直在前台运行
CMD ["nginx", "-g", "daemon off;"]
