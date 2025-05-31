#!/usr/bin/env node

console.log('🔍 Testing Raw OpenAI Tool Parameters...');

import { OpenAI } from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key" 
});

async function testRawOpenAI() {
  console.log('🧪 Testing Direct OpenAI Function Calling...');
  
  try {
    const response = await openai.beta.chat.completions.parse({
      model: 'gpt-4o',
      messages: [
        { 
          role: "system", 
          content: `You are an AI assistant with access to project and document tools.

CRITICAL TOOL PARAMETER REQUIREMENTS:
- create_project REQUIRES: name (string), type (string), style (string) - ALL REQUIRED
- create_document REQUIRES: projectId (number), title (string) - content is optional
- When chaining create_project → create_document: use null for projectId (auto-filled from previous project)

TOOL SELECTION RULES:
- "Create a project" = use create_project tool
- "Create a document" = use create_document tool (NOT generate_text)

Available tools:
- create_project: Create a new project
- create_document: Create a new document in a project` 
        },
        { 
          role: "user", 
          content: `Create a project called "Test Project" with type "blog" and style "professional". Then create a document called "My Document" with content "Hello world".` 
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_response",
          schema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "A detailed response to the user's request"
              },
              reasoning: {
                type: "string",
                description: "Your thought process and reasoning"
              },
              tools_to_use: {
                type: "array",
                description: "Tools to execute to help answer the user's request",
                items: {
                  type: "object",
                  properties: {
                    tool_name: { 
                      type: "string",
                      description: "Name of the tool to use"
                    },
                    parameters: { 
                      type: "object",
                      description: "Parameters for the tool"
                    },
                    reasoning: { 
                      type: "string",
                      description: "Why this tool is needed"
                    }
                  },
                  required: ["tool_name", "parameters", "reasoning"]
                }
              }
            },
            required: ["content", "reasoning"]
          }
        }
      },
      temperature: 0.3,
      max_tokens: 1000
    });

    const parsedResponse = response.choices[0].message.parsed;
    
    console.log('\n📋 RAW OPENAI RESPONSE:');
    console.log(JSON.stringify(parsedResponse, null, 2));
    
    if (parsedResponse.tools_to_use) {
      console.log('\n🔧 TOOL ANALYSIS:');
      parsedResponse.tools_to_use.forEach((tool, i) => {
        console.log(`\nTool ${i + 1}: ${tool.tool_name}`);
        console.log(`Parameters:`, JSON.stringify(tool.parameters, null, 2));
        console.log(`Reasoning: ${tool.reasoning}`);
        
        // Check for missing required parameters
        if (tool.tool_name === 'create_project') {
          const required = ['name', 'type', 'style'];
          const missing = required.filter(param => !tool.parameters[param]);
          if (missing.length > 0) {
            console.log(`❌ MISSING REQUIRED: ${missing.join(', ')}`);
          } else {
            console.log(`✅ All required parameters present`);
          }
        }
        
        if (tool.tool_name === 'create_document') {
          const required = ['title'];
          const missing = required.filter(param => !tool.parameters[param]);
          if (missing.length > 0) {
            console.log(`❌ MISSING REQUIRED: ${missing.join(', ')}`);
          } else {
            console.log(`✅ Required parameters present`);
          }
          
          if (!tool.parameters.hasOwnProperty('projectId')) {
            console.log(`⚠️  projectId parameter completely missing - this is where chaining should help`);
          } else if (tool.parameters.projectId === null) {
            console.log(`✅ projectId set to null - ready for chaining`);
          } else {
            console.log(`🔍 projectId value: ${tool.parameters.projectId}`);
          }
        }
      });
    }
    
  } catch (error) {
    console.log(`💥 OpenAI Test Failed: ${error.message}`);
  }
}

testRawOpenAI(); 