import { useEffect, useRef } from 'react';
import { auth } from '../config/firebase';

interface SSECallbacks {
  onScoreUpdate?: (data: { eventId: number; round: string }) => void;
  onScheduleUpdate?: (data: { competitionId: number }) => void;
}

export function useCompetitionSSE(competitionId: number | null, callbacks: SSECallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!competitionId) return;

    let es: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      if (cancelled) return;

      const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
      const url = `${apiBase}/judging/competition/${competitionId}/stream?token=${encodeURIComponent(token)}`;

      es = new EventSource(url);

      es.addEventListener('scoreUpdate', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacksRef.current.onScoreUpdate?.(data);
      });

      es.addEventListener('scheduleUpdate', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacksRef.current.onScheduleUpdate?.(data);
      });
    };

    connect();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [competitionId]);
}
