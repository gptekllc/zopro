import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

interface MenuBarProps {
  editor: Editor | null;
}

const MenuBar = ({ editor }: MenuBarProps) => {
  if (!editor) {
    return null;
  }

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const tools = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: UnderlineIcon,
      label: 'Underline',
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
    },
    { separator: true },
    {
      icon: Heading1,
      label: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    { separator: true },
    {
      icon: List,
      label: 'Bullet List',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    { separator: true },
    {
      icon: AlignLeft,
      label: 'Align Left',
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: editor.isActive({ textAlign: 'left' }),
    },
    {
      icon: AlignCenter,
      label: 'Align Center',
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: editor.isActive({ textAlign: 'center' }),
    },
    {
      icon: AlignRight,
      label: 'Align Right',
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: editor.isActive({ textAlign: 'right' }),
    },
    { separator: true },
    {
      icon: editor.isActive('link') ? Unlink : LinkIcon,
      label: editor.isActive('link') ? 'Remove Link' : 'Add Link',
      action: editor.isActive('link')
        ? () => editor.chain().focus().unsetLink().run()
        : addLink,
      isActive: editor.isActive('link'),
    },
    { separator: true },
    {
      icon: Undo,
      label: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().undo(),
    },
    {
      icon: Redo,
      label: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().redo(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border border-b-0 rounded-t-md bg-muted/30">
      {tools.map((tool, index) =>
        'separator' in tool && tool.separator ? (
          <Separator key={index} orientation="vertical" className="h-6 mx-1" />
        ) : (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0',
              tool.isActive && 'bg-accent text-accent-foreground'
            )}
            onClick={tool.action}
            title={tool.label}
            disabled={'disabled' in tool ? tool.disabled : false}
          >
            {tool.icon && <tool.icon className="w-3.5 h-3.5" />}
          </Button>
        )
      )}
    </div>
  );
};

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  onFocus,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-3 focus:outline-none',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Method to insert text at cursor (for placeholders)
  const insertTextAtCursor = useCallback(
    (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    [editor]
  );

  // Expose insert method via ref-like pattern using data attribute
  useEffect(() => {
    const editorElement = document.querySelector('[data-rich-text-editor]');
    if (editorElement) {
      (editorElement as any).__insertText = insertTextAtCursor;
    }
  }, [insertTextAtCursor]);

  return (
    <div className={cn('rounded-md border', className)} data-rich-text-editor>
      <MenuBar editor={editor} />
      <EditorContent
        editor={editor}
        className="bg-background rounded-b-md [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
};

// Hook to get editor instance for placeholder insertion
export const useRichTextEditorInsert = () => {
  const insertPlaceholder = useCallback((text: string) => {
    const editorElement = document.querySelector('[data-rich-text-editor]');
    if (editorElement && (editorElement as any).__insertText) {
      (editorElement as any).__insertText(text);
    }
  }, []);

  return { insertPlaceholder };
};
