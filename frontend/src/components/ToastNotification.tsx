import React from 'react';

export interface ToastNotificationProps {
  tone: 'success' | 'error' | 'info';
  message: string;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ tone, message }) => (
  <div className={`toast-notification toast-${tone}`} role="status" aria-live="polite">
    {message}
  </div>
);
