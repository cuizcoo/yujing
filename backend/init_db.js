const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function init() {
  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  const dbName = process.env.DB_NAME || 'warning_system';
  console.log(`Creating database ${dbName} if not exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  console.log('Creating tables...');
  
  // Create sys_role
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sys_role (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roleName VARCHAR(50) NOT NULL,
      roleDesc VARCHAR(200),
      permissions JSON,
      createTime DATETIME,
      updateTime DATETIME
    );
  `);

  // Create sys_user
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sys_user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      name VARCHAR(50) NOT NULL,
      password VARCHAR(100) NOT NULL,
      status TINYINT DEFAULT 1,
      roleIds JSON,
      createTime DATETIME,
      lastLoginTime DATETIME
    );
  `);

  // Create pressure_well
  await connection.query(`
    CREATE TABLE IF NOT EXISTS pressure_well (
      id INT AUTO_INCREMENT PRIMARY KEY,
      waterLevel INT,
      year1 FLOAT,
      year3 FLOAT,
      yearI FLOAT,
      decay FLOAT,
      decayRate FLOAT
    );
  `);

  // Create operation_log
  await connection.query(`
    CREATE TABLE IF NOT EXISTS operation_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      operator VARCHAR(50),
      action VARCHAR(100),
      time DATETIME
    );
  `);

  console.log('Inserting seed data...');

  // roles
  const [roles] = await connection.query('SELECT * FROM sys_role');
  if (roles.length === 0) {
    await connection.query(`INSERT INTO sys_role (id, roleName, roleDesc, permissions, createTime, updateTime) VALUES 
      (1, '超级管理员', '拥有系统全部权限', '["home", "pressure-well", "system", "roleManage", "userManage"]', NOW(), NOW()),
      (2, '普通用户', '只能查看首页和减压井', '["home", "pressure-well"]', NOW(), NOW())
    `);
  }

  // users
  const [users] = await connection.query('SELECT * FROM sys_user');
  if (users.length > 0) {
    // 强制清空 sys_user 表以便我们写入正确的 bcrypt 密码
    await connection.query('TRUNCATE TABLE sys_user');
  }
  
  const salt = await bcrypt.genSalt(10);
  // 注意：前端 LoginForm 中提交登录时，会对输入的密码进行 md5() 加密，然后再传给后端
  // 也就是说，当你在网页输入 "123456" 时，前端发给后端的其实是 "e10adc3949ba59abbe56e057f20f883e"
  // 因此，我们在初始化数据库时，必须对这个 md5 字符串进行 bcrypt 哈希，这样后端比对时才能匹配上
  const hashedPassword = await bcrypt.hash('e10adc3949ba59abbe56e057f20f883e', salt);

  await connection.query(`INSERT INTO sys_user (id, username, phone, name, password, status, roleIds, createTime, lastLoginTime) VALUES 
    (1, 'admin', '13800138000', '管理员', ?, 1, '[1]', NOW(), NOW()),
    (2, 'user', '13800138001', '测试用户', ?, 1, '[2]', NOW(), NOW())
  `, [hashedPassword, hashedPassword]);

  // pressure_well
  const [wells] = await connection.query('SELECT * FROM pressure_well');
  if (wells.length === 0) {
    await connection.query(`INSERT INTO pressure_well (waterLevel, year1, year3, yearI, decay, decayRate) VALUES 
      (1, 5, 4, 3, 2, 0.4),
      (2, 7, 6, 5, 2, 0.2857),
      (3, 8, 8, 7, 1, 0.125),
      (4, 10, 9, 8, 2, 0.2),
      (5, 15, 13, 11, 4, 0.2667),
      (6, 20, 18, 16, 4, 0.2),
      (7, 25, 24, 19, 6, 0.24),
      (8, 30, 28, 23, 7, 0.2333),
      (9, 36, 35, 26, 10, 0.2778),
      (10, 40, 38, 30, 10, 0.25)
    `);
  }

  console.log('Database initialized successfully! 🎉');
  process.exit(0);
}

init().catch(err => {
  console.error('Failed to initialize database:');
  console.error(err);
  process.exit(1);
});