import { Component, OnInit, OnDestroy, ElementRef, AfterViewChecked, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { ChatService, ChatMessage } from '../../services/chat';
import { AuthService } from '../../services/auth';
import { RouterModule, Router, NavigationStart } from '@angular/router';

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

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor(
    private chatService: ChatService,
    public authService: AuthService,
    private elementRef: ElementRef,
    private router: Router
  ) {
    this.displayMessages$ = combineLatest([
      this.chatModeSubject,
      this.chatService.botMessages$,
      this.chatService.adminMessages$
    ]).pipe(
      map(([mode, botMsgs, adminMsgs]) => {
        if (this.isOpen) {
            this.shouldScrollToBottom = true;
        }
        return mode === 'BOT' ? botMsgs : adminMsgs;
      })
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  ngOnInit(): void {
    const savedMode = localStorage.getItem('chat_widget_mode');
    if (savedMode === 'ADMIN' || savedMode === 'BOT') {
      this.chatModeSubject.next(savedMode);
    }

    if (this.authService.isAdminSync()) {
      this.chatModeSubject.next('BOT');
    }

    this.subscriptions.push(
      this.router.events.pipe(
        filter(event => event instanceof NavigationStart)
      ).subscribe(() => {
        this.isOpen = false; 
      })
    );

    this.subscriptions.push(
      this.chatService.onMessage$.subscribe((msg) => {
        // Bot trả lời -> Tắt typing, bật cuộn
        if (msg.from === 'BOT') {
          this.isBotTyping = false;
          this.shouldScrollToBottom = true; 
          this.scrollToBottom();
        } else if (this.isOpen) {
          // Tin nhắn realtime khác (từ admin)
          this.shouldScrollToBottom = true;
          this.scrollToBottom();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        const element = this.scrollContainer?.nativeElement;
        if (element) {
          element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.shouldScrollToBottom = true;
      this.switchMode(this.chatMode);
      setTimeout(() => this.scrollToBottom(), 100);
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
      this.scrollToBottom();
    } else {
      alert('Vui lòng đăng nhập để chat');
    }
  }

  get isUserAdmin(): boolean {
    return this.authService.isAdminSync();
  }
}