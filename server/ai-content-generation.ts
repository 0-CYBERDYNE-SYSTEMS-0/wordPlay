import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality } from '@google/genai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prepareO3Parameters, isO3Model, callOllama, DEFAULT_MODEL } from './openai';

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
let geminiNew: GoogleGenAI | null = null;

export function initializeAIClients(openaiKey?: string, geminiKey?: string) {
  if (openaiKey) {
    openai = new OpenAI({ apiKey: openaiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
  }
  
  if (geminiKey) {
    // Keep old client for compatibility
    gemini = new GoogleGenerativeAI(geminiKey);
    
    // Initialize new client for image generation
    geminiNew = new GoogleGenAI({ apiKey: geminiKey });
    console.log('Gemini clients initialized for image generation');
  } else {
    console.warn('Gemini API key not provided - image generation will not work');
  }
}

export async function generateTable(request: TableGenerationRequest, llmProvider: 'openai' | 'ollama' = 'openai', llmModel?: string): Promise<string> {
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
    if (llmProvider === 'ollama') {
      const content = await callOllama(llmModel || 'qwen3:4b', `${systemPrompt}\n\n${userPrompt}`);
      return content || '';
    }

    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    const requestParams = prepareO3Parameters({
      model: llmModel || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
    
    const completion = await openai.chat.completions.create(requestParams);

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating table:', error);
    throw new Error('Failed to generate table');
  }
}

export async function generateChart(request: ChartGenerationRequest, llmProvider: 'openai' | 'ollama' = 'openai', llmModel?: string): Promise<string> {
  console.log('🔧 generateChart called with request:', JSON.stringify(request, null, 2));
  
  const systemPrompt = `You are an expert at creating stunning, Apple-quality ECharts visualizations that rival the best data visualizations from Apple's investor presentations and cutting-edge JavaScript libraries.

  CREATE PREMIUM, FUTURISTIC VISUALIZATIONS:
  
  🎨 APPLE-STYLE DESIGN SYSTEM:
  - Use premium color palettes: gradients, subtle shadows, glass-morphism effects
  - Implement smooth animations and micro-interactions
  - Clean, minimal typography with San Francisco Pro-style fonts
  - Sophisticated spacing and alignment following Apple's design principles
  - High contrast ratios for accessibility while maintaining elegance
  
  🔮 FUTURISTIC VISUAL ELEMENTS:
  - Gradient fills and subtle shadows for depth
  - Smooth line curves with proper easing
  - Glass-morphism backgrounds with transparency
  - Sophisticated color schemes (prefer blues, teals, purples for tech feel)
  - Premium animation easing curves
  
  📊 TECHNICAL EXCELLENCE:
  - Ultra-high resolution support (devicePixelRatio: 2+)
  - Perfect responsive behavior across all screen sizes
  - Grid system: { top: 80, right: 80, bottom: 80, left: 100, containLabel: true }
  - Typography scale: title: 24px, subtitle: 16px, labels: 14px, legends: 13px
  - Smooth animations: animationDuration: 1000, animationEasing: 'cubicOut'
  
  🎯 APPLE-QUALITY SPECIFICATIONS:
  - Use sophisticated gradients: linear and radial gradients for series
  - Implement subtle drop shadows and glows
  - Premium color palettes: ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#00C7BE', '#FF2D92']
  - Glass-morphism effects with backgroundColor: 'rgba(255,255,255,0.1)'
  - Smooth line styles with shadowBlur for depth
  - Professional tooltip styling with rounded corners and shadows
  
  💎 CUTTING-EDGE JS FEATURES:
  - Rich animations with staggered transitions
  - Sophisticated hover states and interactions
  - Progressive data loading animations
  - Multi-dimensional visual hierarchy
  - Advanced legend positioning with intelligent overflow handling
  
  📱 EXPORT-READY QUALITY:
  - High DPI rendering for crisp exports
  - Print-optimized color schemes
  - Professional presentation-ready styling
  - Scalable vector-quality output
  
  CHART TYPE SELECTION (when auto):
  - Line charts: for trends, time series, continuous data
  - Bar charts: for comparisons, categorical data
  - Pie charts: for parts of a whole (limit to 6 categories max)
  - Scatter plots: for correlations, relationships
  - Area charts: for cumulative data, stacked values
  
  Return ONLY the complete JSON configuration with no code blocks or additional text.`;

  const userPrompt = `Create an ECharts configuration for a ${request.chartType} chart from this data:\n\n${request.text}`;

  try {
    if (llmProvider === 'ollama') {
      console.log('📡 Making Ollama call for chart generation...');
      const content = await callOllama(llmModel || 'qwen3:4b', `${systemPrompt}\n\n${userPrompt}`);
      const result = `\`\`\`chart
${content}
\`\`\``;
      return result;
    }

    if (!openai) {
      console.error('❌ OpenAI client not initialized');
      throw new Error('OpenAI client not initialized');
    }

    console.log('📡 Making OpenAI API call for chart generation...');
    const requestParams = prepareO3Parameters({
      model: llmModel || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });
    
    const completion = await openai.chat.completions.create(requestParams);

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

// ---- Local-first image generation: FLUX.2 Klein via mflux bridge (1-step default), Gemini fallback ----
export async function generateImage(request: ImageGenerationRequest): Promise<string> {
  const stylePrompts = {
    realistic: 'ultra-high quality photorealistic style, 8K resolution, professional DSLR photography, perfect lighting, sharp details, cinematic composition, award-winning photography',
    artistic: 'stunning artistic masterpiece, premium digital art, gallery-quality illustration, rich colors, sophisticated composition, professional artwork, high-end design',
    diagram: 'pristine technical diagram, ultra-clean vector illustration, Apple-style minimalism, perfect geometric precision, professional technical documentation quality, crisp lines',
    icon: 'premium icon design, ultra-modern flat design, Apple-quality vector graphics, pixel-perfect clarity, sophisticated minimalism, high-end brand quality'
  };

  const enhancedPrompt = `Create a high-quality image that represents: "${request.prompt}".

Style: ${stylePrompts[request.style]}

Requirements:
- High resolution and crisp details
- Professional composition
- Excellent color balance and contrast
- Modern aesthetic with perfect lighting
- Export-ready quality

Create a visually appealing and professional image.`;

  const sizeMap: Record<string, { width: number; height: number }> = {
    '256x256': { width: 256, height: 256 },
    '512x512': { width: 512, height: 512 },
    '1024x1024': { width: 1024, height: 1024 },
  };
  const { width, height } = sizeMap[request.size || '512x512'] || sizeMap['512x512'];

  const mfluxUrl = process.env.MFLUX_BRIDGE_URL || 'http://127.0.0.1:4030';
  const steps = parseInt(process.env.MFLUX_STEPS || '1', 10);

  console.log('🎨 Starting local FLUX.2 Klein image generation (mflux bridge)...');
  console.log(`📝 Prompt: "${request.prompt}" | Size: ${width}x${height} | Steps: ${steps}`);

  try {
    const genResponse = await fetch(`${mfluxUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: enhancedPrompt, width, height, steps }),
    });

    if (!genResponse.ok) {
      throw new Error(`mflux bridge HTTP ${genResponse.status}`);
    }

    const data = await genResponse.json();
    if (!data.image_base64) {
      throw new Error('No image data in mflux bridge response');
    }

    const imageBuffer = Buffer.from(data.image_base64, 'base64');
    console.log(`💾 Local image buffer size: ${Math.round(imageBuffer.length / 1024)}KB (${data.time_seconds ?? '?'}s, ${steps} step${steps === 1 ? '' : 's'})`);

    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw new Error('Generated image is too large');
    }

    const fileName = `mflux-image-${crypto.randomUUID()}.png`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);

    console.log(`✅ Local image saved: ${fileName}`);
    const imageUrl = `/uploads/${fileName}`;
    // Short, descriptive alt text (≤ ~8 words) instead of a 100-char prompt excerpt
    const altText = request.prompt.split(/\s+/).slice(0, 8).join(' ') || "Generated image";
    return `![${altText}](${imageUrl})`;
  } catch (localError: any) {
    console.warn(`⚠️ Local FLUX bridge failed (${localError.message}); falling back to Gemini (cloud)`, localError);
    return generateImageWithGeminiFallback(request, enhancedPrompt);
  }
}

async function generateImageWithGeminiFallback(request: ImageGenerationRequest, enhancedPrompt: string): Promise<string> {
  if (!geminiNew) {
    throw new Error('Gemini client not initialized for image generation');
  }

  console.log('🎨 Starting Gemini image generation (fallback)...');
  console.log(`📝 Prompt: "${request.prompt}"`);
  console.log(`🎭 Style: ${request.style}`);

  try {
    // Gemini 3.1 Flash-Lite Image (Nano Banana 2 Lite) is the current, stable,
    // cost-efficient image-generation model. NOTE: the plain "gemini-3.1-flash-lite"
    // model is text-output only and cannot generate images — the "-image" variant is
    // required for image generation.
    const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
    const imageModels = [imageModel];

    let lastError: any = null;

    for (const model of imageModels) {
      try {
        console.log(`📡 Sending request to ${model}...`);

        const response = await geminiNew.models.generateContent({
          model,
          contents: enhancedPrompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        console.log(`✅ Response received from ${model}`);

        // Process the response to extract image data
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        console.log(`📊 Processing ${parts.length} response parts`);

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];

          if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
            try {
              console.log(`🖼️  Found image data: ${part.inlineData.mimeType}`);
              console.log(`📐 Data length: ${part.inlineData.data.length} characters`);

              // Process and save the image
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              console.log(`💾 Image buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);

              // Check if image is reasonable size (max 10MB)
              if (imageBuffer.length > 10 * 1024 * 1024) {
                console.warn(`⚠️  Image too large: ${Math.round(imageBuffer.length / (1024 * 1024))}MB`);
                throw new Error('Generated image is too large');
              }

              const fileExtension = part.inlineData.mimeType.split('/')[1] || 'png';
              const fileName = `gemini-image-${crypto.randomUUID()}.${fileExtension}`;

              // Create uploads directory if it doesn't exist
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
                console.log('📁 Created uploads directory');
              }

              // Save the image file
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, imageBuffer);

              console.log(`✅ Image saved successfully: ${fileName}`);
              console.log(`📂 Full path: ${filePath}`);

              // Return markdown with relative URL
              const imageUrl = `/uploads/${fileName}`;
              const altText = request.prompt.split(/\s+/).slice(0, 8).join(' ') || "Generated image";
              const result = `![${altText}](${imageUrl})`;

              console.log(`📤 Returning markdown result: ${result}`);
              return result;

            } catch (saveError: any) {
              console.error('❌ Error processing image:', saveError);
              // Throw so the caller surfaces a proper error instead of inserting
              // error text into the document.
              throw new Error(saveError.message || 'Could not process generated image');
            }
          } else if (part.text) {
            console.log(`📝 Text part: ${part.text.substring(0, 100)}...`);
          }
        }

        console.warn(`❌ No image data found in response from ${model}`);
        lastError = new Error(`No image data found in Gemini response from ${model}`);
      } catch (error: any) {
        console.error(`❌ Error generating image with ${model}:`, error);
        lastError = error;
      }
    }

    // Map the last failure to a helpful message
    const error = lastError || new Error('Unknown image generation failure');
    const rawMessage = error.message || '';
    const apiStatus = typeof error.status === 'number' ? error.status : null;

    if (rawMessage.includes('content policy') || rawMessage.includes('safety')) {
      throw new Error('Image request rejected due to content policy. Please try a different description.');
    } else if (apiStatus === 429 || rawMessage.includes('quota') || rawMessage.includes('rate limit')) {
      throw new Error('Gemini image generation quota exceeded. Check the API key quota/billing, then try again.');
    } else if (apiStatus === 404 || rawMessage.includes('not found')) {
      throw new Error(`The image model "${imageModel}" is not available for this Gemini API key. Set GEMINI_IMAGE_MODEL to a supported image model (e.g. gemini-3.1-flash-lite-image).`);
    } else if (rawMessage.includes('responseModalities')) {
      throw new Error('Gemini model configuration error. The service may be temporarily unavailable.');
    } else {
      throw new Error(`Failed to generate image: ${rawMessage || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('❌ AI content generation error:', error);
    throw error;
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
  llmProvider: string = 'openai',
  llmModel: string = DEFAULT_MODEL,
  openaiKey?: string,
  geminiKey?: string,
  parameters?: any
): Promise<string> {
  // Initialize clients if not already done
  if (openaiKey || geminiKey) {
    initializeAIClients(openaiKey, geminiKey);
  }

  const provider = llmProvider === 'ollama' ? 'ollama' : 'openai';

  const selectedText = selectionInfo.selectedText || content;

  switch (command) {
    case 'table':
      const tableMode = parameters?.mode || (selectionInfo.selectedText ? 'replace' : 'augment');
      const tableStyle = parameters?.style || 'simple';
      
      return await generateTable({
        text: selectedText,
        mode: tableMode,
        style: tableStyle
      }, provider, llmModel);

    case 'chart':
      console.log('🎯 Processing chart command with parameters:', parameters);
      console.log('📝 Selected text for chart:', selectedText.substring(0, 200) + '...');
      const chartType = parameters?.chartType || parameters?.type || 'auto';
      
      const chartResult = await generateChart({
        text: selectedText,
        chartType: chartType
      }, provider, llmModel);
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
        const sentences = imagePrompt.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
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