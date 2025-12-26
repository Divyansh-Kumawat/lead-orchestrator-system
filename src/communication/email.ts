import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  data: any;
  leadId?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

/**
 * Send email with template
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    logger.info('📧 Sending email', { to: options.to, template: options.template });

    const htmlContent = generateEmailHTML(options.template, options.data);

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: htmlContent,
      attachments: options.attachments
    };

    const result = await transporter.sendMail(mailOptions);

    logger.info('✅ Email sent successfully', {
      to: options.to,
      messageId: result.messageId
    });

    // Log interaction
    if (options.leadId) {
      await prisma.interaction.create({
        data: {
          leadId: options.leadId,
          type: options.template === 'technical-specs' ? 'TECHNICAL_INFO' : 'INITIAL_RESPONSE',
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          subject: options.subject,
          message: htmlContent,
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            messageId: result.messageId,
            template: options.template
          }
        }
      });

      await prisma.lead.update({
        where: { id: options.leadId },
        data: {
          emailSent: true,
          lastContactedAt: new Date()
        }
      });
    }

    return true;
  } catch (error) {
    logger.error('❌ Email send failed', { error, to: options.to });
    return false;
  }
}

/**
 * Generate HTML email content from template
 */
function generateEmailHTML(template: string, data: any): string {
  const templates: Record<string, (data: any) => string> = {
    'technical-specs': (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Technical Specifications</h1>
          </div>
          <div class="content">
            <p>Dear ${data.name},</p>
            <p>Thank you for your interest in our ${data.materialType || 'products'}.</p>
            <p>As requested, please find attached the complete technical specifications and documentation.</p>
            
            <h3>What's Included:</h3>
            <ul>
              <li>Product specifications and dimensions</li>
              <li>Installation guidelines</li>
              <li>Maintenance instructions</li>
              <li>Warranty information</li>
              <li>CAD files (DWG format)</li>
            </ul>

            <p><strong>Your Inquiry:</strong><br>${data.inquiry}</p>

            <a href="#" class="button">Download Complete Catalog</a>

            <p>Our technical team is available to answer any questions you may have. Feel free to reply to this email or call us directly.</p>

            <p>Best regards,<br>Technical Team<br>[Your Brand Name]</p>
          </div>
          <div class="footer">
            <p>© 2024 [Your Brand Name]. All rights reserved.</p>
            <p>This email was sent because you submitted an inquiry on our website.</p>
          </div>
        </div>
      </body>
      </html>
    `,

    'welcome': (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to [Brand Name]!</h1>
          </div>
          <div class="content">
            <p>Dear ${data.name},</p>
            <p>Thank you for reaching out to us. We've received your inquiry and our team is reviewing it.</p>
            <p>We'll get back to you within 24 hours with the information you need.</p>
            <p>In the meantime, feel free to explore our website or contact us directly if you have urgent questions.</p>
            <p>Best regards,<br>Team [Brand Name]</p>
          </div>
          <div class="footer">
            <p>© 2024 [Your Brand Name]. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,

    'nurture-day3': (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Budget Planning Made Easy</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>Planning your project budget? We've created a simple calculator to help you estimate costs for your ${data.materialType || 'flooring'} project.</p>
            
            <a href="#" class="button">Try Our Budget Calculator</a>

            <p>Plus, check out these helpful resources:</p>
            <ul>
              <li>Cost comparison guide</li>
              <li>Installation cost estimator</li>
              <li>Financing options</li>
            </ul>

            <p>Have questions? Just reply to this email!</p>

            <p>Best regards,<br>Team [Brand Name]</p>
          </div>
          <div class="footer">
            <p>© 2024 [Your Brand Name]. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  const templateFn = templates[template] || templates['welcome'];
  return templateFn(data);
}