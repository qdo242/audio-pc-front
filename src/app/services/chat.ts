import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth';
import { environment } from '../interfaces/enviroment';

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  fromName: string;
  content: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private stompClient: Client | undefined;
  
  private messageSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messageSubject.asObservable();

  private incomingMessageSubject = new Subject<ChatMessage>();
  public onMessage$ = this.incomingMessageSubject.asObservable();

  private serverUrl = 'http://localhost:8080/ws';
  private apiUrl = environment.apiUrl;
  private currentUserId: string | undefined;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    const token = this.authService.getToken();
    if (!this.currentUserId || !token || this.stompClient?.active) return;

    this.stompClient = Stomp.over(() => new SockJS(this.serverUrl));
    this.stompClient.configure({
        connectHeaders: { 'Authorization': `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            this.stompClient?.subscribe(`/user/${this.currentUserId}/queue/reply`, (message: IMessage) => {
                const chatMessage: ChatMessage = JSON.parse(message.body);
                this.incomingMessageSubject.next(chatMessage);

                const currentMessages = this.messageSubject.value;
                if (!currentMessages.some(m => m.id === chatMessage.id)) {
                    this.messageSubject.next([...currentMessages, chatMessage]);
                }
            });

            this.stompClient?.subscribe(`/user/${this.currentUserId}/queue/history`, (message: IMessage) => {
                const history: ChatMessage[] = JSON.parse(message.body);
                this.messageSubject.next(history);
            });
            
            if (!this.authService.isAdminSync()) {
                this.requestHistory();
            }
        }
    });
    this.stompClient.activate();
  }

  public disconnect(): void {
    this.stompClient?.deactivate();
    this.messageSubject.next([]);
  }

  getConversations(): Observable<{success: boolean, users: any[]}> {
    return this.http.get<{success: boolean, users: any[]}>(`${this.apiUrl}/chat/conversations`);
  }

  loadChatWithUser(targetUserId: string): void {
    this.messageSubject.next([]);
    if (this.stompClient?.active) {
      this.stompClient.publish({
        destination: '/app/chat.getHistory',
        body: JSON.stringify({ targetUserId: targetUserId }) 
      });
    }
  }

  public requestHistory(): void {
    if (this.stompClient?.active && this.currentUserId) {
      this.stompClient.publish({
        destination: '/app/chat.getHistory',
        body: JSON.stringify({}) 
      });
    }
  }

  public sendMessage(content: string, toUserId?: string): void {
    if (this.stompClient?.active && this.currentUserId) {
      
      const targetId = toUserId || 'admin';

      const tempMessage: ChatMessage = {
        id: 'temp-' + Date.now(),
        from: this.currentUserId,
        to: targetId,
        fromName: this.authService.userName || 'Tôi',
        content: content,
        timestamp: Date.now()
      };

      const currentMessages = this.messageSubject.value;
      this.messageSubject.next([...currentMessages, tempMessage]);

      const payload = {
        from: this.currentUserId,
        to: targetId,
        content: content,
        fromName: this.authService.userName,
        timestamp: 0
      };

      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(payload)
      });
    }
  }
}