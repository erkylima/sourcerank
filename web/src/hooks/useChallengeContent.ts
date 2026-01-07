import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback, useState } from 'react'
import { ContentRepository, ChallengeContentData } from '@/repositories/ContentRepository'
import { hybridContentRepository } from '@/repositories/HybridContentRepository'
import { starterCodeManager } from '@/utils/StarterCodeManager'

interface UseChallengeContentOptions {
  repository?: ContentRepository
  debounceMs?: number
  enableRealtime?: boolean
}

/**
 * Hook for managing challenge content with TanStack Query
 * Now uses Repository pattern for better abstraction
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
    debounceMs = 500,
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
  const saveTimeoutRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isManualLanguageChangeRef = useRef<boolean>(false)  // Track if user manually changed language
  
  // Fetch preferred language when challenge changes
  useEffect(() => {
    if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
      return
    }

    // Reset manual language change flag when challenge changes
    // Next time we load language from server, accept it (don't override)
    isManualLanguageChangeRef.current = false

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
  
  // QueryKey includes language for proper cache separation
  const queryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType, currentLanguage]

  // Query: Load from DB with language
  const { data, isLoading, error } = useQuery<ChallengeContentData>({
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
    enabled: !!sessionId && !!normalizedChallengeId && normalizedChallengeId !== 'unknown' && isLanguageInitialized,
    staleTime: Infinity,
  })

  // Mutation: Save to DB
  const saveMutation = useMutation({
    mutationFn: async (newData: Partial<ChallengeContentData> & { isStarter?: boolean }) => {
      if (!sessionId || !normalizedChallengeId) {
        throw new Error('Invalid session or challenge ID')
      }
      
      const contentToSave = newData.content ?? data?.content ?? ''
      const languageToSave = newData.language ?? data?.language ?? 'python'
      const startedValue = newData.isStarter ? false : true  // Starter = false, normal content = true
      
      await repository.save(
        sessionId,
        parseInt(normalizedChallengeId),
        contentToSave,
        languageToSave,
        contentType,
        startedValue
      )
      
      return { ...data, ...newData, started: startedValue } as ChallengeContentData
    },
    
    // Optimistic update
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<ChallengeContentData>(queryKey)
      
      // Calculate correct started value based on isStarter
      const startedValue = newData.isStarter ? false : true
      
      // Optimistically update cache
      queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
        ...old!,
        ...newData,
        started: startedValue,
      }))
      
      return { previousData }
    },
    
    // Rollback on error
    onError: (err, _newData, context) => {
      console.error('[useChallengeContent] Save failed, rolling back:', err)
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },
    
    // Refetch on success
    onSuccess: () => {},  
  })

  // Initialize refs when data loads (don't change currentLanguage - it's already set from preferred)
  useEffect(() => {
    if (data) {
      localContentRef.current = data.content
      localLanguageRef.current = data.language
    }
  }, [data])
  
  // Setup real-time sync (if enabled)
  useEffect(() => {
    if (!enableRealtime || !sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown' || !isLanguageInitialized) {
      console.log('[useChallengeContent] Real-time sync skipped:', { enableRealtime, sessionId: !!sessionId, normalizedChallengeId, isLanguageInitialized })
      return  // Guard: wait for language to be initialized first
    }

    console.log('[useChallengeContent] Setting up real-time sync for:', { sessionId, normalizedChallengeId, contentType, currentLanguage })

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
        // Use the ref, not state, to avoid stale closures
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
        queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
          ...old!,
          content,
          language,
        }))
      }
    )

    return () => {
      console.log('[useChallengeContent] Cleaning up real-time sync')
      unsubscribe()
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
    // DO NOT include currentLanguage in deps!
    // The CRDT subscription is keyed by language on the server side,
    // so when you change currentLanguage, you need to also refetch the query (which is separate).
    // The subscription should only re-run when session/challenge/content type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, normalizedChallengeId, contentType, enableRealtime])

  // Save content when leaving challenge/language combination
  useEffect(() => {
    return () => {
      // Cleanup: Save the current content when unmounting or before switching challenge
      if (sessionId && normalizedChallengeId && normalizedChallengeId !== 'unknown' && localContentRef.current) {
        console.log('[useChallengeContent] 💾 Saving content on cleanup for challenge:', {
          sessionId,
          normalizedChallengeId,
          language: localLanguageRef.current,
          contentLength: localContentRef.current.length
        })
        
        // Use repository to save directly, bypassing mutation (fire-and-forget)
        repository.save(
          sessionId,
          parseInt(normalizedChallengeId),
          localContentRef.current,
          localLanguageRef.current,
          contentType,
          true  // Save as started:true
        ).catch(err => {
          console.warn('[useChallengeContent] ⚠️ Failed to save on cleanup:', err)
        })
      }
    }
  }, [sessionId, normalizedChallengeId, contentType, repository])

  // Helper functions
  const updateContent = useCallback((content: string, isStarter: boolean = false) => {
    // Update local ref immediately
    localContentRef.current = content
    
    // Update cache immediately for instant UI response
    queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
      ...old!,
      content,
    }))
    
    // Publish to real-time sync immediately
    if (enableRealtime && sessionId && normalizedChallengeId && currentLanguage) {
      repository.publish(
        sessionId,
        normalizedChallengeId,
        contentType,
        content,
        currentLanguage
      )
    }
    
    // Debounce DB save
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = window.setTimeout(() => {
      saveMutation.mutate({ content, isStarter })
    }, debounceMs)
  }, [sessionId, normalizedChallengeId, contentType, currentLanguage, queryClient, queryKey, saveMutation, enableRealtime, repository, debounceMs])

  const updateLanguage = useCallback((language: string) => {
    if (language === currentLanguage) {
      console.log('[useChallengeContent] Language already set to:', language)
      return  // No change needed
    }
    
    console.log('[useChallengeContent] User changed language from', currentLanguage, 'to:', language)
    
    // Mark this as a manual change (don't override with preferred language on next desafio change)
    isManualLanguageChangeRef.current = true
    
    // IMPORTANT: Save current content with old language BEFORE switching
    // This registers the old language as being used (for preferred language tracking)
    if (sessionId && normalizedChallengeId && normalizedChallengeId !== 'unknown' && localContentRef.current) {
      const oldLanguage = currentLanguage
      console.log('[useChallengeContent] Saving content for old language:', oldLanguage, 'with length:', localContentRef.current.length)
      saveMutation.mutate({ 
        content: localContentRef.current, 
        language: oldLanguage,
        isStarter: false 
      })
    }
    
    // Invalidate old query cache for previous language
    const oldQueryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType, currentLanguage]
    queryClient.removeQueries({ queryKey: oldQueryKey })
    
    // Update state to new language - this will trigger the query to fetch for new language
    setCurrentLanguage(language)
    localLanguageRef.current = language
  }, [sessionId, normalizedChallengeId, repository, currentLanguage, contentType, queryClient, saveMutation])

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
    isSaving: saveMutation.isPending,
  }
}
