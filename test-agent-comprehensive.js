#!/usr/bin/env node

console.log('🧪 Starting Comprehensive Agent Tests...');

const baseUrl = 'http://localhost:5001';

// Test context that mimics the UI
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

const tests = [
  {
    name: "Check Agent Tools Availability",
    endpoint: "/api/agent/tools",
    method: "GET"
  },
  {
    name: "Test Project Creation Tool",
    endpoint: "/api/agent/tool",
    method: "POST",
    body: {
      toolName: "create_project",
      parameters: {
        name: "Agent Test Project",
        type: "blog",
        style: "professional"
      },
      context: testContext
    }
  },
  {
    name: "Test Document Creation Tool", 
    endpoint: "/api/agent/tool",
    method: "POST",
    body: {
      toolName: "create_document",
      parameters: {
        projectId: 1,
        title: "Agent Test Document",
        content: "This is a test document created by the agent."
      },
      context: testContext
    }
  },
  {
    name: "Test Multi-Step Agent Request",
    endpoint: "/api/agent/intelligent-request",
    method: "POST",
    body: {
      request: "Create a new project called 'Blog Strategy' and then create a document called 'Content Outline' with a simple outline for a blog post about AI writing tools.",
      context: testContext,
      autonomyLevel: 'moderate'
    }
  },
  {
    name: "Test Project List Tool",
    endpoint: "/api/agent/tool", 
    method: "POST",
    body: {
      toolName: "list_projects",
      parameters: {},
      context: testContext
    }
  }
];

async function runTest(test, index) {
  console.log(`\n🔬 Test ${index + 1}: ${test.name}`);
  console.log(`📡 ${test.method} ${test.endpoint}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}${test.endpoint}`, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: test.body ? JSON.stringify(test.body) : undefined
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`🔍 Error Details: ${errorText.substring(0, 500)}...`);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Success (${duration}ms)`);
    
    // Log relevant details based on test type
    if (test.name.includes("Tools Availability")) {
      console.log(`🛠️  Available Tools: ${result.tools?.length || 0}`);
      if (result.tools) {
        console.log(`📋 Key Tools: ${result.tools.slice(0, 5).join(', ')}...`);
      }
    } else if (test.name.includes("Tool")) {
      console.log(`📊 Tool Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`💬 Message: ${result.message || 'No message'}`);
      if (result.data) {
        console.log(`📄 Data Keys: ${Object.keys(result.data).join(', ')}`);
      }
      if (!result.success && result.error) {
        console.log(`🚨 Error: ${result.error}`);
      }
    } else if (test.name.includes("Multi-Step")) {
      console.log(`📝 Response Length: ${result.response?.length || 0} chars`);
      console.log(`🛠️  Tools Executed: ${result.toolsExecuted?.length || 0}`);
      if (result.suggestedActions) {
        console.log(`💡 Suggestions: ${result.suggestedActions.length}`);
      }
      if (result.toolsExecuted) {
        console.log(`🔧 Tool Results:`);
        result.toolsExecuted.forEach((tool, i) => {
          console.log(`   ${i + 1}. ${tool.tool || 'Unknown'}: ${tool.success ? '✅' : '❌'}`);
          if (!tool.success && tool.error) {
            console.log(`      Error: ${tool.error.substring(0, 100)}...`);
          }
        });
      }
    }
    
    return true;
  } catch (error) {
    console.log(`💥 Request Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  // Wait for server to be ready
  console.log('⏳ Waiting for server...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < tests.length; i++) {
    const success = await runTest(tests[i], i);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Wait between tests
    if (i < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed > 0) {
    console.log(`\n⚠️  Issues detected! Check the logs above for details.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All tests passed! Agent is working correctly.`);
  }
}

main().catch(console.error); 