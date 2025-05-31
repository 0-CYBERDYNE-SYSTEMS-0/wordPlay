import fetch from 'node-fetch';

async function testSlashExpandFix() {
  const baseUrl = 'http://localhost:5001';
  
  console.log('🔧 TESTING SLASH COMMAND EXPAND FIX');
  console.log('==================================');
  
  const testCases = [
    {
      name: "Expand Command",
      command: "expand",
      content: "AI is transforming software development.",
      expectedAppend: true
    },
    {
      name: "Continue Command", 
      command: "continue",
      content: "This is the beginning of a story.",
      expectedAppend: true
    },
    {
      name: "Improve Command (should replace)",
      command: "improve",
      content: "This text needs improvement.",
      expectedAppend: false
    }
  ];

  for (const test of testCases) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`📝 Command: /${test.command}`);
    console.log(`📄 Content: "${test.content}"`);
    
    try {
      const response = await fetch(`${baseUrl}/api/ai/slash-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: test.command,
          content: test.content,
          selectionInfo: {
            selectedText: "",
            selectionStart: 0,
            selectionEnd: 0,
            beforeSelection: test.content,
            afterSelection: ""
          }
        })
      });

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status}`);
        continue;
      }

      const result = await response.json();
      
      console.log(`📊 Response:`);
      console.log(`   - appendToContent: ${result.appendToContent}`);
      console.log(`   - replaceSelection: ${result.replaceSelection}`);
      console.log(`   - replaceEntireContent: ${result.replaceEntireContent}`);
      console.log(`   - message: "${result.message}"`);
      
      const isCorrect = test.expectedAppend ? result.appendToContent === true : result.appendToContent !== true;
      console.log(`${isCorrect ? '✅' : '❌'} ${isCorrect ? 'CORRECT' : 'INCORRECT'} behavior`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🎯 SUMMARY');
  console.log('===========');
  console.log('If expand and continue show appendToContent: true, the fix is working!');
  console.log('If they show null or false, the server changes haven\'t taken effect.');
}

testSlashExpandFix().catch(console.error); 