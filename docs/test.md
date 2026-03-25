# 自动预警系统 - 测试环境与自动化部署 (CI/CD) 指南

> **文档说明**：本指南详细记录了如何在不增加额外云服务器成本的情况下，利用**单机多环境架构**搭建测试环境，并结合 **GitHub Actions** 实现代码提交后的自动化打包与部署。
> **前置条件**：你已经按照 `shangxian.md` 成功部署了正式环境。

---

## 🚀 第一部分：单机配置独立的测试环境

为了保证测试数据不污染正式环境，并且测试代码的运行不影响正式用户，我们需要在同一台服务器上通过**端口和目录**进行隔离。

### 1. 数据库隔离（新建测试库）
1. 在本地电脑使用 Navicat 或 DataGrip 连接至云服务器的 MySQL（3306 端口）。
2. 新建一个数据库，命名为 `warning_system_test`，字符集选 `utf8mb4`。
3. （可选）如果你想基于现有的正式数据进行测试，可以在 Navicat 中直接将 `warning_system` 里的表结构和数据同步到新库中。

### 2. 后端隔离（不同目录与不同端口）
登录云服务器终端，执行以下操作：
```bash
# 1. 复制一份正式环境的代码作为测试环境代码
sudo cp -r /root/samll /root/samll_test

# 2. 进入测试环境后端目录
cd /root/samll_test/backend

# 3. 修改测试环境配置 (修改 .env 文件)
nano .env
```
在 `.env` 中，做两处关键修改：
```env
# 端口改成 3001 (正式环境是 3000)
PORT=3001
# 数据库连测试库
DB_NAME=warning_system_test
```
启动测试版后端守护进程：
```bash
pm2 start server.js --name "warning-api-test"
```

### 3. 前端隔离（Nginx 配置多端口）
我们需要让 Nginx 监听一个新的端口（例如 `8849`）来提供测试版网页。
```bash
# 打开 Nginx 配置文件
sudo nano /etc/nginx/sites-available/default
```
在原有正式环境的 `server { ... }` 块的**下方**，再追加一段测试环境的配置：

```nginx
# --- 下面是新增的测试环境配置 ---
server {
    listen 8849;
    server_name localhost;

    # 测试版前端存放目录
    location / {
        root /var/www/dist_test;  
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # 测试版后端接口代理 (注意这里是 3001 端口)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
保存退出后，创建测试版前端目录并重启 Nginx：
```bash
sudo mkdir -p /var/www/dist_test
sudo chown -R www-data:www-data /var/www/dist_test
sudo nginx -t
sudo nginx -s reload
```
> 💡 **重要**：别忘了去云服务器的网页控制台，在**安全组/防火墙**中放行 **8849** 端口！

---

## 🤖 第二部分：配置 GitHub Actions 自动化部署

传统模式下，你每次修改测试代码都需要自己打包并用 FTP 传到服务器，非常繁琐。现在我们让 GitHub 帮你做这些苦力活。

**最终目标：你在本地 `git push origin test`，服务器上的测试环境就会自动更新！**

### 1. 准备云服务器端自动化脚本
登录云服务器，在测试代码根目录创建一个更新脚本：
```bash
cd /root/samll_test
nano deploy.sh
```
写入以下脚本内容：
```bash
#!/bin/bash
# 确保在测试环境目录
cd /root/samll_test/backend

# 拉取依赖 (防止引入新包时报错)
npm install

# 重启 PM2 中的测试版后端进程
pm2 restart warning-api-test

echo "🚀 后端测试环境部署成功！"
```
赋予脚本可执行权限：
```bash
chmod +x deploy.sh
```

### 2. 配置 GitHub 仓库密钥 (Secrets)
为了让 GitHub 能够安全地连接你的云服务器，需要配置密钥：
1. 登录 GitHub 网页，进入 `samll` 仓库。
2. 点击上方 **Settings** -> 左侧展开 **Secrets and variables** -> 点击 **Actions**。
3. 点击绿色按钮 **New repository secret**，依次添加以下 3 个变量：
   * **`SERVER_HOST`**: 填你的云服务器公网 IP 地址。
   * **`SERVER_USERNAME`**: 填 `root`。
   * **`SERVER_PASSWORD`**: 填你服务器的 root 登录密码。

### 3. 编写本地 GitHub Actions 工作流文件
回到你**本地电脑**的代码编辑器：
1. 在项目根目录下，新建文件夹 `.github/workflows/`。
2. 在该文件夹下新建文件 `deploy-test.yml`，并将以下内容复制进去：

```yaml
name: 自动部署测试环境

# 触发条件：当代码推送到 test 分支时自动执行
on:
  push:
    branches:
      - test

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest # 使用 GitHub 免费提供的云服务器运行

    steps:
      # 1. 拉取你提交的最新代码
      - name: Checkout Code
        uses: actions/checkout@v3

      # 2. 设置 Node.js 环境
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      # 3. 前端安装依赖并打包 (这一步在 GitHub 的服务器上进行，完全不消耗你自己的服务器内存)
      - name: Build Frontend
        run: |
          cd admin
          npm install
          npm run build:pro

      # 4. 把打好的 dist 文件夹通过 SSH 自动传到你的云服务器上
      - name: Deploy Frontend to Server
        uses: appleboy/scp-action@v0.1.4
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          password: ${{ secrets.SERVER_PASSWORD }}
          source: "admin/dist/*"
          target: "/var/www/dist_test" # 传到 Nginx 配置的测试目录下
          strip_components: 2 # 忽略前两层目录结构

      # 5. 让服务器拉取最新后端代码并执行刚才写的重启脚本
      - name: Deploy Backend & Restart
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          password: ${{ secrets.SERVER_PASSWORD }}
          script: |
            cd /root/samll_test
            git pull origin test
            ./deploy.sh
```

### 4. 测试自动化部署流
在本地终端中执行以下 Git 命令：
```bash
# 创建并切换到 test 分支
git checkout -b test

# 提交刚才新增的 .github/workflows 配置文件
git add .
git commit -m "feat: 配置测试环境自动化部署"

# 推送到远程仓库的 test 分支
git push origin test
```

### 🎯 验证成果
1. 打开 GitHub 仓库，点击顶部的 **Actions** 标签页。
2. 你会看到一个黄色的圆圈在转，说明自动化流程正在运行。点击去可以查看实时日志。
3. 大约 1-2 分钟后，变成绿色的对号 ✅。
4. 此时，在浏览器访问 **`http://你的服务器IP:8849`**，就能看到最新部署的测试环境了！

以后任何新功能开发，只需推送到 `test` 分支，即可实现“摸鱼式”全自动发布！