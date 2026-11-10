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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/70 dark:border-white/10 bg-surface/90 dark:bg-surface/90 backdrop-blur-2xl p-6 shadow-2xl duration-200 rounded-2xl">
          <div className="flex flex-col space-y-2 text-left">
            <DialogPrimitive.Title className="font-sans text-lg font-semibold text-text-primary tracking-tight">
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
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border/60 bg-surface/80 hover:bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-all focus:outline-none"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-4 py-2 text-xs font-medium transition-all focus:outline-none ${
                isDestructive
                  ? 'bg-status-error text-white hover:bg-status-error/90 shadow-sm'
                  : 'btn-orange-gradient text-white shadow-sm'
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
