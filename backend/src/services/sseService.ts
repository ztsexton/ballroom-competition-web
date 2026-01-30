import { Response } from 'express';

interface SSEClient {
  id: string;
  competitionId: number;
  res: Response;
}

class SSEService {
  private clients: SSEClient[] = [];

  addClient(competitionId: number, res: Response): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

    const client: SSEClient = { id, competitionId, res };
    this.clients.push(client);

    res.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== id);
    });

    return id;
  }

  broadcastScoreUpdate(competitionId: number, eventId: number, round: string): void {
    const data = JSON.stringify({ eventId, round, timestamp: Date.now() });
    this.broadcast(competitionId, 'scoreUpdate', data);
  }

  broadcastScheduleUpdate(competitionId: number): void {
    const data = JSON.stringify({ competitionId, timestamp: Date.now() });
    this.broadcast(competitionId, 'scheduleUpdate', data);
  }

  private broadcast(competitionId: number, event: string, data: string): void {
    this.clients
      .filter(c => c.competitionId === competitionId)
      .forEach(client => {
        client.res.write(`event: ${event}\ndata: ${data}\n\n`);
      });
  }
}

export const sseService = new SSEService();
