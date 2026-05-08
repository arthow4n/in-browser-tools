# Guide for coding agents

## To find improvements in this repo

If you are findng improvements in this repo, try focus more on finding concrete new tool ideas instead of improving the existing tool.

## To intepret the task

The tool you are asked to make might not be well thought through or not really doable in purely in-browser. If the tool can't really be made purely in-browser, you should tell the user that the tool can't be made in browser and why.

## How to work in this repo

- This web app is very small and everything fits into the context window. Prefer to aggressively read everything and build a full understanding of the repo before you make any plan or edit.
- If you are updating any contents related to the instructions in this `AGENTS.md`, or you updated anything in the `package.json`, build/test config or pipeline actions, make sure you double check all of these and update if needed to make sure the contents in these files are all in sync.
- Prioritize using the available tools you are given access to, instead of writing scripts or running arbitrary commands, even if the action might be slower to do with the tools. This is mainly to ensure your actions such as read/write files will be approved by the user.
- If you are about to run any `npx`/`npm exec` or similar commands, prioritise to `npm run` the scripts already listed in `package.json` instead.
- The project is bundled using Rsbuild. You can start the dev server using `npm run dev` and build the project using `npm run build`.

## Tech stack

Rsbuild, TypeScript, Prettier, Playwright.

The whole repo is a client-side only frontend web app built on GitHub Actions then deployed to GitHub Pages [https://arthow4n.github.io/in-browser-tools/](https://arthow4n.github.io/in-browser-tools/).

You may use/build WASM dependencies if needed for performance.

Dependencies should be bundled with the bundler.

## Styling

Keep everything simple, but leave some spacing between elements, so they are clickable in mobile.

## Pre-push checks

You MUST run the pre-push checks and fix any issues raised during the pre-push checks, since any failure is directly caused by your changes.

- `npm run build` to confirm the build works and type check passes.
- `npm run format` to format the code. This formats all the files including Markdown and YAML.
- `npm run test` and ensure they pass. These tests act as living documents of the expected features, you should add tests or update the existing tests if you are making changes. Double check if the tests cover your changes.

## Coding conventions

- If you are creating a new tool or updating an existing one, the "Back to Tools" button/link that takes the user to the app root MUST use exactly `<a href="../index.html">← Back to Tools</a>`. Because all tools are exactly one sub-directory deep, using this relative URL natively resolves to the correct location locally and on GitHub Pages.
- Prefer object parameters (named arguments) to positional arguments for functions to improve readability.
- Disallow optional arguments with default values. All arguments should be explicitly declared and passed to functions.
- If an element or variable is expected to exist (for example, an element queried from the DOM via `querySelector`), do not suppress missing element errors using optional chaining (`?.`) or type casting (`as HTMLElement`, `as HTMLButtonElement`, etc.). Instead, verify the element's existence and correct type using `instanceof` and throw an explicit error if the check fails (e.g., `if (!(button instanceof HTMLButtonElement)) throw new Error("Button not found");`).

## Git/GitHub conventions

- Begin the commit message and pull request title with the coding agent name.
  - Bad example
    - Add X and do Y
  - Good examples
    - (Antigravity) Add X and do Y
    - (Jules) Add X and do Y
    - (Gemini CLI) Add X and do Y
