import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ChatService, ChatMessage } from '../../services/chat';
import { AuthService } from '../../services/auth';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chat-widget.html',
  styleUrls: ['./chat-widget.scss']
})
export class ChatWidget implements OnInit, OnDestroy, AfterViewChecked {
  isOpen = false;
  newMessage = '';
  // Sử dụng messages$ thay vì history$
  messages$: Observable<ChatMessage[]>;
  private messageSubscription: Subscription | undefined;
  private shouldScrollToBottom = false;

  constructor(
    private chatService: ChatService,
    public authService: AuthService,
    private elementRef: ElementRef
  ) {
    // Gán đúng biến từ service
    this.messages$ = this.chatService.messages$;
  }

  ngOnInit(): void {
    // Đăng ký lắng nghe để auto-scroll
    this.messageSubscription = this.messages$.subscribe(() => {
      this.shouldScrollToBottom = true;
    });
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.isOpen) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      try {
        const messageList = this.elementRef.nativeElement.querySelector('.messages-list');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        }
      } catch (err) {
        console.error('Scroll error:', err);
      }
    }, 0);
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.shouldScrollToBottom = true;
    }
  }

  onSendMessage(): void {
    if (!this.newMessage.trim()) return;
    
    if (this.authService.isLoggedIn) {
      this.chatService.sendMessage(this.newMessage);
      this.newMessage = '';
      this.shouldScrollToBottom = true;
    } else {
      alert('Vui lòng đăng nhập để chat');
    }
  }
}