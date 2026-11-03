import { useEffect, useCallback } from 'react';
import crossWindowSync from '../services/CrossWindowSync';

export const useCrossWindowSync = (eventHandlers = {}) => {
  const sendMessage = useCallback((type, data) => {
    crossWindowSync.send(type, data);
  }, []);

  useEffect(() => {
    const cleanupFns = [];

    Object.entries(eventHandlers).forEach(([type, handler]) => {
      crossWindowSync.on(type, handler);
      cleanupFns.push(() => crossWindowSync.off(type, handler));
    });

    return () => {
      cleanupFns.forEach(cleanup => cleanup());
    };
  }, [eventHandlers]);

  return { sendMessage };
};

export const SYNC_EVENTS = {
  SOS_ALERT: 'sos_alert',
  MEDICATION_TAKEN: 'medication_taken',
  MEDICATION_ADDED: 'medication_added',
  MEDICATION_UPDATED: 'medication_updated',
  NOTIFICATION: 'notification',
  FAMILY_MESSAGE: 'family_message',
  DATA_REFRESH: 'data_refresh'
};
