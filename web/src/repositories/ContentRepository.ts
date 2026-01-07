/**
 * Content Repository Interface
 * Abstraction for content persistence and synchronization
 */

export interface ChallengeContentData {
  content: string
  language: string
  started: boolean
}

export type ContentUpdateCallback = (content: string, language: string) => void
export type UnsubscribeFunction = () => void

/**
 * Repository interface for challenge content
 * Abstracts the underlying storage (DB + CRDT)
 */
export interface ContentRepository {
  /**
   * Get preferred language for a challenge (most recently used)
   */
  getPreferredLanguage(
    sessionId: string,
    challengeId: number
  ): Promise<string>

  /**
   * Load content from persistent storage
   */
  load(
    sessionId: string,
    challengeId: number,
    contentType: string,
    language: string
  ): Promise<ChallengeContentData>

  /**
   * Save content to persistent storage
   */
  save(
    sessionId: string,
    challengeId: number,
    content: string,
    language: string,
    contentType: string,
    started?: boolean
  ): Promise<void>

  /**
   * Subscribe to real-time updates
   */
  subscribe(
    sessionId: string,
    challengeId: string,
    contentType: string,
    language: string,
    callback: ContentUpdateCallback
  ): UnsubscribeFunction

  /**
   * Publish changes to real-time channel
   */
  publish(
    sessionId: string,
    challengeId: string,
    contentType: string,
    content: string,
    language: string
  ): void
}
