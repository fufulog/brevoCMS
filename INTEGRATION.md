# Brevo CMS SDK - Host Integration Reference Notes

These integration notes document the implementation patterns, ESM target configurations, and routing setups utilized when embedding the `brevoCMS` SDK into a React/Vite/Express workspace.

---

## 1. Environment Configurations

Make sure to define these keys in the host environment (`.env`):

```bash
# Brevo SMTP Configuration
BREVO_API_KEY="xkeysib-..."
DEFAULT_SENDER_EMAIL="info@yourdomain.com"
DEFAULT_SENDER_NAME="Your Brand Name"
DB_TYPE="firestore" # or 'postgres' | 'mysql'
```

---

## 2. ESM Target Module Fixes

If your host application is configured to run as an ES Module (`"type": "module"` in `package.json`), you must build the `@fufulog/brevomorphic-cms-sdk` to match ESM:

1. Add `"type": "module"` to `brevoCMS/package.json` so TypeScript compiles native ES imports/exports.
2. Compile/rebuild the package:
   ```bash
   npm run build
   ```
This ensures the output in `dist/` is compiled with standard `export` and `import` syntax instead of CommonJS `require`/`exports`, preventing `"exports is not defined"` errors in Vite SSR environments.

---

## 3. Dev Server Proxy Routing

In Vite environments using Express API middlewares, Vite must be explicitly instructed to forward the CMS endpoints to the Express instance.

Update the API routing middleware check in `vite.config.ts` to intercept `/api/cms`:
```typescript
if (req.url && (
  req.url.startsWith('/api/payments') || 
  req.url.startsWith('/api/scanner') || 
  req.url.startsWith('/api/cms') // Ensure this is captured
)) {
  // Forward to Express server module...
}
```
Failing to include this causes Vite to fall back to serving the SPA's `index.html` (returning `<!doctype html...`), resulting in JSON parse errors.

---

## 4. API Response Mapping Guardrails

The SDK returns templates matching Brevo's naming conventions, returning properties `templateId` and `templateName`. 
When listing and selecting templates in your React dashboard UI, ensure you map these keys to local frontend properties:

```typescript
const handleSelectTemplate = async (template) => {
  const res = await fetch(`/api/cms/templates/${template.id}`);
  const json = await res.json();
  if (json.success) {
    const t = json.data;
    setEditingTemplate({
      id: t.templateId,     // Map templateId -> id
      name: t.templateName, // Map templateName -> name
      subject: t.subject,
      htmlContent: t.htmlContent,
      isActive: t.isActive,
      eventName: t.eventName,
      sender: t.sender,
    });
  }
};
```

---

## 5. Event Trigger Implementation

Trigger outbound event-driven transactional mailings by passing a recipient email and variables context:

```typescript
import { cmsService } from './server/cms.js';

// Inside Checkout / Payment Success Handlers:
await cmsService.sendEventEmail('order.completed', email, {
  customerName: profile.name,
  orderId: order.id,
  totalAmount: order.total,
  currency: order.currency,
  itemsCount: order.items.length,
  appUrl: 'https://yourdomain.com'
});

// Inside User Registration Handlers:
await cmsService.sendEventEmail('user.welcome', email, {
  customerName: profile.name,
  signupDate: new Date().toLocaleDateString()
});
```
The SDK runs outbound event-check safety checks. If the template is unassigned, missing, or inactive (`isActive` is false), the send is safely ignored without breaking transaction flows.
