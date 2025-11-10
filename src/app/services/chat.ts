import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth';

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
  // Dùng BehaviorSubject để lưu trữ mảng tin nhắn
  private messageSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messageSubject.asObservable();
  
  private serverUrl = 'http://localhost:8080/ws';
  private currentUserId: string | undefined;

  constructor(private authService: AuthService) {
    // Tự động kết nối/ngắt kết nối khi user đăng nhập/đăng xuất
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
    if (!this.currentUserId || !token || this.stompClient?.active) {
   
      return;
    }

    this.stompClient = Stomp.over(() => new SockJS(this.serverUrl));
    
    this.stompClient.configure({
     
      connectHeaders: {
        'Authorization': `Bearer ${token}`
      },
     

      reconnectDelay: 5000,
      onConnect: () => {
        console.log('Connected to WebSocket');
        
        // 1. Lắng nghe tin nhắn mới
        this.stompClient?.subscribe(`/user/${this.currentUserId}/queue/reply`, (message: IMessage) => {
          const chatMessage: ChatMessage = JSON.parse(message.body);
          const currentMessages = this.messageSubject.value;
          this.messageSubject.next([...currentMessages, chatMessage]);
        });

        // 2. Lắng nghe lịch sử chat
        this.stompClient?.subscribe(`/user/${this.currentUserId}/queue/history`, (message: IMessage) => {
          const history: ChatMessage[] = JSON.parse(message.body);
          this.messageSubject.next(history);
        });

        // 3. Yêu cầu lấy lịch sử chat
        this.requestHistory();
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
      }
    });

    this.stompClient.activate();
  }

  public disconnect(): void {
    this.stompClient?.deactivate();
    this.messageSubject.next([]); // Xóa tin nhắn khi đăng xuất
    console.log('Disconnected from WebSocket');
  }

  /**
   * Gửi yêu cầu lấy lịch sử chat
   */
  public requestHistory(): void {
    if (this.stompClient?.active && this.currentUserId) {
      this.stompClient.publish({
        destination: '/app/chat.getHistory',
        body: '' 
      });
    }
  }

  /**
   * Gửi một tin nhắn mới
   */
  public sendMessage(content: string): void {
    if (this.stompClient?.active && this.currentUserId) {
      
      
      const chatMessage = {
        from: null, 
        to: null,
        content: content,
        fromName: '', 
        timestamp: 0 
      };
      
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(chatMessage)
      });
    }
  }
}