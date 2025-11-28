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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Administrative fields
  gco_number TEXT,                    -- GCO/Protocol number
  protocol_number TEXT,               -- Official protocol number
  fund_number TEXT,                   -- PI Fund number
  sponsor_name TEXT,                  -- Sponsor organization
  nct_number TEXT,                    -- ClinicalTrials.gov identifier

  -- Study status tracking
  status TEXT CHECK (status IN (
    'pending_irb_submission',
    'pending_budget_submission',
    'awaiting_irb_approval',
    'approved',
    'enrolling',
    'follow_up_phase',
    'closed'
  )) DEFAULT 'pending_irb_submission',

  -- Extended study design fields
  study_design JSONB,                 -- {type, randomization, blinding, allocation_ratio}
  investigational_product JSONB,      -- {name, dose, route, frequency, formulation}
  treatment_duration TEXT,
  comparator_type TEXT,

  -- Extended protocol fields (extracted by AI)
  study_arms JSONB,                   -- Array of treatment arms
  primary_endpoints JSONB,            -- Array of primary endpoints
  secondary_endpoints JSONB,          -- Array of secondary endpoints
  concomitant_medications JSONB,      -- {allowed: [], prohibited: [], washout: []}

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

---

## Migration: Add Extended Study Fields (v2)

If you already have an existing database, run this migration to add the new fields:

```sql
-- Add new columns to studies table
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS gco_number TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS protocol_number TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS fund_number TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS sponsor_name TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS nct_number TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS study_design JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS investigational_product JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS treatment_duration TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS comparator_type TEXT;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS study_arms JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS primary_endpoints JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS secondary_endpoints JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS concomitant_medications JSONB;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add status column with constraint
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_irb_submission';

-- Add check constraint for status (run separately if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'studies_status_check'
  ) THEN
    ALTER TABLE public.studies ADD CONSTRAINT studies_status_check
    CHECK (status IN (
      'pending_irb_submission',
      'pending_budget_submission',
      'awaiting_irb_approval',
      'approved',
      'enrolling',
      'follow_up_phase',
      'closed'
    ));
  END IF;
END $$;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_studies_status ON public.studies(status);

-- Update existing studies to have default status
UPDATE public.studies SET status = 'pending_irb_submission' WHERE status IS NULL;
```

---

## Migration: Add Budget and CTA Data Fields (v3)

If you already have an existing database, run this migration to add budget and CTA document extraction support:

```sql
-- Add budget_data column for storing extracted budget information
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS budget_data JSONB;

-- Add cta_data column for storing extracted CTA (Clinical Trial Agreement) information
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS cta_data JSONB;

-- Add comments explaining the JSONB structure
COMMENT ON COLUMN public.studies.budget_data IS 'Extracted budget data including procedure payments, visit payments, milestone payments, and payment terms';
COMMENT ON COLUMN public.studies.cta_data IS 'Extracted CTA data including payment info, invoice requirements, and key contacts';
```

### Budget Data Structure (JSONB)
```json
{
  "total_budget": 50000,
  "currency": "USD",
  "budget_type": "per-patient",
  "per_patient_total": 2500,
  "screen_failure_payment": 500,
  "early_termination_payment": 1000,
  "procedure_payments": [
    {
      "procedure_name": "Blood Draw",
      "payment_amount": 50,
      "currency": "USD",
      "per_patient": true,
      "visit_associated": "Screening Visit"
    }
  ],
  "visit_payments": [
    {
      "visit_name": "Screening Visit",
      "visit_number": 1,
      "total_payment": 500,
      "currency": "USD",
      "procedures_included": ["Physical Exam", "Blood Draw", "ECG"]
    }
  ],
  "milestone_payments": [
    {
      "milestone_name": "First Patient Enrolled",
      "payment_amount": 5000,
      "currency": "USD",
      "trigger_condition": "Upon enrollment of first patient"
    }
  ],
  "startup_costs": 2500,
  "annual_maintenance": 1000,
  "closeout_costs": 500,
  "payment_terms": {
    "payment_frequency": "Monthly",
    "invoice_process": "Submit via sponsor portal",
    "payment_timeline": "Net 30",
    "holdback_percentage": 10,
    "holdback_conditions": "Released upon study completion"
  },
  "pass_through_costs": ["Central Lab Fees", "Imaging Costs"],
  "important_notes": ["All invoices must include PO number"]
}
```

### CTA Data Structure (JSONB)
```json
{
  "document_title": "Clinical Trial Agreement",
  "agreement_number": "CTA-2024-001",
  "sponsor_name": "Pharma Inc",
  "site_name": "University Medical Center",
  "payment_info": {
    "payment_method": "Wire Transfer",
    "payment_currency": "USD",
    "billing_address": "accounts@sponsor.com",
    "payment_contact": "John Doe",
    "tax_requirements": "W-9 required"
  },
  "references_budget_amendment": "Budget Amendment 2.0",
  "timeline": {
    "agreement_effective_date": "2024-01-01",
    "study_start_date": "2024-02-01",
    "estimated_end_date": "2025-12-31",
    "invoice_submission_deadline": "Within 30 days of service"
  },
  "invoice_requirements": ["Study Number", "PO Number", "Patient Count", "Visit Details"],
  "invoice_submission_method": "Email",
  "invoice_submission_address": "invoices@sponsor.com",
  "payment_hold_conditions": ["Missing documentation", "Audit findings"],
  "audit_requirements": "Annual financial audit",
  "sponsor_contact_name": "Jane Smith",
  "sponsor_contact_email": "jsmith@sponsor.com",
  "financial_contact_name": "Bob Johnson",
  "financial_contact_email": "bjohnson@sponsor.com",
  "important_notes": ["Quarterly reconciliation required"]
}
```
