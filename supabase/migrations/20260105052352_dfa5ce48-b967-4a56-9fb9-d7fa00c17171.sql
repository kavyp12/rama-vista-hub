-- Create enum types for the CRM
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_manager', 'sales_agent');
CREATE TYPE public.lead_stage AS ENUM ('new', 'contacted', 'site_visit', 'negotiation', 'token', 'closed');
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE public.property_status AS ENUM ('available', 'booked', 'sold');
CREATE TYPE public.property_type AS ENUM ('apartment', 'villa', 'plot', 'commercial', 'penthouse', 'townhouse');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'sales_agent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create projects table (for property developments)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT,
  description TEXT,
  developer TEXT,
  total_units INTEGER DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  min_price DECIMAL(15,2),
  max_price DECIMAL(15,2),
  amenities TEXT[],
  images TEXT[],
  brochure_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  property_type property_type NOT NULL DEFAULT 'apartment',
  location TEXT NOT NULL,
  city TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft DECIMAL(10,2),
  price DECIMAL(15,2) NOT NULL,
  status property_status DEFAULT 'available' NOT NULL,
  description TEXT,
  features TEXT[],
  images TEXT[],
  floor_plan_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  source TEXT DEFAULT 'website',
  campaign TEXT,
  stage lead_stage DEFAULT 'new' NOT NULL,
  temperature lead_temperature DEFAULT 'warm',
  budget_min DECIMAL(15,2),
  budget_max DECIMAL(15,2),
  preferred_location TEXT,
  preferred_property_type property_type,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  interested_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  interested_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  next_followup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create site_visits table
CREATE TABLE public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  conducted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'scheduled',
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  deal_value DECIMAL(15,2) NOT NULL,
  token_amount DECIMAL(15,2),
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  stage TEXT DEFAULT 'negotiation',
  expected_close_date DATE,
  closed_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'sales_manager')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for projects (all authenticated users can view)
CREATE POLICY "All users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage projects" ON public.projects FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies for properties
CREATE POLICY "All users can view properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage properties" ON public.properties FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies for leads
CREATE POLICY "Admins and managers can view all leads" ON public.leads FOR SELECT TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "Admins and managers can manage all leads" ON public.leads FOR ALL TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Agents can update assigned leads" ON public.leads FOR UPDATE TO authenticated 
  USING (assigned_to = auth.uid());

-- RLS Policies for site_visits
CREATE POLICY "Users can view their site visits" ON public.site_visits FOR SELECT TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()) OR conducted_by = auth.uid());
CREATE POLICY "Admins and managers can manage site visits" ON public.site_visits FOR ALL TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Agents can manage their site visits" ON public.site_visits FOR ALL TO authenticated 
  USING (conducted_by = auth.uid());

-- RLS Policies for deals
CREATE POLICY "Users can view their deals" ON public.deals FOR SELECT TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "Admins and managers can manage deals" ON public.deals FOR ALL TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Agents can update assigned deals" ON public.deals FOR UPDATE TO authenticated 
  USING (assigned_to = auth.uid());

-- RLS Policies for activity_logs
CREATE POLICY "Users can view all activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create update triggers for all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_visits_updated_at BEFORE UPDATE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();