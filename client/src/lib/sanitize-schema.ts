import { defaultSchema } from "rehype-sanitize";

// Schema for untrusted HTML (AI output, pasted content) rendered by MarkdownRenderer.
//
// Math pipeline fact (verified against node_modules): remark-math v6 emits math as
// CODE elements — className ['language-math','math-inline'|'math-display'] — and
// rehype-katex v7 fires on ANY of those classes surviving sanitization. defaultSchema
// allows code className /^language-./, so 'language-math' survives and math renders;
// the two stripped classes are not needed (display mode is recovered from the
// <pre><code> parent). The math/MathML tagNames below are NOT for that pipeline —
// they admit hand-written raw-HTML MathML through rehype-raw (maction excluded).
//
// `code className` keeping the language-* prefix is also what the chart/mermaid
// fences and syntax highlighting key off — those are handled by React components,
// not raw HTML, so no schema allowance is needed for them.
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "semantics",
    "annotation",
    "mrow",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "mfrac",
    "msqrt",
    "mroot",
    "mstyle",
    "msub",
    "msup",
    "msubsup",
    "munder",
    "mover",
    "munderover",
    "mtable",
    "mtr",
    "mtd",
    "mspace",
    "mpadded",
    "mphantom",
    "menclose",
  ],
  attributes: {
    ...defaultSchema.attributes,
    math: [...(defaultSchema.attributes?.math ?? []), "className", "display", "xmlns"],
    annotation: [...(defaultSchema.attributes?.annotation ?? []), "encoding"],
    // Constrain sources to absolute http(s) or same-origin /uploads/. Drops srcset
    // entirely (browsers don't execute it, but it's also dead weight here); keeps
    // defaultSchema's other img attrs (alt, height, width, aria-*).
    img: [
      ...(defaultSchema.attributes?.img ?? []).filter((a) => a !== "src" && a !== "srcset"),
      ["src", /^https?:\/\//i, /^\/uploads\//i],
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Blocks javascript:/vbscript:/data: in sources; relative URLs (./uploads/…)
    // carry no protocol and pass through unharmed.
    src: ["http", "https"],
    href: ["http", "https", "mailto"],
  },
} as typeof defaultSchema;
