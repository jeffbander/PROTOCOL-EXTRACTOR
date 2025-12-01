# V0 Design Prompt for MSFHH Research App

Copy and paste this prompt into V0 (v0.dev) to generate updated designs for the MSFHH Research App.

---

## PROMPT FOR V0:

Design a modern, professional clinical research management web application called "MSFHH Research App" (Mount Sinai Fuster Heart Hospital Research App) using **Mount Sinai Health System brand colors**.

### Brand Colors (MUST USE):
- **Vivid Cerulean (Primary)**: #06ABEB - Use for primary buttons, links, active states
- **Barbie Pink (Accent)**: #DC298D - Use sparingly for highlights, notifications, important alerts
- **St. Patrick's Blue (Dark)**: #212070 - Use for headers, navbar, dark text
- **Cetacean Blue (Darkest)**: #00002D - Use for footer, very dark backgrounds
- **White**: #FFFFFF - Backgrounds, cards
- **Light Gray**: #F8FAFC - Page backgrounds, secondary surfaces

### Application Purpose:
A clinical trial protocol management platform for hospital research teams. It allows Principal Investigators (PIs) and Study Coordinators to:
- Extract protocol data from PDF documents using AI/OCR
- Manage clinical studies (phases, enrollment, criteria)
- Track study status through workflow stages
- Manage team members and patient enrollment
- Upload and extract budget/CTA (Clinical Trial Agreement) documents

### Pages to Design:

#### 1. LOGIN PAGE
- Clean, centered card design
- App title: "MSFHH Research App"
- Subtitle: "Clinical Trial Protocol Management"
- Email input field for magic link authentication
- "Send Sign-In Link" button (primary cerulean color)
- Note: "New users must be invited by an administrator"
- Subtle Mount Sinai branding feel

#### 2. DASHBOARD
- Top navbar with:
  - App logo/name on left
  - User email and role badge (PI/Coordinator/Admin) on right
  - Sign out button
- Main content showing study cards in a grid:
  - Each card shows: Study name, Phase badge, Status badge, Enrollment count, Created date
  - Click to view study details
- "Upload New Protocol" button (only visible to PIs)
- Clean, spacious layout with subtle shadows

#### 3. STUDY DETAIL PAGE
- Back navigation to dashboard
- Study header with:
  - Study name (large)
  - Phase badge, Status dropdown (for PIs to update)
  - Edit button (PI only)
- Tabbed interface with 4 tabs:

  **Overview Tab:**
  - Study Information card: Target Enrollment, GCO Number, Protocol Number, PI Fund Number, Sponsor, NCT Number
  - Inclusion Criteria list (green checkmarks)
  - Exclusion Criteria list (red X marks)
  - Visit Schedule as timeline or list

  **Team Tab:**
  - Team members list with role badges
  - Add team member form (email + role dropdown)
  - Remove member button (PI only)

  **Patients Tab:**
  - Patient count and list
  - Add patient form (name, enrollment date)
  - Simple table view

  **Budget & CTA Tab:**
  - Two sections: Budget Data and CTA Data
  - Budget shows: Per-patient payment, Visit payments table, Procedure payments, Milestone payments
  - CTA shows: Agreement info, Payment method, Invoice requirements, Key contacts
  - "Upload Budget/CTA Document" button

#### 4. PROTOCOL UPLOAD PAGE
- Drag-and-drop PDF upload zone
- Progress indicator during extraction
- Preview of extracted data in editable form:
  - Study name, Phase, Indication, Target Enrollment
  - Admin fields: GCO Number, Protocol Number, Fund Number, Sponsor, NCT Number
  - Inclusion/Exclusion criteria (editable lists)
  - Visit schedule
- "Create Study" button

#### 5. INVITATION ACCEPTANCE PAGE
- Welcoming design
- "Welcome to MSFHH Research App"
- Shows the role they're being invited as (PI/Coordinator)
- Name input field
- Email shown (disabled, from invitation)
- "Accept Invitation" button

### Design Requirements:
- Use Tailwind CSS classes
- Use shadcn/ui components where appropriate
- Mobile responsive
- Accessible (proper contrast, focus states)
- Clean, professional healthcare/medical aesthetic
- White/light backgrounds with cerulean and dark blue accents
- Status badges should be color-coded:
  - Pending stages: Yellow/Orange
  - Active/Enrolling: Green
  - Completed/Closed: Gray
  - Awaiting approval: Blue
- Role badges:
  - Admin: Purple
  - PI: Blue
  - Coordinator: Green

### UI Components Needed:
- Navbar component
- Card components for studies
- Badge components for status/roles
- Tab navigation
- Form inputs with labels
- Buttons (primary, secondary, destructive)
- Tables for data display
- Modal dialogs for confirmations
- Toast notifications for success/error messages
- Loading spinners/skeletons

### Typography:
- Use Inter or system font stack
- Headers: Bold, dark blue (#212070)
- Body: Regular, dark gray
- Links: Cerulean (#06ABEB)

Generate React components with TypeScript for each page using Next.js App Router conventions.

---

## ADDITIONAL NOTES:

You can reference the Mount Sinai brand at:
- [Mount Sinai Logo Colors](https://www.schemecolor.com/mount-sinai-hospital-manhattan-logo-colors.php)
- [Mount Sinai Branding Case Study](https://www.siegelgale.com/case-study/mount-sinai/)

The app is for internal hospital research use, so it should feel professional and trustworthy while being modern and easy to use.
