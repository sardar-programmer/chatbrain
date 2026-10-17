import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-surface p-6 shadow-lg duration-200 rounded-card sm:rounded-card">
          <div className="flex flex-col space-y-2 text-left">
            <DialogPrimitive.Title className="font-serif text-lg font-medium text-text-primary">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-text-secondary leading-relaxed">
              {description}
            </DialogPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-sidebar-accent transition-colors focus:outline-none"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
                isDestructive
                  ? 'bg-status-error text-white hover:bg-status-error/90'
                  : 'bg-accent text-accent-foreground hover:bg-accent-hover'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
