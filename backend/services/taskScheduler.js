import reminderQueue from '../utils/taskQueue.js';
import supabase from '../utils/supabase.js';

class TaskScheduler {
  constructor(websocketService) {
    this.websocketService = websocketService;
  }

  // 为药物创建提醒任务
  async scheduleMedicationReminders(medication) {
    try {
      // 首先删除该药物的所有现有任务
      await this.removeMedicationReminders(medication.id);

      // 如果药物未启用，不创建任务
      if (!medication.is_active) {
        return;
      }

      // 为每个提醒时间创建任务
      if (medication.reminder_times && medication.reminder_times.length > 0) {
        for (const timeStr of medication.reminder_times) {
          // 解析时间字符串
          const [hours, minutes] = timeStr.split(':').map(Number);
          
          // 计算下次提醒的时间
          const now = new Date();
          const scheduledTime = new Date();
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          // 如果时间已过，设置为明天
          if (scheduledTime < now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
          }

          // 计算延迟时间
          const delay = scheduledTime - now;

          // 添加任务到队列
          await reminderQueue.add('send-reminder', {
            medicationId: medication.id,
            userId: medication.user_id,
            scheduledTime: scheduledTime.toISOString()
          }, {
            delay,
            repeat: {
              cron: `${minutes} ${hours} * * *` // 每天在指定时间执行
            }
          });

          console.log(`为药物 ${medication.name} 创建提醒任务，时间: ${scheduledTime}`);
        }
      }
    } catch (error) {
      console.error('创建药物提醒任务失败:', error);
      throw error;
    }
  }

  // 删除药物的所有提醒任务
  async removeMedicationReminders(medicationId) {
    try {
      // 获取所有任务
      const jobs = await reminderQueue.getJobs();
      
      // 过滤出该药物的任务并删除
      for (const job of jobs) {
        if (job.data.medicationId === medicationId) {
          await job.remove();
          console.log(`删除药物 ${medicationId} 的提醒任务: ${job.id}`);
        }
      }
    } catch (error) {
      console.error('删除药物提醒任务失败:', error);
      throw error;
    }
  }

  // 批量处理药物提醒任务
  async processMedications(medications) {
    try {
      for (const medication of medications) {
        await this.scheduleMedicationReminders(medication);
      }
    } catch (error) {
      console.error('批量处理药物提醒任务失败:', error);
      throw error;
    }
  }

  // 获取任务队列状态
  async getQueueStatus() {
    try {
      const jobs = await reminderQueue.getJobs();
      const stats = await reminderQueue.getJobCounts();

      return {
        jobs: jobs.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: job.status,
          timestamp: job.timestamp
        })),
        stats
      };
    } catch (error) {
      console.error('获取队列状态失败:', error);
      throw error;
    }
  }

  // 发送提醒通知
  sendReminderNotification(medication, reminderLog, userId) {
    if (this.websocketService) {
      // 发送给父母端
      this.websocketService.sendToUser(userId, {
        type: 'medication_reminder',
        data: {
          medication,
          reminder_log: reminderLog,
          message: `请记得服用 ${medication.name}，剂量：${medication.dosage}`
        }
      });

      // 查找同一家庭组的子女用户并通知
      this.findFamilyMembers(userId, 'child').then(children => {
        children.forEach(childId => {
          this.websocketService.sendToUser(childId, {
            type: 'parent_medication_reminder',
            data: {
              medication,
              reminder_log: reminderLog,
              message: `您的家人需要服用 ${medication.name}，请提醒他们`
            }
          });
        });
      });
    }
  }

  // 查找家庭成员
  async findFamilyMembers(userId, role) {
    try {
      // 获取用户资料
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('family_group_id')
        .eq('id', userId)
        .single();

      if (userError || !user || !user.family_group_id) {
        return [];
      }

      // 获取同一家庭组的指定角色成员
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_group_id', user.family_group_id)
        .eq('role', role);

      if (membersError) {
        return [];
      }

      return members.map(member => member.id);
    } catch (error) {
      console.error('查找家庭成员失败:', error);
      return [];
    }
  }
}

// 导出单例实例
const taskScheduler = new TaskScheduler();
export default taskScheduler;