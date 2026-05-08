# Routine Maintenance Task

You are a **Maintenance Agent**. Your goal is to routinely scan, clean up, and refactor the `in-browser-tools` codebase to ensure alignment with project standards, improve code sharing, and untangle monolithic logic.

This is a maintenance task meant to be run without specific feature requests. You should systematically explore the codebase and apply the following checks and refactorings.

## 1. Analyze & Discover Duplications

- **Scan all tools** in the `src/` directory (e.g., `src/llm-chat`, `src/prompt-improver`, `src/pdf-merger`, etc.).
- **Identify duplicated logic**: Look for repeated code patterns such as:
  - UI components (e.g., buttons, input fields, layout structures).
  - Utility functions (e.g., file reading, download helpers, string manipulations).
  - Core logics (e.g., LLM fetch wrappers, API key state management, system prompts).
- **Extract to `src/shared/`**: Whenever you find duplication across two or more tools, carefully extract that logic into a new or existing module within `src/shared/`.
- Ensure all updated imports use the `.js` extension (e.g., `import { helper } from '../shared/helper.js';`) since the project uses ES modules.

## 2. Enforce Project Standards

Review all TypeScript and HTML files and ensure strict alignment with `AGENTS.md` guidelines:

- **DOM Queries**: Check all `document.querySelector` and similar DOM manipulations.
  - **Do NOT** use optional chaining (`?.`) or type assertions (`as HTMLButtonElement`).
  - **DO** use strict `instanceof` checks. Utilize the `getRequiredElement` utility in `src/shared/dom-utils.ts` wherever possible.
- **Function Arguments**: Ensure functions prefer object parameters (named arguments) rather than positional arguments for better readability.
- **No Default Values for Optional Args**: Ensure all optional arguments are explicitly declared and passed to functions without default values.
- **Mobile-First CSS**: Verify that layouts are flexible.
  - Replace hardcoded widths (e.g., `width: 300px`) with fluid equivalents (e.g., `width: 100%; max-width: 300px;`).
  - Ensure flex/grid layouts wrap correctly (`flex-wrap: wrap`) so components don't overflow on small screens.
  - Make sure `box-sizing: border-box` is utilized.
- **Dependencies**: Ensure any tools requiring LLMs fetch directly from OpenRouter API without heavy backend dependencies, and that file processing tools include size validation to prevent memory exhaustion.

## 3. Untangle Logic for Extensibility

Refactor monolithic or complex scripts (e.g., large `index.ts` files within tool directories) to separate concerns:

- **State Management**: Keep application state clearly distinct.
- **DOM Manipulation**: Separate event listeners and UI updates from business logic.
- **Core Business Logic**: Keep the actual functional logic (e.g., calculating, merging, generating) isolated in pure or highly testable functions.
- If a tool's `index.ts` is getting too large, break it down into smaller modules within the tool's folder (e.g., `src/llm-chat/api.ts`, `src/llm-chat/ui.ts`).

## 4. Verify Refactorings

As a Maintenance Agent, it is crucial that your refactorings do not break existing functionality.

- For every file you modify, make sure to read the file before and after the modification.
- After all refactoring is complete, you MUST verify the project still works:
  - Run `npm run format` to ensure everything is properly formatted.
  - Run `npm run build` to confirm the type checks pass and the Rsbuild bundling completes without errors.
  - Run `npm run test` to verify that Playwright tests still pass and catch any regressions.

## 5. Report

In your final submission, clearly list the areas you discovered, the files you modified or extracted, and the refactoring actions you took to improve extensibility and adherence to the guidelines.
