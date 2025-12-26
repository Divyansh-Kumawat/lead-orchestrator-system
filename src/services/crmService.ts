import axios from 'axios';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const CRM_API_URL = process.env.CRM_API_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;

/**
 * Sync lead to CRM system
 */
export async function syncToCRM(leadId: string): Promise<boolean> {
  try {
    if (!CRM_API_URL || !CRM_API_KEY) {
      logger.warn('CRM credentials not configured, skipping sync');
      return false;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        interactions: true,
        tasks: true
      }
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    logger.info('Syncing lead to CRM', { leadId });

    // Format lead data for CRM
    const crmPayload = {
      contact: {
        firstName: lead.name.split(' ')[0],
        lastName: lead.name.split(' ').slice(1).join(' ') || '',
        email: lead.email,
        phone: lead.phone,
        company: lead.companyName,
        linkedinUrl: lead.linkedinUrl
      },
      lead: {
        source: lead.source,
        status: lead.status,
        persona: lead.persona,
        intent: lead.intent,
        score: lead.leadScore,
        priority: lead.priority,
        location: lead.location,
        projectSize: lead.projectSize,
        budget: lead.budget,
        inquiry: lead.inquiry,
        materialType: lead.materialType
      },
      customFields: {
        yearsExperience: lead.yearsExperience,
        engagementScore: lead.engagementScore,
        nurtureStage: lead.nurtureStage
      },
      activities: lead.interactions.map(i => ({
        type: i.type,
        channel: i.channel,
        message: i.message,
        timestamp: i.createdAt
      }))
    };

    // Send to CRM API
    const response = await axios.post(`${CRM_API_URL}/leads`, crmPayload, {
      headers: {
        'Authorization': `Bearer ${CRM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Update lead with CRM ID
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        crmId: response.data.id,
        crmSyncedAt: new Date()
      }
    });

    logger.info('Lead synced to CRM successfully', { 
      leadId, 
      crmId: response.data.id 
    });

    return true;
  } catch (error) {
    logger.error('CRM sync failed', { error, leadId });
    return false;
  }
}

/**
 * Update lead status in CRM
 */
export async function updateCRMStatus(
  leadId: string,
  status: string
): Promise<boolean> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { crmId: true }
    });

    if (!lead?.crmId) {
      logger.warn('Lead not synced to CRM yet', { leadId });
      return false;
    }

    await axios.patch(
      `${CRM_API_URL}/leads/${lead.crmId}`,
      { status },
      {
        headers: {
          'Authorization': `Bearer ${CRM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('CRM status updated', { leadId, status });
    return true;
  } catch (error) {
    logger.error('CRM status update failed', { error, leadId });
    return false;
  }
}