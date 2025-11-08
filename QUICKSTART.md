# Quick Start Guide

## What's Been Built

Your Protocol Extractor MVP is complete! Here's what you have:

### ✅ Completed Features

1. **Authentication System**
   - Magic link login (no passwords!)
   - Role selection at signup (Admin, PI, Coordinator)
   - Protected routes with middleware

2. **Protocol Upload & AI Extraction**
   - PDF upload (max 50MB)
   - Claude AI extracts:
     - Study name, phase, indication
     - Inclusion/exclusion criteria (lists)
     - Visit schedule
     - Target enrollment number
   - Review and edit extracted data before saving

3. **Study Management**
   - Dashboard with "My Studies" list
   - Role-based access control:
     - PIs see studies they created
     - Coordinators see assigned studies
     - Admins see all studies
   - Study cards show key metrics

4. **Study Detail Page (3 Tabs)**
   - **Overview**: All extracted protocol data
   - **Team**: Manage study team members
   - **Patients**: Track enrolled patients

5. **Team Assignment**
   - Add coordinators/PIs by email
   - Remove team members
   - View team member roles

6. **Patient Enrollment**
   - Add patients with name and enrollment date
   - Track X / target enrollment
   - Simple patient list table

## Next Steps

### 1. Set Up Supabase (5 minutes)

1. Go to https://supabase.com and create a free account
2. Click "New Project"
3. Fill in:
   - Project name: `protocol-extractor`
   - Database password: (save this!)
   - Region: Choose closest to you
4. Wait 2-3 minutes for project to initialize

### 2. Configure Database (3 minutes)

1. In your Supabase dashboard, go to SQL Editor
2. Click "New Query"
3. Open `SETUP.md` in this project
4. Copy the entire SQL schema section
5. Paste into Supabase SQL Editor
6. Click "Run"
7. Verify all tables created (check "Database" tab)

### 3. Get API Credentials (1 minute)

1. In Supabase dashboard: Settings > API
2. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 4. Get Anthropic API Key (2 minutes)

1. Go to https://console.anthropic.com
2. Sign in or create account
3. Go to API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)

### 5. Configure Environment Variables (1 minute)

Create a file called `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
ANTHROPIC_API_KEY=your_actual_anthropic_key
```

**Replace** the placeholders with your actual values!

### 6. Run the App (30 seconds)

```bash
npm run dev
```

Open http://localhost:3000

### 7. Test the Full Flow (5 minutes)

1. **Sign Up**
   - Go to http://localhost:3000
   - Enter your email
   - Select "PI" role
   - Check email for magic link
   - Click magic link to login

2. **Upload Protocol**
   - Click "Upload New Protocol"
   - Select a clinical trial protocol PDF
   - Click "Extract Protocol Data"
   - Wait 10-30 seconds for extraction
   - Review extracted data
   - Edit if needed
   - Click "Confirm & Create Study"

3. **View Study**
   - You'll be redirected to study detail page
   - Check Overview tab - see all extracted data
   - Go to Team tab - you're already added as PI
   - Add a team member by email (they need to sign up first)
   - Go to Patients tab - add a test patient

4. **Test Coordinator Access**
   - Sign out
   - Sign up with different email as "Coordinator"
   - Dashboard should be empty
   - Ask PI to add you to a study
   - Refresh - you'll see the study

## Deployment to Vercel

When ready to deploy:

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repository
5. Add the 3 environment variables
6. Click "Deploy"
7. Done! Your app is live

## Project Structure

```
app/
├── api/
│   ├── extract-protocol/  ← Claude AI integration
│   └── studies/           ← Create studies
├── auth/
│   ├── login/            ← Magic link page
│   └── callback/         ← Auth redirect handler
├── dashboard/            ← My Studies list
├── studies/
│   ├── upload/          ← Protocol upload
│   └── [id]/            ← Study detail (tabs)
├── layout.tsx           ← Root layout
└── page.tsx             ← Home (redirects)

components/
└── Navbar.tsx           ← Navigation bar

lib/
├── supabase/
│   ├── client.ts        ← Browser client
│   └── server.ts        ← Server client
└── hooks/
    └── useUser.ts       ← Auth hook

middleware.ts            ← Auth middleware
```

## Key Files

- `SETUP.md` - Full setup instructions with SQL schema
- `README.md` - Project overview and documentation
- `.env.local.example` - Environment variable template
- `.env` - Build-time placeholders (don't edit)

## Troubleshooting

**"Check your email" but no email arrives**
- Check spam folder
- Wait 1-2 minutes
- Try different email
- Check Supabase Auth settings

**"Failed to extract protocol data"**
- PDF might be too large (>50MB)
- PDF might be password protected
- Check Anthropic API key is valid
- Check browser console for errors

**"User not found with that email" when adding team member**
- Team member must sign up first
- Use exact email address
- Check for typos

**Build errors about Supabase**
- Make sure `.env` file exists with placeholder values
- This is normal - Vercel will use real values on deploy

## What's NOT in the MVP

As per the PRD, these features are intentionally excluded from MVP:

- Password authentication
- Study editing after creation
- User profile editing
- Visit tracking
- Budget calculator
- Patient eligibility screening
- Document storage beyond protocol
- Email notifications
- Search/filter
- Study deletion
- Team member invitations (they must sign up first)

## Next Features to Add

Based on user feedback, consider:

1. **Study editing** - Allow PIs to edit study details
2. **Email notifications** - Notify coordinators when assigned
3. **Visit tracking** - Track patient visits against schedule
4. **Export functionality** - Export study data to CSV
5. **Search/filter** - Find studies quickly

## Support

If you run into issues:

1. Check the troubleshooting section above
2. Review `SETUP.md` for detailed instructions
3. Check browser console for JavaScript errors
4. Verify all environment variables are set correctly
5. Try clearing `.next` folder and rebuilding

## Success Metrics (from PRD)

Track these to validate the MVP:

- Time from protocol upload to study ready (target: <10 minutes)
- Extraction accuracy (target: 80%+)
- Number of real studies created (target: 5 in 2 weeks)
- User retention (do they create a second study?)

## Feedback

Collect feedback from first users:

- Is extraction accurate enough?
- What data is it missing?
- What features do they need most?
- How much time did it save vs. manual entry?

---

Built in ~5 hours following your PRD. Ready to validate with real users!
