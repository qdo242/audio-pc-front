import { Component, OnInit, OnDestroy, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { ChatService, ChatMessage } from '../../services/chat';
import { AuthService } from '../../services/auth';
import { RouterModule, Router, NavigationStart } from '@angular/router'; // Import thêm Router

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
    private elementRef: ElementRef,
    private router: Router // Inject Router để bắt sự kiện chuyển trang
  ) {
    this.displayMessages$ = combineLatest([
      this.chatModeSubject,
      this.chatService.botMessages$,
      this.chatService.adminMessages$
    ]).pipe(
      map(([mode, botMsgs, adminMsgs]) => {
        if (this.isOpen) this.shouldScrollToBottom = true;
        return mode === 'BOT' ? botMsgs : adminMsgs;
      })
    );
  }

  // 1. Bắt sự kiện Click toàn màn hình (Để đóng khi click ra ngoài khoảng không)
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Nếu widget đang mở VÀ click KHÔNG nằm trong phạm vi widget -> Đóng lại
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  ngOnInit(): void {
    // Khôi phục chế độ chat cũ
    const savedMode = localStorage.getItem('chat_widget_mode');
    if (savedMode === 'ADMIN' || savedMode === 'BOT') {
      this.chatModeSubject.next(savedMode);
    }

    if (this.authService.isAdminSync()) {
      this.chatModeSubject.next('BOT');
    }

    // 2. Bắt sự kiện Chuyển Trang (Để đóng khi click vào link sang trang khác)
    this.subscriptions.push(
      this.router.events.pipe(
        filter(event => event instanceof NavigationStart)
      ).subscribe(() => {
        this.isOpen = false; // Tự động thu lại khi bắt đầu chuyển trang
      })
    );

    // Lắng nghe tin nhắn để tắt hiệu ứng typing
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
    }, 50);
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.shouldScrollToBottom = true;
      this.switchMode(this.chatMode); // Load lại data để đảm bảo mới nhất
    }
  }

  switchMode(mode: 'BOT' | 'ADMIN'): void {
    this.chatModeSubject.next(mode);
    localStorage.setItem('chat_widget_mode', mode);
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