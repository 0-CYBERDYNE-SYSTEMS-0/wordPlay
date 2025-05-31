#!/usr/bin/env node

console.log('🔍 Debugging Agent Multi-Step Issues...');

const baseUrl = 'http://localhost:5001';

const testContext = {
  currentProject: { id: 1, name: "Test Project" },
  currentDocument: { id: 1, title: "Test Document", content: "This is test content." },
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  userId: 1,
  editorState: {
    title: "Test Document",
    content: "This is test content for agent testing.",
    hasUnsavedChanges: false,
    wordCount: 8
  }
};

async function testMultiStepWithFullLogging() {
  console.log('🧪 Testing Multi-Step Agent with Full Error Logging...');
  
  try {
    const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: "Create a new project called 'Debug Test Project' and then create a document called 'Debug Document' with some sample content about testing.",
        context: testContext,
        autonomyLevel: 'moderate'
      })
    });

    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`🔍 Full Error: ${errorText}`);
      return;
    }

    const result = await response.json();
    
    console.log(`📝 Agent Response: ${result.response}`);
    console.log(`🛠️  Tools Executed: ${result.toolsExecuted?.length || 0}`);
    
    if (result.toolsExecuted) {
      console.log(`\n🔧 Detailed Tool Results:`);
      result.toolsExecuted.forEach((tool, i) => {
        console.log(`\n--- Tool ${i + 1}: ${tool.tool || 'Unknown'} ---`);
        console.log(`Status: ${tool.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`Message: ${tool.message || 'No message'}`);
        
        if (tool.data) {
          console.log(`Data: ${JSON.stringify(tool.data, null, 2)}`);
        }
        
        if (tool.error) {
          console.log(`❌ Error: ${tool.error}`);
        }
        
        if (tool.executionTime) {
          console.log(`⏱️  Execution Time: ${tool.executionTime}ms`);
        }
      });
    }
    
    if (result.suggestedActions) {
      console.log(`\n💡 Suggested Actions:`);
      result.suggestedActions.forEach((action, i) => {
        console.log(`   ${i + 1}. ${action}`);
      });
    }
    
    if (result.additionalToolCalls) {
      console.log(`\n🔄 Additional Tool Calls Suggested: ${result.additionalToolCalls.length}`);
    }
    
  } catch (error) {
    console.log(`💥 Request Failed: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

async function testIndividualProjectCreation() {
  console.log('\n🧪 Testing Individual Project Creation...');
  
  try {
    const response = await fetch(`${baseUrl}/api/agent/tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName: "create_project",
        parameters: {
          name: "Debug Individual Project",
          type: "blog",
          style: "professional"
        },
        context: testContext
      })
    });

    const result = await response.json();
    console.log(`Result: ${JSON.stringify(result, null, 2)}`);
    
  } catch (error) {
    console.log(`💥 Individual test failed: ${error.message}`);
  }
}

async function main() {
  console.log('⏳ Waiting for server...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testIndividualProjectCreation();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testMultiStepWithFullLogging();
}

main().catch(console.error); 