# Guide for coding agents

## Work autonomously

Any task given to you should be treated as final instructions. You should work autonomously to finish it without asking for further input.

Don't check in with the user, don't ask for clarification unless the user explicitly asks for it.

If you are Jules, make decisions yourself and keep working until the task is done. Don't ask for any further input from the user. Just finalize and submit your changes directly.

## How to work in this repo

- This web app is very small and everything fits into the context window. Prefer to aggressively read everything and build a full understanding of the repo before you make any plan or edit.
- Actively look for shared configurations, components, and logic across different tools (e.g., API keys, UI elements) and extract them into shared modules in `src/shared` whenever it makes sense to reduce duplication.
- If you are updating any contents related to the instructions in this `AGENTS.md`, or you updated anything in the `package.json`, build/test config or pipeline actions, make sure you double check all of these and update `AGENTS.md` if needed to make sure the contents in these files are all in sync.
- Prioritize using the available tools you are given access to, instead of writing scripts or running arbitrary commands, even if the action might be slower to do with the tools. This is mainly to ensure your actions such as read/write files will be approved by the user.
- If you are about to run any `npx`/`npm exec` or similar commands, prioritise to `npm run` the scripts already listed in `package.json` instead.
- The project is bundled using Rsbuild. You can start the dev server using `npm run dev` and build the project using `npm run build`.
- When creating a new tool, use the `<PageLayout>` component from `src/shared/components/PageLayout.tsx` as the main wrapper. This ensures the consistent 'Back to Tools' link to the app root is present. Do not use custom `../index.html` or `/` links because Rsbuild flattens the output directory and GitHub pages hosts it at `/in-browser-tools/`.

## Tech stack

Rsbuild, React, TypeScript, Prettier, Playwright.

The whole repo is a client-side only frontend web app built on GitHub Actions then deployed to GitHub Pages [https://arthow4n.github.io/in-browser-tools/](https://arthow4n.github.io/in-browser-tools/).

You may use/build WASM dependencies if needed for performance.

Dependencies should be bundled with the bundler.

## Styling

Keep everything simple, but leave some spacing between elements, so they are clickable in mobile.
Adopt a mobile-first design:

- Always include the `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` tag in the `<head>` of HTML files.
- **Shared UI Components**: Leverage the React components in `src/shared/components/` (e.g., `<Button>`, `<Input>`, `<PageLayout>`, `<Panel>`) to maintain a consistent UI. These components already import the shared `styles.css`. Avoid inline styling or custom CSS unless necessary.
- Ensure layouts wrap properly on small screens (e.g. use `display: flex; flex-wrap: wrap;` or media queries for CSS grids). Input fields and buttons should wrap to the next line on mobile rather than overflowing.
- Use `box-sizing: border-box` globally or for sizing elements to prevent padding/borders from breaking width limits.
- Avoid hardcoded fixed widths (e.g. `width: 300px`); use `width: 100%; max-width: 300px;` instead.
- Avoid using browser `alert()` for errors or notifications because it force disturbs the user. Always display loading, streaming, and error states gracefully using inline UI elements (e.g., status spans or specific UI containers) as close to the related action button as possible. Note that LLM returning an empty response should also be treated as an error state, as it could mean the provider blocked the output.
- When a button triggers an asynchronous action, use the `useAsyncAction` hook from `src/shared/hooks/useAsyncAction.ts` to manage the loading state, button disablement, and error/success status automatically.

## Pre-push checks

You MUST run the pre-push checks and fix any issues raised during the pre-push checks, since any failure is directly caused by your changes.

- Check if there are leftover files unremoved that's not related to your changes, remove them. For example one-off debug log or screenshots that shouldn't be persisted in the git history.
- `npm run build` to confirm the build works and type check passes.
- `npm run format` to format the code. This formats all the files including Markdown and YAML.
- `npm run test` and ensure they pass. These tests act as living documents of the expected features, you should add tests or update the existing tests if you are making changes. Double check if the tests cover your changes.

## Coding conventions

- **Component Reuse**: Actively extract new reusable UI components and styles into `src/shared/components/` when valid to build up a design system.
  - To ensure discoverability and maintainability, shared components must export only 1 component per file and the file name must match the component name.

- Prefer object parameters (named arguments) to positional arguments for functions to improve readability.
- Disallow optional arguments with default values. All arguments should be explicitly declared and passed to functions.
- If an element or variable is expected to exist, do not suppress missing object errors using optional chaining (`?.`) or type casting. Verify its existence and throw an explicit error if the check fails.
- **Strict TypeScript**: DO NOT use the `any` type in TypeScript code. Always define concrete types, use `unknown`, or use appropriate generic types. If parsing external or dynamic data (like JSON), type it as `unknown` and assert or validate the structure at the call site.
- **Local Storage Management:** To avoid key collisions and protect data under the same domain, ALL local storage interactions MUST go through `getStorage` and `setStorage` exported from `src/shared/storage.ts`. Do not call `localStorage.getItem` or `localStorage.setItem` directly. These utilities automatically prefix keys with `in-browser-tools:`.
- **Global Settings:** Shared configurations across tools, such as the OpenRouter API Key, model settings, and provider routing preferences, belong in the centralized Settings page (`src/settings`). Individual tools should use the `<LlmSettings>` component from `src/shared/components/LlmSettings.tsx` to direct users to this page rather than re-implementing these inputs.

## Git/GitHub conventions

- Begin the commit message and pull request title with the coding agent name.
  - Bad example
    - Add X and do Y
  - Good examples
    - (Antigravity) Add X and do Y
    - (Jules) Add X and do Y
    - (Gemini CLI) Add X and do Y
