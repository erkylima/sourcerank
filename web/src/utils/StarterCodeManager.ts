/**
 * Starter Code Manager
 * Encapsulates logic for applying starter code
 */

import { LANGUAGE_STARTERS } from '@/constants/languages'

export class StarterCodeManager {
  /**
   * Check if starter code should be applied
   * @param started - Whether the challenge has been started
   * @param content - Current content
   * @returns true if starter should be applied
   */
  shouldApply(started: boolean, content: string): boolean {
    return !started && !content
  }

  /**
   * Get starter code for a language
   * @param language - Programming language
   * @returns Starter code template
   */
  getStarter(language: string): string {
    return (
      LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] ||
      LANGUAGE_STARTERS.python
    )
  }

  /**
   * Apply starter code
   * @param language - Programming language
   * @param updateContent - Function to update content
   */
  apply(language: string, updateContent: (content: string) => void): void {
    const starter = this.getStarter(language)
    console.log('[StarterCodeManager] ⭐ Applying starter for:', language)
    updateContent(starter)
  }

  /**
   * Check if starter should be applied on language change
   * @param started - Whether the challenge has been started
   * @param isLanguageChangeOnly - If this is only a language change (not initial load)
   * @returns true if starter should be applied
   */
  shouldApplyOnLanguageChange(
    started: boolean,
    isLanguageChangeOnly: boolean
  ): boolean {
    // Apply starter on language change only if not yet started
    return !started && isLanguageChangeOnly
  }
}

// Export singleton instance
export const starterCodeManager = new StarterCodeManager()
