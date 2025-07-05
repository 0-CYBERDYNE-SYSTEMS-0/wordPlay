import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function testFixedGeminiImageGeneration() {
  console.log('🧪 Testing FIXED Gemini Image Generation');
  console.log('=====================================');
  
  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Try different model names and configurations
  const modelVariants = [
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash'
  ];
  
  const testPrompt = "Create a simple image of a red apple on a white background.";
  
  for (const modelName of modelVariants) {
    console.log(`\n🔄 Testing model: ${modelName}`);
    
    try {
      const model = gemini.getGenerativeModel({ 
        model: modelName
      });
      
      // Method 1: Try with generation config
      console.log('   Method 1: Using generationConfig...');
      try {
        const response1 = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
          generationConfig: {
            responseMimeType: "image/png",
          }
        });
        
        console.log('   ✅ Method 1 response received');
        await processResponse(response1, 'method1');
      } catch (e) {
        console.log(`   ❌ Method 1 failed: ${e.message}`);
      }
      
      // Method 2: Try with explicit image request
      console.log('   Method 2: Explicit image request...');
      try {
        const imageRequest = `Generate and return an image (not describe): ${testPrompt}`;
        const response2 = await model.generateContent(imageRequest);
        
        console.log('   ✅ Method 2 response received');
        await processResponse(response2, 'method2');
      } catch (e) {
        console.log(`   ❌ Method 2 failed: ${e.message}`);
      }
      
      // Method 3: Try with different prompt format
      console.log('   Method 3: Multi-modal prompt...');
      try {
        const multiModalPrompt = `I need you to generate an actual image file, not describe an image. Create a visual representation of: ${testPrompt}`;
        const response3 = await model.generateContent(multiModalPrompt);
        
        console.log('   ✅ Method 3 response received');
        await processResponse(response3, 'method3');
      } catch (e) {
        console.log(`   ❌ Method 3 failed: ${e.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Model ${modelName} failed: ${error.message}`);
    }
  }
  
  // Test if we need the newer @google/genai SDK
  console.log('\n🔍 Testing if we need newer @google/genai SDK...');
  try {
    // This would require: npm install @google/genai
    const { GoogleGenAI } = await import('@google/genai').catch(() => null);
    if (GoogleGenAI) {
      console.log('✅ @google/genai SDK is available');
      // Test with newer SDK...
    } else {
      console.log('❌ @google/genai SDK not installed - this might be the issue!');
      console.log('💡 Try: npm install @google/genai');
    }
  } catch (e) {
    console.log('❌ Cannot test @google/genai:', e.message);
  }
}

async function processResponse(response, method) {
  const candidate = response?.response?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  
  console.log(`     📊 ${method}: ${parts.length} parts received`);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part?.inlineData?.mimeType?.startsWith('image/')) {
      console.log(`     🖼️  Found image in part ${i + 1}!`);
      console.log(`     📏 Image size: ${Math.round(part.inlineData.data.length / 1024)}KB`);
      
      // Save the image
      try {
        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
        const fileName = `fixed-gemini-${method}-${Date.now()}.${part.inlineData.mimeType.split('/')[1]}`;
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, imageBuffer);
        
        console.log(`     ✅ Saved: ${fileName}`);
        return true;
      } catch (saveError) {
        console.log(`     ❌ Save failed: ${saveError.message}`);
      }
    } else if (part?.text) {
      console.log(`     📝 Text (first 100 chars): ${part.text.substring(0, 100)}...`);
    }
  }
  
  return false;
}

testFixedGeminiImageGeneration()
  .then(() => {
    console.log('\n🏁 Test completed');
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
  });