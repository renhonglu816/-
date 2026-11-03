# 药记得 - 部署指南

## 📋 目录

- [快速开始 - 路演模式](#快速开始---路演模式)
- [完整部署 - 生产模式](#完整部署---生产模式)
- [Supabase 配置](#supabase-配置)
- [常见问题](#常见问题)

---

## 🚀 快速开始 - 路演模式

**无需配置后端，5 分钟即可开始演示！**

### 1. 启动前端

```bash
# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

### 2. 打开浏览器访问

```
以终端中 Vite 输出的 Local 地址为准（通常是 http://localhost:5173）
```

### 3. 双端同步演示方法

| 场景 | 方法 |
|------|------|
| 同一电脑 | 打开两个浏览器窗口（如 Chrome + Edge） |
| 同一浏览器 | 打开两个标签页，一个用正常模式，一个用隐身模式 |
| 演示同步 | 在一个窗口操作，观察另一个窗口实时更新 |

### 4. 测试账号

```
长者端:
  用户名: testuser
  密码: 123456

子女端:
  用户名: testchild
  密码: 123456
```

---

## 🏭 完整部署 - 生产模式

> 当前长者端和子女端的核心业务仍以 localStorage 路演模式为主。后端 API、Supabase 与鉴权已提供基础结构，但主页面尚未完成全量 API 接入；在处理真实身份和医疗相关数据前，必须完成服务端持久化、正式账号认证与端到端权限测试。

### 前置要求

- Node.js 18+
- Supabase 账号（免费即可）
- 服务器（可选）

### 步骤 1: 配置 Supabase

#### 1.1 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册并创建新项目
3. 在项目设置中获取以下信息：
   - Project URL
   - anon/public key

#### 1.2 创建数据库表

1. 打开 Supabase SQL Editor
2. 复制 `backend/supabase_schema.sql` 的内容
3. 粘贴并执行

#### 1.3 配置环境变量

编辑 `backend/.env`：

```env
# Supabase 配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# 服务器配置
PORT=3001

# AI 服务（仅后端配置，绝不能写入 VITE_ 前缀变量）
SILICONFLOW_API_KEY=your-server-side-key
AI_REQUIRE_AUTH=true
ALLOW_MOCK_AUTH=false

# Redis 配置（可选，用于任务队列）
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 步骤 2: 配置前端

复制 `.env.example` 为 `.env` 并修改：

```env
# 启用 API 模式
VITE_USE_API=true

# API 服务器地址
VITE_API_URL=http://localhost:3001/api

# WebSocket 服务器地址
VITE_WS_URL=ws://localhost:3001
```

### 步骤 3: 启动后端

```bash
npm run server
```

### 步骤 4: 启动前端

```bash
npm run dev
```

### 步骤 5: 部署到服务器（可选）

#### 前端部署 (Vercel)

```bash
npm run build
# 部署 dist 目录到 Vercel/Netlify
```

#### 后端部署 (Railway/Fly.io)

直接部署 backend 目录即可。

---

## 🔧 Supabase 配置详解

### 数据库表说明

| 表名 | 用途 |
|------|------|
| profiles | 用户资料 |
| family_groups | 家庭组 |
| medications | 用药记录 |
| messages | 留言消息 |
| reminder_logs | 提醒日志 |
| medication_review_requests | 药品复核请求 |

### 安全策略 (RLS)

已在 `supabase_schema.sql` 中配置好，包括：
- 用户只能查看自己的资料
- 子女可以查看同家庭组长者的用药
- 家庭组成员可以互相发送消息

---

## ❓ 常见问题

### Q: localStorage 模式和 API 模式有什么区别？

| 特性 | localStorage 模式 | API 模式 |
|------|------------------|---------|
| 部署难度 | ⭐ 简单 | ⭐⭐⭐ 稍复杂 |
| 跨设备同步 | ❌ 仅同浏览器 | ✅ 完全支持 |
| 数据持久化 | ✔️ 本地存储 | ✔️ 云端数据库 |
| 适用场景 | 路演/演示 | 正式使用 |

### Q: 如何切换两种模式？

修改前端 `.env` 文件中的 `VITE_USE_API`：

```env
# 路演模式
VITE_USE_API=false

# 生产模式
VITE_USE_API=true
```

然后重启前端服务器。

### Q: 路演时如何演示跨设备同步？

**方案 1: 使用两台电脑 + 手动同步**
1. 电脑 A（长者端）操作
2. 手动导出 localStorage 数据
3. 导入到电脑 B（子女端）

**方案 2: 使用远程桌面演示**
- 在一台电脑上演示，通过远程桌面共享
- 或使用录屏 + 旁白

**方案 3: 使用浏览器同步扩展**
- 安装 "LocalStorage Sync" 等扩展
- 可以跨浏览器同步 localStorage

### Q: 如何自定义主题颜色？

编辑 `tailwind.config.js` 和 `src/index.css`。

### Q: 忘记管理员密码怎么办？

目前版本可直接在数据库中修改，正式版本需要实现密码重置功能。

---

## 📞 技术支持

如遇问题，请检查：
1. Node.js 版本是否符合要求
2. 端口是否被占用
3. 浏览器控制台的错误信息

---

**祝你路演顺利！** 🎉
