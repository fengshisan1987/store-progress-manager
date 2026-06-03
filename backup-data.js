#!/usr/bin/env node
/**
 * 每日自动备份服务器数据文件（data.json + auth.json）
 * 通过 HTTP API 获取，不依赖 SSH 密钥
 * 独立运行，不依赖 WorkBuddy 环境
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://47.114.120.73';
const BACKUP_BASE = '/Users/fengshisan/Desktop/筹建系统代码备份';

// 获取今天日期字符串
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 从API获取数据
function fetchJson(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON解析失败: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

// 主流程
async function main() {
  const todayStr = getTodayStr();
  const backupDir = path.join(BACKUP_BASE, todayStr);

  console.log(`[${new Date().toISOString()}] 开始每日数据文件备份...`);
  console.log(`  API: ${API_BASE}`);
  console.log(`  目标目录: ${backupDir}`);

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`  创建目录: ${backupDir}`);
  }

  // 1. 备份 data.json
  console.log('  正在获取 data.json...');
  const dataJson = await fetchJson('/api/data');
  const dataPath = path.join(backupDir, 'data.json');
  fs.writeFileSync(dataPath, JSON.stringify(dataJson, null, 2), 'utf8');
  const dataStats = fs.statSync(dataPath);
  console.log(`  ✓ data.json: ${(dataStats.size / 1024).toFixed(1)} KB`);

  // 2. 备份 auth.json（后端无公开API，跳过）
  console.log('  auth.json 包含登录凭证，后端无公开API，跳过备份');
  console.log('  ⚠ 如需恢复登录凭证，请手动从服务器 /var/www/store-progress-manager/auth.json 复制');

  // 3. 备份前端代码文件（从 GitHub raw 或直接复制本地文件）
  console.log('  正在备份前端代码文件...');
  const localHtml = '/Users/fengshisan/WorkBuddy/20260410105809/进度管理系统.html';
  const htmlBackupPath = path.join(backupDir, '进度管理系统.html');
  if (fs.existsSync(localHtml)) {
    fs.copyFileSync(localHtml, htmlBackupPath);
    const htmlStats = fs.statSync(htmlBackupPath);
    console.log(`  ✓ 进度管理系统.html: ${(htmlStats.size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`  ⚠ 本地前端文件不存在，跳过`);
  }

  // 4. 清理30天前的旧备份
  console.log('  正在清理30天前的旧备份...');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const entries = fs.readdirSync(BACKUP_BASE, { withFileTypes: true });
  let cleanedCount = 0;
  entries.forEach(entry => {
    if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
      const dirDate = new Date(entry.name);
      if (dirDate < cutoffDate) {
        const dirPath = path.join(BACKUP_BASE, entry.name);
        fs.rmSync(dirPath, { recursive: true, force: true });
        cleanedCount++;
        console.log(`    已删除: ${entry.name}`);
      }
    }
  });
  console.log(`  ✓ 清理完成，删除 ${cleanedCount} 个旧备份目录`);

  console.log(`[${new Date().toISOString()}] 数据文件备份完成`);
}

main().catch(err => {
  console.error(`[${new Date().toISOString()}] 备份失败:`, err.message);
  process.exit(1);
});
