# Protocol Extractor - Implementation Plan

## Current State

### What's Working
1. **Authentication** - Magic link login via Supabase
2. **Protocol Upload & OCR** - Mistral OCR extracts text from PDFs (even scanned)
3. **Protocol Extraction** - AI extracts structured data (name, phase, criteria, visits)
4. **Study Creation** - Studies saved to Supabase (via service client to bypass RLS)
5. **Study Detail View** - Shows extracted protocol data via API

### What's NOT Working
1. **Add Team Members** - Client-side Supabase calls fail due to RLS recursion on `study_members` table
2. **Add Patients** - Client-side Supabase calls fail due to RLS on `patients` table
3. **Dashboard study list** - May also have RLS issues with `study_members(count)` query

### Root Cause
The Supabase RLS (Row Level Security) policies have circular references:
- `studies` table policy references `study_members`
- `study_members` table policy references `studies`
- This causes "infinite recursion detected in policy" errors

## Two Approaches

### Option A: Fix RLS Policies in Supabase (Recommended for Production)
- Go to Supabase SQL Editor
- Drop the recursive policies
- Create simpler policies based only on `owner_id`
- **Pros**: Client-side queries work, better security model
- **Cons**: Requires database access, may break other things

### Option B: Create API Routes for All Operations (Quick Fix)
- Create server-side API routes that use service client
- Update frontend to call APIs instead of direct Supabase
- **Pros**: Works immediately without database changes
- **Cons**: More API routes to maintain, service client bypasses RLS entirely

## Recommended Implementation Plan (Option B - Quick Fix)

### Step 1: Create API routes for study operations

Create `app/api/studies/[id]/members/route.ts`:
- POST: Add a team member (find user by email, insert into study_members)
- DELETE: Remove a team member

Create `app/api/studies/[id]/patients/route.ts`:
- POST: Add a patient
- GET: List patients (already in GET /api/studies/[id])

### Step 2: Update the study GET API to include members
- Fetch study_members with user details via service client
- Return in the response alongside study and patients

### Step 3: Update frontend to use APIs
- Change `handleAddMember` to POST to `/api/studies/${studyId}/members`
- Change `handleRemoveMember` to DELETE to `/api/studies/${studyId}/members/${memberId}`
- Change `handleAddPatient` to POST to `/api/studies/${studyId}/patients`

### Step 4: Fix dashboard studies query
- Either create an API route for dashboard
- Or simplify the query to not include study_members count

## Files to Create/Modify

1. **NEW**: `app/api/studies/[id]/members/route.ts` - Team member CRUD
2. **NEW**: `app/api/studies/[id]/patients/route.ts` - Patient CRUD
3. **MODIFY**: `app/api/studies/[id]/route.ts` - Include members in GET response
4. **MODIFY**: `app/studies/[id]/page.tsx` - Use APIs instead of direct Supabase
5. **MODIFY**: `app/dashboard/page.tsx` - Remove study_members count or use API

## Estimated Work
- API routes: ~30 mins
- Frontend updates: ~20 mins
- Testing: ~10 mins

## Questions for User
None - this is a straightforward fix to bypass RLS issues.
