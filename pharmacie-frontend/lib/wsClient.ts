/**
 * 🔴 Client WebSocket réutilisable, avec reconnexion automatique.
 *
 * Pourquoi la reconnexion automatique est importante ici :
 * Les connexions mobiles (3G/4G en zone CEMAC) coupent et reprennent fréquemment.
 * Sans reconnexion automatique, un agent de caisse qui perd le réseau 2 secondes devrait
 * recharger toute la page pour retrouver le flux temps réel -- ce qui réintroduirait
 * exactement le problème qu'on cherche à éliminer (rater une mise à jour pendant qu'on
 * ne regarde pas l'écran).
 */

type MessageHandler = (data: any) => void;

export function buildWsUrl(path: string): string {
  // On dérive l'URL WebSocket depuis la même base que l'API HTTP (NEXT_PUBLIC_API_URL),
  // en remplaçant simplement le protocole http(s) par ws(s).
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';
  const wsBase = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
  return `${wsBase}${path}`;
}

export class ReconnectingSocket {
  private url: string;
  private socket: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 1000; // démarre à 1s, double à chaque échec (backoff exponentiel)
  private maxReconnectDelay = 30000; // jamais plus de 30s entre deux tentatives
  private shouldReconnect = true;
  private onOpenCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(path: string) {
    this.url = buildWsUrl(path);
  }

  connect() {
    this.shouldReconnect = true;
    this._open();
  }

  private _open() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const urlAvecToken = `${this.url}${this.url.includes('?') ? '&' : '?'}token=${token || ''}`;

    this.socket = new WebSocket(urlAvecToken);

    this.socket.onopen = () => {
      this.reconnectDelay = 1000; // succès -> on réinitialise le délai de backoff
      this.onOpenCallback?.();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach((h) => h(data));
      } catch {
        // Message non-JSON ignoré silencieusement (ne devrait pas arriver avec notre backend)
      }
    };

    this.socket.onclose = () => {
      this.onCloseCallback?.();
      if (this.shouldReconnect) {
        setTimeout(() => this._open(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    };

    this.socket.onerror = () => {
      // onclose sera de toute façon appelé juste après -> la reconnexion s'y déclenche
    };
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  onOpen(callback: () => void) {
    this.onOpenCallback = callback;
  }

  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  disconnect() {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
