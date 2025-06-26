import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface TableGenerationRequest {
  text: string;
  mode: 'replace' | 'augment';
  style?: 'simple' | 'detailed' | 'comparison' | 'data';
}

interface ChartGenerationRequest {
  text: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'auto';
  data?: any[];
}

interface ImageGenerationRequest {
  prompt: string;
  style: 'realistic' | 'artistic' | 'diagram' | 'icon';
  size?: '256x256' | '512x512' | '1024x1024';
}

// Initialize AI clients
let openai: OpenAI | null = null;
let gemini: GoogleGenerativeAI | null = null;

export function initializeAIClients(openaiKey?: string, geminiKey?: string) {
  if (openaiKey) {
    openai = new OpenAI({ apiKey: openaiKey });
  }
  
  if (geminiKey) {
    gemini = new GoogleGenerativeAI(geminiKey);
    console.log('Gemini client initialized for image generation with 2.0 Flash');
  } else {
    console.warn('Gemini API key not provided - image generation will not work');
  }
}

export async function generateTable(request: TableGenerationRequest): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const systemPrompt = `You are an expert at converting text into well-formatted markdown tables. 
  Analyze the provided text and extract structured information to create a meaningful table.
  
  Guidelines:
  - Extract key information and organize it logically
  - Create appropriate column headers
  - Use markdown table format with proper alignment
  - If the text doesn't contain tabular data, intelligently structure it
  - For comparisons, create comparison tables
  - For lists, organize into categorized tables
  - Ensure all data is accurate to the source text
  
  Return only the markdown table, no additional text.`;

  const userPrompt = request.mode === 'replace' 
    ? `Convert this text into a markdown table:\n\n${request.text}`
    : `Analyze this text and create a complementary table that augments the information:\n\n${request.text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating table:', error);
    throw new Error('Failed to generate table');
  }
}

export async function generateChart(request: ChartGenerationRequest): Promise<string> {
  console.log('🔧 generateChart called with request:', JSON.stringify(request, null, 2));
  
  if (!openai) {
    console.error('❌ OpenAI client not initialized');
    throw new Error('OpenAI client not initialized');
  }

  const systemPrompt = `You are an expert at creating responsive ECharts configurations from text data.
  Analyze the provided text and create a complete ECharts configuration object that is perfectly responsive and accessible.
  
  CRITICAL REQUIREMENTS:
  - ALWAYS ensure adequate padding and margins (minimum 60px on all sides)
  - ALL text must be fully visible without collision or truncation
  - Use responsive font sizes that scale appropriately (minimum 12px)
  - Ensure proper spacing between elements (labels, titles, legends)
  - Test for mobile responsiveness (charts should work on 320px+ screens)
  - Use contrasting colors for accessibility
  - Position legends intelligently to avoid overlapping with chart content
  - Include proper tooltips with clear formatting
  - Ensure axis labels have enough space and don't overlap
  - Add containLabel: true to grid for automatic padding calculation
  
  RESPONSIVE DESIGN RULES:
  - Grid padding: minimum { top: 60, right: 60, bottom: 60, left: 60 }
  - Font sizes: title: 16px+, labels: 12px+, legends: 12px+
  - Legend position: consider 'bottom' for wide legends, 'right' for short ones
  - Axis label rotation: use when labels are long to prevent overlap
  - Color palette: use high-contrast, colorblind-friendly colors
  
  DATA EXTRACTION:
  - Extract numerical data and relationships from the text accurately
  - Choose the most appropriate chart type if 'auto' is selected
  - Create meaningful categories and data series
  - Handle missing or incomplete data gracefully
  
  Chart types available: bar, line, pie, scatter
  
  Return only the JSON configuration, no additional text or code blocks.`;

  const userPrompt = `Create an ECharts configuration for a ${request.chartType} chart from this data:\n\n${request.text}`;

  try {
    console.log('📡 Making OpenAI API call for chart generation...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content || '';
    console.log('✅ OpenAI response received, content length:', content.length);
    
    // Wrap the chart configuration in a special marker for the frontend
    const result = `\`\`\`chart
${content}
\`\`\``;
    console.log('📊 Chart result prepared:', result.substring(0, 200) + '...');
    return result;
  } catch (error) {
    console.error('❌ Error generating chart:', error);
    throw new Error('Failed to generate chart');
  }
}

export async function generateImage(request: ImageGenerationRequest): Promise<string> {
  if (!gemini) {
    throw new Error('Gemini client not initialized');
  }

  const stylePrompts = {
    realistic: 'photorealistic, high quality, detailed, professional photography style',
    artistic: 'artistic style, creative, stylized, beautiful artwork, expressive',
    diagram: 'clean diagram style, technical illustration, minimal, vector graphics, clear and simple',
    icon: 'simple icon style, flat design, minimal, vector-like, clean symbols, modern'
  };

  // Enhanced prompt with better descriptions for Gemini 2.0 Flash
  const enhancedPrompt = `Create a high-quality image that visually represents and complements this content: "${request.prompt}". 

  Style requirements: ${stylePrompts[request.style]}
  
  The image should:
  - Directly relate to and enhance the meaning of the provided text
  - Be visually appealing and professionally composed
  - Support the narrative or concepts described in the text
  - Use appropriate visual metaphors that connect to the content
  - Be suitable for accompanying written content in a document
  
  Make it high quality, well-composed, and contextually relevant.`;

  try {
    const model = gemini.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: { 
        responseModalities: ['Text', 'Image'] 
      } 
    });

    const response = await model.generateContent(enhancedPrompt);
    
    // Process the response to extract image data
    if (response?.response?.candidates?.[0]) {
      const candidate = response.response.candidates[0];
      
      // Look for image parts in the response
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part?.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
            try {
              console.log(`Processing image: ${part.inlineData.mimeType}, data length: ${part.inlineData.data.length}`);
              
              // Immediately process and save the image to avoid sending large data back
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              
              // Check if image is reasonable size (max 10MB for processing, but we'll save smaller)
              if (imageBuffer.length > 10 * 1024 * 1024) {
                console.warn(`Image too large: ${Math.round(imageBuffer.length / (1024 * 1024))}MB`);
                throw new Error('Generated image is too large');
              }
              
              const fileExtension = part.inlineData.mimeType.split('/')[1] || 'png';
              const fileName = `gemini-image-${crypto.randomUUID()}.${fileExtension}`;
              
              // Create uploads directory if it doesn't exist
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              
              // Save the image file
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, imageBuffer);
              
              console.log(`✅ Image saved: ${fileName} (${Math.round(imageBuffer.length / 1024)}KB)`);
              
              // Return markdown with relative URL - this should be small
              const imageUrl = `/uploads/${fileName}`;
              const altText = request.prompt.substring(0, 100);
              const result = `![${altText}](${imageUrl})`;
              
              console.log(`Returning result of length: ${result.length} characters`);
              return result;
              
            } catch (saveError: any) {
              console.error('Error processing image:', saveError);
              // Return a simple error message to avoid payload issues
              return `**Image Generation Error**: ${saveError.message || 'Could not process generated image'}\n\n*Please try again with a simpler image description.*`;
            }
          }
        }
      }
    }

    throw new Error('No image data found in Gemini response');
    
  } catch (error: any) {
    console.error('Error generating image with Gemini 2.0 Flash:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('content policy') || error.message?.includes('safety')) {
      throw new Error('Image request rejected due to content policy. Please try a different description.');
    } else if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    } else if (error.message?.includes('not supported')) {
      throw new Error('Image generation not available in your region. Please check Gemini 2.0 Flash availability.');
    } else {
      throw new Error(`Failed to generate image: ${error.message || 'Unknown error'}`);
    }
  }
}

// Legacy function - now just calls the main generateImage function
export async function generateImageWithGemini(request: ImageGenerationRequest): Promise<string> {
  return await generateImage(request);
}

export async function processAIContentCommand(
  command: string,
  content: string,
  selectionInfo: any,
  _llmProvider: string, // Prefixed with underscore to indicate intentionally unused
  _llmModel: string,   // Prefixed with underscore to indicate intentionally unused
  openaiKey?: string,
  geminiKey?: string,
  parameters?: any
): Promise<string> {
  // Initialize clients if not already done
  if (openaiKey || geminiKey) {
    initializeAIClients(openaiKey, geminiKey);
  }

  const selectedText = selectionInfo.selectedText || content;

  switch (command) {
    case 'table':
      const tableMode = parameters?.mode || (selectionInfo.selectedText ? 'replace' : 'augment');
      const tableStyle = parameters?.style || 'simple';
      
      return await generateTable({
        text: selectedText,
        mode: tableMode,
        style: tableStyle
      });

    case 'chart':
      console.log('🎯 Processing chart command with parameters:', parameters);
      console.log('📝 Selected text for chart:', selectedText.substring(0, 200) + '...');
      const chartType = parameters?.chartType || parameters?.type || 'auto';
      
      const chartResult = await generateChart({
        text: selectedText,
        chartType: chartType
      });
      console.log('📈 Chart generation completed, result length:', chartResult.length);
      return chartResult;

    case 'image':
      // Use selected text as context for image generation
      let imagePrompt = selectedText.trim();
      
      // If no text is selected or text is too short, provide better context
      if (!imagePrompt || imagePrompt.length < 10) {
        // Use the full content for context if no selection
        const contextText = content.length > 300 ? content.substring(0, 300) : content;
        imagePrompt = contextText || 'Create a beautiful, professional image';
      }
      
      // If the selected text is very long, use it intelligently
      if (imagePrompt.length > 300) {
        // Try to extract key concepts and themes for the image
        const sentences = imagePrompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) {
          // Use the first two sentences as they often contain main ideas
          imagePrompt = sentences.slice(0, 2).join('. ').trim();
        } else {
          // Truncate but try to end at a word boundary
          imagePrompt = imagePrompt.substring(0, 280).replace(/\s+\S*$/, '');
        }
      }
      
      const imageStyle = parameters?.style || 'artistic';
      const imageSize = parameters?.size || '1024x1024';
      
      return await generateImage({
        prompt: imagePrompt,
        style: imageStyle,
        size: imageSize
      });

    default:
      throw new Error(`Unknown AI content command: ${command}`);
  }
}