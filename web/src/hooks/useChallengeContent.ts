import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useCallback, useState } from 'react'
import { ContentRepository, ChallengeContentData } from '@/repositories/ContentRepository'
import { hybridContentRepository } from '@/repositories/HybridContentRepository'

interface UseChallengeContentOptions {
  repository?: ContentRepository
  enableRealtime?: boolean
}

/**
 * SIMPLIFIED: Load from DB + Subscribe to CRDT real-time updates
 * That's it. No complex state management.
 * 
 * Includes language param so API can return starter when needed
 */
export function useChallengeContent(
  sessionId: string | undefined,
  challengeId: string | number | undefined,
  contentType: string = 'code',
  language: string = 'python',
  options: UseChallengeContentOptions = {}
) {
  const { repository = hybridContentRepository, enableRealtime = true } = options
  const normalizedChallengeId = String(challengeId || '')
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  // Track synced content from CRDT
  const [syncedContent, setSyncedContent] = useState<string>('')

  // Step 1: Fetch from DB (simple) - Include language in queryKey so it refetches when language changes
  const { data, isLoading, error } = useQuery<ChallengeContentData>({
    queryKey: ['challenge-content', sessionId, normalizedChallengeId, contentType, language],
    queryFn: async () => {
      if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
        throw new Error('Invalid session or challenge')
      }
      
      const loaded = await repository.load(
        sessionId,
        parseInt(normalizedChallengeId),
        contentType,
        language  // Pass actual language from parameter
      )
      
      console.log('[useChallengeContent] Loaded from DB:', {
        challengeId: normalizedChallengeId,
        contentLength: loaded.content.length,
        started: loaded.started
      })
      
      // Initialize synced content from DB
      setSyncedContent(loaded.content)
      
      return loaded
    },
    enabled: !!sessionId && !!normalizedChallengeId && normalizedChallengeId !== 'unknown',
    staleTime: Infinity,
  })

  // Step 2: Subscribe to CRDT (simple)
  useEffect(() => {
    if (!enableRealtime || !sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
      return
    }

    if (!data) {
      console.log('[useChallengeContent] Waiting for data before CRDT subscribe')
      return
    }

    console.log('[useChallengeContent] Subscribing to CRDT for:', { sessionId, challengeId: normalizedChallengeId })

    // Subscribe and get updates
    const unsub = repository.subscribe(
      sessionId,
      normalizedChallengeId,
      contentType,
      data.language,
      (content) => {
        console.log('[useChallengeContent] CRDT update received:', { contentLength: content.length })
        // Update state so Editor re-renders with new content
        setSyncedContent(content)
      }
    )

    unsubscribeRef.current = unsub

    return () => {
      console.log('[useChallengeContent] Unsubscribing from CRDT')
      unsub()
      unsubscribeRef.current = null
    }
  }, [sessionId, normalizedChallengeId, data, enableRealtime, repository, contentType])

  // Step 3: Publish updates (simple)
  const updateContent = useCallback((content: string) => {
    if (!sessionId || !normalizedChallengeId || !data) return

    console.log('[useChallengeContent] Publishing to CRDT:', { contentLength: content.length })
    
    // Update synced content locally first
    setSyncedContent(content)
    
    // Then publish to CRDT
    repository.publish(
      sessionId,
      normalizedChallengeId,
      contentType,
      content,
      data.language
    )
  }, [sessionId, normalizedChallengeId, data, repository, contentType])

  return {
    content: syncedContent || (data?.content ?? ''),
    language: data?.language ?? 'python',
    started: data?.started ?? false,
    isLoading,
    error,
    updateContent,
  }
}

