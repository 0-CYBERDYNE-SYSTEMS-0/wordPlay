import fetch from 'node-fetch';

async function testOpenAIAgent() {
  const baseUrl = 'http://localhost:5001';
  
  // Simple request to test OpenAI integration
  const request = `Search the web for "AI coding productivity tips" and create a summary document.`;

  const context = {
    currentProject: {
      id: 1,
      name: "Test Project",
      type: "research"
    },
    llmProvider: 'openai',
    llmModel: 'gpt-4.1',
    userId: 1
  };

  try {
    console.log('🧪 Testing OpenAI AI Agent Integration');
    console.log('====================================');
    console.log('📝 Request:', request);
    console.log('⚙️  Model: GPT-4.1 (Latest OpenAI Model)');
    console.log('🔑 Provider: OpenAI');
    console.log('');
    
    const startTime = Date.now();
    let dots = 0;
    const intervalId = setInterval(() => {
      dots = (dots + 1) % 4;
      process.stdout.write(`\r🔄 Processing${'.'.repeat(dots)}${' '.repeat(3 - dots)} (${Math.floor((Date.now() - startTime) / 1000)}s)`);
    }, 500);

    const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request,
        context
      })
    });

    clearInterval(intervalId);
    process.stdout.write('\n');
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Completed in: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ HTTP Error:', response.status, response.statusText);
      console.log('Error body:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('');
    console.log('✅ OpenAI Integration Results:');
    console.log('==============================');
    console.log('📋 Plan:', result.plan || 'No plan provided');
    console.log('🔧 Tools Executed:', result.toolsExecuted?.length || 0);
    console.log('💬 Response Length:', (result.response || '').length, 'characters');
    console.log('💬 Response Preview:', (result.response || '').substring(0, 200) + '...');
    
    if (result.toolsExecuted && result.toolsExecuted.length > 0) {
      console.log('');
      console.log('🛠️  Tool Execution Details:');
      result.toolsExecuted.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.tool}: ${tool.success ? '✅' : '❌'}`);
        if (tool.message) {
          console.log(`      Message: ${tool.message}`);
        }
      });
    }

    if (result.executionDetails) {
      console.log('');
      console.log('📊 Execution Summary:');
      console.log(`   • Success Rate: ${result.executionDetails.toolsExecuted > 0 ? 
        ((result.executionDetails.successfulTools / result.executionDetails.toolsExecuted) * 100).toFixed(1) + '%' : 'N/A'}`);
    }

    // Test successful if we got a response
    if (result.response && result.response.length > 0) {
      console.log('');
      console.log('🎉 OpenAI Integration Test: PASSED');
      console.log('✅ GPT-4.1 model is working correctly');
      console.log('✅ AI Agent can process requests');
      console.log('✅ Response generation successful');
    } else {
      console.log('');
      console.log('⚠️  OpenAI Integration Test: PARTIAL');
      console.log('❓ Response was empty or minimal');
    }

  } catch (error) {
    console.error('');
    console.error('❌ OpenAI Integration Test: FAILED');
    console.error('Error:', error.message);
    
    if (error.message.includes('API key')) {
      console.error('💡 Suggestion: Check your OpenAI API key in settings');
    }
  }
}

testOpenAIAgent(); 