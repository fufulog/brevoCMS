import { Request, Response, Router } from 'express';
import { EmailTemplateService } from './service.js';

export class EmailTemplateController {
  private service: EmailTemplateService;

  constructor(service: EmailTemplateService) {
    this.service = service;
  }

  /**
   * Generates a fully configured Express Router.
   * Can be directly mounted into any Express app: `app.use('/api/cms', controller.getRouter())`
   */
  getRouter(): Router {
    const router = Router();

    // Standard express mapping
    router.get('/templates', this.listTemplates.bind(this));
    router.get('/templates/:id', this.getTemplate.bind(this));
    router.post('/templates', this.createTemplate.bind(this));
    router.put('/templates/:id', this.updateTemplate.bind(this));
    router.post('/templates/:id/toggle', this.toggleTemplate.bind(this));
    router.get('/senders', this.listSenders.bind(this));
    router.post('/send', this.sendEventEmail.bind(this));

    return router;
  }

  /**
   * GET /templates
   * Lists all templates synchronized from Brevo and mapped locally.
   */
  async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await this.service.listTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /templates/:id
   * Fetches a detailed template (including HTML body content) by Brevo ID.
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid template ID parameter' });
        return;
      }
      const template = await this.service.getTemplate(id);
      res.status(200).json({ success: true, data: template });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }

  /**
   * POST /templates
   * Instantiates a new draft template on Brevo and registers local mapping.
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, subject, senderEmail, senderName } = req.body;
      const newTemplate = await this.service.createTemplate({
        name,
        subject,
        senderEmail,
        senderName,
      });
      res.status(201).json({ success: true, data: newTemplate });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /templates/:id
   * Validates and updates a template configuration both on Brevo and the local DB.
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid template ID parameter' });
        return;
      }

      const { templateName, subject, sender, htmlContent, eventName, isActive } = req.body;
      
      const updated = await this.service.updateTemplate(id, {
        templateName,
        subject,
        sender,
        htmlContent,
        eventName,
        isActive: !!isActive,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      if (
        error.message.includes('cannot be blank') ||
        error.message.includes('must exceed') ||
        error.message.includes('greater than 10')
      ) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }

  /**
   * POST /templates/:id/toggle
   * Flips active/inactive status across Brevo and DB.
   */
  async toggleTemplate(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid template ID parameter' });
        return;
      }

      const { isActive } = req.body;
      if (isActive === undefined) {
        res.status(400).json({ success: false, error: "Field 'isActive' boolean is required in request body" });
        return;
      }

      await this.service.toggleTemplateActive(id, !!isActive);
      res.status(200).json({ success: true, message: `Template status flipped to ${!!isActive}` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /senders
   * Lists verified sender profiles from Brevo.
   */
  async listSenders(req: Request, res: Response): Promise<void> {
    try {
      const senders = await this.service.getSenders();
      res.status(200).json({ success: true, data: senders });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /send
   * Triggers an email send for a given backend event.
   */
  async sendEventEmail(req: Request, res: Response): Promise<void> {
    try {
      const { eventName, recipientEmail, variables } = req.body;

      if (!eventName || !recipientEmail) {
        res.status(400).json({
          success: false,
          error: "Fields 'eventName' and 'recipientEmail' are required in request body",
        });
        return;
      }

      const outcome = await this.service.sendEventEmail(eventName, recipientEmail, variables);
      
      if (!outcome.sent) {
        res.status(200).json({ success: true, sent: false, message: outcome.message });
      } else {
        res.status(200).json({ success: true, sent: true, message: outcome.message });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
