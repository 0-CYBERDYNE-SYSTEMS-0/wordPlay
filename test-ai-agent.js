import fetch from 'node-fetch';

async function testAIAgent() {
  const baseUrl = 'http://localhost:5001';
  
  // Comprehensive multi-step request to test autonomous capabilities
  const request = `I need you to research sustainable writing practices and productivity techniques, then create a new document in my project about this topic. Please:

1. Search the web for recent research on sustainable writing practices and productivity techniques for writers
2. Find and scrape at least 2 high-quality sources with actionable insights
3. Save these sources to my project for reference
4. Create a new document titled "Sustainable Writing Practices: A Research-Based Guide"
5. Write the first two paragraphs of this document based on your research findings
6. Include specific techniques and statistics from your research
7. Analyze the writing style and suggest improvements
8. Provide a summary of what you accomplished and suggest next steps

This should test your ability to chain multiple tools autonomously and synthesize information intelligently. Use the qwen3:4b model for all operations.`;

  const context = {
    currentProject: {
      id: 1,
      name: "Test Project",
      type: "research"
    },
    currentDocument: {
      id: 1,
      title: "Current Document",
      content: "This is a test document for AI agent capabilities.",
      wordCount: 10
    },
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    userId: 1
  };

  try {
    console.log('🤖 Sending comprehensive multi-step request to AI agent...');
    console.log('📝 Request length:', request.length, 'characters');
    console.log('⚙️  Using model: GPT-4o-mini via OpenAI (Valid Model)');
    console.log('🌐 Target URL:', `${baseUrl}/api/agent/intelligent-request`);
    console.log('📦 Context:', JSON.stringify(context, null, 2));
    console.log('');
    console.log('⏱️  Starting request at:', new Date().toISOString());
    
    const startTime = Date.now();
    let intervalId;
    
    // Progress indicator
    let dots = 0;
    intervalId = setInterval(() => {
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
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('⏱️  Request completed at:', new Date().toISOString());
    console.log('⏱️  Total duration:', `${duration}ms (${(duration / 1000).toFixed(1)}s)`);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ HTTP Error Details:');
      console.log('   Status:', response.status);
      console.log('   Status Text:', response.statusText);
      console.log('   Headers:', Object.fromEntries(response.headers.entries()));
      console.log('   Body:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    console.log('✅ Response received successfully');
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    
    console.log('');
    console.log('🎯 AI Agent Response Analysis:');
    console.log('================================');
    console.log('📋 Plan:', result.plan || 'No plan provided');
    console.log('📋 Plan length:', (result.plan || '').length, 'characters');
    console.log('');
    
    console.log('🔧 Tools Execution Summary:');
    console.log('   Tools Executed:', result.toolsExecuted?.length || 0);
    if (result.toolsExecuted && result.toolsExecuted.length > 0) {
      result.toolsExecuted.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.tool}:`);
        console.log(`      Success: ${tool.success ? '✅' : '❌'}`);
        console.log(`      Message: ${tool.message || 'No message'}`);
        if (!tool.success) {
          console.log(`      Error: ${tool.error || 'Unknown error'}`);
        }
      });
    } else {
      console.log('   ⚠️  No tools were executed');
    }
    console.log('');
    
    console.log('💬 Agent Response:');
    console.log('   Length:', (result.response || '').length, 'characters');
    console.log('   Content:', result.response || 'No response provided');
    console.log('');
    
    if (result.suggestedActions && result.suggestedActions.length > 0) {
      console.log('💡 Suggested Next Steps:');
      result.suggestedActions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action}`);
      });
      console.log('');
    }
    
    if (result.executionDetails) {
      console.log('📊 Detailed Execution Summary:');
      console.log(`   • Tools Planned: ${result.executionDetails.toolsPlanned}`);
      console.log(`   • Tools Executed: ${result.executionDetails.toolsExecuted}`);
      console.log(`   • Successful: ${result.executionDetails.successfulTools}`);
      console.log(`   • Failed: ${result.executionDetails.failedTools}`);
      console.log(`   • Success Rate: ${result.executionDetails.toolsExecuted > 0 ? 
        ((result.executionDetails.successfulTools / result.executionDetails.toolsExecuted) * 100).toFixed(1) + '%' : 'N/A'}`);
      console.log('');
    }
    
    if (result.additionalToolCalls && result.additionalToolCalls.length > 0) {
      console.log('🔄 Additional Tool Calls Suggested:');
      result.additionalToolCalls.forEach((toolCall, index) => {
        console.log(`   ${index + 1}. ${toolCall.tool}:`);
        console.log(`      Reasoning: ${toolCall.reasoning}`);
        console.log(`      Parameters: ${JSON.stringify(toolCall.params, null, 6)}`);
      });
      console.log('');
    }
    
    // Analysis of why tools might not have been executed
    if (!result.toolsExecuted || result.toolsExecuted.length === 0) {
      console.log('🔍 Analysis - Why No Tools Were Executed:');
      console.log('   Possible reasons:');
      console.log('   1. Model failed to generate proper JSON format');
      console.log('   2. Model response was parsed as fallback');
      console.log('   3. Tool planning logic needs adjustment');
      console.log('   4. Model needs different prompting approach');
      console.log('');
      
      if (result.plan && result.plan.includes('Analyzing request contextually')) {
        console.log('   🎯 Detected: Fallback response triggered');
        console.log('   💡 Suggestion: Model likely failed JSON parsing');
      }
    }

  } catch (error) {
    console.error('');
    console.error('❌ Error testing AI agent:');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Stack trace:', error.stack);
    
    if (error.code) {
      console.error('   Error code:', error.code);
    }
  }
}

// Run the test
console.log('🚀 Starting AI Agent Test Suite');
console.log('================================');
testAIAgent(); 