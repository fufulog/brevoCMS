# Product Requirement Document (PRD)

## Project Overview

This project aims to build a centralized, internal **Email Template Manager & Event Linker Dashboard**. The application will serve as a gateway dashboard that allows teams to manage, edit, and link Brevo email layouts directly to our application-specific backend events (e.g., `ticket.preapproved`, `user.welcome`).

By maintaining a dedicated mapping database locally, the platform isolates core app logic from Brevo's internal identifiers while providing a clean, rich-text editing experience wrapper around Brevo’s API.

---

## 1. System Architecture & Objectives

* **Decoupled Sync:** The system operates a two-way synchronization layer—pulling core presentation data from Brevo's API while using a local database as the absolute source of truth for routing events to templates.
* **Zero Orphaned States:** New templates created via the dashboard will seamlessly spawn required local mapping definitions in an inactive state until configured.
* **One-Way Outbound Sends:** Application event providers will query the local database map to find the correct active `template_id` and push a flat transaction to Brevo.

---

## 2. Core Functional Requirements

### 2.1 Template List Screen (The Main Ledger)

Upon accessing the dashboard, the system must render a comprehensive ledger combining Brevo template properties with local event configurations.

* **Data Aggregation Engine:** The backend must fetch all templates from Brevo (`GET /v3/smtp/templates`) and cross-reference them against the local database table (`email_event_templates`).
* **Just-In-Time (JIT) Local Mapping Generation:** If a template exists on Brevo but does not have a corresponding record in our local mapping database, the application must automatically generate a new mapping object in the local database with a blank `event_name` string and `is_active = false`.
* **UI Columns Required:**
* **Internal Template Name** (Read from Brevo metadata)
* **Subject Line** (Read from Brevo metadata)
* **Mapped Target Event** (Read from Local DB mapping)
* **Status Toggle** (Reflects `isActive` state from Brevo / Local DB syncing)
* **Actions:** Edit Button



### 2.2 Template Activation / Deactivation Flow

* The Template List screen must display a clear toggle switch or button indicating whether a template is active or disabled.
* Clicking the button will execute an explicit toggle event that hits both systems:
1. Update Brevo remotely (`PUT /v3/smtp/templates/{id}`) setting `isActive` to the new state.
2. Update the local database mapping record (`is_active` boolean column).


* **Guardrail:** If a template is marked disabled (`isActive = false`), the event engine must completely ignore it, ensuring it does not process or execute the associated target event if fired by an application.

### 2.3 Creation Workflow ("New Template")

When an authorized user clicks the **"New Template"** button, the system must automate the initialization sequence without leaving the current view:

1. **Brevo Initialization:** The backend calls Brevo (`POST /v3/smtp/templates`) passing an initial structural setup name ("New Untitled Template"), placeholder subject line, verified default sender email, and a minimum valid HTML string skeleton (`<html><body><p>Drafting...</p></body></html>`).
2. **ID Extraction:** Brevo returns a unique numerical `templateId`.
3. **Local Mapping Insertion:** The backend immediately saves a new mapping row in our database linking the new `templateId` with an empty `event_name` and `is_active = false`.
4. **Automatic Redirect:** The dashboard must automatically fetch the fresh payload properties and instantly open the **Edit Email Template** view for that specific ID.

### 2.4 Edit Template View (The Screen Layout)

This view provides an explicit interface for updating visual parameters and application routing logic, matching our verified structural wireframe design:

* **Internal Template Name:** A required input field allowing the user to rename the template file identifier (`templateName` in Brevo).
* **Subject:** A required input text field mapping to the email subject.
* **Sender Selection:** A dropdown menu populated by valid sender profiles pulled down directly from Brevo's API (`GET /v3/senders`).
* **Target Event Field:** A dropdown menu populated by our application’s known structural system events. Modifying this field directly updates the local database mapping row upon submission.
* **Variable Injector ("Constants"):** A dropdown interface filled with system keys (e.g., `Customer Name`, `Ticket Code`). Clicking **"Insert Variable"** drops the appropriate Brevo Twig expression (e.g., `{{ params.name }}`) directly into the current cursor location inside the editor.
* **Email Body WYSIWYG Editor:** A rich text editor component.
* Must support full HTML markup layout architecture.
* Must feature a **"Source"** toggle view button to allow advanced layout engineering and direct copy/pasting of raw template code blocks.
* Must possess string rule protections to prevent the WYSIWYG parser from corrupting or encoding raw Twig brackets (`{{ ... }}` or `{% ... %}`).



---

## 3. Data Dictionary & Contract Mapping

### 3.1 Local Database Contract (`email_event_templates`)

```sql
CREATE TABLE email_event_templates (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) UNIQUE, -- Stores user assigned target event string
    template_id INT NOT NULL UNIQUE, -- Bridges directly to Brevo's Template ID
    is_active BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### 3.2 Main Dashboard Fields to Brevo API Structural Alignment

| Dashboard Form Element | Local DB Target | Brevo API Target Parameter | API Type |
| --- | --- | --- | --- |
| **Internal Name Input** | N/A | `templateName` | String |
| **Subject Input** | N/A | `subject` | String |
| **Sender Dropdown** | N/A | `sender.email` / `sender.id` | Object |
| **Target Event Selection** | `event_name` | N/A (Stored locally in DB) | String |
| **Status Toggle** | `is_active` | `isActive` | Boolean |
| **WYSIWYG Workspace** | N/A | `htmlContent` | String (Full HTML) |

---

## 4. User Interaction Flows (User Journeys)

### 4.1 Editing and Assigning an Existing Event

```
[User logs into Dashboard] 
       │
       ▼
[List screen performs concurrent lookups: Local DB mappings + Brevo templates list]
       │
       ▼
[System matches rows; auto-creates a fallback mapping block in local DB if anomalies exist]
       │
       ▼
[User clicks "Edit" on a template row]
       │
       ▼
[Router opens Editor UI populated with current Brevo details and the Local DB Target Event]
       │
       ▼
[User rewrites HTML body, inputs an internal name, and changes Target Event to 'ticket.preapproved']
       │
       ▼
[User clicks "Submit"] ───► 1. PUT Payload streams directly to Brevo API
                          2. SQL Upsert saves 'ticket.preapproved' to Local DB Map

```

---

## 5. Non-Functional & Security Requirements

* **Content Sanitization Exception:** The rich text editor engine must be strictly configured **not** to escape or scrub symbols like `{`, `%`, or `}`. Doing so breaks Brevo’s templating system processor.
* **API Network Fault Isolation:** If Brevo's API experiences downstream lag or outages, the local dashboard list should gracefully fail via a readable UI banner message while protecting database integrity.
* **Payload Boundary Constraint:** The editor form must enforce standard text character validations before sending to Brevo: a template name cannot be blank, and the final extracted HTML content must exceed 10 characters to clear Brevo's server validations.