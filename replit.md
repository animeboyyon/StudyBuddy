# StudyBot: Telegram Study Assistant

## Overview

StudyBot is a full-stack web application that provides an intelligent study assistant through a Telegram bot. The system allows users to upload documents (PDF, DOCX), automatically generates study questions using OpenAI's GPT-4, and delivers these questions to users on a scheduled basis through Telegram. It includes a React-based dashboard for monitoring bot activity and statistics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with custom theming

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **External APIs**: OpenAI GPT-4 for question generation, Telegram Bot API
- **File Processing**: PDF parsing and DOCX text extraction

## Key Components

### Database Schema
The system uses PostgreSQL with the following main entities:
- **Users**: Telegram user information and preferences
- **Documents**: Uploaded study materials with metadata
- **Questions**: AI-generated questions from documents
- **Study Sessions**: Active learning sessions with scheduling
- **Question Responses**: User answers and performance tracking
- **Bot Stats**: System metrics and analytics

### Core Services
1. **Telegram Bot Service**: Handles bot interactions, file uploads, and user commands
2. **OpenAI Service**: Generates study questions and evaluates user responses
3. **Question Scheduler**: Manages timed question delivery using cron jobs
4. **File Processor**: Extracts text content from PDF and DOCX files
5. **Storage Layer**: Abstracts database operations with in-memory fallback

### Frontend Components
- **Dashboard**: Main admin interface showing bot statistics
- **Stats Cards**: Real-time metrics display
- **Recent Activity**: Live activity feed
- **Question Preview**: Sample generated questions
- **Quick Actions**: Bot control panel

## Data Flow

1. **Document Upload**: Users send documents via Telegram bot
2. **Content Processing**: Files are parsed and text extracted
3. **Question Generation**: OpenAI generates study questions from content
4. **Session Management**: Users use `/study` command to start study sessions
5. **Question Delivery**: Bot sends first question immediately, then every 15 minutes
6. **Response Evaluation**: AI evaluates user answers and provides feedback
7. **Analytics**: Dashboard displays usage statistics and performance metrics

## Recent Changes

### January 2025
- **Migrated to Google Gemini API**: Switched from OpenAI to Google Gemini API for cost-effective AI processing (free tier with 1500 requests/day)
- **Fixed answer evaluation**: Resolved issue where bot couldn't evaluate user answers due to incomplete migration to Gemini service
- **Increased file size limit**: Maximum document size increased from 50MB to 1GB for handling larger study materials
- **Added `/exam` command**: New exam mode that sends 10 questions continuously with immediate feedback
- **Immediate question delivery in exam mode**: Questions are sent immediately after answering the previous one
- **Added `/stop` command**: Users can now stop all active study sessions using the `/stop` command
- **Database migration complete**: Migrated from in-memory storage to PostgreSQL database for persistent data
- **Database schema deployed**: Successfully pushed schema changes to PostgreSQL using Drizzle
- **Updated help messages**: All bot commands now include the new `/exam` and `/stop` commands

### December 2024
- **Added `/study` command**: Users now use `/study` to start study sessions instead of text messages
- **Immediate question delivery**: First question is sent immediately when session starts
- **Enhanced question scheduler**: Added proper question tracking and answer handling
- **Fixed file processing**: Added mammoth library for DOCX support and resolved PDF processing issues
- **Updated help messages**: All bot commands now reference the new `/study` workflow

## External Dependencies

### Core Dependencies
- **Database**: Neon serverless PostgreSQL via `@neondatabase/serverless`
- **AI Integration**: OpenAI API for question generation and evaluation
- **Telegram Bot**: `node-telegram-bot-api` for bot functionality
- **File Processing**: `pdf-parse` for PDF text extraction
- **Scheduling**: `node-cron` for timed question delivery

### UI Dependencies
- **Component Library**: Extensive Radix UI components
- **Styling**: Tailwind CSS with custom design tokens
- **Icons**: Lucide React icons
- **Date Handling**: date-fns for date manipulation
- **Form Handling**: React Hook Form with Zod validation

## Deployment Strategy

### Development
- **Environment**: Local development with hot reloading
- **Database**: Uses DATABASE_URL environment variable
- **Bot Integration**: Requires TELEGRAM_BOT_TOKEN for testing
- **AI Services**: Needs OPENAI_API_KEY for question generation

### Production Build
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild compiles TypeScript server to `dist/index.js`
- **Database Migrations**: Drizzle Kit handles schema updates
- **Environment Variables**: Requires production credentials for all services

### Key Configuration
- **Database**: PostgreSQL with Drizzle ORM migrations
- **File Storage**: Local file system for document processing
- **Session Management**: In-memory session storage (scalable to Redis)
- **Monitoring**: Built-in request logging and error handling