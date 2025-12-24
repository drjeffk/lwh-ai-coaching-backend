import express from 'express';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Coaching stream endpoint (replaces Supabase edge function)
router.post('/coaching-stream', authenticateToken, async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Enhanced system prompt
    const enhancedSystemPrompt = `**Leading with Heart AI Coach – Configuration & Interaction Guidelines**

**Purpose**
The Leading with Heart AI Coach acts as a leadership coach that helps users:
* Reflect on challenges through discovery-driven dialogue
* Take measurable, action-oriented steps (15 minutes or less)
* Navigate leadership complexities, especially people-related issues
* Experience empathy, non-judgment, and empowerment

**Coaching Style**
* Direct yet empathetic
* Goal-focused, avoids making anyone "wrong"
* Honors the leader as whole, resourceful, and creative
* Encourages reflection and action without trying to "fix" the user

**Session Flow**
1. Agenda Setting:
   * Ask: "What are you hoping to get out of this chat?"
   * Ask: "By the end of this conversation, what do you want to be different?"
2. Exploration:
   * Use discovery-based open-ended questions to explore the user's challenge
3. Periodic Action Suggestions:
   * Offer short, measurable steps throughout the conversation
   * Pair them with reflective questions to sustain engagement
4. Wrap-Up:
   * Summarize insights and confirm next steps
   * Optionally ask: "Would you like me to do more of, less of, or something different next time?"

**Focus Areas**
Coach should specialize in people-related leadership challenges:
* Difficult conversations
* Accountability
* Motivation and development
* Influencing without authority
* Managing up
* Navigating internal politics
* Addressing sabotage or resistance

THE MOST IMPORTANT RULE: You must ALWAYS end with EXACTLY ONE short, direct, open-ended question.
NEVER ask multiple questions in a single response - this is critical.

MARKDOWN FORMATTING:
1. Always use markdown to format your responses
2. MOST IMPORTANTLY: Put your primary coaching question in bold using **bold syntax**
3. Use bold text to emphasize KEY phrases throughout your response
4. Keep formatting clean and minimal - don't overuse formatting

${systemPrompt || ""}`;

    // Set up streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const encoder = new TextEncoder();
    let fullResponse = '';

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          ...messages.map(msg => ({
            role: msg.role === 'coach' ? 'assistant' : msg.role,
            content: msg.content,
          }))
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          res.write(encoder.encode(JSON.stringify({ 
            type: 'chunk', 
            content 
          }) + '\n'));
        }
      }

      // Process response to ensure only one question
      let processedResponse = fullResponse;
      const questionCount = (fullResponse.match(/\?/g) || []).length;

      if (questionCount > 1) {
        const sentences = fullResponse.split(/(?<=[.!?])\s+/);
        const lastQuestionIndex = sentences.map(s => s.includes('?')).lastIndexOf(true);
        
        if (lastQuestionIndex !== -1) {
          const leadingContext = sentences.slice(Math.max(0, lastQuestionIndex - 1), lastQuestionIndex).join(' ');
          const lastQuestion = sentences[lastQuestionIndex];
          processedResponse = `${leadingContext} ${lastQuestion}`;
        }
      }

      // Determine response type
      let responseType = 'question';
      if (processedResponse.toLowerCase().includes('consider') || processedResponse.toLowerCase().includes('reflect')) {
        responseType = 'reflection';
      } else if (!processedResponse.trim().endsWith('?') && !processedResponse.includes('?')) {
        responseType = 'advice';
      }

      // Extract action items and insights
      const actionItems = processedResponse
        .split('\n')
        .filter(line => 
          line.toLowerCase().includes('try') || 
          line.toLowerCase().includes('action') ||
          line.toLowerCase().includes('step') ||
          line.toLowerCase().includes('draft') ||
          line.toLowerCase().includes('create') ||
          line.toLowerCase().includes('schedule')
        )
        .map(line => line.replace(/^.*?:/, '').trim())
        .filter(line => line.length > 10 && line.length < 100)
        .slice(0, 2);

      const insights = processedResponse
        .split('\n')
        .filter(line => 
          line.toLowerCase().includes('insight') || 
          line.toLowerCase().includes('notice') || 
          line.toLowerCase().includes('observe') ||
          line.toLowerCase().includes('reflection')
        )
        .map(line => line.replace(/^.*?:/, '').trim())
        .filter(line => line.length > 10 && line.length < 100)
        .slice(0, 2);

      // Send completion message
      res.write(encoder.encode(JSON.stringify({
        type: 'complete',
        data: {
          type: responseType,
          insights: insights,
          actionItems: actionItems
        }
      }) + '\n'));

      res.end();
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      res.write(encoder.encode(JSON.stringify({ 
        type: 'error', 
        error: error.message 
      }) + '\n'));
      res.end();
    }
  } catch (error) {
    console.error('Coaching stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OpenAI completion endpoint (replaces Supabase edge function)
router.post('/openai-completion', authenticateToken, async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini', temperature = 0.7, max_tokens = 1500 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    res.json({
      completion: completion.choices[0]?.message?.content || '',
    });
  } catch (error) {
    console.error('OpenAI completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Assistant endpoints (replaces Supabase edge function)
router.post('/ai-assistant', authenticateToken, async (req, res) => {
  try {
    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    switch (action) {
      case 'create-thread': {
        // Create a new OpenAI thread
        const thread = await openai.beta.threads.create({
          ...(data?.vectorStoreId && {
            tool_resources: {
              file_search: {
                vector_store_ids: [data.vectorStoreId]
              }
            }
          })
        });

        return res.json({
          success: true,
          threadId: thread.id
        });
      }

      case 'delete-thread': {
        if (!data?.threadId) {
          return res.status(400).json({ error: 'Thread ID is required' });
        }

        await openai.beta.threads.del(data.threadId);
        return res.json({ success: true });
      }

      case 'send-message': {
        if (!data?.threadId || !data?.message) {
          return res.status(400).json({ error: 'Thread ID and message are required' });
        }

        if (data.stream) {
          // Handle streaming response
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          const encoder = new TextEncoder();

          try {
            // Create message in thread
            await openai.beta.threads.messages.create(data.threadId, {
              role: 'user',
              content: data.message
            });

            // Get assistant ID from database or use default
            const assistantId = data.assistantId || process.env.OPENAI_ASSISTANT_ID;

            if (!assistantId) {
              throw new Error('Assistant ID not configured');
            }

            // Create run with streaming
            const stream = await openai.beta.threads.runs.createAndStream(
              data.threadId,
              {
                assistant_id: assistantId,
                ...(data.systemPrompt && { instructions: data.systemPrompt })
              }
            );

            for await (const event of stream) {
              if (event.event === 'thread.message.delta' && event.data.delta?.content) {
                const content = event.data.delta.content[0];
                if (content.type === 'text' && content.text?.value) {
                  res.write(encoder.encode(`data: ${JSON.stringify({ delta: { content: content.text.value } })}\n\n`));
                }
              }
            }

            res.write(encoder.encode('data: [DONE]\n\n'));
            res.end();
          } catch (error) {
            res.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            res.end();
          }
        } else {
          // Non-streaming response
          await openai.beta.threads.messages.create(data.threadId, {
            role: 'user',
            content: data.message
          });

          const assistantId = data.assistantId || process.env.OPENAI_ASSISTANT_ID;
          if (!assistantId) {
            return res.status(400).json({ error: 'Assistant ID not configured' });
          }

          const run = await openai.beta.threads.runs.create(data.threadId, {
            assistant_id: assistantId,
            ...(data.systemPrompt && { instructions: data.systemPrompt })
          });

          // Wait for completion
          let runStatus = await openai.beta.threads.runs.retrieve(data.threadId, run.id);
          while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(data.threadId, run.id);
          }

          if (runStatus.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(data.threadId);
            const assistantMessage = messages.data.find(m => m.role === 'assistant');
            const content = assistantMessage?.content[0];
            
            return res.json({
              success: true,
              data: content?.type === 'text' ? content.text.value : ''
            });
          } else {
            return res.status(500).json({ error: `Run failed with status: ${runStatus.status}` });
          }
        }
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('AI Assistant error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

