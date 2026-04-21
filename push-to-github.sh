#!/bin/bash
# 推送到 GitHub 脚本

cd /Users/fengshisan/WorkBuddy/20260410105648

echo "正在推送到 GitHub..."
echo ""
echo "提示: 当要求输入密码时，请粘贴你的 GitHub Personal Access Token"
echo ""

git push -u origin main

echo ""
if [ $? -eq 0 ]; then
    echo "✅ 推送成功!"
    echo "访问地址: https://github.com/fengshisan1987/store-progress-manager"
else
    echo "❌ 推送失败，请检查 Token 是否正确"
fi
