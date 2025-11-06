import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
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

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Cập nhật số lượng giỏ hàng ban đầu
    this.cartItemCount = this.cartService.getCartItemCountSync();

    // Subscribe để cập nhật real-time khi user thay đổi
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      // Force update khi user thay đổi
    });

    // Subscribe để cập nhật số lượng giỏ hàng
    this.cartSubscription = this.cartService.cartItems$.subscribe({
      next: (cartItems) => {
        this.cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      },
      error: (error: any) => {
        console.error('Error getting cart items:', error);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: (response) => {
        this.isUserMenuOpen = false;
        this.router.navigate(['/home']);
      },
      error: (error: any) => {
        console.error('Logout error:', error);
        this.isUserMenuOpen = false;
        // Clear storage locally nếu API fail
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