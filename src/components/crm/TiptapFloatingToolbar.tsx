import React, { useState, useRef } from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, ChevronDown, Type, Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextSelection } from '@tiptap/pm/state';

interface TiptapFloatingToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}

const ToolbarButton = ({ onMouseDown, isActive, children, title }: ToolbarButtonProps) => (
  <button
    type="button"
    onMouseDown={onMouseDown}
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
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  if (!editor) return null;

  const getCurrentStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Título 1';
    if (editor.isActive('heading', { level: 2 })) return 'Título 2';
    if (editor.isActive('heading', { level: 3 })) return 'Título 3';
    if (editor.isActive('heading', { level: 4 })) return 'Título 4';
    if (editor.isActive('blockquote')) return 'Citação';
    return 'Parágrafo';
  };

  const applyStyle = (value: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { state, view } = editor;
    const { from, to } = state.selection;
    const { tr, schema } = state;
    
    // Resolve positions
    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);
    
    // Get the block boundaries
    const blockStart = $from.start($from.depth);
    const blockEnd = $to.end($to.depth);
    
    // Check if this is a partial selection within a single block
    const isPartialSelection = from > blockStart && to < blockEnd;
    const sameBlock = $from.sameParent($to);
    
    if (isPartialSelection && sameBlock) {
      // Use ProseMirror transaction to split and apply style
      let newTr = tr;
      
      // Split at the end of selection first (so positions don't shift for the start split)
      if (to < blockEnd) {
        newTr = newTr.split(to);
      }
      
      // Map the 'from' position after the first split
      const mappedFrom = newTr.mapping.map(from);
      const mappedBlockStart = newTr.mapping.map(blockStart);
      
      // Split at the start of selection
      if (mappedFrom > mappedBlockStart + 1) {
        newTr = newTr.split(mappedFrom);
      }
      
      // Now find the middle block (the one with our selected text) and apply the style
      // After splits, the selected text should be in its own block
      const newMappedFrom = newTr.mapping.map(from);
      const $newPos = newTr.doc.resolve(newMappedFrom);
      
      // Get the block node at the new position
      const blockNodePos = $newPos.before($newPos.depth);
      const blockNode = newTr.doc.nodeAt(blockNodePos);
      
      if (blockNode) {
        // Determine the target node type
        let nodeType;
        let attrs = {};
        
        switch (value) {
          case 'paragraph':
            nodeType = schema.nodes.paragraph;
            break;
          case 'h1':
            nodeType = schema.nodes.heading;
            attrs = { level: 1 };
            break;
          case 'h2':
            nodeType = schema.nodes.heading;
            attrs = { level: 2 };
            break;
          case 'h3':
            nodeType = schema.nodes.heading;
            attrs = { level: 3 };
            break;
          case 'h4':
            nodeType = schema.nodes.heading;
            attrs = { level: 4 };
            break;
          case 'blockquote':
            // For blockquote, we'll handle it differently after dispatch
            nodeType = null;
            break;
        }
        
        if (nodeType) {
          // Apply the block type to the isolated block
          newTr = newTr.setBlockType(blockNodePos, blockNodePos + blockNode.nodeSize, nodeType, attrs);
        }
        
        // Dispatch the transaction
        view.dispatch(newTr);
        
        // Handle blockquote separately (it wraps rather than replaces)
        if (value === 'blockquote') {
          editor.chain().focus().toggleBlockquote().run();
        }
      } else {
        view.dispatch(newTr);
      }
    } else {
      // Full block selection or multi-block - apply style normally
      switch (value) {
        case 'paragraph':
          editor.chain().focus().setParagraph().run();
          break;
        case 'h1':
          editor.chain().focus().setHeading({ level: 1 }).run();
          break;
        case 'h2':
          editor.chain().focus().setHeading({ level: 2 }).run();
          break;
        case 'h3':
          editor.chain().focus().setHeading({ level: 3 }).run();
          break;
        case 'h4':
          editor.chain().focus().setHeading({ level: 4 }).run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
      }
    }
    
    setShowDropdown(false);
  };

  const handleSetLink = () => {
    if (linkUrl && savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      editor.chain()
        .focus()
        .setTextSelection({ from, to })
        .setLink({ href: linkUrl })
        .run();
      setLinkUrl('');
      setShowLinkInput(false);
      savedSelectionRef.current = null;
    }
  };

  const handleRemoveLink = (e: React.MouseEvent) => {
    e.preventDefault();
    editor.chain().focus().unsetLink().run();
  };

  const handleOpenLinkInput = (e: React.MouseEvent) => {
    e.preventDefault();
    // Save selection before opening input
    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
    setShowLinkInput(!showLinkInput);
    setShowDropdown(false);
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
          onMouseDown={(e) => {
            e.preventDefault();
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
          <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px] z-[10000]">
            {paragraphStyles.map((style) => (
              <button
                key={style.value}
                type="button"
                onMouseDown={(e) => applyStyle(style.value, e)}
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
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
        isActive={editor.isActive('bold')}
        title="Negrito"
      >
        <Bold size={16} />
      </ToolbarButton>

      <ToolbarButton
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
        isActive={editor.isActive('italic')}
        title="Itálico"
      >
        <Italic size={16} />
      </ToolbarButton>

      <ToolbarButton
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleStrike().run();
        }}
        isActive={editor.isActive('strike')}
        title="Riscado"
      >
        <Strikethrough size={16} />
      </ToolbarButton>

      <ToolbarButton
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleCode().run();
        }}
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
            onMouseDown={handleRemoveLink}
            isActive={true}
            title="Remover link"
          >
            <Unlink size={16} />
          </ToolbarButton>
        ) : (
          <ToolbarButton
            onMouseDown={handleOpenLinkInput}
            isActive={showLinkInput}
            title="Adicionar link"
          >
            <Link size={16} />
          </ToolbarButton>
        )}

        {showLinkInput && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-zinc-800 border border-white/10 rounded-lg shadow-xl p-2 z-[10000] min-w-[200px]">
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
              onMouseDown={(e) => {
                e.preventDefault();
                handleSetLink();
              }}
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