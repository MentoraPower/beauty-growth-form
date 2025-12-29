import React, { useState } from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, ChevronDown, Type, Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TiptapFloatingToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}

const ToolbarButton = ({ onClick, isActive, children, title }: ToolbarButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-1.5 rounded hover:bg-white/20 transition-colors",
      isActive && "bg-white/30"
    )}
  >
    {children}
  </button>
);

const paragraphStyles = [
  { label: 'Parágrafo', value: 'paragraph' },
  { label: 'Título 1', value: 'h1' },
  { label: 'Título 2', value: 'h2' },
  { label: 'Título 3', value: 'h3' },
  { label: 'Título 4', value: 'h4' },
  { label: 'Citação', value: 'blockquote' },
];

export function TiptapFloatingToolbar({ editor }: TiptapFloatingToolbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const getCurrentStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Título 1';
    if (editor.isActive('heading', { level: 2 })) return 'Título 2';
    if (editor.isActive('heading', { level: 3 })) return 'Título 3';
    if (editor.isActive('heading', { level: 4 })) return 'Título 4';
    if (editor.isActive('blockquote')) return 'Citação';
    return 'Parágrafo';
  };

  const applyStyle = (value: string) => {
    switch (value) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'h4':
        editor.chain().focus().toggleHeading({ level: 4 }).run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
    }
    setShowDropdown(false);
  };

  const handleSetLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }) => {
        const { from, to } = state.selection;
        return from !== to && !editor.state.selection.empty;
      }}
      tippyOptions={{ 
        duration: 100,
        placement: 'top',
        offset: [0, 10],
        zIndex: 9999
      }}
      className="flex items-center gap-1 bg-zinc-800 text-white px-3 py-2 rounded-lg shadow-xl border border-white/10 min-w-[320px] z-[9999]"
    >
      {/* Paragraph Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowDropdown(!showDropdown);
            setShowLinkInput(false);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 transition-colors text-xs font-medium min-w-[90px] justify-between"
        >
          <Type size={14} />
          <span className="truncate">{getCurrentStyle()}</span>
          <ChevronDown size={12} />
        </button>
        
        {showDropdown && (
          <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px] z-[10000]">
            {paragraphStyles.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => applyStyle(style.value)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-white/20 transition-colors",
                  getCurrentStyle() === style.label && "bg-white/10"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Negrito"
      >
        <Bold size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Itálico"
      >
        <Italic size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Riscado"
      >
        <Strikethrough size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Código"
      >
        <Code size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/20 mx-1" />

      {/* Link */}
      <div className="relative">
        {editor.isActive('link') ? (
          <ToolbarButton
            onClick={handleRemoveLink}
            isActive={true}
            title="Remover link"
          >
            <Unlink size={16} />
          </ToolbarButton>
        ) : (
          <ToolbarButton
            onClick={() => {
              setShowLinkInput(!showLinkInput);
              setShowDropdown(false);
            }}
            isActive={showLinkInput}
            title="Adicionar link"
          >
            <Link size={16} />
          </ToolbarButton>
        )}

        {showLinkInput && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-800 border border-white/10 rounded-lg shadow-xl p-2 z-[10000] min-w-[200px]">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://exemplo.com"
              className="w-full bg-zinc-700 text-white text-xs px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-white/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSetLink();
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSetLink}
              className="w-full mt-2 bg-primary text-primary-foreground text-xs px-2 py-1.5 rounded hover:bg-primary/90 transition-colors"
            >
              Inserir
            </button>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
