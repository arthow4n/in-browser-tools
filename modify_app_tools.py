import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()


tools_ui = """        <div className="flex-row">
          <Input
            type="checkbox"
            id="enable-tools-checkbox"
            label="Enable Tools"
            checked={toolsEnabled}
            onChange={handleToolEnableToggle}
            containerStyle={{ marginRight: '15px' }}
          />
        </div>

        {toolsEnabled && (
          <div
            id="tool-list-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              padding: '10px',
              background: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '10px',
            }}
          >
            {core.tools.map((tool) => (
              <Input
                key={tool.name}
                type="checkbox"
                label={`${tool.name}: ${tool.description}`}
                checked={!disabledTools.has(tool.name)}
                onChange={(e) => handleToolToggle(tool.name, e.target.checked)}
                style={{
                  fontWeight: 'normal',
                  fontSize: '0.9em',
                }}
              />
            ))}
          </div>
        )}"""

# Remove tools UI from original location
content = content.replace(tools_ui, "")


# Find where to insert it in System Prompt panel.
# We want to insert it after the details block of Prompt Improver in System Prompt Panel
prompt_improver_end = """            </span>
          </div>
        </details>"""

insert_index = content.find(prompt_improver_end)
if insert_index != -1:
    insert_point = insert_index + len(prompt_improver_end)
    content = content[:insert_point] + "\n\n" + tools_ui + content[insert_point:]

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
