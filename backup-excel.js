#!/usr/bin/env node
/**
 * 每日自动导出"门店详细进度完整数据"Excel
 * 从服务器API获取最新数据，生成Excel保存到本地备份目录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// xlsx 库路径（从 workspace node_modules 加载）
const XLSX = require('/Users/fengshisan/.workbuddy/binaries/node/workspace/node_modules/xlsx');

const API_URL = 'http://47.114.120.73/api/data';
const BACKUP_BASE = '/Users/fengshisan/Desktop/筹建系统代码备份';

// 获取今天日期字符串
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 从API获取数据
function fetchData() {
  return new Promise((resolve, reject) => {
    http.get(API_URL, (res) => {
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

// 处理Excel日期格式（数字转日期字符串）
function formatDateValue(val) {
  if (!val || val === '' || val === null || val === undefined) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  if (typeof val === 'number') {
    // Excel序列号转日期（粗略处理）
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  }
  return String(val).trim();
}

// 生成Excel
function generateExcel(serverData) {
  const stores = serverData.stores || [];
  const basicFields = serverData.basicFields || [];
  const phases = serverData.storePhases || serverData.phases || [];

  // 获取所有节点名称
  const allSteps = [];
  phases.forEach(phase => {
    if (phase.steps) {
      phase.steps.forEach(step => {
        allSteps.push(step.name);
      });
    }
  });

  // 基本信息列（固定列）
  const fixedCols = [
    { key: '门店', label: '门店名称' },
    { key: '区域', label: '区域' },
    { key: '门店状态', label: '门店状态' },
    { key: '工程负责人', label: '工程负责人' },
    { key: '姓名', label: '姓名' },
    { key: '门店类型', label: '门店类型' },
    { key: '装修形式', label: '装修形式' },
    { key: '门店面积', label: '门店面积' },
    { key: '施工队伍名称', label: '施工队伍名称' },
    { key: '推荐队伍名称', label: '推荐队伍名称' },
    { key: '最新进展内容', label: '最新进展内容' },
    { key: '最新进展日期', label: '最新进展日期' },
    { key: '工程增减项备注', label: '工程增减项备注' },
    { key: '停工天数', label: '停工天数' }
  ];

  // 动态基本信息字段（来自basicFields配置，可能是字符串数组或对象数组）
  const dynamicBasicCols = [];
  basicFields.forEach(bf => {
    const fieldName = typeof bf === 'string' ? bf : (bf.name || bf.label || '');
    if (!fieldName) return;
    const existing = fixedCols.find(c => c.label === fieldName);
    if (!existing) {
      dynamicBasicCols.push({ key: fieldName, label: fieldName });
    }
  });

  // 预估日期列
  const estimateCols = [
    { key: '预估验收日期', label: '预估验收日期' },
    { key: '预估开业日期', label: '预估开业日期' }
  ];

  // 合并所有列定义
  const allCols = [...fixedCols, ...dynamicBasicCols, ...allSteps.map(s => ({ key: s, label: s })), ...estimateCols];

  // 表头
  const headers = allCols.map(c => c.label);

  // 数据行
  const rows = stores.map(store => {
    return allCols.map(col => {
      const val = store[col.key];
      if (col.key === '停工天数') {
        return val !== undefined && val !== null && val !== '' ? String(val) : '';
      }
      return formatDateValue(val);
    });
  });

  // 创建工作簿
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // 设置列宽
  const colWidths = allCols.map(col => {
    if (col.label.includes('日期')) return { wch: 14 };
    if (col.label === '最新进展内容') return { wch: 40 };
    if (col.label === '工程增减项备注') return { wch: 30 };
    if (col.label === '门店名称') return { wch: 22 };
    if (col.label === '区域') return { wch: 10 };
    return { wch: 16 };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '门店详细进度');

  return wb;
}

// 主流程
async function main() {
  const todayStr = getTodayStr();
  const backupDir = path.join(BACKUP_BASE, todayStr);
  const fileName = `门店详细进度_${todayStr}.xlsx`;
  const filePath = path.join(backupDir, fileName);

  console.log(`[${new Date().toISOString()}] 开始导出门店详细进度Excel...`);
  console.log(`  API: ${API_URL}`);
  console.log(`  目标: ${filePath}`);

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`  创建目录: ${backupDir}`);
  }

  // 获取数据
  console.log('  正在从服务器获取数据...');
  const data = await fetchData();
  const storeCount = (data.stores || []).length;
  console.log(`  获取成功: ${storeCount} 家门店`);

  // 生成Excel
  console.log('  正在生成Excel...');
  const wb = generateExcel(data);

  // 写入文件
  XLSX.writeFile(wb, filePath);
  console.log(`  保存成功: ${filePath}`);

  // 验证文件
  const stats = fs.statSync(filePath);
  console.log(`  文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`[${new Date().toISOString()}] 导出完成`);
}

main().catch(err => {
  console.error(`[${new Date().toISOString()}] 导出失败:`, err.message);
  process.exit(1);
});
