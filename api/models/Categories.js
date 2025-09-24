const { logger } = require('~/config');

const options = [
  {
    label: 'General',
    value: 'general',
  },
  {
    label: 'Sales & Marketing',
    value: 'sales_marketing',
  },
  {
    label: 'Customer Support',
    value: 'customer_support',
  },
  {
    label: 'Data & Analytics',
    value: 'data_analytics',
  },
  {
    label: 'Content Creation',
    value: 'content_creation',
  },
  {
    label: 'Project Management',
    value: 'project_management',
  },
  {
    label: 'Finance & Accounting',
    value: 'finance_accounting',
  },
  {
    label: 'HR & Recruitment',
    value: 'hr_recruitment',
  },
  {
    label: 'Operations',
    value: 'operations',
  },
  {
    label: 'Other',
    value: 'other',
  },
];

module.exports = {
  /**
   * Retrieves the categories asynchronously.
   * @returns {Promise<TGetCategoriesResponse>} An array of category objects.
   * @throws {Error} If there is an error retrieving the categories.
   */
  getCategories: async () => {
    try {
      // const categories = await Categories.find();
      return options;
    } catch (error) {
      logger.error('Error getting categories', error);
      return [];
    }
  },
};
