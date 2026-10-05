# Setup Guide

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Supabase**:
   - Go to [supabase.com](https://supabase.com) and create a new project
   - In the SQL Editor (or with the Supabase CLI), run **all** migrations in order:
     1. `supabase/migrations/001_initial_schema.sql`
     2. `supabase/migrations/002_recurring_multicurrency.sql`
     3. `supabase/migrations/003_project_tags.sql`
   - Copy your project URL and anon key from Settings > API

3. **Create `.env.local` file**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   
   # Optional: For Stripe payments
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

## Supabase Migration

All schema changes live in `supabase/migrations`. Apply each file in numerical order so your database includes recurring invoices, stored exchange rates, project fields, and client tagging support.

If you prefer the Supabase CLI, link your project first (`supabase link --project-ref <ref>`), then run from the repo root:

```bash
supabase db execute --file supabase/migrations/001_initial_schema.sql
supabase db execute --file supabase/migrations/002_recurring_multicurrency.sql
supabase db execute --file supabase/migrations/003_project_tags.sql
```

## Stripe Setup (Optional)

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Dashboard
3. Set up a webhook endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. Copy the webhook secret to your `.env.local`

## Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

The app will automatically work with Supabase and Stripe in production.

## Features Checklist

✅ Authentication (Sign up, Login, Password Reset)
✅ Clients Management (CRUD)
✅ Invoices (Create, Edit, View, PDF Download)
✅ Expenses (Add, List, Filter by Category)
✅ Dashboard (Earnings, Expenses, Profit, Charts)
✅ Settings (Profile, Invoice Defaults, Subscription)

## Troubleshooting

### "Invalid API key" error
- Make sure your `.env.local` file has the correct Supabase keys
- Restart your dev server after changing env variables

### Database errors
- Ensure you've run the migration SQL in Supabase
- Check that RLS policies are enabled

### PDF generation not working
- Make sure `jspdf` and `html2canvas` are installed
- Check browser console for errors

### Stripe webhook not working
- Verify webhook URL is correct in Stripe dashboard
- Check that `STRIPE_WEBHOOK_SECRET` is set correctly
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

