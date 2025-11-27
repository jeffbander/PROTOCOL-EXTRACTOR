# Protocol Extractor

> AI-powered clinical trial protocol extraction and team management for research coordinators and PIs

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Mistral AI](https://img.shields.io/badge/Mistral-OCR-orange)](https://mistral.ai/)

## What It Does

Protocol Extractor automates the tedious process of extracting study data from clinical trial protocol PDFs. What used to take 4-8 hours of manual work now takes less than 10 minutes with AI assistance.

**Core Features:**
- **AI Protocol Extraction** - Upload a PDF and Mistral OCR + AI extracts all key study data (works with scanned documents!)
- **Team Management** - Assign coordinators and PIs to studies
- **Patient Tracking** - Track enrolled patients against target enrollment
- **Role-Based Access** - Secure authentication with magic links
- **Mobile Responsive** - Works on all devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [Supabase account](https://supabase.com) (free tier works)
- [Anthropic API key](https://console.anthropic.com)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/jeffbander/PROTOCOL-EXTRACTOR.git
cd PROTOCOL-EXTRACTOR
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

4. **Set up database**

Run the SQL schema from `SETUP.md` in your Supabase SQL Editor

5. **Start the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 Full Setup Guide

See [SETUP.md](./SETUP.md) for complete setup instructions including:
- Detailed Supabase configuration
- Database schema and RLS policies
- Email template setup
- Deployment to Vercel

See [QUICKSTART.md](./QUICKSTART.md) for step-by-step walkthrough

## 🎬 How It Works

### For PIs:

1. **Upload Protocol** → Select your protocol PDF (max 50MB)
2. **AI Extracts Data** → Claude AI automatically extracts:
   - Study name, phase, indication
   - Inclusion/exclusion criteria
   - Visit schedule
   - Target enrollment
3. **Review & Confirm** → Edit extracted data if needed
4. **Manage Team** → Add coordinators by email
5. **Track Patients** → Monitor enrollment progress

### For Coordinators:

1. **View Assigned Studies** → See studies you're assigned to
2. **Access Study Details** → View protocol data and team
3. **Add Patients** → Track patient enrollment

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Magic Links)
- **AI**: Anthropic Claude API (3.5 Sonnet)
- **Deployment**: Vercel

## 📁 Project Structure

```
protocol-extractor/
├── app/
│   ├── api/
│   │   ├── extract-protocol/     # Claude AI extraction endpoint
│   │   └── studies/               # Study creation API
│   ├── auth/
│   │   ├── login/                # Magic link authentication
│   │   └── callback/             # Auth callback handler
│   ├── dashboard/                # Main dashboard
│   └── studies/
│       ├── upload/               # Protocol upload page
│       └── [id]/                 # Study detail page
├── components/
│   └── Navbar.tsx                # Navigation component
├── lib/
│   ├── supabase/                 # Supabase clients
│   └── hooks/                    # React hooks
├── tests/                        # Playwright E2E tests
├── SETUP.md                      # Detailed setup guide
├── QUICKSTART.md                 # Quick start guide
└── README.md                     # This file
```

## 🗄️ Database Schema

### Tables

- **users** - User profiles with roles (admin, pi, coordinator)
- **studies** - Study data with extracted protocol info
- **study_members** - Team assignments
- **patients** - Patient enrollment tracking

### Row Level Security

- Users only see studies they own or are assigned to
- Only PIs/Admins can create studies and manage teams
- All team members can add patients to their studies

## 🧪 Testing

### Run E2E Tests

```bash
# Run tests in headed mode (watch the browser)
npm run test:e2e

# Run tests in debug mode
npm run test:e2e:debug
```

Tests cover:
- User authentication flow
- Protocol upload
- AI extraction
- Study creation
- Team management

## 🚢 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import repository in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jeffbander/PROTOCOL-EXTRACTOR)

## 📊 Success Metrics

This MVP was built to validate:
- **Time saved**: <10 minutes vs 4-8 hours manual extraction
- **Accuracy**: 80%+ extraction accuracy
- **Adoption**: 5+ real studies created in first 2 weeks

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test:e2e     # Run E2E tests
```

### Environment Variables

Create `.env.local` for local development:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

## 🔒 Security

- Magic link authentication (no passwords)
- Row Level Security on all database tables
- API routes protected with Supabase auth
- Environment variables for sensitive data

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 📧 Support

- Issues: [GitHub Issues](https://github.com/jeffbander/PROTOCOL-EXTRACTOR/issues)
- Docs: [SETUP.md](./SETUP.md) and [QUICKSTART.md](./QUICKSTART.md)

## 🎯 Roadmap

### Completed ✅
- AI protocol extraction with Claude
- User authentication and roles
- Study management dashboard
- Team assignment
- Patient enrollment tracking

### Coming Soon 🚧
- Study editing after creation
- Visit tracking against schedule
- Email notifications
- Export functionality
- Search and filter studies
- Budget calculator

## 👨‍💻 Built With

This project was built to solve a real problem in clinical research: the tedious manual extraction of protocol data. By leveraging Claude AI, we've reduced what used to take hours into minutes.

---

**Star ⭐ this repo if you find it useful!**
