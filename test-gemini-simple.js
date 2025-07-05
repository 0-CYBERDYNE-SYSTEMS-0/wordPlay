import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function testSimpleImageGeneration() {
  console.log('🧪 Testing Simple Gemini Image Generation');
  console.log('========================================');
  
  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Try very simple, safe prompts
  const testPrompts = [
    "Generate an image of a red apple on a white background",
    "Create a picture of a blue sky with white clouds",
    "Draw a simple landscape with green hills",
    "Make an image of a yellow sun"
  ];
  
  for (const testPrompt of testPrompts) {
    console.log(`\n🔄 Testing prompt: "${testPrompt}"`);
    
    try {
      const model = gemini.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      });

      const response = await model.generateContent(testPrompt);
      
      const candidate = response?.response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      
      console.log(`📊 Response: ${parts.length} parts`);
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part?.inlineData?.mimeType?.startsWith('image/')) {
          console.log(`✅ Found image in part ${i + 1}!`);
          return true;
        } else if (part?.text) {
          console.log(`📝 Text response: ${part.text.substring(0, 100)}...`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🤔 Testing if Gemini 2.0 Flash supports image generation...');
  
  // Check model capabilities
  try {
    const model = gemini.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });
    
    // Try the official way to request image generation
    const imagePrompt = "Please generate an image of a simple red circle.";
    console.log(`🔄 Testing: "${imagePrompt}"`);
    
    const response = await model.generateContent(imagePrompt);
    const text = response.response.candidates[0].content.parts[0].text;
    
    console.log(`📝 Model response: ${text}`);
    
    if (text.includes("I can't generate") || text.includes("I cannot create") || text.includes("I'm not able to")) {
      console.log('❌ Gemini 2.0 Flash does NOT support image generation');
      console.log('💡 The model can only generate text, not images');
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error testing capabilities: ${error.message}`);
  }
  
  return false;
}

testSimpleImageGeneration()
  .then(success => {
    if (success) {
      console.log('\n✅ Image generation works!');
    } else {
      console.log('\n❌ Image generation not working - likely model limitation');
      console.log('💡 Consider using DALL-E or other image generation APIs');
    }
  });