1. **Update `randomTool` arguments in `src/shared/tools/random.ts`**:
   - Add a required `hide_details` boolean parameter.
   - Describe it with examples, such as hiding it for role play story progression or hidden mechanics.

2. **Update `ToolCallMessageUI.tsx`**:
   - Parse the tool call arguments.
   - If `hide_details` is explicitly `false`, set the `<details>` tag to be `open={true}` by default, so it's not hidden. (If `hide_details` is `true`, it remains closed by default).

3. **Update `ChatMessageUI.tsx`**:
   - When rendering a message with `role: 'tool'`, check the corresponding tool call in the `core.history` using `msg.tool_call_id`.
   - If the original tool call had `hide_details: true`, wrap the tool result inside a `<details>` element that is closed by default, displaying a summary like "Tool Result: random".
   - If `hide_details` is `false` or not present, render the tool result as it currently does (fully visible).

4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
