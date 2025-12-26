import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

interface CreateTaskInput {
  leadId: string;
  title: string;
  description: string;
  type: 'CALL_LEAD' | 'SEND_QUOTE' | 'SCHEDULE_MEETING' | 'SEND_SAMPLES' | 'FOLLOW_UP' | 'APPROVE_DISCOUNT' | 'REVIEW_LEAD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  dueAt?: Date;
}

/**
 * Create a new task for human-in-the-loop actions
 */
export async function createTask(input: CreateTaskInput) {
  try {
    const task = await prisma.task.create({
      data: {
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        assignedTo: input.assignedTo,
        dueAt: input.dueAt,
        status: 'PENDING'
      }
    });

    logger.info('Task created', {
      taskId: task.id,
      leadId: input.leadId,
      type: input.type,
      priority: input.priority
    });

    // In production, you would send notifications here:
    // - Email to assigned sales rep
    // - Slack notification
    // - Push notification to mobile app

    return task;
  } catch (error) {
    logger.error('Failed to create task', { error, input });
    throw error;
  }
}

/**
 * Get pending tasks for a user
 */
export async function getPendingTasks(assignedTo?: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        status: 'PENDING',
        ...(assignedTo && { assignedTo })
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            persona: true,
            intent: true,
            leadScore: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueAt: 'asc' }
      ]
    });

    return tasks;
  } catch (error) {
    logger.error('Failed to fetch pending tasks', { error });
    throw error;
  }
}

/**
 * Complete a task
 */
export async function completeTask(taskId: string, notes?: string) {
  try {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes
      }
    });

    logger.info('Task completed', { taskId });
    return task;
  } catch (error) {
    logger.error('Failed to complete task', { error, taskId });
    throw error;
  }
}