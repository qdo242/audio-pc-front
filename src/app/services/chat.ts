import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth';
import { environment } from '../interfaces/enviroment';

export interface ChatMessage {
  id?: string;
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
  
  // 1. Kho tin nhắn Admin (User <-> Admin)
  private adminMessageSubject = new BehaviorSubject<ChatMessage[]>([]);
  public adminMessages$ = this.adminMessageSubject.asObservable();

  // 2. Kho tin nhắn Bot (User <-> Bot)
  private botMessageSubject = new BehaviorSubject<ChatMessage[]>([]);
  public botMessages$ = this.botMessageSubject.asObservable();

  private incomingMessageSubject = new Subject<ChatMessage>();
  public onMessage$ = this.incomingMessageSubject.asObservable();

  private serverUrl = 'http://localhost:8080/ws';
  private apiUrl = environment.apiUrl;
  private currentUserId: string | undefined;

  // Biến dùng cho Admin Page
  private currentAdminChatUser: string | null = null;

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
            this.stompClient?.subscribe(`/topic/user/${this.currentUserId}`, (message: IMessage) => {
                const body = JSON.parse(message.body);
                if (Array.isArray(body)) {
                    this.handleHistoryResponse(body);
                } else {
                    this.handleIncomingMessage(body);
                }
            });
            
            // MẶC ĐỊNH: Tải lịch sử cả 2 luồng (để F5 không mất)
            if (!this.authService.isAdminSync()) {
                this.requestHistory('ADMIN');
                this.requestHistory('BOT');
            }
        }
    });
    this.stompClient.activate();
  }

  private handleHistoryResponse(messages: ChatMessage[]) {
    if (!messages || messages.length === 0) return;
    const sample = messages[0];
    
    if (sample.from === 'BOT' || sample.to === 'BOT') {
        this.botMessageSubject.next(messages);
    } else {
        // Nếu là Admin đang xem lịch sử của user
        if (this.authService.isAdminSync()) {
             if (this.currentAdminChatUser && 
                (sample.from === this.currentAdminChatUser || sample.to === this.currentAdminChatUser)) {
                 this.adminMessageSubject.next(messages);
             }
        } else {
            this.adminMessageSubject.next(messages);
        }
    }
  }

  private handleIncomingMessage(chatMessage: ChatMessage) {
    this.incomingMessageSubject.next(chatMessage);

    // 1. Tin nhắn BOT
    if (chatMessage.from === 'BOT' || chatMessage.to === 'BOT') {
        const current = this.botMessageSubject.value;
        if (!this.isDuplicate(current, chatMessage)) {
            this.botMessageSubject.next([...current, chatMessage]);
        }
        return;
    }

    // 2. Tin nhắn ADMIN/USER
    if (this.authService.isAdminSync()) {
        // Admin chỉ thêm nếu đang chat với đúng User đó
        if (this.currentAdminChatUser && 
           (chatMessage.from === this.currentAdminChatUser || chatMessage.to === this.currentAdminChatUser)) {
            const current = this.adminMessageSubject.value;
            if (!this.isDuplicate(current, chatMessage)) {
                this.adminMessageSubject.next([...current, chatMessage]);
            }
        }
    } else {
        // User luôn thêm vào kho Admin
        const current = this.adminMessageSubject.value;
        if (!this.isDuplicate(current, chatMessage)) {
            this.adminMessageSubject.next([...current, chatMessage]);
        }
    }
  }

  private isDuplicate(list: ChatMessage[], newMsg: ChatMessage): boolean {
    return list.some(m => m.id === newMsg.id || (m.timestamp === newMsg.timestamp && m.content === newMsg.content));
  }

  public disconnect(): void {
    if (this.stompClient) {
        this.stompClient.deactivate();
    }
    this.adminMessageSubject.next([]);
    this.botMessageSubject.next([]);
    this.currentAdminChatUser = null;
  }

  getConversations(): Observable<{success: boolean, users: any[]}> {
    return this.http.get<{success: boolean, users: any[]}>(`${this.apiUrl}/chat/conversations`);
  }

  loadChatWithUser(targetUserId: string): void {
    this.currentAdminChatUser = targetUserId;
    this.adminMessageSubject.next([]); 
    this.requestHistory(targetUserId); 
  }

  public requestHistory(targetId: string): void {
    if (this.stompClient?.active) {
      this.stompClient.publish({
        destination: '/app/chat.getHistory',
        body: JSON.stringify({ targetUserId: targetId }) 
      });
    }
  }

  public sendMessage(content: string, toUserId: string): void {
    if (this.stompClient?.active && this.currentUserId) {
      const payload = {
        from: this.currentUserId,
        to: toUserId, 
        content: content,
        fromName: this.authService.userName,
        timestamp: Date.now()
      };
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(payload)
      });
    }
  }
}