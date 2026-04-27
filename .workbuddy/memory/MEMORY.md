# 长期记忆

## 项目信息
- 门店筹建进度管理系统部署在阿里云 CentOS 7 服务器（47.114.120.73）
- 前端为单 HTML 文件，位于服务器 `/var/www/store-progress-manager/进度管理系统.html`
- 数据通过 API 保存到服务器 JSON 文件，登录后从 JSON 文件加载
- 三个角色：admin、manager、operator

## 服务器信息
- IP: 47.114.120.73
- 系统: CentOS 7 (glibc 2.17，不支持 Node.js 18+)
- Web服务: Nginx
- root 密码: 2026-04-24 在阿里云控制台重置过（用户知道密码）
- Nginx 已设置开机自启（systemctl enable nginx）

## 用户偏好
- 非专业开发背景，需要通俗方式解释技术概念
- 偏好单一最佳方案而非多选项
- 通过截图反馈问题
- 拒绝滚动式方案，偏好清晰功能型界面
- 期望 undo 仅撤销上一步操作而非重置整个状态

## 已知技术限制
- CentOS 7 的 glibc 2.17 不兼容 Node.js 18+，需要绕过方案
- 服务器目前是纯静态 Nginx，没有 Node.js 后端
- 多设备同步采用前端轮询方案（每5秒），非 WebSocket 实时推送

## 部署流程
- 本地修改 → git push → GitHub Actions 自动 SCP 部署到阿里云（不再用 git pull）
- GitHub 仓库: fengshisan1987/store-progress-manager (分支: main)
- 两个本地目录都能直接推送（都有 origin remote）：
  - 工作目录: /Users/fengshisan/WorkBuddy/20260410105809/
  - 部署仓库: /Users/fengshisan/WorkBuddy/20260410105648/
- 不需要手动 scp 上传，走 GitHub Actions 自动部署即可
- ⚠️ 推送后如果 GitHub Actions 运行了但服务器没更新，需要额外触发一次空提交部署

## 重要修复记录
- 2026-04-24: 修复 saveStoreField() 不保存到服务器的 bug（编辑门店字段后数据丢失）
- 2026-04-24: 添加多设备数据轮询同步（每5秒自动从服务器拉取最新数据）
- 2026-04-27: "门店已验收"和"已正式开业"两个节点的日期选择不再限制最小日期
- 2026-04-27: data.json 写入权限问题（chmod 666 修复）
- 2026-04-27: GitHub Actions 部署方式从 git pull 改为 SCP（解决服务器文件不更新问题）
- 2026-04-27: 工作目录添加 git remote origin，解决"改错仓库"反复出现的问题
