#!/usr/bin/env node

console.log('🔧 Testing Agent Tool Chaining Fix...');

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

async function testToolChaining() {
  console.log('🧪 Testing Tool Chaining with Very Specific Request...');
  
  try {
    const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: `Create a project with name "Chaining Test", type "blog", and style "professional". Then create a document titled "Test Document" in that project with content "This is a test of tool chaining."`,
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
    
    console.log(`📝 Agent Response: ${result.response?.substring(0, 200)}...`);
    console.log(`🛠️  Tools Executed: ${result.toolsExecuted?.length || 0}`);
    
    if (result.toolsExecuted) {
      console.log(`\n🔧 Tool Results Analysis:`);
      
      let projectCreated = false;
      let documentCreated = false;
      let projectId = null;
      
      result.toolsExecuted.forEach((tool, i) => {
        console.log(`\n--- Tool ${i + 1}: ${tool.tool || 'Unknown'} ---`);
        console.log(`Status: ${tool.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`Message: ${tool.message || 'No message'}`);
        
        if (tool.success && tool.data) {
          if (tool.tool === 'create_project') {
            projectCreated = true;
            projectId = tool.data.id;
            console.log(`🆔 Project Created with ID: ${projectId}`);
            console.log(`📋 Project Details:`, JSON.stringify(tool.data, null, 2));
          }
          
          if (tool.tool === 'create_document') {
            documentCreated = true;
            console.log(`📄 Document Created in Project: ${tool.data.projectId}`);
            console.log(`📋 Document Details:`, JSON.stringify(tool.data, null, 2));
            
            // Check if document was created in the right project
            if (projectId && tool.data.projectId === projectId) {
              console.log(`✅ CHAINING SUCCESS: Document created in correct project!`);
            } else {
              console.log(`❌ CHAINING FAILED: Document not linked to created project`);
              console.log(`   Expected projectId: ${projectId}, Got: ${tool.data.projectId}`);
            }
          }
        }
        
        if (!tool.success && tool.error) {
          console.log(`❌ Error: ${tool.error}`);
        }
      });
      
      // Summary
      console.log(`\n📊 CHAINING TEST SUMMARY:`);
      console.log(`Project Created: ${projectCreated ? '✅' : '❌'}`);
      console.log(`Document Created: ${documentCreated ? '✅' : '❌'}`);
      
      if (projectCreated && documentCreated) {
        console.log(`🎉 TOOL CHAINING WORKING!`);
      } else {
        console.log(`⚠️  Tool chaining needs more work`);
      }
    }
    
  } catch (error) {
    console.log(`💥 Request Failed: ${error.message}`);
  }
}

async function main() {
  console.log('⏳ Waiting for server...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testToolChaining();
}

main().catch(console.error); 