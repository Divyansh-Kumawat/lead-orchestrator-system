import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Classification schema
const ClassificationSchema = z.object({
  persona: z.enum(['HOMEOWNER', 'ARCHITECT', 'CONTRACTOR', 'DEALER', 'UNKNOWN']),
  intent: z.enum([
    'PRICE_INQUIRY',
    'SAMPLE_REQUEST',
    'TECHNICAL_SPECS',
    'DESIGN_HELP',
    'INSTALLATION_QUERY',
    'DEALER_LOCATOR',
    'COMPLAINT',
    'GENERAL_INQUIRY'
  ]),
  leadScore: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedEntities: z.object({
    location: z.string().optional(),
    projectSize: z.string().optional(),
    budget: z.string().optional(),
    materialType: z.string().optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
  })
});

export type Classification = z.infer<typeof ClassificationSchema>;

/**
 * AI-powered lead classification using GPT-4
 * Analyzes inquiry text to determine persona, intent, and lead score
 */
export async function classifyLead(leadData: {
  name: string;
  email: string;
  phone: string;
  inquiry: string;
  materialType?: string;
}): Promise<Classification> {
  try {
    logger.info('Starting AI classification', { leadEmail: leadData.email });

    const prompt = `You are an expert lead qualification system for material brands (flooring, laminates, lighting) in India.

Analyze this inquiry and classify the lead:

Name: ${leadData.name}
Email: ${leadData.email}
Phone: ${leadData.phone}
Inquiry: ${leadData.inquiry}
Material Type: ${leadData.materialType || 'Not specified'}

PERSONA DEFINITIONS:
- HOMEOWNER: Individual buying for personal use, single project, residential focus
- ARCHITECT: Professional specifying materials for multiple projects, B2B influencer
- CONTRACTOR: Bulk procurement, execution-focused, commercial or residential
- DEALER: Reseller or distributor looking for partnership
- UNKNOWN: Cannot determine from available information

INTENT CATEGORIES:
- PRICE_INQUIRY: Asking about pricing, quotes, discounts
- SAMPLE_REQUEST: Wants physical samples or swatches
- TECHNICAL_SPECS: Needs specifications, CAD files, technical documentation
- DESIGN_HELP: Seeking design inspiration, color matching, aesthetic guidance
- INSTALLATION_QUERY: Questions about installation process, contractors
- DEALER_LOCATOR: Looking for nearby dealers or showrooms
- COMPLAINT: Issue with product or service
- GENERAL_INQUIRY: Exploratory, not specific intent

LEAD SCORING (0-1):
- 0.9-1.0: Architect with large project, clear budget, immediate need
- 0.7-0.89: Contractor with bulk order, or architect with smaller project
- 0.5-0.69: Homeowner with clear intent and budget
- 0.3-0.49: Exploratory inquiry, no clear budget or timeline
- 0.0-0.29: Very vague, likely spam, or no purchase intent

ENTITY EXTRACTION:
Extract location, project size (sq ft or units), budget range, and urgency from the inquiry.

Provide detailed reasoning for your classification.`;

    const result = await generateObject({
      model: openai('gpt-4-turbo'),
      schema: ClassificationSchema,
      prompt
    });

    logger.info('AI classification completed', {
      leadEmail: leadData.email,
      persona: result.object.persona,
      intent: result.object.intent,
      score: result.object.leadScore
    });

    return result.object;
  } catch (error) {
    logger.error('AI classification failed', { error, leadEmail: leadData.email });
    
    // Fallback classification
    return {
      persona: 'UNKNOWN',
      intent: 'GENERAL_INQUIRY',
      leadScore: 0.3,
      reasoning: 'Classification failed, using fallback values',
      extractedEntities: {}
    };
  }
}

/**
 * Generate personalized response message based on persona and intent
 */
export async function generatePersonalizedMessage(
  persona: string,
  intent: string,
  name: string,
  extractedEntities: any
): Promise<string> {
  try {
    const prompt = `Generate a warm, professional WhatsApp message for a ${persona} with ${intent} intent.

Lead Name: ${name}
Context: ${JSON.stringify(extractedEntities)}

Requirements:
- Keep it under 150 words
- Use conversational tone suitable for WhatsApp
- Address their specific intent
- Include a clear next step
- Use Indian English conventions
- Be helpful and not pushy

Do not include greetings like "Hi" or "Hello" - start directly with the message content.`;

    const result = await generateObject({
      model: openai('gpt-4-turbo'),
      schema: z.object({
        message: z.string()
      }),
      prompt
    });

    return result.object.message;
  } catch (error) {
    logger.error('Message generation failed', { error });
    return `Thank you for your inquiry! Our team will get back to you shortly with the information you need.`;
  }
}