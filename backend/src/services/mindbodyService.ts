import { MindbodyClient } from '../types';

const API_BASE = 'https://api.mindbodyonline.com/public/v6';
const API_KEY = process.env.MINDBODY_API_KEY;

export function isConfigured(): boolean {
  return !!API_KEY;
}

function baseHeaders(siteId: string): Record<string, string> {
  return {
    'Api-Key': API_KEY!,
    'SiteId': siteId,
    'Content-Type': 'application/json',
  };
}

function authedHeaders(siteId: string, token: string): Record<string, string> {
  return {
    ...baseHeaders(siteId),
    'Authorization': token,
  };
}

export async function authenticateStaff(
  siteId: string,
  username: string,
  password: string
): Promise<string> {
  // Do NOT send Authorization header for token requests per MindBody docs
  const res = await fetch(`${API_BASE}/usertoken/issue`, {
    method: 'POST',
    headers: baseHeaders(siteId),
    body: JSON.stringify({ Username: username, Password: password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MindBody auth failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  return data.AccessToken;
}

export async function getClients(
  siteId: string,
  token: string,
  options?: { searchText?: string; limit?: number; offset?: number }
): Promise<{ clients: MindbodyClient[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.searchText) params.set('SearchText', options.searchText);
  params.set('Limit', String(options?.limit ?? 100));
  params.set('Offset', String(options?.offset ?? 0));

  const url = `${API_BASE}/client/clients?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: authedHeaders(siteId, token),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MindBody getClients failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  const raw: any[] = data.Clients || [];

  const clients: MindbodyClient[] = raw.map(c => ({
    id: String(c.Id),
    firstName: c.FirstName || '',
    lastName: c.LastName || '',
    email: c.Email || undefined,
    phone: c.MobilePhone || c.HomePhone || undefined,
    isActive: c.Active ?? true,
    creationDate: c.CreationDate || undefined,
    lastActivityDate: c.LastModifiedDateTime || c.FirstAppointmentDate || undefined,
  }));

  return { clients, total: data.PaginationResponse?.TotalResults ?? clients.length };
}
