import twilio from 'twilio';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

/**
 * Send WhatsApp message using Twilio
 */
export async function sendWhatsApp(
  to: string,
  message: string,
  leadId?: string
): Promise<boolean> {
  try {
    // Format phone number for WhatsApp
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    logger.info('📱 Sending WhatsApp message', { to: formattedTo, leadId });

    const result = await client.messages.create({
      from: WHATSAPP_FROM,
      to: formattedTo,
      body: message
    });

    logger.info('✅ WhatsApp message sent', {
      to: formattedTo,
      messageSid: result.sid,
      status: result.status
    });

    // Log interaction in database
    if (leadId) {
      await prisma.interaction.create({
        data: {
          leadId,
          type: 'INITIAL_RESPONSE',
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          message,
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            twilioSid: result.sid,
            twilioStatus: result.status
          }
        }
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          whatsappSent: true,
          lastContactedAt: new Date()
        }
      });
    }

    return true;
  } catch (error) {
    logger.error('❌ WhatsApp send failed', { error, to, leadId });
    return false;
  }
}

/**
 * Send WhatsApp message with media attachment
 */
export async function sendWhatsAppWithMedia(
  to: string,
  message: string,
  mediaUrl: string,
  leadId?: string
): Promise<boolean> {
  try {
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    logger.info('📱 Sending WhatsApp message with media', { to: formattedTo, mediaUrl });

    const result = await client.messages.create({
      from: WHATSAPP_FROM,
      to: formattedTo,
      body: message,
      mediaUrl: [mediaUrl]
    });

    logger.info('✅ WhatsApp message with media sent', {
      messageSid: result.sid,
      status: result.status
    });

    if (leadId) {
      await prisma.interaction.create({
        data: {
          leadId,
          type: 'TECHNICAL_INFO',
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          message,
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            twilioSid: result.sid,
            mediaUrl
          }
        }
      });
    }

    return true;
  } catch (error) {
    logger.error('❌ WhatsApp with media send failed', { error, to });
    return false;
  }
}

/**
 * Handle incoming WhatsApp messages (webhook)
 */
export async function handleIncomingWhatsApp(data: any) {
  try {
    const from = data.From;
    const body = data.Body;
    const messageSid = data.MessageSid;

    logger.info('📥 Incoming WhatsApp message', { from, messageSid });

    // Find lead by phone number
    const phoneNumber = from.replace('whatsapp:', '');
    const lead = await prisma.lead.findFirst({
      where: { phone: phoneNumber },
      orderBy: { createdAt: 'desc' }
    });

    if (lead) {
      // Log interaction
      await prisma.interaction.create({
        data: {
          leadId: lead.id,
          type: 'FOLLOW_UP',
          channel: 'WHATSAPP',
          direction: 'INBOUND',
          message: body,
          status: 'DELIVERED',
          deliveredAt: new Date(),
          metadata: { twilioSid: messageSid }
        }
      });

      // Update engagement score
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          engagementScore: {
            increment: 0.1
          }
        }
      });

      logger.info('✅ Incoming WhatsApp logged', { leadId: lead.id });
    }

    return true;
  } catch (error) {
    logger.error('❌ Handle incoming WhatsApp failed', { error });
    return false;
  }
}