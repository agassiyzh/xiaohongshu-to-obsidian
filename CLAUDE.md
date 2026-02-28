# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Install dependencies**: `yarn install`
- **Development build (with watch)**: `yarn dev`
- **Production build**: `yarn build`
- **Run CLI help**: `yarn start --help`
- **Test basic functionality**: `yarn test`
- **Interactive demo**: `yarn demo`
- **Version bump**: `yarn version`

## Architecture Overview

This is a standalone Xiaohongshu (小红书) importer application that extracts notes and automatically categorizes them using AI. The project has been completely refactored from an Obsidian plugin to an independent CLI tool.

### Core Components

- **XHSStandaloneImporter** (`src/index.ts:8`): Main orchestrator class that coordinates all components
- **XHSImporter** (`src/xhs-importer.ts:4`): Handles Xiaohongshu URL extraction and content scraping
- **AIClassifier** (`src/ai-classifier.ts:52`): Provides AI-powered categorization using OpenAI or Anthropic
- **FileManager** (`src/file-manager.ts:5`): Manages file operations and markdown generation
- **S3Uploader** (`src/s3-uploader.ts:1`): Handles S3-compatible storage uploads
- **MediaReplacer** (`src/media-replacer.ts:1`): Replaces markdown media URLs with S3 URLs
- **ConfigManager** (`src/config.ts:22`): Handles configuration persistence and management
- **CLI Interface** (`src/cli.ts:7`): Command-line interface using Commander.js

### AI Classification System

The application supports two AI providers:
1. **OpenAI**: GPT models (gpt-3.5-turbo, gpt-4, etc.)
2. **Anthropic**: Claude models (claude-3-haiku, claude-3-sonnet, etc.)

As a fallback, it includes a keyword-based classification system that works without API calls.

### Data Flow

1. User provides share text, URL, or batch file via CLI
2. XHSImporter extracts content and unique ID from Xiaohongshu page
3. ImportHistory checks if note was previously imported (skip if duplicate)
4. AIClassifier determines the best category (or uses keyword fallback)
5. FileManager creates appropriate folder structure and markdown file
6. Media files are optionally downloaded to `media/` folder
7. Import record is saved to `.import-history.json` for future duplicate detection

### Key Features

- **URL Extraction**: Parses Xiaohongshu share text to extract valid URLs
- **Content Scraping**: Fetches and parses `window.__INITIAL_STATE__` from HTML
- **AI Categorization**: Automatically categorizes content based on title, content, and tags
- **Media Handling**: Optional download of images and videos to local storage with smart media filtering (videos only for video notes, images only for image notes)
- **S3 Upload**: Upload media to S3-compatible storage (MinIO, Cloudflare R2, AWS S3, etc.)
- **Media Replacement**: Replace existing markdown media URLs with S3 URLs
- **Media Cleanup**: Clean up orphaned media files not referenced by any markdown
- **Flexible Configuration**: JSON-based configuration with CLI management
- **Multiple Interfaces**: CLI commands, interactive mode, and programmatic API
- **Batch Import**: Import multiple notes from files or URL lists
- **Duplicate Detection**: Automatic skip of previously imported notes using ID-based tracking
- **Import History**: Comprehensive import records with statistics and export capabilities
- **Incremental Sync**: Support for periodic synchronization of new content only

### Configuration Structure

Located in `xhs-importer.config.json`:
- `baseFolder`: Root directory for imported notes
- `categories`: Array of category names for classification
- `downloadMedia`: Default setting for media downloads
- `s3`: S3 storage settings (see S3 Configuration below)
- `ai`: AI provider settings (enabled/disabled, API keys, model, prompts)
- `output`: Markdown and media file preferences

### S3 Configuration

```json
{
  "s3": {
    "enabled": true,
    "provider": "minio",
    "endpoint": "http://localhost:9000",
    "bucket": "mybucket",
    "accessKey": "mykey",
    "secretKey": "mysecret",
    "region": "us-east-1",
    "pathPrefix": "xiaohongshu/",
    "uploadStrategy": "both",
    "retry": {
      "maxRetries": 3,
      "timeout": 60000
    }
  }
}
```

- `provider`: S3 provider type (`aws`, `minio`, `aliyun`, `tencent`)
- `endpoint`: S3 endpoint URL
- `bucket`: S3 bucket name
- `accessKey` / `secretKey`: S3 credentials
- `region`: S3 region (use `auto` for Cloudflare R2)
- `pathPrefix`: Prefix for uploaded files
- `uploadStrategy`: Upload strategy (`s3-only`, `local-only`, `both`)

### File Organization

- Notes: `{baseFolder}/{category}/{sanitized-title}.md`
- Media: `{baseFolder}/media/{sanitized-title}-{index}.{ext}`
- Video notes prefixed with `[V]` in filename

### CLI Commands

#### Import
```bash
xhs-import import --url <url>                      # Import from URL
xhs-import import --url <url> --download-media     # Download media locally
xhs-import import --url <url> --s3                # Upload media to S3
xhs-import import --url <url> --s3-only           # Only upload to S3, no local
```

#### Batch Import
```bash
xhs-import batch -f <file>                        # Import from file
xhs-import batch -u "url1,url2"                    # Import from URLs
```

#### S3 Configuration
```bash
xhs-import config --show-s3                        # View S3 config
xhs-import config --enable-s3                      # Enable S3
xhs-import config --set-s3-endpoint <url>          # Set endpoint
xhs-import config --set-s3-bucket <name>           # Set bucket
xhs-import config --set-s3-access-key <key>       # Set access key
xhs-import config --set-s3-secret-key <key>       # Set secret key
xhs-import config --set-s3-provider <provider>    # Set provider (aws/minio/aliyun/tencent)
```

#### Replace Media URLs
```bash
xhs-import replace-media <directory> --preview     # Preview URLs to replace
xhs-import replace-media <directory> --dry-run     # Simulate replacement
xhs-import replace-media <directory> --execute     # Execute replacement
xhs-import replace-media <directory> --filter type:image  # Only images
xhs-import replace-media <directory> --backup      # Backup before modify
```

#### Cleanup Media
```bash
xhs-import cleanup-media <directory> --preview     # Preview orphaned files
xhs-import cleanup-media <directory> --execute     # Delete orphaned files
```

#### Other Commands
```bash
xhs-import config --show                           # View all config
xhs-import categories                              # List categories
xhs-import history                                 # View import history
xhs-import history --export <file>                 # Export history
xhs-import interactive                             # Interactive mode

### Build System

Uses TypeScript compiler with configuration in `tsconfig.json`. The build process:
- Compiles TypeScript to CommonJS in `dist/` directory
- Supports development watch mode with tsx
- Creates executable CLI tool at `dist/cli.js`

### Dependencies

- **Core**: node-fetch for HTTP requests
- **CLI**: commander, inquirer, chalk, ora for user interface
- **AI**: openai package for OpenAI API integration
- **Storage**: @aws-sdk/client-s3, @aws-sdk/lib-storage for S3 uploads
- **Dev**: TypeScript and tsx for development

### Environment Requirements

- Node.js >= 16.0.0
- Access to Xiaohongshu URLs
- Optional: API keys for AI classification (OpenAI or Anthropic)

## Development Notes

When extending the application:
1. Add new AI providers by implementing the `AIProvider` interface
2. Extend categories through configuration or CLI commands
3. Modify markdown templates in `FileManager.generateMarkdown()`
4. Add new CLI commands in `src/cli.ts`
5. Update TypeScript types in `src/types.ts` for new data structures
6. Customize import history storage in `ImportHistory` class
7. Extend batch import logic in `BatchImporter` for new sources or formats