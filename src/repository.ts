import { SDKConfig, LocalMapping } from './types.js';

export class EmailTemplateRepository {
  private dbType: 'postgres' | 'mysql' | 'firestore';
  private dbClient: any;
  private tableName: string;

  constructor(config: SDKConfig) {
    this.dbType = config.dbType;
    this.dbClient = config.dbClient;
    this.tableName = config.tableNameOrCollection || 'email_event_templates';

    if (!this.dbClient) {
      throw new Error(`Database client is required for database type: ${this.dbType}`);
    }
  }

  /**
   * Helper to parse SQL queries results.
   * Handles PostgreSQL result format (res.rows) and MySQL format ([rows, fields]).
   */
  private parseSQLResult(res: any): any[] {
    if (!res) return [];
    if (res.rows && Array.isArray(res.rows)) {
      return res.rows;
    }
    if (Array.isArray(res)) {
      if (res.length > 0 && Array.isArray(res[0])) {
        // MySQL connection.query returns [rows, fields]
        return res[0];
      }
      return res; // Flat rows array
    }
    return [];
  }

  /**
   * Fetch all event-to-template mappings from the local database
   */
  async getAllMappings(): Promise<LocalMapping[]> {
    if (this.dbType === 'firestore') {
      const snapshot = await this.dbClient.collection(this.tableName).get();
      const mappings: LocalMapping[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        mappings.push({
          template_id: Number(data.template_id),
          event_name: data.event_name || '',
          is_active: !!data.is_active,
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at,
        });
      });
      return mappings;
    } else {
      const sql = `SELECT id, template_id, event_name, is_active, updated_at FROM ${this.tableName}`;
      const res = await this.dbClient.query(sql, []);
      const rows = this.parseSQLResult(res);
      return rows.map((r: any) => ({
        id: r.id,
        template_id: Number(r.template_id),
        event_name: r.event_name || '',
        is_active: Boolean(r.is_active),
        updated_at: r.updated_at,
      }));
    }
  }

  /**
   * Fetch mapping for a specific template ID
   */
  async getMappingByTemplateId(templateId: number): Promise<LocalMapping | null> {
    if (this.dbType === 'firestore') {
      const doc = await this.dbClient.collection(this.tableName).doc(templateId.toString()).get();
      if (!doc.exists) return null;
      const data = doc.data();
      return {
        template_id: Number(data.template_id),
        event_name: data.event_name || '',
        is_active: !!data.is_active,
        updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at,
      };
    } else {
      const paramChar = this.dbType === 'postgres' ? '$1' : '?';
      const sql = `SELECT id, template_id, event_name, is_active, updated_at FROM ${this.tableName} WHERE template_id = ${paramChar}`;
      const res = await this.dbClient.query(sql, [templateId]);
      const rows = this.parseSQLResult(res);
      if (rows.length === 0) return null;
      
      const r = rows[0];
      return {
        id: r.id,
        template_id: Number(r.template_id),
        event_name: r.event_name || '',
        is_active: Boolean(r.is_active),
        updated_at: r.updated_at,
      };
    }
  }

  /**
   * Fetch mapping for a specific event name.
   * Assumes we want the active template linked to this event.
   */
  async getActiveMappingByEvent(eventName: string): Promise<LocalMapping | null> {
    if (this.dbType === 'firestore') {
      const snapshot = await this.dbClient
        .collection(this.tableName)
        .where('event_name', '==', eventName)
        .where('is_active', '==', true)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        template_id: Number(data.template_id),
        event_name: data.event_name || '',
        is_active: !!data.is_active,
        updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at,
      };
    } else {
      const param1 = this.dbType === 'postgres' ? '$1' : '?';
      const param2 = this.dbType === 'postgres' ? '$2' : '?';
      // Wait, is_active could be 1/0 or true/false, standard database handles boolean conversion, but is_active = true or is_active = 1
      const sql = `SELECT id, template_id, event_name, is_active, updated_at FROM ${this.tableName} WHERE event_name = ${param1} AND is_active = ${param2} LIMIT 1`;
      
      // Pass both parameters for portability
      const res = await this.dbClient.query(sql, [eventName, true]);
      const rows = this.parseSQLResult(res);
      if (rows.length === 0) return null;

      const r = rows[0];
      return {
        id: r.id,
        template_id: Number(r.template_id),
        event_name: r.event_name || '',
        is_active: Boolean(r.is_active),
        updated_at: r.updated_at,
      };
    }
  }

  /**
   * Upsert a mapping (insert or update template config)
   */
  async upsertMapping(templateId: number, eventName: string, isActive: boolean): Promise<void> {
    if (this.dbType === 'firestore') {
      await this.dbClient
        .collection(this.tableName)
        .doc(templateId.toString())
        .set(
          {
            template_id: templateId,
            event_name: eventName,
            is_active: isActive,
            updated_at: new Date(),
          },
          { merge: true }
        );
    } else {
      let sql = '';
      let params: any[] = [];
      if (this.dbType === 'postgres') {
        sql = `
          INSERT INTO ${this.tableName} (template_id, event_name, is_active, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (template_id)
          DO UPDATE SET 
            event_name = EXCLUDED.event_name,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        `;
        params = [templateId, eventName, isActive];
      } else {
        // MySQL ON DUPLICATE KEY UPDATE
        sql = `
          INSERT INTO ${this.tableName} (template_id, event_name, is_active, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE 
            event_name = VALUES(event_name),
            is_active = VALUES(is_active),
            updated_at = CURRENT_TIMESTAMP
        `;
        params = [templateId, eventName, isActive];
      }
      await this.dbClient.query(sql, params);
    }
  }

  /**
   * Just-In-Time (JIT) Local Mapping Generation.
   * If mapping does not exist, insert blank inactive mapping.
   */
  async insertJITMapping(templateId: number): Promise<void> {
    if (this.dbType === 'firestore') {
      const docRef = this.dbClient.collection(this.tableName).doc(templateId.toString());
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set({
          template_id: templateId,
          event_name: '',
          is_active: false,
          updated_at: new Date(),
        });
      }
    } else {
      let sql = '';
      let params: any[] = [];
      if (this.dbType === 'postgres') {
        sql = `
          INSERT INTO ${this.tableName} (template_id, event_name, is_active, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (template_id)
          DO NOTHING
        `;
        params = [templateId, '', false];
      } else {
        // MySQL INSERT IGNORE
        sql = `
          INSERT IGNORE INTO ${this.tableName} (template_id, event_name, is_active, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `;
        params = [templateId, '', false];
      }
      await this.dbClient.query(sql, params);
    }
  }
}
