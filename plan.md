1. **Update `src/shared/tools/random.ts`**:
   - Add a required boolean argument `hide_details` to the parameters of the `random` tool.
   - Include a description explaining that setting it to `true` hides the exact arguments and results in the UI by default (but keeps them expandable), which is useful for things like keeping role-play story progression hidden from the player.
2. **Update `src/shared/components/ToolCallMessageUI.tsx`**:
   - Parse `toolCall.function.arguments` to check for `hide_details`.
   - If `hide_details` is `false`, render the `<details>` element with the `open` property set so the tool call is expanded by default.
   - If `hide_details` is `true`, let it default to closed.
3. **Update `src/shared/components/ChatMessageUI.tsx`**:
   - For messages with `role: 'tool'`, attempt to find the original `toolCall` from `core.history` using `msg.tool_call_id`.
   - Parse the tool call arguments to check for `hide_details`.
   - If `hide_details` is `true`, wrap the tool result content inside a collapsible `<details>` element (closed by default) with a summary like "Tool Result".
4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done**.
5. **Submit changes**.
