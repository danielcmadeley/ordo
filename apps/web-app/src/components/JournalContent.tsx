import React, { useEffect, useRef } from "react";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { Loader } from "./ui/Loader";
import { Todo } from "../types";

interface JournalContentProps {
  content: string;
  setContent: (content: string) => void;
  todos: Todo[];
  onTaskClick: (taskId: string) => void;
  isLoading?: boolean;
}

export function JournalContent({
  content,
  setContent,
  todos,
  onTaskClick,
  isLoading,
}: JournalContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "[" && e.ctrlKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const textBefore = content.substring(0, cursorPos);
      const textAfter = content.substring(textarea.selectionEnd);
      setContent(textBefore + "[[]]" + textAfter);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPos + 2;
      }, 0);
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const processBacklinks = () => {
      // ... existing backlinks processing code ...
    };

    processBacklinks();
  }, [content, todos, onTaskClick]);

  if (isLoading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="relative">
      <AutoResizeTextarea
        ref={textareaRef}
        id="journal-textarea"
        value={content}
        onChange={setContent}
        onKeyDown={handleKeyDown}
        placeholder="Write about your day... Use [[Task name]] to link to tasks (Ctrl+[ for quick insert)"
        className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[300px] font-mono"
      />
      {isLoading && (
        <div className="absolute top-2 right-2 text-sm text-gray-500 flex items-center gap-2">
          <span>Saving</span>
          <Loader size="sm" />
        </div>
      )}
    </div>
  );
}