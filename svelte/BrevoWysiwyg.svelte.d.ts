import { SvelteComponent } from 'svelte';

declare class BrevoWysiwyg extends SvelteComponent<{
	value?: string;
	variables?: Array<{ label: string; key: string }>;
	placeholder?: string;
	disabled?: boolean;
}> {}

export default BrevoWysiwyg;
