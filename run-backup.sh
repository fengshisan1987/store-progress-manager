#!/bin/bash
# 门店筹建系统每日备份脚本
# 由 macOS crontab 调用
# 备份时间：每天 23:00

LOG_FILE="/Users/fengshisan/.workbuddy/backup-daily.log"
PROJECT_DIR="/Users/fengshisan/WorkBuddy/20260410105809"
NODE="/Users/fengshisan/.workbuddy/binaries/node/versions/22.12.0/bin/node"

echo "======================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始每日备份" >> "$LOG_FILE"

# 1. 备份 Excel 导出文件
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 执行 Excel 备份..." >> "$LOG_FILE"
"$NODE" "$PROJECT_DIR/backup-excel.js" >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Excel 备份完成" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Excel 备份失败" >> "$LOG_FILE"
fi

# 2. 备份服务器 JSON 数据
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 执行 JSON 数据备份..." >> "$LOG_FILE"
"$NODE" "$PROJECT_DIR/backup-data.js" >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ JSON 数据备份完成" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ JSON 数据备份失败" >> "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 每日备份结束" >> "$LOG_FILE"
echo "======================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
