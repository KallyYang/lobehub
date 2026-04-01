import type OpenAI from 'openai';

/**
 * make the OpenAI response data as a stream
 */
export const transformResponseToStream = (data: OpenAI.ChatCompletion) =>
  new ReadableStream({
    start(controller) {
      const choices = data.choices || [];
      const first = choices[0];
      // Compatibility: Non-streaming responses from DeepSeek etc. put "deep thinking" in message.reasoning_content
      const message: any = first?.message ?? {};
      const reasoningText =
        typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0
          ? message.reasoning_content
          : null;
      if (reasoningText) {
        controller.enqueue({
          choices: [
            {
              delta: { content: null, reasoning_content: reasoningText, role: 'assistant' },
              finish_reason: null,
              index: first?.index ?? 0,
              logprobs: first?.logprobs ?? null,
            },
          ],
          created: data.created,
          id: data.id,
          model: data.model,
          object: 'chat.completion.chunk',
        } as unknown as OpenAI.ChatCompletionChunk);
      }
      const chunk: OpenAI.ChatCompletionChunk = {
        choices: choices.map((choice: OpenAI.ChatCompletion.Choice) => ({
          delta: {
            content: choice.message.content,
            role: choice.message.role,
            tool_calls: choice.message.tool_calls?.map(
              (tool, index): OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall => ({
                function: tool.function,
                id: tool.id,
                index,
                type: tool.type,
              }),
            ),
          },
          finish_reason: null,
          index: choice.index,
          logprobs: choice.logprobs,
        })),
        created: data.created,
        id: data.id,
        model: data.model,
        object: 'chat.completion.chunk',
      };

      controller.enqueue(chunk);
      if (data.usage) {
        controller.enqueue({
          choices: [],
          created: data.created,
          id: data.id,
          model: data.model,
          object: 'chat.completion.chunk',
          usage: data.usage,
        } as unknown as OpenAI.ChatCompletionChunk);
      }
      controller.enqueue({
        choices: choices.map((choice: OpenAI.ChatCompletion.Choice) => ({
          delta: {
            content: null,
            role: choice.message.role,
          },
          finish_reason: choice.finish_reason,
          index: choice.index,
          logprobs: choice.logprobs,
        })),
        created: data.created,
        id: data.id,
        model: data.model,
        object: 'chat.completion.chunk',
        system_fingerprint: data.system_fingerprint,
      } as OpenAI.ChatCompletionChunk);
      controller.close();
    },
  });

/**
 * transform the OpenAI Response API data to stream format for non-streaming responses
 */
export const transformResponseAPIToStream = (data: OpenAI.Responses.Response) =>
  new ReadableStream({
    start(controller) {
      let toolIndex = 0;

      // Check if output exists and is an array
      if (data.output && Array.isArray(data.output)) {
        data.output.forEach((output, outputIndex) => {
          switch (output.type) {
            case 'message': {
              // Check if content exists and is an array
              if (output.content && Array.isArray(output.content)) {
                output.content.forEach((content) => {
                  switch (content.type) {
                    case 'output_text': {
                      // Only emit delta if text exists
                      if (content.text) {
                        controller.enqueue({
                          delta: content.text,
                          type: 'response.output_text.delta',
                        });
                      }
                      break;
                    }
                  }
                });
              }
              break;
            }

            case 'function_call': {
              const fnOutput = output as any;

              // Emit output_item.added so the stream handler sets up tool context
              controller.enqueue({
                item: {
                  call_id: fnOutput.call_id,
                  name: fnOutput.name,
                  type: 'function_call',
                },
                output_index: outputIndex,
                type: 'response.output_item.added',
              });

              // Emit the full arguments as a single delta
              if (fnOutput.arguments) {
                controller.enqueue({
                  delta: fnOutput.arguments,
                  item_id: fnOutput.id,
                  output_index: outputIndex,
                  type: 'response.function_call_arguments.delta',
                });
              }

              // Emit done event for this function call
              controller.enqueue({
                item: {
                  arguments: fnOutput.arguments || '',
                  call_id: fnOutput.call_id,
                  name: fnOutput.name,
                  type: 'function_call',
                },
                output_index: outputIndex,
                type: 'response.output_item.done',
              });

              toolIndex++;
              break;
            }
          }
        });
      }

      // Always send response.completed event
      controller.enqueue({
        response: data,
        sequence_number: 999,
        type: 'response.completed',
      } as OpenAI.Responses.ResponseStreamEvent);

      controller.close();
    },
  });
