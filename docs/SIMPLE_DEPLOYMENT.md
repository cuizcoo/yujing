# 自动预警系统 - 极简个人学习版部署指南

> ⏱️ **预计耗时**: < 5 分钟  
> 🎯 **适用场景**: 个人学习、毕设演示、低流量快速验证  
> 💡 **核心思想**: 零配置、一条命令、快速跑通

---

## 🚀 1. 极简部署步骤 (核心 5 行命令)

如果你有一台基础的云服务器（如阿里云 2核2G）或本地虚拟机，只需执行以下命令即可完成部署：

```bash
# 1. 拉取代码并进入项目目录
git clone https://github.com/your-repo/samll.git && cd samll

# 2. 安装全局依赖 (如未安装)
npm install -g pnpm pm2

# 3. 启动后端服务 (守护进程模式，断开SSH不停止)
cd backend && npm install && pm2 start server.js --name "warning-api"

# 4. 构建前端并启动轻量级静态服务
cd ../admin && pnpm install && pnpm run build:pro
npx serve -s dist -p 8848
```

🎉 **至此，系统已上线！** 
- 前端访问：`http://服务器IP:8848`
- 后端接口：`http://服务器IP:3000`

---

## ⚙️ 2. 最小化环境变量设置

只需要修改一个文件即可连接你本地或服务器的 MySQL。
修改 `backend/.env`：

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=warning_system
```
> *注：首次运行后端前，切记执行一次 `node init_db.js` 创建数据库和初始假数据。*

---

## ✅ 3. 上线极简检查清单

部署完别急着走，花 30 秒检查这三点：

1. **端口放行**：云服务器的【安全组】里，是否已经放行了 `8848` (前端) 和 `3000` (后端) 端口？
2. **接口连通性**：浏览器按 `F12` 打开控制台，登录时是否提示接口跨域或 502？(如后端和前端不在同一台机器，需修改 `admin/.env.production` 中的 `VITE_API_URL` 为后端真实IP)。
3. **日志查看**：后端报错了怎么办？输入 `pm2 logs warning-api` 即可实时查看错误堆栈。

---

## ⏪ 4. 极速回滚方案

一个人写代码，最稳妥的回滚方式就是**基于 Git 的分支管理**：

1. 每次上线前，把稳定的代码打个 Tag 或留在 `main` 分支。
2. **搞砸了想回滚？只需 2 行命令**：
   ```bash
   git reset --hard HEAD^  # 代码强制退回到上一个提交
   pm2 restart warning-api # 重启后端生效
   ```
   *(前端则重新执行一遍 `pnpm run build:pro` 即可)*

---

## ☁️ 附：零服务器成本部署 (Vercel / Netlify)

如果你连服务器都不想买，可以将前端静态页面托管到 **Vercel** 免费层：
1. 注册 Vercel 账号并关联 GitHub。
2. 导入本项目，设置 `Build Command` 为 `npm run build:pro`，`Output Directory` 为 `dist`。
3. 点击 Deploy，1 分钟后自动分配免费域名上线！
*(注：此方案后端 Node.js 和 MySQL 仍需要找地方运行，可考虑 Render 免费容器 + PlanetScale 免费数据库)*