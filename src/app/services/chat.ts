import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs'; // Sửa: Thêm Subject
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

export interface Notification {
  id: string;
  userId: string;
  message: string;
  link: string;
  read: boolean;
  timestamp: Date;
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

  // 3. Kho cho NOTIFICATION
  private notificationSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationSubject.asObservable();
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();
  
  // SỬA: Thêm Subject mới để thông báo "có tin mới"
  private incomingNotificationSubject = new Subject<Notification>();
  public onNewNotification$ = this.incomingNotificationSubject.asObservable();
  // KẾT THÚC SỬA

  private incomingMessageSubject = new Subject<ChatMessage>();
  public onMessage$ = this.incomingMessageSubject.asObservable();

  private serverUrl = 'http://localhost:8080/ws';
  private apiUrl = environment.apiUrl;
  private currentUserId: string | undefined;

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
    
    if (!this.currentUserId || !token || this.stompClient) return;

    this.stompClient = Stomp.over(() => new SockJS(this.serverUrl));
    
    this.stompClient.configure({
        connectHeaders: { 'Authorization': `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            // Đăng ký kênh CHAT
            this.stompClient?.subscribe(`/topic/user/${this.currentUserId}`, (message: IMessage) => {
                const body = JSON.parse(message.body);
                if (Array.isArray(body)) {
                    this.handleHistoryResponse(body);
                } else {
                    this.handleIncomingMessage(body);
                }
            });
            
            // Đăng ký kênh NOTIFICATION
            this.stompClient?.subscribe(`/topic/notifications/${this.currentUserId}`, (message: IMessage) => {
                const newNotif = JSON.parse(message.body) as Notification;
                // Thêm vào đầu danh sách
                this.notificationSubject.next([newNotif, ...this.notificationSubject.value]);
                // Tăng bộ đếm
                this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
                
                // SỬA: Phát tín hiệu có thông báo MỚI
                this.incomingNotificationSubject.next(newNotif); 
            });
            
            if (!this.authService.isAdminSync()) {
                this.requestHistory('ADMIN');
                this.requestHistory('BOT');
            }
            
            // Tải thông báo cũ và số lượng chưa đọc
            this.loadInitialNotifications();
        }
    });
    this.stompClient.activate();
  }
  
  private handleHistoryResponse(messages: ChatMessage[]) {
    if (!messages) { return; }
    if (messages.length === 0) { return; }
    const sample = messages[0];
    if (sample.from === 'BOT' || sample.to === 'BOT') {
        this.botMessageSubject.next(messages);
    } else {
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
    if (chatMessage.from === 'BOT' || chatMessage.to === 'BOT') {
        const current = this.botMessageSubject.value;
        if (!this.isDuplicate(current, chatMessage)) {
            this.botMessageSubject.next([...current, chatMessage]);
        }
        return;
    }
    if (this.authService.isAdminSync()) {
        if (this.currentAdminChatUser && 
           (chatMessage.from === this.currentAdminChatUser || chatMessage.to === this.currentAdminChatUser)) {
            const current = this.adminMessageSubject.value;
            if (!this.isDuplicate(current, chatMessage)) {
                this.adminMessageSubject.next([...current, chatMessage]);
            }
        }
    } else {
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
        this.stompClient = undefined; 
    }
    this.adminMessageSubject.next([]);
    this.botMessageSubject.next([]);
    this.notificationSubject.next([]); 
    this.unreadCountSubject.next(0); 
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

  // --- CÁC HÀM MỚI ---
  
  loadInitialNotifications(): void {
    // Tải danh sách thông báo cũ
    this.http.get<{success: boolean, notifications: Notification[]}>(`${this.apiUrl}/notifications`).subscribe(res => {
      if (res.success && res.notifications) {
        this.notificationSubject.next(res.notifications);
      }
    });

    // Tải số lượng chưa đọc
    this.http.get<{success: boolean, count: number}>(`${this.apiUrl}/notifications/unread-count`).subscribe(res => {
      if (res.success) {
        this.unreadCountSubject.next(res.count);
      }
    });
  }

  markAsRead(notification: Notification): void {
    if (notification.read) return; // Không cần gọi API nếu đã đọc

    this.http.post<{success: boolean}>(`${this.apiUrl}/notifications/read/${notification.id}`, {}).subscribe(res => {
      if (res.success) {
        // Cập nhật lại list
        const currentNotifs = this.notificationSubject.value;
        const index = currentNotifs.findIndex(n => n.id === notification.id);
        if (index > -1) {
          currentNotifs[index].read = true;
          this.notificationSubject.next([...currentNotifs]);
        }
        // Giảm số lượng chưa đọc
        this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
      }
    });
  }
}