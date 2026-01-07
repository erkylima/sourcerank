/**
 * Hybrid Content Repository
 * Implements ContentRepository using DB (persistent) + CRDT (real-time)
 */

import {
  ContentRepository,
  ChallengeContentData,
  ContentUpdateCallback,
  UnsubscribeFunction,
} from './ContentRepository'
import sessionContentService from '@/services/session-content.service'
import crdtSyncService from '@/services/crdt-sync.service'

export class HybridContentRepository implements ContentRepository {
  /**
   * Load content from database
   */
  async load(
    sessionId: string,
    challengeId: number,
    contentType: string
  ): Promise<ChallengeContentData> {
    return await sessionContentService.loadChallengeContent(
      sessionId,
      challengeId,
      contentType
    )
  }

  /**
   * Save content to database
   */
  async save(
    sessionId: string,
    challengeId: number,
    content: string,
    language: string,
    contentType: string
  ): Promise<void> {
    await sessionContentService.saveChallengeContent(
      sessionId,
      challengeId,
      content,
      language,
      contentType
    )
  }

  /**
   * Subscribe to CRDT real-time updates
   */
  subscribe(
    sessionId: string,
    challengeId: string,
    contentType: string,
    callback: ContentUpdateCallback
  ): UnsubscribeFunction {
    return crdtSyncService.subscribe(
      sessionId,
      challengeId,
      contentType,
      callback
    )
  }

  /**
   * Publish changes to CRDT
   */
  publish(
    sessionId: string,
    challengeId: string,
    contentType: string,
    content: string,
    language: string
  ): void {
    crdtSyncService.publish(
      sessionId,
      challengeId,
      contentType,
      content,
      language
    )
  }
}

// Export singleton instance
export const hybridContentRepository = new HybridContentRepository()
