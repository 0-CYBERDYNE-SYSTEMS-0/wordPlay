import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '@/providers/SettingsProvider';
import Chart from './Chart';

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
        remarkPlugins={[remarkGfm, remarkBreaks]}
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
            <blockquote className="border-l-4 border-blue-400 dark:border-blue-500 pl-4 py-2 my-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg">
              {children}
            </blockquote>
          ),
          
          // Code blocks with syntax highlighting and chart rendering
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            // Handle chart code blocks
            if (!inline && language === 'chart') {
              try {
                const chartConfig = String(children).replace(/\n$/, '');
                console.log('📋 MarkdownRenderer: Chart config extracted:', chartConfig.substring(0, 200) + '...');
                console.log('📏 Chart config length:', chartConfig.length);
                
                return (
                  <div className="my-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                    <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Interactive Chart
                    </div>
                    <Chart config={chartConfig} />
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
                  }}
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
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          
          // Enhanced images
          img: ({ src, alt, ...props }) => (
            <div className="my-6 text-center">
              <img 
                src={src} 
                alt={alt}
                className="max-w-full h-auto rounded-lg shadow-md mx-auto border border-gray-200 dark:border-gray-700"
                loading="lazy"
                {...props}
              />
              {alt && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
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