/**
 * Editor Sync Controller
 * Manages synchronization between Monaco editor and external updates
 */

export class EditorSyncController {
  private isApplyingExternal = false

  /**
   * Apply external content update to Monaco editor
   * Prevents onChange from firing during programmatic updates
   */
  applyExternalUpdate(
    editor: any,
    content: string,
    onComplete?: () => void
  ): void {
    if (!editor) return

    const model = editor.getModel()
    if (!model) return

    const currentValue = model.getValue()
    if (currentValue === content) {
      console.log('[EditorSyncController] Content already in sync, skipping')
      return
    }

    console.log('[EditorSyncController] 📥 Applying external update')

    // Set flag to block onChange
    this.isApplyingExternal = true

    // Save cursor position and selection
    const position = editor.getPosition()
    const selection = editor.getSelection()

    // Apply update using pushEditOperations for better undo/redo
    model.pushEditOperations(
      [],
      [
        {
          range: model.getFullModelRange(),
          text: content,
        },
      ],
      () => null
    )

    // Restore cursor and selection
    if (selection) {
      editor.setSelection(selection)
    } else if (position) {
      editor.setPosition(position)
    }

    // Reset flag after short delay
    setTimeout(() => {
      this.isApplyingExternal = false
      if (onComplete) onComplete()
    }, 10)
  }

  /**
   * Handle user input from Monaco
   * Returns false if input should be ignored (during external update)
   * @param _value - The new value (unused but kept for API clarity)
   */
  handleUserInput(_value: string): boolean {
    if (this.isApplyingExternal) {
      console.log('[EditorSyncController] 🚫 Ignoring onChange - external update in progress')
      return false
    }
    return true
  }

  /**
   * Check if currently applying external update
   */
  isApplyingExternalUpdate(): boolean {
    return this.isApplyingExternal
  }

  /**
   * Reset state (useful for cleanup)
   */
  reset(): void {
    this.isApplyingExternal = false
  }
}
