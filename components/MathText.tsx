'use client';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function MathText({ text }: { text: string }) {
  if (!text) return null;

  // Tách chuỗi theo công thức khối $$...$$ hoặc công thức cùng dòng $...$
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '15px' }}>
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <div key={idx} dangerouslySetInnerHTML={{ __html: html }} style={{ margin: '10px 0' }} />;
          } catch {
            return <span key={idx}>{part}</span>;
          }
        }

        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={idx}>{part}</span>;
          }
        }

        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}
