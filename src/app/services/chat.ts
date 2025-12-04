import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth';
import { environment } from '../interfaces/enviroment';

export interface ChatMessage { id?: string; from: string; to: string; fromName: string; content: string; timestamp: number; }
export interface Notification { id: string; userId: string; message: string; link: string; read: boolean; timestamp: Date; }

@Injectable({ providedIn: 'root' })
export class ChatService {
  private stompClient: Client | undefined;

  public adminMessages$ = new BehaviorSubject<ChatMessage[]>([]);
  public botMessages$ = new BehaviorSubject<ChatMessage[]>([]);
  public notifications$ = new BehaviorSubject<Notification[]>([]);
  public unreadCount$ = new BehaviorSubject<number>(0);
  public onNewNotification$ = new Subject<Notification>();
  public onMessage$ = new Subject<ChatMessage>(); // Tin nhắn mới

  private serverUrl = 'http://localhost:8080/ws';
  private apiUrl = environment.apiUrl;
  private currentUserId: string | undefined;
  private currentAdminChatUser: string | null = null;

  constructor(private authService: AuthService, private http: HttpClient) {
    this.authService.currentUser$.subscribe(user => {
      if (user) { this.currentUserId = user.id; this.connect(); }
      else { this.disconnect(); }
    });
  }

  private connect(): void {
    const token = this.authService.getToken();
    if (!this.currentUserId || !token || this.stompClient) return;

    this.stompClient = Stomp.over(() => new SockJS(this.serverUrl));
    this.stompClient.configure({
        connectHeaders: { 'Authorization': `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            // Kênh Chat
            this.stompClient?.subscribe(`/topic/user/${this.currentUserId}`, (message: IMessage) => {
                const body = JSON.parse(message.body);
                if (!Array.isArray(body)) this.handleIncomingMessage(body);
            });
            // Kênh Thông báo
            this.stompClient?.subscribe(`/topic/notifications/${this.currentUserId}`, (message: IMessage) => {
                const newNotif = JSON.parse(message.body) as Notification;
                this.notificationSubjectNext(newNotif);
            });
            this.loadInitialNotifications();
        }
    });
    this.stompClient.activate();
  }

  private handleIncomingMessage(chatMessage: ChatMessage) {
    this.onMessage$.next(chatMessage); // Bắn event tin nhắn mới

    if (chatMessage.from === 'BOT' || chatMessage.to === 'BOT') {
        this.botMessages$.next([...this.botMessages$.value, chatMessage]);
        return;
    }

    // Nếu là Admin, và đang chat với user này thì thêm vào list adminMessages
    if (this.authService.isAdminSync()) {
        if (this.currentAdminChatUser && (chatMessage.from === this.currentAdminChatUser || chatMessage.to === this.currentAdminChatUser)) {
            this.adminMessages$.next([...this.adminMessages$.value, chatMessage]);
        }
    } else {
        this.adminMessages$.next([...this.adminMessages$.value, chatMessage]);
    }
  }

  // [QUAN TRỌNG] Load lịch sử từ API REST
  loadChatWithUser(targetUserId: string): void {
    this.currentAdminChatUser = targetUserId;
    this.adminMessages$.next([]); // Clear UI tạm thời

    this.http.get<{success: boolean, history: ChatMessage[]}>(`${this.apiUrl}/chat/admin/history/${targetUserId}`)
      .subscribe({
        next: (res) => {
          if (res.success && res.history) {
            this.adminMessages$.next(res.history);
          }
        },
        error: (err) => console.error('Lỗi tải lịch sử chat:', err)
      });
  }

  public sendMessage(content: string, toUserId: string): void {
    if (this.stompClient?.active && this.currentUserId) {
      const payload = {
        from: this.currentUserId, to: toUserId, content: content,
        fromName: this.authService.userName, timestamp: Date.now()
      };
      this.stompClient.publish({ destination: '/app/chat.sendMessage', body: JSON.stringify(payload) });
    }
  }

  // Helpers
  public disconnect(): void { if (this.stompClient) { this.stompClient.deactivate(); this.stompClient = undefined; } }

  getConversations(): Observable<{success: boolean, users: any[]}> {
     return this.http.get<{success: boolean, users: any[]}>(`${this.apiUrl}/chat/conversations`);
  }

  private notificationSubjectNext(n: Notification) {
      this.notifications$.next([n, ...this.notifications$.value]);
      this.unreadCount$.next(this.unreadCount$.value + 1);
      this.onNewNotification$.next(n);
  }
  loadInitialNotifications(): void {
    this.http.get<any>(`${this.apiUrl}/notifications`).subscribe(r => r.success && this.notifications$.next(r.notifications));
    this.http.get<any>(`${this.apiUrl}/notifications/unread-count`).subscribe(r => r.success && this.unreadCount$.next(r.count));
  }
  markAsRead(n: Notification): void { if(n.read) return; this.http.post<any>(`${this.apiUrl}/notifications/read/${n.id}`, {}).subscribe(r => { if(r.success) this.loadInitialNotifications(); }); }

  // Giữ lại requestHistory cho Bot (nếu cần)
  public requestHistory(targetId: string): void { if (this.stompClient?.active) this.stompClient.publish({ destination: '/app/chat.getHistory', body: JSON.stringify({ targetUserId: targetId }) }); }
}
