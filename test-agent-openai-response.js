#!/usr/bin/env node

console.log('🔍 Testing Agent OpenAI Response Structure...');

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

async function testAgentRawResponse() {
  console.log('🧪 Testing Raw Agent Response...');
  
  try {
    const response = await fetch(`${baseUrl}/api/agent/intelligent-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: "Create a new project called 'Test Blog Project' with type 'blog' and style 'professional', then create a document called 'My First Post' with content about writing tips.",
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
    
    console.log(`\n📋 FULL RESPONSE STRUCTURE:`);
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log(`💥 Request Failed: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

async function main() {
  console.log('⏳ Waiting for server...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testAgentRawResponse();
}

main().catch(console.error); 