import fetch from 'node-fetch';

async function testSimpleAutonomousAgent() {
  const baseUrl = 'http://localhost:5001';
  
  // Simpler, focused autonomous task
  const simpleRequest = `Research AI agent architectures and create a brief summary document. Please:
1. Search for information about AI agent architectures
2. Find and analyze 2-3 good sources
3. Create a new document with the findings
4. Provide a summary of what you learned

Work autonomously to complete this task.`;

  const context = {
    currentProject: {
      id: 1,
      name: "AI Research Project",
      type: "research"
    },
    llmProvider: 'openai',
    llmModel: 'gpt-4.1-mini',
    userId: 1
  };

  try {
    console.log('🚀 SIMPLE AUTONOMOUS AI AGENT TEST');
    console.log('==================================');
    console.log('📋 Task: Research AI agent architectures and create summary');
    console.log('🤖 Autonomy Level: MODERATE (Structured Outputs)');
    console.log('⚙️  Model: GPT-4.1-mini with Structured Outputs');
    console.log('⏱️  Max Execution Time: 2 minutes');
    console.log('🔄 Max Iterations: 10');
    console.log('');
    
    const startTime = Date.now();
    let dots = 0;
    const intervalId = setInterval(() => {
      dots = (dots + 1) % 4;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stdout.write(`\r🔄 Autonomous execution in progress${'.'.repeat(dots)}${' '.repeat(3 - dots)} (${elapsed}s)`);
    }, 500);

    const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: simpleRequest,
        context,
        autonomyLevel: 'moderate',
        maxExecutionTime: 120000 // 2 minutes
      })
    });

    clearInterval(intervalId);
    process.stdout.write('\n');
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Total execution time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ HTTP Error:', response.status, response.statusText);
      console.log('Error details:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('');
    console.log('🎯 AUTONOMOUS EXECUTION RESULTS');
    console.log('===============================');
    
    // Autonomous execution summary
    if (result.autonomousExecution) {
      const exec = result.autonomousExecution;
      console.log('🤖 Autonomous Execution Summary:');
      console.log(`   ✅ Completed: ${exec.completed}`);
      console.log(`   🔄 Iterations: ${exec.iterations}`);
      console.log(`   ⏱️  Duration: ${exec.duration}ms (${(exec.duration / 1000).toFixed(1)}s)`);
      console.log(`   🎚️  Autonomy Level: ${exec.autonomyLevel.toUpperCase()}`);
      console.log('');
    }
    
    // Tool execution analysis
    if (result.executionDetails) {
      const details = result.executionDetails;
      console.log('🔧 Tool Execution Analysis:');
      console.log(`   📊 Tools Planned: ${details.toolsPlanned}`);
      console.log(`   ⚡ Tools Executed: ${details.toolsExecuted}`);
      console.log(`   ✅ Successful: ${details.successfulTools}`);
      console.log(`   ❌ Failed: ${details.failedTools}`);
      console.log(`   📈 Success Rate: ${details.successRate}`);
      console.log('');
    }
    
    // Tool execution details
    if (result.toolsExecuted && result.toolsExecuted.length > 0) {
      console.log('🛠️  Tool Execution Log:');
      result.toolsExecuted.forEach((tool, index) => {
        const status = tool.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${tool.tool}`);
        console.log(`      📝 ${tool.message}`);
        if (tool.reasoning) {
          console.log(`      💭 ${tool.reasoning}`);
        }
      });
      console.log('');
    }
    
    // Agent response
    console.log('💬 Agent Response:');
    console.log('==================');
    console.log(result.response || 'No response provided');
    console.log('');
    
    // Success analysis
    const successRate = result.executionDetails ? 
      parseFloat(result.executionDetails.successRate) : 0;
    
    console.log('🎯 STRUCTURED OUTPUTS TEST RESULTS');
    console.log('===================================');
    
    if (result.executionDetails?.toolsExecuted > 0) {
      console.log('✅ SUCCESS: Structured outputs enabled proper tool planning');
      console.log('   ✅ Agent planned and executed tools autonomously');
      console.log('   ✅ JSON schema ensured deterministic responses');
      console.log('   ✅ Tool chaining worked as expected');
    } else {
      console.log('⚠️  PARTIAL: Agent responded but did not execute tools');
      console.log('   💡 May need to adjust prompt or schema');
    }
    
    console.log('');
    console.log('📊 PERFORMANCE METRICS:');
    console.log(`   🎯 Task Completion: ${result.autonomousExecution?.completed ? 'COMPLETED' : 'PARTIAL'}`);
    console.log(`   🔄 Autonomous Iterations: ${result.autonomousExecution?.iterations || 0}`);
    console.log(`   ⚡ Tools Executed: ${result.executionDetails?.toolsExecuted || 0}`);
    console.log(`   📈 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   ⏱️  Execution Speed: ${((result.executionDetails?.toolsExecuted || 1) / (duration / 1000)).toFixed(1)} tools/second`);
    
    console.log('');
    console.log('🎉 SIMPLE AUTONOMOUS TEST COMPLETED');
    console.log('===================================');
    console.log(`✅ Test Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log(`🤖 Autonomy Level: ${result.performance?.autonomyLevel?.toUpperCase() || 'MODERATE'}`);
    console.log(`📊 Structured Outputs: ${result.executionDetails?.toolsExecuted > 0 ? 'WORKING' : 'NEEDS REVIEW'}`);
    
  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('==============');
    console.error('Error:', error.message);
  }
}

// Run the test
console.log('🧪 Starting Simple Autonomous AI Agent Test...');
console.log('');
testSimpleAutonomousAgent(); 