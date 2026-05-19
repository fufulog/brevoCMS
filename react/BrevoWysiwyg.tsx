import React, { useRef, useState, useCallback, useEffect } from 'react';
import './BrevoWysiwyg.css';

export interface BrevoVariable {
  label: string;
  key: string;
}

export interface BrevoWysiwygProps {
  value: string;
  onChange: (html: string) => void;
  variables?: BrevoVariable[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * BrevoWysiwyg — WYSIWYG Email Template Editor (React)
 *
 * Drop-in React component for the brevoCMS SDK.
 * Provides rich-text editing with Source toggle, formatting toolbar,
 * and Brevo variable injection. Does NOT escape Twig brackets.
 *
 * Usage:
 *   <BrevoWysiwyg
 *     value={htmlContent}
 *     onChange={setHtmlContent}
 *     variables={[
 *       { label: 'Customer Name', key: 'params.name' },
 *       { label: 'Ticket Code', key: 'params.ticket_code' }
 *     ]}
 *   />
 */
export default function BrevoWysiwyg({
  value,
  onChange,
  variables = [],
  placeholder = 'Start designing your email template...',
  disabled = false,
}: BrevoWysiwygProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertOrderedList: false,
    insertUnorderedList: false,
  });

  // Sync initial value into editor
  useEffect(() => {
    if (editorRef.current && !isSourceMode) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.brevo-dropdown')) {
        setShowVariableMenu(false);
        setShowHeadingMenu(false);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  /** Extract raw HTML from editor — restoring any accidentally encoded Twig brackets */
  const extractHtml = useCallback((): string => {
    if (!editorRef.current) return '';
    return editorRef.current.innerHTML
      .replace(/&lbrace;/g, '{')
      .replace(/&rbrace;/g, '}')
      .replace(/&#123;/g, '{')
      .replace(/&#125;/g, '}')
      .replace(/&#37;/g, '%')
      .replace(/&percnt;/g, '%');
  }, []);

  const syncFromEditor = useCallback(() => {
    if (!editorRef.current || isSourceMode) return;
    const cleaned = extractHtml();
    onChange(cleaned);
  }, [isSourceMode, onChange, extractHtml]);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  }, []);

  const execCmd = useCallback(
    (command: string, val: string | null = null) => {
      if (isSourceMode || disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false, val ?? undefined);
      syncFromEditor();
      updateActiveFormats();
    },
    [isSourceMode, disabled, syncFromEditor, updateActiveFormats]
  );

  const toggleSourceMode = useCallback(() => {
    if (isSourceMode) {
      // Source → Visual
      onChange(sourceCode);
      setIsSourceMode(false);
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = sourceCode;
      }, 0);
    } else {
      // Visual → Source
      const html = extractHtml();
      setSourceCode(html);
      onChange(html);
      setIsSourceMode(true);
    }
    setShowVariableMenu(false);
    setShowHeadingMenu(false);
  }, [isSourceMode, sourceCode, onChange, extractHtml]);

  const insertLink = useCallback(() => {
    if (isSourceMode || disabled) return;
    const url = prompt('Enter URL:');
    if (url) execCmd('createLink', url);
  }, [isSourceMode, disabled, execCmd]);

  const insertVariable = useCallback(
    (variable: BrevoVariable) => {
      if (disabled) return;
      const twigExpr = `{{ ${variable.key} }}`;

      if (isSourceMode && sourceRef.current) {
        const el = sourceRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const updated = sourceCode.substring(0, start) + twigExpr + sourceCode.substring(end);
        setSourceCode(updated);
        onChange(updated);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + twigExpr.length;
          el.focus();
        }, 0);
      } else if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, twigExpr);
        syncFromEditor();
      }

      setShowVariableMenu(false);
    },
    [disabled, isSourceMode, sourceCode, onChange, syncFromEditor]
  );

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setSourceCode(val);
      onChange(val);
    },
    [onChange]
  );

  const wrapperClasses = [
    'brevo-wysiwyg',
    disabled && 'brevo-wysiwyg--disabled',
    isFocused && 'brevo-wysiwyg--focused',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses}>
      {/* ── Toolbar ── */}
      <div className="brevo-toolbar">
        <div className="brevo-toolbar__group">
          <button
            type="button"
            className={`brevo-btn ${activeFormats.bold ? 'brevo-btn--active' : ''}`}
            title="Bold"
            onClick={() => execCmd('bold')}
            disabled={disabled}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`brevo-btn ${activeFormats.italic ? 'brevo-btn--active' : ''}`}
            title="Italic"
            onClick={() => execCmd('italic')}
            disabled={disabled}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={`brevo-btn ${activeFormats.underline ? 'brevo-btn--active' : ''}`}
            title="Underline"
            onClick={() => execCmd('underline')}
            disabled={disabled}
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className={`brevo-btn ${activeFormats.strikeThrough ? 'brevo-btn--active' : ''}`}
            title="Strikethrough"
            onClick={() => execCmd('strikeThrough')}
            disabled={disabled}
          >
            <s>S</s>
          </button>
        </div>

        <div className="brevo-toolbar__divider" />

        {/* Heading dropdown */}
        <div className="brevo-dropdown">
          <button
            type="button"
            className="brevo-btn"
            title="Headings"
            onClick={(e) => {
              e.stopPropagation();
              setShowHeadingMenu((v) => !v);
              setShowVariableMenu(false);
            }}
            disabled={disabled}
          >
            H ▾
          </button>
          {showHeadingMenu && (
            <div className="brevo-dropdown__menu">
              <button type="button" onClick={() => { execCmd('formatBlock', 'h1'); setShowHeadingMenu(false); }}>
                Heading 1
              </button>
              <button type="button" onClick={() => { execCmd('formatBlock', 'h2'); setShowHeadingMenu(false); }}>
                Heading 2
              </button>
              <button type="button" onClick={() => { execCmd('formatBlock', 'h3'); setShowHeadingMenu(false); }}>
                Heading 3
              </button>
              <button type="button" onClick={() => { execCmd('formatBlock', 'p'); setShowHeadingMenu(false); }}>
                Paragraph
              </button>
            </div>
          )}
        </div>

        <div className="brevo-toolbar__divider" />

        <div className="brevo-toolbar__group">
          <button
            type="button"
            className={`brevo-btn ${activeFormats.insertUnorderedList ? 'brevo-btn--active' : ''}`}
            title="Bullet List"
            onClick={() => execCmd('insertUnorderedList')}
            disabled={disabled}
          >
            • List
          </button>
          <button
            type="button"
            className={`brevo-btn ${activeFormats.insertOrderedList ? 'brevo-btn--active' : ''}`}
            title="Numbered List"
            onClick={() => execCmd('insertOrderedList')}
            disabled={disabled}
          >
            1. List
          </button>
        </div>

        <div className="brevo-toolbar__divider" />

        <div className="brevo-toolbar__group">
          <button type="button" className="brevo-btn" title="Align Left" onClick={() => execCmd('justifyLeft')} disabled={disabled}>
            ⫷
          </button>
          <button type="button" className="brevo-btn" title="Align Center" onClick={() => execCmd('justifyCenter')} disabled={disabled}>
            ⫿
          </button>
          <button type="button" className="brevo-btn" title="Align Right" onClick={() => execCmd('justifyRight')} disabled={disabled}>
            ⫸
          </button>
        </div>

        <div className="brevo-toolbar__divider" />

        <button type="button" className="brevo-btn" title="Insert Link" onClick={insertLink} disabled={disabled}>
          🔗
        </button>

        {/* Variable injector */}
        {variables.length > 0 && (
          <>
            <div className="brevo-toolbar__divider" />
            <div className="brevo-dropdown">
              <button
                type="button"
                className="brevo-btn brevo-btn--accent"
                title="Insert Variable"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVariableMenu((v) => !v);
                  setShowHeadingMenu(false);
                }}
                disabled={disabled}
              >
                {'{{ }}'} Insert Variable ▾
              </button>
              {showVariableMenu && (
                <div className="brevo-dropdown__menu brevo-dropdown__menu--variables">
                  {variables.map((v) => (
                    <button type="button" key={v.key} onClick={() => insertVariable(v)}>
                      <span className="brevo-var-label">{v.label}</span>
                      <code className="brevo-var-key">{`{{ ${v.key} }}`}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Source toggle */}
        <div className="brevo-toolbar__spacer" />
        <button
          type="button"
          className={`brevo-btn brevo-btn--source ${isSourceMode ? 'brevo-btn--active' : ''}`}
          title="Toggle Source View"
          onClick={toggleSourceMode}
          disabled={disabled}
        >
          {isSourceMode ? '✎ Visual' : '</> Source'}
        </button>
      </div>

      {/* ── Editor Area ── */}
      <div className="brevo-editor-wrapper">
        {isSourceMode ? (
          <textarea
            ref={sourceRef}
            className="brevo-source"
            value={sourceCode}
            onChange={handleSourceChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            spellCheck={false}
          />
        ) : (
          <div
            ref={editorRef}
            className="brevo-editor"
            contentEditable={!disabled}
            role="textbox"
            aria-multiline={true}
            aria-label="Email template editor"
            data-placeholder={placeholder}
            onInput={() => { syncFromEditor(); updateActiveFormats(); }}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            suppressContentEditableWarning
          />
        )}
      </div>
    </div>
  );
}
