import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// 加载环境变量
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

// 导入路由
import familyRoutes from './routes/family.js';
import medicationRoutes from './routes/medications.js';
import reminderRoutes from './routes/reminders.js';
import messageRoutes from './routes/messages.js';
import authRoutes from './routes/auth.js';
import reviewRoutes from './routes/reviews.js';
import sosRoutes from './routes/sos.js';
import aiRoutes from './routes/ai.js';
import { isSupabaseAuthConfigured } from './utils/supabase.js';

// 导入服务
import WebSocketService from './utils/websocket.js';

// 创建 Express 应用
const app = express();
app.disable('x-powered-by');

// 中间件
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopment = process.env.NODE_ENV !== 'production'
      && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    if (!origin || configuredOrigins.includes(origin) || isLocalDevelopment) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/family', familyRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/medications/reviews', reviewRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/ai', aiRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    release: 'supabase-auth-v1',
    authConfigured: isSupabaseAuthConfigured,
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 错误处理中间件
app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 创建 HTTP 服务器
const server = http.createServer(app);

// 初始化 WebSocket 服务
new WebSocketService(server);

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server running`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api/health`);
  console.log(`💡 提示: 目前默认使用 localStorage 模式，配置 Supabase 后可开启 API 模式`);
});

export default app;
