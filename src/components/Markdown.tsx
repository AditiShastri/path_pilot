import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import  { useState, ComponentProps } from "react";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type CodeProps = ComponentProps<"code"> & {
  inline?: boolean;
};

export function CodeBlock({
  inline,
  className,
  children,
  ...props
}: CodeProps) {
  const [copied, setCopied] = useState(false);

  
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;

  if (typeof node === "number") return String(node);

  if (Array.isArray(node))
    return node.map(extractText).join("");

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(element.props.children);
  }

  return "";
}
const code = extractText(children ?? "")
const languageMatch = className?.match(/language-(\w+)/);
const language = languageMatch?.[1] || "code";


  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  const isBlock = className?.includes("language-");

  if (!isBlock) {
  return (
    <code
      className="
        px-2 py-1
        rounded-md
        bg-muted
        font-mono
        text-[0.9em]
      "
      {...props}
    >
      {children}
    </code>
  );
}


  return (
    <div className="my-4 rounded-lg border bg-[#1e1e1e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[#2d2d2d] bg-[#1e1e1e] text-zinc-400">
        <span className="font-mono">
          {language}
        </span>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-zinc-100 transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="text-sm w-full overflow-x-auto relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          customStyle={{
            margin: 0,
            background: "transparent",
            padding: "1rem",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
          codeTagProps={{
             style: { fontFamily: 'inherit' }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

const MemoizedCodeBlock = memo(CodeBlock, (prev, next) => prev.children === next.children && prev.className === next.className);

function MarkdownComponent({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-8 mb-3 border-b pb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-6 mb-2">
              {children}
            </h3>
          ),
          a: ({ href, children }) => {
            const isExternal = href?.startsWith("http");

            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="
                  text-blue-600 
                  dark:text-blue-400
                  font-medium
                  underline-offset-4
                  hover:underline
                  hover:text-blue-700
                  dark:hover:text-blue-300
                  transition-colors
                  break-all
                "
              >
                {children}
              </a>
            );
          },

          p: ({ children }) => (
            <p className="leading-relaxed  my-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc ml-6 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal ml-6 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border rounded-lg">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border px-3 py-2 bg-muted font-medium text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border px-3 py-2 align-top">
              {children}
            </td>
          ),
          code: MemoizedCodeBlock as any,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// 🔥 CRITICAL LINE — this fixes streaming lag
export const Markdown = memo(MarkdownComponent);
