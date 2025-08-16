import { z } from 'zod';

// Tool schemas
export const ListFilesSchema = z.object({
  folderId: z.string().optional().default('root'),
  query: z.string().optional().default(''),
  maxResults: z.number().optional().default(50)
});

export const SearchFilesSchema = z.object({
  query: z.string(),
  fileType: z.string().optional(),
  maxResults: z.number().optional().default(50)
});

export const GetFileContentSchema = z.object({
  fileId: z.string()
});

export const GetFileMetadataSchema = z.object({
  fileId: z.string()
});

export const CreateFolderSchema = z.object({
  name: z.string(),
  parentId: z.string().optional().default('root')
});

export const UploadFileSchema = z.object({
  name: z.string(),
  content: z.string(),
  mimeType: z.string().optional().default('text/plain'),
  parentId: z.string().optional().default('root')
});

// Tool definitions
export const tools = {
  list: {
    name: 'list',
    description: 'List files and folders in Google Drive',
    inputSchema: ListFilesSchema
  },
  search: {
    name: 'search',
    description: 'Search for files in Google Drive',
    inputSchema: SearchFilesSchema
  },
  getFileContent: {
    name: 'getFileContent',
    description: 'Get the content of a file from Google Drive',
    inputSchema: GetFileContentSchema
  },
  getFileMetadata: {
    name: 'getFileMetadata',
    description: 'Get metadata for a file in Google Drive',
    inputSchema: GetFileMetadataSchema
  },
  createFolder: {
    name: 'createFolder',
    description: 'Create a new folder in Google Drive',
    inputSchema: CreateFolderSchema
  },
  uploadFile: {
    name: 'uploadFile',
    description: 'Upload a file to Google Drive',
    inputSchema: UploadFileSchema
  }
};

// Tool descriptions for LibreChat
export const toolDescriptions = {
  list: {
    name: 'google_drive_list_files',
    description: 'List files and folders in a Google Drive folder',
    parameters: {
      type: 'object',
      properties: {
        folderId: {
          type: 'string',
          description: 'The ID of the folder to list (default: root)'
        },
        query: {
          type: 'string',
          description: 'Optional search query to filter files'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)'
        }
      }
    }
  },
  search: {
    name: 'google_drive_search_files',
    description: 'Search for files in Google Drive using full-text search',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find files'
        },
        fileType: {
          type: 'string',
          description: 'Optional file type filter (e.g., "pdf", "document")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)'
        }
      },
      required: ['query']
    }
  },
  getFileContent: {
    name: 'google_drive_get_file_content',
    description: 'Get the content of a file from Google Drive. Supports Google Docs, Sheets, Slides, and text files.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file to get content from'
        }
      },
      required: ['fileId']
    }
  },
  getFileMetadata: {
    name: 'google_drive_get_file_metadata',
    description: 'Get detailed metadata for a file in Google Drive',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file to get metadata for'
        }
      },
      required: ['fileId']
    }
  },
  createFolder: {
    name: 'google_drive_create_folder',
    description: 'Create a new folder in Google Drive',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the folder to create'
        },
        parentId: {
          type: 'string',
          description: 'ID of the parent folder (default: root)'
        }
      },
      required: ['name']
    }
  },
  uploadFile: {
    name: 'google_drive_upload_file',
    description: 'Upload a file to Google Drive',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the file to upload'
        },
        content: {
          type: 'string',
          description: 'Content of the file'
        },
        mimeType: {
          type: 'string',
          description: 'MIME type of the file (default: text/plain)'
        },
        parentId: {
          type: 'string',
          description: 'ID of the parent folder (default: root)'
        }
      },
      required: ['name', 'content']
    }
  }
}; 