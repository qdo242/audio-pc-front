import { Component, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core'; // SỬA: Thêm OnInit, OnDestroy, ElementRef, HostListener
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ChatService, Notification } from '../../services/chat'; 
import { Observable, Subscription } from 'rxjs'; // SỬA: Thêm Subscription

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './notification-bell.html',
  styleUrls: ['./notification-bell.scss']
})
export class NotificationBell implements OnInit, OnDestroy { // SỬA: Thêm OnInit, OnDestroy
  isDropdownOpen = false;

  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;

  private notificationSub: Subscription | undefined; // SỬA: Thêm subscription

  constructor(
    private chatService: ChatService,
    private router: Router,
    private elementRef: ElementRef // SỬA: Thêm ElementRef
  ) {
    this.notifications$ = this.chatService.notifications$;
    this.unreadCount$ = this.chatService.unreadCount$;
  }

  // SỬA: Thêm HostListener để click ra ngoài
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Nếu dropdown đang mở VÀ click ra ngoài component
    if (this.isDropdownOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  // SỬA: Thêm OnInit để lắng nghe tin nhắn mới
  ngOnInit(): void {
    this.notificationSub = this.chatService.onNewNotification$.subscribe(() => {
      this.isDropdownOpen = true; // Tự động mở khi có tin mới
    });
  }

  ngOnDestroy(): void {
    this.notificationSub?.unsubscribe(); // Hủy đăng ký
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation(); // Ngăn sự kiện click lan ra document
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  onNotificationClick(notification: Notification): void {
    this.isDropdownOpen = false;
    this.chatService.markAsRead(notification); 
    this.router.navigate([notification.link]); 
  }

  markAllAsRead(): void {
    // (Tùy chọn) Implement logic đánh dấu tất cả đã đọc
  }
}