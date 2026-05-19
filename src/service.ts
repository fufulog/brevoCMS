import { BrevoClient } from './brevoClient.js';
import { EmailTemplateRepository } from './repository.js';
import { SDKConfig, CombinedTemplate, CreateTemplateInput, UpdateTemplateInput, BrevoSender } from './types.js';

export class EmailTemplateService {
  private brevoClient: BrevoClient;
  private repository: EmailTemplateRepository;
  private defaultSender: { name?: string; email: string };

  constructor(config: SDKConfig) {
    this.brevoClient = new BrevoClient(config.brevoApiKey);
    this.repository = new EmailTemplateRepository(config);
    this.defaultSender = config.defaultSender;
  }

  /**
   * Syncs and returns all templates with their event mappings.
   * Performs Just-In-Time (JIT) mapping creation for any templates missing in local DB.
   */
  async listTemplates(): Promise<CombinedTemplate[]> {
    // 1. Fetch remote templates from Brevo
    const brevoTemplates = await this.brevoClient.getTemplates();
    
    // 2. Fetch local mappings
    const localMappings = await this.repository.getAllMappings();
    const mappingMap = new Map(localMappings.map((m) => [m.template_id, m]));

    const combined: CombinedTemplate[] = [];

    for (const bt of brevoTemplates) {
      let mapping = mappingMap.get(bt.id);

      // 3. JIT Mapping Creation: If template exists on Brevo but not locally
      if (!mapping) {
        await this.repository.insertJITMapping(bt.id);
        mapping = {
          template_id: bt.id,
          event_name: '',
          is_active: false,
        };
      }

      combined.push({
        templateId: bt.id,
        templateName: bt.name,
        subject: bt.subject,
        eventName: mapping.event_name,
        isActive: bt.isActive && mapping.is_active, // Sync state
        sender: bt.sender,
      });
    }

    return combined;
  }

  /**
   * Fetch a single combined template by ID.
   * Creates JIT mapping if it is not in local DB.
   */
  async getTemplate(id: number): Promise<CombinedTemplate> {
    const bt = await this.brevoClient.getTemplate(id);
    let mapping = await this.repository.getMappingByTemplateId(id);

    if (!mapping) {
      await this.repository.insertJITMapping(id);
      mapping = {
        template_id: id,
        event_name: '',
        is_active: false,
      };
    }

    return {
      templateId: bt.id,
      templateName: bt.name,
      subject: bt.subject,
      eventName: mapping.event_name,
      isActive: bt.isActive && mapping.is_active,
      sender: bt.sender,
      htmlContent: bt.htmlContent,
    };
  }

  /**
   * Create a new Brevo Template and its corresponding local DB mapping
   */
  async createTemplate(input: CreateTemplateInput): Promise<CombinedTemplate> {
    const name = input.name || 'New Untitled Template';
    const subject = input.subject || 'Drafting Layout';
    const senderEmail = input.senderEmail || this.defaultSender.email;
    const senderName = input.senderName || this.defaultSender.name;

    const htmlContent = '<html><body><p>Drafting...</p></body></html>';

    // 1. Create on Brevo
    const templateId = await this.brevoClient.createTemplate({
      templateName: name,
      subject: subject,
      sender: { name: senderName, email: senderEmail },
      htmlContent: htmlContent,
      isActive: false,
    });

    // 2. Insert mapping in local DB
    await this.repository.upsertMapping(templateId, '', false);

    return {
      templateId: templateId,
      templateName: name,
      subject: subject,
      eventName: '',
      isActive: false,
      sender: { name: senderName || '', email: senderEmail },
      htmlContent: htmlContent,
    };
  }

  /**
   * Update an existing template in Brevo and the local mapping DB
   */
  async updateTemplate(id: number, input: UpdateTemplateInput): Promise<CombinedTemplate> {
    // Constraint: Template name cannot be blank
    if (!input.templateName || input.templateName.trim() === '') {
      throw new Error('Template name cannot be blank');
    }

    // Constraint: HTML content must exceed 10 characters
    if (!input.htmlContent || input.htmlContent.length <= 10) {
      throw new Error('HTML content must be greater than 10 characters');
    }

    const sender: BrevoSender = {
      email: input.sender?.email || this.defaultSender.email,
      name: input.sender?.name || this.defaultSender.name || '',
    };

    // 1. Update Brevo template configuration
    await this.brevoClient.updateTemplate(id, {
      templateName: input.templateName,
      subject: input.subject,
      sender: sender,
      htmlContent: input.htmlContent,
      isActive: input.isActive,
    });

    // 2. Update local mapping DB
    await this.repository.upsertMapping(id, input.eventName || '', input.isActive);

    return {
      templateId: id,
      templateName: input.templateName,
      subject: input.subject,
      eventName: input.eventName || '',
      isActive: input.isActive,
      sender: sender,
      htmlContent: input.htmlContent,
    };
  }

  /**
   * Sync template active status across remote Brevo and local DB
   */
  async toggleTemplateActive(id: number, isActive: boolean): Promise<void> {
    // 1. Retrieve the existing Brevo template details so we can re-submit them securely
    const bt = await this.brevoClient.getTemplate(id);
    
    // 2. Flip remote status
    await this.brevoClient.updateTemplate(id, {
      templateName: bt.name,
      subject: bt.subject,
      sender: bt.sender || this.defaultSender,
      htmlContent: bt.htmlContent || '',
      isActive: isActive,
    });

    // 3. Update local DB mapping status
    const mapping = await this.repository.getMappingByTemplateId(id);
    const eventName = mapping ? mapping.event_name : '';
    await this.repository.upsertMapping(id, eventName, isActive);
  }

  /**
   * Retrieve list of verified sender profiles
   */
  async getSenders(): Promise<BrevoSender[]> {
    return this.brevoClient.getSenders();
  }

  /**
   * Application-facing transactional sender logic:
   * Event triggers query mapping database, checks status, and routes transactional send to Brevo
   */
  async sendEventEmail(
    eventName: string,
    recipientEmail: string,
    variables?: Record<string, any>
  ): Promise<{ sent: boolean; message: string }> {
    // 1. Find mapped template configuration
    const mapping = await this.repository.getActiveMappingByEvent(eventName);

    // 2. Guardrail: If template is disabled (isActive = false), event engine completely ignores it
    if (!mapping || !mapping.is_active) {
      return {
        sent: false,
        message: `Event '${eventName}' skipped: No active template mapped to this event.`,
      };
    }

    // 3. Push transactional template send to Brevo API
    await this.brevoClient.sendEmail({
      templateId: mapping.template_id,
      to: recipientEmail,
      variables: variables,
    });

    return {
      sent: true,
      message: `Successfully sent email for event '${eventName}' using template #${mapping.template_id}.`,
    };
  }
}
