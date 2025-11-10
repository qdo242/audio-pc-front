import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ChatService,ChatMessage } from '../../services/chat';
import { AuthService } from '../../services/auth';
import { RouterModule } from '@angular/router'; // Thêm RouterModule

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule], // Thêm RouterModule
  templateUrl: './chat-widget.html',
  styleUrls: ['./chat-widget.scss']
})
export class ChatWidget implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesListContainer') private messagesListContainer!: ElementRef;

  isOpen = false;
  newMessage = '';
  messages$: Observable<ChatMessage[]>;
  private messageSubscription: Subscription | undefined;
  private needsScroll = false; // Thêm cờ này

  constructor(
    private chatService: ChatService,
    public authService: AuthService
  ) {
    this.messages$ = this.chatService.messages$;
  }

  ngOnInit(): void {
    this.messageSubscription = this.messages$.subscribe(() => {
      // Khi có tin nhắn mới (hoặc lịch sử), đánh dấu là cần cuộn
      this.needsScroll = true; 
    });
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    // Chỉ cuộn NẾU cần thiết và cửa sổ đang mở
    if (this.needsScroll && this.isOpen) {
      this.scrollToBottom();
      this.needsScroll = false; // Reset cờ
    }
  }

  scrollToBottom(): void {
    // SỬA LỖI Ở ĐÂY: Dùng setTimeout(..., 0)
    // Buộc hàm này chạy trong chu kỳ tiếp theo, sau khi Angular đã render DOM
    setTimeout(() => {
      try {
        if (this.messagesListContainer?.nativeElement) {
          this.messagesListContainer.nativeElement.scrollTop = this.messagesListContainer.nativeElement.scrollHeight;
        }
      } catch(err) { 
        console.warn("Lỗi khi cuộn chat:", err);
      }
    }, 0); 
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Khi mở, đánh dấu cần cuộn để ngAfterViewChecked xử lý
      this.needsScroll = true;
    }
  }

  onSendMessage(): void {
    if (this.newMessage.trim() && this.authService.isLoggedIn) {
      this.chatService.sendMessage(this.newMessage);
      this.newMessage = '';
    } else if (!this.authService.isLoggedIn) {
      alert('Vui lòng đăng nhập để chat');
    }
  }
}