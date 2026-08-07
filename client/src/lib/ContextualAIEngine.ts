export interface WritingIntent {
  type: 'creative-writing' | 'technical-doc' | 'research' | 'editing' | 'brainstorm' | 'structured-doc';
  complexity: 'simple' | 'moderate' | 'complex';
  mood: 'flowing' | 'struggling' | 'exploring' | 'editing' | 'focused';
  assistance: 'minimal' | 'moderate' | 'comprehensive';
  confidence: number;
  reasoning: string;
}

export interface AIInsight {
  id: string;
  type: 'continuation' | 'improvement' | 'structure' | 'style' | 'research' | 'error' | 'completion';
  title: string;
  suggestion: string;
  confidence: number;
  preview?: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
  category: 'content' | 'style' | 'structure' | 'grammar' | 'research';
}

export interface WritingContext {
  content: string;
  cursorPosition: number;
  selectedText?: string;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  lastActivity: Date;
  typingSpeed: number;
  isActiveTyping: boolean;
  hasUnsavedChanges: boolean;
  sessionDuration: number;
}

export class ContextualAIEngine {
  private analysisCache = new Map<string, { result: WritingIntent; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Analyze writing intent based on content and context
   */
  analyzeWritingIntent(context: WritingContext): WritingIntent {
    const { content, wordCount, paragraphCount, isActiveTyping } = context;
    
    // Check cache first
    const cacheKey = this.getCacheKey(content);
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result;
    }

    // Basic content analysis
    const hasQuestions = content.includes('?');
    const hasTechnicalTerms = /\b(API|function|algorithm|database|framework|component|system|process|methodology|analysis|synthesis|evaluation|implementation)\b/i.test(content);
    const hasCreativeWords = /\b(feel|imagine|dream|wonder|imagine|story|character|emotion|sense|moment|suddenly|perhaps|magic)\b/i.test(content);
    const hasResearchIndicators = /\b(research|study|find|discover|evidence|source|citation|reference|data|statistics)\b/i.test(content);
    const hasStructureWords = /\b(first|second|third|however|therefore|furthermore|in conclusion|overall)\b/i.test(content);

    // Determine intent
    let intentType: WritingIntent['type'] = 'creative-writing';
    let confidence = 0.5;

    if (hasTechnicalTerms && wordCount > 50) {
      intentType = 'technical-doc';
      confidence = 0.8;
    } else if (hasResearchIndicators) {
      intentType = 'research';
      confidence = 0.75;
    } else if (hasCreativeWords && !hasTechnicalTerms) {
      intentType = 'creative-writing';
      confidence = 0.7;
    } else if (hasStructureWords && wordCount > 100) {
      intentType = 'structured-doc';
      confidence = 0.7;
    } else if (content.trim().length === 0) {
      intentType = 'brainstorm';
      confidence = 0.6;
    } else {
      // Look for editing patterns
      if (content.includes('\n\n') && paragraphCount > 1) {
        intentType = 'editing';
        confidence = 0.6;
      }
    }

    // Determine complexity
    let complexity: WritingIntent['complexity'] = 'simple';
    if (wordCount > 200) complexity = 'moderate';
    if (wordCount > 500 || paragraphCount > 5) complexity = 'complex';

    // Determine mood based on writing patterns
    let mood: WritingIntent['mood'] = 'flowing';
    if (content.includes('...') || content.includes('.')) {
      // Look for incomplete thoughts, struggling indicators
      const incompletePatterns = content.match(/\.\.\.|—|--|…/g);
      if (incompletePatterns && incompletePatterns.length > 2) {
        mood = 'struggling';
      }
    }
    
    if (isActiveTyping && wordCount > 50) {
      mood = 'focused';
    }

    // Determine assistance level based on context
    let assistance: WritingIntent['assistance'] = 'minimal';
    if (mood === 'struggling' || complexity === 'complex') {
      assistance = 'comprehensive';
    } else if (wordCount > 100 && (intentType === 'research' || intentType === 'technical-doc')) {
      assistance = 'moderate';
    }

    const result: WritingIntent = {
      type: intentType,
      complexity,
      mood,
      assistance,
      confidence,
      reasoning: this.generateReasoning(intentType, complexity, mood, assistance, wordCount, paragraphCount)
    };

    // Cache the result
    this.analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Generate contextual AI insights based on writing intent and content
   */
  generateInsights(
    intent: WritingIntent,
    context: WritingContext,
    assistanceLevel: 'minimal' | 'moderate' | 'comprehensive'
  ): AIInsight[] {
    const insights: AIInsight[] = [];
    const { content, wordCount, paragraphCount, selectedText } = context;

    // Always provide continuation suggestions if appropriate
    if (wordCount > 20 && content.trim().length > 0) {
      insights.push({
        id: 'continuation',
        type: 'continuation',
        title: this.getContinuationTitle(intent),
        suggestion: this.generateContinuationSuggestion(content, intent),
        confidence: this.calculateContinuationConfidence(intent, wordCount),
        preview: this.getContinuationPreview(content, intent),
        reasoning: 'AI detected natural continuation point in writing flow',
        priority: 'medium',
        category: 'content'
      });
    }

    // Intent-specific insights
    switch (intent.type) {
      case 'creative-writing':
        insights.push(...this.generateCreativeWritingInsights(context, intent));
        break;
        
      case 'technical-doc':
        insights.push(...this.generateTechnicalWritingInsights(context, intent));
        break;
        
      case 'research':
        insights.push(...this.generateResearchInsights(context, intent));
        break;
        
      case 'structured-doc':
        insights.push(...this.generateStructuredInsights(context, intent));
        break;
        
      case 'editing':
        insights.push(...this.generateEditingInsights(context, intent));
        break;
    }

    // Style and improvement insights (for moderate+ assistance)
    if (assistanceLevel !== 'minimal' && wordCount > 50) {
      insights.push(...this.generateStyleInsights(context, intent));
    }

    // Structure insights (for complex documents)
    if (intent.complexity === 'complex' && paragraphCount > 3) {
      insights.push(...this.generateStructureInsights(context, intent));
    }

    return this.rankInsights(insights).slice(0, 5); // Return top 5 insights
  }

  private generateCreativeWritingInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];
    const { content } = context;

    // Character development
    if (content.includes('character') || content.includes('persona')) {
      insights.push({
        id: 'character-dev',
        type: 'improvement',
        title: 'Character Development',
        suggestion: 'Consider adding a specific character trait or backstory to make them more vivid',
        confidence: 0.7,
        preview: '"The protagonist stood at the edge of the forest, remembering..."',
        reasoning: 'User is developing characters and could benefit from specific details',
        priority: 'medium',
        category: 'content'
      });
    }

    // Sensory details
    const hasSensoryWords = /\b(feel|see|hear|smell|taste|touch|sound|look|appears|seems)\b/i.test(content);
    if (!hasSensoryWords && content.length > 100) {
      insights.push({
        id: 'sensory-detail',
        type: 'improvement',
        title: 'Add Sensory Details',
        suggestion: 'Include sensory descriptions to make scenes more immersive',
        confidence: 0.6,
        preview: '"The air smelled of rain and wet earth"',
        reasoning: 'Creative writing benefits from sensory engagement',
        priority: 'medium',
        category: 'style'
      });
    }

    return insights;
  }

  private generateTechnicalWritingInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];
    const { content, wordCount } = context;

    // Technical clarity
    if (wordCount > 100) {
      insights.push({
        id: 'technical-clarity',
        type: 'improvement',
        title: 'Technical Clarity',
        suggestion: 'Consider adding a diagram or example to illustrate complex concepts',
        confidence: 0.75,
        preview: 'Consider this structure: Problem → Solution → Example → Benefits',
        reasoning: 'Technical documentation benefits from visual aids and clear examples',
        priority: 'high',
        category: 'structure'
      });
    }

    return insights;
  }

  private generateResearchInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];
    
    insights.push({
      id: 'research-source',
      type: 'research',
      title: 'Source Validation',
      suggestion: 'Would you like me to search for recent sources on this topic?',
      confidence: 0.8,
      preview: 'I can find academic papers and current research to support your points',
      reasoning: 'Research documents benefit from credible, current sources',
      priority: 'high',
      category: 'research'
    });

    return insights;
  }

  private generateStructuredInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];
    const { content, paragraphCount } = context;

    if (paragraphCount > 2) {
      insights.push({
        id: 'structure-check',
        type: 'structure',
        title: 'Document Structure',
        suggestion: 'Consider adding a brief summary or key points section',
        confidence: 0.6,
        preview: 'Add: "Key Takeaways:" followed by bullet points',
        reasoning: 'Structured documents benefit from clear summaries',
        priority: 'medium',
        category: 'structure'
      });
    }

    return insights;
  }

  private generateEditingInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];

    insights.push({
      id: 'grammar-check',
      type: 'improvement',
      title: 'Grammar & Style',
      suggestion: 'I can help polish the grammar and improve sentence flow',
      confidence: 0.9,
      preview: 'Professional editing suggestions coming up',
      reasoning: 'Editing mode detected - user likely wants grammatical improvements',
      priority: 'high',
      category: 'grammar'
    });

    return insights;
  }

  private generateStyleInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];
    const { content, wordCount } = context;

    // Readability check
    if (wordCount > 100) {
      const avgSentenceLength = content.split(/[.!?]+/).reduce((acc, sentence) => acc + sentence.split(' ').length, 0) / content.split(/[.!?]+/).length;
      
      if (avgSentenceLength > 25) {
        insights.push({
          id: 'readability',
          type: 'improvement',
          title: 'Improve Readability',
          suggestion: 'Consider breaking up long sentences for better readability',
          confidence: 0.7,
          preview: 'Split complex sentences into shorter, clearer ones',
          reasoning: 'Long sentences can reduce readability and engagement',
          priority: 'medium',
          category: 'style'
        });
      }
    }

    return insights;
  }

  private generateStructureInsights(context: WritingContext, intent: WritingIntent): AIInsight[] {
    const insights: AIInsight[] = [];

    insights.push({
      id: 'outline-suggestion',
      type: 'structure',
      title: 'Structure Enhancement',
      suggestion: 'Your document would benefit from a clear outline and conclusion',
      confidence: 0.6,
      preview: 'Consider: Introduction → Main Points → Supporting Details → Conclusion',
      reasoning: 'Complex documents benefit from clear structural guidance',
      priority: 'medium',
      category: 'structure'
    });

    return insights;
  }

  private getContinuationTitle(intent: WritingIntent): string {
    switch (intent.type) {
      case 'creative-writing': return 'Continue Story';
      case 'technical-doc': return 'Expand Technical Detail';
      case 'research': return 'Add Research Finding';
      case 'structured-doc': return 'Continue Argument';
      case 'brainstorm': return 'Brainstorm Ideas';
      default: return 'Continue Writing';
    }
  }

  private generateContinuationSuggestion(content: string, intent: WritingIntent): string {
    const lastParagraph = content.split('\n\n').pop() || '';
    
    switch (intent.type) {
      case 'creative-writing':
        return 'Building on the current scene, the next paragraph could explore the character\'s inner thoughts or introduce a new development that moves the story forward.';
      case 'technical-doc':
        return 'Following your current explanation, you could provide a practical example, code snippet, or step-by-step instruction that demonstrates the concept.';
      case 'research':
        return 'Based on your current point, you could cite a specific study, present supporting evidence, or explore a related finding that strengthens your argument.';
      default:
        return 'You could continue developing this idea by adding supporting details, examples, or exploring the logical next step in your reasoning.';
    }
  }

  private getContinuationPreview(content: string, intent: WritingIntent): string {
    switch (intent.type) {
      case 'creative-writing':
        return 'However, the memory felt different now...';
      case 'technical-doc':
        return 'For example, consider this implementation...';
      case 'research':
        return 'According to recent studies (Smith et al., 2024)...';
      default:
        return 'This leads to several important implications...';
    }
  }

  private calculateContinuationConfidence(intent: WritingIntent, wordCount: number): number {
    let baseConfidence = 0.5;
    
    // Higher confidence for longer documents (more context to work with)
    if (wordCount > 100) baseConfidence += 0.2;
    if (wordCount > 300) baseConfidence += 0.1;
    
    // Higher confidence for certain intent types
    if (intent.type === 'research' || intent.type === 'technical-doc') {
      baseConfidence += 0.1;
    }
    
    return Math.min(baseConfidence, 0.9);
  }

  private rankInsights(insights: AIInsight[]): AIInsight[] {
    return insights.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by confidence
      return b.confidence - a.confidence;
    });
  }

  private getCacheKey(content: string): string {
    // Use content length and first/last 100 characters for cache key
    return `${content.length}:${content.slice(0, 100)}:${content.slice(-100)}`;
  }

  private generateReasoning(
    type: WritingIntent['type'],
    complexity: WritingIntent['complexity'],
    mood: WritingIntent['mood'],
    assistance: WritingIntent['assistance'],
    wordCount: number,
    paragraphCount: number
  ): string {
    const reasons = [];
    
    reasons.push(`Document type: ${type.replace('-', ' ')}`);
    reasons.push(`Length: ${wordCount} words, ${paragraphCount} paragraphs`);
    reasons.push(`Complexity: ${complexity}`);
    reasons.push(`Current mood: ${mood}`);
    reasons.push(`Recommended assistance: ${assistance}`);
    
    return reasons.join(' • ');
  }
}
