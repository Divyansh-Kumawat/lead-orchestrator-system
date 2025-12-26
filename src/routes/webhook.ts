import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { leadOrchestrationWorkflow } from '../workflows/leadOrchestration';
import { logger } from '../utils/logger';

export const webhookRouter = Router();

/**
 * POST /api/webhook/lead
 * Main webhook endpoint for capturing leads from website forms
 */
webhookRouter.post(
  '/lead',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('inquiry').trim().notEmpty().withMessage('Inquiry is required'),
    body('materialType').optional().trim()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, email, phone, inquiry, materialType } = req.body;

      logger.info('📥 New lead received via webhook', { email, name });

      // Extract metadata
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];

      // Trigger orchestration workflow
      const result = await leadOrchestrationWorkflow({
        name,
        email,
        phone,
        inquiry,
        materialType,
        source: 'website',
        ipAddress,
        userAgent
      });

      // Return success response immediately
      res.status(200).json({
        success: true,
        message: 'Thank you! We have received your inquiry and will get back to you shortly.',
        leadId: result.leadId,
        estimatedResponseTime: result.score >= 0.8 ? '5 minutes' : '24 hours'
      });

    } catch (error) {
      logger.error('❌ Webhook processing failed', { error });
      res.status(500).json({
        success: false,
        message: 'An error occurred while processing your request. Please try again.'
      });
    }
  }
);

/**
 * POST /api/webhook/whatsapp
 * Webhook for incoming WhatsApp messages from Twilio
 */
webhookRouter.post('/whatsapp', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    logger.info('📱 Incoming WhatsApp webhook', { from: From, messageSid: MessageSid });

    // Handle incoming message (update engagement, log interaction)
    // This would be processed asynchronously
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('❌ WhatsApp webhook failed', { error });
    res.status(500).send('Error');
  }
});

/**
 * GET /api/webhook/test
 * Test endpoint to verify webhook is working
 */
webhookRouter.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});