import React from 'react';

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

export default function BrevoWysiwyg(props: BrevoWysiwygProps): React.JSX.Element;
