#!/usr/bin/env node
/**
 * 每日自动导出"门店详细进度完整数据"Excel
 * 从服务器API获取最新数据，生成Excel保存到本地备份目录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// xlsx 库路径（优先使用项目本地，回退到 WorkBuddy 环境）
const XLSX = (() => {
  try {
    return require('./node_modules/xlsx');
  } catch (e) {
    return require('/Users/fengshisan/.workbuddy/binaries/node/workspace/node_modules/xlsx');
  }
})();

const API_URL = 'http://47.114.120.73/jd-api/data';
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

// 生成门店详细进度Excel
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

// 生成工程结算明细Excel
function generateFinanceExcel(serverData) {
  const stores = serverData.stores || [];
  const financeCols = ['工程硬装', '广告物料', '安装收尾', '家具', '灯具', '配电箱', '设计', '空调', '消防', '其他工程类'];
  const financeRows = [
    { id: 'initQuote', type: '初始报价数据', detail: '初始报价金额', editable: true },
    { id: 'initCost', type: '初始报价数据', detail: '初始成本金额', editable: true },
    { id: 'initProfit', type: '初始报价数据', detail: '初始利润', formula: true },
    { id: 'adjQuote', type: '增减项数据', detail: '增减项报价金额', editable: true },
    { id: 'adjCost', type: '增减项数据', detail: '增减项成本金额', editable: true },
    { id: 'adjProfit', type: '增减项数据', detail: '增减项利润', formula: true },
    { id: 'finalQuote', type: '最终结算数据', detail: '最终对外报价金额', formula: true },
    { id: 'finalPay', type: '最终结算数据', detail: '最终应支付结算金额', formula: true },
    { id: 'finalProfit', type: '最终结算数据', detail: '最终利润', formula: true },
    { id: 'firstPay', type: '实际支付数据', detail: '首次结算支付金额', editable: true },
    { id: 'secondPay', type: '实际支付数据', detail: '后续结算支付金额', editable: true },
    { id: 'unpaid', type: '实际支付数据', detail: '未支付金额', formula: true },
    { id: 'unitQuote', type: '平米单价数据', detail: '硬装报价单价', isUnitPrice: true, editable: true },
    { id: 'unitCost', type: '平米单价数据', detail: '硬装成本单价', isUnitPrice: true, editable: true },
    { id: 'grossMargin', type: '毛利率数据', detail: '毛利率', isPercent: true, formula: true }
  ];

  const headers = ['门店名称', '区域', '门店类型', '开业日期', '门店面积', '金额类型', '类型明细', '金额备注', ...financeCols, '工程类费用小计', '设备费用', '整体筹建费用总计'];
  const rows = [];

  stores.forEach(store => {
    const fin = store.finance || {};
    const openingDate = store['开业日期'] || store['节点状态']?.['已正式开业']?.date || '';
    const area = store['门店面积'] || '';

    financeRows.forEach(row => {
      const isUnitPrice = row.isUnitPrice;
      const isPercent = row.isPercent;
      const isFormula = row.formula;
      const rowData = fin[row.id] || {};

      const dataRow = [
        store['门店'] || '',
        store['区域'] || '',
        store['门店类型'] || '',
        openingDate,
        area,
        row.type,
        row.detail,
        rowData._remark || ''
      ];

      let subtotal = 0;
      financeCols.forEach(col => {
        let val = rowData[col] || 0;
        if (isUnitPrice && col !== '工程硬装') val = 0;
        if (isPercent) val = (val * 100).toFixed(2) + '%';
        else val = parseFloat(val).toFixed(2);
        dataRow.push(val);
        if (!isPercent && !isUnitPrice) {
          subtotal += parseFloat(rowData[col] || 0);
        }
      });

      const equipVal = parseFloat(rowData['设备费用'] || 0);
      if (isPercent) {
        dataRow.push((subtotal * 100).toFixed(2) + '%');
        dataRow.push((equipVal * 100).toFixed(2) + '%');
        dataRow.push(((subtotal + equipVal) * 100).toFixed(2) + '%');
      } else {
        dataRow.push(subtotal.toFixed(2));
        dataRow.push(equipVal.toFixed(2));
        dataRow.push((subtotal + equipVal).toFixed(2));
      }

      rows.push(dataRow);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => {
    if (i < 5) return { wch: 14 };
    if (i === 5 || i === 6) return { wch: 16 };
    if (i === 7) return { wch: 20 };
    return { wch: 12 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '工程结算明细');
  return wb;
}

// 生成供应商管理Excel
function generateSuppliersExcel(serverData) {
  const suppliers = serverData.suppliers || [];
  const headers = ['供应商名称', '供应商性质', '合同性质', '联系人姓名', '联系人电话', '合同金额', '合同签订日期', '是否缴纳保证金', '计划缴纳保证金', '实际缴纳保证金', '剩余保证金', '是否黑名单', '备注'];
  const rows = suppliers.map(s => [
    s.name || '',
    Array.isArray(s.categories) ? s.categories.join('、') : (s.categories || ''),
    s.contractType || '',
    s.contactName || '',
    s.contactPhone || '',
    s.contractAmount || '',
    s.contractDate || '',
    s.hasDeposit === true ? '是' : (s.hasDeposit === false ? '否' : ''),
    s.plannedDeposit || '',
    s.depositAmount || '',
    s.remainingDeposit || '',
    s.isBlacklisted === true ? '是' : (s.isBlacklisted === false ? '否' : ''),
    s.remark || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(h => ({ wch: 16 }));
  ws['!cols'][0] = { wch: 20 };
  ws['!cols'][12] = { wch: 30 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '供应商管理');
  return wb;
}

// 生成维保记录Excel
function generateMaintenanceExcel(serverData) {
  const records = serverData.maintenanceRecords || [];
  const headers = ['报修门店', '区域', '开业日期', '维保类型', '所属供应商', '维保内容', '是否保内', '额外费用', '报修日期', '完成日期', '维保用时', '状态', '备注'];
  const rows = records.map(r => [
    r.storeName || '',
    r.storeArea || '',
    r.openingDate || '',
    r.maintenanceType || '',
    r.supplier || '',
    r.content || '',
    r.isUnderWarranty === true ? '是' : (r.isUnderWarranty === false ? '否' : ''),
    r.extraCost !== undefined && r.extraCost !== '' ? parseFloat(r.extraCost).toFixed(2) : '',
    r.reportDate || '',
    r.completeDate || '',
    r.duration || '',
    r.status || '',
    r.remark || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(h => ({ wch: 14 }));
  ws['!cols'][4] = { wch: 18 };
  ws['!cols'][5] = { wch: 25 };
  ws['!cols'][12] = { wch: 25 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '维保记录');
  return wb;
}

// 写入Excel并验证
function writeExcel(wb, filePath, label) {
  XLSX.writeFile(wb, filePath);
  const stats = fs.statSync(filePath);
  console.log(`  ${label}: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

// 主流程
async function main() {
  const todayStr = getTodayStr();
  const backupDir = path.join(BACKUP_BASE, todayStr);

  console.log(`[${new Date().toISOString()}] 开始每日Excel导出...`);
  console.log(`  API: ${API_URL}`);
  console.log(`  目标目录: ${backupDir}`);

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`  创建目录: ${backupDir}`);
  }

  // 获取数据
  console.log('  正在从服务器获取数据...');
  const data = await fetchData();
  console.log(`  获取成功: ${(data.stores || []).length} 家门店, ${(data.suppliers || []).length} 家供应商, ${(data.maintenanceRecords || []).length} 条维保记录`);

  // 1. 门店详细进度
  console.log('  正在生成门店详细进度Excel...');
  const wb1 = generateExcel(data);
  writeExcel(wb1, path.join(backupDir, `门店详细进度_${todayStr}.xlsx`), '门店详细进度');

  // 2. 工程结算明细
  console.log('  正在生成工程结算明细Excel...');
  const wb2 = generateFinanceExcel(data);
  writeExcel(wb2, path.join(backupDir, `工程结算明细_${todayStr}.xlsx`), '工程结算明细');

  // 3. 供应商管理
  console.log('  正在生成供应商管理Excel...');
  const wb3 = generateSuppliersExcel(data);
  writeExcel(wb3, path.join(backupDir, `供应商管理_${todayStr}.xlsx`), '供应商管理');

  // 4. 维保记录
  console.log('  正在生成维保记录Excel...');
  const wb4 = generateMaintenanceExcel(data);
  writeExcel(wb4, path.join(backupDir, `维保记录_${todayStr}.xlsx`), '维保记录');

  console.log(`[${new Date().toISOString()}] 全部4个Excel导出完成`);
}

main().catch(err => {
  console.error(`[${new Date().toISOString()}] 导出失败:`, err.message);
  process.exit(1);
});
