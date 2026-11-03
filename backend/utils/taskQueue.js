import Bull from 'bull';
import supabase from './supabase.js';

const isTaskQueueEnabled = process.env.ENABLE_TASK_QUEUE === 'true';

const reminderQueue = isTaskQueueEnabled
  ? new Bull('medication-reminders', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    }
  })
  : {
    add: async () => null,
    getJobs: async () => [],
    getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    empty: async () => {}
  };

if (isTaskQueueEnabled) {

// 任务处理函数
reminderQueue.process('send-reminder', async (job) => {
  const { medicationId, userId, scheduledTime } = job.data;
  console.log(`处理药物提醒任务: ${medicationId} for user ${userId} at ${scheduledTime}`);

  try {
    // 获取药物信息
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('*')
      .eq('id', medicationId)
      .single();

    if (medError || !medication) {
      console.error('获取药物信息失败:', medError);
      return;
    }

    // 创建提醒记录
    const { data: reminderLog, error: logError } = await supabase
      .from('reminder_logs')
      .insert({
        medication_id: medicationId,
        scheduled_time: scheduledTime,
        status: 'pending'
      })
      .select('*')
      .single();

    if (logError) {
      console.error('创建提醒记录失败:', logError);
      return;
    }

    // 发送 WebSocket 通知（这里需要集成 WebSocket 服务）
    console.log(`发送提醒通知: ${medication.name} to user ${userId}`);

    // 调度 5 分钟后再次提醒的任务
    await reminderQueue.add('resend-reminder', {
      reminderLogId: reminderLog.id,
      medicationId: medicationId,
      userId: userId
    }, {
      delay: 5 * 60 * 1000 // 5分钟
    });

    // 调度 30 分钟后标记为错过的任务
    await reminderQueue.add('mark-missed', {
      reminderLogId: reminderLog.id
    }, {
      delay: 30 * 60 * 1000 // 30分钟
    });

  } catch (error) {
    console.error('处理提醒任务失败:', error);
  }
});

// 处理再次提醒任务
reminderQueue.process('resend-reminder', async (job) => {
  const { reminderLogId, medicationId, userId } = job.data;
  console.log(`处理再次提醒任务: ${reminderLogId}`);

  try {
    // 检查提醒记录状态
    const { data: reminderLog, error: logError } = await supabase
      .from('reminder_logs')
      .select('*')
      .eq('id', reminderLogId)
      .single();

    if (logError || !reminderLog) {
      console.error('获取提醒记录失败:', logError);
      return;
    }

    // 如果状态仍然是 pending，则再次提醒
    if (reminderLog.status === 'pending') {
      // 获取药物信息
      const { data: medication, error: medError } = await supabase
        .from('medications')
        .select('*')
        .eq('id', medicationId)
        .single();

      if (!medError && medication) {
        // 发送再次提醒的 WebSocket 通知
        console.log(`发送再次提醒通知: ${medication.name} to user ${userId}`);
      }
    }

  } catch (error) {
    console.error('处理再次提醒任务失败:', error);
  }
});

// 处理标记为错过的任务
reminderQueue.process('mark-missed', async (job) => {
  const { reminderLogId } = job.data;
  console.log(`处理标记错过任务: ${reminderLogId}`);

  try {
    // 检查提醒记录状态
    const { data: reminderLog, error: logError } = await supabase
      .from('reminder_logs')
      .select('*')
      .eq('id', reminderLogId)
      .single();

    if (logError || !reminderLog) {
      console.error('获取提醒记录失败:', logError);
      return;
    }

    // 如果状态仍然是 pending，则标记为 missed
    if (reminderLog.status === 'pending') {
      const { error: updateError } = await supabase
        .from('reminder_logs')
        .update({ status: 'missed' })
        .eq('id', reminderLogId);

      if (updateError) {
        console.error('标记为错过失败:', updateError);
      } else {
        console.log(`提醒已标记为错过: ${reminderLogId}`);
      }
    }

  } catch (error) {
    console.error('处理标记错过任务失败:', error);
  }
});

// 任务完成事件
reminderQueue.on('completed', (job) => {
  console.log(`任务完成: ${job.id} - ${job.name}`);
});

// 任务失败事件
reminderQueue.on('failed', (job, error) => {
  console.error(`任务失败: ${job.id} - ${job.name}`, error);
});
}

// 导出任务队列
export default reminderQueue;
