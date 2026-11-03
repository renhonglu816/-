# 跨窗口同步功能说明

## 功能概述

本功能实现了在同一个浏览器的不同窗口/标签页之间实时同步数据，特别是长者端和子女端之间的同步。

## 技术实现

### 1. BroadcastChannel API（现代浏览器）

使用 `BroadcastChannel` API 实现同源页面之间的高效通信。

### 2. localStorage API（兼容性降级）

对于不支持 BroadcastChannel 的浏览器，使用 localStorage 的 storage 事件作为降级方案。

## 核心文件

- `src/services/CrossWindowSync.js` - 跨窗口同步服务类
- `src/hooks/useCrossWindowSync.js` - React Hook，简化组件使用

## 同步事件类型

```javascript
{
  SOS_ALERT: 'sos_alert',           // SOS紧急求助
  MEDICATION_TAKEN: 'medication_taken',  // 药物状态变化
  MEDICATION_ADDED: 'medication_added',  // 添加药物
  MEDICATION_UPDATED: 'medication_updated',  // 更新药物
  NOTIFICATION: 'notification',      // 通知消息
  FAMILY_MESSAGE: 'family_message',  // 家庭留言
  DATA_REFRESH: 'data_refresh'       // 数据刷新
}
```

## 使用方法

### 发送同步消息

```javascript
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';

function MyComponent() {
  const { sendMessage } = useCrossWindowSync();

  const handleAction = () => {
    // 发送同步消息
    sendMessage(SYNC_EVENTS.SOS_ALERT, {
      id: Date.now(),
      message: '紧急求助',
      timestamp: new Date().toISOString()
    });
  };

  return <button onClick={handleAction}>发送</button>;
}
```

### 接收同步消息

```javascript
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';

function MyComponent() {
  const handleSOS = useCallback((data) => {
    console.log('收到SOS求助:', data);
  }, []);

  const handleRefresh = useCallback(() => {
    // 重新加载数据
  }, []);

  useCrossWindowSync({
    [SYNC_EVENTS.SOS_ALERT]: handleSOS,
    [SYNC_EVENTS.DATA_REFRESH]: handleRefresh
  });

  return <div>监听中...</div>;
}
```

## 测试方法

1. 打开浏览器，访问应用
2. 在一个标签页打开长者端（或点击页面上的"长者端"按钮）
3. 在另一个标签页打开子女端（或点击页面上的"子女端"按钮）
4. 在长者端点击SOS紧急求助，子女端应该立即弹出求助通知
5. 在长者端标记药物已服用，子女端应该立即看到状态更新

## 已实现的同步场景

✅ SOS紧急求助通知：长者端发送求助，子女端立即收到通知并弹窗
✅ 药物状态变化：长者端标记服药，子女端立即看到状态更新
✅ 数据刷新：任何数据变更都触发刷新事件

## 注意事项

1. 跨窗口同步只在同一浏览器的同一站点内有效
2. 不同浏览器之间无法直接同步（需要使用后端服务）
3. 隐私模式/无痕模式可能会禁用 localStorage
4. BroadcastChannel API 在 IE11 及以下浏览器不可用

## 扩展建议

未来可以考虑：
- 使用 WebSocket 实现跨浏览器、跨设备同步
- 添加消息确认机制
- 实现消息队列，防止离线时丢失消息
