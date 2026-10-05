-- Add tag support for clients and project association for invoices/expenses
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS tag TEXT;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS project TEXT;

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS project TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_user_tag ON public.clients(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_invoices_user_project ON public.invoices(user_id, project);
CREATE INDEX IF NOT EXISTS idx_expenses_user_project ON public.expenses(user_id, project);
