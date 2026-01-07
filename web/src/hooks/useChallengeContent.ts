import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
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
  
  const queryKey = ['challenge-content', sessionId, normalizedChallengeId, contentType]
  
  // Refs to prevent feedback loops
  const localContentRef = useRef<string>('')
  const localLanguageRef = useRef<string>('python')
  const saveTimeoutRef = useRef<number | null>(null)

  // Query: Load from DB
  const { data, isLoading, error } = useQuery<ChallengeContentData>({
    queryKey,
    queryFn: async () => {
      if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
        throw new Error('Invalid session or challenge ID')
      }
      
      console.log('[useChallengeContent] Loading from repository:', { sessionId, challengeId: normalizedChallengeId })
      const loadedData = await repository.load(
        sessionId,
        parseInt(normalizedChallengeId),
        contentType
      )
      
      console.log('[useChallengeContent] Loaded data:', { 
        started: loadedData.started, 
        hasContent: !!loadedData.content,
        language: loadedData.language 
      })
      
      return loadedData
    },
    enabled: !!sessionId && !!normalizedChallengeId && normalizedChallengeId !== 'unknown',
    staleTime: Infinity,
  })

  // Mutation: Save to DB
  const saveMutation = useMutation({
    mutationFn: async (newData: Partial<ChallengeContentData>) => {
      if (!sessionId || !normalizedChallengeId) {
        throw new Error('Invalid session or challenge ID')
      }
      
      const contentToSave = newData.content ?? data?.content ?? ''
      const languageToSave = newData.language ?? data?.language ?? 'python'
      
      console.log('[useChallengeContent] Saving to repository:', { 
        sessionId, 
        challengeId: normalizedChallengeId,
        contentLength: contentToSave.length,
        language: languageToSave 
      })
      
      await repository.save(
        sessionId,
        parseInt(normalizedChallengeId),
        contentToSave,
        languageToSave,
        contentType
      )
      
      return { ...data, ...newData, started: true } as ChallengeContentData
    },
    
    // Optimistic update
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<ChallengeContentData>(queryKey)
      
      // Optimistically update cache
      queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
        ...old!,
        ...newData,
        started: true, // Mark as started when saving
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
    onSuccess: () => {
      console.log('[useChallengeContent] ✅ Saved successfully')
    },
  })

  // Initialize refs when data loads
  useEffect(() => {
    if (data) {
      localContentRef.current = data.content
      localLanguageRef.current = data.language
    }
  }, [data])
  
  // Setup real-time sync (if enabled)
  useEffect(() => {
    if (!enableRealtime || !sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown') {
      return
    }

    console.log('[useChallengeContent] Setting up real-time sync for:', normalizedChallengeId)

    const unsubscribe = repository.subscribe(
      sessionId,
      normalizedChallengeId,
      contentType,
      (content, language) => {
        // Prevent echo: only update if different from local
        const isContentDifferent = content !== localContentRef.current
        const isLanguageDifferent = language !== localLanguageRef.current
        
        if (!isContentDifferent && !isLanguageDifferent) {
          console.log('[useChallengeContent] 🔄 Ignoring echo from real-time sync')
          return
        }
        
        console.log('[useChallengeContent] 📥 Received real-time update:', { 
          contentLength: content.length,
          language,
          isContentDifferent,
          isLanguageDifferent
        })
        
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
      
      // Clear any pending saves
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, normalizedChallengeId, contentType, enableRealtime])

  // Helper functions
  const updateContent = useCallback((content: string) => {
    // Update local ref immediately
    localContentRef.current = content
    
    // Update cache immediately for instant UI response
    queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
      ...old!,
      content,
    }))
    
    // Publish to real-time sync immediately
    if (enableRealtime && sessionId && normalizedChallengeId && data) {
      repository.publish(
        sessionId,
        normalizedChallengeId,
        contentType,
        content,
        data.language
      )
    }
    
    // Debounce DB save
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = window.setTimeout(() => {
      saveMutation.mutate({ content })
    }, debounceMs)
  }, [sessionId, normalizedChallengeId, contentType, data, queryClient, queryKey, saveMutation])

  const updateLanguage = useCallback((language: string) => {
    // Update local ref immediately
    localLanguageRef.current = language
    
    // Update cache immediately
    queryClient.setQueryData<ChallengeContentData>(queryKey, (old) => ({
      ...old!,
      language,
    }))
    
    // Publish to real-time sync immediately
    if (enableRealtime && sessionId && normalizedChallengeId && data) {
      repository.publish(
        sessionId,
        normalizedChallengeId,
        contentType,
        data.content,
        language
      )
    }
    
    // Save to DB immediately (language changes are infrequent)
    saveMutation.mutate({ language })
  }, [sessionId, normalizedChallengeId, contentType, data, queryClient, queryKey, saveMutation, enableRealtime])

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
