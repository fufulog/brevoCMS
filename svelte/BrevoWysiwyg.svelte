<!--
  BrevoWysiwyg.svelte — WYSIWYG Email Template Editor
  
  Drop-in Svelte component for the brevoCMS SDK.
  Provides rich-text editing with Source toggle, formatting toolbar,
  and Brevo variable injection. Does NOT escape Twig brackets.

  Props:
    value        (string)   — HTML content (bind:value for two-way binding)
    variables    (array)    — [{ label: string, key: string }] for variable injection
    placeholder  (string)   — Placeholder text when editor is empty
    disabled     (boolean)  — Disables the editor

  Events:
    on:change    — Fires with { detail: string } containing raw HTML

  Usage:
    <BrevoWysiwyg
      bind:value={htmlContent}
      variables={[
        { label: 'Customer Name', key: 'params.name' },
        { label: 'Ticket Code', key: 'params.ticket_code' }
      ]}
      on:change={(e) => console.log(e.detail)}
    />
-->

<script>
  import { onMount, createEventDispatcher, tick } from "svelte";

  export let value = "";
  export let variables = [];
  export let placeholder = "Start designing your email template...";
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let editorEl;
  let sourceEl;
  let isSourceMode = false;
  let sourceCode = "";
  let showVariableMenu = false;
  let showHeadingMenu = false;
  let isFocused = false;

  // Toolbar state tracking
  let activeFormats = {
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertOrderedList: false,
    insertUnorderedList: false,
  };

  onMount(() => {
    if (value && editorEl) {
      editorEl.innerHTML = value;
    }
  });

  function syncFromEditor() {
    if (!editorEl || isSourceMode) return;
    // Extract raw innerHTML — NO sanitization of { } % characters
    const raw = editorEl.innerHTML;
    // Restore any accidentally encoded Twig brackets
    const cleaned = raw
      .replace(/&lbrace;/g, "{")
      .replace(/&rbrace;/g, "}")
      .replace(/&#123;/g, "{")
      .replace(/&#125;/g, "}")
      .replace(/&#37;/g, "%")
      .replace(/&percnt;/g, "%");
    value = cleaned;
    dispatch("change", cleaned);
  }

  function syncFromSource() {
    sourceCode = sourceEl?.value ?? sourceCode;
    value = sourceCode;
    dispatch("change", value);
  }

  async function toggleSourceMode() {
    if (isSourceMode) {
      // Switching to Visual — load source into editor
      value = sourceCode;
      isSourceMode = false;
      await tick();
      if (editorEl) editorEl.innerHTML = value;
    } else {
      // Switching to Source — serialize editor to textarea
      syncFromEditor();
      sourceCode = value;
      isSourceMode = true;
    }
    showVariableMenu = false;
    showHeadingMenu = false;
  }

  function execCmd(command, val = null) {
    if (isSourceMode || disabled) return;
    editorEl?.focus();
    document.execCommand(command, false, val);
    syncFromEditor();
    updateActiveFormats();
  }

  function updateActiveFormats() {
    activeFormats = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
    };
  }

  function insertHeading(tag) {
    execCmd("formatBlock", tag);
    showHeadingMenu = false;
  }

  function insertLink() {
    if (isSourceMode || disabled) return;
    const url = prompt("Enter URL:");
    if (url) execCmd("createLink", url);
  }

  function insertVariable(variable) {
    if (disabled) return;
    const twigExpr = `{{ ${variable.key} }}`;

    if (isSourceMode && sourceEl) {
      // Insert into textarea at cursor position
      const start = sourceEl.selectionStart;
      const end = sourceEl.selectionEnd;
      const before = sourceCode.substring(0, start);
      const after = sourceCode.substring(end);
      sourceCode = before + twigExpr + after;
      sourceEl.value = sourceCode;
      value = sourceCode;
      dispatch("change", value);
      // Restore cursor after inserted text
      tick().then(() => {
        sourceEl.selectionStart = sourceEl.selectionEnd =
          start + twigExpr.length;
        sourceEl.focus();
      });
    } else if (editorEl) {
      // Insert into contentEditable at cursor position
      editorEl.focus();
      // Use insertHTML to preserve Twig brackets exactly
      document.execCommand("insertHTML", false, twigExpr);
      syncFromEditor();
    }

    showVariableMenu = false;
  }

  function handleEditorInput() {
    syncFromEditor();
    updateActiveFormats();
  }

  function handleEditorKeyup() {
    updateActiveFormats();
  }

  function handleEditorMouseup() {
    updateActiveFormats();
  }

  function closeMenus(e) {
    if (!e.target.closest(".brevo-dropdown")) {
      showVariableMenu = false;
      showHeadingMenu = false;
    }
  }
</script>

<svelte:window on:click={closeMenus} />

<div
  class="brevo-wysiwyg"
  class:brevo-wysiwyg--disabled={disabled}
  class:brevo-wysiwyg--focused={isFocused}
>
  <!-- Toolbar -->
  <div class="brevo-toolbar">
    <div class="brevo-toolbar__group">
      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.bold}
        title="Bold"
        on:click={() => execCmd("bold")}
        {disabled}><strong>B</strong></button
      >

      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.italic}
        title="Italic"
        on:click={() => execCmd("italic")}
        {disabled}><em>I</em></button
      >

      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.underline}
        title="Underline"
        on:click={() => execCmd("underline")}
        {disabled}><u>U</u></button
      >

      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.strikeThrough}
        title="Strikethrough"
        on:click={() => execCmd("strikeThrough")}
        {disabled}><s>S</s></button
      >
    </div>

    <div class="brevo-toolbar__divider"></div>

    <!-- Heading dropdown -->
    <div class="brevo-dropdown">
      <button
        type="button"
        class="brevo-btn"
        title="Headings"
        on:click|stopPropagation={() => {
          showHeadingMenu = !showHeadingMenu;
          showVariableMenu = false;
        }}
        {disabled}>H ▾</button
      >

      {#if showHeadingMenu}
        <div class="brevo-dropdown__menu">
          <button type="button" on:click={() => insertHeading("h1")}
            >Heading 1</button
          >
          <button type="button" on:click={() => insertHeading("h2")}
            >Heading 2</button
          >
          <button type="button" on:click={() => insertHeading("h3")}
            >Heading 3</button
          >
          <button type="button" on:click={() => insertHeading("p")}
            >Paragraph</button
          >
        </div>
      {/if}
    </div>

    <div class="brevo-toolbar__divider"></div>

    <div class="brevo-toolbar__group">
      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.insertUnorderedList}
        title="Bullet List"
        on:click={() => execCmd("insertUnorderedList")}
        {disabled}>• List</button
      >

      <button
        type="button"
        class="brevo-btn"
        class:brevo-btn--active={activeFormats.insertOrderedList}
        title="Numbered List"
        on:click={() => execCmd("insertOrderedList")}
        {disabled}>1. List</button
      >
    </div>

    <div class="brevo-toolbar__divider"></div>

    <div class="brevo-toolbar__group">
      <button
        type="button"
        class="brevo-btn"
        title="Align Left"
        on:click={() => execCmd("justifyLeft")}
        {disabled}>⫷</button
      >
      <button
        type="button"
        class="brevo-btn"
        title="Align Center"
        on:click={() => execCmd("justifyCenter")}
        {disabled}>⫿</button
      >
      <button
        type="button"
        class="brevo-btn"
        title="Align Right"
        on:click={() => execCmd("justifyRight")}
        {disabled}>⫸</button
      >
    </div>

    <div class="brevo-toolbar__divider"></div>

    <button
      type="button"
      class="brevo-btn"
      title="Insert Link"
      on:click={insertLink}
      {disabled}>🔗</button
    >

    <!-- Variable injector -->
    {#if variables.length > 0}
      <div class="brevo-toolbar__divider"></div>
      <div class="brevo-dropdown">
        <button
          type="button"
          class="brevo-btn brevo-btn--accent"
          title="Insert Variable"
          on:click|stopPropagation={() => {
            showVariableMenu = !showVariableMenu;
            showHeadingMenu = false;
          }}
          {disabled}>&#123;&#123; &#125;&#125; Insert Variable ▾</button
        >

        {#if showVariableMenu}
          <div class="brevo-dropdown__menu brevo-dropdown__menu--variables">
            {#each variables as variable}
              <button type="button" on:click={() => insertVariable(variable)}>
                <span class="brevo-var-label">{variable.label}</span>
                <code class="brevo-var-key">{"{{ " + variable.key + " }}"}</code
                >
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Source toggle (right-aligned) -->
    <div class="brevo-toolbar__spacer"></div>
    <button
      type="button"
      class="brevo-btn brevo-btn--source"
      class:brevo-btn--active={isSourceMode}
      title="Toggle Source View"
      on:click={toggleSourceMode}
      {disabled}>{isSourceMode ? "✎ Visual" : "</> Source"}</button
    >
  </div>

  <!-- Editor Area -->
  <div class="brevo-editor-wrapper">
    {#if isSourceMode}
      <textarea
        bind:this={sourceEl}
        bind:value={sourceCode}
        class="brevo-source"
        on:input={syncFromSource}
        on:focus={() => (isFocused = true)}
        on:blur={() => (isFocused = false)}
        {placeholder}
        {disabled}
        spellcheck="false"
      ></textarea>
    {:else}
      <div
        bind:this={editorEl}
        class="brevo-editor"
        contenteditable={!disabled}
        role="textbox"
        tabindex="0"
        aria-multiline="true"
        aria-label="Email template editor"
        data-placeholder={placeholder}
        on:input={handleEditorInput}
        on:keyup={handleEditorKeyup}
        on:mouseup={handleEditorMouseup}
        on:focus={() => (isFocused = true)}
        on:blur={() => (isFocused = false)}
      ></div>
    {/if}
  </div>
</div>

<style>
  /* ── Container ── */
  .brevo-wysiwyg {
    --brevo-bg: #1a1a2e;
    --brevo-surface: #16213e;
    --brevo-border: #2a2a4a;
    --brevo-border-focus: #6366f1;
    --brevo-text: #e2e8f0;
    --brevo-text-muted: #94a3b8;
    --brevo-accent: #6366f1;
    --brevo-accent-hover: #818cf8;
    --brevo-toolbar-bg: #0f1629;
    --brevo-btn-hover: #2a2a4a;
    --brevo-btn-active: #3730a3;
    --brevo-radius: 8px;
    --brevo-font: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;

    font-family: var(--brevo-font);
    border: 1.5px solid var(--brevo-border);
    border-radius: var(--brevo-radius);
    overflow: hidden;
    background: var(--brevo-bg);
    transition: border-color 0.2s ease;
  }

  .brevo-wysiwyg--focused {
    border-color: var(--brevo-border-focus);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .brevo-wysiwyg--disabled {
    opacity: 0.55;
    pointer-events: none;
  }

  /* ── Toolbar ── */
  .brevo-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    padding: 6px 8px;
    background: var(--brevo-toolbar-bg);
    border-bottom: 1px solid var(--brevo-border);
  }

  .brevo-toolbar__group {
    display: flex;
    gap: 2px;
  }

  .brevo-toolbar__divider {
    width: 1px;
    height: 22px;
    background: var(--brevo-border);
    margin: 0 4px;
  }

  .brevo-toolbar__spacer {
    flex: 1;
  }

  /* ── Buttons ── */
  .brevo-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--brevo-text-muted);
    font-family: var(--brevo-font);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1.4;
  }

  .brevo-btn:hover {
    background: var(--brevo-btn-hover);
    color: var(--brevo-text);
  }

  .brevo-btn--active {
    background: var(--brevo-btn-active);
    color: #fff;
  }

  .brevo-btn--accent {
    color: var(--brevo-accent);
    font-weight: 500;
  }

  .brevo-btn--accent:hover {
    color: var(--brevo-accent-hover);
    background: rgba(99, 102, 241, 0.12);
  }

  .brevo-btn--source {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  /* ── Dropdowns ── */
  .brevo-dropdown {
    position: relative;
  }

  .brevo-dropdown__menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
    padding: 4px;
    background: var(--brevo-surface);
    border: 1px solid var(--brevo-border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    animation: brevo-dropdown-in 0.12s ease-out;
  }

  .brevo-dropdown__menu--variables {
    min-width: 260px;
  }

  @keyframes brevo-dropdown-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .brevo-dropdown__menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--brevo-text);
    font-family: var(--brevo-font);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    gap: 8px;
  }

  .brevo-dropdown__menu button:hover {
    background: var(--brevo-btn-hover);
  }

  .brevo-var-label {
    flex: 1;
  }

  .brevo-var-key {
    font-size: 11px;
    color: var(--brevo-accent);
    background: rgba(99, 102, 241, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }

  /* ── Editor ── */
  .brevo-editor-wrapper {
    background: var(--brevo-bg);
  }

  .brevo-editor {
    min-height: 320px;
    max-height: 600px;
    overflow-y: auto;
    padding: 20px 24px;
    color: var(--brevo-text);
    font-size: 15px;
    line-height: 1.7;
    outline: none;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .brevo-editor:empty::before {
    content: attr(data-placeholder);
    color: var(--brevo-text-muted);
    opacity: 0.5;
    pointer-events: none;
  }

  .brevo-editor :global(h1) {
    font-size: 1.8em;
    font-weight: 700;
    margin: 0.4em 0;
  }
  .brevo-editor :global(h2) {
    font-size: 1.4em;
    font-weight: 600;
    margin: 0.4em 0;
  }
  .brevo-editor :global(h3) {
    font-size: 1.15em;
    font-weight: 600;
    margin: 0.4em 0;
  }
  .brevo-editor :global(a) {
    color: var(--brevo-accent-hover);
    text-decoration: underline;
  }
  .brevo-editor :global(ul),
  .brevo-editor :global(ol) {
    padding-left: 1.6em;
  }

  /* ── Source ── */
  .brevo-source {
    width: 100%;
    min-height: 320px;
    max-height: 600px;
    padding: 16px 20px;
    border: none;
    background: #0d1117;
    color: #c9d1d9;
    font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
    font-size: 13px;
    line-height: 1.65;
    resize: vertical;
    outline: none;
    tab-size: 2;
    box-sizing: border-box;
  }

  .brevo-source::placeholder {
    color: #484f58;
  }
</style>
