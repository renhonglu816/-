const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const requestAICompletion = async (payload) => {
  const token = localStorage.getItem('elderlyToken') || localStorage.getItem('childToken');
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'AI 服务暂时不可用');
  }

  return data;
};
