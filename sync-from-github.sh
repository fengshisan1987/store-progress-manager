#!/bin/bash
# 服务器端：从 GitHub 拉取最新代码

cd /var/www/store-progress-manager

echo "=========================================="
echo "  从 GitHub 拉取更新"
echo "=========================================="
echo ""

# 显示当前状态
echo "当前状态："
git status --short
echo ""

# 拉取最新代码
echo "拉取最新代码..."
git pull origin main

echo ""
echo "=========================================="
echo "  更新完成！"
echo "=========================================="
echo ""
echo "访问地址: http://47.114.120.73"
