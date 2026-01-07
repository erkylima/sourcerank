import React, { useEffect, useRef, useMemo } from 'react'
import { Editor } from '@monaco-editor/react'
import { useChallengeContent } from '@/hooks/useChallengeContent'
import { EditorSyncController } from '@/utils/EditorSyncController'
import '@/styles/Editor.css'

interface CodeEditorProps {
  sessionId?: string
  challengeId?: string | number
  onLanguageChange?: (language: string) => void
  onUpdateLanguageRef?: (fn: (lang: string) => void) => void
  onUpdateContentRef?: (fn: (content: string) => void) => void
  onContentChange?: (content: string) => void
  onStartedChange?: (started: boolean) => void
  readOnly?: boolean
}

/**
 * CodeEditor - Refactored with Repository Pattern and SOLID principles
 * Uses TanStack Query for server state + CRDT for real-time sync
 * Delegates sync logic to EditorSyncController
 * Delegates starter logic to StarterCodeManager
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  sessionId,
  challengeId,
  onLanguageChange,
  onUpdateLanguageRef,
  onUpdateContentRef,
  onContentChange,
  onStartedChange,
  readOnly = false,
}) => {
  const editorRef = useRef<any>(null)
  const prevLanguageRef = useRef<string>('')
  const lastContentRef = useRef<string>('')
  const isInitializedRef = useRef(false)
  
  // Create EditorSyncController instance (one per component)
  const syncController = useMemo(() => new EditorSyncController(), [])

  // Use new hook with TanStack Query + CRDT
  const {
    content,
    language,
    started,
    isLoading,
    updateContent,
    updateLanguage,
    isSaving,
  } = useChallengeContent(sessionId, challengeId)

  // Reset flags when challenge changes
  useEffect(() => {
    isInitializedRef.current = false
  }, [challengeId, sessionId])

  // REMOVED: Starter logic moved to useChallengeContent hook (Phase 2)
  // Editor is now passive - it just renders what the hook provides
  
  // Update editor model directly when content changes from external source
  useEffect(() => {
    if (!isInitializedRef.current) return
    
    const editor = editorRef.current
    if (!editor) return
    
    const model = editor.getModel()
    if (!model) return
    
    const currentValue = model.getValue()
    
    // Only update if content actually changed (prevents cursor jumps)
    if (content !== currentValue && content !== lastContentRef.current) {
      
      // Delegate to EditorSyncController
      syncController.applyExternalUpdate(editor, content, () => {
        lastContentRef.current = content
      })
    } else {
      console.log('[CodeEditor] ❌ Skipping update - already in sync')
    }
  }, [content, syncController])

  // Expose updateLanguage to parent
  useEffect(() => {
    if (onUpdateLanguageRef && updateLanguage) {
      onUpdateLanguageRef(updateLanguage)
    }
  }, [onUpdateLanguageRef, updateLanguage])

  // Expose updateContent to parent
  useEffect(() => {
    if (onUpdateContentRef && updateContent) {
      onUpdateContentRef(updateContent)
    }
  }, [onUpdateContentRef, updateContent])

  // Notify parent when content changes
  useEffect(() => {
    if (onContentChange) {
      onContentChange(content)
    }
  }, [content, onContentChange])

  // Notify parent when started flag changes
  useEffect(() => {
    if (onStartedChange) {
      onStartedChange(started)
    }
  }, [started, onStartedChange])

  // Notify parent when language changes
  useEffect(() => {
    if (language && language !== prevLanguageRef.current && onLanguageChange) {
      console.log('[CodeEditor] Language changed:', { from: prevLanguageRef.current, to: language })
      onLanguageChange(language)
      prevLanguageRef.current = language
    }
  }, [language, onLanguageChange])

  // Handle editor changes
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || readOnly) return
    
    // Delegate to EditorSyncController - it will block if external update is in progress
    if (!syncController.handleUserInput(value)) {
      console.log('[CodeEditor] 🚫 Ignoring onChange - programmatic update')
      return
    }
    
    console.log('[CodeEditor] 📝 User typed, updating content length:', value.length)
    
    // Track this as local change BEFORE calling updateContent
    lastContentRef.current = value
    
    // Update content (saves to DB + broadcasts to CRDT)
    updateContent(value)
  }

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    // Initialize lastContentRef with initial content
    const model = editor.getModel()
    if (model) {
      const initialValue = model.getValue()
      lastContentRef.current = initialValue
      console.log('[CodeEditor] Editor mounted with content length:', initialValue.length)
    }
    
    // Mark as initialized so useEffect can start handling updates
    isInitializedRef.current = true
  }
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncController.reset()
    }
  }, [syncController])

  if (isLoading) {
    return (
      <div className="editor-loading">
        <p>Carregando editor...</p>
      </div>
    )
  }

  return (
    <div className="code-editor-container">
      {isSaving && (
        <div className="saving-indicator">
          <span>💾 Salvando...</span>
        </div>
      )}
      <Editor
        key={`${sessionId}-${challengeId}`}
        height="100%"
        language={language}
        defaultValue={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  )
}

export default CodeEditor
