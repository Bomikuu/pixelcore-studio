export const inputCss = `
[data-slot="input"],[data-slot="textarea"],[data-slot="native-select"]{display:flex;width:100%;min-width:0;border:1px solid var(--editor-controlBorder);border-radius:6px;background:var(--editor-input);color:var(--editor-text);padding:8px 12px;font:inherit;caret-color:var(--editor-focus);transition:border-color 140ms ease-out,box-shadow 140ms ease-out}
[data-slot="input"]::placeholder,[data-slot="textarea"]::placeholder{color:var(--editor-muted)}
[data-slot="input"]:focus-visible,[data-slot="textarea"]:focus-visible,[data-slot="native-select"]:focus-visible{border-color:var(--editor-focus);outline:0;box-shadow:0 0 0 1px var(--editor-focus)}
[data-slot="input"][aria-invalid="true"],[data-slot="textarea"][aria-invalid="true"]{border-color:var(--editor-danger)}
[data-slot="input"]:disabled,[data-slot="textarea"]:disabled,[data-slot="native-select"]:disabled{opacity:.5;cursor:not-allowed}
.ui-input-group{position:relative;display:flex;align-items:center;min-width:0}
.ui-field .ui-input-group>input{padding-right:44px}
.ui-field .ui-input-group>.ui-input-action{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;min-height:32px;margin:0;padding:6px;border-radius:4px;color:var(--editor-muted);background:transparent}
.ui-field .ui-input-group>.ui-input-action:hover{background:var(--editor-selected);color:var(--editor-text)}
.ui-input-action svg{width:17px;height:17px;flex-shrink:0}
.ui-input::file-selector-button{border:0;border-radius:4px;background:var(--editor-selected);color:var(--editor-text);font:inherit;font-weight:500;padding:4px 8px;margin-right:10px}
@media(prefers-reduced-motion:reduce){[data-slot="input"],[data-slot="textarea"],[data-slot="native-select"]{transition:none}}
`;
