import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGeminiImageGeneration() {
  console.log('🧪 Testing Gemini Image Generation Pipeline');
  console.log('==========================================');
  
  // Check API key
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log('🔑 Gemini API Key present:', !!geminiKey);
  console.log('🔑 API Key length:', geminiKey ? geminiKey.length : 0);
  
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    return;
  }
  
  // Initialize Gemini client
  const gemini = new GoogleGenerativeAI(geminiKey);
  console.log('✅ Gemini client initialized');
  
  // Test image generation
  const testPrompt = `Create a simple, beautiful image of a sunset over mountains. Use warm colors like orange, pink, and purple. Make it artistic and serene.`;
  
  try {
    console.log('📝 Test prompt:', testPrompt);
    console.log('🔄 Sending request to Gemini 2.0 Flash...');
    
    const model = gemini.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    const response = await model.generateContent(testPrompt);
    
    console.log('📨 Raw response received');
    console.log('📊 Response structure:');
    console.log('   - response exists:', !!response?.response);
    console.log('   - candidates exist:', !!response?.response?.candidates);
    console.log('   - candidates length:', response?.response?.candidates?.length || 0);
    
    if (response?.response?.candidates?.[0]) {
      const candidate = response.response.candidates[0];
      console.log('📋 Candidate content:');
      console.log('   - content exists:', !!candidate.content);
      console.log('   - parts exist:', !!candidate?.content?.parts);
      console.log('   - parts length:', candidate?.content?.parts?.length || 0);
      
      if (candidate?.content?.parts) {
        console.log('🔍 Examining parts...');
        for (let i = 0; i < candidate.content.parts.length; i++) {
          const part = candidate.content.parts[i];
          console.log(`   Part ${i + 1}:`);
          console.log('     - inlineData exists:', !!part?.inlineData);
          console.log('     - mimeType:', part?.inlineData?.mimeType || 'none');
          console.log('     - data exists:', !!part?.inlineData?.data);
          console.log('     - data length:', part?.inlineData?.data?.length || 0);
          console.log('     - text exists:', !!part?.text);
          
          if (part?.text) {
            console.log('     - text content (first 100 chars):', part.text.substring(0, 100));
          }
          
          if (part?.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
            console.log('🖼️  Found image data!');
            try {
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              console.log(`   Image size: ${Math.round(imageBuffer.length / 1024)}KB`);
              
              // Save test image
              const fileName = `test-gemini-image-${Date.now()}.${part.inlineData.mimeType.split('/')[1]}`;
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
                console.log('📁 Created uploads directory');
              }
              
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, imageBuffer);
              
              console.log(`✅ Test image saved: ${fileName}`);
              console.log(`📂 Full path: ${filePath}`);
              
              return {
                success: true,
                filename: fileName,
                size: imageBuffer.length,
                path: filePath
              };
            } catch (saveError) {
              console.error('❌ Error saving image:', saveError.message);
            }
          }
        }
      }
    }
    
    console.log('❌ No image data found in response');
    console.log('🔍 Full response structure for debugging:');
    console.log(JSON.stringify(response, null, 2));
    
    return { success: false, error: 'No image data found in Gemini response' };
    
  } catch (error) {
    console.error('❌ Error during image generation:', error.message);
    console.error('🔍 Error details:', error);
    
    if (error.message?.includes('API_KEY_INVALID')) {
      console.error('💡 Suggestion: Check your Gemini API key is valid');
    } else if (error.message?.includes('quota')) {
      console.error('💡 Suggestion: You may have exceeded your API quota');
    } else if (error.message?.includes('PERMISSION_DENIED')) {
      console.error('💡 Suggestion: Your API key may not have image generation permissions');
    }
    
    return { success: false, error: error.message };
  }
}

// Run the test
testGeminiImageGeneration()
  .then(result => {
    console.log('🏁 Test completed');
    console.log('📊 Result:', result);
  })
  .catch(error => {
    console.error('💥 Test failed with error:', error);
  });