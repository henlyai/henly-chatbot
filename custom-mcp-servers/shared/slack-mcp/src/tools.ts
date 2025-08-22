import { z } from 'zod';

// Tool schemas for Slack MCP
export const ListChannelsSchema = z.object({
  includePrivate: z.boolean().optional().default(true),
  includeArchived: z.boolean().optional().default(false)
});

export const ListUsersSchema = z.object({
  includeBots: z.boolean().optional().default(false),
  includeDeactivated: z.boolean().optional().default(false)
});

export const SendMessageSchema = z.object({
  channel: z.string(),
  message: z.string(),
  threadTs: z.string().optional()
});

export const SearchMessagesSchema = z.object({
  query: z.string(),
  channel: z.string().optional(),
  limit: z.number().optional().default(20)
});

export const GetChannelHistorySchema = z.object({
  channel: z.string(),
  limit: z.number().optional().default(50),
  oldest: z.string().optional(),
  latest: z.string().optional()
});

export const CreateChannelSchema = z.object({
  name: z.string(),
  isPrivate: z.boolean().optional().default(false)
});

export const InviteUsersToChannelSchema = z.object({
  channel: z.string(),
  users: z.string()
});

export const GetWorkspaceInfoSchema = z.object({});

// Tool definitions
export const tools = {
  listChannels: {
    name: 'list_channels',
    description: 'List all channels in the Slack workspace',
    inputSchema: ListChannelsSchema
  },
  listUsers: {
    name: 'list_users',
    description: 'List all users in the Slack workspace',
    inputSchema: ListUsersSchema
  },
  sendMessage: {
    name: 'send_message',
    description: 'Send a message to a Slack channel or user',
    inputSchema: SendMessageSchema
  },
  searchMessages: {
    name: 'search_messages',
    description: 'Search for messages in Slack channels',
    inputSchema: SearchMessagesSchema
  },
  getChannelHistory: {
    name: 'get_channel_history',
    description: 'Get recent messages from a specific Slack channel',
    inputSchema: GetChannelHistorySchema
  },
  createChannel: {
    name: 'create_channel',
    description: 'Create a new Slack channel',
    inputSchema: CreateChannelSchema
  },
  inviteUsersToChannel: {
    name: 'invite_users_to_channel',
    description: 'Invite users to a Slack channel',
    inputSchema: InviteUsersToChannelSchema
  },
  getWorkspaceInfo: {
    name: 'get_workspace_info',
    description: 'Get information about the Slack workspace',
    inputSchema: GetWorkspaceInfoSchema
  }
};

// Tool descriptions for LibreChat
export const toolDescriptions = {
  listChannels: {
    name: 'slack_list_channels',
    description: 'List all channels in the Slack workspace. Use this to explore available channels before sending messages or searching.',
    parameters: {
      type: 'object',
      properties: {
        includePrivate: {
          type: 'boolean',
          description: 'Include private channels (default: true)'
        },
        includeArchived: {
          type: 'boolean',
          description: 'Include archived channels (default: false)'
        }
      }
    }
  },
  listUsers: {
    name: 'slack_list_users',
    description: 'List all users in the Slack workspace. Use this to find user IDs for direct messages or mentions.',
    parameters: {
      type: 'object',
      properties: {
        includeBots: {
          type: 'boolean',
          description: 'Include bot users (default: false)'
        },
        includeDeactivated: {
          type: 'boolean',
          description: 'Include deactivated users (default: false)'
        }
      }
    }
  },
  sendMessage: {
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel or user. Use channel IDs from list_channels or user IDs from list_users.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID or user ID to send message to'
        },
        message: {
          type: 'string',
          description: 'Message text to send'
        },
        threadTs: {
          type: 'string',
          description: 'Thread timestamp to reply to a specific message'
        }
      },
      required: ['channel', 'message']
    }
  },
  searchMessages: {
    name: 'slack_search_messages',
    description: 'Search for messages in Slack channels. Use this to find specific conversations or information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find messages'
        },
        channel: {
          type: 'string',
          description: 'Specific channel ID to search in (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)'
        }
      },
      required: ['query']
    }
  },
  getChannelHistory: {
    name: 'slack_get_channel_history',
    description: 'Get recent messages from a specific Slack channel. Use this to see recent conversations.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID to get history from'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of messages (default: 50)'
        },
        oldest: {
          type: 'string',
          description: 'Start time (Unix timestamp)'
        },
        latest: {
          type: 'string',
          description: 'End time (Unix timestamp)'
        }
      },
      required: ['channel']
    }
  },
  createChannel: {
    name: 'slack_create_channel',
    description: 'Create a new Slack channel. Use this to set up new discussion spaces.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the channel to create (without #)'
        },
        isPrivate: {
          type: 'boolean',
          description: 'Make the channel private (default: false)'
        }
      },
      required: ['name']
    }
  },
  inviteUsersToChannel: {
    name: 'slack_invite_users_to_channel',
    description: 'Invite users to a Slack channel. Use this to add team members to discussions.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID to invite users to'
        },
        users: {
          type: 'string',
          description: 'Comma-separated list of user IDs to invite'
        }
      },
      required: ['channel', 'users']
    }
  },
  getWorkspaceInfo: {
    name: 'slack_get_workspace_info',
    description: 'Get information about the Slack workspace. Use this to understand the workspace structure.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
}; 