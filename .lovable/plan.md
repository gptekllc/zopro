
# Fix Photo Upload Visibility and Dialog Z-Index Issues

## Summary

You've identified two separate issues:
1. **Photos not appearing immediately after upload** - requires fix to cache handling
2. **Confirmation dialogs appearing behind the Job Detail dialog** - requires z-index adjustments

---

## Problem Analysis

### Issue 1: Photos Not Appearing Immediately

**Root Cause:** The optimistic update logic in the `useUploadJobPhoto` hook has a check that fails when the query cache is empty:

```typescript
// Current problematic code in useJobs.ts
queryClient.setQueryData(['job', jobId], (old: any) => {
  if (!old) return old;  // If cache is empty, optimistic update is skipped entirely
  // ... add photo to cache
});
```

When the dialog opens, if the cache hasn't been populated yet (still loading), the optimistic update is skipped and the photo doesn't appear until the realtime subscription triggers a refresh.

**Why the cache seeding in JobDetailDialog isn't sufficient:**
The dialog seeds the cache with `initialJob` data, but this only happens once on open. If the `reactiveJob` query is still pending when upload starts, the optimistic update fails.

### Issue 2: Confirmation Dialogs Behind Job Detail Dialog

**Root Cause:** Z-index mismatch between components:

| Component | Current Z-Index | Location |
|-----------|-----------------|----------|
| Dialog Overlay | z-65 | `dialog.tsx:22` |
| Dialog Content | z-70 | `dialog.tsx:43` |
| AlertDialog Overlay | z-50 | `alert-dialog.tsx:19` |
| AlertDialog Content | z-50 | `alert-dialog.tsx:37` |
| JobPhotoGallery AlertDialog | z-200 (content only) | `JobPhotoGallery.tsx:750` |

The AlertDialog overlay at z-50 is **below** the Dialog content at z-70, making it appear behind. While `JobPhotoGallery.tsx` tried to fix this by setting content to z-200, the **overlay** remains at z-50, causing the dim effect and click blocking to happen behind the dialog.

---

## Solution Plan

### Fix 1: Photo Upload Immediate Visibility

Update the optimistic update in `useUploadJobPhoto` to create a default cache structure when none exists:

**File:** `src/hooks/useJobs.ts`

**Changes:**
- Modify `onMutate` to initialize a default job structure if cache is empty, ensuring the optimistic photo is added
- This allows uploads to show immediately even if the reactive query hasn't resolved yet

### Fix 2: AlertDialog Z-Index Alignment

Update the AlertDialog component to use consistent z-index values that appear above standard dialogs:

**File:** `src/components/ui/alert-dialog.tsx`

**Changes:**
- Increase `AlertDialogOverlay` from z-50 to z-[200]
- Increase `AlertDialogContent` from z-50 to z-[200]

This aligns with the existing pattern noted in the project memory: "Critical confirmation dialogs use z-index 200 to stay centered and visible over all layers."

### Fix 3: Remove Redundant Z-Index Override

Clean up the now-unnecessary inline z-index override in JobPhotoGallery:

**File:** `src/components/jobs/JobPhotoGallery.tsx`

**Changes:**
- Remove the `z-[200]` class from line 750 since AlertDialog will now handle this globally

---

## Technical Implementation Details

### useJobs.ts - onMutate update
```typescript
onMutate: async ({ jobId, file, photoType }) => {
  await queryClient.cancelQueries({ queryKey: ['job', jobId] });
  
  const tempUrl = URL.createObjectURL(file);
  const tempId = `temp-${Date.now()}`;
  
  const previousJob = queryClient.getQueryData(['job', jobId]);
  
  // Create default structure if cache is empty
  queryClient.setQueryData(['job', jobId], (old: any) => {
    const baseJob = old || { id: jobId, photos: [] };
    return {
      ...baseJob,
      photos: [...(baseJob.photos || []), {
        id: tempId,
        photo_url: tempUrl,
        photo_type: photoType,
        caption: null,
        created_at: new Date().toISOString(),
        _isOptimistic: true,
      }]
    };
  });
  
  return { previousJob, tempId, tempUrl, jobId };
}
```

### alert-dialog.tsx - Z-Index update
```typescript
// AlertDialogOverlay
className={cn(
  "fixed inset-0 z-[200] bg-black/80 ...",
  className,
)}

// AlertDialogContent  
className={cn(
  "fixed left-[50%] top-[50%] z-[200] ...",
  className,
)}
```

---

## Files to Modify

1. `src/hooks/useJobs.ts` - Fix optimistic update for empty cache
2. `src/components/ui/alert-dialog.tsx` - Increase z-index for overlay and content
3. `src/components/jobs/JobPhotoGallery.tsx` - Remove redundant z-index class

---

## Expected Results

After these changes:
- Uploaded photos will appear instantly in the gallery (using blob: URLs)
- Delete and category change confirmation dialogs will appear above the Job Detail dialog
- Users will be able to interact with confirmation dialogs without them being blocked
