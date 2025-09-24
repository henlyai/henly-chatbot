-- =============================================
-- SETUP DEFAULT AGENTS AND PROMPTS FOR ORGANIZATIONS
-- =============================================
-- This script creates default agents and prompts for all organizations
-- Run this after your organizations are set up

-- NOTE: Replace 'YOUR_ORGANIZATION_ID' with actual organization UUID
-- NOTE: Replace 'YOUR_USER_ID' with actual user UUID (typically the org creator)

-- You can find your organization ID with:
-- SELECT id, name FROM organizations WHERE name = 'Your Organization Name';

-- You can find your user ID with:
-- SELECT id, email FROM profiles WHERE email = 'your-email@domain.com';

-- =============================================
-- DEFAULT AGENTS
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
-- Sales Assistant
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-sales-assistant', -- Will be replaced when LibreChat agent is created
  'Sales Assistant',
  'Helps with lead qualification, proposal generation, and CRM updates. Specializes in converting prospects into customers.',
  'sales_marketing',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Customer Support Agent  
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-support-agent',
  'Customer Support Agent',
  'Assists with troubleshooting, answering FAQs, and managing support tickets. Provides empathetic and solution-focused responses.',
  'customer_support',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Content Creator
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-content-creator',
  'Content Creator',
  'Generates marketing content, blog posts, and SEO-optimized articles. Focuses on engaging and brand-consistent messaging.',
  'content_creation',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Data Analyst
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-data-analyst',
  'Data Analyst',
  'Provides business intelligence, generates reports, and analyzes data trends. Helps make data-driven decisions.',
  'data_analytics',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Project Manager
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-project-manager',
  'Project Manager',
  'Helps with project planning, task coordination, and workflow management. Keeps teams organized and on track.',
  'project_management',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- HR Assistant
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-hr-assistant',
  'HR Assistant',
  'Assists with recruitment, employee onboarding, and HR policy questions. Maintains professional and compliant approaches.',
  'hr_recruitment',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Finance Assistant
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-finance-assistant',
  'Finance Assistant',
  'Helps with budgeting, financial analysis, and expense tracking. Provides accurate and detailed financial insights.',
  'finance_accounting',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Operations Coordinator
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-operations-coordinator',
  'Operations Coordinator',
  'Streamlines business processes, manages workflows, and optimizes operational efficiency across departments.',
  'operations',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
);

-- =============================================
-- DEFAULT PROMPTS
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
-- Meeting Summary
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-meeting-summary',
  'Meeting Summary',
  'Summarize meeting notes into key action items and decisions.',
  'Please summarize the following meeting notes, extracting key decisions, action items, and responsible parties:

{{MEETING_NOTES}}

Format the output as:
## Key Decisions
- [List decisions made]

## Action Items  
- [Task] - Assigned to: [Name] - Due: [Date]

## Next Steps
- [List follow-up actions]',
  'general',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Email Response Template
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-email-response',
  'Professional Email Response',
  'Generate a professional email response to a customer inquiry.',
  'Draft a professional email response to the following customer inquiry:

Subject: {{SUBJECT}}
Original Message: {{INQUIRY_BODY}}

Requirements:
- Professional and friendly tone
- Address all points raised
- Provide clear next steps
- Include appropriate closing

Please write the response:',
  'customer_support',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Content Outline Generator  
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-content-outline',
  'Content Outline Generator',
  'Create an SEO-optimized outline for blog posts and articles.',
  'Generate a detailed outline for a blog post about "{{TOPIC}}".

Requirements:
- SEO-optimized structure
- Engaging introduction hook
- 3-5 main sections with sub-points
- Compelling conclusion with call-to-action
- Include suggested word count for each section
- Target keywords: {{KEYWORDS}}

Please provide the outline:',
  'content_creation',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Performance Review Template
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-performance-review',
  'Performance Review Template',
  'Generate a comprehensive performance review for employees.',
  'Create a performance review for {{EMPLOYEE_NAME}} based on the following information:

Achievements: {{ACHIEVEMENTS}}
Areas for Improvement: {{IMPROVEMENTS}}  
Goals for next quarter: {{GOALS}}
Role: {{ROLE}}

Please provide:
1. Overall Performance Summary
2. Key Strengths
3. Areas for Development  
4. Specific Goals for Next Period
5. Support/Resources Needed

Maintain a constructive and professional tone throughout.',
  'hr_recruitment',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Sales Proposal Framework
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-sales-proposal',
  'Sales Proposal Framework',
  'Structure a compelling sales proposal for clients.',
  'Develop a sales proposal for {{CLIENT_NAME}} addressing:

Client Problem: {{PROBLEM}}
Our Solution: {{SOLUTION}}
Key Benefits: {{BENEFITS}}
Investment: {{PRICING_DETAILS}}

Structure the proposal with:
1. Executive Summary
2. Problem Statement  
3. Proposed Solution
4. Benefits & ROI
5. Implementation Timeline
6. Investment Details
7. Next Steps

Make it compelling and client-focused.',
  'sales_marketing',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Data Analysis Report
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-data-analysis',
  'Data Analysis Report',
  'Generate insights and recommendations from data analysis.',
  'Analyze the following data and provide insights:

Data: {{DATA_DESCRIPTION}}
Key Metrics: {{METRICS}}
Time Period: {{TIME_PERIOD}}
Business Context: {{CONTEXT}}

Please provide:
1. Executive Summary
2. Key Findings
3. Trends Identified
4. Actionable Recommendations
5. Areas Requiring Further Investigation

Focus on business implications and actionable insights.',
  'data_analytics',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Project Status Update
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-project-status',
  'Project Status Update',
  'Create comprehensive project status reports.',
  'Generate a project status update for:

Project: {{PROJECT_NAME}}
Current Phase: {{CURRENT_PHASE}}
Completed Tasks: {{COMPLETED_TASKS}}
Upcoming Milestones: {{UPCOMING_MILESTONES}}
Blockers/Issues: {{BLOCKERS}}

Format as:
## Project Overview
## Progress Summary  
## Key Accomplishments
## Upcoming Milestones
## Risks & Mitigation
## Resource Requirements
## Next Steps

Keep it concise but comprehensive.',
  'project_management',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Budget Analysis
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-budget-analysis',
  'Budget Analysis',
  'Analyze budgets and financial performance.',
  'Analyze the budget performance for:

Department/Project: {{DEPARTMENT}}
Budget Period: {{PERIOD}}
Allocated Budget: {{ALLOCATED_BUDGET}}
Actual Spending: {{ACTUAL_SPENDING}}
Key Categories: {{CATEGORIES}}

Provide:
1. Budget vs Actual Analysis
2. Variance Explanations
3. Spending Trends
4. Cost Optimization Opportunities
5. Recommendations for Next Period

Include specific numbers and percentages.',
  'finance_accounting',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
),

-- Process Optimization
(
  'YOUR_ORGANIZATION_ID'::uuid,
  'default-process-optimization',
  'Process Optimization',
  'Identify and improve business process efficiency.',
  'Analyze the following business process for optimization:

Process: {{PROCESS_NAME}}
Current Steps: {{CURRENT_STEPS}}
Pain Points: {{PAIN_POINTS}}
Desired Outcomes: {{OUTCOMES}}

Please provide:
1. Current State Analysis
2. Inefficiencies Identified
3. Optimization Recommendations
4. Implementation Plan
5. Expected Benefits/ROI
6. Success Metrics

Focus on practical, implementable solutions.',
  'operations',
  true,
  'YOUR_USER_ID'::uuid,
  'pending'
);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these to verify the data was inserted correctly:

-- Check inserted agents
-- SELECT name, category, is_default, created_at 
-- FROM agent_library 
-- WHERE organization_id = 'YOUR_ORGANIZATION_ID'::uuid
-- ORDER BY category, name;

-- Check inserted prompts  
-- SELECT name, category, is_default, created_at
-- FROM prompt_library
-- WHERE organization_id = 'YOUR_ORGANIZATION_ID'::uuid  
-- ORDER BY category, name;

-- =============================================
-- USAGE INSTRUCTIONS
-- =============================================

/*
1. Replace 'YOUR_ORGANIZATION_ID' with your actual organization UUID
2. Replace 'YOUR_USER_ID' with your actual user UUID  
3. Run this script in your Supabase SQL editor
4. The agents/prompts will be created with sync_status = 'pending'
5. When LibreChat creates actual agents/prompts, update the librechat_agent_id and librechat_group_id fields
6. Change sync_status to 'synced' once connected to LibreChat

To find your IDs:
- Organization ID: SELECT id, name FROM organizations WHERE name = 'Your Org Name';
- User ID: SELECT id, email FROM profiles WHERE email = 'your-email@domain.com';
*/
