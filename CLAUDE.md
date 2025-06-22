# Claude Code Configuration

## Memory Instructions

Please remember: When the user says "context priming" or "/context-priming", execute:
```
read README.md, CLAUDE.md, ai_docs/*, and run git ls-files to understand this codebase.
```

## Custom Commands

### /context-priming
When you type `/context-priming` or mention "context priming", I will:
- Read README.md
- Read CLAUDE.md
- Read all files in ai_docs/* 
- Run git ls-files to understand the codebase structure

This helps me quickly understand the project context and structure.

## Project Context

This is an OpenAI Commodity Forecast API Test project that demonstrates web search capabilities for fetching real-time crude oil prices and generating multi-horizon forecasts.

## Development Guidelines

- Follow the coding rules in `ai-dev-tasks/coding-rules.md`
- Use the PRD generation process in `ai-dev-tasks/create-prd.md`
- Follow task management guidelines in `ai-dev-tasks/process-tasks.md`
- Generate task lists using `ai-dev-tasks/generate-tasks.md`

## Key Commands

- `npm start` - Run the commodity forecast test
- `npm test` - Run Jest tests
- `npm run build` - Build TypeScript files
- `npm run dev` - Run in watch mode

## Important Files

- `src/commodity-forecast-test.ts` - Main application
- `src/types/commodity.ts` - TypeScript interfaces
- `src/utils/formatter.ts` - Output formatting
- `tasks/` - PRD and task documentation
- `output/` - Generated forecast reports