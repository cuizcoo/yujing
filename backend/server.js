const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_super_secret_key'; // 在生产环境中应该使用环境变量

// 中间件 - 修复 CORS 问题
app.use(cors({
  origin: 'http://localhost:8848', // 允许你前端 Admin 的域名
  credentials: true // 允许携带凭证 (如果前端设置了 withCredentials: true)
}));
app.use(express.json());

// 模拟用户数据库
const users = [
  { id: 1, username: 'admin', password: 'e10adc3949ba59abbe56e057f20f883e', role: 'admin' }, // e10adc3949ba59abbe56e057f20f883e 是 123456 的 md5，Geeker-Admin 默认前端会 md5 加密密码
  { id: 2, username: 'user', password: 'e10adc3949ba59abbe56e057f20f883e', role: 'user' }
];

// 模拟的减压井数据库数据 (之前在前端写死的，现在移到后端)
const pressureWellData = [
  { waterLevel: 1, year1: 5, year3: 4, yearI: 3, decay: 2, decayRate: 0.4 },
  { waterLevel: 2, year1: 7, year3: 6, yearI: 5, decay: 2, decayRate: 0.2857 },
  { waterLevel: 3, year1: 8, year3: 8, yearI: 7, decay: 1, decayRate: 0.125 },
  { waterLevel: 4, year1: 10, year3: 9, yearI: 8, decay: 2, decayRate: 0.2 },
  { waterLevel: 5, year1: 15, year3: 13, yearI: 11, decay: 4, decayRate: 0.2667 },
  { waterLevel: 6, year1: 20, year3: 18, yearI: 16, decay: 4, decayRate: 0.2 },
  { waterLevel: 7, year1: 25, year3: 24, yearI: 19, decay: 6, decayRate: 0.24 },
  { waterLevel: 8, year1: 30, year3: 28, yearI: 23, decay: 7, decayRate: 0.2333 },
  { waterLevel: 9, year1: 36, year3: 35, yearI: 26, decay: 10, decayRate: 0.2778 },
  { waterLevel: 10, year1: 40, year3: 38, yearI: 30, decay: 10, decayRate: 0.25 }
];

// --- 登录接口 ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // 签发 JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '24h' } // token 有效期 24 小时
    );
    
    res.json({
      code: 200,
      msg: '登录成功',
      data: {
        access_token: token
      }
    });
  } else {
    res.json({
      code: 500,
      msg: '账号或密码错误',
      data: null
    });
  }
});

// --- 获取动态菜单接口 ---
// Geeker-Admin 在登录后会请求这个接口获取用户有权限的菜单
app.get('/menu/list', (req, res) => {
  // 这里为了演示，直接返回我们在前面修改好的简简版菜单数据
  // 实际开发中可以根据 req.headers.authorization 解析出的角色(role)来动态返回不同的菜单
  res.json({
    code: 200,
    msg: "成功",
    data: [
      {
        path: "/home/index",
        name: "home",
        component: "/home/index",
        meta: {
          icon: "HomeFilled",
          title: "首页",
          isLink: "",
          isHide: false,
          isFull: false,
          isAffix: true,
          isKeepAlive: true
        }
      },
      {
        path: "/pressure-well/index",
        name: "pressure-well",
        component: "/pressure-well/index",
        meta: {
          icon: "Histogram",
          title: "减压井状态诊断",
          isLink: "",
          isHide: false,
          isFull: false,
          isAffix: false,
          isKeepAlive: true
        }
      }
    ]
  });
});


// 鉴权中间件 (用于保护需要登录才能访问的接口)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  const token = authHeader && authHeader.startsWith('Bearer') ? authHeader.split(' ')[1] : authHeader;

  if (!token) return res.json({ code: 401, msg: '未提供鉴权 Token' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.json({ code: 403, msg: 'Token 已失效或不合法' });
    req.user = user;
    next();
  });
};

// --- 获取减压井监测数据的接口 (添加了鉴权保护) ---
app.get('/pressure-well/data', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    msg: 'success',
    data: pressureWellData
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
