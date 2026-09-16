import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import { sanitizeSchema } from '@/lib/sanitize-schema';
import 'katex/dist/katex.min.css';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Light build: register only the languages artifacts actually use (full Prism pack is ~400kB)
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
import { useSettings } from '@/providers/SettingsProvider';
import Chart from './Chart';
import MermaidDiagram from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark' || 
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={`prose prose-gray dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={{
          // Custom table styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-gray-700 dark:text-gray-300">
              {children}
            </td>
          ),
          
          // Enhanced headings with better typography
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-medium mt-4 mb-2 text-gray-700 dark:text-gray-300">
              {children}
            </h4>
          ),
          
          // Enhanced lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-4 text-gray-700 dark:text-gray-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-4 text-gray-700 dark:text-gray-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          
          // Enhanced blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-copper-400 dark:border-copper-400 pl-4 py-2 my-4 italic text-gray-600 dark:text-gray-400 bg-copper-100 dark:bg-copper-100 rounded-r-lg">
              {children}
            </blockquote>
          ),
          
          // Code blocks with syntax highlighting, chart and mermaid rendering
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Handle mermaid diagram blocks (any LLM can emit these as plain text)
            if (!inline && language === 'mermaid') {
              return <MermaidDiagram code={String(children).replace(/\n$/, '')} isDark={isDark} />;
            }

            // Handle chart code blocks
            if (!inline && language === 'chart') {
              try {
                const chartConfig = String(children).replace(/\n$/, '');
                console.log('📋 MarkdownRenderer: Chart config extracted:', chartConfig.substring(0, 200) + '...');
                console.log('📏 Chart config length:', chartConfig.length);
                
                return (
                  <div className="my-8 p-6 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-2xl border border-gray-100 dark:border-gray-700 group">
                    <div className="mb-4 text-base font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <div className="w-2 h-2 bg-[var(--wp-copper)] rounded-full"></div>
                      Interactive Visualization
                    </div>
                    <div className="bg-white/50 dark:bg-black/20 rounded-xl p-2 backdrop-blur-sm">
                      <Chart 
                        config={chartConfig} 
                        autoHeight={true}
                        minHeight={450}
                        maxHeight={800}
                        aspectRatio={16/9}
                        exportQuality="ultra"
                        style={{ 
                          background: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                );
              } catch (error) {
                console.error('❌ MarkdownRenderer error rendering chart:', error);
                return (
                  <div className="my-4 p-4 border border-red-200 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="text-red-600 dark:text-red-400 text-sm font-medium mb-2">
                      Chart Rendering Error
                    </div>
                    <pre className="text-xs text-red-500 dark:text-red-300 overflow-auto">
                      {String(children)}
                    </pre>
                  </div>
                );
              }
            }
            
            return !inline && match ? (
              <div className="my-4 rounded-lg overflow-hidden shadow-sm">
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={match[1]}
                  PreTag="div"
                  className="!my-0"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5'
                  } as any}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code 
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-purple-600 dark:text-purple-400 border border-gray-200 dark:border-gray-700" 
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Enhanced links
          a: ({ children, href, ...props }) => (
            <a 
              href={href}
              className="text-[var(--wp-copper)] dark:text-[var(--wp-copper)] hover:text-copper-500 dark:hover:text-copper-500 hover:underline font-medium transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          
          // Ultra-enhanced premium images
          img: ({ src, alt, ...props }) => (
            <div className="my-8 text-center group">
              <div className="relative inline-block rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-2">
                <img 
                  src={src} 
                  alt={alt}
                  className="max-w-full h-auto rounded-xl mx-auto transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-3xl"
                  style={{
                    maxHeight: '70vh',
                    minHeight: '400px',
                    objectFit: 'contain',
                    imageRendering: 'auto' as any
                  }}
                  loading="lazy"
                  {...props}
                />
                {/* Subtle glass-morphism overlay for premium feel */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-xl"></div>
              </div>
              {alt && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 italic font-medium">
                  {alt}
                </p>
              )}
            </div>
          ),
          
          // Enhanced paragraphs
          p: ({ children }) => (
            <p className="leading-relaxed my-4 text-gray-700 dark:text-gray-300">
              {children}
            </p>
          ),
          
          // Horizontal rules
          hr: () => (
            <hr className="my-8 border-t border-gray-300 dark:border-gray-600" />
          ),
          
          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800 dark:text-gray-200">
              {children}
            </em>
          ),
          
          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-gray-500 dark:text-gray-400">
              {children}
            </del>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}