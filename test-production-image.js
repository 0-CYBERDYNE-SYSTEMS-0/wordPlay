import fetch from 'node-fetch';

async function testProductionImageGeneration() {
  console.log('🧪 Testing PRODUCTION Image Generation via API');
  console.log('============================================');
  
  const testRequest = {
    command: "image",
    content: "A beautiful sunset over mountains",
    selectionInfo: {
      selectedText: "A beautiful sunset over mountains",
      selectionStart: 0,
      selectionEnd: 30,
      beforeSelection: "",
      afterSelection: ""
    },
    style: {
      style: "artistic"
    },
    llmProvider: "openai",
    llmModel: "gpt-4"
  };
  
  console.log('📝 Test request:', JSON.stringify(testRequest, null, 2));
  
  try {
    console.log('📡 Sending request to localhost:5001...');
    
    const response = await fetch('http://localhost:5001/api/ai/slash-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest)
    });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Response received!');
    console.log('📋 Result keys:', Object.keys(result));
    console.log('📄 Result content:', result.result ? result.result.substring(0, 200) + '...' : 'No result');
    
    if (result.result && result.result.includes('![') && result.result.includes('](/uploads/')) {
      console.log('🎉 SUCCESS! Image generation working - markdown image returned');
      
      // Extract the image filename
      const imageMatch = result.result.match(/\!\[.*?\]\(\/uploads\/(.*?)\)/);
      if (imageMatch) {
        const fileName = imageMatch[1];
        console.log(`🖼️  Generated image: ${fileName}`);
        console.log(`📂 Should be saved at: public/uploads/${fileName}`);
        
        // Check if file exists
        try {
          const fs = await import('fs');
          const path = await import('path');
          const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
          
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`✅ File exists! Size: ${Math.round(stats.size / 1024)}KB`);
          } else {
            console.log('❌ File not found on disk');
          }
        } catch (e) {
          console.log('❓ Could not check file existence');
        }
      }
    } else if (result.result && result.result.includes('Error')) {
      console.log('❌ Image generation error:', result.result);
    } else {
      console.log('❓ Unexpected response format');
    }
    
  } catch (error) {
    console.error('💥 Request failed:', error.message);
  }
}

testProductionImageGeneration();