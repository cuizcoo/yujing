# 自动预警系统 - 完整上线操作说明书 (避坑版)

> 这是一份为低配云服务器（如 Ubuntu 系统）量身定制的部署指南。
> 只要严格按照以下步骤复制粘贴，即可在 10 分钟内完成前后端分离项目的完美上线。

---

## 第一阶段：准备工作与环境安装（在云服务器执行）

**1. 连接服务器并更新软件源**
```bash
ssh root@你的服务器IP
sudo apt update
```

**2. 安装必备环境 (Node.js, Git, Nginx, MySQL)**
```bash
# 安装 Git 和 Nginx
sudo apt install -y curl git nginx

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装全局进程管理工具 PM2
sudo npm install -g pm2

# 安装并启动 MySQL
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

---

## 第二阶段：后端部署与数据库初始化（在云服务器执行）

**1. 拉取代码**
```bash
cd ~
git clone https://github.com/你的用户名/samll.git
cd samll/backend
```

**2. 配置数据库密码**
```bash
# 设置 MySQL 的 root 密码为 123456
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456'; FLUSH PRIVILEGES;"

# 修改代码中的 .env 密码配置
sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=123456/g" .env
```

**3. 初始化数据库并启动后端**
```bash
npm install
node init_db.js
pm2 start server.js --name "warning-api"
```
*(执行 `pm2 status` 看到 `warning-api` 是绿色的 online 就说明后端成功了)*

---

## 第三阶段：前端打包与上传（在你的本地电脑执行）

> ⚠️ **避坑指南**：切勿在低配云服务器上执行打包，会卡死！

**1. 本地打包构建**
在你自己电脑的终端里进入项目 `admin` 目录：
```bash
npm install
npm run build:pro
```
*(执行完毕后，`admin` 目录下会生成一个 `dist` 文件夹)*

**2. 将 dist 上传至云服务器**
使用 FTP 工具（FileZilla/FinalShell）或通过命令行：
```bash
# 将本地的 dist 文件夹传到服务器的 /var/www/ 目录下
scp -r dist root@你的服务器IP:/var/www/
```

---

## 第四阶段：配置 Nginx 与权限（回到云服务器执行）

**1. 解决 Nginx 权限报错 (500 Error 杀手)**
将刚刚上传的 `dist` 文件夹的所有权交给 Nginx：
```bash
sudo chown -R www-data:www-data /var/www/dist/
```

**2. 写入 Nginx 代理配置**
直接复制下面这整段代码并在终端回车（它会覆盖默认配置并解决前端 404 和跨域问题）：
```bash
sudo bash -c 'cat > /etc/nginx/sites-available/default << "EOF"
server {
    listen 8848;
    server_name localhost;

    # 代理前端页面
    location / {
        root /var/www/dist; 
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # 代理后端接口
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF'
```

**3. 重启 Nginx**
```bash
sudo nginx -t
sudo nginx -s reload
```

---

## 第五阶段：开放防火墙（在网页控制台执行）

**这是最重要的一步（解决网站拒绝连接 ERR_CONNECTION_REFUSED）**：
1. 登录你的阿里云/腾讯云控制台。
2. 找到该服务器的 **“安全组”** 或 **“防火墙”**。
3. 添加入方向规则，放行 **`8848`** 端口（协议 TCP，源 IP `0.0.0.0/0`）。

🎉 **大功告成！** 
现在在浏览器输入 `http://你的服务器IP:8848`，你就能看到完美运行的系统了！

---

## 附录：后续日常更新代码怎么操作？

以后修改了代码想要发布新版本，不需要从头再来，根据你修改的内容分为两种情况：

### 情况 1：只修改了前端代码（Vue 页面、样式等）
**完全不需要在服务器上拉取 Git 代码！**
1. 在本地电脑改代码。
2. 在本地电脑执行 `npm run build:pro`。
3. 把生成的 `dist` 文件夹通过 FTP 工具直接上传并覆盖到服务器的 `/var/www/dist` 目录下。
**结束。刷新浏览器即可看到最新页面。**

### 情况 2：修改了后端代码（`server.js`，写了新接口）
**这种情况下，需要在服务器上拉取 Git 代码！**
1. 在本地电脑改完后端代码，推送到 GitHub (`git push`)。
2. 登录服务器，进入代码目录拉取最新代码：
   ```bash
   cd /root/samll
   git pull origin main
   ```
3. 重启后端服务让新代码生效：
   ```bash
   pm2 restart warning-api
   ```
*(注：如果你的新接口引入了新的 `npm` 包，在 `pm2 restart` 之前记得在 `backend` 目录下执行一次 `npm install`)*

### 情况 3：修改了数据库（加了新表或新字段）
**绝对不能再执行 `node init_db.js`，否则会清空现有数据！**
最安全的做法是使用你电脑上的可视化工具（Navicat/DataGrip）直连服务器进行修改：
1. 确保你已经放行了云服务器的 **3306** 端口，并且设置了 MySQL 允许外部连接（详见数据库查看教程）。
2. 在本地 Navicat 中连接到服务器的 MySQL。
3. 像在本地开发一样，直接右键点击表，选择“设计表”来添加字段，或者直接执行 `CREATE TABLE` 的 SQL 语句。
*(注：数据库结构的修改通常要配合后端代码的修改，所以改完表结构后，记得按照【情况 2】重启一下后端代码)*