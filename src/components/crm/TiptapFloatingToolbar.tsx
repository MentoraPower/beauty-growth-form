import React from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3, Quote, Undo, Redo } from 'lucide-react';
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

export function TiptapFloatingToolbar({ editor }: TiptapFloatingToolbarProps) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ 
        duration: 100,
        placement: 'top',
        offset: [0, 10]
      }}
      className="flex items-center gap-0.5 bg-zinc-800 text-white px-2 py-1.5 rounded-lg shadow-xl border border-white/10"
    >
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

      <div className="w-px h-4 bg-white/20 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Título 1"
      >
        <Heading1 size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Título 2"
      >
        <Heading2 size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Título 3"
      >
        <Heading3 size={16} />
      </ToolbarButton>

      <div className="w-px h-4 bg-white/20 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Lista"
      >
        <List size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Citação"
      >
        <Quote size={16} />
      </ToolbarButton>

      <div className="w-px h-4 bg-white/20 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Desfazer"
      >
        <Undo size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Refazer"
      >
        <Redo size={16} />
      </ToolbarButton>
    </BubbleMenu>
  );
}
