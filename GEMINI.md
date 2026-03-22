# Project: AI College Assistant

## What this app does:
RAG-based AI College Assistant where authorities upload documents 
(notices, syllabus, timetables, results) and students ask questions 
and get answers in their preferred language with Indian voice output.

## Who uses what:
- Authorities → upload documents into the vector database
- Students → ask questions via text or voice, get answers in their language

## Language Support:
- English, Hindi, Bengali
- Voice output uses Indian accent/tone
- Student can switch language from the chat UI
- AI must respond in the same language the student asks in

## Stack:
- Frontend: Next.js 16 App Router + Tailwind CSS
- Database: Supabase with pgvector extension
- AI: Google Gemini API (gemini-1.5-flash + text-embedding-004)
- Voice: Web Speech API or Google Text-to-Speech with Indian accent
- Vector dimensions: 768
- i18n routing already set up (/en, /hi, /bn)

## The features I am building:
1. Authority upload panel to ingest documents into vector database
2. RAG-powered chat for students to ask questions about documents
3. Multilingual responses in English, Hindi, Bengali
4. Voice output with Indian accent
5. Dashboard for authorities to see uploaded documents

## What is working right now:
- /en loads welcome page
- /en/chat loads chat UI
- Supabase documents table with pgvector created
- chat/route.ts connected to RAG pipeline
- Gemini embeddings working
- i18n routing working

## Do NOT build:
- Student login or authentication
- Paid features
- Mobile app
- Non-Indian accents

## Rules:
- Use TypeScript everywhere
- Use Tailwind for all styling
- Every function must handle errors
- Never change files not mentioned in the task
- Ask before installing new packages
- When generating AI responses, detect the language of the question
  and always reply in the same language