export interface BrevoSender {
  id?: number;
  name: string;
  email: string;
  active?: boolean;
}

export interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  htmlContent?: string;
  sender?: BrevoSender;
}

export interface LocalMapping {
  id?: number | string;
  template_id: number;
  event_name: string;
  is_active: boolean;
  updated_at?: Date | string;
}

export interface CombinedTemplate {
  templateId: number;
  templateName: string;
  subject: string;
  eventName: string;
  isActive: boolean; // synced from local state & remote
  sender?: BrevoSender;
  htmlContent?: string;
}

export interface SQLClient {
  query: (sql: string, params: any[]) => Promise<any>;
}

export interface FirestoreClient {
  collection: (collectionPath: string) => any;
}

export interface SDKConfig {
  brevoApiKey: string;
  defaultSender: {
    name?: string;
    email: string;
  };
  dbType: 'postgres' | 'mysql' | 'firestore';
  /**
   * For 'postgres': an object satisfying { query: (sql, params) => Promise<{ rows: any[] }> } or equivalent
   * For 'mysql': an object satisfying { query: (sql, params) => Promise<[any[], any]> } or equivalent
   * For 'firestore': an instance of Firebase Firestore DB
   */
  dbClient: any;
  /**
   * Table name for postgres/mysql, or Collection path for Firestore.
   * Defaults to 'email_event_templates'
   */
  tableNameOrCollection?: string;
}

export interface CreateTemplateInput {
  name?: string;
  subject?: string;
  senderEmail?: string;
  senderName?: string;
}

export interface UpdateTemplateInput {
  templateName: string;
  subject: string;
  sender: BrevoSender;
  htmlContent: string;
  eventName: string;
  isActive: boolean;
}
