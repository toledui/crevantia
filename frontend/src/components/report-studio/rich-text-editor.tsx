'use client';

import { Extension, type JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type ReactNode } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2,
  Heading3, IndentIncrease, Italic, List, ListOrdered, Pilcrow, Quote, Redo2,
  Strikethrough, Underline, Undo2,
} from 'lucide-react';

interface RichTextValue {
  doc?: JSONContent;
  fallbackText?: string;
  variables?: ReadonlyArray<readonly [string, string]>;
  onChange: (value: { doc: JSONContent; text: string }) => void;
}

const LayoutAttributes = Extension.create({
  name: 'layoutAttributes',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (element) => ['left', 'center', 'right', 'justify'].includes(element.style.textAlign) ? element.style.textAlign : null,
          renderHTML: (attributes) => attributes.textAlign ? { style: `text-align:${attributes.textAlign}` } : {},
        },
        firstLineIndent: {
          default: false,
          parseHTML: (element) => element.style.textIndent === '1.5em',
          renderHTML: (attributes) => attributes.firstLineIndent ? { style: 'text-indent:1.5em' } : {},
        },
      },
    }];
  },
});

export function RichTextEditor({ doc, fallbackText = '', variables = [], onChange }: RichTextValue) {
  const value = doc?.type === 'doc' ? doc : plainTextDocument(fallbackText);
  const editor = useEditor({
    extensions: [StarterKit, LayoutAttributes],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange({ doc: current.getJSON(), text: current.getText({ blockSeparator: '\n\n' }) }),
  });

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const setBlock = (attributes: Record<string, unknown>) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', attributes).run();
  };
  const align = (textAlign: 'left' | 'center' | 'right' | 'justify') => setBlock({ textAlign });
  const button = (label: string, icon: ReactNode, action: () => void, active = false) => <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={action}>{icon}</button>;
  const activeBlock = editor?.isActive('heading') ? 'heading' : 'paragraph';

  return <div className="rs-rich-editor">
    <div className="rs-rich-toolbar">
      <div>
        {button('Párrafo', <Pilcrow/>, () => editor?.chain().focus().setParagraph().run(), Boolean(editor?.isActive('paragraph')))}
        {button('Título H1', <Heading1/>, () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), Boolean(editor?.isActive('heading', { level: 1 })))}
        {button('Título H2', <Heading2/>, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), Boolean(editor?.isActive('heading', { level: 2 })))}
        {button('Título H3', <Heading3/>, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), Boolean(editor?.isActive('heading', { level: 3 })))}
      </div>
      <div>
        {button('Negrita', <Bold/>, () => editor?.chain().focus().toggleBold().run(), Boolean(editor?.isActive('bold')))}
        {button('Cursiva', <Italic/>, () => editor?.chain().focus().toggleItalic().run(), Boolean(editor?.isActive('italic')))}
        {button('Subrayado', <Underline/>, () => editor?.chain().focus().toggleUnderline().run(), Boolean(editor?.isActive('underline')))}
        {button('Tachado', <Strikethrough/>, () => editor?.chain().focus().toggleStrike().run(), Boolean(editor?.isActive('strike')))}
      </div>
      <div>
        {button('Lista con viñetas', <List/>, () => editor?.chain().focus().toggleBulletList().run(), Boolean(editor?.isActive('bulletList')))}
        {button('Lista numerada', <ListOrdered/>, () => editor?.chain().focus().toggleOrderedList().run(), Boolean(editor?.isActive('orderedList')))}
        {button('Cita', <Quote/>, () => editor?.chain().focus().toggleBlockquote().run(), Boolean(editor?.isActive('blockquote')))}
        {button('Sangría de primera línea', <IndentIncrease/>, () => setBlock({ firstLineIndent: !editor?.getAttributes(activeBlock).firstLineIndent }), Boolean(editor?.getAttributes(activeBlock).firstLineIndent))}
      </div>
      <div>
        {button('Alinear a la izquierda', <AlignLeft/>, () => align('left'))}
        {button('Centrar', <AlignCenter/>, () => align('center'))}
        {button('Alinear a la derecha', <AlignRight/>, () => align('right'))}
        {button('Justificar', <AlignJustify/>, () => align('justify'))}
      </div>
      <div>
        {button('Deshacer texto', <Undo2/>, () => editor?.chain().focus().undo().run())}
        {button('Rehacer texto', <Redo2/>, () => editor?.chain().focus().redo().run())}
      </div>
      {variables.length > 0 && <select aria-label="Insertar campo dinámico" value="" onChange={(event) => { if (event.target.value) editor?.chain().focus().insertContent(event.target.value).run(); }}>
        <option value="">+ Campo dinámico</option>
        {variables.map(([variable, label]) => <option value={variable} key={variable}>{label}</option>)}
      </select>}
    </div>
    <EditorContent editor={editor}/>
  </div>;
}

function plainTextDocument(value: string): JSONContent {
  const paragraphs = value.split(/\n\s*\n/);
  return { type: 'doc', content: (paragraphs.length ? paragraphs : ['']).map((paragraph) => ({
    type: 'paragraph',
    content: paragraph ? [{ type: 'text', text: paragraph.replace(/\n/g, ' ') }] : undefined,
  })) };
}
