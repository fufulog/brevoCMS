import axios, { AxiosInstance } from 'axios';
import { BrevoTemplate, BrevoSender } from './types.js';

export class BrevoClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Brevo API key is required');
    }
    this.client = axios.create({
      baseURL: 'https://api.brevo.com/v3',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Fetch all templates from Brevo.
   * By default, limits templates but we can fetch them all.
   */
  async getTemplates(limit = 100, offset = 0): Promise<BrevoTemplate[]> {
    try {
      const response = await this.client.get<{ count: number; templates?: any[] }>(
        `/smtp/templates?limit=${limit}&offset=${offset}`
      );
      
      const templates = response.data.templates || [];
      return templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        isActive: t.isActive,
        htmlContent: t.htmlContent,
        sender: t.sender ? { id: t.sender.id, name: t.sender.name, email: t.sender.email } : undefined,
      }));
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to fetch templates from Brevo: ${msg}`);
    }
  }

  /**
   * Fetch a single template by its Brevo ID
   */
  async getTemplate(id: number): Promise<BrevoTemplate> {
    try {
      const response = await this.client.get<any>(`/smtp/templates/${id}`);
      const t = response.data;
      return {
        id: t.id,
        name: t.name,
        subject: t.subject,
        isActive: t.isActive,
        htmlContent: t.htmlContent,
        sender: t.sender ? { id: t.sender.id, name: t.sender.name, email: t.sender.email } : undefined,
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to fetch template #${id} from Brevo: ${msg}`);
    }
  }

  /**
   * Create a new SMTP template on Brevo
   */
  async createTemplate(params: {
    templateName: string;
    subject: string;
    sender: { name?: string; email: string };
    htmlContent: string;
    isActive?: boolean;
  }): Promise<number> {
    try {
      const response = await this.client.post<{ id: number }>(
        '/smtp/templates',
        {
          templateName: params.templateName,
          subject: params.subject,
          sender: params.sender,
          htmlContent: params.htmlContent,
          isActive: params.isActive ?? false,
        }
      );
      return response.data.id;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to create template on Brevo: ${msg}`);
    }
  }

  /**
   * Update an SMTP template on Brevo
   */
  async updateTemplate(
    id: number,
    params: {
      templateName: string;
      subject: string;
      sender: { name?: string; email: string; id?: number };
      htmlContent: string;
      isActive: boolean;
    }
  ): Promise<void> {
    try {
      // Brevo PUT updates require sending sender as object { name, email } (or sender ID)
      const payload: any = {
        templateName: params.templateName,
        subject: params.subject,
        htmlContent: params.htmlContent,
        isActive: params.isActive,
      };

      if (params.sender) {
        payload.sender = {
          email: params.sender.email,
        };
        if (params.sender.name) {
          payload.sender.name = params.sender.name;
        }
      }

      await this.client.put(`/smtp/templates/${id}`, payload);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to update template #${id} on Brevo: ${msg}`);
    }
  }

  /**
   * Get all active and verified sender profiles from Brevo
   */
  async getSenders(): Promise<BrevoSender[]> {
    try {
      const response = await this.client.get<{ senders?: any[] }>('/senders');
      const senders = response.data.senders || [];
      return senders.map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        active: s.active,
      }));
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to fetch senders from Brevo: ${msg}`);
    }
  }

  /**
   * Send a transactional template email via Brevo SMTP API
   */
  async sendEmail(params: {
    templateId: number;
    to: string;
    variables?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.client.post('/smtp/email', {
        templateId: params.templateId,
        to: [{ email: params.to }],
        params: params.variables || {},
      });
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Failed to send event email via Brevo: ${msg}`);
    }
  }
}
