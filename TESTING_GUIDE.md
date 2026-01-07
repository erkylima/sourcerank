# Testing CRDT Synchronization Fix

## Setup
The application is running in Docker with:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Relay (CRDT): port 1234

## Test Scenario 1: Single Challenge Flow

### Manual Testing
1. Open http://localhost:5173 in browser
2. Login as interviewee
3. Access challenge 1
4. Verify content loads (either starter code or existing)
5. Make edits in editor
6. Check that content syncs in real-time (CRDT)
7. Refresh browser
8. Verify content persists

## Test Scenario 2: Challenge Switching (Critical Test)

### Expected Behavior
1. Load Challenge 1
   - **First time**: Should apply starter code (if started=false in DB)
   - **Content**: Starter code from StarterCodeManager for selected language
   - **Sync**: Real-time updates should work

2. Switch to Challenge 2
   - **Starter**: Should apply new starter for Challenge 2
   - **Sync**: Real-time updates should work correctly for Challenge 2
   - **Cache**: Old Challenge 1 content should NOT bleed into Challenge 2

3. Switch back to Challenge 1
   - **Content**: Should restore Challenge 1 content (from cache or DB)
   - **Sync**: Real-time updates should work

### How to Test
```bash
# Create test session with script provided
bash test-flow.sh

# Then manually in browser:
# 1. Login to session
# 2. Switch between challenges using UI
# 3. Monitor console logs for:
#    - "[useChallengeContent] Challenge changed, invalidating old language queries"
#    - "[useChallengeContent] Phase 2: Applying starter"
#    - "[useChallengeContent] Phase 3: Setting up real-time sync"
```

## Console Log Indicators

### Healthy Flow
```
✓ Challenge changed, invalidating old language queries
✓ Phase 2: Checking if starter needed
✓ Phase 2: Applying starter for language: python
✓ Phase 3: Setting up real-time sync
✓ Real-time update from CRDT
```

### Problem Indicators
```
✗ "Cleaning up real-time sync" appearing repeatedly
✗ No "Challenge changed, invalidating" log
✗ Phase 2/3 not executing after challenge change
```

## Key Files to Monitor

### Frontend Hook
File: `web/src/hooks/useChallengeContent.ts`

Key lines to understand:
- **Lines 102-116**: Invalidation effect (fires when challenge changes)
- **Lines 151-180**: Phase 2 - Starter application logic
- **Lines 182-253**: Phase 3 - CRDT real-time sync

### API Endpoints
- `POST /sessions` - Create session
- `PATCH /sessions/{id}/challenge` - Switch challenge
- `GET /sessions/{id}/content` - Get current content
- `POST /sessions/{id}/content` - Update content

## Expected vs Actual Comparison

### Before Fix
- First challenge: Sync works ✓, Starter doesn't apply ✗
- Switch challenge: Starter applies ✓, Sync breaks ✗
- Root cause: Stale cache from previous challenge

### After Fix
- First challenge: Sync works ✓, Starter respects DB flag ✓
- Switch challenge: Starter applies ✓, Sync works ✓
- Root cause resolved: Cache invalidated on challenge change

## Validation Checklist

- [ ] No TypeScript errors in build
- [ ] No console errors on page load
- [ ] Challenge 1 loads content correctly
- [ ] Challenge 1 real-time sync works
- [ ] Switch to Challenge 2 works
- [ ] Challenge 2 starter applies (if needed)
- [ ] Challenge 2 real-time sync works
- [ ] Switch back to Challenge 1 works
- [ ] Language switching works
- [ ] Browser reload preserves content
- [ ] Multiple users see real-time updates

## Debugging Tips

### Check Cache State
```javascript
// In browser console
import { useQueryClient } from '@tanstack/react-query'
const qc = useQueryClient()
qc.getQueryData(['challenge-content', sessionId, challengeId, 'code', 'python'])
```

### Monitor Network
1. Open DevTools → Network tab
2. Watch for:
   - Query calls to `/sessions/{id}/content`
   - WebSocket updates to relay
   - Polling requests (every 5s)

### Check Relay Connection
```bash
# Check if relay is running and accessible
curl -s http://localhost:1234/health
```

## Performance Notes
- Query cache is invalidated (not deleted) on challenge change
- This allows React Query to handle refetching automatically
- No manual data cleanup needed
- Polling (5s interval) persists changes to DB
- CRDT syncs happen in real-time (milliseconds)

## Expected Timeline for Challenge Switch
1. User clicks "Next Challenge" button: 0ms
2. Zustand updates state: ~1ms
3. Effect fires, invalidates cache: ~5ms
4. Query detects stale data, starts refetch: ~10ms
5. API returns new challenge data: ~50-200ms
6. Phase 2 runs, applies starter if needed: ~10ms
7. Phase 3 runs, subscribes to CRDT: ~15ms
8. **Total**: ~100-250ms (imperceptible to user)

## Next Steps After Fix Validation
1. ✅ Verify all test scenarios pass
2. ✅ Check no performance regressions
3. ✅ Confirm polling persists changes
4. ✅ Test with multiple users/sessions
5. ✅ Deploy to production
