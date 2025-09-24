-- =============================================
-- SETUP DEFAULT CONTENT FOR HENLY AI
-- =============================================
-- Quick setup script for your specific organization
-- This assumes you know your organization ID and user ID

-- First, let's find your organization and user IDs:
-- (Uncomment these to run them first)

-- SELECT id as organization_id, name FROM organizations WHERE domain LIKE '%henly%' OR name LIKE '%Henly%';
-- SELECT id as user_id, email FROM profiles WHERE email = 'williamtobiaskeating@gmail.com' OR role = 'super_admin';

-- =============================================
-- REPLACE THESE WITH YOUR ACTUAL IDs
-- =============================================
-- After running the queries above, replace these placeholders:

-- Your Organization ID (replace with actual UUID)
\set org_id 'REPLACE_WITH_YOUR_ORG_ID'

-- Your User ID (replace with actual UUID) 
\set user_id 'REPLACE_WITH_YOUR_USER_ID'

-- =============================================
-- INSERT DEFAULT AGENTS
-- =============================================

INSERT INTO public.agent_library (
  organization_id,
  librechat_agent_id,
  name,
  description,
  category,
  is_default,
  created_by,
  sync_status
) VALUES 
(:'org_id'::uuid, 'henly-sales-assistant', 'Sales Assistant', 'AI assistant specializing in lead qualification, proposal generation, and CRM management for Henly AI clients.', 'sales_marketing', true, :'user_id'::uuid, 'pending'),
(:'org_id'::uuid, 'henly-support-agent', 'Customer Support Agent', 'Dedicated support agent for troubleshooting, FAQ responses, and ticket management with Henly AI expertise.', 'customer_support', true, :'user_id'::uuid, 'pending'),
(:'org_id'::uuid, 'henly-content-creator', 'Content Creator', 'Creative assistant for marketing content, blog posts, and SEO-optimized articles about AI and business automation.', 'content_creation', true, :'user_id'::uuid, 'pending'),
(:'org_id'::uuid, 'henly-data-analyst', 'Data Analyst', 'Business intelligence specialist providing reports and data-driven insights for client success metrics.', 'data_analytics', true, :'user_id'::uuid, 'pending'),
(:'org_id'::uuid, 'henly-project-manager', 'Project Manager', 'AI project coordination specialist for managing client implementations and team workflows.', 'project_management', true, :'user_id'::uuid, 'pending');

-- =============================================
-- INSERT DEFAULT PROMPTS  
-- =============================================

INSERT INTO public.prompt_library (
  organization_id,
  librechat_group_id,
  name,
  description,
  prompt_text,
  category,
  is_default,
  created_by,
  sync_status
) VALUES 
(:'org_id'::uuid, 'henly-meeting-summary', 'Client Meeting Summary', 'Summarize client meetings with action items and next steps.', 'Summarize this client meeting for Henly AI:\n\nMeeting Notes: {{MEETING_NOTES}}\nClient: {{CLIENT_NAME}}\nDate: {{DATE}}\n\nProvide:\n## Meeting Summary\n## Key Decisions\n## Action Items\n## Next Steps\n## Follow-up Required', 'general', true, :'user_id'::uuid, 'pending'),

(:'org_id'::uuid, 'henly-client-email', 'Client Email Response', 'Professional email responses for client communications.', 'Draft a professional email response for Henly AI:\n\nClient: {{CLIENT_NAME}}\nSubject: {{SUBJECT}}\nClient Message: {{CLIENT_MESSAGE}}\n\nRequirements:\n- Professional Henly AI tone\n- Address all client concerns\n- Provide clear next steps\n- Include relevant Henly AI solutions', 'customer_support', true, :'user_id'::uuid, 'pending'),

(:'org_id'::uuid, 'henly-content-outline', 'AI Content Outline', 'Create outlines for AI and automation content.', 'Create a blog post outline about:\n\nTopic: {{TOPIC}}\nTarget Audience: {{AUDIENCE}}\nKey Messages: {{KEY_MESSAGES}}\n\nStructure:\n1. Compelling intro (hook about AI/automation)\n2. 3-5 main sections with practical insights\n3. Real-world examples or case studies\n4. Actionable takeaways\n5. CTA for Henly AI services\n\nFocus on business value and practical AI applications.', 'content_creation', true, :'user_id'::uuid, 'pending'),

(:'org_id'::uuid, 'henly-client-report', 'Client Success Report', 'Generate client performance and ROI reports.', 'Create a client success report for:\n\nClient: {{CLIENT_NAME}}\nImplementation Period: {{PERIOD}}\nKey Metrics: {{METRICS}}\nGoals: {{GOALS}}\n\nInclude:\n## Executive Summary\n## Implementation Highlights\n## Key Performance Indicators\n## ROI Analysis\n## Success Stories\n## Recommendations for Optimization\n## Next Quarter Goals\n\nEmphasize business impact and value delivered.', 'data_analytics', true, :'user_id'::uuid, 'pending'),

(:'org_id'::uuid, 'henly-proposal', 'AI Solution Proposal', 'Structure compelling proposals for AI implementations.', 'Create a proposal for {{CLIENT_NAME}}:\n\nClient Challenge: {{CHALLENGE}}\nProposed AI Solution: {{SOLUTION}}\nExpected Outcomes: {{OUTCOMES}}\nInvestment: {{BUDGET}}\n\nStructure:\n## Executive Summary\n## Current State Analysis\n## Proposed AI Solution\n## Implementation Roadmap\n## Expected ROI & Benefits\n## Why Henly AI\n## Investment & Timeline\n## Next Steps\n\nMake it compelling and client-focused.', 'sales_marketing', true, :'user_id'::uuid, 'pending');

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify agents were created
SELECT 'AGENTS CREATED:' as status, count(*) as count FROM agent_library WHERE organization_id = :'org_id'::uuid;

-- Verify prompts were created  
SELECT 'PROMPTS CREATED:' as status, count(*) as count FROM prompt_library WHERE organization_id = :'org_id'::uuid;

-- Show all created content
SELECT 'Agent' as type, name, category, created_at FROM agent_library WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'Prompt' as type, name, category, created_at FROM prompt_library WHERE organization_id = :'org_id'::uuid
ORDER BY type, category, name;
