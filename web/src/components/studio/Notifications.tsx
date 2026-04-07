'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore } from '@/stores/studioStore'

const typeColors = {
  success: 'border-green-400 bg-green-50 dark:bg-green-950/40',
  info:    'border-blue-400 bg-blue-50 dark:bg-blue-950/40',
  warning: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40',
  error:   'border-red-400 bg-red-50 dark:bg-red-950/40',
}

export default function Notifications() {
  const notifications = useStudioStore(s => s.notifications)
  const dismiss = useStudioStore(s => s.dismissNotification)

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-[320px] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ x: -80, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: -80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 rounded-xl
              border shadow-lg backdrop-blur-sm text-sm ${typeColors[n.type]}`}
          >
            <span className="text-lg flex-shrink-0 leading-none mt-0.5">{n.agentEmoji}</span>
            <p className="flex-1 text-foreground leading-snug text-xs">{n.message}</p>
            <button
              onClick={() => dismiss(n.id)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0 text-xs leading-none mt-0.5"
            >✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
