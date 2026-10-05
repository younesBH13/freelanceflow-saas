-- Add multi-currency support and recurring invoice fields
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate_to_base NUMERIC(12,6) DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS base_subtotal NUMERIC(12,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS base_tax NUMERIC(12,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS base_total NUMERIC(12,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS recurrence_interval TEXT CHECK (recurrence_interval IN ('monthly','quarterly')),
ADD COLUMN IF NOT EXISTS next_invoice_date DATE,
ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES public.invoices(id);

-- Seed base amounts for existing invoices
UPDATE public.invoices
SET
  base_subtotal = subtotal,
  base_tax = tax,
  base_total = total,
  base_currency = COALESCE(base_currency, currency),
  exchange_rate_to_base = COALESCE(exchange_rate_to_base, 1)
WHERE base_total = 0;

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate_to_base NUMERIC(12,6) DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12,2) DEFAULT 0 NOT NULL;

-- Seed base amounts for existing expenses
UPDATE public.expenses
SET
  base_amount = amount,
  base_currency = COALESCE(base_currency, currency),
  exchange_rate_to_base = COALESCE(exchange_rate_to_base, 1)
WHERE base_amount = 0;
