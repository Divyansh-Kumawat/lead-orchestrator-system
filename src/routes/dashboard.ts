import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/pending-leads
 * Get all pending high-value leads requiring human attention
 */
dashboardRouter.get('/pending-leads', async (req, res) => {
  try {
    const pendingLeads = await prisma.lead.findMany({
      where: {
        status: {
          in: ['NEW', 'HOT']
        },
        priority: {
          in: ['HIGH', 'URGENT']
        }
      },
      include: {
        tasks: {
          where: {
            status: 'PENDING'
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        interactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      },
      orderBy: [
        { priority: 'desc' },
        { leadScore: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 50
    });

    res.json({
      success: true,
      count: pendingLeads.length,
      leads: pendingLeads
    });
  } catch (error) {
    logger.error('Failed to fetch pending leads', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch leads' });
  }
});

/**
 * GET /api/dashboard/lead/:id
 * Get detailed information about a specific lead
 */
dashboardRouter.get('/lead/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        interactions: {
          orderBy: { createdAt: 'desc' }
        },
        tasks: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({
      success: true,
      lead
    });
  } catch (error) {
    logger.error('Failed to fetch lead details', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch lead' });
  }
});

/**
 * POST /api/dashboard/approve-lead/:id
 * Approve a high-value lead and assign to sales rep
 */
dashboardRouter.post('/approve-lead/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, notes } = req.body;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status: 'QUALIFIED',
        assignedTo,
        updatedAt: new Date()
      }
    });

    // Update associated task
    await prisma.task.updateMany({
      where: {
        leadId: id,
        status: 'PENDING'
      },
      data: {
        status: 'IN_PROGRESS',
        assignedTo,
        notes
      }
    });

    logger.info('Lead approved and assigned', { leadId: id, assignedTo });

    res.json({
      success: true,
      message: 'Lead approved successfully',
      lead
    });
  } catch (error) {
    logger.error('Failed to approve lead', { error });
    res.status(500).json({ success: false, error: 'Failed to approve lead' });
  }
});

/**
 * POST /api/dashboard/reject-lead/:id
 * Reject a lead (mark as spam or not qualified)
 */
dashboardRouter.post('/reject-lead/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status: reason === 'spam' ? 'SPAM' : 'LOST',
        updatedAt: new Date()
      }
    });

    // Cancel associated tasks
    await prisma.task.updateMany({
      where: {
        leadId: id,
        status: 'PENDING'
      },
      data: {
        status: 'CANCELLED',
        notes: `Rejected: ${reason}`
      }
    });

    logger.info('Lead rejected', { leadId: id, reason });

    res.json({
      success: true,
      message: 'Lead rejected',
      lead
    });
  } catch (error) {
    logger.error('Failed to reject lead', { error });
    res.status(500).json({ success: false, error: 'Failed to reject lead' });
  }
});

/**
 * GET /api/dashboard/tasks
 * Get all pending tasks for the sales team
 */
dashboardRouter.get('/tasks', async (req, res) => {
  try {
    const { assignedTo, status } = req.query;

    const tasks = await prisma.task.findMany({
      where: {
        ...(assignedTo && { assignedTo: assignedTo as string }),
        ...(status && { status: status as any })
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
            leadScore: true,
            status: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueAt: 'asc' }
      ]
    });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    logger.error('Failed to fetch tasks', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/dashboard/task/:id/complete
 * Mark a task as completed
 */
dashboardRouter.post('/task/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes
      }
    });

    logger.info('Task completed', { taskId: id });

    res.json({
      success: true,
      message: 'Task completed',
      task
    });
  } catch (error) {
    logger.error('Failed to complete task', { error });
    res.status(500).json({ success: false, error: 'Failed to complete task' });
  }
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
dashboardRouter.get('/stats', async (req, res) => {
  try {
    const [
      totalLeads,
      newLeads,
      hotLeads,
      convertedLeads,
      pendingTasks,
      avgResponseTime
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.lead.count({ where: { status: 'HOT' } }),
      prisma.lead.count({ where: { status: 'CONVERTED' } }),
      prisma.task.count({ where: { status: 'PENDING' } }),
      calculateAvgResponseTime()
    ]);

    // Persona breakdown
    const personaBreakdown = await prisma.lead.groupBy({
      by: ['persona'],
      _count: true
    });

    // Intent breakdown
    const intentBreakdown = await prisma.lead.groupBy({
      by: ['intent'],
      _count: true
    });

    res.json({
      success: true,
      stats: {
        totalLeads,
        newLeads,
        hotLeads,
        convertedLeads,
        pendingTasks,
        avgResponseTime,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(2) : 0,
        personaBreakdown,
        intentBreakdown
      }
    });
  } catch (error) {
    logger.error('Failed to fetch stats', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

async function calculateAvgResponseTime(): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: {
      lastContactedAt: { not: null }
    },
    select: {
      createdAt: true,
      lastContactedAt: true
    }
  });

  if (leads.length === 0) return 0;

  const totalMinutes = leads.reduce((sum, lead) => {
    const diff = lead.lastContactedAt!.getTime() - lead.createdAt.getTime();
    return sum + (diff / 1000 / 60); // Convert to minutes
  }, 0);

  return Math.round(totalMinutes / leads.length);
}