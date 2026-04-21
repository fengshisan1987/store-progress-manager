const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const DATA_FILE = path.join(__dirname, 'data.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');

// 默认账号配置
const DEFAULT_ACCOUNTS = [
    { username: 'admin', password: 'admin123', role: 'superadmin', createdAt: new Date().toISOString() }
];

// 初始化认证文件
function initAuthFile() {
    if (!fs.existsSync(AUTH_FILE)) {
        fs.writeFileSync(AUTH_FILE, JSON.stringify({ accounts: DEFAULT_ACCOUNTS }, null, 2));
    }
}

// 读取认证数据
function readAuthData() {
    try {
        initAuthFile();
        const content = fs.readFileSync(AUTH_FILE, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        return { accounts: DEFAULT_ACCOUNTS };
    }
}

// 保存认证数据
function saveAuthData(data) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

// 初始化数据文件
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ stores: [] }, null, 2));
    }
}

// 读取数据
function readData() {
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        return { stores: [] };
    }
}

// 保存数据
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== 认证相关 API ==========

// 登录验证
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const authData = readAuthData();
    
    const account = authData.accounts.find(a => a.username === username && a.password === password);
    
    if (account) {
        res.json({ 
            success: true, 
            user: {
                username: account.username,
                role: account.role
            }
        });
    } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
});

// 获取所有账号（需要超级管理员权限）
app.get('/api/auth/accounts', (req, res) => {
    const authData = readAuthData();
    // 不返回密码
    const accounts = authData.accounts.map(a => ({
        username: a.username,
        role: a.role,
        createdAt: a.createdAt
    }));
    res.json({ success: true, accounts });
});

// 添加账号
app.post('/api/auth/accounts', (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    const authData = readAuthData();
    
    // 检查账号是否已存在
    if (authData.accounts.find(a => a.username === username)) {
        return res.status(409).json({ success: false, message: '账号已存在' });
    }
    
    // 添加新账号
    authData.accounts.push({
        username,
        password,
        role,
        createdAt: new Date().toISOString()
    });
    
    saveAuthData(authData);
    res.json({ success: true, message: '账号创建成功' });
});

// 删除账号
app.delete('/api/auth/accounts/:username', (req, res) => {
    const { username } = req.params;
    
    // 不允许删除默认管理员
    if (username === 'admin') {
        return res.status(403).json({ success: false, message: '不能删除默认管理员账号' });
    }
    
    const authData = readAuthData();
    const index = authData.accounts.findIndex(a => a.username === username);
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: '账号不存在' });
    }
    
    authData.accounts.splice(index, 1);
    saveAuthData(authData);
    res.json({ success: true, message: '账号删除成功' });
});

// 修改密码
app.put('/api/auth/accounts/:username/password', (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ success: false, message: '新密码不能为空' });
    }
    
    const authData = readAuthData();
    const account = authData.accounts.find(a => a.username === username);
    
    if (!account) {
        return res.status(404).json({ success: false, message: '账号不存在' });
    }
    
    account.password = newPassword;
    saveAuthData(authData);
    res.json({ success: true, message: '密码修改成功' });
});

// ========== 数据相关 API ==========

// 获取数据
app.get('/api/data', (req, res) => {
    initDataFile();
    res.json(readData());
});

// 保存数据
app.post('/api/data', (req, res) => {
    initDataFile();
    saveData(req.body);
    res.json({ success: true });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`认证文件: ${AUTH_FILE}`);
    console.log(`数据文件: ${DATA_FILE}`);
});
