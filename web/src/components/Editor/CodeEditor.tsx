import React, { useEffect, useRef } from 'react'
import { Editor } from '@monaco-editor/react'
import '@/styles/Editor.css'

interface CodeEditorProps {
  code: string
  language: string
  onChange: (code: string) => void
  readOnly?: boolean
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, language, onChange, readOnly = false }) => {
  const editorRef = useRef<any>(null)

  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={(value) => onChange(value || '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          readOnly,
          fontSize: 14,
          lineNumbers: 'on',
        }}
        onMount={(editor) => {
          editorRef.current = editor
        }}
      />
    </div>
  )
}

export default CodeEditor
