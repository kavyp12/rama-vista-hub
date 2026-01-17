-- Create property_recommendations table for lead-property matching
CREATE TABLE public.property_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  recommended_by UUID REFERENCES auth.users(id),
  recommended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, property_id)
);

-- Enable RLS
ALTER TABLE public.property_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_recommendations
CREATE POLICY "Users can view property recommendations"
ON public.property_recommendations
FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage property recommendations"
ON public.property_recommendations
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Agents can insert property recommendations"
ON public.property_recommendations
FOR INSERT
WITH CHECK (recommended_by = auth.uid() OR is_admin_or_manager(auth.uid()));

-- Add template_data column to documents table for template storage
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT NULL;

-- Add amenities column to projects table if not exists (it already exists based on the schema)
-- Just ensure it has proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'amenities'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN amenities TEXT[] DEFAULT NULL;
  END IF;
END $$;

-- Create trigger for updated_at on property_recommendations
CREATE TRIGGER update_property_recommendations_updated_at
  BEFORE UPDATE ON public.property_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();