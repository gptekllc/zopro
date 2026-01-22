export const NOTIFICATION_TYPES = [
  { 
    type: 'assignment', 
    label: 'Assignments', 
    description: 'When assigned to jobs, quotes, or invoices',
    icon: '📋'
  },
  { 
    type: 'payment_received', 
    label: 'Payments Received', 
    description: 'Payment confirmations',
    icon: '💰'
  },
  { 
    type: 'payment_failed', 
    label: 'Failed Payments', 
    description: 'Payment failure alerts',
    icon: '❌'
  },
  { 
    type: 'quote_approved', 
    label: 'Quote Approvals', 
    description: 'When quotes are approved by customers',
    icon: '✅'
  },
  { 
    type: 'quote_rejected', 
    label: 'Quote Rejections', 
    description: 'When quotes are rejected',
    icon: '🚫'
  },
  { 
    type: 'negative_feedback', 
    label: 'Negative Feedback', 
    description: 'Low rating alerts (3 stars or below)',
    icon: '⭐'
  },
  { 
    type: 'feedback_updated', 
    label: 'Feedback Updates', 
    description: 'When customers update their feedback',
    icon: '📝'
  },
  { 
    type: 'join_request', 
    label: 'Team Requests', 
    description: 'Join requests for your company',
    icon: '👥'
  },
  { 
    type: 'job_status', 
    label: 'Job Status Changes', 
    description: 'When job status is updated',
    icon: '🔄'
  },
  { 
    type: 'status_change', 
    label: 'Status Updates', 
    description: 'When job, quote, or invoice status changes',
    icon: '🔄'
  },
  { 
    type: 'invoice_reminder', 
    label: 'Invoice Reminders', 
    description: 'Overdue invoice alerts',
    icon: '⏰'
  },
  { 
    type: 'signature_requested', 
    label: 'Signature Requests', 
    description: 'When signature is requested',
    icon: '✍️'
  },
  { 
    type: 'general', 
    label: 'General', 
    description: 'Other notifications',
    icon: '🔔'
  },
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number]['type'];

export function getNotificationTypeConfig(type: string) {
  return NOTIFICATION_TYPES.find(t => t.type === type) || NOTIFICATION_TYPES[NOTIFICATION_TYPES.length - 1];
}
