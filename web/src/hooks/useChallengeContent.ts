import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback, useState } from 'react'
import { ContentRepository, ChallengeContentData } from '@/repositories/ContentRepository'
import { hybridContentRepository } from '@/repositories/HybridContentRepository'
import { starterCodeManager } from '@/utils/StarterCodeManager'

interface UseChallengeContentOptions {
  repository?: ContentRepository
  enableRealtime?: boolean
}

/**
 * Simplified hook for managing challenge content with TanStack Query
 * NOW USES POLLING ARCHITECTURE: Content is synced via API polling, not manual saves
 * 
 * - Load from DB ✅
 * - Pass to CRDT (relay) ✅
 * - Trust polling (every 5s) to persist changes ✅
 * - NO manual save mutations
 * - NO debounce/throttle on save
 * - Language changes via dedicated endpoint
 * 
 * @param sessionId - Session identifier
 * @param challengeId - Challenge identifier
 * @param contentType - Type of content (default: 'code')
 * @param options - Configuration options
 */
export function useChallengeContent(
  sessionId: string | undefined,
  challengeId: string | number | undefined,
  contentType: string = 'code',
  options: UseChallengeContentOptions = {}
) {
  const {
    repository = hybridContentRepository,
    enableRealtime = true,
  } = options

  const queryClient = useQueryClient()
  const normalizedChallengeId = String(challengeId || '')
  
  // Track current language in state (reactive)
  const [currentLanguage, setCurrentLanguage] = useState<string>('python')
  const [isLanguageInitialized, setIsLanguageInitialized] = useState(false)
  
  // Refs to prevent feedback loops
  const localContentRef = useRef<string>('')
  const localLanguageRef = useRef<string>('python')
  const abortControllerRef = useRef<AbortController | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)  // Keep track of current subscription
  
  // Fetch preferred language when challenge changes
  useEffect(() => {
    if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
      return
    }

    // Reset subscription when challenge changes
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // Cancel any pending language fetch from previous challenge
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    const currentAbort = abortControllerRef.current
    
    setIsLanguageInitialized(false)
    
    repository.getPreferredLanguage(sessionId, parseInt(normalizedChallengeId))
      .then(language => {
        // Only update if this request wasn't cancelled
        if (!currentAbort.signal.aborted) {
          console.log('[useChallengeContent] ✅ Preferred language loaded:', language)
          setCurrentLanguage(language)
          localLanguageRef.current = language
          setIsLanguageInitialized(true)
        }
      })
      .catch(err => {
        // Only update if this request wasn't cancelled
        if (!currentAbort.signal.aborted) {
          console.warn('[useChallengeContent] ⚠️ Failed to get preferred language:', err)
          setCurrentLanguage('python')
          localLanguageRef.current = 'python'
          setIsLanguageInitialized(true)
        }
      })
    
    // Cleanup on unmount
    return () => {
      if (currentAbort) {
        currentAbort.abort()
      }
    }
  }, [sessionId, normalizedChallengeId, repository])

  // Invalidate cache when challenge changes (to force refetch)
  useEffect(() => {
    if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
      return
    }

    console.log('[useChallengeContent] Challenge changed, invalidating old language queries')
    
    // Invalidate ALL queries for this challenge (all languages) since we're moving to a new challenge
    queryClient.invalidateQueries({
      queryKey: ['challenge-content', sessionId, normalizedChallengeId],
      refetchType: 'inactive'  // Only refetch if query is actually being used
    })
  }, [sessionId, normalizedChallengeId, queryClient])
  
  // QueryKey includes language for proper cache separation
  const queryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType, currentLanguage]

  // Query: Load from DB with language
  const { data, isLoading, error, refetch } = useQuery<ChallengeContentData>({
    queryKey,
    queryFn: async () => {
      if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
        throw new Error('Invalid session or challenge ID')
      }
      
      const loadedData = await repository.load(
        sessionId,
        parseInt(normalizedChallengeId),
        contentType,
        currentLanguage
      )
      
      // Validate language consistency
      if (loadedData.language !== currentLanguage) {
        console.error('[❌ DB] Language mismatch:', {
          loaded: loadedData.language,
          expected: currentLanguage
        })
      }
      
      return loadedData
    },
    enabled: !!sessionId && !!normalizedChallengeId && normalizedChallengeId !== 'unknown',
    staleTime: Infinity,
  })

  // Phase 1b: Refetch when language changes (after initial language is loaded)
  useEffect(() => {
    if (isLanguageInitialized && data) {
      // Language just became ready, refetch data for this new language
      refetch()
    }
  }, [isLanguageInitialized, currentLanguage])

  // Phase 2: Apply starter logic when DB data is ready
  // This runs ONLY ONCE per challenge+language combination
  useEffect(() => {
    if (!data || isLoading) {
      return // Wait for DB to load
    }

    console.log('[useChallengeContent] Phase 2: Checking if starter needed:', {
      contentLength: data.content.length,
      started: data.started,
      language: currentLanguage,
    })

    // If content is empty, apply starter (DO NOT save to DB yet)
    if (data.content === '' && !data.started) {
      console.log('[useChallengeContent] Phase 2: Applying starter for language:', currentLanguage)
      const starter = starterCodeManager.getStarter(currentLanguage)
      
      // Update query cache with starter (DON'T save to DB)
      // This ensures Editor sees content, but DB still has empty
      queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
        ...old!,
        content: starter,
        started: false, // Keep as false so on DB sync, polling can save it
      }))
      
      localContentRef.current = starter
    }
  }, [data, isLoading, currentLanguage, queryClient, queryKey])

  // Phase 3: Setup real-time sync ONLY after DB phase is complete
  useEffect(() => {
    if (!enableRealtime || !sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown' || !isLanguageInitialized) {
      console.log('[useChallengeContent] Real-time sync skipped:', { enableRealtime, sessionId: !!sessionId, normalizedChallengeId, isLanguageInitialized })
      return  // Guard: wait for language and DB to be ready first
    }

    // IMPORTANT: Only setup after data is loaded
    if (!data || isLoading) {
      console.log('[useChallengeContent] Phase 3: Waiting for data', { hasData: !!data, isLoading })
      return
    }

    console.log('[useChallengeContent] Phase 3: Setting up real-time sync for:', { sessionId, normalizedChallengeId, contentType, currentLanguage })

    // Create stable reference to queryClient and queryKey for use in callback
    const currentQueryKey: typeof queryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType, currentLanguage]
    const currentQueryClient = queryClient

    const unsubscribe = repository.subscribe(
      sessionId,
      normalizedChallengeId,
      contentType,
      currentLanguage,
      (content, language) => {
        // Prevent echo: only update if different from local
        const isContentDifferent = content !== localContentRef.current
        const isLanguageDifferent = language !== localLanguageRef.current
        
        if (!isContentDifferent && !isLanguageDifferent) {
          return  // Ignore echo
        }
        
        // CRITICAL: Only apply if language matches current context
        if (language !== localLanguageRef.current) {
          console.warn('[⚠️ CRDT] Language mismatch - ignored:', {
            received: language,
            expected: localLanguageRef.current
          })
          return
        }
        
        // Update refs
        localContentRef.current = content
        localLanguageRef.current = language
        
        // Update query cache with CRDT data
        console.log('[useChallengeContent] Real-time update from CRDT:', { contentLength: content.length })
        currentQueryClient.setQueryData<ChallengeContentData>(currentQueryKey, (old) => ({
          ...old!,
          content,
          language,
        }))
      }
    )
    
    // Store for cleanup
    unsubscribeRef.current = unsubscribe

    return () => {
      console.log('[useChallengeContent] Cleaning up real-time sync')
      unsubscribe()
      unsubscribeRef.current = null
    }
  }, [sessionId, normalizedChallengeId, contentType, enableRealtime, currentLanguage, isLanguageInitialized])

  // Helper function to update content (IMPORTANT: No manual save here)
  const updateContent = useCallback((content: string, isStarter: boolean = false) => {
    // Update local ref immediately
    localContentRef.current = content
    
    // Update cache immediately for instant UI response
    queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
      ...old!,
      content,
    }))
    
    // Publish to real-time sync ONLY (let polling handle DB persistence)
    if (enableRealtime && sessionId && normalizedChallengeId && currentLanguage) {
      console.log('[useChallengeContent] Publishing to CRDT (polling will persist):', { contentLength: content.length })
      repository.publish(
        sessionId,
        normalizedChallengeId,
        contentType,
        content,
        currentLanguage
      )
    }
  }, [sessionId, normalizedChallengeId, contentType, currentLanguage, queryClient, queryKey, enableRealtime, repository])

  const updateLanguage = useCallback((language: string) => {
    if (language === currentLanguage) {
      console.log('[useChallengeContent] Language already set to:', language)
      return  // No change needed
    }
    
    console.log('[useChallengeContent] User changed language to:', language)
    
    // Call backend to handle language switch
    // This will: move current to history, load new from history or create starter
    if (sessionId && normalizedChallengeId && normalizedChallengeId !== 'unknown') {
      repository.changeLanguage?.(
        sessionId,
        parseInt(normalizedChallengeId),
        language,
        contentType
      ).then(() => {
        // Update state to new language - this will trigger the query to fetch for new language
        setCurrentLanguage(language)
        localLanguageRef.current = language
        
        // Invalidate old query cache for previous language
        const oldQueryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType, currentLanguage]
        queryClient.removeQueries({ queryKey: oldQueryKey })
      }).catch(err => {
        console.error('[useChallengeContent] Failed to change language:', err)
      })
    } else {
      // Fallback: just change locally if no backend call
      setCurrentLanguage(language)
      localLanguageRef.current = language
    }
  }, [sessionId, normalizedChallengeId, repository, currentLanguage, contentType, queryClient])

  const applyStarter = useCallback((language?: string) => {
    const lang = language || data?.language || 'python'
    
    // Use StarterCodeManager for cleaner abstraction
    starterCodeManager.apply(lang, updateContent)
  }, [data?.language, updateContent])

  return {
    content: data?.content ?? '',
    language: data?.language ?? 'python',
    started: data?.started ?? false,
    isLoading,
    error,
    updateContent,
    updateLanguage,
    applyStarter,
    isSaving: false,  // No manual saves anymore, polling handles it
  }
}

