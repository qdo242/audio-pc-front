import { Component, OnInit, OnDestroy, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
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
  
  private chatModeSubject = new BehaviorSubject<'BOT' | 'ADMIN'>('BOT');
  displayMessages$: Observable<ChatMessage[]>;
  
  isBotTyping = false;
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(
    private chatService: ChatService,
    public authService: AuthService,
    private elementRef: ElementRef
  ) {
    // Kết hợp 3 luồng: Chế độ chat + Kho Bot + Kho Admin
    this.displayMessages$ = combineLatest([
      this.chatModeSubject,
      this.chatService.botMessages$,
      this.chatService.adminMessages$
    ]).pipe(
      map(([mode, botMsgs, adminMsgs]) => {
        this.shouldScrollToBottom = true;
        return mode === 'BOT' ? botMsgs : adminMsgs;
      })
    );
  }

  ngOnInit(): void {
    // Khôi phục tab cũ từ LocalStorage
    const savedMode = localStorage.getItem('chat_widget_mode');
    if (savedMode === 'ADMIN' || savedMode === 'BOT') {
      this.chatModeSubject.next(savedMode);
    }

    // Admin dùng widget thì luôn về BOT
    if (this.authService.isAdminSync()) {
      this.chatModeSubject.next('BOT');
    }

    this.subscriptions.push(
      this.chatService.onMessage$.subscribe((msg) => {
        if (msg.from === 'BOT') {
          this.isBotTyping = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

  switchMode(mode: 'BOT' | 'ADMIN'): void {
    this.chatModeSubject.next(mode);
    localStorage.setItem('chat_widget_mode', mode); // Lưu lại để F5 nhớ
    this.shouldScrollToBottom = true;
  }

  get chatMode(): 'BOT' | 'ADMIN' {
    return this.chatModeSubject.value;
  }

  onSendMessage(): void {
    if (!this.newMessage.trim()) return;
    
    if (this.authService.isLoggedIn) {
      const target = this.chatMode;
      
      if (target === 'BOT') {
        this.isBotTyping = true;
      }

      this.chatService.sendMessage(this.newMessage, target);
      this.newMessage = '';
      this.shouldScrollToBottom = true;
    } else {
      alert('Vui lòng đăng nhập để chat');
    }
  }

  get isUserAdmin(): boolean {
    return this.authService.isAdminSync();
  }
}