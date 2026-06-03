#!/bin/bash
# 服务器端每日备份脚本
# 备份 data.json 和 auth.json
# 部署后手动配置 crontab: 0 23 * * * /var/www/store-progress-manager/server-backup.sh

APP_DIR="/var/www/store-progress-manager"
BACKUP_DIR="/var/backups/store-progress-manager"
DATE_STR=$(date +%Y-%m-%d)

# 创建备份目录
mkdir -p "$BACKUP_DIR/$DATE_STR"

# 备份核心数据文件
if [ -f "$APP_DIR/backend/data.json" ]; then
    cp "$APP_DIR/backend/data.json" "$BACKUP_DIR/$DATE_STR/data.json"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ data.json 已备份"
fi

if [ -f "$APP_DIR/backend/auth.json" ]; then
    cp "$APP_DIR/backend/auth.json" "$BACKUP_DIR/$DATE_STR/auth.json"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ auth.json 已备份"
fi

# 清理30天前的旧备份
cutoff_date=$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d 2>/dev/null)
for dir in "$BACKUP_DIR"/????-??-??; do
    [ -d "$dir" ] || continue
    dir_name=$(basename "$dir")
    if [[ "$dir_name" < "$cutoff_date" ]]; then
        rm -rf "$dir"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已删除旧备份: $dir_name"
    fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 服务器端备份完成"
