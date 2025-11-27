# Protocol Extractor - Setup Instructions

## Prerequisites
- Node.js 18+ installed
- Supabase account (sign up at https://supabase.com)
- Anthropic API key (get one at https://console.anthropic.com)

## 1. Supabase Project Setup

### Create a new Supabase project:
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details and wait for it to initialize

### Get your credentials:
1. Go to Project Settings > API
2. Copy your `Project URL` and `anon public` key

## 2. Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Fill in your values:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 3. Database Schema

Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor > New Query):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'pi', 'coordinator')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Studies table
CREATE TABLE public.studies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phase TEXT,
  indication TEXT,
  target_enrollment INTEGER,
  protocol_data JSONB,
  owner_id UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study team members
CREATE TABLE public.study_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_id UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('pi', 'coordinator')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(study_id, user_id)
);

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_id UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enrolled_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitations (for admin-only user registration)
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'pi', 'coordinator')) NOT NULL,
  invited_by UUID REFERENCES public.users(id),
  study_id UUID REFERENCES public.studies(id),
  status TEXT CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_studies_owner_id ON public.studies(owner_id);
CREATE INDEX idx_study_members_study_id ON public.study_members(study_id);
CREATE INDEX idx_study_members_user_id ON public.study_members(user_id);
CREATE INDEX idx_patients_study_id ON public.patients(study_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'coordinator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Studies policies
CREATE POLICY "Users can view studies they own or are members of"
  ON public.studies FOR SELECT
  USING (
    auth.uid() = owner_id
    OR auth.uid() IN (
      SELECT user_id FROM public.study_members
      WHERE study_id = studies.id
    )
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "PIs and Admins can create studies"
  ON public.studies FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('pi', 'admin')
  );

CREATE POLICY "Study owners and admins can update studies"
  ON public.studies FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Study members policies
CREATE POLICY "Users can view members of studies they have access to"
  ON public.study_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.studies
      WHERE id = study_members.study_id
      AND (
        owner_id = auth.uid()
        OR auth.uid() IN (
          SELECT user_id FROM public.study_members sm
          WHERE sm.study_id = studies.id
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      )
    )
  );

CREATE POLICY "Study owners and admins can add members"
  ON public.study_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studies
      WHERE id = study_id
      AND (
        owner_id = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      )
    )
  );

CREATE POLICY "Study owners and admins can remove members"
  ON public.study_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.studies
      WHERE id = study_id
      AND (
        owner_id = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      )
    )
  );

-- Patients policies
CREATE POLICY "Users can view patients in studies they have access to"
  ON public.patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.studies
      WHERE id = patients.study_id
      AND (
        owner_id = auth.uid()
        OR auth.uid() IN (
          SELECT user_id FROM public.study_members
          WHERE study_id = studies.id
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      )
    )
  );

CREATE POLICY "Team members can add patients to their studies"
  ON public.patients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studies
      WHERE id = study_id
      AND (
        owner_id = auth.uid()
        OR auth.uid() IN (
          SELECT user_id FROM public.study_members
          WHERE study_id = studies.id
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      )
    )
  );
```

## 4. Configure Email Templates (Optional)

Go to Authentication > Email Templates in Supabase to customize:
- Magic Link email
- Confirm signup email

## 5. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## 6. Deploy to Vercel

1. Push your code to GitHub
2. Go to https://vercel.com and import your repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy!

## Troubleshooting

- **Database errors**: Make sure all SQL commands ran successfully
- **Auth errors**: Check your Supabase URL and anon key are correct
- **API errors**: Verify your Anthropic API key is valid
