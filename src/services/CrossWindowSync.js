class CrossWindowSync {
  constructor() {
    this.channel = null;
    this.listeners = {};
    this.instanceId = Math.random().toString(36).substr(2, 9);
    this.init();
  }

  init() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('yaojide-sync-channel');
      
      this.channel.onmessage = (event) => {
        const { type, data, senderId } = event.data;
        
        if (senderId === this.instanceId) return;
        
        this.emit(type, data);
      };
    } else {
      this.initStorageFallback();
    }
  }

  initStorageFallback() {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('yaojide_sync_')) {
        try {
          const syncData = JSON.parse(event.newValue);
          const { type, data, senderId, timestamp } = syncData;
          
          if (senderId === this.instanceId) return;
          
          const lastProcessed = localStorage.getItem('yaojide_last_processed');
          if (lastProcessed && timestamp <= parseInt(lastProcessed)) return;
          
          localStorage.setItem('yaojide_last_processed', timestamp.toString());
          this.emit(type, data);
        } catch (e) {
          console.error('解析同步数据失败:', e);
        }
      }
    });
  }

  send(type, data) {
    const message = {
      type,
      data,
      senderId: this.instanceId,
      timestamp: Date.now()
    };

    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      const storageKey = `yaojide_sync_${Date.now()}`;
      localStorage.setItem(storageKey, JSON.stringify(message));
      
      setTimeout(() => {
        localStorage.removeItem(storageKey);
      }, 1000);
    }
  }

  on(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  off(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  emit(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('同步消息处理失败:', e);
        }
      });
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    this.listeners = {};
  }
}

const crossWindowSync = new CrossWindowSync();

export default crossWindowSync;
