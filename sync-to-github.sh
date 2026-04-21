#!/bin/bash
# 同步到 GitHub 脚本

cd /Users/fengshisan/WorkBuddy/20260410105648

echo "=========================================="
echo "  同步到 GitHub"
echo "=========================================="
echo ""

# 检查是否有修改
if git diff --quiet && git diff --cached --quiet; then
    echo "没有需要提交的修改"
    exit 0
fi

# 显示修改的文件
echo "修改的文件："
git status --short
echo ""

# 添加所有修改
git add .

# 提交（使用默认提交信息，或自定义）
if [ -z "$1" ]; then
    read -p "请输入提交说明: " msg
    if [ -z "$msg" ]; then
        msg="更新进度管理系统"
    fi
else
    msg="$1"
fi

git commit -m "$msg"

# 推送到 GitHub
echo ""
echo "推送到 GitHub..."
git push origin main

echo ""
echo "=========================================="
echo "  同步完成！"
echo "=========================================="
