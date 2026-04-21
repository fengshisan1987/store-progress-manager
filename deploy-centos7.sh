#!/bin/bash
# CentOS 7 部署脚本 - 门店筹建进度管理系统
# 使用方法：在服务器上执行 bash deploy-centos7.sh

set -e

echo "=========================================="
echo "  门店筹建进度管理系统 - CentOS 7 部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用 root 用户执行此脚本${NC}"
    echo "切换到root: sudo su -"
    exit 1
fi

echo -e "${GREEN}[1/8] 更新系统...${NC}"
yum update -y

echo -e "${GREEN}[2/8] 安装基础依赖...${NC}"
yum install -y curl wget git nginx

# 安装 Node.js 16 (CentOS 7兼容版本)
echo -e "${GREEN}[3/8] 安装 Node.js 16...${NC}"
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "16" ]; then
    # 下载预编译的 Node.js 16
    cd /usr/local
    if [ ! -d "node-v16.20.2-linux-x64" ]; then
        wget -q https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
        tar -xf node-v16.20.2-linux-x64.tar.xz
        rm -f node-v16.20.2-linux-x64.tar.xz
    fi
    
    # 创建软链接
    ln -sf /usr/local/node-v16.20.2-linux-x64/bin/node /usr/local/bin/node
    ln -sf /usr/local/node-v16.20.2-linux-x64/bin/npm /usr/local/bin/npm
    ln -sf /usr/local/node-v16.20.2-linux-x64/bin/npx /usr/local/bin/npx
    
    # 添加到PATH
    echo 'export PATH=/usr/local/node-v16.20.2-linux-x64/bin:$PATH' > /etc/profile.d/nodejs.sh
    source /etc/profile.d/nodejs.sh
fi

echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}npm 版本: $(npm -v)${NC}"

# 安装 PM2
echo -e "${GREEN}[4/8] 安装 PM2...${NC}"
npm install -g pm2
ln -sf /usr/local/node-v16.20.2-linux-x64/bin/pm2 /usr/local/bin/pm2

# 创建应用目录
echo -e "${GREEN}[5/8] 创建应用目录...${NC}"
APP_DIR="/var/www/store-progress-manager"
mkdir -p $APP_DIR

# 从 GitHub 克隆代码
echo -e "${GREEN}[6/8] 从 GitHub 克隆代码...${NC}"
cd $APP_DIR

if [ -d ".git" ]; then
    echo "代码已存在，执行更新..."
    git pull
else
    rm -rf *
    git clone https://github.com/fengshisan1987/store-progress-manager.git .
fi

# 创建后端服务
echo -e "${GREEN}[7/8] 创建后端服务...${NC}"
mkdir -p $APP_DIR/backend
cd $APP_DIR/backend

# 初始化 package.json
cat > package.json << 'EOF'
{
  "name": "store-progress-api",
  "version": "1.0.0",
  "description": "门店筹建进度管理系统API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  }
}
EOF

# 安装依赖
npm install

# 复制后端服务文件
cp $APP_DIR/backend/server.js .
cp $APP_DIR/backend/package.json .

# 配置 Nginx
echo -e "${GREEN}[8/8] 配置 Nginx...${NC}"
cat > /etc/nginx/conf.d/store-progress.conf << EOF
server {
    listen 80;
    server_name _;
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location / {
        root $APP_DIR;
        index 进度管理系统.html;
        try_files \$uri \$uri/ /进度管理系统.html;
    }
}
EOF

# 测试 Nginx 配置
nginx -t

# 启动服务
echo -e "${GREEN}启动服务...${NC}"

# 启动后端
pm2 delete store-progress-api 2>/dev/null || true
pm2 start $APP_DIR/backend/server.js --name store-progress-api
pm2 save
pm2 startup systemd -u root --hp /root

# 启动/重载 Nginx
systemctl enable nginx

# 检查 Nginx 是否已在运行
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}Nginx 正在运行，执行平滑重载...${NC}"
    nginx -s reload
else
    echo -e "${GREEN}启动 Nginx...${NC}"
    systemctl start nginx
fi

# 配置防火墙
echo -e "${GREEN}配置防火墙...${NC}"
firewall-cmd --permanent --add-service=http 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo ""
echo "=========================================="
echo -e "${GREEN}  部署完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址: http://47.114.120.73"
echo "API测试: http://47.114.120.73/api/health"
echo ""
echo "常用命令:"
echo "  查看后端日志: pm2 logs store-progress-api"
echo "  重启后端: pm2 restart store-progress-api"
echo "  查看Nginx状态: systemctl status nginx"
echo ""
