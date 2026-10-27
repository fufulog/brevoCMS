/**
 * Undo HTML entity encoding that breaks Brevo's Twig parser.
 *
 * Reading a contentEditable element's innerHTML escapes text, so a condition like
 * `{% if params.count > 1 %}` comes back as `{% if params.count &gt; 1 %}` and Brevo
 * rejects it as a malformed if-condition. Brackets are restored everywhere; operators,
 * quotes and ampersands only inside `{% ... %}` and `{{ ... }}` tags, so the rest of
 * the HTML keeps its escaping.
 */
export function restoreTwigTags(html: string): string {
  return html
    .replace(/&lbrace;/g, '{')
    .replace(/&rbrace;/g, '}')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&#37;/g, '%')
    .replace(/&percnt;/g, '%')
    .replace(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g, (tag) =>
      tag
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
    );
}
