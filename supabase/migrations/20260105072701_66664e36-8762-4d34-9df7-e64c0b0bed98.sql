-- Create call_status enum
CREATE TYPE public.call_status AS ENUM ('connected_positive', 'connected_callback', 'not_connected', 'not_interested');

-- Create call_logs table
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  call_status call_status NOT NULL,
  call_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  call_duration INTEGER, -- in seconds
  notes TEXT,
  recording_url TEXT,
  callback_scheduled_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create follow_up_tasks table for callbacks and reminders
CREATE TABLE public.follow_up_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'callback', -- callback, retry_call, follow_up
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, missed
  notes TEXT,
  related_call_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketing_campaigns table
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email', -- email, sms, whatsapp
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, active, completed, paused
  target_audience TEXT,
  message_template TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other', -- quotation, booking_form, agreement, brochure, other
  file_url TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_signature, signed, expired
  created_by UUID,
  signed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'booking', -- booking, installment, token, final
  payment_method TEXT, -- bank_transfer, cheque, cash, online
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_logs
CREATE POLICY "Agents can view their call logs" ON public.call_logs
  FOR SELECT USING (agent_id = auth.uid() OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Agents can create call logs" ON public.call_logs
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Admins can manage all call logs" ON public.call_logs
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- RLS Policies for follow_up_tasks
CREATE POLICY "Agents can view their tasks" ON public.follow_up_tasks
  FOR SELECT USING (agent_id = auth.uid() OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Agents can create tasks" ON public.follow_up_tasks
  FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Agents can update their tasks" ON public.follow_up_tasks
  FOR UPDATE USING (agent_id = auth.uid() OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can manage all tasks" ON public.follow_up_tasks
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- RLS Policies for marketing_campaigns
CREATE POLICY "All users can view campaigns" ON public.marketing_campaigns
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage campaigns" ON public.marketing_campaigns
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- RLS Policies for documents
CREATE POLICY "Users can view documents" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage documents" ON public.documents
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- RLS Policies for payments
CREATE POLICY "Users can view payments" ON public.payments
  FOR SELECT USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_call_logs_updated_at BEFORE UPDATE ON public.call_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_up_tasks_updated_at BEFORE UPDATE ON public.follow_up_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();