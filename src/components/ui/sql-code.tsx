"use client";

import React, { useEffect, useMemo, useState } from "react";
import Prism from "prismjs";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import "prismjs/themes/prism-tomorrow.css";

export function SqlCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    require("prismjs/components/prism-sql");
    setReady(true);
  }, []);

  const cleanedCode = useMemo(() => {
    return code.replace(/```sql/gi, "").replace(/```/g, "").trim();
  }, [code]);

  const highlighted = useMemo(() => {
    if (!ready) return cleanedCode;
    return Prism.highlight(cleanedCode, Prism.languages.sql, "sql");
  }, [cleanedCode, ready]);

  const copy = async () => {
    await navigator.clipboard.writeText(cleanedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative max-w-xl rounded-md bg-[#1e1e1e] text-sm font-mono">
      <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-700">
        <span className="text-xs text-zinc-400">sql</span>
        <button onClick={copy} className="text-zinc-400 hover:text-white transition">
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        </button>
      </div>

      <pre className="inline-block whitespace-pre w-max max-w-full overflow-x-auto p-4 leading-relaxed">
        <code
          className="language-sql"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
