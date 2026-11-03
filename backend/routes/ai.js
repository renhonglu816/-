import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const SILICONFLOW_API_URL = process.env.SILICONFLOW_API_URL
  || 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL
  || 'Pro/moonshotai/Kimi-K2.5';

const requireAIAuth = (req, res, next) => {
  if (process.env.AI_REQUIRE_AUTH === 'false') return next();
  return authMiddleware(req, res, next);
};

router.post('/chat', requireAIAuth, async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI 服务尚未配置' });
  }

  const { messages, temperature = 0.2, max_tokens } = req.body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return res.status(400).json({ error: 'messages 必须是非空数组' });
  }

  const hasInvalidMessage = messages.some(message => (
    !message
    || !['system', 'user', 'assistant'].includes(message.role)
    || (!Array.isArray(message.content) && typeof message.content !== 'string')
  ));
  if (hasInvalidMessage) {
    return res.status(400).json({ error: 'messages 格式不正确' });
  }

  try {
    const upstreamResponse = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages,
        temperature,
        ...(Number.isFinite(max_tokens) ? { max_tokens } : {}),
      }),
    });

    if (!upstreamResponse.ok) {
      console.error('AI upstream request failed:', upstreamResponse.status);
      return res.status(502).json({ error: 'AI 服务请求失败' });
    }

    const data = await upstreamResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('AI proxy error:', error.message);
    return res.status(502).json({ error: '无法连接 AI 服务' });
  }
});

export default router;
