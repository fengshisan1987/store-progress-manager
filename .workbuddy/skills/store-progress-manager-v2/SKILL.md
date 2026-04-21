# 门店筹建进度管理系统 Skill

## 基本信息

- **名称**: store-progress-manager-v2
- **版本**: 2.0.0
- **描述**: 门店筹建进度管理系统 - 支持自定义阶段节点、甘特图展示、日历看板、数据筛选等功能
- **作者**: 用户自定义

## 功能特性

### 1. 阶段管理
- 支持7个阶段：选址阶段、设计阶段、施工前准备阶段、施工阶段、人员阶段、整改阶段、开业阶段
- 每个阶段可配置多个节点
- 节点可设置是否需要日期
- 支持节点确认弹窗（如门店已验收需确认验收表）

### 2. 门店进度追踪
- 甘特图形式展示所有门店进度
- 节点点击完成功能
- 进度百分比计算
- 逾期自动检测和标记

### 3. 数据看板
- 筹建进度概述看板（可折叠）
- 区域门店及类型统计
- 门店周期统计
- **预估开业门店时间日历看板** - 以日历形式展示各日期预估开业的门店

### 4. 筛选功能
- 按区域筛选
- 按状态筛选
- 按门店类型筛选
- 按工程负责人筛选
- 按装修形式筛选

### 5. 数据管理
- Excel 导入/导出
- localStorage 本地存储
- 阶段配置版本控制

## 阶段结构配置

```javascript
const DEFAULT_PHASES = [
  {
    name: '选址阶段',
    short: '选址',
    color: '#7c3aed',
    steps: [
      { name: '选址人员已对接', requireDate: true },
      { name: '客户店铺已确认', requireDate: true }
    ]
  },
  {
    name: '设计阶段',
    short: '设计',
    color: '#2563eb',
    steps: [
      { name: '确认门店测量时间', requireDate: true },
      { name: '筹建须知已再次发送及让客户确认', requireDate: false },
      { name: '平面图已确认', requireDate: false },
      { name: '效果图已确认', requireDate: false },
      { name: '施工图已确认', requireDate: true }
    ]
  },
  {
    name: '施工前准备阶段',
    short: '施工前准备',
    color: '#0891b2',
    steps: [
      { name: '工程报价已出具', requireDate: true },
      { name: '工程费用已收取', requireDate: false },
      { name: '设备报价已出具', requireDate: false },
      { name: '设备费用已收取', requireDate: false },
      { name: '设计费、系统使用费、推广费等费用已收取', requireDate: false },
      { name: '提醒办理执照并开通税务', requireDate: false },
      { name: '工程进场报备已结束', requireDate: true }
    ]
  },
  {
    name: '施工阶段',
    short: '施工',
    color: '#d97706',
    steps: [
      { name: '工程已进场', requireDate: true },
      { name: '开业预期甘特图发出', requireDate: false },
      { name: '门头报备已完成', requireDate: false },
      { name: '门店灯具已安装', requireDate: false },
      { name: '门店电箱已安装', requireDate: false },
      { name: '门店家具已安装', requireDate: false },
      { name: '提醒设备到场需本人签字验收', requireDate: false },
      { name: '门店设备已安装', requireDate: false },
      { name: '门店空调已安装', requireDate: false },
      { name: '门店监控已安装', requireDate: false },
      { name: '提醒开业活动报备', requireDate: false },
      { name: '新提醒约食药监老师看现场', requireDate: false },
      { name: '门店广告物料已安装', requireDate: false },
      { name: '预估验收日期', requireDate: true },
      { name: '门店已验收', requireDate: true, requireConfirm: true, confirmText: '门店是否已填验收表并按照验收表整改好？' }
    ]
  },
  {
    name: '人员阶段',
    short: '人员',
    color: '#059669',
    steps: [
      { name: '招聘须知已发送', requireDate: false },
      { name: '人员培训已通过', requireDate: false }
    ]
  },
  {
    name: '整改阶段',
    short: '整改',
    color: '#7c3aed',
    steps: [
      { name: '确认整改日期', requireDate: true },
      { name: '整改已完成', requireDate: true }
    ]
  },
  {
    name: '开业阶段',
    short: '开业',
    color: '#16a34a',
    steps: [
      { name: '首配', requireDate: false },
      { name: '日配', requireDate: false },
      { name: '开业前准备', requireDate: false },
      { name: '提醒外卖开通', requireDate: false },
      { name: '预估开业日期', requireDate: true },
      { name: '已正式开业', requireDate: true }
    ]
  }
];
```

## 特殊节点配置

### 门店已验收节点
- 需要日期：是
- 需要确认弹窗：是
- 确认文案："门店是否已填验收表并按照验收表整改好？"
- 点击"否"：关闭弹窗，不执行操作
- 点击"是"：继续弹出日期选择器

## 预估筹建日期显示

在门店信息区域显示：
- **预估验收日期**：来自施工阶段"预估验收日期"节点
- **预估开业日期**：来自开业阶段"预估开业日期"节点

## 预估开业门店时间日历看板

- 以月历形式展示
- 显示星期（日-六）
- 标记今天日期
- 在对应日期显示预估开业的门店名称
- 支持月份切换（上月/下月）

## 使用方法

1. 将 `进度管理系统.html` 文件复制到目标位置
2. 在浏览器中打开即可使用
3. 数据会自动保存到浏览器 localStorage

## 数据导入/导出

- 支持 Excel 文件导入
- 支持 Excel 文件导出
- 数据格式：门店名称、区域、负责人、各阶段节点完成日期等

## 版本历史

### v2.0.0
- 添加预估开业门店时间日历看板
- 添加预估筹建日期显示
- 添加门店已验收确认弹窗
- 更新阶段结构为7阶段39节点
- 添加阶段配置版本控制

## 文件清单

- `进度管理系统.html` - 主程序文件（单文件应用）
