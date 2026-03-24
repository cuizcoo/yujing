const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_super_secret_key';

app.use(cors({
  origin: 'http://localhost:8848',
  credentials: true
}));
app.use(express.json());

// 日志中间件
const logOperation = (actionDesc) => (req, res, next) => {
  const originalSend = res.json;
  res.json = function (body) {
    if (req.user && body.code === 200) {
      pool.query(
        'INSERT INTO operation_log (operator, action, time) VALUES (?, ?, NOW())',
        [req.user.username, actionDesc]
      ).catch(err => console.error('Failed to log operation:', err));
    }
    originalSend.call(this, body);
  };
  next();
};

// --- 登录接口 ---
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.query(
      'SELECT * FROM sys_user WHERE username = ? OR phone = ?',
      [username, username]
    );
    
    const user = users[0];
    
    if (user) {
      // 验证密码哈希
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.json({ code: 500, msg: '账号或密码错误', data: null });
      }

      if (user.status === 0) {
        return res.json({ code: 403, msg: '账号已被禁用', data: null });
      }

      await pool.query('UPDATE sys_user SET lastLoginTime = NOW() WHERE id = ?', [user.id]);
      
      const token = jwt.sign(
        { id: user.id, username: user.username, roleIds: user.roleIds },
        SECRET_KEY,
        { expiresIn: '24h' }
      );
      
      res.json({ 
        code: 200, 
        msg: '登录成功', 
        data: { 
          access_token: token,
          userInfo: {
            id: user.id,
            username: user.username,
            name: user.name, // 添加 name 字段返回给前端
            phone: user.phone
          }
        } 
      });
    } else {
      res.json({ code: 500, msg: '账号或密码错误', data: null });
    }
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// 鉴权中间件
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

// --- 获取动态菜单接口 ---
app.get('/menu/list', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM sys_user WHERE id = ?', [req.user.id]);
    const user = users[0];
    if (!user) return res.json({ code: 404, msg: '用户不存在' });

    const [roles] = await pool.query('SELECT * FROM sys_role');
    
    // Parse JSON roleIds from string if necessary
    const userRoleIds = typeof user.roleIds === 'string' ? JSON.parse(user.roleIds) : user.roleIds;
    
    const userRoles = roles.filter(r => userRoleIds.includes(r.id));
    
    let userPermissions = [];
    userRoles.forEach(r => {
      const perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
      userPermissions.push(...perms);
    });
    userPermissions = [...new Set(userPermissions)];

    const allMenus = [
      {
        path: "/home/index",
        name: "home",
        component: "/home/index",
        meta: { icon: "HomeFilled", title: "首页", isLink: "", isHide: false, isFull: false, isAffix: true, isKeepAlive: true }
      },
      {
        path: "/system",
        name: "system",
        redirect: "/system/roleManage",
        meta: { icon: "Setting", title: "权限管理", isLink: "", isHide: false, isFull: false, isAffix: false, isKeepAlive: true },
        children: [
          {
            path: "/system/roleManage",
            name: "roleManage",
            component: "/system/roleManage/index",
            meta: { icon: "UserFilled", title: "角色管理", isLink: "", isHide: false, isFull: false, isAffix: false, isKeepAlive: true }
          },
          {
            path: "/system/userManage",
            name: "userManage",
            component: "/system/userManage/index",
            meta: { icon: "Avatar", title: "用户管理", isLink: "", isHide: false, isFull: false, isAffix: false, isKeepAlive: true }
          }
        ]
      },
      {
        path: "/pressure-well/index",
        name: "pressure-well",
        component: "/pressure-well/index",
        meta: { icon: "Histogram", title: "减压井状态诊断", isLink: "", isHide: false, isFull: false, isAffix: false, isKeepAlive: true }
      }
    ];

    const filterMenus = (menus) => {
      return menus.filter(menu => {
        if (!userPermissions.includes(menu.name)) return false;
        if (menu.children) {
          menu.children = filterMenus(menu.children);
        }
        return true;
      });
    };

    const isSuperAdmin = userRoleIds.includes(1);
    const authMenus = isSuperAdmin ? allMenus : filterMenus(allMenus);

    res.json({ code: 200, msg: "成功", data: authMenus });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// --- 获取减压井监测数据的接口 ---
app.get('/pressure-well/data', authenticateToken, logOperation('获取减压井数据'), async (req, res) => {
  try {
    const [data] = await pool.query('SELECT * FROM pressure_well ORDER BY waterLevel ASC');
    res.json({ code: 200, msg: 'success', data });
  } catch (error) {
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// --- 角色管理接口 ---
app.get('/system/role/list', authenticateToken, logOperation('查询角色列表'), async (req, res) => {
  try {
    const { roleName = '', startTime, endTime, pageNum = 1, pageSize = 20 } = req.query;
    
    let sql = 'SELECT * FROM sys_role WHERE 1=1';
    const params = [];
    
    if (roleName) {
      sql += ' AND roleName LIKE ?';
      params.push(`%${roleName}%`);
    }
    if (startTime) {
      sql += ' AND createTime >= ?';
      params.push(startTime);
    }
    if (endTime) {
      sql += ' AND createTime <= ?';
      params.push(endTime);
    }
    
    sql += ' ORDER BY createTime DESC';
    
    const [allRoles] = await pool.query(sql, params);
    
    // Parse JSON
    const parsedRoles = allRoles.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions
    }));
    
    const total = parsedRoles.length;
    const list = parsedRoles.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({ code: 200, msg: 'success', data: { list, total, pageNum, pageSize } });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.post('/system/role/add', authenticateToken, logOperation('新增角色'), async (req, res) => {
  try {
    const { roleName, roleDesc, permissions } = req.body;
    if (!roleName || !permissions || permissions.length === 0) {
      return res.json({ code: 400, msg: '角色名称和权限不能为空' });
    }
    
    const [existing] = await pool.query('SELECT id FROM sys_role WHERE roleName = ?', [roleName]);
    if (existing.length > 0) return res.json({ code: 400, msg: '角色名称已存在' });
    
    await pool.query(
      'INSERT INTO sys_role (roleName, roleDesc, permissions, createTime, updateTime) VALUES (?, ?, ?, NOW(), NOW())',
      [roleName, roleDesc, JSON.stringify(permissions)]
    );
    res.json({ code: 200, msg: '新增成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.put('/system/role/update', authenticateToken, logOperation('修改角色'), async (req, res) => {
  try {
    const { id, roleName, roleDesc, permissions } = req.body;
    
    const [existing] = await pool.query('SELECT id FROM sys_role WHERE roleName = ? AND id != ?', [roleName, id]);
    if (existing.length > 0) return res.json({ code: 400, msg: '角色名称已存在' });
    
    await pool.query(
      'UPDATE sys_role SET roleName = ?, roleDesc = ?, permissions = ?, updateTime = NOW() WHERE id = ?',
      [roleName, roleDesc, JSON.stringify(permissions), id]
    );
    res.json({ code: 200, msg: '修改成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.delete('/system/role/delete', authenticateToken, logOperation('删除角色'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.json({ code: 400, msg: '未选择要删除的角色' });

    // 校验是否有关联用户
    const [users] = await pool.query('SELECT roleIds FROM sys_user');
    for (let id of ids) {
      for (let u of users) {
        const uRoleIds = typeof u.roleIds === 'string' ? JSON.parse(u.roleIds) : u.roleIds;
        if (uRoleIds.includes(id)) {
          return res.json({ code: 400, msg: `有角色仍有关联用户，禁止删除` });
        }
      }
    }
    
    // 修复 IN 查询参数化
    if (ids.length > 0) {
      await pool.query('DELETE FROM sys_role WHERE id IN (?)', [ids]);
    }
    res.json({ code: 200, msg: '删除成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// --- 用户管理接口 ---
app.get('/system/user/list', authenticateToken, logOperation('查询用户列表'), async (req, res) => {
  try {
    const { phone = '', name = '', status = '', roleId = '', pageNum = 1, pageSize = 20 } = req.query;
    
    let sql = 'SELECT * FROM sys_user WHERE 1=1';
    const params = [];
    
    if (phone) {
      sql += ' AND phone LIKE ?';
      params.push(`%${phone}%`);
    }
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (status !== '') {
      sql += ' AND status = ?';
      params.push(Number(status));
    }
    
    sql += ' ORDER BY createTime DESC';
    
    const [allUsers] = await pool.query(sql, params);
    
    // Parse JSON and filter by roleId if needed
    let parsedUsers = allUsers.map(u => {
      const { password, ...userInfo } = u;
      userInfo.roleIds = typeof userInfo.roleIds === 'string' ? JSON.parse(userInfo.roleIds) : userInfo.roleIds;
      return userInfo;
    });

    if (roleId !== '') {
      parsedUsers = parsedUsers.filter(u => u.roleIds.includes(Number(roleId)));
    }
    
    const total = parsedUsers.length;
    const list = parsedUsers.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({ code: 200, msg: 'success', data: { list, total, pageNum, pageSize } });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.post('/system/user/add', authenticateToken, logOperation('新增用户'), async (req, res) => {
  try {
    const { phone, name, password, status, roleIds } = req.body;
    if (!phone || !name || !password || roleIds.length === 0) {
      return res.json({ code: 400, msg: '必填字段不能为空' });
    }
    
    const [existing] = await pool.query('SELECT id FROM sys_user WHERE phone = ?', [phone]);
    if (existing.length > 0) return res.json({ code: 400, msg: '手机号已存在' });
    
    // 使用 bcrypt 加密密码 (注意：新增用户时前端可能传来的是明文，我们需要先确认前端是否做了 MD5)
    // 根据系统现状，前端只有登录做了 MD5，新增用户发的是明文，所以这里直接对明文做哈希会有问题。
    // 为了和登录逻辑匹配（登录时前端发 md5），我们在新增和修改密码时，也必须确保密码是被 md5 处理过的状态再 bcrypt。
    // 在 Node.js 中使用 crypto 模块模拟前端的 md5：
    const crypto = require('crypto');
    const md5Password = crypto.createHash('md5').update(password).digest('hex');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(md5Password, salt);
    
    await pool.query(
      'INSERT INTO sys_user (username, phone, name, password, status, roleIds, createTime) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [phone, phone, name, hashedPassword, Number(status), JSON.stringify(roleIds)]
    );
    res.json({ code: 200, msg: '新增成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.put('/system/user/update', authenticateToken, logOperation('修改用户'), async (req, res) => {
  try {
    const { id, phone, name, status, roleIds, password } = req.body;
    
    const [existing] = await pool.query('SELECT id FROM sys_user WHERE phone = ? AND id != ?', [phone, id]);
    if (existing.length > 0) return res.json({ code: 400, msg: '手机号已存在' });
    
    if (password) {
      // 使用 bcrypt 加密密码 (和新增同理，先做一次 md5)
      const crypto = require('crypto');
      const md5Password = crypto.createHash('md5').update(password).digest('hex');

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(md5Password, salt);

      await pool.query(
        'UPDATE sys_user SET phone = ?, name = ?, status = ?, roleIds = ?, password = ? WHERE id = ?',
        [phone, name, Number(status), JSON.stringify(roleIds), hashedPassword, id]
      );
    } else {
      await pool.query(
        'UPDATE sys_user SET phone = ?, name = ?, status = ?, roleIds = ? WHERE id = ?',
        [phone, name, Number(status), JSON.stringify(roleIds), id]
      );
    }
    res.json({ code: 200, msg: '修改成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.delete('/system/user/delete', authenticateToken, logOperation('删除用户'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.json({ code: 400, msg: '未选择要删除的用户' });
    if (ids.includes(1)) {
      return res.json({ code: 400, msg: '超级管理员账号禁止删除' });
    }
    
    // 修复 IN 查询参数化
    if (ids.length > 0) {
      await pool.query('DELETE FROM sys_user WHERE id IN (?)', [ids]);
    }
    res.json({ code: 200, msg: '删除成功', data: null });
  } catch (error) {
    console.error(error);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});