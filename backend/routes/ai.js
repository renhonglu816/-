import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const DASHSCOPE_BASE_URL = (process.env.DASHSCOPE_BASE_URL || '').replace(/\/+$/, '');
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen3.8-omni-flash';
const DASHSCOPE_REASONING_EFFORT = process.env.DASHSCOPE_REASONING_EFFORT || 'none';

const normalizeMessages = messages => messages.map(message => {
  if (!Array.isArray(message.content)) return message;

  return {
    ...message,
    content: message.content.map(part => {
      if (part?.type !== 'image_url' || !part.image_url) return part;

      // 百炼兼容接口使用 image_url.url；OpenAI 的 detail 字段未在百炼接口中定义。
      const { detail: _detail, ...imageUrl } = part.image_url;
      return { ...part, image_url: imageUrl };
    }),
  };
});

const collectStreamedCompletion = async upstreamResponse => {
  const body = await upstreamResponse.text();
  let content = '';
  let finishReason = 'stop';
  let usage = null;
  let responseId = null;
  let created = null;

  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;

    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    const chunk = JSON.parse(payload);
    responseId ||= chunk.id;
    created ||= chunk.created;
    usage = chunk.usage || usage;

    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (typeof choice.delta?.content === 'string') content += choice.delta.content;
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  if (!content) throw new Error('DashScope 返回内容为空');

  return {
    id: responseId,
    object: 'chat.completion',
    created,
    model: DASHSCOPE_MODEL,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: finishReason,
    }],
    usage,
  };
};

const requireAIAuth = (req, res, next) => {
  if (process.env.AI_REQUIRE_AUTH === 'false') return next();
  return authMiddleware(req, res, next);
};

router.post('/chat', requireAIAuth, async (req, res) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || !DASHSCOPE_BASE_URL) {
    return res.status(503).json({
      error: 'AI 服务尚未配置，请设置 DASHSCOPE_API_KEY 和 DASHSCOPE_BASE_URL',
    });
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
    const upstreamResponse = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DASHSCOPE_MODEL,
        messages: normalizeMessages(messages),
        modalities: ['text'],
        reasoning_effort: DASHSCOPE_REASONING_EFFORT,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
        ...(Number.isFinite(max_tokens) ? { max_tokens } : {}),
      }),
    });

    if (!upstreamResponse.ok) {
      const upstreamError = await upstreamResponse.text();
      console.error('DashScope request failed:', upstreamResponse.status, upstreamError.slice(0, 500));
      return res.status(502).json({ error: 'AI 服务请求失败' });
    }

    const data = await collectStreamedCompletion(upstreamResponse);
    return res.status(200).json(data);
  } catch (error) {
    console.error('AI proxy error:', error.message);
    return res.status(502).json({ error: '无法连接 AI 服务' });
  }
});

export default router;
