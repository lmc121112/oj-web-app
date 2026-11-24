'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text?: string;
  content?: string;
  inline?: boolean;
}

export default function MathText({ text, content, inline = false }: MathTextProps) {
  const raw = text ?? content ?? '';
  if (!raw) return null;

  return (
    <div
      className="oj-markdown-content"
      style={{
        display: inline ? 'inline' : 'block',
        lineHeight: 1.7,
        fontSize: '15px',
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                margin: '18px 0 10px',
                paddingBottom: '6px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '16px 0 8px' }}>
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 style={{ fontSize: '15.5px', fontWeight: 700, margin: '14px 0 6px' }}>
              {children}
            </h4>
          ),
          p: ({ children }) =>
            inline ? (
              <span>{children}</span>
            ) : (
              <p style={{ margin: '0 0 12px 0' }}>{children}</p>
            ),
          ul: ({ children }) => (
            <ul style={{ margin: '0 0 12px 0', paddingLeft: '22px' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '0 0 12px 0', paddingLeft: '22px' }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '12px 0',
                padding: '8px 14px',
                borderLeft: '4px solid #2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.06)',
                borderRadius: '0 6px 6px 0',
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className) || String(children).includes('\n');
            if (isBlock) {
              return (
                <pre
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: '6px',
                    overflowX: 'auto',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13.5px',
                    margin: '12px 0',
                  }}
                >
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code
                style={{
                  backgroundColor: 'rgba(148, 163, 184, 0.2)',
                  color: '#be123c',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '13.5px',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  border: '1px solid #cbd5e1',
                }}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                backgroundColor: 'rgba(148, 163, 184, 0.15)',
                border: '1px solid #cbd5e1',
                padding: '8px 12px',
                textAlign: 'left',
                fontWeight: 700,
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px' }}>{children}</td>
          ),
        }}
      >
        {raw}
      </ReactMarkdown>
    </div>
  );
}
