import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const analyticsRouter = Router();

/**
 * GET /api/analytics/conversion-rates
 * Get conversion rates by persona and intent
 */
analyticsRouter.get('/conversion-rates', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause: any = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    // Overall conversion rate
    const totalLeads = await prisma.lead.count({ where: whereClause });
    const convertedLeads = await prisma.lead.count({
      where: { ...whereClause, status: 'CONVERTED' }
    });

    // By persona
    const byPersona = await prisma.lead.groupBy({
      by: ['persona'],
      where: whereClause,
      _count: true
    });

    const conversionByPersona = await Promise.all(
      byPersona.map(async (p) => {
        const converted = await prisma.lead.count({
          where: {
            ...whereClause,
            persona: p.persona,
            status: 'CONVERTED'
          }
        });
        return {
          persona: p.persona,
          total: p._count,
          converted,
          rate: ((converted / p._count) * 100).toFixed(2)
        };
      })
    );

    // By intent
    const byIntent = await prisma.lead.groupBy({
      by: ['intent'],
      where: whereClause,
      _count: true
    });

    const conversionByIntent = await Promise.all(
      byIntent.map(async (i) => {
        const converted = await prisma.lead.count({
          where: {
            ...whereClause,
            intent: i.intent,
            status: 'CONVERTED'
          }
        });
        return {
          intent: i.intent,
          total: i._count,
          converted,
          rate: ((converted / i._count) * 100).toFixed(2)
        };
      })
    );

    res.json({
      success: true,
      data: {
        overall: {
          total: totalLeads,
          converted: convertedLeads,
          rate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0
        },
        byPersona: conversionByPersona,
        byIntent: conversionByIntent
      }
    });
  } catch (error) {
    logger.error('Failed to fetch conversion rates', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/response-times
 * Get average response times
 */
analyticsRouter.get('/response-times', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        lastContactedAt: { not: null }
      },
      select: {
        persona: true,
        priority: true,
        createdAt: true,
        lastContactedAt: true
      }
    });

    // Calculate by persona
    const byPersona: Record<string, number[]> = {};
    const byPriority: Record<string, number[]> = {};

    leads.forEach((lead) => {
      const responseTime = (lead.lastContactedAt!.getTime() - lead.createdAt.getTime()) / 1000 / 60; // minutes

      if (lead.persona) {
        if (!byPersona[lead.persona]) byPersona[lead.persona] = [];
        byPersona[lead.persona].push(responseTime);
      }

      if (!byPriority[lead.priority]) byPriority[lead.priority] = [];
      byPriority[lead.priority].push(responseTime);
    });

    const avgByPersona = Object.entries(byPersona).map(([persona, times]) => ({
      persona,
      avgMinutes: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      count: times.length
    }));

    const avgByPriority = Object.entries(byPriority).map(([priority, times]) => ({
      priority,
      avgMinutes: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      count: times.length
    }));

    res.json({
      success: true,
      data: {
        byPersona: avgByPersona,
        byPriority: avgByPriority
      }
    });
  } catch (error) {
    logger.error('Failed to fetch response times', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/funnel
 * Get lead funnel metrics
 */
analyticsRouter.get('/funnel', async (req, res) => {
  try {
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURING', 'HOT', 'CONVERTED', 'LOST'];

    const funnelData = await Promise.all(
      statuses.map(async (status) => {
        const count = await prisma.lead.count({ where: { status: status as any } });
        return { status, count };
      })
    );

    const totalLeads = funnelData.reduce((sum, stage) => sum + stage.count, 0);

    const funnelWithPercentages = funnelData.map((stage) => ({
      ...stage,
      percentage: totalLeads > 0 ? ((stage.count / totalLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        funnel: funnelWithPercentages,
        totalLeads
      }
    });
  } catch (error) {
    logger.error('Failed to fetch funnel data', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/engagement
 * Get engagement metrics
 */
analyticsRouter.get('/engagement', async (req, res) => {
  try {
    // Channel performance
    const channelStats = await prisma.interaction.groupBy({
      by: ['channel', 'status'],
      _count: true
    });

    // Message types
    const messageTypes = await prisma.interaction.groupBy({
      by: ['type'],
      _count: true
    });

    // Engagement scores distribution
    const engagementDistribution = await prisma.lead.groupBy({
      by: ['persona'],
      _avg: {
        engagementScore: true
      },
      _count: true
    });

    res.json({
      success: true,
      data: {
        channelStats,
        messageTypes,
        engagementDistribution
      }
    });
  } catch (error) {
    logger.error('Failed to fetch engagement metrics', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/roi
 * Calculate ROI metrics
 */
analyticsRouter.get('/roi', async (req, res) => {
  try {
    const totalLeads = await prisma.lead.count();
    const convertedLeads = await prisma.lead.count({ where: { status: 'CONVERTED' } });
    const lostLeads = await prisma.lead.count({ where: { status: 'LOST' } });

    // Assuming average deal value (this would come from CRM in production)
    const avgDealValue = 800000; // ₹8L
    const marketingSpend = 5000000; // ₹50L (from env or config)

    const revenue = convertedLeads * avgDealValue;
    const roi = ((revenue - marketingSpend) / marketingSpend) * 100;

    // Lead capture rate
    const captureRate = totalLeads > 0 ? ((totalLeads - lostLeads) / totalLeads) * 100 : 0;

    // Conversion rate
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        convertedLeads,
        lostLeads,
        captureRate: captureRate.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
        revenue,
        marketingSpend,
        roi: roi.toFixed(2),
        revenuePerLead: totalLeads > 0 ? Math.round(revenue / totalLeads) : 0
      }
    });
  } catch (error) {
    logger.error('Failed to calculate ROI', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});