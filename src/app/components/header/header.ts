import { Component, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core'; // SỬA: Thêm ElementRef, HostListener
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router'; // SỬA: Thêm Router, NavigationStart
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators'; // SỬA: Thêm filter
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

  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    
    
    if (this.isUserMenuOpen && !this.el.nativeElement.contains(event.target)) {
      this.isUserMenuOpen = false;
    }
    // Tương tự cho menu mobile
    if (this.isMenuOpen && !this.el.nativeElement.contains(event.target)) {
        this.isMenuOpen = false;
    }
  }

  ngOnInit(): void {
    this.cartItemCount = this.cartService.getCartItemCountSync();

    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      // Cập nhật khi user thay đổi
    });

    this.cartSubscription = this.cartService.cartItems$.subscribe({
      next: (cartItems) => {
        this.cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      },
      error: (error: any) => {
        console.error('Error getting cart items:', error);
      }
    });

    
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      // Tự động đóng cả 2 menu khi bắt đầu chuyển trang
      this.isUserMenuOpen = false;
      this.isMenuOpen = false;
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe(); 
  }

  
  toggleMenu(event?: Event): void {
    event?.stopPropagation(); 
    this.isMenuOpen = !this.isMenuOpen;
  }

  
  toggleUserMenu(event?: Event): void {
    event?.stopPropagation(); 
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