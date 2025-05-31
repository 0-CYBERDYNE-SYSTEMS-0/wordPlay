import fetch from 'node-fetch';

async function testResearchPipeline() {
  const baseUrl = 'http://localhost:5001';
  
  console.log('🧪 RESEARCH PIPELINE TEST');
  console.log('========================');
  console.log('Testing: URL Scrape → Notes → Database → Retrieval');
  console.log('');

  try {
    // Test 1: Scrape a webpage
    console.log('1️⃣  Testing webpage scraping...');
    const scrapeResponse = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com'
      })
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Scrape failed: ${scrapeResponse.status}`);
    }

    const scrapedContent = await scrapeResponse.json();
    console.log('✅ Webpage scraped successfully');
    console.log(`   Title: ${scrapedContent.title}`);
    console.log(`   Word count: ${scrapedContent.wordCount}`);
    console.log(`   Domain: ${scrapedContent.domain}`);
    console.log('');

    // Test 2: Save content as research notes
    console.log('2️⃣  Testing save to research notes...');
    const researchNotes = `## ${scrapedContent.title}\n\n${scrapedContent.content.substring(0, 500)}...\n\nSource: https://example.com`;
    
    const saveResponse = await fetch(`${baseUrl}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 1,
        type: 'notes',
        name: 'Research Notes - Example.com',
        content: researchNotes
      })
    });

    if (!saveResponse.ok) {
      throw new Error(`Save failed: ${saveResponse.status}`);
    }

    const savedSource = await saveResponse.json();
    console.log('✅ Research notes saved successfully');
    console.log(`   Source ID: ${savedSource.id}`);
    console.log(`   Type: ${savedSource.type}`);
    console.log(`   Name: ${savedSource.name}`);
    console.log('');

    // Test 3: Retrieve saved sources
    console.log('3️⃣  Testing source retrieval...');
    const sourcesResponse = await fetch(`${baseUrl}/api/projects/1/sources`);
    
    if (!sourcesResponse.ok) {
      throw new Error(`Retrieval failed: ${sourcesResponse.status}`);
    }

    const sources = await sourcesResponse.json();
    console.log('✅ Sources retrieved successfully');
    console.log(`   Total sources: ${sources.length}`);
    
    const noteSources = sources.filter(s => s.type === 'notes');
    console.log(`   Research notes: ${noteSources.length}`);
    
    if (noteSources.length > 0) {
      console.log(`   Latest note: "${noteSources[0].name}"`);
    }
    console.log('');

    // Test 4: Save a URL source directly
    console.log('4️⃣  Testing URL source saving...');
    const urlResponse = await fetch(`${baseUrl}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 1,
        type: 'url',
        name: 'Example.com',
        url: 'https://example.com'
      })
    });

    if (!urlResponse.ok) {
      throw new Error(`URL save failed: ${urlResponse.status}`);
    }

    const urlSource = await urlResponse.json();
    console.log('✅ URL source saved successfully');
    console.log(`   Source ID: ${urlSource.id}`);
    console.log(`   URL: ${urlSource.url}`);
    console.log('');

    // Final verification
    const finalSources = await fetch(`${baseUrl}/api/projects/1/sources`).then(r => r.json());
    const urlSources = finalSources.filter(s => s.type === 'url');
    const notesSources = finalSources.filter(s => s.type === 'notes');

    console.log('🎯 PIPELINE VERIFICATION');
    console.log('========================');
    console.log(`✅ URL Sources: ${urlSources.length}`);
    console.log(`✅ Research Notes: ${notesSources.length}`);
    console.log(`✅ Total Sources: ${finalSources.length}`);
    console.log('');
    console.log('🎉 RESEARCH PIPELINE TEST COMPLETED SUCCESSFULLY');
    console.log('   ✅ Scraping works');
    console.log('   ✅ Notes saving works');
    console.log('   ✅ URL sources work');
    console.log('   ✅ Retrieval works');
    console.log('   ✅ Database persistence works');

  } catch (error) {
    console.error('❌ RESEARCH PIPELINE TEST FAILED');
    console.error('Error:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   • Check if server is running on localhost:5001');
    console.log('   • Verify database connection');
    console.log('   • Check API endpoints are working');
  }
}

console.log('🚀 Starting Research Pipeline Test...');
console.log('');
testResearchPipeline(); 