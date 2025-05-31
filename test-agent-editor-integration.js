import fetch from 'node-fetch';

async function testAgentEditorIntegration() {
  const baseUrl = 'http://localhost:5001';
  
  console.log('🧪 TESTING AGENT EDITOR INTEGRATION');
  console.log('====================================');
  console.log('Testing the agent\'s new ability to directly edit and manipulate text in the editor...\n');

  // Test context with current editor state - USING CORRECT MODEL NAME
  const editorContext = {
    currentProject: {
      id: 1,
      name: "Test Project",
      type: "writing"
    },
    currentDocument: {
      id: 1,
      title: "Test Document",
      content: "This is some sample text with spelling mistakes. The weather is beutiful today. I want to go swiming in the lake.",
      wordCount: 20
    },
    editorState: {
      title: "Test Document",
      content: "This is some sample text with spelling mistakes. The weather is beutiful today. I want to go swiming in the lake.",
      hasUnsavedChanges: true,
      wordCount: 20
    },
    llmProvider: 'openai',
    llmModel: 'gpt-4.1-mini', // UPDATED TO CORRECT MODEL NAME
    userId: 1
  };

  const tests = [
    {
      name: "Text Pattern Replacement",
      request: "Find and replace all spelling mistakes in my text. Fix 'beutiful' to 'beautiful' and 'swiming' to 'swimming'",
      expectedTool: "edit_text_with_pattern"
    },
    {
      name: "Content Improvement",
      request: "Improve the writing quality and make it more professional",
      expectedTool: "improve_current_text"
    },
    {
      name: "Complete Content Replacement",
      request: "Rewrite this entire document to be about the benefits of reading books instead",
      expectedTool: "replace_current_content"
    },
    {
      name: "Content Append",
      request: "Add a new paragraph about the importance of outdoor activities at the end",
      expectedTool: "edit_current_document"
    },
    {
      name: "Search and Replace with Regex",
      request: "Replace all instances of 'the' with 'a' in my document",
      expectedTool: "edit_text_with_pattern"
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`🔧 Test ${i + 1}: ${test.name}`);
    console.log(`📝 Request: "${test.request}"`);
    console.log(`🎯 Expected Tool: ${test.expectedTool}`);
    console.log(`🤖 Using Model: ${editorContext.llmModel}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request: test.request,
          context: editorContext
        })
      });

      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}\n`);
        continue;
      }

      const result = await response.json();
      
      console.log(`⏱️  Response Time: ${duration}ms`);
      
      // Log results for each test
      const toolsUsed = result.toolsExecuted || [];
      const toolNames = toolsUsed.map(t => t.tool || 'unknown');
      
      // Check if expected tool was used
      const usedExpected = toolNames.includes(test.expectedTool);
      if (!usedExpected && toolNames.length > 0) {
        console.log(`⚠️  Warning: Did not use expected tool (${test.expectedTool})`);
        console.log(`🎯 Actually used: ${toolNames.join(', ')}`);
      } else if (toolNames.length > 0) {
        console.log(`✅ Used expected tool: ${test.expectedTool}`);
      }
      
      console.log(`🔧 Tools Used: ${toolNames.length > 0 ? toolNames.join(', ') : 'None'}`);
      
      // Show tool details if any were used
      if (toolsUsed.length > 0) {
        console.log(`📊 Tool Results:`);
        toolsUsed.forEach(tool => {
          const status = tool.success ? '✅' : '❌';
          console.log(`  - ${tool.tool || 'unknown'}: ${status} ${tool.message || 'No message'}`);
        });
      }
      
      // Show agent response
      if (result.response) {
        const preview = result.response.length > 150 ? 
          result.response.substring(0, 150) + "..." : 
          result.response;
        console.log(`💬 Agent Response: "${preview}"`);
      }
      
      console.log(`📈 Success Rate: ${result.executionDetails?.successRate || 'N/A'}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('🎉 AGENT EDITOR INTEGRATION TEST COMPLETE');
  console.log('==========================================');
  console.log('The agent now has powerful editor manipulation capabilities!');
}

// Run the test
testAgentEditorIntegration().catch(console.error); 