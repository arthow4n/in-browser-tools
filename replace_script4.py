import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Update JSX
old_jsx = """
      <Panel title="System Prompt">
        <TextArea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />

        <div className="flex-row" style={{ marginTop: '10px' }}>
          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
          >
            <option value="">-- Load Saved Prompt --</option>
            {savedPrompts.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          {selectedPromptId && (
            <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
              Save
            </Button>
          )}
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save As New...
          </Button>
          {selectedPromptId && (
            <Button
              variant="danger"
              onClick={handleDeletePrompt}
              id="delete-prompt-btn"
            >
              Delete
            </Button>
          )}
        </div>

        <details
          style={{
            marginTop: '10px',
            background: '#f9f9f9',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Prompt Improver (Auto-generate better prompt)
          </summary>
          <div style={{ marginTop: '10px' }}>
            <Input
              label="Intention (Optional):"
              type="text"
              placeholder="What is the goal of this prompt?"
              value={promptIntention}
              onChange={(e) => setPromptIntention(e.target.value)}
            />
            <Input
              label="How to improve (Optional):"
              type="text"
              placeholder="e.g. Make it more professional"
              value={promptHowToImprove}
              onChange={(e) => setPromptHowToImprove(e.target.value)}
            />
            <Input
              label="Evaluation Focus (Optional):"
              type="text"
              placeholder="What to verify?"
              value={promptEvaluationFocus}
              onChange={(e) => setPromptEvaluationFocus(e.target.value)}
            />
            <Button
              onClick={handleImprovePrompt}
              loading={isImproving}
              id="improve-prompt-btn"
            >
              Improve System Prompt
            </Button>
            <span
              id="improve-prompt-status"
              className="status"
              style={{ color: improveIsError ? 'red' : 'green' }}
            >
              {improveStatusText}
            </span>
          </div>
        </details>
      </Panel>

      <Panel title="Chat History">
        <div
          id="history-container"
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            marginBottom: '15px',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '4px',
            background: '#fafafa',
          }}
        >
          {history.map((msg) => (
            <ChatMessageUI
              key={msg.id}
              msg={msg}
              core={core}
              onUpdate={triggerUpdate}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
            />
          )}
        </div>

        <div className="flex-row">
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
        )}

        <TextArea
          id="user-input"
          placeholder="Type your message here..."
          rows={3}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
"""

new_jsx = """
      <Panel title="System Prompt">
        <div className="flex-row" style={{ marginBottom: '10px' }}>
          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
            style={{ minWidth: '200px' }}
          >
            <option value="">-- No Prompt Selected --</option>
            <optgroup label="--- Built-in ---">
              {BUILT_IN_PROMPTS.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name}
                </option>
              ))}
            </optgroup>
            {savedPrompts.length > 0 && (
              <optgroup label="--- Custom ---">
                {savedPrompts.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {selectedPromptId && hasChanges && (
            <span style={{ color: '#d97706', marginLeft: '10px', fontWeight: 'bold' }}>
              ⚠️ Unsaved changes (Click Save to persist changes to this prompt slot)
            </span>
          )}
        </div>

        <TextArea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />

        <div className="flex-row" style={{ marginTop: '10px', marginBottom: '10px' }}>
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
        )}

        <div className="flex-row" style={{ marginTop: '10px' }}>
          {selectedPromptId && !BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId) && (
            <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
              Save
            </Button>
          )}
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save As New...
          </Button>
          {selectedPromptId && !BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId) && (
            <Button
              variant="danger"
              onClick={handleDeletePrompt}
              id="delete-prompt-btn"
            >
              Delete
            </Button>
          )}
        </div>

        <details
          style={{
            marginTop: '10px',
            background: '#f9f9f9',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Prompt Improver (Auto-generate better prompt)
          </summary>
          <div style={{ marginTop: '10px' }}>
            <Input
              label="Intention (Optional):"
              type="text"
              placeholder="What is the goal of this prompt?"
              value={promptIntention}
              onChange={(e) => setPromptIntention(e.target.value)}
            />
            <Input
              label="How to improve (Optional):"
              type="text"
              placeholder="e.g. Make it more professional"
              value={promptHowToImprove}
              onChange={(e) => setPromptHowToImprove(e.target.value)}
            />
            <Input
              label="Evaluation Focus (Optional):"
              type="text"
              placeholder="What to verify?"
              value={promptEvaluationFocus}
              onChange={(e) => setPromptEvaluationFocus(e.target.value)}
            />
            <Button
              onClick={handleImprovePrompt}
              loading={isImproving}
              id="improve-prompt-btn"
            >
              Improve System Prompt
            </Button>
            <span
              id="improve-prompt-status"
              className="status"
              style={{ color: improveIsError ? 'red' : 'green' }}
            >
              {improveStatusText}
            </span>
          </div>
        </details>
      </Panel>

      <Panel title="Chat History">
        <div
          id="history-container"
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            marginBottom: '15px',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '4px',
            background: '#fafafa',
          }}
        >
          {history.map((msg) => (
            <ChatMessageUI
              key={msg.id}
              msg={msg}
              core={core}
              onUpdate={triggerUpdate}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
            />
          )}
        </div>

        <TextArea
          id="user-input"
          placeholder="Type your message here..."
          rows={3}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
"""

content = content.replace(old_jsx.strip(), new_jsx.strip())

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
