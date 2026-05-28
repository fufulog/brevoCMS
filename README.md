# Brevo CMS Email Bootstrap SDK

A modular, lightweight, and robust Node.js SDK to synchronize and bootstrap Brevo email templates directly with local application backend events. 

It provides an out-of-the-box system that syncs metadata from Brevo SMTP templates, saves target-event routing parameters in a local mapping database, runs Just-In-Time (JIT) sync, enforces visual guardrails, and exports plug-and-play Express controllers.

---

## How to Install

### 1. Install the SDK

```bash
npm install @fufulog/brevomorphic-cms-sdk
```

### 2. Set Environment Variables

Copy the example env and fill in your credentials:

```bash
cp node_modules/@fufulog/brevomorphic-cms-sdk/env.example .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `BREVO_API_KEY` | Your Brevo API key (`xkeysib-...`) |
| `DEFAULT_SENDER_EMAIL` | Verified sender email address |
| `DB_TYPE` | `postgres`, `mysql`, or `firestore` |
| `DATABASE_URL` | Connection string (SQL) or Firebase credentials (Firestore) |

### 3. Create the Mapping Table

Run the appropriate schema migration for your database (see [Database Setup](#1-database-setup) below).

### 4. Bootstrap in Your App

```javascript
import { EmailTemplateService, EmailTemplateController } from '@fufulog/brevomorphic-cms-sdk';
import express from 'express';

const emailService = new EmailTemplateService({
  brevoApiKey: process.env.BREVO_API_KEY,
  defaultSender: { email: process.env.DEFAULT_SENDER_EMAIL },
  dbType: 'postgres', // or 'mysql' | 'firestore'
  dbClient: yourDbClient,
});

const app = express();
app.use(express.json());
app.use('/api/cms', new EmailTemplateController(emailService).getRouter());

app.listen(3000);
```

### 5. (Optional) Add the WYSIWYG Editor Component

The SDK ships drop-in WYSIWYG editor components for **Svelte** and **React**. Copy the component files from the SDK into your frontend project:

```bash
# Svelte
cp node_modules/@fufulog/brevomorphic-cms-sdk/svelte/BrevoWysiwyg.svelte src/components/

# React
cp node_modules/@fufulog/brevomorphic-cms-sdk/react/BrevoWysiwyg.tsx src/components/
cp node_modules/@fufulog/brevomorphic-cms-sdk/react/BrevoWysiwyg.css src/components/
```

See [WYSIWYG Editor Components](#6-wysiwyg-editor-components) for full usage details.

---

## Features

- **JIT Local Mapping Engine:** Automatic initialization of local routing templates if a new template is created directly on Brevo.
- **Outbound Send Guardrail:** Built-in safeguards that silently ignore disabled templates to protect transaction processing systems.
- **Multi-Database Support:** Native integration with **PostgreSQL**, **MySQL**, and **Google Cloud Firestore NoSQL** with zero code changes.
- **Plug-and-Play Routing:** Ready-to-mount Express Router exposing CRUD, activation toggles, verified sender lookups, and webhook routes.
- **WYSIWYG Editor Components:** Bundled Svelte and React editor components with source toggle, formatting toolbar, and Brevo variable injection.
- **Type Safety:** Full TypeScript declarations (`.d.ts`) included out of the box.

---

## 1. Database Setup

### SQL (PostgreSQL & MySQL)
Create the mapping ledger table using the appropriate schema block. By default, the SDK looks for the `email_event_templates` table.

#### **PostgreSQL**
```sql
CREATE TABLE email_event_templates (
    id SERIAL PRIMARY KEY,
    template_id INT NOT NULL UNIQUE, -- Bridges to Brevo template ID
    event_name VARCHAR(255) DEFAULT '', -- Links backend trigger key (e.g., ticket.preapproved)
    is_active BOOLEAN DEFAULT false, -- Master toggle for active sends
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **MySQL**
```sql
CREATE TABLE email_event_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL UNIQUE,
    event_name VARCHAR(255) DEFAULT '',
    is_active TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### NoSQL (Firestore)
No collection schema is required. Simply create a document collection named `email_event_templates` (customizable) in your Firestore database. The SDK will automatically structure documents with:
- **Document ID:** Stringified template ID (e.g. `"42"`)
- **Fields:**
  - `template_id`: `number`
  - `event_name`: `string`
  - `is_active`: `boolean`
  - `updated_at`: `timestamp`

---

## 2. Bootstrapping the SDK

To bootstrap the SDK in your application, instantiate `EmailTemplateService` by supplying a database driver instance (Postgres Pool, MySQL connection, or Firestore client instance) and the Brevo configuration.

### **Recipe A: PostgreSQL (using `pg` Pool)**
```javascript
import pg from 'pg';
import { EmailTemplateService } from '@fufulog/brevomorphic-cms-sdk';

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Configure the SDK using a wrapper matching { query: (sql, params) => Promise<any> }
const emailService = new EmailTemplateService({
  brevoApiKey: process.env.BREVO_API_KEY,
  defaultSender: {
    name: "Billing Desk",
    email: "billing@yourdomain.com"
  },
  dbType: 'postgres',
  dbClient: pgPool, // Standard pg Pool works natively
  tableNameOrCollection: 'email_event_templates'
});
```

### **Recipe B: MySQL (using `mysql2/promise` Pool)**
```javascript
import mysql from 'mysql2/promise';
import { EmailTemplateService } from '@fufulog/brevomorphic-cms-sdk';

const mysqlPool = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const emailService = new EmailTemplateService({
  brevoApiKey: process.env.BREVO_API_KEY,
  defaultSender: {
    name: "Customer Support",
    email: "support@yourdomain.com"
  },
  dbType: 'mysql',
  dbClient: mysqlPool, // Standard mysql2 promise pool works natively
  tableNameOrCollection: 'email_event_templates'
});
```

### **Recipe C: Firestore NoSQL (using `firebase-admin/firestore`)**
```javascript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { EmailTemplateService } from '@fufulog/brevomorphic-cms-sdk';

// Initialize Firebase SDK
initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
});

const firestoreDb = getFirestore();

const emailService = new EmailTemplateService({
  brevoApiKey: process.env.BREVO_API_KEY,
  defaultSender: {
    name: "System Gateway",
    email: "noreply@yourdomain.com"
  },
  dbType: 'firestore',
  dbClient: firestoreDb, // Standard Firestore client works natively
  tableNameOrCollection: 'email_event_templates'
});
```

---

## 3. Mounting the Routing Layer (Express Server)

Instantiate `EmailTemplateController` by passing your bootstrapped `EmailTemplateService` and mounting the routes directly inside your Express router.

```javascript
import express from 'express';
import { EmailTemplateController } from '@fufulog/brevomorphic-cms-sdk';

const app = express();
app.use(express.json());

// Create and mount CMS routes
const emailController = new EmailTemplateController(emailService);
app.use('/api/cms', emailController.getRouter());

// Start Server
app.listen(3000, () => {
  console.log('🚀 Brevo CMS mounting on http://localhost:3000/api/cms');
});
```

### **Exposed Routes**
| Method | Route | Description |
| --- | --- | --- |
| **GET** | `/api/cms/templates` | Lists templates with combined remote + local database JIT synchronization. |
| **GET** | `/api/cms/templates/:id` | Returns visual parameters, subject, HTML code block, and links for a specific template. |
| **POST** | `/api/cms/templates` | Creates a new draft template on Brevo & hooks up blank local DB mappings. |
| **PUT** | `/api/cms/templates/:id` | Updates name, subject, HTML markup body, and local target event assignment. |
| **POST** | `/api/cms/templates/:id/toggle` | Activates/deactivates template remotely on Brevo and locally inside DB mapping. |
| **GET** | `/api/cms/senders` | Pulls verified sender dropdown configurations from Brevo. |
| **POST** | `/api/cms/send` | Triggers test sends for a specific mapping. |

---

## 4. Operational Workflows (Outbound Sends)

In your application code, whenever a business operation completes (e.g. user welcome, ticket pre-approval), call the SDK directly to send an event email. 

The SDK automatically runs event guardrails: if no active template is associated with the event, or if it has been deactivated on the dashboard, it is ignored safely.

```javascript
// Welcome Event Trigger
app.post('/api/users/signup', async (req, res) => {
  const newUser = await createUser(req.body);

  // Trigger event-driven outbound send.
  // If template is inactive (is_active = false) or event mapping doesn't exist, it skips it.
  const outcome = await emailService.sendEventEmail('user.welcome', newUser.email, {
    customer_name: newUser.name,
    signup_date: new Date().toLocaleDateString()
  });

  console.log(outcome.message); // Logs status outcome safely
  res.status(201).json({ success: true, user: newUser });
});
```

---

## 5. Visual Form Validation Guards

When calling `emailService.updateTemplate(id, data)` or hitting `PUT /api/cms/templates/:id`, the SDK automatically protects Brevo's API by enforcing boundary conditions:
- **Blank Names:** Rejected. Form fields require unique template name keys.
- **Short HTML:** Brevo servers reject payloads with missing layouts. The SDK validates that raw HTML blocks must be longer than 10 characters before transmitting.

---

## 6. WYSIWYG Editor Components

The SDK ships drop-in WYSIWYG editor components for **Svelte** and **React**. These are zero-dependency source files you copy into your frontend project — no extra `npm install` required.

### Key Features

- **Formatting Toolbar:** Bold, Italic, Underline, Strikethrough, Headings, Lists, Alignment, Links
- **Source Toggle:** Switch between rich-text and raw HTML editing
- **Variable Injector:** Insert Brevo Twig expressions (`{{ params.name }}`) at cursor position
- **Twig Bracket Protection:** Does **not** escape `{`, `}`, or `%` — safe for Brevo's template engine

### Svelte Usage

```svelte
<script>
  import BrevoWysiwyg from './BrevoWysiwyg.svelte';

  let htmlContent = '';

  const variables = [
    { label: 'Customer Name', key: 'params.name' },
    { label: 'Ticket Code', key: 'params.ticket_code' },
    { label: 'Signup Date', key: 'params.signup_date' }
  ];
</script>

<BrevoWysiwyg
  bind:value={htmlContent}
  {variables}
  placeholder="Design your email layout..."
  on:change={(e) => console.log('HTML changed:', e.detail)}
/>
```

### React Usage

```tsx
import { useState } from 'react';
import BrevoWysiwyg from './BrevoWysiwyg';

function TemplateEditor() {
  const [htmlContent, setHtmlContent] = useState('');

  const variables = [
    { label: 'Customer Name', key: 'params.name' },
    { label: 'Ticket Code', key: 'params.ticket_code' },
    { label: 'Signup Date', key: 'params.signup_date' }
  ];

  return (
    <BrevoWysiwyg
      value={htmlContent}
      onChange={setHtmlContent}
      variables={variables}
      placeholder="Design your email layout..."
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `''` | Raw HTML content (two-way bind in Svelte, controlled in React) |
| `onChange` | `(html: string) => void` | — | Callback when content changes (React only) |
| `variables` | `{ label: string, key: string }[]` | `[]` | Available Brevo template variables |
| `placeholder` | `string` | `'Start designing...'` | Placeholder text |
| `disabled` | `boolean` | `false` | Disables editing |
