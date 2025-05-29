import fetch from 'node-fetch';

async function testSimpleAgent() {
  const baseUrl = 'http://localhost:5001';
  
  // Simple request to test basic functionality
  const request = `Search the web for "writing productivity tips" and show me the results.`;

  const context = {
    currentProject: {
      id: 1,
      name: "Test Project",
      type: "research"
    },
    llmProvider: 'ollama',
    llmModel: 'qwen3:4b',
    userId: 1
  };

  try {
    console.log('🧪 Testing Simple AI Agent Request');
    console.log('==================================');
    console.log('📝 Request:', request);
    console.log('⚙️  Model: qwen3:4b');
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
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('');
    console.log('✅ Results:');
    console.log('📋 Plan:', result.plan);
    console.log('🔧 Tools Executed:', result.toolsExecuted?.length || 0);
    console.log('💬 Response:', result.response);
    
    if (result.toolsExecuted && result.toolsExecuted.length > 0) {
      console.log('');
      console.log('🛠️  Tool Details:');
      result.toolsExecuted.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.tool}: ${tool.success ? '✅' : '❌'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleAgent(); 