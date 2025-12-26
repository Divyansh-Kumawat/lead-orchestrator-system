import { Mastra } from '@mastra/core';
import { classifyLead, generatePersonalizedMessage } from '../ai/classifier';
import { enrichLead } from '../services/enrichmentService';
import { sendWhatsApp } from '../communication/whatsapp';
import { sendEmail } from '../communication/email';
import { createTask } from '../services/taskService';
import { syncToCRM } from '../services/crmService';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Main Lead Orchestration Workflow
 * Handles the complete journey from lead capture to conversion
 */
export async function leadOrchestrationWorkflow(leadData: {
  name: string;
  email: string;
  phone: string;
  inquiry: string;
  materialType?: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    logger.info('🚀 Starting lead orchestration workflow', { email: leadData.email });

    // STEP 1: Create lead in database
    const lead = await prisma.lead.create({
      data: {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        inquiry: leadData.inquiry,
        materialType: leadData.materialType,
        source: leadData.source || 'website',
        ipAddress: leadData.ipAddress,
        userAgent: leadData.userAgent,
        status: 'NEW'
      }
    });

    logger.info('✅ Lead created in database', { leadId: lead.id });

    // STEP 2: AI Classification
    const classification = await classifyLead(leadData);
    
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        persona: classification.persona,
        intent: classification.intent,
        leadScore: classification.leadScore,
        location: classification.extractedEntities.location,
        projectSize: classification.extractedEntities.projectSize,
        budget: classification.extractedEntities.budget,
        priority: classification.leadScore >= 0.8 ? 'HIGH' : 
                  classification.leadScore >= 0.5 ? 'MEDIUM' : 'LOW'
      }
    });

    logger.info('✅ AI classification completed', {
      leadId: lead.id,
      persona: classification.persona,
      intent: classification.intent,
      score: classification.leadScore
    });

    // STEP 3: Lead Enrichment (Async - don't wait)
    enrichLead(lead.id, leadData.email, leadData.phone).catch(err => {
      logger.error('Lead enrichment failed', { leadId: lead.id, error: err });
    });

    // STEP 4: Intelligent Routing Decision
    const highValueThreshold = parseFloat(process.env.HIGH_VALUE_THRESHOLD || '0.8');

    if (classification.persona === 'ARCHITECT' && classification.leadScore >= highValueThreshold) {
      // HIGH-VALUE ARCHITECT: Human-in-the-Loop
      logger.info('🎯 High-value architect detected - routing to sales manager', { leadId: lead.id });

      await createTask({
        leadId: lead.id,
        title: `🔥 High-Value Architect Lead: ${leadData.name}`,
        description: `**Persona:** Architect\n**Score:** ${classification.leadScore}\n**Intent:** ${classification.intent}\n\n**Inquiry:**\n${leadData.inquiry}\n\n**Extracted Info:**\n${JSON.stringify(classification.extractedEntities, null, 2)}\n\n**Action Required:** Contact within 5 minutes for maximum conversion probability.`,
        type: 'REVIEW_LEAD',
        priority: 'URGENT',
        dueAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });

      // Send instant WhatsApp acknowledgment
      const message = `Hi ${leadData.name}! 👋\n\nThank you for reaching out. I can see you're working on an exciting project!\n\nOur senior technical consultant will call you within the next 5 minutes to discuss your requirements in detail.\n\nMeanwhile, I'm sharing our comprehensive technical catalog: [Download PDF]\n\nLooking forward to working with you!\n\n- Team [Brand Name]`;

      await sendWhatsApp(leadData.phone, message, lead.id);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'HOT' }
      });

    } else if (classification.intent === 'TECHNICAL_SPECS') {
      // TECHNICAL INQUIRY: Auto-send specs
      logger.info('📄 Technical specs requested - auto-sending', { leadId: lead.id });

      const message = await generatePersonalizedMessage(
        classification.persona,
        classification.intent,
        leadData.name,
        classification.extractedEntities
      );

      await sendWhatsApp(leadData.phone, message, lead.id);
      
      // Also send detailed email with attachments
      await sendEmail({
        to: leadData.email,
        subject: `Technical Specifications - ${leadData.materialType || 'Materials'}`,
        template: 'technical-specs',
        data: {
          name: leadData.name,
          materialType: leadData.materialType,
          inquiry: leadData.inquiry
        },
        leadId: lead.id
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'CONTACTED' }
      });

      // Schedule follow-up for 3 days
      scheduleFollowUp(lead.id, 3);

    } else if (classification.intent === 'PRICE_INQUIRY') {
      // PRICE INQUIRY: Send pricing info + schedule call
      logger.info('💰 Price inquiry - sending pricing info', { leadId: lead.id });

      const message = await generatePersonalizedMessage(
        classification.persona,
        classification.intent,
        leadData.name,
        classification.extractedEntities
      );

      await sendWhatsApp(leadData.phone, message, lead.id);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'CONTACTED' }
      });

      // Create task for sales rep to call with quote
      await createTask({
        leadId: lead.id,
        title: `Call for Price Quote: ${leadData.name}`,
        description: `Lead is interested in pricing for ${leadData.materialType}.\n\nProject details:\n${JSON.stringify(classification.extractedEntities, null, 2)}`,
        type: 'CALL_LEAD',
        priority: classification.leadScore >= 0.5 ? 'HIGH' : 'MEDIUM',
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

    } else {
      // GENERAL/EXPLORATORY: Start nurture sequence
      logger.info('🌱 Starting nurture sequence', { leadId: lead.id });

      const message = await generatePersonalizedMessage(
        classification.persona,
        classification.intent,
        leadData.name,
        classification.extractedEntities
      );

      await sendWhatsApp(leadData.phone, message, lead.id);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { 
          status: 'NURTURING',
          nurtureStage: 1
        }
      });

      // Start automated nurture campaign
      startNurtureCampaign(lead.id, classification.persona);
    }

    // STEP 5: Sync to CRM
    syncToCRM(lead.id).catch(err => {
      logger.error('CRM sync failed', { leadId: lead.id, error: err });
    });

    logger.info('✅ Lead orchestration workflow completed', { leadId: lead.id });

    return {
      success: true,
      leadId: lead.id,
      persona: classification.persona,
      intent: classification.intent,
      score: classification.leadScore,
      status: lead.status
    };

  } catch (error) {
    logger.error('❌ Lead orchestration workflow failed', { error });
    throw error;
  }
}

/**
 * Schedule follow-up for a lead
 */
async function scheduleFollowUp(leadId: string, daysFromNow: number) {
  const dueDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  
  await createTask({
    leadId,
    title: `Follow-up: Check engagement`,
    description: `Follow up with this lead to check if they need any additional information.`,
    type: 'FOLLOW_UP',
    priority: 'MEDIUM',
    dueAt: dueDate
  });

  logger.info('📅 Follow-up scheduled', { leadId, daysFromNow });
}

/**
 * Start automated nurture campaign
 */
async function startNurtureCampaign(leadId: string, persona: string) {
  // This would integrate with a job queue (Bull, BullMQ, etc.)
  // For now, we'll create scheduled tasks
  
  const nurtureSchedule = [
    { day: 1, message: 'design_inspiration' },
    { day: 3, message: 'budget_calculator' },
    { day: 5, message: 'customer_testimonials' },
    { day: 7, message: 'dealer_locator' }
  ];

  for (const stage of nurtureSchedule) {
    const dueDate = new Date(Date.now() + stage.day * 24 * 60 * 60 * 1000);
    
    await createTask({
      leadId,
      title: `Nurture Day ${stage.day}: ${stage.message}`,
      description: `Send ${stage.message} content to nurture this ${persona} lead.`,
      type: 'FOLLOW_UP',
      priority: 'LOW',
      dueAt: dueDate
    });
  }

  logger.info('🌱 Nurture campaign started', { leadId, stages: nurtureSchedule.length });
}