import fetch from 'node-fetch';

async function testMaxCapabilityAgent() {
  const baseUrl = 'http://localhost:5001';
  
  // Complex, multi-step autonomous task that requires extensive tool chaining
  const complexRequest = `I need you to conduct comprehensive research on "AI agent architectures for autonomous systems" and create a complete research document. Please work autonomously to:

1. Research the latest developments in AI agent architectures (2024-2025)
2. Find and analyze at least 3-5 high-quality academic sources
3. Scrape and save all relevant sources to my project
4. Create a new document titled "AI Agent Architectures: A Comprehensive Analysis"
5. Write a detailed introduction explaining the current state of AI agents
6. Create sections covering:
   - Multi-agent systems and collaboration
   - Autonomous planning and execution
   - Tool use and reasoning capabilities
   - Long-horizon task completion
   - Self-reflection and learning mechanisms
7. Include specific examples, statistics, and citations from your research
8. Analyze the writing style and suggest improvements
9. Generate a bibliography of all sources used
10. Provide a comprehensive summary and identify future research directions

Work autonomously without waiting for approval between steps. Use aggressive autonomy level for maximum capability demonstration. Continue working until the task is completely finished.`;

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
    console.log('🚀 MAXIMUM CAPABILITY AUTONOMOUS AI AGENT TEST');
    console.log('==============================================');
    console.log('📋 Task: Comprehensive AI agent research and document creation');
    console.log('🤖 Autonomy Level: AGGRESSIVE (Maximum capability)');
    console.log('⚙️  Model: GPT-4.1-mini (Latest OpenAI Model)');
    console.log('⏱️  Max Execution Time: 10 minutes');
    console.log('🔄 Max Iterations: 50 (Unlimited tool chaining)');
    console.log('');
    console.log('📝 Request Details:');
    console.log('   - Multi-step research task');
    console.log('   - Autonomous tool chaining');
    console.log('   - Self-monitoring and reflection');
    console.log('   - Complete document creation');
    console.log('   - No human approval required');
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
        request: complexRequest,
        context,
        autonomyLevel: 'aggressive', // Maximum autonomy
        maxExecutionTime: 600000 // 10 minutes
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
      
      if (exec.executionLog && exec.executionLog.length > 0) {
        console.log('📋 Execution Timeline:');
        exec.executionLog.forEach((log, index) => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          console.log(`   ${index + 1}. [${timestamp}] ${log.phase.toUpperCase()}: ${log.action}`);
          if (log.toolsExecuted && log.toolsExecuted.length > 0) {
            console.log(`      🛠️  Tools: ${log.toolsExecuted.join(', ')}`);
            console.log(`      ✅ Success: ${log.successfulTools}/${log.successfulTools + log.failedTools}`);
          }
          if (log.reasoning) {
            console.log(`      💭 Reasoning: ${log.reasoning}`);
          }
        });
        console.log('');
      }
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
      console.log(`   ⏱️  Average Tool Time: ${details.averageToolTime}`);
      console.log('');
    }
    
    // Performance metrics
    if (result.performance) {
      const perf = result.performance;
      console.log('📊 Performance Metrics:');
      console.log(`   ⏱️  Total Duration: ${perf.totalDuration}ms`);
      console.log(`   🔄 Iterations Completed: ${perf.iterationsCompleted}/${perf.maxIterationsAllowed}`);
      console.log(`   ⚡ Execution Efficiency: ${perf.executionEfficiency}`);
      console.log(`   🎚️  Autonomy Level: ${perf.autonomyLevel.toUpperCase()}`);
      console.log('');
    }
    
    // Tool execution details
    if (result.toolsExecuted && result.toolsExecuted.length > 0) {
      console.log('🛠️  Detailed Tool Execution Log:');
      result.toolsExecuted.forEach((tool, index) => {
        const status = tool.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${tool.tool}`);
        console.log(`      📝 Message: ${tool.message}`);
        if (tool.reasoning) {
          console.log(`      💭 Reasoning: ${tool.reasoning}`);
        }
      });
      console.log('');
    }
    
    // Agent response and insights
    console.log('💬 Agent Response:');
    console.log('==================');
    console.log(result.response || 'No response provided');
    console.log('');
    
    // Suggested next actions
    if (result.suggestedActions && result.suggestedActions.length > 0) {
      console.log('💡 Suggested Next Actions:');
      result.suggestedActions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action}`);
      });
      console.log('');
    }
    
    // Success analysis
    const successRate = result.executionDetails ? 
      parseFloat(result.executionDetails.successRate) : 0;
    
    console.log('🎯 AUTONOMOUS CAPABILITY ASSESSMENT');
    console.log('===================================');
    
    if (successRate >= 80) {
      console.log('🏆 EXCELLENT: Agent demonstrated high autonomous capability');
      console.log('   ✅ Successfully executed complex multi-step workflow');
      console.log('   ✅ Effective tool chaining and self-monitoring');
      console.log('   ✅ High success rate with minimal failures');
    } else if (successRate >= 60) {
      console.log('✅ GOOD: Agent showed solid autonomous performance');
      console.log('   ✅ Completed most planned actions successfully');
      console.log('   ⚠️  Some tool failures but maintained progress');
    } else if (successRate >= 40) {
      console.log('⚠️  MODERATE: Agent attempted autonomous execution');
      console.log('   ⚠️  Mixed success with several tool failures');
      console.log('   💡 May need autonomy level adjustment');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: Low autonomous success rate');
      console.log('   ❌ Multiple tool failures affected performance');
      console.log('   💡 Consider conservative autonomy level');
    }
    
    console.log('');
    console.log('📈 CAPABILITY METRICS:');
    console.log(`   🎯 Task Completion: ${result.autonomousExecution?.completed ? 'COMPLETED' : 'PARTIAL'}`);
    console.log(`   🔄 Autonomous Iterations: ${result.autonomousExecution?.iterations || 0}`);
    console.log(`   ⚡ Tool Chain Length: ${result.executionDetails?.toolsExecuted || 0}`);
    console.log(`   📊 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   ⏱️  Execution Speed: ${((result.executionDetails?.toolsExecuted || 1) / (duration / 1000)).toFixed(1)} tools/second`);
    
    // Long-horizon capability assessment
    const iterations = result.autonomousExecution?.iterations || 0;
    const toolsExecuted = result.executionDetails?.toolsExecuted || 0;
    
    console.log('');
    console.log('🌟 LONG-HORIZON TASK CAPABILITY:');
    if (iterations >= 10 && toolsExecuted >= 20) {
      console.log('   🏆 ADVANCED: Demonstrated long-horizon autonomous execution');
      console.log('   ✅ Multiple autonomous iterations with tool chaining');
      console.log('   ✅ Self-monitoring and adaptive planning');
    } else if (iterations >= 5 && toolsExecuted >= 10) {
      console.log('   ✅ INTERMEDIATE: Good multi-step autonomous capability');
      console.log('   ✅ Effective tool chaining and execution');
    } else {
      console.log('   ⚠️  BASIC: Limited autonomous execution demonstrated');
      console.log('   💡 May need more complex tasks to show full capability');
    }
    
    console.log('');
    console.log('🎉 MAXIMUM CAPABILITY TEST COMPLETED');
    console.log('====================================');
    console.log(`✅ Test Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log(`🤖 Autonomy Level: ${result.performance?.autonomyLevel?.toUpperCase() || 'AGGRESSIVE'}`);
    console.log(`📊 Overall Success: ${successRate >= 70 ? 'HIGH' : successRate >= 50 ? 'MODERATE' : 'NEEDS IMPROVEMENT'}`);
    
  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('==============');
    console.error('Error:', error.message);
    console.error('');
    console.error('This could indicate:');
    console.error('   - Server connection issues');
    console.error('   - Agent configuration problems');
    console.error('   - Model availability issues');
    console.error('   - Timeout or resource constraints');
  }
}

// Run the test
console.log('🧪 Starting Maximum Capability Autonomous AI Agent Test...');
console.log('');
testMaxCapabilityAgent(); 