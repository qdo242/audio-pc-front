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

  // --- THÊM MỚI: Biến theo dõi người đang chat cùng (cho Admin) ---
  private activeChatUserId: string | null = null;

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
            // Subscribe kênh riêng của user: /topic/user/{userID}
            this.stompClient?.subscribe(`/topic/user/${this.currentUserId}`, (message: IMessage) => {
                const body = JSON.parse(message.body);
                
                if (Array.isArray(body)) {
                    // Nhận lịch sử chat (Mảng tin nhắn)
                    this.messageSubject.next(body);
                } else {
                    // Nhận tin nhắn mới (1 Object tin nhắn)
                    const chatMessage: ChatMessage = body;
                    this.handleIncomingMessage(chatMessage);
                }
            });
            
            // Nếu là User thường, tự động tải lịch sử chat (với Admin)
            if (!this.authService.isAdminSync()) {
                this.requestHistory();
            }
        }
    });
    this.stompClient.activate();
  }

  private handleIncomingMessage(chatMessage: ChatMessage) {
    // 1. Luôn bắn event này để Admin component cập nhật Sidebar (số tin chưa đọc)
    // Bất kể đang chat với ai, sidebar cần biết có tin nhắn mới để hiện chấm đỏ
    this.incomingMessageSubject.next(chatMessage);

    // 2. --- THÊM MỚI: Logic lọc tin nhắn cho Admin ---
    if (this.authService.isAdminSync()) {
        // Kiểm tra xem tin nhắn này có thuộc cuộc hội thoại đang mở hay không
        // (Là tin nhắn TỪ người đang chat HOẶC tin nhắn GỬI CHO người đang chat)
        const isMessageForCurrentChat = 
            this.activeChatUserId && 
            (chatMessage.from === this.activeChatUserId || chatMessage.to === this.activeChatUserId);

        // Nếu không phải cuộc hội thoại này, thì DỪNG LẠI
        // Không đẩy vào danh sách hiển thị (messageSubject)
        if (!isMessageForCurrentChat) {
            return;
        }
    }

    // 3. Cập nhật vào khung chat hiện tại (nếu thỏa mãn điều kiện trên)
    const currentMessages = this.messageSubject.value;
    
    // Kiểm tra trùng lặp ID để tránh hiển thị 2 lần
    if (!currentMessages.some(m => m.id === chatMessage.id)) {
        this.messageSubject.next([...currentMessages, chatMessage]);
    }
  }

  public disconnect(): void {
    if (this.stompClient) {
        this.stompClient.deactivate();
    }
    this.messageSubject.next([]);
    this.activeChatUserId = null;
  }

  getConversations(): Observable<{success: boolean, users: any[]}> {
    return this.http.get<{success: boolean, users: any[]}>(`${this.apiUrl}/chat/conversations`);
  }

  // Hàm được Admin gọi khi chọn một user từ sidebar
  loadChatWithUser(targetUserId: string): void {
    // --- THÊM MỚI: Cập nhật ID người đang chat ---
    this.activeChatUserId = targetUserId;

    // Xóa tin nhắn cũ trên UI để chờ tải mới
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
      
      const payload = {
        from: this.currentUserId,
        to: toUserId, 
        content: content,
        fromName: this.authService.userName,
        timestamp: Date.now()
      };

      // Gửi lên server và KHÔNG tự add vào danh sách ngay tại đây
      // (Chờ server gửi lại qua /topic để đảm bảo đồng bộ và có ID)
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(payload)
      });
    }
  }

  sendMessageToBot(message: string): Observable<{response: string}> {
    return this.http.post<{response: string}>(`${this.apiUrl}/bot/chat`, { message });
  }

}