import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function testCorrectGeminiImageGeneration() {
  console.log('🧪 Testing CORRECT Gemini Image Generation with New SDK');
  console.log('====================================================');
  
  try {
    // Initialize with the new SDK
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
    
    console.log('✅ GoogleGenAI client initialized');
    
    const testPrompt = "Create a simple image of a red apple on a white background";
    
    console.log(`🔄 Testing prompt: "${testPrompt}"`);
    console.log('📡 Using model: gemini-2.0-flash-preview-image-generation');
    console.log('🎛️  With responseModalities: [TEXT, IMAGE]');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: testPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    console.log('✅ Response received!');
    console.log('📊 Processing response...');
    
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    console.log(`📋 Found ${parts.length} parts in response`);
    
    let imageFound = false;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`\n🔍 Part ${i + 1}:`);
      
      if (part.inlineData) {
        console.log(`   🖼️  Image data found!`);
        console.log(`   📏 MIME type: ${part.inlineData.mimeType}`);
        console.log(`   📐 Data length: ${part.inlineData.data.length} characters`);
        
        try {
          const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
          console.log(`   💾 Image size: ${Math.round(imageBuffer.length / 1024)}KB`);
          
          // Save the image
          const fileName = `working-gemini-${Date.now()}.${part.inlineData.mimeType.split('/')[1]}`;
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('   📁 Created uploads directory');
          }
          
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, imageBuffer);
          
          console.log(`   ✅ Image saved successfully: ${fileName}`);
          console.log(`   📂 Full path: ${filePath}`);
          
          imageFound = true;
        } catch (saveError) {
          console.error(`   ❌ Error saving image: ${saveError.message}`);
        }
      } else if (part.text) {
        console.log(`   📝 Text content: ${part.text.substring(0, 100)}...`);
      } else {
        console.log(`   ❓ Unknown part type:`, Object.keys(part));
      }
    }
    
    if (imageFound) {
      console.log('\n🎉 SUCCESS! Gemini 2.0 Flash image generation is working!');
      return true;
    } else {
      console.log('\n❌ No image data found in response');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error during image generation:', error.message);
    console.error('🔍 Full error:', error);
    
    if (error.message?.includes('API_KEY_INVALID')) {
      console.error('💡 Check your GEMINI_API_KEY');
    } else if (error.message?.includes('quota')) {
      console.error('💡 You may have exceeded your API quota');
    } else if (error.message?.includes('not supported')) {
      console.error('💡 Model may not be available in your region');
    }
    
    return false;
  }
}

// Also test with different model variants
async function testModelVariants() {
  console.log('\n🔬 Testing Different Model Variants');
  console.log('===================================');
  
  const models = [
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp',
    'gemini-exp-1121'  // Another experimental model
  ];
  
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
  
  for (const modelName of models) {
    console.log(`\n🧪 Testing model: ${modelName}`);
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: "Create a simple red circle image",
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      
      const parts = response.candidates?.[0]?.content?.parts || [];
      const hasImage = parts.some(part => part.inlineData?.mimeType?.startsWith('image/'));
      
      console.log(`   📊 Result: ${parts.length} parts, image: ${hasImage ? '✅' : '❌'}`);
      
      if (hasImage) {
        console.log(`   🎉 Model ${modelName} works for image generation!`);
      }
      
    } catch (error) {
      console.log(`   ❌ Model ${modelName} failed: ${error.message}`);
    }
  }
}

// Run the tests
testCorrectGeminiImageGeneration()
  .then(success => {
    if (success) {
      console.log('\n✅ MAIN TEST PASSED - Image generation working!');
      return testModelVariants();
    } else {
      console.log('\n❌ MAIN TEST FAILED - Need to investigate further');
    }
  })
  .then(() => {
    console.log('\n🏁 All tests completed');
  })
  .catch(error => {
    console.error('💥 Test suite failed:', error);
  });