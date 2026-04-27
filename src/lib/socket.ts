// src/lib/socket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

interface LeadAssignedPayload {
  leadId: string | null;
  leadName: string;
  assignedByName: string;
  message: string;
}

export function useGlobalSocket(userId?: string, token?: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId || !token) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', userId);
      console.log('[Socket] Connected → joined room user:', userId);
    });

    socket.on('lead_assigned', async (data: LeadAssignedPayload) => {
      // 1. Show in-app toast
      toast({ title: '📋 New Lead Assigned', description: data.message, duration: 7000 });
      
      // 2. Fire global event so Leads.tsx can silently refresh if it's currently open
      window.dispatchEvent(new CustomEvent('lead_assigned_refresh'));
      // Note: PWA Desktop Notification is handled by the Service Worker via Web Push
    });

    socket.on('followup_reminder', async (data: any) => {
      toast({ title: '⏰ Follow-up Reminder', description: data.message, duration: 7000 });
      window.dispatchEvent(new CustomEvent('lead_assigned_refresh')); // Refresh leads list
      // Note: PWA Desktop Notification is handled by the Service Worker via Web Push
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token, toast]);
}