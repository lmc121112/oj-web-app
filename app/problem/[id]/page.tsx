<AceEditor
  mode={getAceMode(language)}
  theme="github"
  name="oj-code-editor"
  value={sourceCode}
  onChange={(val) => setSourceCode(val)}
  width="100%"
  height="400px"
  fontSize={14}
  showPrintMargin={false}
  showGutter={true}
  highlightActiveLine={true}
  setOptions={{
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    showLineNumbers: true,
    tabSize: 4,
    useSoftTabs: true,
  }}
/>
