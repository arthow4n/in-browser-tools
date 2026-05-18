import { useState, useRef } from 'react';
import { ChatMessage as LLMCoreChatMessage } from '../llm-core.js';
import { ChatCore, ChatMessage } from '../../llm-chat/core.js';

interface UseChatGeneratorResult {
  isSending: boolean;
  streamingMsg: ChatMessage | null;
  chatStatusText: string;
  chatIsError: boolean;
  triggerGeneration: (currentAssistantMsg?: ChatMessage) => Promise<void>;
  abortGeneration: () => void;
}

export function useChatGenerator(
  core: ChatCore,
  onUpdate: () => void
): UseChatGeneratorResult {
  const [isSending, setIsSending] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null);
  const [chatStatusText, setChatStatusText] = useState('');
  const [chatIsError, setChatIsError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const triggerGeneration = async (currentAssistantMsg?: ChatMessage) => {
    setIsSending(true);
    setChatStatusText('');
    setChatIsError(false);

    const doStream = async (assistantMsg: ChatMessage) => {
      abortControllerRef.current = new AbortController();
      setStreamingMsg(assistantMsg);

      try {
        const generator = core.streamChatCompletionWithTools([], {
          abortSignal: abortControllerRef.current.signal,
        });

        for await (const chunk of generator) {
          if (chunk.type === 'text' && chunk.text) {
            assistantMsg.content += chunk.text;
          } else if (chunk.type === 'reasoning' && chunk.reasoning) {
            assistantMsg.reasoning = (assistantMsg.reasoning || '') + chunk.reasoning;
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            if (!assistantMsg.tool_calls) {
              assistantMsg.tool_calls = [];
            }
            assistantMsg.tool_calls.push({
              id: chunk.toolCall.id,
              type: 'function',
              function: {
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              },
            });
          }
          setStreamingMsg({ ...assistantMsg }); // Force re-render
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setChatStatusText(`Error: ${e.message}`);
          setChatIsError(true);
          assistantMsg.content += `\n[Error: ${e.message}]`;
          setStreamingMsg({ ...assistantMsg });
        }
      } finally {
        setStreamingMsg(null);

        if (
          assistantMsg.content ||
          (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0)
        ) {
          core.history.push(assistantMsg);
        }
        core.saveChatState();
        onUpdate();

        if (
          assistantMsg.tool_calls &&
          assistantMsg.tool_calls.length > 0 &&
          !abortControllerRef.current?.signal.aborted
        ) {
          let hasParsingError = false;
          for (const tc of assistantMsg.tool_calls) {
            const tool = core.tools.find((t) => t.name === tc.function.name);
            let resultStr = '';
            if (!tool) {
              resultStr = `Error: Tool ${tc.function.name} not found.`;
            } else {
              let args;
              try {
                args = JSON.parse(tc.function.arguments);
              } catch (e: any) {
                hasParsingError = true;
                break;
              }
              try {
                const result = await tool.execute(args, {
                  toolCallId: tc.id,
                  threadId: core.storagePrefix,
                  abortSignal: abortControllerRef.current?.signal,
                });
                resultStr = typeof result === 'string' ? result : JSON.stringify(result);
              } catch (e: any) {
                if (e.name === 'AbortError') {
                  break;
                }
                resultStr = `Error executing tool: ${e.message}`;
              }
            }

            const toolMsg: ChatMessage = {
              id: 'msg_tool_' + crypto.randomUUID(),
              role: 'tool',
              content: resultStr,
              tool_call_id: tc.id,
            };
            core.history.push(toolMsg);
            core.saveChatState();
            onUpdate();
          }

          if (!abortControllerRef.current?.signal.aborted && !hasParsingError) {
            const nextAssistantMsg: ChatMessage = {
              id: 'msg_' + Date.now(),
              role: 'assistant',
              content: '',
            };
            await doStream(nextAssistantMsg);
          } else {
            setIsSending(false);
          }
        } else {
          setIsSending(false);
        }
        abortControllerRef.current = null;
      }
    };

    const initialMsg = currentAssistantMsg || {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };
    await doStream(initialMsg);
  };

  return {
    isSending,
    streamingMsg,
    chatStatusText,
    chatIsError,
    triggerGeneration,
    abortGeneration,
  };
}
