const { logger } = require('@librechat/data-schemas');
const MarketplaceService = require('./MarketplaceService');

class DefaultContentService {
  constructor() {
    this.marketplaceService = new MarketplaceService();
  }

  /**
   * Get default business agents that every organization should have
   * @returns {Array} Array of default agent configurations
   */
  getDefaultAgents() {
    return [
      {
        name: 'Sales Assistant',
        description: 'Expert at lead qualification, proposal writing, and client relationship management',
        instructions: `You are a professional sales assistant specialized in B2B sales. Help with:
- Lead qualification and scoring
- Proposal and quote generation  
- Client relationship management
- Sales strategy and forecasting
- CRM data analysis and insights

Always maintain a professional, helpful tone and focus on driving business value.`,
        category: 'sales_marketing',
        provider: 'openai',
        model: 'gpt-4',
        conversation_starters: [
          'Help me qualify this new lead',
          'Draft a proposal for this client',
          'Analyze our sales pipeline',
          'Create a follow-up email sequence'
        ]
      },
      {
        name: 'Customer Support Agent',
        description: 'Specialized in customer service, troubleshooting, and support ticket resolution',
        instructions: `You are a customer support specialist. Your role is to:
- Provide helpful troubleshooting guidance
- Draft professional support responses
- Escalate complex issues appropriately
- Maintain positive customer relationships
- Document solutions for knowledge base

Always be empathetic, solution-focused, and professional in all interactions.`,
        category: 'customer_support',
        provider: 'openai',
        model: 'gpt-4',
        conversation_starters: [
          'Help me respond to a customer complaint',
          'Create a troubleshooting guide',
          'Draft a follow-up email',
          'Analyze customer feedback trends'
        ]
      },
      {
        name: 'Content Creator',
        description: 'Expert at creating marketing content, blogs, social media posts, and documentation',
        instructions: `You are a content creation specialist. Help with:
- Blog posts and articles
- Social media content
- Marketing copy and campaigns
- Documentation and guides
- SEO optimization
- Brand voice consistency

Focus on creating engaging, valuable content that aligns with business goals.`,
        category: 'content_creation',
        provider: 'openai',
        model: 'gpt-4',
        conversation_starters: [
          'Write a blog post about...',
          'Create social media content for...',
          'Draft a marketing email',
          'Help with content strategy'
        ]
      },
      {
        name: 'Data Analyst',
        description: 'Specialized in data analysis, reporting, and business intelligence insights',
        instructions: `You are a data analysis expert. Your expertise includes:
- Data interpretation and visualization
- Business intelligence insights
- Report generation and summaries
- Trend analysis and forecasting
- KPI tracking and optimization
- Statistical analysis

Provide clear, actionable insights from data and help drive data-driven decisions.`,
        category: 'data_analytics',
        provider: 'openai',
        model: 'gpt-4',
        conversation_starters: [
          'Analyze this data set',
          'Create a performance report',
          'Identify trends and patterns',
          'Suggest KPIs to track'
        ]
      },
      {
        name: 'Project Manager',
        description: 'Expert in project planning, coordination, and team management',
        instructions: `You are a project management specialist. Help with:
- Project planning and scheduling
- Resource allocation and management
- Risk assessment and mitigation
- Team coordination and communication
- Progress tracking and reporting
- Agile and traditional methodologies

Focus on delivering projects on time, within budget, and meeting quality standards.`,
        category: 'project_management',
        provider: 'openai',
        model: 'gpt-4',
        conversation_starters: [
          'Create a project plan for...',
          'Help manage project risks',
          'Draft a status report',
          'Optimize team workflow'
        ]
      }
    ];
  }

  /**
   * Get default business prompts that every organization should have
   * @returns {Array} Array of default prompt configurations
   */
  getDefaultPrompts() {
    return [
      {
        name: 'Meeting Summary',
        description: 'Generate professional meeting summaries with action items',
        prompt: `Please create a comprehensive meeting summary from the following notes or transcript:

[MEETING CONTENT]

Format the summary as follows:
## Meeting Summary
**Date:** [Date]
**Attendees:** [List attendees]
**Objective:** [Main purpose]

## Key Discussion Points
- [Point 1]
- [Point 2]
- [Point 3]

## Decisions Made
- [Decision 1]
- [Decision 2]

## Action Items
- [ ] [Action item] - Assigned to: [Person] - Due: [Date]
- [ ] [Action item] - Assigned to: [Person] - Due: [Date]

## Next Steps
[Brief summary of what happens next]`,
        category: 'project_management'
      },
      {
        name: 'Email Response Template',
        description: 'Professional email response template for customer inquiries',
        prompt: `Please help me draft a professional email response based on the following:

**Customer Inquiry:** [Paste customer email or describe the inquiry]
**Response Type:** [Support/Sales/Information/Follow-up]
**Key Points to Address:** [List main points]

Create a professional email that:
- Acknowledges their inquiry promptly
- Addresses all their concerns
- Provides clear next steps
- Maintains a helpful, professional tone
- Includes appropriate call-to-action

Format as a complete email with subject line.`,
        category: 'customer_support'
      },
      {
        name: 'Content Outline Generator',
        description: 'Create detailed outlines for blog posts, articles, and marketing content',
        prompt: `Help me create a comprehensive content outline for:

**Topic:** [Your content topic]
**Target Audience:** [Describe your audience]
**Content Type:** [Blog post/Article/Guide/etc.]
**Key Message:** [Main point you want to convey]
**SEO Keywords:** [List 3-5 target keywords]

Please provide:
1. Compelling headline options (3-5)
2. Detailed outline with sections and subsections
3. Key points to cover in each section
4. Suggested word count for each section
5. Call-to-action recommendations
6. SEO optimization tips`,
        category: 'content_creation'
      },
      {
        name: 'Performance Review Template',
        description: 'Structured template for employee performance reviews',
        prompt: `Help me prepare a comprehensive performance review for:

**Employee:** [Name]
**Position:** [Job title]
**Review Period:** [Time period]
**Key Responsibilities:** [List main duties]

Please create a structured review covering:

## Performance Summary
- Overall performance rating and justification
- Key accomplishments this period
- Areas of excellence

## Goal Achievement
- Progress on previous goals/objectives
- Quantifiable results where applicable

## Development Areas
- Skills to improve
- Growth opportunities
- Training recommendations

## Future Goals
- Objectives for next review period
- Career development plans

## Action Items
- Specific steps for improvement
- Support needed from management`,
        category: 'hr_recruitment'
      },
      {
        name: 'Sales Proposal Framework',
        description: 'Professional framework for creating compelling sales proposals',
        prompt: `Help me create a professional sales proposal for:

**Prospect:** [Company name]
**Industry:** [Industry type]
**Pain Points:** [Main challenges they face]
**Our Solution:** [How we solve their problems]
**Budget Range:** [Approximate budget]

Please structure the proposal with:

## Executive Summary
- Brief overview of their challenges and our solution
- Key benefits and value proposition

## Understanding Your Needs
- Restatement of their pain points
- Impact of current situation

## Proposed Solution
- Detailed solution description
- How it addresses their specific needs
- Implementation timeline

## Investment & ROI
- Pricing structure
- Expected return on investment
- Cost-benefit analysis

## Next Steps
- Implementation process
- Timeline and milestones
- Contact information`,
        category: 'sales_marketing'
      }
    ];
  }

  /**
   * Set up default content for a new organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID who's setting up the organization
   */
  async setupDefaultContent(organizationId, userId) {
    try {
      logger.info(`[DefaultContentService] Setting up default content for organization: ${organizationId}`);

      const defaultAgents = this.getDefaultAgents();
      const defaultPrompts = this.getDefaultPrompts();

      // Create agents in LibreChat and sync to Supabase
      for (const agentConfig of defaultAgents) {
        try {
          // In a real implementation, you would create the agent in LibreChat first
          // For now, we'll just sync the metadata to Supabase
          const agentData = {
            organization_id: organizationId,
            librechat_agent_id: `default_${agentConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${organizationId}`,
            name: agentConfig.name,
            description: agentConfig.description,
            category: agentConfig.category,
            is_public: false,
            usage_count: 0,
            created_by: userId
          };

          await this.marketplaceService.supabase
            .from('agent_library')
            .insert([agentData]);

          logger.info(`[DefaultContentService] Created default agent: ${agentConfig.name}`);
        } catch (error) {
          logger.error(`[DefaultContentService] Error creating agent ${agentConfig.name}:`, error);
        }
      }

      // Create prompts in Supabase
      for (const promptConfig of defaultPrompts) {
        try {
          const promptData = {
            organization_id: organizationId,
            librechat_prompt_id: `default_${promptConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${organizationId}`,
            name: promptConfig.name,
            description: promptConfig.description,
            category: promptConfig.category,
            prompt_text: promptConfig.prompt,
            is_public: false,
            usage_count: 0,
            created_by: userId
          };

          await this.marketplaceService.supabase
            .from('prompt_library')
            .insert([promptData]);

          logger.info(`[DefaultContentService] Created default prompt: ${promptConfig.name}`);
        } catch (error) {
          logger.error(`[DefaultContentService] Error creating prompt ${promptConfig.name}:`, error);
        }
      }

      logger.info(`[DefaultContentService] Default content setup completed for organization: ${organizationId}`);
      return { success: true, agents: defaultAgents.length, prompts: defaultPrompts.length };

    } catch (error) {
      logger.error('[DefaultContentService] Error setting up default content:', error);
      throw error;
    }
  }
}

module.exports = DefaultContentService;
