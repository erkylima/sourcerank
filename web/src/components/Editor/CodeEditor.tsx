import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Editor } from '@monaco-editor/react'
import { useCrdtContent } from '@/hooks/useCrdtContent'
import '@/styles/Editor.css'

interface CodeEditorProps {
  code: string
  language: string
  onChange: (code: string) => void
  onLanguageChange?: (language: string) => void
  readOnly?: boolean
  useCrdt?: boolean
  sessionId?: string
  challengeId?: string
  onUpdateContentRef?: (updateContent: (content: string) => void) => void
  onUpdateLanguageRef?: (updateLanguage: (language: string) => void) => void
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onChange,
  onLanguageChange,
  readOnly = false,
  useCrdt = false,
  sessionId,
  challengeId,
  onUpdateContentRef,
  onUpdateLanguageRef,
}) => {
  const editorRef = useRef<any>(null)
  const [localCode, setLocalCode] = useState(code)
  const lastSentContentRef = useRef(code) // Track what we last sent to avoid feedback loops
  
  // Ensure challengeId is converted to string
  const normalizedChallengeId = String(challengeId || 'unknown')
  
  // Memoize the content change handler to prevent dependency loops
  const handleContentChange = useCallback((newContent: string) => {
    console.log('[CodeEditor] CRDT content updated, syncing local state')
    setLocalCode(newContent)
    onChange(newContent)
  }, [onChange])
  
  // Use generic CRDT content hook
  const { content: syncedContent, language: syncedLanguage, updateContent, updateLanguage } = useCrdtContent({
    enabled: useCrdt,
    sessionId: sessionId || '',
    challengeId: normalizedChallengeId,
    contentType: 'code',
    starterContent: code,
    onContentChange: handleContentChange,
  })

  // When synced language changes, notify parent
  useEffect(() => {
    if (useCrdt && syncedLanguage && syncedLanguage !== language && onLanguageChange) {
      console.log('[CodeEditor] Language changed from CRDT:', { from: language, to: syncedLanguage })
      onLanguageChange(syncedLanguage)
    }
  }, [useCrdt, syncedLanguage, language, onLanguageChange])

  // Log initial mount info
  useEffect(() => {
    // Pass updateContent ref to parent
    if (onUpdateContentRef && updateContent) {
      onUpdateContentRef(updateContent)
    }

    // Pass updateLanguage ref to parent
    if (onUpdateLanguageRef && updateLanguage) {
      onUpdateLanguageRef(updateLanguage)
    }
  }, [updateContent, updateLanguage, onUpdateContentRef, onUpdateLanguageRef])

  // Log when challengeId changes
  useEffect(() => {
    // Track challenge change
  }, [challengeId])

  // Sync parent code prop to local state only when NOT using CRDT
  useEffect(() => {
    if (!useCrdt) {
      console.log('[CodeEditor] Non-CRDT mode: updating from parent prop')
      setLocalCode(code)
    }
  }, [code, useCrdt])

  // Determine which content to display
  // When CRDT is enabled, use syncedContent (updated from the relay)
  // When CRDT is disabled, use localCode (updated from parent or user input)
  // IMPORTANT: If syncedContent is empty during CRDT init, fall back to code prop (starter)
  const displayContent = useCrdt ? (syncedContent || code) : localCode

  useEffect(() => {
    console.log('[CodeEditor] displayContent changed:', displayContent.substring(0, 50))
  }, [displayContent])

  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={language}
        value={displayContent}
        onChange={(value) => {
          const nextValue = value || ''
          if (useCrdt) {
            // Only update CRDT if content actually changed
            if (nextValue !== lastSentContentRef.current) {
              console.log('[CodeEditor] User typed, sending to CRDT')
              lastSentContentRef.current = nextValue
              updateContent(nextValue)
            }
          } else {
            // Non-CRDT mode: update local state
            setLocalCode(nextValue)
            onChange(nextValue)
          }
        }}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          readOnly,
          fontSize: 14,
          lineNumbers: 'on',
        }}
        onMount={(editor) => {
          editorRef.current = editor
          if (useCrdt && displayContent) {
            const model = editor.getModel()
            if (model) {
              console.log('[CodeEditor] onMount - setting value to:', displayContent.substring(0, 50))
              model.setValue(displayContent)
            }
          }
        }}
      />
    </div>
  )
}

export default CodeEditor
