-- =============================================
-- SETUP DEFAULT CONTENT FOR HENLY AI PRODUCTION
-- =============================================
-- Complete setup script with actual production IDs
-- Organization: Henly AI (ad82fce8-ba9a-438f-9fe2-956a86f479a5)
-- Users: 3 users under the same organization

-- =============================================
-- CLEAR EXISTING DEFAULT CONTENT (IF ANY)
-- =============================================
DELETE FROM public.agent_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true;

DELETE FROM public.prompt_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true;

-- =============================================
-- INSERT DEFAULT AGENTS FOR HENLY AI
-- =============================================

INSERT INTO public.agent_library (
  organization_id,
  librechat_agent_id,
  name,
  description,
  category,
  is_default,
  created_by,
  sync_status,
  usage_count
) VALUES 
-- Sales Assistant
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-sales-assistant-v1',
  'Henly Sales Assistant',
  'AI-powered sales specialist for Henly AI. Expertly handles lead qualification, proposal generation, CRM management, and client relationship building. Understands SaaS business models and AI solution positioning.',
  'sales_marketing',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
),

-- Customer Support Agent
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-support-agent-v1', 
  'Henly Support Specialist',
  'Dedicated customer support agent with deep knowledge of Henly AI platform, troubleshooting capabilities, and excellent client communication skills. Handles technical issues, user onboarding, and feature guidance.',
  'customer_support',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
),

-- Content Creator
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-content-creator-v1',
  'Henly Content Creator',
  'Creative AI specialist for Henly AI marketing. Generates compelling blog posts, social media content, case studies, and SEO-optimized articles about AI, automation, and business transformation.',
  'content_creation',
  true,
  'd1625a28-7a1f-414b-8468-8899e8746288'::uuid,
  'pending',
  0
),

-- Data Analyst
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-data-analyst-v1',
  'Henly Data Intelligence',
  'Business intelligence specialist for Henly AI clients. Analyzes usage metrics, client success data, ROI calculations, and generates actionable insights for business growth and optimization.',
  'data_analytics',
  true,
  'd1625a28-7a1f-414b-8468-8899e8746288'::uuid,
  'pending',
  0
),

-- Project Manager
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-project-manager-v1',
  'Henly Project Coordinator',
  'AI implementation project specialist. Manages client onboarding, coordinates development timelines, tracks milestones, and ensures successful AI solution deployments for Henly clients.',
  'project_management',
  true,
  'e366b25c-c6c2-4746-9f26-1a3f4ffed2ac'::uuid,
  'pending',
  0
),

-- Operations Manager
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-operations-manager-v1',
  'Henly Operations Manager',
  'Operations optimization specialist for internal Henly AI processes and client implementations. Streamlines workflows, manages resources, and ensures operational efficiency across all business functions.',
  'operations',
  true,
  'e366b25c-c6c2-4746-9f26-1a3f4ffed2ac'::uuid,
  'pending',
  0
),

-- HR Assistant
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-hr-assistant-v1',
  'Henly HR Assistant',
  'Human resources specialist for Henly AI team management. Assists with recruitment, employee onboarding, policy questions, and maintains professional HR standards for growing AI company.',
  'hr_recruitment',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
),

-- Finance Assistant
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-finance-assistant-v1',
  'Henly Finance Analyst',
  'Financial analysis specialist for Henly AI business operations. Handles budgeting, client billing analysis, SaaS metrics tracking, and provides financial insights for strategic decision making.',
  'finance_accounting',
  true,
  'd1625a28-7a1f-414b-8468-8899e8746288'::uuid,
  'pending',
  0
);

-- =============================================
-- INSERT DEFAULT PROMPTS FOR HENLY AI
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
  sync_status,
  usage_count
) VALUES 
-- Client Meeting Summary
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-meeting-summary-v1',
  'Henly Client Meeting Summary',
  'Professional meeting summaries for Henly AI client interactions with action items and follow-ups.',
  'Summarize this client meeting for Henly AI:

**Meeting Details:**
- Client: {{CLIENT_NAME}}
- Date: {{DATE}}
- Attendees: {{ATTENDEES}}
- Meeting Type: {{MEETING_TYPE}}

**Meeting Notes:**
{{MEETING_NOTES}}

**Please provide a comprehensive summary in this format:**

## Meeting Overview
- Purpose and objectives
- Key participants and roles

## Key Discussion Points  
- Main topics covered
- Client concerns or requirements
- Technical discussions

## Decisions Made
- Specific decisions reached
- Approved actions or changes

## Action Items
- Task description - Assigned to: [Name] - Due: [Date]
- Task description - Assigned to: [Name] - Due: [Date]

## Next Steps
- Immediate follow-up actions
- Scheduled next meeting/milestone

## Follow-up Required
- Client communications needed
- Internal team updates
- Documentation to prepare

**Tone:** Professional, clear, and action-oriented for Henly AI team coordination.',
  'general',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
),

-- Client Email Response
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-client-email-v1',
  'Henly Client Email Response',
  'Professional email responses representing Henly AI brand with technical expertise.',
  'Draft a professional email response representing Henly AI:

**Email Context:**
- Client: {{CLIENT_NAME}}
- Subject: {{SUBJECT}}
- Original Message: {{CLIENT_MESSAGE}}
- Urgency Level: {{URGENCY}}
- Response Type: {{RESPONSE_TYPE}}

**Guidelines for Response:**
- Use professional Henly AI tone
- Address all client points thoroughly  
- Provide clear technical explanations
- Include specific next steps
- Offer additional value/insights
- Maintain solution-focused approach

**Email Structure:**
1. Professional greeting
2. Acknowledge their inquiry/concern
3. Provide detailed response addressing all points
4. Offer additional insights or value
5. Clear next steps and timeline
6. Professional closing with Henly AI signature

**Tone:** Professional, knowledgeable, helpful, and solution-oriented.
**Focus:** Demonstrate Henly AI expertise while being genuinely helpful.',
  'customer_support',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
),

-- AI Content Outline
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-content-outline-v1',
  'Henly AI Content Outline Generator',
  'Create engaging content outlines about AI, automation, and business transformation for Henly AI marketing.',
  'Create a comprehensive blog post outline for Henly AI:

**Content Brief:**
- Topic: {{TOPIC}}
- Target Audience: {{AUDIENCE}}
- Content Goals: {{GOALS}}
- Key Messages: {{KEY_MESSAGES}}
- Target Keywords: {{KEYWORDS}}
- Word Count Target: {{WORD_COUNT}}

**Create this structure:**

## Content Strategy
- Primary objective
- Target audience insights
- Value proposition

## Blog Post Outline

### Hook-Driven Introduction (150-200 words)
- Compelling opening question or statistic
- Problem identification that resonates
- Preview of value/solution to come

### Main Section 1: [Strategic Title] (300-400 words)
- Key point with supporting data
- Real-world example or case study
- Practical takeaway

### Main Section 2: [Strategic Title] (300-400 words)  
- Advanced insights or methodology
- Industry trends or predictions
- Actionable strategies

### Main Section 3: [Strategic Title] (300-400 words)
- Implementation guidance
- Common challenges and solutions
- Best practices

### Conclusion & CTA (150-200 words)
- Key takeaways summary
- Next steps for readers
- Henly AI value proposition
- Clear call-to-action

## SEO Strategy
- Primary keyword placement
- Supporting keywords integration
- Meta description suggestion

## Content Enhancement Ideas
- Visual elements needed
- Data points to include
- Expert quotes or testimonials

**Focus:** Business value, practical AI applications, and Henly AI thought leadership.',
  'content_creation',
  true,
  'd1625a28-7a1f-414b-8468-8899e8746288'::uuid,
  'pending',
  0
),

-- Client Success Report
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-success-report-v1',
  'Henly Client Success Report',
  'Generate comprehensive client performance and ROI reports showcasing Henly AI value delivery.',
  'Create a comprehensive client success report for Henly AI:

**Client Information:**
- Client Name: {{CLIENT_NAME}}
- Implementation Period: {{PERIOD}}
- Solution Type: {{SOLUTION_TYPE}}
- Initial Goals: {{INITIAL_GOALS}}

**Performance Data:**
- Key Metrics: {{METRICS}}
- Baseline Data: {{BASELINE}}
- Current Performance: {{CURRENT_PERFORMANCE}}
- ROI Data: {{ROI_DATA}}

**Generate this professional report:**

# Client Success Report: {{CLIENT_NAME}}
*Henly AI Implementation Results*

## Executive Summary
- Implementation overview and timeline
- Key achievements at a glance
- ROI highlight and business impact

## Implementation Highlights
- Solution components deployed
- Integration challenges overcome
- Team training and adoption

## Performance Results

### Key Performance Indicators
- Metric 1: [Baseline] to [Current] (% Change)
- Metric 2: [Baseline] to [Current] (% Change)
- Metric 3: [Baseline] to [Current] (% Change)

### Business Impact Analysis
- Efficiency improvements
- Cost savings realized
- Revenue impact
- Process optimization results

## Return on Investment

### Financial Benefits
- Direct cost savings: $XXX
- Revenue increase: $XXX
- Efficiency gains value: $XXX
- **Total ROI: XXX%**

### Timeline to Value
- Initial implementation: X weeks
- First results visible: X weeks
- Full ROI achieved: X months

## Success Stories
- Specific wins and breakthroughs
- User feedback and testimonials
- Unexpected benefits discovered

## Future Opportunities
- Additional optimization potential
- Expansion possibilities
- Advanced features roadmap

## Recommendations
- Next phase suggestions
- Additional value opportunities
- Long-term strategic alignment

**Presentation:** Professional, data-driven, celebrating achievements while identifying growth opportunities.',
  'data_analytics',
  true,
  'd1625a28-7a1f-414b-8468-8899e8746288'::uuid,
  'pending',
  0
),

-- AI Solution Proposal
(
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid,
  'henly-solution-proposal-v1',
  'Henly AI Solution Proposal',
  'Structure compelling proposals for AI implementations showcasing Henly AI capabilities and value.',
  'Create a comprehensive AI solution proposal for Henly AI:

**Proposal Context:**
- Prospect: {{CLIENT_NAME}}
- Industry: {{INDUSTRY}}
- Current Challenge: {{CHALLENGE}}
- Proposed Solution: {{SOLUTION}}
- Budget Range: {{BUDGET}}
- Timeline: {{TIMELINE}}
- Decision Makers: {{DECISION_MAKERS}}

**Create this winning proposal structure:**

# AI Transformation Proposal
**Prepared for {{CLIENT_NAME}} by Henly AI**

## Executive Summary
- Challenge overview and business impact
- Henly AI solution at a glance
- Expected outcomes and ROI
- Investment summary and timeline

## Current State Analysis

### Business Challenge
- Detailed problem statement
- Current process inefficiencies
- Cost of inaction/status quo
- Competitive implications

### Opportunity Assessment
- Market potential for improvement
- Technology readiness evaluation
- Organization capability analysis

## Henly AI Solution

### Our Approach
- Solution methodology and framework
- AI technologies and capabilities
- Integration strategy with existing systems

### Solution Components
1. **Component 1**: [Description and benefits]
2. **Component 2**: [Description and benefits]  
3. **Component 3**: [Description and benefits]

### Technical Architecture
- High-level system design
- Data flow and processing
- Security and compliance measures

## Expected Business Impact

### Quantified Benefits
- Efficiency improvements: XX%
- Cost reduction: $XXX annually
- Revenue opportunity: $XXX
- Time savings: XXX hours/month

### Strategic Advantages
- Competitive differentiation
- Scalability for future growth
- Enhanced decision-making capability

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- Setup and configuration
- Data integration
- Initial training

### Phase 2: Deployment (Weeks 5-8)
- Core functionality rollout
- User training and adoption
- Performance monitoring

### Phase 3: Optimization (Weeks 9-12)
- Performance tuning
- Advanced features activation
- Success measurement

## Why Choose Henly AI

### Our Expertise
- AI implementation experience
- Industry-specific knowledge
- Proven track record

### Our Approach
- Client-centric methodology
- Agile implementation process
- Ongoing support and optimization

### Success Stories
- Relevant case studies
- Client testimonials
- Quantified results achieved

## Investment & Value

### Investment Summary
- Implementation costs
- Licensing and subscription
- Training and support
- **Total Investment: $XXX**

### Value Proposition
- ROI timeline and projections
- Payback period analysis
- Long-term value creation

## Next Steps
1. Proposal review and questions
2. Technical discovery session
3. Contract finalization
4. Project kickoff planning

### Timeline for Decision
- Proposal valid until: [Date]
- Preferred start date: [Date]
- Implementation completion: [Date]

---
**Ready to transform your business with AI? Contact Henly AI to discuss how we can deliver these results for {{CLIENT_NAME}}.**

**Contact:** [Henly AI team details]',
  'sales_marketing',
  true,
  '1ea23a74-7721-4b3d-9bcf-de56be96c6ca'::uuid,
  'pending',
  0
);

-- =============================================
-- VERIFICATION AND SUMMARY
-- =============================================

-- Verify agents were created
SELECT 
  'AGENTS CREATED' as content_type, 
  COUNT(*) as total_count
FROM agent_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true;

-- Verify prompts were created  
SELECT 
  'PROMPTS CREATED' as content_type, 
  COUNT(*) as total_count
FROM prompt_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true;

-- Show all created content summary
SELECT 
  'AGENT' as type,
  name,
  category,
  created_at
FROM agent_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true

UNION ALL

SELECT 
  'PROMPT' as type,
  name,
  category,
  created_at
FROM prompt_library 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'::uuid 
AND is_default = true

ORDER BY type, category, name;
