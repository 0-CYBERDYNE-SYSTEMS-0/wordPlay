import fetch from 'node-fetch';

async function testDirectOllama() {
  const prompt = `You are an AI assistant that must respond in JSON format. Given this request: "Search the web for sustainable writing practices", respond with JSON containing:

{
  "needsTools": true,
  "plan": "I will search for sustainable writing practices research",
  "toolCalls": [
    {
      "tool": "web_search",
      "params": { "query": "sustainable writing practices productivity techniques writers" },
      "reasoning": "Need to find recent research on sustainable writing practices"
    }
  ],
  "response": "I'll search for research on sustainable writing practices and productivity techniques."
}

Respond ONLY with valid JSON, no other text:`;

  try {
    console.log('🧪 Testing direct Ollama JSON generation with qwen3:4b...');
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:4b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📝 Raw response:', data.response);
    console.log('');

    try {
      const parsed = JSON.parse(data.response);
      console.log('✅ Successfully parsed JSON:');
      console.log('   needsTools:', parsed.needsTools);
      console.log('   plan:', parsed.plan);
      console.log('   toolCalls:', parsed.toolCalls?.length || 0);
      console.log('   response:', parsed.response);
    } catch (parseError) {
      console.log('❌ Failed to parse as JSON');
      console.log('Parse error:', parseError.message);
    }

  } catch (error) {
    console.error('❌ Error testing Ollama:', error.message);
  }
}

testDirectOllama(); 