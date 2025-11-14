import { Component, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header implements OnInit, OnDestroy {
  isMenuOpen = false;
  isUserMenuOpen = false;
  cartItemCount: number = 0;
  private userSubscription: Subscription | undefined;
  private cartSubscription: Subscription | undefined;
  private routerSubscription: Subscription | undefined; 

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    private router: Router, 
    private el: ElementRef 
  ) {}

  // Lắng nghe sự kiện click toàn trang để đóng menu khi click ra ngoài
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Nếu đang mở menu User và click ra ngoài -> Đóng
    if (this.isUserMenuOpen && !this.el.nativeElement.contains(event.target)) {
      this.isUserMenuOpen = false;
    }
    // Nếu đang mở menu Mobile và click ra ngoài -> Đóng
    if (this.isMenuOpen && !this.el.nativeElement.contains(event.target)) {
      this.isMenuOpen = false;
    }
  }

  ngOnInit(): void {
    this.cartItemCount = this.cartService.getCartItemCountSync();

    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      // Cập nhật thông tin user nếu cần
    });

    this.cartSubscription = this.cartService.cartItems$.subscribe({
      next: (cartItems) => {
        this.cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      },
      error: (error: any) => console.error('Error getting cart items:', error)
    });

    // Tự động đóng menu khi bắt đầu chuyển trang
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      this.isUserMenuOpen = false;
      this.isMenuOpen = false;
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe(); 
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  // === HÀM QUAN TRỌNG: Chuyển trang và đóng menu ===
  navigateAndClose(path: string): void {
    this.isUserMenuOpen = false;
    this.isMenuOpen = false;
    this.router.navigate([path]);
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        this.router.navigate(['/home']);
      }
    });
  }

  get userInitials(): string {
    return this.authService.getUserInitials();
  }

  get isAdmin(): boolean {
    return this.authService.isAdminSync();
  }

  get userName(): string {
    return this.authService.userName || 'Người dùng';
  }
}